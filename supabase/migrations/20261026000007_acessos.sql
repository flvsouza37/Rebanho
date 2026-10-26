-- Rebanho: acessos por módulo, decididos pelo pastor.
-- O perfil (papel) vira só o ponto de partida: o pastor marca, para cada pessoa da equipe,
-- se ela não vê, vê ou edita cada módulo. O pastor sempre vê e edita tudo.

alter table vinculos add column acessos jsonb not null default '{}'::jsonb check (jsonb_typeof(acessos) = 'object');

-- Módulos que o pastor pode liberar. Novos módulos entram aqui e em acesso_padrao.
create function modulos() returns text[] language sql immutable as $$
  select array['pessoas','pastoral','missao','diagnostico','pdca','kanban','financeiro','auditoria','ouvidoria']
$$;

-- O que cada perfil recebe enquanto o pastor não muda nada (igual às regras de antes).
create function acesso_padrao(p papel_t, m text) returns text language sql immutable as $$
  select case
    when p = 'pastor' then 'editar'
    when p = 'secretaria' and m in ('pessoas','missao','diagnostico','pdca','kanban') then 'editar'
    when p = 'lider' and m in ('pessoas','kanban') then 'editar'
    when p = 'lider' and m in ('missao','pdca') then 'ver'
    when p = 'tesouraria' and m = 'financeiro' then 'editar'
    when p = 'tesouraria' and m = 'pessoas' then 'ver'
    else 'nenhum'
  end
$$;

create function nivel_de(v vinculos, m text) returns text language sql stable as $$
  select case when v.papel = 'pastor' then 'editar' else coalesce(v.acessos ->> m, acesso_padrao(v.papel, m)) end
$$;

-- Nível do usuário logado num módulo. security definer para ler vinculos sem recursão de RLS.
create function nivel_em(ig uuid, m text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select nivel_de(v, m) from vinculos v where v.igreja_id = ig and v.user_id = auth.uid()), 'nenhum')
$$;

create function pode(ig uuid, m text, n text default 'ver') returns boolean
language sql stable set search_path = public as $$
  select case when n = 'editar' then nivel_em(ig, m) = 'editar' else nivel_em(ig, m) in ('ver', 'editar') end
$$;

-- Mapa completo do usuário logado, para a tela montar o menu.
create function meus_acessos(ig uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(m, nivel_de(v, m)), '{}'::jsonb)
  from vinculos v, unnest(modulos()) m
  where v.igreja_id = ig and v.user_id = auth.uid()
$$;

