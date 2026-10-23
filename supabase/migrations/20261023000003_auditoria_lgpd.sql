-- Rebanho: trilha de auditoria gravada pelo banco, LGPD e ouvidoria.

-- Contribuição só vira "paga" pela baixa, e só volta a "aberta" pelo estorno.
create function contrib_antes_alterar() returns trigger language plpgsql as $$
begin
  if (new.status = 'paga' or old.status = 'paga' or new.recibo is distinct from old.recibo
      or new.lancamento_id is distinct from old.lancamento_id)
     and current_setting('rebanho.baixa', true) is distinct from 'sim' then
    raise exception 'Use "dar baixa" para receber e o estorno para desfazer.';
  end if;
  if (new.pessoa_id, new.competencia, new.igreja_id) is distinct from (old.pessoa_id, old.competencia, old.igreja_id) then
    raise exception 'Pessoa e mês da contribuição não mudam.';
  end if;
  return new;
end $$;
create trigger contrib_upd before update on contribuicoes for each row execute function contrib_antes_alterar();

-- dar_baixa e estornar ganham a permissão de mexer na contribuição.
create or replace function dar_baixa(p_contrib uuid, p_valor numeric, p_data date, p_forma text default 'Pix', p_fundo text default 'Geral')
returns contribuicoes language plpgsql security definer set search_path = public as $$
declare c contribuicoes; p pessoas; v_lanc uuid; v_ano text := to_char(p_data, 'YYYY');
begin
  select * into c from contribuicoes where id = p_contrib for update;
  if not found then raise exception 'Contribuição não encontrada.'; end if;
  if not eh_fin(c.igreja_id) then raise exception 'Só pastor e tesouraria dão baixa.'; end if;
  if c.status <> 'aberta' then raise exception 'Esta contribuição não está em aberto.'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'Informe o valor recebido.'; end if;
  select * into p from pessoas where id = c.pessoa_id;
  insert into lancamentos (igreja_id, tipo, valor, data, categoria, fundo, forma, descricao, pessoa_id)
  values (c.igreja_id, 'entrada', p_valor, p_data, case when c.tipo ilike '%zimo%' then 'Dízimo' else 'Oferta' end,
          p_fundo, p_forma, c.tipo || ' · ' || p.nome || ' · ' || c.competencia, c.pessoa_id)
  returning id into v_lanc;
  perform set_config('rebanho.baixa', 'sim', true);
  update contribuicoes set status = 'paga', valor_pago = p_valor, pago_em = p_data, forma = p_forma,
    lancamento_id = v_lanc,
    recibo = 'REC-' || v_ano || '-' || lpad(proximo_numero(c.igreja_id, 'recibo-' || v_ano)::text, 4, '0')
  where id = c.id returning * into c;
  perform set_config('rebanho.baixa', '', true);
  return c;
end $$;

create or replace function estornar(p_lanc uuid, p_motivo text) returns lancamentos
language plpgsql security definer set search_path = public as $$
declare l lancamentos; e lancamentos;
begin
  select * into l from lancamentos where id = p_lanc for update;
  if not found then raise exception 'Lançamento não encontrado.'; end if;
  if not eh_fin(l.igreja_id) then raise exception 'Só pastor e tesouraria estornam.'; end if;
  if l.estorno_de is not null then raise exception 'Não se estorna um estorno.'; end if;
  if l.estornado_por is not null then raise exception 'Lançamento já estornado.'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Informe o motivo do estorno.'; end if;
  insert into lancamentos (igreja_id, tipo, valor, data, categoria, fundo, forma, descricao, pessoa_id, estorno_de)
  values (l.igreja_id, case l.tipo when 'entrada' then 'saida'::tipo_lanc_t else 'entrada'::tipo_lanc_t end,
          l.valor, current_date, 'Estorno', l.fundo, l.forma,
          'Estorno de "' || coalesce(l.descricao, l.categoria) || '": ' || p_motivo, l.pessoa_id, l.id)
  returning * into e;
  perform set_config('rebanho.estornando', 'sim', true);
  update lancamentos set estornado_por = e.id, motivo_estorno = p_motivo where id = l.id;
  perform set_config('rebanho.estornando', '', true);
  perform set_config('rebanho.baixa', 'sim', true);
  update contribuicoes set status = 'aberta', valor_pago = null, pago_em = null, forma = null,
    lancamento_id = null, recibo_cancelado = recibo, recibo = null
  where lancamento_id = l.id;
  perform set_config('rebanho.baixa', '', true);
  return e;
