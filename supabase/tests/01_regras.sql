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

-- Marketing: microáreas para todos, campanhas para pastor e secretaria, liderança só lê
select pg_temp.como('00000000-0000-0000-0000-0000000000a5');
select pg_temp.igual((select count(*) > 0 from microareas where municipio = 'Niterói'), true, 'qualquer usuário lê as microáreas');
select pg_temp.erro($$update microareas set populacao = 1$$, 'permission denied');
select pg_temp.igual((select count(*) from campanhas)::int, 0, 'membro não vê campanhas');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000a3');
insert into campanhas (igreja_id, titulo, microarea, municipio, uf, perfil, meta)
  values (:'ig_a', 'Café de boas-vindas: Icaraí', 'Icaraí', 'Niterói', 'RJ', 'alta', 15) returning id as camp_a \gset
update pessoas set campanha_id = :'camp_a' where id = '11111111-0000-0000-0000-000000000002';
select pg_temp.igual((select visitantes::int from campanhas_resultado where id = :'camp_a'), 1, 'visitante ligado à campanha conta no resultado');
delete from campanhas where id = :'camp_a';
select pg_temp.igual((select count(*) from campanhas)::int, 1, 'secretaria não exclui campanha');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000a4');
select pg_temp.igual((select count(*) from campanhas)::int, 1, 'líder vê campanhas');
select pg_temp.erro(format($$insert into campanhas (igreja_id, titulo) values (%L, 'Do líder')$$, :'ig_a'), 'row-level security');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000b1');
select pg_temp.igual((select count(*) from campanhas)::int, 0, 'outra igreja não vê campanhas');
insert into campanhas (igreja_id, titulo) values (:'ig_b', 'Campanha da B') returning id as camp_b \gset
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
select pg_temp.erro(format($$update pessoas set campanha_id = %L where id = '11111111-0000-0000-0000-000000000002'$$, :'camp_b'), 'não pertence');
delete from campanhas where id = :'camp_a';
select pg_temp.igual((select campanha_id from pessoas where id = '11111111-0000-0000-0000-000000000002'), null::uuid, 'pastor exclui campanha e o visitante fica sem origem');
reset role;

-- Estratégia: diagnóstico para pastor e secretaria, PDCA visível à liderança, tarefas para a liderança também
select pg_temp.como('00000000-0000-0000-0000-0000000000a3');
insert into diagnosticos (igreja_id, titulo, diak) values (:'ig_a', 'Diagnóstico 4º trimestre', '{"comunhao":{"multidao":{"servido":{"n":2,"t":"ninguém liga"}}}}')
  returning id as dg_a \gset
insert into pdca (igreja_id, titulo, tipo, chave, ref, diagnostico_id, base)
  values (:'ig_a', 'Comunhão: a multidão é servida pouco', 'ameaca', 'ins-x', 'dk|comunhao|multidao|servido', :'dg_a', 2) returning id as pd_a \gset
select pg_temp.erro(format($$insert into pdca (igreja_id, titulo, tipo, chave) values (%L, 'Repetido aberto', 'ameaca', 'ins-x')$$, :'ig_a'), 'duplicate key');
select pg_temp.erro(format($$update pdca set fase = 'Concluído' where id = %L$$, :'pd_a'), 'check constraint');
update pdca set fase = 'Concluído', decisao = 'Ajustar e re-testar', feito_em = current_date where id = :'pd_a';
insert into pdca (igreja_id, titulo, tipo, chave, ciclo) values (:'ig_a', 'Comunhão: novo ciclo', 'ameaca', 'ins-x', 2);
select pg_temp.igual((select count(*) from pdca where chave = 'ins-x')::int, 2, 'ciclo fechado permite abrir o próximo');
delete from diagnosticos where id = :'dg_a';
select pg_temp.igual((select count(*) from diagnosticos)::int, 1, 'secretaria não exclui diagnóstico');
update campanhas set status = 'Em avaliação' where igreja_id = :'ig_a';
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000a4');
select pg_temp.igual((select count(*) from diagnosticos)::int, 0, 'líder não vê o diagnóstico');
select pg_temp.igual((select count(*) from pdca)::int, 2, 'líder vê os ciclos PDCA no kanban');
update pdca set fase = 'D' where chave = 'ins-x' and fase = 'P';
select pg_temp.igual((select count(*) from pdca where fase = 'D')::int, 0, 'líder não altera PDCA');
insert into tarefas (igreja_id, titulo, origem, coluna) values (:'ig_a', 'Kit de boas-vindas', 'Captação', 'afazer') returning id as tk_a \gset
update tarefas set coluna = 'fazendo' where id = :'tk_a';
select pg_temp.igual((select coluna from tarefas where id = :'tk_a'), 'fazendo', 'líder move a própria tarefa no kanban');
select pg_temp.erro(format($$update tarefas set coluna = 'pronto' where id = %L$$, :'tk_a'), 'check constraint');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000a5');
select pg_temp.igual((select count(*) from tarefas)::int + (select count(*) from pdca)::int, 0, 'membro não vê PDCA nem tarefas');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000b1');
select pg_temp.igual((select count(*) from diagnosticos)::int + (select count(*) from tarefas)::int, 0, 'outra igreja não vê a estratégia');
select pg_temp.erro(format($$insert into pdca (igreja_id, titulo, tipo, chave, diagnostico_id) values (%L, 'Da B', 'ameaca', 'b', %L)$$, :'ig_b', :'dg_a'), 'não pertence');
reset role;

