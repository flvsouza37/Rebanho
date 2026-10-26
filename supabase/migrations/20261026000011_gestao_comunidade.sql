-- Rebanho: gestão e comunidade.
-- Orçamento anual por categoria, cantina (produtos, caixa, vendas que viram entrada na tesouraria),
-- escalas de ministérios com confirmação e troca, e boas práticas compartilhadas pelos membros.

create or replace function modulos() returns text[] language sql immutable as $$
  select array['pessoas','pastoral','radar','missao','diagnostico','pdca','kanban','patrimonio','cargos','comunicacao','escalas','praticas','cantina','financeiro','auditoria','ouvidoria']
$$;

create or replace function acesso_padrao(p papel_t, m text) returns text language sql immutable as $$
  select case
    when p = 'pastor' then 'editar'
    when p = 'secretaria' and m in ('pessoas','radar','missao','diagnostico','pdca','kanban','patrimonio','cargos','comunicacao','escalas','praticas') then 'editar'
    when p = 'lider' and m in ('pessoas','radar','kanban','escalas') then 'editar'
    when p = 'lider' and m in ('missao','pdca','cargos','comunicacao','praticas') then 'ver'
    when p = 'tesouraria' and m in ('financeiro','cantina') then 'editar'
    when p = 'tesouraria' and m in ('pessoas','patrimonio','cargos') then 'ver'
    else 'nenhum'
  end
$$;

-- ---------------------------------------------------------------- orçamento
create table orcamentos (
  id         uuid primary key default gen_random_uuid(),
  igreja_id  uuid not null references igrejas(id) on delete cascade,
  ano        smallint not null check (ano between 2000 and 2100),
  categoria  text not null check (length(categoria) between 2 and 60),
  valor      numeric(12,2) not null check (valor >= 0),
  unique (igreja_id, ano, categoria)
);
create trigger auditar_orcamentos after insert or update or delete on orcamentos for each row execute function auditar();
alter table orcamentos enable row level security;
create policy orc_ver on orcamentos for select using (pode(igreja_id, 'financeiro'));
create policy orc_criar on orcamentos for insert with check (pode(igreja_id, 'financeiro', 'editar'));
create policy orc_editar on orcamentos for update using (pode(igreja_id, 'financeiro', 'editar'));
create policy orc_excluir on orcamentos for delete using (pode(igreja_id, 'financeiro', 'editar'));

-- ---------------------------------------------------------------- cantina
-- Igrejas novas já nascem com o fundo Cantina; as antigas podem criá-lo em Dados da igreja.
alter table igrejas alter column fundos set default array['Geral', 'Missões', 'Ação social', 'Cantina'];

create table produtos (
  id          uuid primary key default gen_random_uuid(),
  igreja_id   uuid not null references igrejas(id) on delete cascade,
  nome        text not null check (length(trim(nome)) between 2 and 80),
  categoria   text not null default 'Salgados' check (categoria in ('Salgados', 'Doces', 'Bebidas', 'Refeição', 'Outros')),
  preco       numeric(8,2) not null check (preco > 0),
  custo       numeric(8,2) not null default 0 check (custo >= 0),
  estoque     integer not null default 0 check (estoque >= 0),
  estoque_min integer not null default 5 check (estoque_min >= 0),
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);
create index on produtos (igreja_id);
create trigger produtos_igreja before update on produtos for each row execute function travar_igreja();

create table caixas (
  id            uuid primary key default gen_random_uuid(),
  igreja_id     uuid not null references igrejas(id) on delete cascade,
  data          date not null,
  troco         numeric(8,2) not null default 0 check (troco >= 0),
  evento_id     uuid references eventos(id) on delete set null,
  status        text not null default 'aberto' check (status in ('aberto', 'fechado')),
  total         numeric(12,2) not null default 0,
  por_forma     jsonb not null default '{}',
  lancamento_id uuid references lancamentos(id),
  aberto_por    uuid default auth.uid(),
  fechado_em    timestamptz,
  criado_em     timestamptz not null default now()
);
create unique index um_caixa_aberto on caixas (igreja_id) where status = 'aberto';
create trigger caixas_igreja before update on caixas for each row execute function travar_igreja();
create trigger auditar_caixas after insert or update on caixas for each row execute function auditar();

