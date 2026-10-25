export type Papel = 'pastor' | 'tesouraria' | 'secretaria' | 'lider' | 'membro'

export const NOME_PAPEL: Record<Papel, string> = {
  pastor: 'Pastor', tesouraria: 'Tesouraria', secretaria: 'Secretaria', lider: 'Líder de célula', membro: 'Membro',
}

// O menu só esconde o que o banco já nega: a regra de verdade está nas políticas RLS.
export const MENU: { grupo: string; itens: { href: string; nome: string; papeis: Papel[] }[] }[] = [
  { grupo: 'Visão geral', itens: [{ href: '/painel', nome: 'Painel', papeis: ['pastor', 'tesouraria', 'secretaria', 'lider'] }] },
  { grupo: 'Pessoas', itens: [
    { href: '/pessoas?s=membros', nome: 'Membros', papeis: ['pastor', 'tesouraria', 'secretaria', 'lider'] },
    { href: '/pessoas?s=visitante', nome: 'Visitantes', papeis: ['pastor', 'secretaria', 'lider'] },
  ] },
  { grupo: 'Missão', itens: [
    { href: '/alcance', nome: 'Marketing evangelístico', papeis: ['pastor', 'secretaria', 'lider'] },
    { href: '/campanhas', nome: 'Campanhas', papeis: ['pastor', 'secretaria', 'lider'] },
  ] },
  { grupo: 'Gestão', itens: [
    { href: '/tesouraria', nome: 'Tesouraria', papeis: ['pastor', 'tesouraria'] },
    { href: '/contribuicoes', nome: 'Contribuições', papeis: ['pastor', 'tesouraria'] },
    { href: '/auditoria', nome: 'Auditoria', papeis: ['pastor', 'tesouraria'] },
  ] },
  { grupo: 'Comunidade', itens: [{ href: '/ouvidoria', nome: 'Sugestões e reclamações', papeis: ['pastor', 'tesouraria', 'secretaria', 'lider', 'membro'] }] },
  { grupo: 'Administração', itens: [
    { href: '/equipe', nome: 'Equipe e acessos', papeis: ['pastor'] },
    { href: '/igreja', nome: 'Dados da igreja', papeis: ['pastor'] },
  ] },
  { grupo: 'Área do membro', itens: [{ href: '/minha-area', nome: 'Minha área', papeis: ['membro'] }] },
]

export const podeFin = (p: Papel) => p === 'pastor' || p === 'tesouraria'
export const podeCadastrar = (p: Papel) => p === 'pastor' || p === 'secretaria' || p === 'lider'
export const inicioDo = (p: Papel) => (p === 'membro' ? '/minha-area' : '/painel')
