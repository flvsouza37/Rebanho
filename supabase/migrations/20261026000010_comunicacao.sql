-- Rebanho: comunicação.
-- Mural de avisos, agenda de eventos, Palavra do Pastor / blog / vlog, histórico da mensageria
-- e o site público da igreja (só leitura, sem login, apenas o que foi marcado para o site).

create or replace function modulos() returns text[] language sql immutable as $$
  select array['pessoas','pastoral','radar','missao','diagnostico','pdca','kanban','patrimonio','cargos','comunicacao','financeiro','auditoria','ouvidoria']
$$;

create or replace function acesso_padrao(p papel_t, m text) returns text language sql immutable as $$
  select case
    when p = 'pastor' then 'editar'
    when p = 'secretaria' and m in ('pessoas','radar','missao','diagnostico','pdca','kanban','patrimonio','cargos','comunicacao') then 'editar'
    when p = 'lider' and m in ('pessoas','radar','kanban') then 'editar'
    when p = 'lider' and m in ('missao','pdca','cargos','comunicacao') then 'ver'
    when p = 'tesouraria' and m = 'financeiro' then 'editar'
    when p = 'tesouraria' and m in ('pessoas','patrimonio','cargos') then 'ver'
    else 'nenhum'
  end
$$;

-- ---------------------------------------------------------------- site da igreja
alter table igrejas
  add column slug text unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 60),
  add column site_publico boolean not null default false,
  add column site_texto text check (length(site_texto) <= 300);

-- ---------------------------------------------------------------- avisos
create table avisos (
  id         uuid primary key default gen_random_uuid(),
  igreja_id  uuid not null references igrejas(id) on delete cascade,
  titulo     text not null check (length(trim(titulo)) between 3 and 120),
  corpo      text not null check (length(trim(corpo)) between 3 and 2000),
  categoria  text not null default 'Geral' check (categoria in ('Geral', 'Urgente', 'Evento', 'Cuidado')),
  publico    text not null default 'Toda a igreja' check (length(publico) <= 80),
  validade   date,
  fixado     boolean not null default false,
  no_site    boolean not null default false,
  criado_por uuid default auth.uid(),
  criado_em  timestamptz not null default now()
);
create index on avisos (igreja_id, validade);
create trigger avisos_igreja before update on avisos for each row execute function travar_igreja();
create trigger auditar_avisos after insert or update or delete on avisos for each row execute function auditar();

-- ---------------------------------------------------------------- eventos
create table eventos (
  id         uuid primary key default gen_random_uuid(),
  igreja_id  uuid not null references igrejas(id) on delete cascade,
  titulo     text not null check (length(trim(titulo)) between 3 and 120),
  data       date not null,
  hora       time,
  ambiente   text,
  local      text check (length(local) <= 120),
  descricao  text check (length(descricao) <= 2000),
  videos     text[] not null default '{}' check (array_length(videos, 1) is null or array_length(videos, 1) <= 6),
  no_site    boolean not null default true,
  criado_em  timestamptz not null default now()
);
create index on eventos (igreja_id, data);
create trigger eventos_igreja before update on eventos for each row execute function travar_igreja();
create trigger auditar_eventos after insert or update or delete on eventos for each row execute function auditar();

-- ---------------------------------------------------------------- Palavra do Pastor, blog e vlog
create table posts (
  id         uuid primary key default gen_random_uuid(),
  igreja_id  uuid not null references igrejas(id) on delete cascade,
  tipo       text not null check (tipo in ('palavra', 'blog', 'vlog')),
  titulo     text not null check (length(trim(titulo)) between 3 and 160),
  resumo     text not null check (length(trim(resumo)) between 3 and 600),
  corpo      text check (length(corpo) <= 20000),
  video      text check (video ~ '^https://'),
  autor      text not null check (length(trim(autor)) between 2 and 120),
  data       date not null,
  no_site    boolean not null default true,
  criado_em  timestamptz not null default now()
);
create index on posts (igreja_id, data desc);
create trigger posts_igreja before update on posts for each row execute function travar_igreja();
create trigger auditar_posts after insert or update or delete on posts for each row execute function auditar();