create table vendas (
  id         uuid primary key default gen_random_uuid(),
  igreja_id  uuid not null references igrejas(id) on delete cascade,
  caixa_id   uuid not null references caixas(id) on delete cascade,
  itens      jsonb not null,
  total      numeric(12,2) not null check (total > 0),
  custo      numeric(12,2) not null default 0,
  forma      text not null check (forma in ('Pix', 'Dinheiro', 'Cartão')),
  por        uuid default auth.uid(),
  criado_em  timestamptz not null default now()
);
create index on vendas (caixa_id);

alter table produtos enable row level security;
alter table caixas enable row level security;
alter table vendas enable row level security;
create policy prod_ver on produtos for select using (pode(igreja_id, 'cantina'));
create policy prod_criar on produtos for insert with check (pode(igreja_id, 'cantina', 'editar'));
create policy prod_editar on produtos for update using (pode(igreja_id, 'cantina', 'editar'));
create policy caixa_ver on caixas for select using (pode(igreja_id, 'cantina'));
create policy caixa_abrir on caixas for insert with check (pode(igreja_id, 'cantina', 'editar') and status = 'aberto' and total = 0 and lancamento_id is null);
create policy venda_ver on vendas for select using (pode(igreja_id, 'cantina'));
-- Vendas e fechamento só pelas funções abaixo: o preço vem do cadastro, não da tela.

create function vender(p_caixa uuid, p_itens jsonb, p_forma text) returns uuid
language plpgsql security definer set search_path = public as $$
declare cx caixas; it jsonb; pr produtos; q int; v_itens jsonb := '[]'; v_total numeric := 0; v_custo numeric := 0; v_id uuid;
begin
  select * into cx from caixas where id = p_caixa for update;
  if cx.id is null or not pode(cx.igreja_id, 'cantina', 'editar') then raise exception 'Caixa não encontrado.'; end if;
  if cx.status <> 'aberto' then raise exception 'O caixa já foi fechado.'; end if;
  if p_forma not in ('Pix', 'Dinheiro', 'Cartão') then raise exception 'Forma de pagamento inválida.'; end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then raise exception 'Pedido vazio.'; end if;
  for it in select * from jsonb_array_elements(p_itens) loop
    q := (it ->> 'qtd')::int;
    select * into pr from produtos where id = (it ->> 'id')::uuid and igreja_id = cx.igreja_id and ativo for update;
    if pr.id is null then raise exception 'Produto indisponível.'; end if;
    if q is null or q < 1 or q > 100 then raise exception 'Quantidade inválida.'; end if;
    if pr.estoque < q then raise exception 'Estoque insuficiente de %: restam %.', pr.nome, pr.estoque; end if;
    update produtos set estoque = estoque - q where id = pr.id;
    v_itens := v_itens || jsonb_build_object('id', pr.id, 'nome', pr.nome, 'qtd', q, 'preco', pr.preco, 'custo', pr.custo);
    v_total := v_total + q * pr.preco; v_custo := v_custo + q * pr.custo;
  end loop;
  insert into vendas (igreja_id, caixa_id, itens, total, custo, forma) values (cx.igreja_id, cx.id, v_itens, v_total, v_custo, p_forma) returning id into v_id;
  return v_id;
end $$;

-- Fecha o caixa e lança o resultado (menos o troco, que fica na gaveta) como entrada no fundo Cantina.
create function fechar_caixa(p_caixa uuid, p_data date) returns caixas
language plpgsql security definer set search_path = public as $$
declare cx caixas; v_total numeric; v_formas jsonb; v_fundo text; v_lanc uuid;
begin
  select * into cx from caixas where id = p_caixa for update;
  if cx.id is null or not pode(cx.igreja_id, 'cantina', 'editar') then raise exception 'Caixa não encontrado.'; end if;
  if cx.status <> 'aberto' then raise exception 'O caixa já foi fechado.'; end if;
  select coalesce(sum(total), 0) into v_total from vendas where caixa_id = cx.id;
  select coalesce(jsonb_object_agg(forma, s), '{}') into v_formas
    from (select forma, sum(total) s from vendas where caixa_id = cx.id group by forma) f;
  select case when 'Cantina' = any(fundos) then 'Cantina' else 'Geral' end into v_fundo from igrejas where id = cx.igreja_id;
  if v_total > 0 then
    insert into lancamentos (igreja_id, tipo, valor, data, categoria, fundo, forma, descricao)
    values (cx.igreja_id, 'entrada', v_total, p_data, 'Venda da cantina', v_fundo, 'Vários',
            'Caixa da cantina de ' || to_char(cx.data, 'DD/MM/YYYY') || ' · ' || (select count(*) from vendas where caixa_id = cx.id) || ' venda(s)')
    returning id into v_lanc;
  end if;
  update caixas set status = 'fechado', total = v_total, por_forma = v_formas, lancamento_id = v_lanc, fechado_em = now()
  where id = cx.id returning * into cx;
  return cx;
