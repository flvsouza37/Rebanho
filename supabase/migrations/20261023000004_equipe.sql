-- Rebanho: o pastor dá acesso a quem já entrou uma vez no app (pelo e-mail).

create function adicionar_acesso(ig uuid, p_email text, p_papel papel_t, p_pessoa uuid default null)
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
  on conflict (igreja_id, user_id) do update set papel = excluded.papel, pessoa_id = excluded.pessoa_id;
end $$;

-- Lista da equipe com o e-mail (auth.users não é lido direto pela API).
create function equipe(ig uuid) returns table (user_id uuid, email text, papel papel_t, pessoa_id uuid, desde timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select v.user_id, u.email, v.papel, v.pessoa_id, v.criado_em
  from vinculos v join auth.users u on u.id = v.user_id
  where v.igreja_id = ig and tem_papel(ig, array['pastor']::papel_t[])
  order by v.papel, u.email
$$;