end $$;

-- ---------------------------------------------------------------- auditoria
create table auditoria (
  id          bigserial primary key,
  igreja_id   uuid not null,
  quando      timestamptz not null default now(),
  user_id     uuid,
  papel       papel_t,
  tabela      text not null,
  registro_id text not null,
  acao        text not null check (acao in ('criou', 'alterou', 'excluiu')),
  mudancas    jsonb not null default '{}'
);
create index on auditoria (igreja_id, quando desc);
create index on auditoria (igreja_id, registro_id);

-- Campos que nunca vão para a trilha em texto aberto.
create function campos_sigilosos() returns text[] language sql immutable as
$$ select array['observacao', 'evento_vida'] $$;

create function auditar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_ig uuid := (case when tg_table_name = 'igrejas' then v_row ->> 'id' else v_row ->> 'igreja_id' end)::uuid;
  v_mud jsonb := '{}';
  k text;
begin
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(v_new) loop
      continue when k in ('atualizado_em');
      if v_new -> k is distinct from v_old -> k then
        v_mud := v_mud || jsonb_build_object(k, case when k = any(campos_sigilosos())
          then jsonb_build_object('de', '(confidencial)', 'para', '(confidencial)')
          else jsonb_build_object('de', v_old -> k, 'para', v_new -> k) end);
      end if;
    end loop;
    if v_mud = '{}' then return null; end if;
  elsif tg_op = 'INSERT' then
    v_mud := v_new - campos_sigilosos();
  else
    v_mud := v_old - campos_sigilosos();
  end if;
  insert into auditoria (igreja_id, user_id, papel, tabela, registro_id, acao, mudancas)
  values (v_ig, auth.uid(), papel_em(v_ig), tg_table_name,
          coalesce(v_row ->> 'id', v_row ->> 'pessoa_id', v_row ->> 'mes', v_row ->> 'user_id'),
          case tg_op when 'INSERT' then 'criou' when 'UPDATE' then 'alterou' else 'excluiu' end, v_mud);
  return null;
end $$;

do $$ declare t text;
begin
  foreach t in array array['pessoas','pessoas_pastoral','compromissos','vinculos','lancamentos','contribuicoes','fechamentos','igrejas'] loop
    execute format('create trigger auditar_%1$s after insert or update or delete on %1$I for each row execute function auditar()', t);
  end loop;
end $$;

-- A trilha só se lê; ninguém grava nem apaga pela API.
alter table auditoria enable row level security;
create policy aud_ver on auditoria for select using (
  tem_papel(igreja_id, array['pastor']::papel_t[])
  or (tem_papel(igreja_id, array['tesouraria']::papel_t[])
      and tabela in ('lancamentos','contribuicoes','fechamentos','compromissos')));
revoke insert, update, delete on auditoria from anon, authenticated;

-- ---------------------------------------------------------------- LGPD
create function termo_atual() returns text language sql immutable as $$ select 'Termo v1 · out/2026' $$;

-- Grava o consentimento com a versão do termo vigente.
create function registrar_consentimento(p_pessoa uuid, p_whats boolean, p_email boolean, p_imagem boolean)
returns void language plpgsql security definer set search_path = public as $$
declare ig uuid;
begin
  select igreja_id into ig from pessoas where id = p_pessoa;
  if not (tem_papel(ig, array['pastor','secretaria','lider']::papel_t[]) or p_pessoa = minha_pessoa(ig)) then
    raise exception 'Sem permissão para registrar este consentimento.';
  end if;
  update pessoas set lgpd_whats = p_whats, lgpd_email = p_email, lgpd_imagem = p_imagem,
    lgpd_data = current_date, lgpd_termo = termo_atual()
  where id = p_pessoa;
end $$;

