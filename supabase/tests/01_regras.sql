-- Testes das regras do banco. Rodar com: supabase/tests/rodar.sh
-- Cada bloco entra como um usuário (role authenticated + sub do JWT) e confere
-- o que o banco permite ou recusa.
\set ON_ERROR_STOP 1
set client_min_messages = warning;

create or replace function pg_temp.como(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, false);
  execute 'set role authenticated';
end $$;

create or replace function pg_temp.erro(cmd text, trecho text) returns void language plpgsql as $$
begin
  begin execute cmd;
  exception when others then
    if position(trecho in sqlerrm) = 0 then raise exception 'Erro diferente do esperado em [%]: %', cmd, sqlerrm; end if;
    return;
  end;
  raise exception 'Deveria ter falhado: %', cmd;
end $$;

create or replace function pg_temp.igual(obtido anyelement, esperado anyelement, o_que text) returns void language plpgsql as $$
begin
  if obtido is distinct from esperado then raise exception 'FALHOU %: obtido %, esperado %', o_que, obtido, esperado; end if;
  raise notice 'ok  %', o_que;
end $$;
set client_min_messages = notice;

insert into auth.users values
 ('00000000-0000-0000-0000-0000000000a1', 'pastor@a'), ('00000000-0000-0000-0000-0000000000a2', 'tes@a'),
 ('00000000-0000-0000-0000-0000000000a3', 'sec@a'),    ('00000000-0000-0000-0000-0000000000a4', 'lider@a'),
 ('00000000-0000-0000-0000-0000000000a5', 'membro@a'), ('00000000-0000-0000-0000-0000000000b1', 'pastor@b');

-- Pastor A cria a igreja A e cadastra a equipe
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
select criar_igreja('Igreja A', 'Niterói', 'rj') as ig_a \gset
insert into pessoas (id, igreja_id, nome, status) values
 ('11111111-0000-0000-0000-000000000001', :'ig_a', 'Ana Membro', 'membro'),
 ('11111111-0000-0000-0000-000000000002', :'ig_a', 'Beto Visitante', 'visitante');
insert into vinculos (igreja_id, user_id, papel) values
 (:'ig_a', '00000000-0000-0000-0000-0000000000a2', 'tesouraria'),
 (:'ig_a', '00000000-0000-0000-0000-0000000000a3', 'secretaria'),
 (:'ig_a', '00000000-0000-0000-0000-0000000000a4', 'lider');
insert into vinculos (igreja_id, user_id, papel, pessoa_id) values
 (:'ig_a', '00000000-0000-0000-0000-0000000000a5', 'membro', '11111111-0000-0000-0000-000000000001');
insert into pessoas_pastoral (pessoa_id, igreja_id, observacao) values ('11111111-0000-0000-0000-000000000001', :'ig_a', 'luto recente');
insert into compromissos (pessoa_id, igreja_id, valor) values ('11111111-0000-0000-0000-000000000001', :'ig_a', 300);
select pg_temp.igual((select count(*) from pessoas)::int, 2, 'pastor vê as pessoas da igreja');
reset role;

-- Pastor B, de outra igreja, não enxerga nada da igreja A
select pg_temp.como('00000000-0000-0000-0000-0000000000b1');
select criar_igreja('Igreja B') as ig_b \gset
select pg_temp.igual((select count(*) from pessoas)::int, 0, 'outra igreja não vê pessoas da igreja A');
select pg_temp.igual((select count(*) from igrejas)::int, 1, 'outra igreja só vê a própria igreja');
select pg_temp.erro(format('insert into pessoas (igreja_id, nome) values (%L, %L)', :'ig_a', 'Intruso'), 'row-level security');
reset role;

-- Secretaria: cadastra pessoas, mas não vê dinheiro nem observação pastoral
select pg_temp.como('00000000-0000-0000-0000-0000000000a3');
select pg_temp.igual((select count(*) from pessoas)::int, 2, 'secretaria vê pessoas');
select pg_temp.igual((select count(*) from pessoas_pastoral)::int, 0, 'secretaria não vê observação pastoral');
select pg_temp.igual((select count(*) from compromissos)::int, 0, 'secretaria não vê compromisso de dízimo');
select pg_temp.erro(format($$insert into lancamentos (igreja_id, tipo, valor, data, categoria) values (%L, 'entrada', 10, current_date, 'Oferta')$$, :'ig_a'), 'row-level security');
select pg_temp.igual((select count(*) from lancamentos)::int, 0, 'secretaria não vê lançamentos');
reset role;