-- O pastor grava os acessos de uma pessoa. Só chaves e níveis conhecidos.
create function definir_acessos(ig uuid, p_user uuid, p_acessos jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare k text; val text;
begin
  if not tem_papel(ig, array['pastor']::papel_t[]) then raise exception 'Só o pastor define acessos.'; end if;
  if jsonb_typeof(p_acessos) <> 'object' then raise exception 'Acessos inválidos.'; end if;
  for k, val in select * from jsonb_each_text(p_acessos) loop
    if not k = any(modulos()) then raise exception 'Módulo desconhecido: %', k; end if;
    if val not in ('nenhum', 'ver', 'editar') then raise exception 'Nível inválido: %', val; end if;
  end loop;
  update vinculos set acessos = p_acessos where igreja_id = ig and user_id = p_user and papel <> 'pastor';
  if not found then raise exception 'Pessoa da equipe não encontrada (o pastor já vê tudo).'; end if;
end $$;

-- Equipe com os acessos efetivos de cada um.
drop function equipe(uuid);
create function equipe(ig uuid) returns table (user_id uuid, email text, papel papel_t, pessoa_id uuid, desde timestamptz, acessos jsonb)
language sql stable security definer set search_path = public, auth as $$
  select v.user_id, u.email, v.papel, v.pessoa_id, v.criado_em,
         (select jsonb_object_agg(m, nivel_de(v, m)) from unnest(modulos()) m)
  from vinculos v join auth.users u on u.id = v.user_id
  where v.igreja_id = ig and tem_papel(ig, array['pastor']::papel_t[])
  order by v.papel, u.email
$$;

-- Ao trocar o perfil de alguém, os acessos voltam ao padrão do novo perfil.
create or replace function adicionar_acesso(ig uuid, p_email text, p_papel papel_t, p_pessoa uuid default null)
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_user uuid;
begin
  if not tem_papel(ig, array['pastor']::papel_t[]) then raise exception 'Só o pastor dá acesso à equipe.'; end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'Ninguém entrou ainda com o e-mail %. Peça para a pessoa abrir o app e pedir o link de acesso uma vez.', p_email;
  end if;
  if p_papel = 'membro' and p_pessoa is null then raise exception 'Para o perfil membro, escolha a ficha da pessoa.'; end if;
  insert into vinculos (igreja_id, user_id, papel, pessoa_id) values (ig, v_user, p_papel, p_pessoa)
  on conflict (igreja_id, user_id) do update set papel = excluded.papel, pessoa_id = excluded.pessoa_id,
    acessos = case when vinculos.papel = excluded.papel then vinculos.acessos else '{}'::jsonb end;
end $$;


-- ---------------------------------------------------------------- políticas por módulo
-- Financeiro: as funções de baixa, estorno e fechamento usam eh_fin, que agora segue o módulo.
create or replace function eh_fin(ig uuid) returns boolean
language sql stable set search_path = public as $$ select pode(ig, 'financeiro', 'editar') $$;

drop policy pes_ver on pessoas;
drop policy pes_criar on pessoas;
drop policy pes_editar on pessoas;
create policy pes_ver on pessoas for select using (pode(igreja_id, 'pessoas') or id = minha_pessoa(igreja_id));
create policy pes_criar on pessoas for insert with check (pode(igreja_id, 'pessoas', 'editar'));
create policy pes_editar on pessoas for update using (pode(igreja_id, 'pessoas', 'editar'));

drop policy past_pastor on pessoas_pastoral;
create policy past_ver on pessoas_pastoral for select using (pode(igreja_id, 'pastoral'));
create policy past_criar on pessoas_pastoral for insert with check (pode(igreja_id, 'pastoral', 'editar'));
create policy past_editar on pessoas_pastoral for update using (pode(igreja_id, 'pastoral', 'editar'));
create policy past_excluir on pessoas_pastoral for delete using (pode(igreja_id, 'pastoral', 'editar'));

drop policy comp_ver on compromissos;
create policy comp_ver on compromissos for select using (pode(igreja_id, 'financeiro') or pessoa_id = minha_pessoa(igreja_id));
drop policy contrib_ver on contribuicoes;
create policy contrib_ver on contribuicoes for select using (pode(igreja_id, 'financeiro') or pessoa_id = minha_pessoa(igreja_id));
drop policy lanc_ver on lancamentos;
create policy lanc_ver on lancamentos for select using (pode(igreja_id, 'financeiro'));
drop policy fech_ver on fechamentos;
create policy fech_ver on fechamentos for select using (pode(igreja_id, 'financeiro'));

drop policy aud_ver on auditoria;
create policy aud_ver on auditoria for select using (
  pode(igreja_id, 'auditoria')
  or (pode(igreja_id, 'financeiro') and tabela in ('lancamentos', 'contribuicoes', 'fechamentos', 'compromissos')));

drop policy ouv_ver on ouvidoria;
drop policy ouv_responder on ouvidoria;
create policy ouv_ver on ouvidoria for select using (pode(igreja_id, 'ouvidoria') or autor_user = auth.uid());
create policy ouv_responder on ouvidoria for update using (pode(igreja_id, 'ouvidoria', 'editar'));

drop policy camp_ver on campanhas;
drop policy camp_criar on campanhas;
drop policy camp_editar on campanhas;
create policy camp_ver on campanhas for select using (pode(igreja_id, 'missao'));
create policy camp_criar on campanhas for insert with check (pode(igreja_id, 'missao', 'editar'));
create policy camp_editar on campanhas for update using (pode(igreja_id, 'missao', 'editar'));

drop policy diag_ver on diagnosticos;
drop policy diag_criar on diagnosticos;
drop policy diag_editar on diagnosticos;
create policy diag_ver on diagnosticos for select using (pode(igreja_id, 'diagnostico'));
create policy diag_criar on diagnosticos for insert with check (pode(igreja_id, 'diagnostico', 'editar'));
create policy diag_editar on diagnosticos for update using (pode(igreja_id, 'diagnostico', 'editar'));

drop policy pdca_ver on pdca;
drop policy pdca_criar on pdca;
drop policy pdca_editar on pdca;
create policy pdca_ver on pdca for select using (pode(igreja_id, 'pdca'));
create policy pdca_criar on pdca for insert with check (pode(igreja_id, 'pdca', 'editar'));
create policy pdca_editar on pdca for update using (pode(igreja_id, 'pdca', 'editar'));

drop policy tar_ver on tarefas;
drop policy tar_criar on tarefas;
drop policy tar_editar on tarefas;
drop policy tar_excluir on tarefas;
create policy tar_ver on tarefas for select using (pode(igreja_id, 'kanban'));
create policy tar_criar on tarefas for insert with check (pode(igreja_id, 'kanban', 'editar'));
create policy tar_editar on tarefas for update using (pode(igreja_id, 'kanban', 'editar'));
create policy tar_excluir on tarefas for delete using (pode(igreja_id, 'kanban', 'editar'));

-- Consentimento LGPD: quem edita pessoas registra, e cada um registra o próprio.
create or replace function registrar_consentimento(p_pessoa uuid, p_whats boolean, p_email boolean, p_imagem boolean)
returns void language plpgsql security definer set search_path = public as $$
declare ig uuid;
begin
  select igreja_id into ig from pessoas where id = p_pessoa;
  if not (pode(ig, 'pessoas', 'editar') or p_pessoa = minha_pessoa(ig)) then
    raise exception 'Sem permissão para registrar este consentimento.';
  end if;
  update pessoas set lgpd_whats = p_whats, lgpd_email = p_email, lgpd_imagem = p_imagem,
    lgpd_data = current_date, lgpd_termo = termo_atual()
  where id = p_pessoa;
end $$;
