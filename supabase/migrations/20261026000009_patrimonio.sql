-- Rebanho: patrimônio e governança.
-- Matriz de cargos (quem responde por cada área), ameaças prediais com GUT,
-- planos de ação 5W2H gerados a partir delas e manutenção preventiva.

create or replace function modulos() returns text[] language sql immutable as $$
  select array['pessoas','pastoral','radar','missao','diagnostico','pdca','kanban','patrimonio','cargos','financeiro','auditoria','ouvidoria']
$$;

create or replace function acesso_padrao(p papel_t, m text) returns text language sql immutable as $$
  select case
    when p = 'pastor' then 'editar'
    when p = 'secretaria' and m in ('pessoas','radar','missao','diagnostico','pdca','kanban','patrimonio','cargos') then 'editar'
    when p = 'lider' and m in ('pessoas','radar','kanban') then 'editar'
    when p = 'lider' and m in ('missao','pdca','cargos') then 'ver'
    when p = 'tesouraria' and m = 'financeiro' then 'editar'
    when p = 'tesouraria' and m in ('pessoas','patrimonio','cargos') then 'ver'
    else 'nenhum'
  end
$$;

-- ---------------------------------------------------------------- cargos
create table cargos (
  id         uuid primary key default gen_random_uuid(),
  igreja_id  uuid not null references igrejas(id) on delete cascade,
  titulo     text not null check (length(trim(titulo)) between 2 and 80),
  nome       text not null check (length(trim(nome)) between 2 and 120),
  pessoa_id  uuid references pessoas(id) on delete set null,
  areas      text[] not null default '{}',
  criado_em  timestamptz not null default now()
);
create index on cargos (igreja_id);
create trigger cargos_pessoa before insert or update on cargos for each row execute function conferir_igreja_pessoa();
create trigger cargos_igreja before update on cargos for each row execute function travar_igreja();
create trigger auditar_cargos after insert or update or delete on cargos for each row execute function auditar();

alter table cargos enable row level security;
create policy cargo_ver on cargos for select using (pode(igreja_id, 'cargos') or pode(igreja_id, 'patrimonio'));
create policy cargo_criar on cargos for insert with check (pode(igreja_id, 'cargos', 'editar'));
create policy cargo_editar on cargos for update using (pode(igreja_id, 'cargos', 'editar'));
create policy cargo_excluir on cargos for delete using (pode(igreja_id, 'cargos', 'editar'));

-- Registros que apontam para um cargo precisam ser da mesma igreja.
create function conferir_cargos() returns trigger language plpgsql as $$
begin
  if (new.quem is not null and not exists (select 1 from cargos where id = new.quem and igreja_id = new.igreja_id))
     or (new.aprova is not null and not exists (select 1 from cargos where id = new.aprova and igreja_id = new.igreja_id)) then
    raise exception 'O cargo informado não pertence a esta igreja.';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- planos 5W2H
create table planos (
  id          uuid primary key default gen_random_uuid(),
  igreja_id   uuid not null references igrejas(id) on delete cascade,
  oque        text not null check (length(trim(oque)) between 3 and 300),
  porque      text,
  onde        text,
  quando      date,
  quem        uuid references cargos(id) on delete set null,
  aprova      uuid references cargos(id) on delete set null,
  como        text,
  quanto      numeric(12,2) not null default 0 check (quanto >= 0),
  grau        text not null default 'mod' check (grau in ('crit', 'alto', 'mod', 'baixo')),
  score       integer not null default 0,
  status      text not null default 'Planejado' check (status in ('Planejado', 'Em execução', 'Em verificação', 'Concluído')),
  feito_em    date,
  criado_em   timestamptz not null default now()
);
create index on planos (igreja_id, status);
create trigger planos_cargos before insert or update on planos for each row execute function conferir_cargos();
create trigger planos_igreja before update on planos for each row execute function travar_igreja();
create trigger auditar_planos after insert or update or delete on planos for each row execute function auditar();