-- Acessos decididos pelo pastor
select pg_temp.como('00000000-0000-0000-0000-0000000000a4');
select pg_temp.erro(format($$select definir_acessos(%L, %L, '{"diagnostico":"editar"}')$$, :'ig_a', '00000000-0000-0000-0000-0000000000a4'), 'Só o pastor');
update vinculos set acessos = '{"diagnostico":"editar"}' where user_id = '00000000-0000-0000-0000-0000000000a4';
select pg_temp.igual((select nivel_em(:'ig_a', 'diagnostico')), 'nenhum', 'líder não muda os próprios acessos');
select pg_temp.igual((select meus_acessos(:'ig_a') ->> 'kanban'), 'editar', 'líder recebe o padrão do perfil');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
select pg_temp.erro(format($$select definir_acessos(%L, %L, '{"xyz":"ver"}')$$, :'ig_a', '00000000-0000-0000-0000-0000000000a4'), 'Módulo desconhecido');
select pg_temp.erro(format($$select definir_acessos(%L, %L, '{"pdca":"tudo"}')$$, :'ig_a', '00000000-0000-0000-0000-0000000000a4'), 'Nível inválido');
select pg_temp.erro(format($$select definir_acessos(%L, %L, '{"pdca":"ver"}')$$, :'ig_a', '00000000-0000-0000-0000-0000000000a1'), 'o pastor já vê tudo');
select definir_acessos(:'ig_a', '00000000-0000-0000-0000-0000000000a4', '{"diagnostico":"ver","pdca":"editar","kanban":"ver","pessoas":"nenhum","pastoral":"ver"}');
select definir_acessos(:'ig_a', '00000000-0000-0000-0000-0000000000a2', '{"financeiro":"ver","pessoas":"ver"}');
select pg_temp.igual((select (acessos ->> 'pdca') from equipe(:'ig_a') where email = 'lider@a'), 'editar', 'equipe mostra o acesso escolhido');
select pg_temp.igual((select (acessos ->> 'missao') from equipe(:'ig_a') where email = 'lider@a'), 'ver', 'módulo não marcado segue o padrão');
insert into pessoas_pastoral (pessoa_id, igreja_id, observacao) values ('11111111-0000-0000-0000-000000000001', :'ig_a', 'Luto na família');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000a4');
select pg_temp.igual((select count(*) from diagnosticos)::int, 1, 'líder liberado passa a ver o diagnóstico');
update diagnosticos set titulo = 'Mudado pelo líder';
select pg_temp.igual((select count(*) from diagnosticos where titulo = 'Mudado pelo líder')::int, 0, 'só ver não deixa editar');
update pdca set fase = 'D' where chave = 'ins-x' and fase = 'P';
select pg_temp.igual((select count(*) from pdca where fase = 'D')::int, 1, 'líder com editar no PDCA avança o ciclo');
update tarefas set coluna = 'feito' where id = :'tk_a';
select pg_temp.igual((select coluna from tarefas where id = :'tk_a'), 'fazendo', 'kanban só para ver não move tarefa');
select pg_temp.igual((select count(*) from pessoas)::int, 0, 'líder sem acesso a pessoas não vê ninguém');
select pg_temp.igual((select count(*) from pessoas_pastoral)::int, 1, 'pastor pode liberar a leitura das notas pastorais');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000a2');
select pg_temp.erro(format($$insert into lancamentos (igreja_id, tipo, valor, data, categoria) values (%L, 'entrada', 10, current_date, 'Oferta')$$, :'ig_a'), 'row-level security');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
select adicionar_acesso(:'ig_a', 'lider@a', 'secretaria');
select pg_temp.igual((select (acessos ->> 'pessoas') from equipe(:'ig_a') where email = 'lider@a'), 'editar', 'trocar o perfil volta ao padrão do novo perfil');
select adicionar_acesso(:'ig_a', 'lider@a', 'lider');
reset role;

