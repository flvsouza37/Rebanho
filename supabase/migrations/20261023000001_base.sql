-- Rebanho: base multi-igreja, perfis e pessoas.
-- Regra de ouro: toda permissão é decidida aqui no banco (RLS e funções),
-- nunca só na tela. A interface apenas esconde o que o banco já nega.

create extension if not exists pgcrypto;

create type papel_t as enum ('pastor', 'tesouraria', 'secretaria', 'lider', 'membro');
create type status_pessoa_t as enum ('visitante', 'congregado', 'membro', 'afastado', 'transferido');

-- ---------------------------------------------------------------- igrejas
create table igrejas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null check (length(trim(nome)) between 2 and 120),
  cnpj        text,
  cidade      text,
  uf          char(2),
  pix_chave   text,
  pix_nome    text,
  pix_cidade  text,
  fundos      text[] not null default array['Geral', 'Missões', 'Ação social'],
  alcada      numeric(12,2) not null default 2000 check (alcada >= 0),
  criado_em   timestamptz not null default now()
);

-- Quem tem acesso a qual igreja, com qual perfil.
-- pessoa_id liga o login de um membro à própria ficha (área do membro).
create table vinculos (
  igreja_id  uuid not null references igrejas(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  papel      papel_t not null,
  pessoa_id  uuid,
  criado_em  timestamptz not null default now(),
  primary key (igreja_id, user_id)
);
create index on vinculos (user_id);

-- Papel do usuário logado numa igreja. security definer para poder ser
-- usado dentro das políticas sem recursão de RLS em vinculos.
create function papel_em(ig uuid) returns papel_t
language sql stable security definer set search_path = public as $$
  select papel from vinculos where igreja_id = ig and user_id = auth.uid()
$$;

create function tem_papel(ig uuid, papeis papel_t[]) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(papel_em(ig) = any(papeis), false)
$$;

create function eh_fin(ig uuid) returns boolean
language sql stable as $$ select tem_papel(ig, array['pastor','tesouraria']::papel_t[]) $$;

create function minha_pessoa(ig uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select pessoa_id from vinculos where igreja_id = ig and user_id = auth.uid()
$$;

-- Cria a igreja e torna quem criou o pastor dela.
create function criar_igreja(p_nome text, p_cidade text default null, p_uf text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'É preciso estar logado.'; end if;
  insert into igrejas (nome, cidade, uf) values (p_nome, p_cidade, upper(p_uf)) returning id into v_id;
  insert into vinculos (igreja_id, user_id, papel) values (v_id, auth.uid(), 'pastor');
  return v_id;
end $$;

-- ---------------------------------------------------------------- pessoas
create table pessoas (
  id               uuid primary key default gen_random_uuid(),
  igreja_id        uuid not null references igrejas(id) on delete cascade,
  nome             text not null check (length(trim(nome)) between 2 and 120),
  status           status_pessoa_t not null default 'visitante',
  telefone         text,
  email            text,
  nascimento       date,
  endereco         text,
  bairro           text,
  cidade           text,
  familia          text,
  grupo            text,
  ministerios      text[] not null default '{}',
  lider            boolean not null default false,
  etapa            text,
  como_conheceu    text,
  acompanhante     text,
  primeira_visita  date,
  ultimo_contato   date,
  batismo          date,
  membro_desde     date,
  congregado_em    date,
  lgpd_whats       boolean not null default false,
  lgpd_email       boolean not null default false,
  lgpd_imagem      boolean not null default false,
  lgpd_data        date,
  lgpd_termo       text,
  anonimizado      boolean not null default false,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);
create index on pessoas (igreja_id, status);
create index on pessoas (igreja_id, lower(nome));

alter table vinculos add constraint vinculos_pessoa_fk
  foreign key (pessoa_id) references pessoas(id) on delete set null;

-- Dados que só o pastor vê ficam em tabela própria: RLS é por linha,
-- então separar a coluna é o jeito seguro de esconder um campo.
create table pessoas_pastoral (
  pessoa_id   uuid primary key references pessoas(id) on delete cascade,
  igreja_id   uuid not null references igrejas(id) on delete cascade,
  observacao  text,
  evento_vida text,
  atualizado_em timestamptz not null default now()
);

-- Compromisso de contribuição: só pastor e tesouraria (e a própria pessoa).
create table compromissos (
  pessoa_id  uuid primary key references pessoas(id) on delete cascade,
  igreja_id  uuid not null references igrejas(id) on delete cascade,
  tipo       text not null default 'Dízimo',
  valor      numeric(12,2) not null check (valor > 0),
  dia        smallint not null default 10 check (dia between 1 and 28),
  forma      text not null default 'Pix',
  carne      boolean not null default true,
  lembrete   boolean not null default false
);

create function tocar_atualizado() returns trigger language plpgsql as $$
begin new.atualizado_em := now(); return new; end $$;
create trigger pessoas_atualizado before update on pessoas
  for each row execute function tocar_atualizado();

-- Uma pessoa não troca de igreja por update.
create function travar_igreja() returns trigger language plpgsql as $$
begin
  if new.igreja_id <> old.igreja_id then raise exception 'Não é permitido mudar a igreja do registro.'; end if;
  return new;
end $$;
create trigger pessoas_igreja before update on pessoas for each row execute function travar_igreja();

-- ---------------------------------------------------------------- RLS
alter table igrejas enable row level security;
alter table vinculos enable row level security;
alter table pessoas enable row level security;
alter table pessoas_pastoral enable row level security;
alter table compromissos enable row level security;

create policy igreja_ver on igrejas for select using (papel_em(id) is not null);
create policy igreja_editar on igrejas for update using (tem_papel(id, array['pastor']::papel_t[]));

create policy vinc_ver on vinculos for select
  using (user_id = auth.uid() or tem_papel(igreja_id, array['pastor']::papel_t[]));
create policy vinc_pastor_ins on vinculos for insert with check (tem_papel(igreja_id, array['pastor']::papel_t[]));
create policy vinc_pastor_upd on vinculos for update using (tem_papel(igreja_id, array['pastor']::papel_t[]));
create policy vinc_pastor_del on vinculos for delete
  using (tem_papel(igreja_id, array['pastor']::papel_t[]) and user_id <> auth.uid());

create policy pes_ver on pessoas for select using (
  tem_papel(igreja_id, array['pastor','tesouraria','secretaria','lider']::papel_t[])
  or id = minha_pessoa(igreja_id));
create policy pes_criar on pessoas for insert
  with check (tem_papel(igreja_id, array['pastor','secretaria','lider']::papel_t[]));
create policy pes_editar on pessoas for update
  using (tem_papel(igreja_id, array['pastor','secretaria','lider']::papel_t[]));
-- Sem política de delete: pessoa não se apaga, se anonimiza (LGPD).

create policy past_pastor on pessoas_pastoral for all
  using (tem_papel(igreja_id, array['pastor']::papel_t[]))
  with check (tem_papel(igreja_id, array['pastor']::papel_t[]));

create policy comp_ver on compromissos for select using (eh_fin(igreja_id) or pessoa_id = minha_pessoa(igreja_id));
create policy comp_ins on compromissos for insert with check (eh_fin(igreja_id));
create policy comp_upd on compromissos for update using (eh_fin(igreja_id));
create policy comp_del on compromissos for delete using (eh_fin(igreja_id));