-- Pedido do titular (art. 18): tudo o que a igreja guarda sobre a pessoa.
create function exportar_dados(p_pessoa uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare ig uuid;
begin
  select igreja_id into ig from pessoas where id = p_pessoa;
  if not (tem_papel(ig, array['pastor','secretaria']::papel_t[]) or p_pessoa = minha_pessoa(ig)) then
    raise exception 'Sem permissão para exportar estes dados.';
  end if;
  return jsonb_build_object(
    'gerado_em', now(),
    'pessoa', (select to_jsonb(p) from pessoas p where id = p_pessoa),
    'compromisso', (select to_jsonb(c) from compromissos c where pessoa_id = p_pessoa),
    'contribuicoes', coalesce((select jsonb_agg(to_jsonb(c) order by competencia) from contribuicoes c where pessoa_id = p_pessoa), '[]'),
    'lancamentos', coalesce((select jsonb_agg(jsonb_build_object('data', data, 'valor', valor, 'categoria', categoria, 'forma', forma) order by data)
                             from lancamentos where pessoa_id = p_pessoa), '[]'));
end $$;

-- Pedido de exclusão: apaga os dados pessoais e mantém o histórico financeiro sem nome.
create function anonimizar(p_pessoa uuid) returns void
language plpgsql security definer set search_path = public as $$
declare ig uuid; v_nome text;
begin
  select igreja_id, nome into ig, v_nome from pessoas where id = p_pessoa;
  if not tem_papel(ig, array['pastor']::papel_t[]) then raise exception 'Só o pastor anonimiza cadastros.'; end if;
  delete from pessoas_pastoral where pessoa_id = p_pessoa;
  update pessoas set nome = 'Pessoa anonimizada ' || upper(left(p_pessoa::text, 4)),
    telefone = null, email = null, nascimento = null, endereco = null, bairro = null, familia = null,
    acompanhante = null, como_conheceu = null, lgpd_whats = false, lgpd_email = false, lgpd_imagem = false,
    anonimizado = true
  where id = p_pessoa;
  -- a trilha guardava os dados antigos: apaga o conteúdo e mantém só o fato
  update auditoria set mudancas = jsonb_build_object('anonimizado', true)
  where igreja_id = ig and registro_id = p_pessoa::text and tabela in ('pessoas', 'pessoas_pastoral');
  -- o nome também aparece na descrição dos lançamentos e na trilha deles
  update lancamentos set descricao = replace(descricao, v_nome, 'pessoa anonimizada')
  where pessoa_id = p_pessoa and descricao like '%' || v_nome || '%';
  update auditoria set mudancas = replace(mudancas::text, v_nome, 'pessoa anonimizada')::jsonb
  where igreja_id = ig and mudancas::text like '%' || v_nome || '%';
end $$;

-- ---------------------------------------------------------------- ouvidoria
create table ouvidoria (
  id          uuid primary key default gen_random_uuid(),
  igreja_id   uuid not null references igrejas(id) on delete cascade,
  protocolo   text not null,
  tipo        text not null check (tipo in ('Sugestão', 'Reclamação', 'Elogio', 'Pedido de cuidado')),
  assunto     text not null,
  texto       text not null,
  anonimo     boolean not null default false,
  autor_nome  text,
  autor_user  uuid default auth.uid(),
  status      text not null default 'Recebida' check (status in ('Recebida', 'Em análise', 'Respondida', 'Encerrada')),
  resposta    text,
  criado_em   timestamptz not null default now(),
  unique (igreja_id, protocolo)
);

create function ouv_antes_inserir() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_ano text := to_char(now(), 'YYYY');
begin
  new.protocolo := 'OUV-' || v_ano || '-' || lpad(proximo_numero(new.igreja_id, 'ouv-' || v_ano)::text, 4, '0');
  new.status := 'Recebida'; new.resposta := null; new.autor_user := auth.uid();
  -- anônimo de verdade: não guarda nome nem login de quem enviou
  if new.anonimo then new.autor_nome := null; new.autor_user := null; end if;
  return new;
end $$;
create trigger ouv_ins before insert on ouvidoria for each row execute function ouv_antes_inserir();

alter table ouvidoria enable row level security;
create policy ouv_criar on ouvidoria for insert with check (papel_em(igreja_id) is not null);
create policy ouv_ver on ouvidoria for select using (
  tem_papel(igreja_id, array['pastor']::papel_t[]) or autor_user = auth.uid());
create policy ouv_responder on ouvidoria for update using (tem_papel(igreja_id, array['pastor']::papel_t[]));

-- O login de um membro só pode ser ligado a uma ficha da mesma igreja.
create trigger vinculo_igreja before insert or update on vinculos
  for each row execute function conferir_igreja_pessoa();