-- Radar pastoral: chamada e contatos de cuidado
select pg_temp.como('00000000-0000-0000-0000-0000000000a4');
insert into presencas (igreja_id, pessoa_id, data) values (:'ig_a', '11111111-0000-0000-0000-000000000001', current_date - 7);
select pg_temp.erro(format($$insert into presencas (igreja_id, pessoa_id, data) values (%L, '11111111-0000-0000-0000-000000000001', current_date - 7)$$, :'ig_a'), 'duplicate key');
insert into cuidados (igreja_id, pessoa_id, forma, nota) values (:'ig_a', '11111111-0000-0000-0000-000000000001', 'Ligação', 'Está bem, viajou');
select pg_temp.igual((select count(*) from cuidados)::int, 1, 'líder registra presença e contato');
select pg_temp.igual((select meus_acessos(:'ig_a') ->> 'radar'), 'editar', 'radar entra no padrão do líder');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000a2');
select pg_temp.igual((select count(*) from presencas)::int + (select count(*) from cuidados)::int, 0, 'tesouraria não vê o radar');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000b1');
select pg_temp.erro(format($$insert into presencas (igreja_id, pessoa_id, data) values (%L, '11111111-0000-0000-0000-000000000001', current_date)$$, :'ig_b'), 'não pertence');
select pg_temp.igual((select count(*) from presencas)::int, 0, 'outra igreja não vê a chamada');
reset role;

-- Patrimônio: cargos, ameaças GUT, 5W2H e preventivas
select pg_temp.como('00000000-0000-0000-0000-0000000000a3');
insert into cargos (igreja_id, titulo, nome, areas) values (:'ig_a', 'Zelador', 'Seu João', '{Elétrica,Hidráulica,Patrimônio}') returning id as cg_a \gset
insert into ameacas (igreja_id, titulo, ambiente, disciplina, g, u, t, custo) values (:'ig_a', 'Infiltração no forro', 'tel', 'Estrutura e telhado', 4, 4, 4, 800) returning id as am_a \gset
insert into planos (igreja_id, oque, quem, quanto, grau, score) values (:'ig_a', 'Corrigir: Infiltração no forro', :'cg_a', 800, 'alto', 64) returning id as pl_a \gset
update ameacas set status = 'em plano', plano_id = :'pl_a' where id = :'am_a';
update planos set status = 'Concluído' where id = :'pl_a';
select pg_temp.igual((select status from ameacas where id = :'am_a'), 'resolvida', 'plano concluído resolve a ameaça');
select pg_temp.igual((select feito_em is not null from planos where id = :'pl_a'), true, 'plano concluído ganha data');
update planos set status = 'Em execução' where id = :'pl_a';
select pg_temp.igual((select status from ameacas where id = :'am_a'), 'em plano', 'plano reaberto devolve a ameaça');
delete from planos where id = :'pl_a';
select pg_temp.igual((select count(*) from planos)::int, 1, 'secretaria não exclui plano');
select pg_temp.erro(format($$insert into ameacas (igreja_id, titulo, ambiente, disciplina, g, u, t) values (%L, 'GUT inválido', 'nav', 'Elétrica', 6, 1, 1)$$, :'ig_a'), 'check constraint');
insert into preventivas (igreja_id, item, ambiente, disciplina, meses, ultima) values (:'ig_a', 'Recarga dos extintores', 'nav', 'Incêndio e segurança', 12, current_date - 400);
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000a2');
select pg_temp.igual((select count(*) from ameacas)::int, 1, 'tesouraria vê o patrimônio');
update ameacas set g = 1;
select pg_temp.igual((select g from ameacas)::int, 4, 'tesouraria não altera o GUT');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000a4');
select pg_temp.igual((select count(*) from cargos)::int, 1, 'líder vê os cargos');
select pg_temp.igual((select count(*) from ameacas)::int, 0, 'líder não vê o patrimônio');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
delete from planos where id = :'pl_a';
select pg_temp.igual((select status from ameacas where id = :'am_a'), 'aberta', 'plano excluído devolve a ameaça para a fila');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000b1');
select pg_temp.erro(format($$insert into planos (igreja_id, oque, quem) values (%L, 'Da outra igreja', %L)$$, :'ig_b', :'cg_a'), 'não pertence');
select pg_temp.igual((select count(*) from cargos)::int + (select count(*) from ameacas)::int, 0, 'outra igreja não vê o patrimônio');
reset role;