-- ---------------------------------------------------------------- ameaças prediais
create table ameacas (
  id         uuid primary key default gen_random_uuid(),
  igreja_id  uuid not null references igrejas(id) on delete cascade,
  titulo     text not null check (length(trim(titulo)) between 3 and 160),
  descricao  text check (length(descricao) <= 1000),
  ambiente   text not null,
  disciplina text not null,
  g          smallint not null check (g between 1 and 5),
  u          smallint not null check (u between 1 and 5),
  t          smallint not null check (t between 1 and 5),
  custo      numeric(12,2) not null default 0 check (custo >= 0),
  origem     text,
  data       date not null default current_date,
  status     text not null default 'aberta' check (status in ('aberta', 'em plano', 'resolvida')),
  plano_id   uuid references planos(id) on delete set null,
  criado_por uuid default auth.uid(),
  criado_em  timestamptz not null default now()
);
create index on ameacas (igreja_id, status);
create trigger ameacas_igreja before update on ameacas for each row execute function travar_igreja();
create trigger auditar_ameacas after insert or update or delete on ameacas for each row execute function auditar();

create function conferir_plano() returns trigger language plpgsql as $$
begin
  if new.plano_id is not null and not exists (select 1 from planos where id = new.plano_id and igreja_id = new.igreja_id) then
    raise exception 'O plano informado não pertence a esta igreja.';
  end if;
  return new;
end $$;
create trigger ameacas_plano before insert or update of plano_id on ameacas for each row execute function conferir_plano();

-- Plano concluído resolve as ameaças dele; plano reaberto as devolve para "em plano".
-- Plano excluído devolve as ameaças para a fila.
create function plano_status() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    update ameacas set status = 'aberta' where plano_id = old.id and status <> 'resolvida';
    return old;
  end if;
  if new.status = 'Concluído' and old.status <> 'Concluído' then
    new.feito_em := coalesce(new.feito_em, current_date);
    update ameacas set status = 'resolvida' where plano_id = new.id;
  elsif new.status <> 'Concluído' and old.status = 'Concluído' then
    new.feito_em := null;
    update ameacas set status = 'em plano' where plano_id = new.id;
  end if;
  return new;
end $$;
create trigger planos_status before update of status on planos for each row execute function plano_status();
create trigger planos_excluir before delete on planos for each row execute function plano_status();

-- ---------------------------------------------------------------- preventivas
create table preventivas (
  id         uuid primary key default gen_random_uuid(),
  igreja_id  uuid not null references igrejas(id) on delete cascade,
  item       text not null check (length(trim(item)) between 3 and 120),
  norma      text,
  ambiente   text not null,
  disciplina text not null,
  meses      smallint not null check (meses between 1 and 120),
  ultima     date not null,
  criado_em  timestamptz not null default now()
);
create index on preventivas (igreja_id);
create trigger preventivas_igreja before update on preventivas for each row execute function travar_igreja();
create trigger auditar_preventivas after insert or update or delete on preventivas for each row execute function auditar();

alter table planos enable row level security;
alter table ameacas enable row level security;
alter table preventivas enable row level security;
create policy plano_ver on planos for select using (pode(igreja_id, 'patrimonio'));
create policy plano_criar on planos for insert with check (pode(igreja_id, 'patrimonio', 'editar'));
create policy plano_editar on planos for update using (pode(igreja_id, 'patrimonio', 'editar'));
create policy plano_excluir on planos for delete using (tem_papel(igreja_id, array['pastor']::papel_t[]));
create policy ameaca_ver on ameacas for select using (pode(igreja_id, 'patrimonio'));
create policy ameaca_criar on ameacas for insert with check (pode(igreja_id, 'patrimonio', 'editar'));
create policy ameaca_editar on ameacas for update using (pode(igreja_id, 'patrimonio', 'editar'));
create policy ameaca_excluir on ameacas for delete using (tem_papel(igreja_id, array['pastor']::papel_t[]));
create policy prev_ver on preventivas for select using (pode(igreja_id, 'patrimonio'));
create policy prev_criar on preventivas for insert with check (pode(igreja_id, 'patrimonio', 'editar'));
create policy prev_editar on preventivas for update using (pode(igreja_id, 'patrimonio', 'editar'));
create policy prev_excluir on preventivas for delete using (pode(igreja_id, 'patrimonio', 'editar'));
