-- Rebanho: livro-caixa, contribuições, fechamento do mês e alçada.
-- Lançamento nunca é apagado nem reescrito: erro se corrige com estorno.

create type tipo_lanc_t as enum ('entrada', 'saida');
create type status_lanc_t as enum ('ok', 'pendente', 'rejeitada');
create type status_contrib_t as enum ('aberta', 'paga', 'cancelada');

-- Registros que apontam para uma pessoa precisam ser da mesma igreja.
create function conferir_igreja_pessoa() returns trigger language plpgsql as $$
begin
  if new.pessoa_id is not null and not exists
     (select 1 from pessoas where id = new.pessoa_id and igreja_id = new.igreja_id) then
    raise exception 'A pessoa informada não pertence a esta igreja.';
  end if;
  return new;
end $$;
create trigger pastoral_igreja before insert or update on pessoas_pastoral
  for each row execute function conferir_igreja_pessoa();
create trigger compromisso_igreja before insert or update on compromissos
  for each row execute function conferir_igreja_pessoa();

-- ---------------------------------------------------------------- fechamento
create table fechamentos (
  igreja_id   uuid not null references igrejas(id) on delete cascade,
  mes         char(7) not null check (mes ~ '^\d{4}-\d{2}$'),
  fechado_por uuid default auth.uid(),
  fechado_em  timestamptz not null default now(),
  primary key (igreja_id, mes)
);

create function mes_fechado(ig uuid, d date) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from fechamentos where igreja_id = ig and mes = to_char(d, 'YYYY-MM'))
$$;

-- ---------------------------------------------------------------- lançamentos
create table lancamentos (
  id               uuid primary key default gen_random_uuid(),
  igreja_id        uuid not null references igrejas(id) on delete cascade,
  tipo             tipo_lanc_t not null,
  valor            numeric(12,2) not null check (valor > 0),
  data             date not null,
  categoria        text not null,
  fundo            text not null default 'Geral',
  forma            text not null default 'Pix',
  descricao        text,
  pessoa_id        uuid references pessoas(id),
  status           status_lanc_t not null default 'ok',
  aprovado_por     uuid,
  aprovado_em      timestamptz,
  estorno_de       uuid references lancamentos(id),
  estornado_por    uuid references lancamentos(id),
  motivo_estorno   text,
  conciliado       boolean not null default false,
  comprovante_path text,
  criado_por       uuid default auth.uid(),
  criado_em        timestamptz not null default now()
);
create index on lancamentos (igreja_id, data);
create unique index lanc_um_estorno on lancamentos (estorno_de) where estorno_de is not null;

-- Lançamento que conta no caixa e nos relatórios.
create view lancamentos_validos with (security_invoker = true) as
  select * from lancamentos
  where status = 'ok' and estorno_de is null and estornado_por is null;

create function lanc_antes_inserir() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_alcada numeric; v_papel papel_t;
begin
  if mes_fechado(new.igreja_id, new.data) then
    raise exception 'O mês % está fechado. Use outra data ou peça ao pastor para reabrir.', to_char(new.data, 'MM/YYYY');
  end if;
  if not exists (select 1 from igrejas where id = new.igreja_id and new.fundo = any(fundos)) then
    raise exception 'Fundo "%" não existe nesta igreja.', new.fundo;
  end if;
  -- quem cria não escolhe o próprio status nem a aprovação
  new.criado_por := auth.uid();
  new.status := 'ok'; new.aprovado_por := null; new.aprovado_em := null;
  new.estornado_por := null;
  if new.tipo = 'saida' and new.estorno_de is null then
    select alcada into v_alcada from igrejas where id = new.igreja_id;
    v_papel := papel_em(new.igreja_id);
    if new.valor > v_alcada then
      if v_papel = 'pastor' then
        new.aprovado_por := auth.uid(); new.aprovado_em := now();
      else
        new.status := 'pendente';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger lanc_ins before insert on lancamentos for each row execute function lanc_antes_inserir();

-- Depois de criado, só mudam: conciliação, aprovação (pelo pastor) e a marca de estorno.
create function lanc_antes_alterar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.tipo, new.valor, new.data, new.categoria, new.fundo, new.forma, new.pessoa_id, new.estorno_de, new.igreja_id, new.criado_por, new.criado_em)
     is distinct from
     (old.tipo, old.valor, old.data, old.categoria, old.fundo, old.forma, old.pessoa_id, old.estorno_de, old.igreja_id, old.criado_por, old.criado_em) then
    raise exception 'Lançamento não pode ser alterado. Faça um estorno e lance de novo.';
  end if;
  if new.status is distinct from old.status then
    if old.status <> 'pendente' or not tem_papel(new.igreja_id, array['pastor']::papel_t[]) then
      raise exception 'Só o pastor aprova ou rejeita saídas pendentes.';
    end if;
    new.aprovado_por := auth.uid(); new.aprovado_em := now();
  elsif (new.aprovado_por, new.aprovado_em) is distinct from (old.aprovado_por, old.aprovado_em) then
    raise exception 'Aprovação só muda junto com o status.';
  end if;
  if old.estornado_por is not null and new.estornado_por is distinct from old.estornado_por then
    raise exception 'Lançamento já estornado.';
  end if;
  if new.estornado_por is distinct from old.estornado_por and current_setting('rebanho.estornando', true) is distinct from 'sim' then
    raise exception 'Use a função de estorno.';
  end if;
  return new;