-- Comunicação: avisos, eventos, publicações, mensageria e site público
select pg_temp.como('00000000-0000-0000-0000-0000000000a3');
insert into avisos (igreja_id, titulo, corpo, no_site) values (:'ig_a', 'Santa Ceia domingo', 'Venha participar', true);
insert into avisos (igreja_id, titulo, corpo, validade) values (:'ig_a', 'Aviso vencido', 'Já passou', current_date - 1);
insert into eventos (igreja_id, titulo, data, ambiente) values (:'ig_a', 'Conferência de jovens', current_date + 10, 'nav');
insert into eventos (igreja_id, titulo, data, no_site) values (:'ig_a', 'Reunião interna', current_date + 3, false);
insert into posts (igreja_id, tipo, titulo, resumo, autor, data) values (:'ig_a', 'palavra', 'Deus cuida', 'Uma palavra para a semana', 'Pr. Paulo', current_date);
insert into mensagens (igreja_id, texto, publico, canais, alcance) values (:'ig_a', 'Olá, {nome}!', 'Membros', '{whatsapp}', 3);
select pg_temp.erro(format($$insert into mensagens (igreja_id, texto, publico, canais) values (%L, 'Teste', 'Membros', '{sms}')$$, :'ig_a'), 'check constraint');
select pg_temp.erro(format($$insert into posts (igreja_id, tipo, titulo, resumo, autor, data, video) values (%L, 'vlog', 'Vídeo', 'Resumo', 'Pr', current_date, 'javascript:alert(1)')$$, :'ig_a'), 'check constraint');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000a5');
select pg_temp.igual((select count(*) from avisos)::int + (select count(*) from eventos)::int + (select count(*) from posts)::int, 5, 'membro vê avisos, agenda e publicações');
select pg_temp.igual((select count(*) from mensagens)::int, 0, 'membro não vê a mensageria');
select pg_temp.erro(format($$insert into avisos (igreja_id, titulo, corpo) values (%L, 'Do membro', 'Não pode')$$, :'ig_a'), 'row-level security');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000a2');
select pg_temp.erro(format($$insert into eventos (igreja_id, titulo, data) values (%L, 'Da tesouraria', current_date)$$, :'ig_a'), 'row-level security');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000b1');
select pg_temp.igual((select count(*) from avisos)::int + (select count(*) from eventos)::int, 0, 'outra igreja não vê a comunicação');
reset role;
select set_config('request.jwt.claims', '{}', false);
set role anon;
select pg_temp.igual(site('igreja-a') is null, true, 'site desligado não aparece');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000a3');
update igrejas set slug = 'igreja-a', site_publico = true where id = :'ig_a';
reset role;
select pg_temp.igual((select site_publico from igrejas where id = :'ig_a'), false, 'só o pastor liga o site');
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
update igrejas set slug = 'igreja-a', site_publico = true where id = :'ig_a';
select pg_temp.erro(format($$update igrejas set slug = 'Com Espaço' where id = %L$$, :'ig_a'), 'check constraint');
reset role;
select set_config('request.jwt.claims', '{}', false);
set role anon;
select pg_temp.igual(jsonb_array_length(site('igreja-a') -> 'avisos'), 1, 'site mostra só aviso marcado e válido');
select pg_temp.igual(jsonb_array_length(site('igreja-a') -> 'eventos'), 1, 'site esconde evento interno');
select pg_temp.igual(site('igreja-a') -> 'posts' -> 0 ->> 'titulo', 'Deus cuida', 'site mostra a Palavra do Pastor');
select pg_temp.igual((select count(*) from avisos)::int, 0, 'visitante do site não lê a tabela de avisos');
reset role;

