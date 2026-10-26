-- Rebanho: radar pastoral.
-- Presença nos cultos e células (chamada) e os contatos de cuidado. O radar cruza os dois
-- com os acontecimentos de vida para mostrar quem pode estar se afastando.

create or replace function modulos() returns text[] language sql immutable as $$
  select array['pessoas','pastoral','radar','missao','diagnostico','pdca','kanban','financeiro','auditoria','ouvidoria']
$$;

create or replace function acesso_padrao(p papel_t, m text) returns text language sql immutable as $$
  select case
    when p = 'pastor' then 'editar'
    when p = 'secretaria' and m in ('pessoas','radar','missao','diagnostico','pdca','kanban') then 'editar'
    when p = 'lider' and m in ('pessoas','radar','kanban') then 'editar'
    when p = 'lider' and m in ('missao','pdca') then 'ver'
    when p = 'tesouraria' and m = 'financeiro' then 'editar'
    when p = 'tesouraria' and m = 'pessoas' then 'ver'
    else 'nenhum'
  end
$$;

-- ---------------------------------------------------------------- presença
create table presencas (
  id         uuid primary key default gen_random_uuid(),
  igreja_id  uuid not null references igrejas(id) on delete cascade,
  pessoa_id  uuid not null references pessoas(id) on delete cascade,
  data       date not null,
  tipo       text not null default 'culto' check (tipo in ('culto', 'celula')),
  criado_por uuid default auth.uid(),
  criado_em  timestamptz not null default now(),
  unique (pessoa_id, data, tipo)
);
create index on presencas (igreja_id, data desc);
create trigger presencas_pessoa before insert or update on presencas for each row execute function conferir_igreja_pessoa();
create trigger presencas_igreja before update on presencas for each row execute function travar_igreja();

alter table presencas enable row level security;
create policy pres_ver on presencas for select using (pode(igreja_id, 'radar'));
create policy pres_criar on presencas for insert with check (pode(igreja_id, 'radar', 'editar'));
create policy pres_excluir on presencas for delete using (pode(igreja_id, 'radar', 'editar'));

-- ---------------------------------------------------------------- contatos de cuidado
create table cuidados (
  id         uuid primary key default gen_random_uuid(),
  igreja_id  uuid not null references igrejas(id) on delete cascade,
  pessoa_id  uuid not null references pessoas(id) on delete cascade,
  data       date not null default current_date,
  forma      text not null check (forma in ('Ligação', 'Mensagem', 'Visita', 'Encontro')),
  nota       text check (length(nota) <= 300),
  por        uuid default auth.uid(),
  criado_em  timestamptz not null default now()
);
create index on cuidados (igreja_id, data desc);
create trigger cuidados_pessoa before insert or update on cuidados for each row execute function conferir_igreja_pessoa();
create trigger cuidados_igreja before update on cuidados for each row execute function travar_igreja();
create trigger auditar_cuidados after insert or update or delete on cuidados for each row execute function auditar();

alter table cuidados enable row level security;
create policy cuid_ver on cuidados for select using (pode(igreja_id, 'radar'));
create policy cuid_criar on cuidados for insert with check (pode(igreja_id, 'radar', 'editar'));
create policy cuid_excluir on cuidados for delete using (pode(igreja_id, 'radar', 'editar') and por = auth.uid());