end $$;
create trigger lanc_upd before update on lancamentos for each row execute function lanc_antes_alterar();
create trigger lanc_igreja before insert or update on lancamentos for each row execute function conferir_igreja_pessoa();

create function proibir_exclusao() returns trigger language plpgsql as $$
begin raise exception 'Registro financeiro não pode ser excluído. Use o estorno.'; end $$;
create trigger lanc_del before delete on lancamentos for each row execute function proibir_exclusao();

-- ---------------------------------------------------------------- contribuições
create table contribuicoes (
  id               uuid primary key default gen_random_uuid(),
  igreja_id        uuid not null references igrejas(id) on delete cascade,
  pessoa_id        uuid not null references pessoas(id),
  competencia      char(7) not null check (competencia ~ '^\d{4}-\d{2}$'),
  tipo             text not null default 'Dízimo',
  valor            numeric(12,2) not null check (valor > 0),
  vencimento       date not null,
  status           status_contrib_t not null default 'aberta',
  valor_pago       numeric(12,2),
  pago_em          date,
  forma            text,
  lancamento_id    uuid references lancamentos(id),
  recibo           text,
  recibo_cancelado text,
  criado_em        timestamptz not null default now(),
  unique (igreja_id, pessoa_id, competencia)
);
create trigger contrib_igreja before insert or update on contribuicoes
  for each row execute function conferir_igreja_pessoa();
create trigger contrib_del before delete on contribuicoes for each row execute function proibir_exclusao();

-- Numeração sem buracos por igreja e ano (REC-2026-0001).
create table contadores (
  igreja_id uuid not null references igrejas(id) on delete cascade,
  chave     text not null,
  valor     integer not null default 0,
  primary key (igreja_id, chave)
);

create function proximo_numero(ig uuid, p_chave text) returns integer
language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  insert into contadores (igreja_id, chave, valor) values (ig, p_chave, 1)
  on conflict (igreja_id, chave) do update set valor = contadores.valor + 1
  returning valor into v;
  return v;
end $$;
revoke execute on function proximo_numero(uuid, text) from public, anon, authenticated;

-- Baixa: registra o dinheiro no caixa e quita o mês num passo só.
create function dar_baixa(p_contrib uuid, p_valor numeric, p_data date, p_forma text default 'Pix', p_fundo text default 'Geral')
returns contribuicoes language plpgsql security definer set search_path = public as $$
declare c contribuicoes; p pessoas; v_lanc uuid; v_ano text := to_char(p_data, 'YYYY');
begin
  select * into c from contribuicoes where id = p_contrib for update;
  if not found then raise exception 'Contribuição não encontrada.'; end if;
  if not eh_fin(c.igreja_id) then raise exception 'Só pastor e tesouraria dão baixa.'; end if;
  if c.status <> 'aberta' then raise exception 'Esta contribuição não está em aberto.'; end if;
  select * into p from pessoas where id = c.pessoa_id;
  insert into lancamentos (igreja_id, tipo, valor, data, categoria, fundo, forma, descricao, pessoa_id)
  values (c.igreja_id, 'entrada', p_valor, p_data, case when c.tipo ilike '%zimo%' then 'Dízimo' else 'Oferta' end,
          p_fundo, p_forma, c.tipo || ' · ' || p.nome || ' · ' || c.competencia, c.pessoa_id)
  returning id into v_lanc;
  update contribuicoes set status = 'paga', valor_pago = p_valor, pago_em = p_data, forma = p_forma,
    lancamento_id = v_lanc,
    recibo = 'REC-' || v_ano || '-' || lpad(proximo_numero(c.igreja_id, 'recibo-' || v_ano)::text, 4, '0')
  where id = c.id returning * into c;
  return c;
end $$;

-- Estorno: cria o lançamento contrário e, se houver recibo, cancela e reabre o mês.
create function estornar(p_lanc uuid, p_motivo text) returns lancamentos
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
  update contribuicoes set status = 'aberta', valor_pago = null, pago_em = null, forma = null,
    lancamento_id = null, recibo_cancelado = recibo, recibo = null
  where lancamento_id = l.id;
  return e;
end $$;

create function fechar_mes(ig uuid, p_mes text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not eh_fin(ig) then raise exception 'Só pastor e tesouraria fecham o mês.'; end if;
  if p_mes >= to_char(current_date, 'YYYY-MM') then raise exception 'Só meses já encerrados podem ser fechados.'; end if;
  insert into fechamentos (igreja_id, mes) values (ig, p_mes) on conflict do nothing;
end $$;

-- ---------------------------------------------------------------- RLS
alter table fechamentos enable row level security;
alter table lancamentos enable row level security;
alter table contribuicoes enable row level security;
alter table contadores enable row level security;

create policy fech_ver on fechamentos for select using (eh_fin(igreja_id));
create policy fech_reabrir on fechamentos for delete using (tem_papel(igreja_id, array['pastor']::papel_t[]));
-- inserir só pela função fechar_mes

create policy lanc_ver on lancamentos for select using (eh_fin(igreja_id));
create policy lanc_criar on lancamentos for insert with check (eh_fin(igreja_id) and estorno_de is null);
create policy lanc_editar on lancamentos for update using (eh_fin(igreja_id));

create policy contrib_ver on contribuicoes for select
  using (eh_fin(igreja_id) or pessoa_id = minha_pessoa(igreja_id));
create policy contrib_criar on contribuicoes for insert with check (eh_fin(igreja_id) and status = 'aberta');
create policy contrib_editar on contribuicoes for update using (eh_fin(igreja_id) and status = 'aberta');