-- Gestão e comunidade: cantina, orçamento, escalas e boas práticas
select pg_temp.como('00000000-0000-0000-0000-0000000000a2');
insert into produtos (igreja_id, nome, preco, custo, estoque) values (:'ig_a', 'Coxinha', 6, 2.5, 10) returning id as prod_a \gset
insert into caixas (igreja_id, data, troco) values (:'ig_a', current_date, 50) returning id as cx_a \gset
select pg_temp.erro(format($$insert into caixas (igreja_id, data) values (%L, current_date)$$, :'ig_a'), 'duplicate key');
select vender(:'cx_a', jsonb_build_array(jsonb_build_object('id', :'prod_a', 'qtd', 3)), 'Pix');
select pg_temp.igual((select total from vendas)::numeric, 18.00, 'venda usa o preço do cadastro');
select pg_temp.igual((select estoque from produtos where id = :'prod_a'), 7, 'venda baixa o estoque');
select pg_temp.erro(format($$select vender(%L, jsonb_build_array(jsonb_build_object('id', %L, 'qtd', 8)), 'Pix')$$, :'cx_a', :'prod_a'), 'Estoque insuficiente');
select pg_temp.erro($$insert into vendas (igreja_id, caixa_id, itens, total, forma) select igreja_id, id, '[]', 1, 'Pix' from caixas$$, 'row-level security');
select pg_temp.igual((fechar_caixa(:'cx_a', current_date)).total::numeric, 18.00, 'fechar caixa soma as vendas');
select pg_temp.igual((select categoria || '/' || valor from lancamentos where id = (select lancamento_id from caixas where id = :'cx_a')), 'Venda da cantina/18.00', 'caixa fechado vira entrada na tesouraria');
select pg_temp.erro(format($$select fechar_caixa(%L, current_date)$$, :'cx_a'), 'já foi fechado');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
insert into orcamentos (igreja_id, ano, categoria, valor) values (:'ig_a', 2026, 'Manutenção', 12000);
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000a4');
select pg_temp.erro(format($$select vender(%L, '[]', 'Pix')$$, :'cx_a'), 'Caixa não encontrado');
select pg_temp.igual((select count(*) from produtos)::int + (select count(*) from orcamentos)::int, 0, 'líder não vê cantina nem orçamento');
insert into escalas (igreja_id, data, ministerio, pessoa_id) values (:'ig_a', current_date + 7, 'Louvor', '11111111-0000-0000-0000-000000000001') returning id as esc_a \gset
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000a5');
select pg_temp.igual((select count(*) from escalas)::int, 1, 'membro vê a própria escala');
select responder_escala(:'esc_a', 'troca');
select pg_temp.igual((select status from escalas), 'troca', 'membro pede troca');
update escalas set ministerio = 'Mídia';
select pg_temp.igual((select ministerio from escalas), 'Louvor', 'membro não muda a escala direto');
insert into praticas (igreja_id, titulo, texto, categoria, autor_nome, aprovado) values (:'ig_a', 'Culto doméstico', 'Lemos um salmo por noite com as crianças.', 'Família', 'Ana', true) returning id as pr_a \gset
select pg_temp.igual((select aprovado from praticas), false, 'prática do membro espera aprovação');
select pg_temp.erro(format($$insert into amens (pratica_id) values (%L)$$, :'pr_a'), 'row-level security');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000a2');
select pg_temp.igual((select count(*) from praticas)::int, 0, 'prática pendente não aparece para outros');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000a3');
update praticas set aprovado = true where id = :'pr_a';
select pg_temp.igual((select aprovado_por from praticas)::text, '00000000-0000-0000-0000-0000000000a3', 'secretaria aprova a prática');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000a2');
insert into amens (pratica_id) values (:'pr_a');
select pg_temp.erro(format($$insert into amens (pratica_id) values (%L)$$, :'pr_a'), 'duplicate key');
select pg_temp.igual((select count(*) from amens)::int, 1, 'amém conta uma vez por pessoa');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000b1');
select pg_temp.igual((select count(*) from praticas)::int + (select count(*) from escalas)::int + (select count(*) from caixas)::int, 0, 'outra igreja não vê gestão e comunidade');
reset role;

\echo 'TODOS OS TESTES PASSARAM'
