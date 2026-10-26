// Patrimônio: ambientes do templo, disciplinas, o motor GUT correlacionado e o 5W2H.
// As regras são as do protótipo; o banco guarda só os dados, a nota é recalculada a cada tela.

export type Ambiente = { id: string; nome: string; publico?: boolean; criancas?: boolean }
export const AMB: Ambiente[] = [
  { id: 'tel', nome: 'Telhado e cobertura' }, { id: 'alt', nome: 'Altar e púlpito', publico: true }, { id: 'nav', nome: 'Nave do templo', publico: true },
  { id: 'som', nome: 'Cabine de som e mídia' }, { id: 'ber', nome: 'Berçário', criancas: true }, { id: 'ebd', nome: 'Salas da EBD', criancas: true },
  { id: 'coz', nome: 'Cozinha' }, { id: 'sal', nome: 'Salão social', publico: true }, { id: 'ban', nome: 'Banheiros' },
  { id: 'est', nome: 'Estacionamento' }, { id: 'maq', nome: 'Casa de máquinas' },
]
export const AMBN: Record<string, Ambiente> = Object.fromEntries(AMB.map((a) => [a.id, a]))
export const DISC = ['Elétrica', 'Hidráulica', 'Estrutura e telhado', 'Incêndio e segurança', 'Climatização', 'Som e mídia', 'Limpeza e conservação', 'Acessibilidade']
export const MIN = ['Patrimônio', 'Tesouraria', 'Comunicação', 'Relacionamento', 'Ouvidoria', 'Cuidado pastoral', 'Eventos', 'Evangelismo', 'Cantina']
export const AREAS = [...DISC, ...MIN]
export const COMO: Record<string, string> = {
  'Elétrica': 'Desligar o circuito, isolar a área, contratar eletricista com NR-10, trocar os componentes e registrar laudo com fotos.',
  'Hidráulica': 'Fechar o registro, localizar o vazamento, reparar a tubulação e secar a área para evitar mofo.',
  'Estrutura e telhado': 'Vistoria com profissional habilitado, troca de telhas e calhas, impermeabilização e registro fotográfico.',
  'Incêndio e segurança': 'Recarregar ou substituir equipamentos, sinalizar rotas de fuga e conferir a validade do AVCB.',
  'Climatização': 'Limpar filtros, verificar gás e drenos e manter o PMOC em dia.',
  'Som e mídia': 'Proteger os equipamentos, revisar cabos e conexões e testar antes do próximo culto.',
  'Limpeza e conservação': 'Montar mutirão com escala, comprar insumos e definir rotina semanal de conservação.',
  'Acessibilidade': 'Medir conforme a NBR 9050, instalar rampa, corrimão ou piso tátil e sinalizar.',
}
// Prazos da manutenção são mais curtos que os do diagnóstico ministerial: risco físico.
export const GRAU_P = [
  { k: 'crit', n: 'Crítico', min: 100, dias: 2 }, { k: 'alto', n: 'Alto', min: 60, dias: 7 },
  { k: 'mod', n: 'Moderado', min: 30, dias: 30 }, { k: 'baixo', n: 'Baixo', min: 0, dias: 90 },
] as const
export const grauP = (s: number) => GRAU_P.find((g) => s >= g.min) ?? GRAU_P[3]
export const STATUS_PLANO = ['Planejado', 'Em execução', 'Em verificação', 'Concluído'] as const
export const COL_PLANO: Record<string, string> = { 'Planejado': 'afazer', 'Em execução': 'fazendo', 'Em verificação': 'verificar', 'Concluído': 'feito' }

export type Ameaca = { id: string; titulo: string; descricao: string | null; ambiente: string; disciplina: string; g: number; u: number; t: number; custo: number; origem: string | null; data: string; status: string; plano_id: string | null }
export type Cargo = { id: string; titulo: string; nome: string; pessoa_id: string | null; areas: string[] }
export type Gut = { base: number; score: number; fator: number; porque: [string, string, number][]; grau: (typeof GRAU_P)[number]; rel: string[] }

const agua = (d: string) => d === 'Hidráulica' || d === 'Estrutura e telhado'
const sobEquip = (a: Ameaca) => ['nav', 'alt', 'som'].includes(a.ambiente) && ['Elétrica', 'Som e mídia'].includes(a.disciplina)

// GUT corrigido pela correlação: ameaças no mesmo ambiente, água perto de elétrica, telhado sobre
// equipamentos, crianças e público. O fator vai até o dobro da nota.
export function gut(a: Ameaca, abertas: Ameaca[]): Gut {
  const base = a.g * a.u * a.t, porque: Gut['porque'] = [], rel = new Set<string>()
  const amb = AMBN[a.ambiente] ?? { id: a.ambiente, nome: a.ambiente }
  let f = 0
  const mesmo = abertas.filter((o) => o.id !== a.id && o.ambiente === a.ambiente)
  if (mesmo.length) { const x = Math.min(0.45, 0.15 * mesmo.length); f += x; porque.push(['Concentração no ambiente', `${mesmo.length} outra(s) ameaça(s) em ${amb.nome}`, x]); mesmo.forEach((o) => rel.add(o.id)) }
  const parElet = mesmo.filter((o) => (agua(a.disciplina) && o.disciplina === 'Elétrica') || (a.disciplina === 'Elétrica' && agua(o.disciplina)))
  if (parElet.length) { f += 0.4; porque.push(['Água perto de instalação elétrica', 'risco de curto-circuito e choque', 0.4]); parElet.forEach((o) => rel.add(o.id)) }
  if (a.ambiente === 'tel') {
    const abaixo = abertas.filter(sobEquip)
    if (abaixo.length) { f += 0.3; porque.push(['Cobertura sobre equipamentos', 'infiltração pode atingir ' + abaixo.map((o) => o.titulo).join(', '), 0.3]); abaixo.forEach((o) => rel.add(o.id)) }
  }
  if (sobEquip(a)) {
    const tel = abertas.filter((o) => o.ambiente === 'tel' && o.id !== a.id)
    if (tel.length) { f += 0.3; porque.push(['Telhado com problema acima', 'origem provável de umidade', 0.3]); tel.forEach((o) => rel.add(o.id)) }
  }
  if (amb.criancas) { f += 0.25; porque.push(['Ambiente com crianças', 'gravidade elevada por público vulnerável', 0.25]) }
  if (a.disciplina === 'Incêndio e segurança' && amb.publico) { f += 0.3; porque.push(['Segurança em área de público', 'lotação em cultos', 0.3]) }
  f = Math.min(1, f)
  const score = Math.round(base * (1 + f))
  return { base, score, fator: f, porque, grau: grauP(score), rel: [...rel] }
}

export const respPor = (cargos: Cargo[], area: string) => cargos.find((c) => c.areas.includes(area))
export const nomeCargo = (c: Cargo | undefined | null) => (c ? `${c.nome} (${c.titulo})` : 'A definir')

const somaMeses = (d: string, n: number) => { const x = new Date(d + 'T12:00:00'); x.setMonth(x.getMonth() + n); return x.toLocaleDateString('sv-SE') }
export const proximaPreventiva = (p: { ultima: string; meses: number }) => somaMeses(p.ultima, p.meses)