-- Membro: só a própria ficha e as próprias contribuições
select pg_temp.como('00000000-0000-0000-0000-0000000000a5');
select pg_temp.igual((select string_agg(nome, ',') from pessoas), 'Ana Membro', 'membro vê só a própria ficha');
select pg_temp.igual((select count(*) from compromissos)::int, 1, 'membro vê o próprio compromisso');
reset role;

-- Tesouraria: lançamentos, alçada, baixa, estorno
select pg_temp.como('00000000-0000-0000-0000-0000000000a2');
insert into lancamentos (igreja_id, tipo, valor, data, categoria, status) values (:'ig_a', 'entrada', 500, current_date, 'Oferta', 'pendente');
select pg_temp.igual((select status::text from lancamentos where valor = 500), 'ok', 'entrada normal nasce ok mesmo que a tela mande outro status');
insert into lancamentos (igreja_id, tipo, valor, data, categoria) values (:'ig_a', 'saida', 3800, current_date, 'Manutenção');
select pg_temp.igual((select status::text from lancamentos where valor = 3800), 'pendente', 'saída acima da alçada fica pendente');
select pg_temp.erro($$update lancamentos set status = 'ok' where valor = 3800$$, 'Só o pastor');
select pg_temp.erro($$update lancamentos set valor = 499 where valor = 500$$, 'não pode ser alterado');
delete from lancamentos where valor = 500;
select pg_temp.igual((select count(*) from lancamentos where valor = 500)::int, 1, 'lançamento não se exclui');
select pg_temp.erro(format($$insert into lancamentos (igreja_id, tipo, valor, data, categoria, fundo) values (%L, 'entrada', 1, current_date, 'Oferta', 'Inventado')$$, :'ig_a'), 'não existe');
update lancamentos set conciliado = true where valor = 500;
select pg_temp.igual((select conciliado from lancamentos where valor = 500), true, 'conciliação é permitida');

insert into contribuicoes (id, igreja_id, pessoa_id, competencia, valor, vencimento) values
 ('22222222-0000-0000-0000-000000000001', :'ig_a', '11111111-0000-0000-0000-000000000001', to_char(current_date, 'YYYY-MM'), 300, current_date);
select pg_temp.erro($$update contribuicoes set status = 'paga', recibo = 'REC-FALSO'$$, 'dar baixa');
select (dar_baixa('22222222-0000-0000-0000-000000000001', 300, current_date)).recibo as rec \gset
select pg_temp.igual(:'rec', 'REC-' || to_char(current_date, 'YYYY') || '-0001', 'baixa gera recibo numerado');
select pg_temp.igual((select count(*) from lancamentos_validos where categoria = 'Dízimo')::int, 1, 'baixa lança o dízimo no caixa');

select id as lanc_diz from lancamentos where categoria = 'Dízimo' \gset
select pg_temp.erro(format($$select estornar(%L, '')$$, :'lanc_diz'), 'motivo');
select estornar(:'lanc_diz', 'valor digitado errado');
select pg_temp.igual((select count(*) from lancamentos_validos where categoria in ('Dízimo', 'Estorno'))::int, 0, 'estorno tira os dois lançamentos dos relatórios');
select pg_temp.igual((select status::text || '/' || recibo_cancelado from contribuicoes), 'aberta/' || :'rec', 'estorno reabre o mês e cancela o recibo');
select pg_temp.erro(format($$select estornar(%L, 'de novo')$$, :'lanc_diz'), 'já estornado');
reset role;

