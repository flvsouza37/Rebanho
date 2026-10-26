export type Papel = 'pastor' | 'tesouraria' | 'secretaria' | 'lider' | 'membro'

export const NOME_PAPEL: Record<Papel, string> = {
  pastor: 'Pastor', tesouraria: 'Tesouraria', secretaria: 'Secretaria', lider: 'Líder de célula', membro: 'Membro',
}

export type Modulo = 'pessoas' | 'pastoral' | 'radar' | 'missao' | 'diagnostico' | 'pdca' | 'kanban' | 'patrimonio' | 'cargos' | 'financeiro' | 'auditoria' | 'ouvidoria'
export type Nivel = 'nenhum' | 'ver' | 'editar'
export type Acessos = Record<Modulo, Nivel>

// Módulos que o pastor libera na tela Equipe. A lista e o padrão de cada perfil moram no banco (modulos, acesso_padrao).
export const MODULOS: [Modulo, string, string][] = [
  ['pessoas', 'Membros e visitantes', 'fichas, funil de visitantes, consentimento LGPD'],
  ['pastoral', 'Anotações pastorais', 'observações sigilosas e eventos de vida'],
  ['radar', 'Radar pastoral', 'chamada, contatos de cuidado e quem está se afastando'],
  ['missao', 'Missão', 'marketing evangelístico e campanhas'],
  ['diagnostico', 'Diagnóstico', 'Análise MUDA, Matriz Diakonia e insights'],
  ['pdca', 'Ciclos PDCA', 'planejar, executar, verificar e agir'],
  ['kanban', 'Kanban de execução', 'tarefas e andamento das ações'],
  ['patrimonio', 'Patrimônio', 'manutenção GUT, preventivas e planos 5W2H'],
  ['cargos', 'Cargos e responsáveis', 'quem responde por cada área'],
  ['financeiro', 'Tesouraria e contribuições', 'lançamentos, baixas, recibos e fechamento'],
  ['auditoria', 'Auditoria completa', 'histórico de tudo o que foi alterado'],
  ['ouvidoria', 'Ouvidoria', 'ler e responder sugestões e reclamações de todos'],
]
export const NOME_NIVEL: Record<Nivel, string> = { nenhum: 'Sem acesso', ver: 'Ver', editar: 'Ver e editar' }

type Item = { href: string; nome: string; m?: Modulo[]; so?: 'pastor' | 'membro' | 'equipe' }
// O menu só esconde o que o banco já nega: a regra de verdade está nas políticas RLS.
export const MENU: { grupo: string; itens: Item[] }[] = [
  { grupo: 'Visão geral', itens: [
    { href: '/painel', nome: 'Painel', so: 'equipe' },
    { href: '/radar', nome: 'Radar pastoral', m: ['radar'] },
  ] },
  { grupo: 'Pessoas', itens: [
    { href: '/pessoas?s=membros', nome: 'Membros', m: ['pessoas'] },
    { href: '/pessoas?s=visitante', nome: 'Visitantes', m: ['pessoas'] },
    { href: '/radar/chamada', nome: 'Chamada', m: ['radar'] },
  ] },
  { grupo: 'Missão', itens: [
    { href: '/alcance', nome: 'Marketing evangelístico', m: ['missao'] },
    { href: '/campanhas', nome: 'Campanhas', m: ['missao'] },
  ] },
  { grupo: 'Estratégia', itens: [
    { href: '/diagnostico', nome: 'Diagnóstico MUDA e Diakonia', m: ['diagnostico'] },
    { href: '/pdca', nome: 'Ciclos PDCA', m: ['pdca'] },
    { href: '/kanban', nome: 'Kanban de execução', m: ['kanban'] },
  ] },
  { grupo: 'Patrimônio', itens: [
    { href: '/manutencao', nome: 'Manutenção GUT', m: ['patrimonio'] },
    { href: '/planos', nome: 'Planos 5W2H', m: ['patrimonio'] },
  ] },
  { grupo: 'Gestão', itens: [
    { href: '/tesouraria', nome: 'Tesouraria', m: ['financeiro'] },
    { href: '/contribuicoes', nome: 'Contribuições', m: ['financeiro'] },
    { href: '/auditoria', nome: 'Auditoria', m: ['auditoria', 'financeiro'] },
  ] },
  { grupo: 'Comunidade', itens: [{ href: '/ouvidoria', nome: 'Sugestões e reclamações' }] },
  { grupo: 'Administração', itens: [
    { href: '/equipe', nome: 'Equipe e acessos', so: 'pastor' },
    { href: '/cargos', nome: 'Cargos e responsáveis', m: ['cargos', 'patrimonio'] },
    { href: '/igreja', nome: 'Dados da igreja', so: 'pastor' },
  ] },
  { grupo: 'Área do membro', itens: [{ href: '/minha-area', nome: 'Minha área', so: 'membro' }] },
]

export const nivelOk = (tem: Nivel | undefined, quer: 'ver' | 'editar') => tem === 'editar' || (quer === 'ver' && tem === 'ver')
export const temEquipe = (a: Acessos) => Object.values(a).some((n) => n !== 'nenhum')
export function vePagina(i: Item, papel: Papel, a: Acessos, temFicha: boolean) {
  if (i.so === 'pastor') return papel === 'pastor'
  if (i.so === 'membro') return temFicha
  if (i.so === 'equipe') return papel === 'pastor' || temEquipe(a)
  return !i.m || i.m.some((m) => nivelOk(a[m], 'ver'))
}

export const inicioDo = (papel: Papel, a: Acessos) => (papel === 'pastor' || temEquipe(a) ? '/painel' : '/minha-area')
