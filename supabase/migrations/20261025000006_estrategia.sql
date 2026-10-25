-- Rebanho: estratégia ministerial.
-- Diagnóstico (Análise MUDA + Matriz Diakonia), ciclos PDCA gerados pelos insights
-- e tarefas avulsas, que junto com as campanhas formam o kanban de execução.

-- ---------------------------------------------------------------- diagnósticos
-- muda: { multidao|discipulos|apostolos: { exp: [{t, imp, at}], dem: [...] } }
-- diak: { adoracao|comunhao|discipulado|ministerio|evangelismo: { <grupo>: { serve: {n, t}, servido: {n, t} } } }
create table diagnosticos (
  id           uuid primary key default gen_random_uuid(),
  igreja_id    uuid not null references igrejas(id) on delete cascade,
  titulo       text not null check (length(trim(titulo)) between 3 and 120),
  data         date not null default current_date,
  status       text not null default 'Em preenchimento' check (status in ('Em preenchimento', 'Concluído')),
  muda         jsonb not null default '{}'::jsonb check (jsonb_typeof(muda) = 'object'),
  diak         jsonb not null default '{}'::jsonb check (jsonb_typeof(diak) = 'object'),
  concluido_em date,
  criado_por   uuid default auth.uid(),
  criado_em    timestamptz not null default now()
);
create index on diagnosticos (igreja_id, data desc);
create trigger diagnosticos_igreja before update on diagnosticos for each row execute function travar_igreja();
create trigger auditar_diagnosticos after insert or update or delete on diagnosticos
  for each row execute function auditar();

alter table diagnosticos enable row level security;
create policy diag_ver on diagnosticos for select
  using (tem_papel(igreja_id, array['pastor','secretaria']::papel_t[]));
create policy diag_criar on diagnosticos for insert
  with check (tem_papel(igreja_id, array['pastor','secretaria']::papel_t[]));
create policy diag_editar on diagnosticos for update
  using (tem_papel(igreja_id, array['pastor','secretaria']::papel_t[]));
create policy diag_excluir on diagnosticos for delete
  using (tem_papel(igreja_id, array['pastor']::papel_t[]));

-- ---------------------------------------------------------------- ciclos PDCA
create table pdca (
  id             uuid primary key default gen_random_uuid(),
  igreja_id      uuid not null references igrejas(id) on delete cascade,
  titulo         text not null check (length(trim(titulo)) between 3 and 200),
  tipo           text not null check (tipo in ('ameaca', 'pratica')),
  chave          text not null,
  ref            text,
  diagnostico_id uuid references diagnosticos(id) on delete set null,
  area           text,
  origem         text,
  ciclo          integer not null default 1 check (ciclo >= 1),
  fase           text not null default 'P' check (fase in ('P', 'D', 'C', 'A', 'Concluído')),
  score          integer not null default 0,
  meta           text,
  hipotese       text,
  indicador      text,
  prazo          date,
  acoes          jsonb not null default '[]'::jsonb check (jsonb_typeof(acoes) = 'array'),
  responsavel    text,
  base           numeric,
  medido         numeric,
  obs_check      text,
  decisao        text check (decisao in ('Padronizar', 'Ajustar e re-testar', 'Abandonar')),
  obs_act        text,
  historico      jsonb not null default '[]'::jsonb check (jsonb_typeof(historico) = 'array'),
  feito_em       date,
  criado_em      timestamptz not null default now(),
  check ((fase = 'Concluído') = (decisao is not null))
);
create index on pdca (igreja_id, fase);
create unique index pdca_um_aberto on pdca (igreja_id, chave) where fase <> 'Concluído';
create trigger pdca_igreja before update on pdca for each row execute function travar_igreja();
create trigger auditar_pdca after insert or update or delete on pdca
  for each row execute function auditar();

create function conferir_diagnostico() returns trigger language plpgsql as $$
begin
  if new.diagnostico_id is not null and not exists
     (select 1 from diagnosticos where id = new.diagnostico_id and igreja_id = new.igreja_id) then
    raise exception 'O diagnóstico informado não pertence a esta igreja.';
  end if;
  return new;
end $$;
create trigger pdca_diagnostico before insert or update of diagnostico_id on pdca
  for each row execute function conferir_diagnostico();

alter table pdca enable row level security;
create policy pdca_ver on pdca for select
  using (tem_papel(igreja_id, array['pastor','secretaria','lider']::papel_t[]));
create policy pdca_criar on pdca for insert
  with check (tem_papel(igreja_id, array['pastor','secretaria']::papel_t[]));
create policy pdca_editar on pdca for update
  using (tem_papel(igreja_id, array['pastor','secretaria']::papel_t[]));
create policy pdca_excluir on pdca for delete
  using (tem_papel(igreja_id, array['pastor']::papel_t[]));

-- ---------------------------------------------------------------- tarefas avulsas
create table tarefas (
  id          uuid primary key default gen_random_uuid(),
  igreja_id   uuid not null references igrejas(id) on delete cascade,
  titulo      text not null check (length(trim(titulo)) between 3 and 160),
  origem      text not null default 'Geral' check (origem in ('Geral', 'Manutenção', 'Captação', 'PDCA')),
  responsavel text,
  prazo       date,
  prioridade  text not null default 'mod' check (prioridade in ('crit', 'alto', 'mod', 'baixo')),
  descricao   text,
  coluna      text not null default 'afazer' check (coluna in ('afazer', 'fazendo', 'verificar', 'feito')),
  feito_em    date,
  criado_por  uuid default auth.uid(),
  criado_em   timestamptz not null default now()
);
create index on tarefas (igreja_id, coluna);
create trigger tarefas_igreja before update on tarefas for each row execute function travar_igreja();
create trigger auditar_tarefas after insert or update or delete on tarefas
  for each row execute function auditar();

alter table tarefas enable row level security;
create policy tar_ver on tarefas for select
  using (tem_papel(igreja_id, array['pastor','secretaria','lider']::papel_t[]));
create policy tar_criar on tarefas for insert
  with check (tem_papel(igreja_id, array['pastor','secretaria','lider']::papel_t[]));
create policy tar_editar on tarefas for update
  using (tem_papel(igreja_id, array['pastor','secretaria','lider']::papel_t[]));
create policy tar_excluir on tarefas for delete
  using (tem_papel(igreja_id, array['pastor','secretaria']::papel_t[]));

-- ---------------------------------------------------------------- campanhas no kanban
-- A coluna "Verificar" do kanban corresponde a uma campanha em avaliação.
alter table campanhas drop constraint campanhas_status_check;
alter table campanhas add constraint campanhas_status_check
  check (status in ('Planejada', 'Em andamento', 'Em avaliação', 'Encerrada'));