-- Pastor aprova a saída pendente; fecha um mês passado e o banco trava lançamentos nele
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
update lancamentos set status = 'ok' where valor = 3800;
select pg_temp.igual((select aprovado_por from lancamentos where valor = 3800), '00000000-0000-0000-0000-0000000000a1'::uuid, 'pastor aprova e fica registrado quem aprovou');
select fechar_mes(:'ig_a', to_char(current_date - interval '1 month', 'YYYY-MM'));
select pg_temp.erro(format($$insert into lancamentos (igreja_id, tipo, valor, data, categoria) values (%L, 'entrada', 10, current_date - interval '1 month', 'Oferta')$$, :'ig_a'), 'está fechado');
select pg_temp.erro(format($$select fechar_mes(%L, to_char(current_date, 'YYYY-MM'))$$, :'ig_a'), 'já encerrados');
reset role;

-- Auditoria: tudo registrado, ninguém apaga, sigilo preservado
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
select pg_temp.igual((select count(*) > 10 from auditoria), true, 'trilha registrou as operações');
select pg_temp.igual((select count(*) from auditoria where mudancas::text like '%luto recente%')::int, 0, 'observação pastoral não vai para a trilha');
select pg_temp.erro($$delete from auditoria$$, 'permission denied');
select pg_temp.igual((select count(*) > 10 from auditoria), true, 'ninguém apaga a trilha');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000a2');
select pg_temp.igual((select count(*) from auditoria where tabela = 'pessoas')::int, 0, 'tesouraria não lê a trilha de pessoas');
reset role;

-- LGPD
select pg_temp.como('00000000-0000-0000-0000-0000000000a3');
select registrar_consentimento('11111111-0000-0000-0000-000000000002', true, false, false);
select pg_temp.igual((select lgpd_termo from pessoas where nome = 'Beto Visitante'), termo_atual(), 'consentimento guarda a versão do termo');
select pg_temp.erro($$select anonimizar('11111111-0000-0000-0000-000000000001')$$, 'Só o pastor');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000a5');
select pg_temp.igual((exportar_dados('11111111-0000-0000-0000-000000000001') -> 'pessoa' ->> 'nome'), 'Ana Membro', 'membro exporta os próprios dados');
select pg_temp.erro($$select exportar_dados('11111111-0000-0000-0000-000000000002')$$, 'Sem permissão');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
select anonimizar('11111111-0000-0000-0000-000000000001');
select pg_temp.igual((select count(*) from auditoria where mudancas::text like '%Ana Membro%')::int, 0, 'anonimizar limpa o nome da trilha');
select pg_temp.igual((select count(*) from lancamentos where descricao like '%Ana Membro%')::int, 0, 'anonimizar limpa o nome dos lançamentos');
select pg_temp.igual((select count(*) from contribuicoes)::int, 1, 'histórico financeiro continua');
reset role;

-- Ouvidoria: protocolo do servidor, autor vê o seu, só o pastor vê todos
select pg_temp.como('00000000-0000-0000-0000-0000000000a5');
insert into ouvidoria (igreja_id, tipo, assunto, texto, protocolo, status) values (:'ig_a', 'Sugestão', 'Horário', 'Culto mais cedo', 'X', 'Respondida');
select pg_temp.igual((select protocolo || '/' || status from ouvidoria), 'OUV-' || to_char(now(), 'YYYY') || '-0001/Recebida', 'protocolo e status vêm do servidor');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000a3');
select pg_temp.igual((select count(*) from ouvidoria)::int, 0, 'secretaria não lê manifestações de outros');
reset role;

-- Equipe: só o pastor dá acesso, e só para quem já tem login
insert into auth.users values ('00000000-0000-0000-0000-0000000000a6', 'nova@a');
select pg_temp.como('00000000-0000-0000-0000-0000000000a3');
select pg_temp.erro(format($$select adicionar_acesso(%L, 'nova@a', 'lider')$$, :'ig_a'), 'Só o pastor');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
select pg_temp.erro(format($$select adicionar_acesso(%L, 'ninguem@a', 'lider')$$, :'ig_a'), 'Ninguém entrou');
select adicionar_acesso(:'ig_a', 'NOVA@a', 'lider');
select pg_temp.igual((select papel::text from equipe(:'ig_a') where email = 'nova@a'), 'lider', 'pastor dá acesso pelo e-mail');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000a3');
select pg_temp.igual((select count(*) from equipe(:'ig_a'))::int, 0, 'só o pastor lista a equipe');
reset role;

\echo 'TODOS OS TESTES PASSARAM'