-- ---------------------------------------------------------------- mensageria (histórico)
create table mensagens (
  id         uuid primary key default gen_random_uuid(),
  igreja_id  uuid not null references igrejas(id) on delete cascade,
  titulo     text check (length(titulo) <= 120),
  texto      text not null check (length(trim(texto)) between 3 and 2000),
  publico    text not null check (length(publico) <= 80),
  canais     text[] not null check (canais <@ array['whatsapp', 'email', 'redes'] and array_length(canais, 1) > 0),
  alcance    integer not null default 0,
  criado_por uuid default auth.uid(),
  criado_em  timestamptz not null default now()
);
create index on mensagens (igreja_id, criado_em desc);
create trigger mensagens_igreja before update on mensagens for each row execute function travar_igreja();

-- Avisos, eventos e publicações são lidos por toda a igreja (inclusive membros na área do membro).
alter table avisos enable row level security;
alter table eventos enable row level security;
alter table posts enable row level security;
alter table mensagens enable row level security;
create policy aviso_ver on avisos for select using (papel_em(igreja_id) is not null);
create policy aviso_criar on avisos for insert with check (pode(igreja_id, 'comunicacao', 'editar'));
create policy aviso_editar on avisos for update using (pode(igreja_id, 'comunicacao', 'editar'));
create policy aviso_excluir on avisos for delete using (pode(igreja_id, 'comunicacao', 'editar'));
create policy evento_ver on eventos for select using (papel_em(igreja_id) is not null);
create policy evento_criar on eventos for insert with check (pode(igreja_id, 'comunicacao', 'editar'));
create policy evento_editar on eventos for update using (pode(igreja_id, 'comunicacao', 'editar'));
create policy evento_excluir on eventos for delete using (pode(igreja_id, 'comunicacao', 'editar'));
create policy post_ver on posts for select using (papel_em(igreja_id) is not null);
create policy post_criar on posts for insert with check (pode(igreja_id, 'comunicacao', 'editar'));
create policy post_editar on posts for update using (pode(igreja_id, 'comunicacao', 'editar'));
create policy post_excluir on posts for delete using (pode(igreja_id, 'comunicacao', 'editar'));
create policy msg_ver on mensagens for select using (pode(igreja_id, 'comunicacao'));
create policy msg_criar on mensagens for insert with check (pode(igreja_id, 'comunicacao', 'editar'));

-- Site público: devolve só o que foi marcado para o site, e só se o pastor ligou o site.
-- Nenhum dado de pessoa sai daqui.
create function site(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'nome', i.nome, 'cidade', i.cidade, 'uf', i.uf, 'texto', i.site_texto,
    'avisos', coalesce((select jsonb_agg(jsonb_build_object('titulo', a.titulo, 'corpo', a.corpo, 'categoria', a.categoria) order by a.fixado desc, a.criado_em desc)
      from avisos a where a.igreja_id = i.id and a.no_site and (a.validade is null or a.validade >= current_date)), '[]'),
    'eventos', coalesce((select jsonb_agg(jsonb_build_object('titulo', e.titulo, 'data', e.data, 'hora', e.hora, 'ambiente', e.ambiente, 'local', e.local, 'descricao', e.descricao, 'videos', e.videos) order by e.data)
      from eventos e where e.igreja_id = i.id and e.no_site and e.data >= current_date - 180), '[]'),
    'posts', coalesce((select jsonb_agg(x order by x ->> 'data' desc) from (
      select jsonb_build_object('id', p.id, 'tipo', p.tipo, 'titulo', p.titulo, 'resumo', p.resumo, 'corpo', p.corpo, 'video', p.video, 'autor', p.autor, 'data', p.data) x
      from posts p where p.igreja_id = i.id and p.no_site order by p.data desc limit 30) t), '[]'))
  from igrejas i where i.slug = lower(p_slug) and i.site_publico
$$;
revoke all on function site(text) from public;
grant execute on function site(text) to anon, authenticated;