end $$;
revoke execute on function vender(uuid, jsonb, text) from public, anon;
revoke execute on function fechar_caixa(uuid, date) from public, anon;
grant execute on function vender(uuid, jsonb, text) to authenticated;
grant execute on function fechar_caixa(uuid, date) to authenticated;

-- ---------------------------------------------------------------- escalas
create table escalas (
  id         uuid primary key default gen_random_uuid(),
  igreja_id  uuid not null references igrejas(id) on delete cascade,
  data       date not null,
  ministerio text not null check (length(ministerio) between 2 and 60),
  pessoa_id  uuid not null references pessoas(id) on delete cascade,
  status     text not null default 'pendente' check (status in ('pendente', 'confirmado', 'troca')),
  criado_em  timestamptz not null default now(),
  unique (data, ministerio, pessoa_id)
);
create index on escalas (igreja_id, data);
create trigger escalas_pessoa before insert or update on escalas for each row execute function conferir_igreja_pessoa();
create trigger escalas_igreja before update on escalas for each row execute function travar_igreja();
alter table escalas enable row level security;
create policy esc_ver on escalas for select using (pode(igreja_id, 'escalas') or pessoa_id = minha_pessoa(igreja_id));
create policy esc_criar on escalas for insert with check (pode(igreja_id, 'escalas', 'editar'));
create policy esc_editar on escalas for update using (pode(igreja_id, 'escalas', 'editar'));
create policy esc_excluir on escalas for delete using (pode(igreja_id, 'escalas', 'editar'));

-- O próprio membro confirma ou pede troca da escala dele.
create function responder_escala(p_escala uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare e escalas;
begin
  select * into e from escalas where id = p_escala;
  if e.id is null or (e.pessoa_id is distinct from minha_pessoa(e.igreja_id) and not pode(e.igreja_id, 'escalas', 'editar')) then
    raise exception 'Escala não encontrada.';
  end if;
  if p_status not in ('confirmado', 'troca') then raise exception 'Resposta inválida.'; end if;
  update escalas set status = p_status where id = e.id;
end $$;

-- ---------------------------------------------------------------- boas práticas
create table praticas (
  id          uuid primary key default gen_random_uuid(),
  igreja_id   uuid not null references igrejas(id) on delete cascade,
  titulo      text not null check (length(trim(titulo)) between 3 and 120),
  texto       text not null check (length(trim(texto)) between 10 and 2000),
  categoria   text not null check (categoria in ('Família', 'Ministério', 'Vida devocional', 'Comunidade')),
  autor_nome  text not null check (length(trim(autor_nome)) between 2 and 120),
  autor_user  uuid default auth.uid(),
  aprovado    boolean not null default false,
  aprovado_por uuid,
  criado_em   timestamptz not null default now()
);
create index on praticas (igreja_id, aprovado);
create trigger praticas_igreja before update on praticas for each row execute function travar_igreja();

create function pratica_antes() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.autor_user := auth.uid();
    if not pode(new.igreja_id, 'praticas', 'editar') then new.aprovado := false; end if;
  end if;
  if new.aprovado and (tg_op = 'INSERT' or not old.aprovado) then new.aprovado_por := auth.uid(); end if;
  return new;
end $$;
create trigger praticas_antes before insert or update on praticas for each row execute function pratica_antes();

create table amens (
  pratica_id uuid not null references praticas(id) on delete cascade,
  user_id    uuid not null default auth.uid(),
  primary key (pratica_id, user_id)
);
alter table praticas enable row level security;
alter table amens enable row level security;
create policy prat_ver on praticas for select using ((aprovado and papel_em(igreja_id) is not null) or pode(igreja_id, 'praticas') or autor_user = auth.uid());
create policy prat_criar on praticas for insert with check (papel_em(igreja_id) is not null);
create policy prat_aprovar on praticas for update using (pode(igreja_id, 'praticas', 'editar'));
create policy prat_excluir on praticas for delete using (pode(igreja_id, 'praticas', 'editar') or (autor_user = auth.uid() and not aprovado));
create policy amem_ver on amens for select using (exists (select 1 from praticas p where p.id = pratica_id));
create policy amem_dar on amens for insert with check (user_id = auth.uid() and exists (select 1 from praticas p where p.id = pratica_id and p.aprovado));
create policy amem_tirar on amens for delete using (user_id = auth.uid());
