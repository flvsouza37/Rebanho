-- Rebanho: dados de exemplo para a igreja de teste.
-- Cole no SQL Editor do Supabase e clique em Run. Pode rodar uma vez só:
-- se as pessoas de exemplo já existirem, o script para sem mexer em nada.
--
-- Ajuste as duas linhas abaixo se o seu e-mail ou o nome da igreja forem outros.
do $$
declare
  v_email  text := 'flvsouza37@gmail.com';
  v_igreja text := 'Igreja Teste';

  v_user uuid; ig uuid; p uuid; c uuid;
  m0 date := date_trunc('month', current_date)::date;   -- mês atual
  m1 date := (date_trunc('month', current_date) - interval '1 month')::date;
  m2 date := (date_trunc('month', current_date) - interval '2 months')::date;
  r record; mes date;
begin
  select u.id into v_user from auth.users u where lower(u.email) = lower(v_email);
  if v_user is null then raise exception 'Não achei o usuário %. Entre no app uma vez com esse e-mail.', v_email; end if;

  select i.id into ig from igrejas i join vinculos v on v.igreja_id = i.id
   where v.user_id = v_user and v.papel = 'pastor' and i.nome = v_igreja limit 1;
  if ig is null then raise exception 'Não achei a igreja "%" com % como pastor.', v_igreja, v_email; end if;

  if exists (select 1 from pessoas where igreja_id = ig and nome = 'Ana Beatriz Souza') then
    raise notice 'Os dados de exemplo já estão nesta igreja. Nada foi feito.';
    return;
  end if;

  -- Tudo abaixo é registrado como feito pelo pastor, inclusive na auditoria.
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_user::text, true);

  update igrejas set pix_chave = coalesce(pix_chave, 'financeiro@igrejateste.org.br'),
                    pix_nome = coalesce(pix_nome, 'IGREJA TESTE'), pix_cidade = coalesce(pix_cidade, 'NITEROI'),
                    fundos = array['Geral', 'Missões', 'Ação social', 'Construção']
   where id = ig;

  -- ------------------------------------------------------------ pessoas
  create temp table _p (nome text, status status_pessoa_t, tel text, nasc date, bairro text, familia text,
    grupo text, minis text[], lider boolean, etapa text, como text, prim date, ult date, batismo date,
    desde date, lgpd boolean, dizimo numeric, dia int) on commit drop;

  insert into _p values
  -- membros com compromisso de dízimo
  ('Ana Beatriz Souza',      'membro', '(21) 99811-2034', '1984-03-12', 'Icaraí',     'Souza',    'Célula Icaraí',    '{Louvor}',               true,  null, null, null, current_date - 3,  '2008-05-18', '2008-06-01', true,  450, 10),
  ('Carlos Eduardo Souza',   'membro', '(21) 99811-2035', '1982-11-02', 'Icaraí',     'Souza',    'Célula Icaraí',    '{Diaconia}',             false, null, null, null, current_date - 3,  '2007-09-09', '2008-06-01', true,  600, 10),
  ('Marcos Vinícius Lima',   'membro', '(21) 98720-4410', '1979-07-21', 'Santa Rosa', 'Lima',     'Célula Santa Rosa','{Diaconia,Recepção}',    true,  null, null, null, current_date - 6,  '2001-04-15', '2002-01-10', true,  800, 5),
  ('Patrícia Lima',          'membro', '(21) 98720-4411', '1981-01-30', 'Santa Rosa', 'Lima',     'Célula Santa Rosa','{Infantil}',             false, null, null, null, current_date - 6,  '2003-04-20', '2003-05-01', true,  300, 5),
  ('Rafael Oliveira',        'membro', '(21) 97654-1203', '1990-09-14', 'Centro',     'Oliveira', 'Célula Centro',    '{Louvor,Mídia}',         true,  null, null, null, current_date - 2,  '2012-12-02', '2013-01-06', true,  350, 15),
  ('Juliana Costa',          'membro', '(21) 96543-7788', '1993-05-08', 'Fonseca',    'Costa',    'Célula Fonseca',   '{Recepção}',             false, null, null, null, current_date - 12, '2015-08-23', '2015-09-06', true,  250, 10),
  ('Pedro Henrique Alves',   'membro', '(21) 95432-6650', '1975-12-19', 'Ingá',       'Alves',    'Célula Icaraí',    '{Ensino}',               false, null, null, null, current_date - 20, '1998-03-08', '1998-04-01', true,  700, 20),
  ('Fernanda Rocha',         'membro', '(21) 94321-5566', '1988-02-27', 'São Francisco','Rocha',  'Célula Santa Rosa','{Ação social}',          false, null, null, null, current_date - 9,  '2010-06-13', '2010-07-04', true,  400, 10),
  ('Thiago Martins',         'membro', '(21) 93210-4477', '1996-10-03', 'Centro',     'Martins',  'Célula Centro',    '{Mídia}',                false, null, null, null, current_date - 15, '2017-11-12', '2018-01-07', false, 200, 15),
  ('Luciana Ferreira',       'membro', '(21) 92109-3388', '1970-04-16', 'Fonseca',    'Ferreira', 'Célula Fonseca',   '{Intercessão}',          true,  null, null, null, current_date - 4,  '1995-10-01', '1996-01-14', true,  500, 5),
  -- membros sem compromisso cadastrado
  ('Roberto Nascimento',     'membro', '(21) 91098-2299', '1962-08-09', 'Ingá',       'Nascimento','Célula Icaraí',   '{Diaconia}',             false, null, null, null, current_date - 40, '1990-02-11', '1990-03-01', true,  null, null),
  ('Sandra Nascimento',      'membro', '(21) 91098-2298', '1965-06-22', 'Ingá',       'Nascimento','Célula Icaraí',   '{Intercessão,Cantina}',  false, null, null, null, current_date - 40, '1991-02-10', '1991-03-01', false, null, null),
  ('Gabriel Teixeira',       'membro', '(21) 99876-1100', '2001-01-11', 'Santa Rosa', 'Teixeira', 'Célula Jovens',    '{Louvor}',               false, null, null, null, current_date - 7,  '2019-07-21', '2019-08-04', true,  null, null),
  ('Mariana Duarte',         'membro', '(21) 98765-0011', '1999-11-25', 'Centro',     'Duarte',   'Célula Jovens',    '{Infantil,Mídia}',       true,  null, null, null, current_date - 1,  '2018-04-01', '2018-05-06', true,  150, 10),
  -- congregados
  ('Eduardo Barros',         'congregado', '(21) 97777-1234', '1987-03-03', 'Fonseca', 'Barros',  'Célula Fonseca',   '{}',                     false, 'Classe de membresia', 'Convite de amigo', current_date - 160, current_date - 10, null, null, true,  null, null),
  ('Camila Barros',          'congregado', '(21) 97777-1235', '1989-09-19', 'Fonseca', 'Barros',  'Célula Fonseca',   '{Recepção}',             false, 'Classe de membresia', 'Convite de amigo', current_date - 160, current_date - 10, null, null, false, null, null),
  ('Vinícius Moreira',       'congregado', '(21) 96666-2345', '1994-12-07', 'Centro',  'Moreira', 'Célula Centro',    '{}',                     false, 'Em célula', 'Instagram', current_date - 95, current_date - 25, null, null, false, null, null),
  -- visitantes (alguns sem contato há mais de 7 dias, para o alerta do painel)
  ('Larissa Mendes',         'visitante', '(21) 95555-3456', '1997-06-30', 'Icaraí',  'Mendes',  null, '{}', false, 'Primeira visita', 'Passou na frente da igreja', current_date - 3,  current_date - 3,  null, null, false, null, null),
  ('Bruno Cardoso',          'visitante', '(21) 94444-4567', '1985-02-14', 'Ingá',    'Cardoso', null, '{}', false, 'Primeira visita', 'Convite de Rafael Oliveira',  current_date - 11, null,              null, null, false, null, null),
  ('Aline Ribeiro',          'visitante', '(21) 93333-5678', '1992-08-05', 'Fonseca', 'Ribeiro', null, '{}', false, 'Voltou',          'Culto de família',            current_date - 30, current_date - 14, null, null, true,  null, null),
  ('Diego Santos',           'visitante', '(21) 92222-6789', '2000-10-10', 'Centro',  'Santos',  'Célula Jovens', '{}', false, 'Em célula', 'Amigo da célula de jovens', current_date - 45, current_date - 5, null, null, false, null, null),
  ('Helena Prado',           'visitante', '(21) 91111-7890', '1958-01-28', 'Santa Rosa','Prado', null, '{}', false, 'Decidiu seguir',  'Visita no hospital',          current_date - 60, current_date - 20, null, null, false, null, null),
  -- afastado
  ('Ricardo Gomes',          'afastado', '(21) 90000-8901', '1983-05-17', 'São Francisco','Gomes', null, '{}', false, null, null, null, current_date - 120, '2005-03-27', '2005-04-03', true, null, null);

  for r in select * from _p loop
    insert into pessoas (igreja_id, nome, status, telefone, email, nascimento, bairro, cidade, familia, grupo, ministerios, lider,
                         etapa, como_conheceu, primeira_visita, ultimo_contato, batismo, membro_desde, congregado_em,
                         lgpd_whats, lgpd_email, lgpd_imagem, lgpd_data, lgpd_termo)
    values (ig, r.nome, r.status, r.tel,
            lower(translate(split_part(r.nome, ' ', 1) || '.' || r.familia, 'áàâãéêíóôõúçÁÉÍÓÚ', 'aaaaeeioooucAEIOU')) || '@exemplo.com',
            r.nasc, r.bairro, 'Niterói', r.familia, r.grupo, r.minis, r.lider, r.etapa, r.como, r.prim, r.ult, r.batismo, r.desde,
            case when r.status = 'congregado' then current_date - 120 end,
            r.lgpd, r.lgpd, r.lgpd and r.status = 'membro', case when r.lgpd then current_date - 30 end,
            case when r.lgpd then termo_atual() end)
    returning id into p;
    if r.dizimo is not null then
      insert into compromissos (pessoa_id, igreja_id, tipo, valor, dia, forma) values (p, ig, 'Dízimo', r.dizimo, r.dia, 'Pix');
    end if;
  end loop;

  -- Cuidado pastoral (só o pastor vê; nunca entra na auditoria)
  insert into pessoas_pastoral (pessoa_id, igreja_id, observacao, evento_vida)
  select id, ig, 'Mãe internada desde o mês passado. Combinamos visita na quinta.', 'Doença na família'
    from pessoas where igreja_id = ig and nome = 'Juliana Costa';
  insert into pessoas_pastoral (pessoa_id, igreja_id, observacao, evento_vida)
  select id, ig, 'Perdeu o emprego. Encaminhado para a rede de apoio da ação social.', 'Desemprego'
    from pessoas where igreja_id = ig and nome = 'Ricardo Gomes';

  -- ------------------------------------------------------------ carnês e baixas
  -- Dois meses atrás: todos pagos. Mês passado: quase todos. Mês atual: alguns.
  foreach mes in array array[m2, m1, m0] loop
    insert into contribuicoes (igreja_id, pessoa_id, competencia, tipo, valor, vencimento)
    select ig, co.pessoa_id, to_char(mes, 'YYYY-MM'), co.tipo, co.valor, mes + (co.dia - 1)
      from compromissos co where co.igreja_id = ig;
  end loop;

  for r in select ct.id, ct.valor, ct.vencimento, pe.nome, ct.competencia
             from contribuicoes ct join pessoas pe on pe.id = ct.pessoa_id
            where ct.igreja_id = ig order by ct.vencimento loop
    continue when r.competencia = to_char(m1, 'YYYY-MM') and r.nome in ('Thiago Martins', 'Juliana Costa');
    continue when r.competencia = to_char(m0, 'YYYY-MM')
                  and (r.vencimento > current_date or r.nome in ('Fernanda Rocha', 'Thiago Martins', 'Juliana Costa'));
    perform dar_baixa(r.id, r.valor, least(r.vencimento + 1, current_date), 'Pix', 'Geral');
  end loop;

  -- ------------------------------------------------------------ outros lançamentos
  foreach mes in array array[m2, m1, m0] loop
    -- ofertas dos cultos de domingo
    insert into lancamentos (igreja_id, tipo, valor, data, categoria, fundo, forma, descricao)
    select ig, 'entrada', round((650 + random() * 500)::numeric, 2), d::date, 'Oferta', 'Geral', 'Dinheiro', 'Oferta do culto de domingo'
      from generate_series(mes, least(mes + interval '1 month' - interval '1 day', current_date::timestamp), interval '1 day') d
     where extract(dow from d) = 0;
    insert into lancamentos (igreja_id, tipo, valor, data, categoria, fundo, forma, descricao)
    select ig, x.tipo::tipo_lanc_t, x.valor, mes + x.dia, x.cat, x.fundo, x.forma, x.descr
      from (values
        ('entrada', 380.00,  6,  'Oferta de missões', 'Missões',     'Pix',    'Oferta missionária do mês'),
        ('saida',   2800.00, 4,  'Aluguel e impostos','Geral',       'Pix',    'Aluguel do templo'),
        ('saida',   612.40,  9,  'Energia e água',    'Geral',       'Boleto', 'Conta de luz'),
        ('saida',   185.90,  11, 'Energia e água',    'Geral',       'Boleto', 'Conta de água'),
        ('saida',   3500.00, 4,  'Prebenda pastoral', 'Geral',       'Pix',    'Prebenda do pastor'),
        ('saida',   500.00,  14, 'Missionários',      'Missões',     'Pix',    'Sustento missionário: família Andrade'),
        ('saida',   240.00,  17, 'Ação social',       'Ação social', 'Pix',    'Cestas básicas')
      ) as x(tipo, valor, dia, cat, fundo, forma, descr)
     where mes + x.dia <= current_date;
  end loop;
  insert into lancamentos (igreja_id, tipo, valor, data, categoria, fundo, forma, descricao)
  select ig, x.tipo::tipo_lanc_t, x.valor, x.data, x.cat, x.fundo, x.forma, x.descr
    from (values
      ('entrada', 1250.00, m1 + 19, 'Venda da cantina',  'Geral',      'Dinheiro', 'Cantina do bazar'),
      ('entrada', 5000.00, m1 + 20, 'Doação',            'Construção', 'Pix',      'Doação para a reforma do salão'),
      ('saida',   890.00,  m1 + 22, 'Manutenção',        'Geral',      'Pix',      'Conserto do ar-condicionado'),
      ('saida',   320.00,  m0 + 2,  'Material e limpeza','Geral',      'Cartão',   'Material de limpeza do mês')
    ) as x(tipo, valor, data, cat, fundo, forma, descr)
   where x.data <= current_date;

  -- Mês retrasado conferido e fechado
  update lancamentos set conciliado = true where igreja_id = ig and data < m1;
  perform fechar_mes(ig, to_char(m2, 'YYYY-MM'));

  -- ------------------------------------------------------------ ouvidoria
  insert into ouvidoria (igreja_id, tipo, assunto, texto, anonimo, autor_nome) values
    (ig, 'Sugestão',  'Horário do culto de quarta', 'Seria possível começar o culto de quarta às 19h30? Muita gente chega do trabalho atrasada.', false, 'Juliana Costa'),
    (ig, 'Reclamação','Som alto no louvor',         'O volume do som estava muito alto no último domingo, principalmente para os idosos.', true, null),
    (ig, 'Pedido de cuidado', 'Visita',           'Minha mãe está internada e gostaria de uma visita do pastor.', false, 'Juliana Costa');

  raise notice 'Pronto! Dados de exemplo criados na igreja %.', v_igreja;
end $$;
