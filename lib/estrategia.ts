// Diagnóstico ministerial: Análise MUDA (o que cada grupo deseja x o que precisa) e
// Matriz Diakonia (como cada grupo serve e é servido nos cinco propósitos).
// Daqui saem os insights: ameaças com nota GUT e boas práticas para re-testar no PDCA.

export type GrupoId = 'multidao' | 'discipulos' | 'apostolos'
export type PropId = 'adoracao' | 'comunhao' | 'discipulado' | 'ministerio' | 'evangelismo'
export type Lado = 'serve' | 'servido'
export type ItemMuda = { t: string; imp: number; at: number }
export type Muda = Partial<Record<GrupoId, { exp?: ItemMuda[]; dem?: ItemMuda[] }>>
export type Celula = { n: number | null; t: string }
export type Diak = Partial<Record<PropId, Partial<Record<GrupoId, Partial<Record<Lado, Celula>>>>>>
export type Diagnostico = { id: string; titulo: string; data: string; status: string; muda: Muda; diak: Diak }
export type CampanhaRes = { id: string; titulo: string; visitantes: number; integrados: number }
export type Contexto = { campanhas: CampanhaRes[]; congregados: number; membros: number; visitantes: number }

export const GRUPOS: [GrupoId, string, string][] = [
  ['multidao', 'Multidão', 'quem frequenta e ainda não assumiu compromisso'],
  ['discipulos', 'Discípulos', 'membros em crescimento e serviço'],
  ['apostolos', 'Apóstolos', 'liderança que forma e envia'],
]
export const GN: Record<GrupoId, string> = { multidao: 'Multidão', discipulos: 'Discípulos', apostolos: 'Apóstolos' }
export const PROPOS: [PropId, string][] = [
  ['adoracao', 'Adoração'], ['comunhao', 'Comunhão'], ['discipulado', 'Discipulado'], ['ministerio', 'Ministério'], ['evangelismo', 'Evangelismo'],
]
export const PN: Record<PropId, string> = Object.fromEntries(PROPOS) as Record<PropId, string>
export const LADOS: [Lado, string][] = [['serve', 'Como serve'], ['servido', 'Como é servido']]
export const NOTA = ['0 · não acontece', '1 · muito fraco', '2 · fraco', '3 · razoável', '4 · bom', '5 · excelente']
const ART: Record<GrupoId, string> = { multidao: 'a multidão', discipulos: 'os discípulos', apostolos: 'os apóstolos' }
const VB: Record<GrupoId, [string, string]> = { multidao: ['deseja', 'precisa'], discipulos: ['desejam', 'precisam'], apostolos: ['desejam', 'precisam'] }
const FR: Record<GrupoId, Record<Lado, string>> = {
  multidao: { serve: 'a multidão serve', servido: 'a multidão é servida' },
  discipulos: { serve: 'os discípulos servem', servido: 'os discípulos são servidos' },
  apostolos: { serve: 'os apóstolos servem', servido: 'os apóstolos são servidos' },
}
const SUG: Record<PropId, Record<Lado, string[]>> = {
  adoracao: { serve: ['Abrir as escalas de louvor, recepção e mídia para novos voluntários', 'Treinar uma equipe de recepção para os cultos'], servido: ['Revisar a liturgia e a acolhida com o olhar de quem chega pela primeira vez', 'Cuidar dos espaços de culto: limpeza, som, acessibilidade'] },
  comunhao: { serve: ['Cada célula adota uma família nova por mês', 'Mesa de boas-vindas com café depois do culto'], servido: ['Ligar para quem faltou duas semanas seguidas', 'Abrir células em novos bairros e horários'] },
  discipulado: { serve: ['Formar novos facilitadores de discipulado em dupla', 'Cada discípulo acompanha um novo convertido por 3 meses'], servido: ['Trilha de discipulado com começo, meio e fim', 'Encontros quinzenais de mentoria'] },
  ministerio: { serve: ['Teste de dons e entrevista para encaixar voluntários', 'Escalas equilibradas para ninguém servir em tudo'], servido: ['Rodízio e descanso para quem serve', 'Capacitação trimestral por ministério'] },
  evangelismo: { serve: ['Treinar os membros para convidar e acompanhar visitantes', 'Campanha no bairro de maior potencial do território'], servido: ['Integração do visitante em até 7 dias', 'Evento de portas abertas uma vez por mês'] },
}

export const GRAU = [
  { k: 'crit', n: 'Crítico', min: 100, dias: 7 }, { k: 'alto', n: 'Alto', min: 60, dias: 30 },
  { k: 'mod', n: 'Moderado', min: 30, dias: 45 }, { k: 'baixo', n: 'Baixo', min: 0, dias: 60 },
] as const
export const grauDe = (s: number) => GRAU.find((g) => s >= g.min) ?? GRAU[3]

export type Insight = {
  id: string; tipo: 'ameaca' | 'pratica'; origem: 'MUDA' | 'Diakonia' | 'Cruzamento'; area: string; ref: string
  titulo: string; porque: string; acoes: string[]; indicador: string; base: number | null
  g: number; u: number; t: number; score: number; status?: string; captar?: boolean; campanha?: string
}

export const cel = (d: Diagnostico | undefined, p: PropId, g: GrupoId, l: Lado): Celula => d?.diak?.[p]?.[g]?.[l] ?? { n: null, t: '' }
export const lacuna = (it: ItemMuda) => (Number(it.imp) || 0) * (5 - (Number(it.at) || 0))
const media = (v: number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null)
const um = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

function ameaca(o: Omit<Insight, 'tipo' | 'score'>): Insight { return { ...o, tipo: 'ameaca', score: o.g * o.u * o.t } }
function pratica(o: Omit<Insight, 'tipo' | 'score' | 'g' | 'u' | 't'>): Insight { return { ...o, tipo: 'pratica', g: 0, u: 0, t: 0, score: 0 } }

export function insights(d: Diagnostico | undefined, ant: Diagnostico | undefined, ctx: Contexto): Insight[] {
  if (!d) return []
  const L: Insight[] = []
  for (const [p] of PROPOS) for (const [g] of GRUPOS) for (const [l] of LADOS) {
    const c = cel(d, p, g, l), a = cel(ant, p, g, l).n
    if (c.n == null) continue
    const ref = `dk|${p}|${g}|${l}`
    const [t, tx] = a == null ? [3, ''] : c.n < a ? [5, `caiu de ${a} para ${c.n} desde o ciclo anterior`] : c.n > a ? [2, `subiu de ${a} para ${c.n}`] : [3, 'igual ao ciclo anterior']
    // A multidão, por definição, ainda não serve: só conta no evangelismo (convidar).
    if (g === 'multidao' && l === 'serve' && p !== 'evangelismo' && c.n <= 2) continue
    const pesado = (g === 'apostolos' && l === 'servido') || (g === 'multidao' && l === 'servido' && ['adoracao', 'evangelismo', 'comunhao'].includes(p))
    if (c.n <= 1 || (c.n === 2 && (pesado || t === 5))) {
      L.push(ameaca({ id: 'ins-' + ref, origem: 'Diakonia', area: PN[p], ref, base: c.n, g: pesado ? 4 : 3, u: c.n === 0 ? 4 : 3, t,
        titulo: `${PN[p]}: ${FR[g][l]} pouco`,
        porque: `Nota ${c.n} de 5${c.t ? ` ("${c.t}")` : ''}${tx ? ', ' + tx : ''}.${g === 'apostolos' && l === 'servido' ? ' Liderança sem cuidado tende ao esgotamento.' : ''}`,
        acoes: SUG[p][l], indicador: `Nota de ${PN[p]} · ${GN[g]} · ${l === 'serve' ? 'como serve' : 'como é servido'} no próximo diagnóstico`,
        captar: p === 'evangelismo' }))
    } else if (c.n >= 4 && ((a != null && a <= 3) || c.n === 5)) {
      L.push(pratica({ id: 'ins-' + ref, origem: 'Diakonia', area: PN[p], ref, base: c.n,
        titulo: `${PN[p]}: ${FR[g][l]} bem`,
        porque: `Nota ${c.n}${c.t ? ` ("${c.t}")` : ''}. ` + (a == null ? 'Nota máxima na primeira medição: vale confirmar no próximo ciclo.' : a >= 4 ? 'Nota máxima e estável: candidata a virar padrão da igreja.' : `Melhorou de ${a} para ${c.n}: re-testar para confirmar que não foi pontual.`),
        acoes: ['Registrar como a prática acontece hoje, passo a passo', 'Levar a mesma prática para outro grupo ou propósito'],
        indicador: 'Nota se mantém em 4 ou mais no próximo diagnóstico', status: a != null && a >= 4 ? 'Consolidada' : 'Re-testar' }))
    }
  }
  // Desequilíbrio entre servir e ser servido
  for (const [g] of GRUPOS) {
    const m = (l: Lado) => media(PROPOS.map(([p]) => cel(d, p, g, l).n).filter((x): x is number => x != null))
    const sv = m('serve'), sd = m('servido')
    if (sv == null || sd == null) continue
    if (g === 'discipulos' && sd - sv >= 1) L.push(ameaca({ id: 'ins-eq-' + g, origem: 'Diakonia', area: 'Ministério', ref: 'eq|' + g, base: null, g: 3, u: 3, t: 4,
      titulo: 'Discípulos mais servidos do que servindo', porque: `Média ${um(sd)} sendo servidos contra ${um(sv)} servindo. Sinal de consumo: o crescimento para no banco.`,
      acoes: SUG.ministerio.serve, indicador: 'Diferença entre servir e ser servido abaixo de 1 ponto' }))
    if (g === 'apostolos' && sv - sd >= 2) L.push(ameaca({ id: 'ins-eq-' + g, origem: 'Diakonia', area: 'Cuidado pastoral', ref: 'eq|' + g, base: null, g: 5, u: 4, t: 3,
      titulo: 'Liderança serve muito e é pouco cuidada', porque: `Média ${um(sv)} servindo contra ${um(sd)} sendo servida. Risco de esgotamento e de perder líderes.`,
      acoes: SUG.ministerio.servido, indicador: 'Média de como a liderança é servida em 3 ou mais' }))
  }
  // MUDA: o que desejam x o que precisam
  for (const [g] of GRUPOS) {
    const m = d.muda?.[g] ?? {}
    for (const k of ['exp', 'dem'] as const) for (const it of m[k] ?? []) {
      const gap = lacuna(it), ref = `mu|${g}|${k}|${it.t}`, verbo = VB[g][k === 'exp' ? 0 : 1]
      const area = g === 'multidao' ? 'Evangelismo' : g === 'discipulos' ? 'Discipulado' : 'Cuidado pastoral'
      if (gap >= 12) L.push(ameaca({ id: 'ins-' + ref, origem: 'MUDA', area, ref, base: Number(it.at), g: Math.max(1, it.imp - (k === 'exp' ? 1 : 0)), u: 5 - it.at, t: 3,
        titulo: `${GN[g]} ${verbo}: ${it.t}`,
        porque: `Importância ${it.imp} e atendimento ${it.at} de 5 (lacuna ${gap} de 20). ${k === 'dem' ? 'É uma necessidade real do grupo.' : 'É um desejo: atender ajuda a reter e a atrair.'}`,
        acoes: [`Definir quem responde por "${it.t}"`, 'Ouvir 5 pessoas do grupo antes de mudar'], indicador: 'Atendimento 4 ou mais no próximo diagnóstico', captar: g === 'multidao' }))
      else if (it.imp >= 5 && it.at >= 4) L.push(pratica({ id: 'ins-' + ref, origem: 'MUDA', area, ref, base: Number(it.at),
        titulo: `${GN[g]} ${verbo}: ${it.t}`, porque: `Importância ${it.imp} e atendimento ${it.at}: a igreja acerta aqui.`,
        acoes: ['Registrar o que faz isso funcionar', 'Ensinar a prática a outro ministério'], indicador: 'Atendimento se mantém em 4 ou mais', status: 'Re-testar' }))
    }
    const e = media((m.exp ?? []).map((x) => Number(x.at))), n = media((m.dem ?? []).map((x) => Number(x.at)))
    if (e != null && n != null && e - n >= 1) L.push(ameaca({ id: 'ins-al-' + g, origem: 'MUDA', area: g === 'multidao' ? 'Evangelismo' : 'Discipulado', ref: 'al|' + g, base: null, g: 4, u: 3, t: 3,
      titulo: `A igreja entrega o que ${ART[g]} ${VB[g][0]}, mas não o que ${VB[g][1]}`,
      porque: `Atendimento médio de ${um(e)} nas expectativas contra ${um(n)} nas demandas. O grupo fica satisfeito sem crescer.`,
      acoes: [`Escolher uma demanda (${GN[g]}) e atendê-la neste trimestre`, 'Explicar o próximo passo nos cultos e nas células'], indicador: 'Diferença menor que 1 ponto no próximo MUDA', captar: g === 'multidao' }))
  }
  // Cruzamento com as campanhas de captação
  const vc = ctx.campanhas.reduce((s, c) => s + c.visitantes, 0), ic = ctx.campanhas.reduce((s, c) => s + c.integrados, 0)
  if (vc > 0 && ic === 0) L.push(ameaca({ id: 'ins-x-integ', origem: 'Cruzamento', area: 'Evangelismo', ref: 'x|integ', base: 0, g: 4, u: 4, t: 3,
    titulo: 'Campanhas trazem visitantes, mas ninguém foi integrado', porque: `${vc} visitante(s) vieram de campanhas e nenhum virou congregado ou membro.`,
    acoes: SUG.evangelismo.servido, indicador: '30% dos visitantes de campanha integrados em 60 dias', captar: true }))
  for (const c of ctx.campanhas) if (c.visitantes >= 3 && c.integrados / c.visitantes >= 0.3) {
    const pct = Math.round((c.integrados / c.visitantes) * 100)
    L.push(pratica({ id: 'ins-x-camp-' + c.id, origem: 'Cruzamento', area: 'Evangelismo', ref: 'camp|' + c.id, base: pct, campanha: c.id,
      titulo: `Campanha que integra: ${c.titulo}`, porque: `${c.integrados} de ${c.visitantes} visitantes já são congregados ou membros (${pct}%). Re-testar o mesmo formato em outra microárea.`,
      acoes: ['Repetir a campanha em outro bairro de perfil parecido', 'Registrar o roteiro da campanha'], indicador: 'Integração de 30% ou mais na nova campanha', status: 'Re-testar' }))
  }
  return L.sort((a, b) => (a.tipo === 'ameaca' ? 0 : 1) - (b.tipo === 'ameaca' ? 0 : 1) || b.score - a.score)
}

// O que o sistema já sabe, para confrontar a percepção da matriz com os dados.
export function evidencia(p: PropId, ctx: Contexto): string {
  const vc = ctx.campanhas.reduce((s, c) => s + c.visitantes, 0), ic = ctx.campanhas.reduce((s, c) => s + c.integrados, 0)
  if (p === 'evangelismo') return `${ctx.visitantes} visitante(s) · ${vc} vindos de campanhas · ${vc ? Math.round((ic / vc) * 100) : 0}% integrados`
  if (p === 'discipulado') return `${ctx.congregados} congregado(s) · ${ctx.membros} membro(s)`
  if (p === 'comunhao') return `${ctx.visitantes + ctx.congregados} pessoa(s) ainda chegando (visitantes e congregados)`
  return ''
}

// Valor atual do indicador de um ciclo PDCA no último diagnóstico.
export function medir(ref: string | null, d: Diagnostico | undefined, ctx: Contexto): number | null {
  if (!ref || !d) return null
  const r = ref.split('|')
  if (r[0] === 'dk') return cel(d, r[1] as PropId, r[2] as GrupoId, r[3] as Lado).n
  if (r[0] === 'mu') { const it = (d.muda?.[r[1] as GrupoId]?.[r[2] as 'exp' | 'dem'] ?? []).find((x) => x.t === r.slice(3).join('|')); return it ? Number(it.at) : null }
  if (r[0] === 'camp') { const c = ctx.campanhas.find((x) => x.id === r[1]); return c && c.visitantes ? Math.round((c.integrados / c.visitantes) * 100) : null }
  return null
}

export const FASES: [string, string][] = [['P', 'Planejar'], ['D', 'Executar'], ['C', 'Verificar'], ['A', 'Agir']]
export const FASEN: Record<string, string> = { P: 'Planejar', D: 'Executar', C: 'Verificar', A: 'Agir', 'Concluído': 'Concluído' }
export const KCOL: [string, string][] = [['afazer', 'A fazer'], ['fazendo', 'Fazendo'], ['verificar', 'Verificar'], ['feito', 'Feito']]
export const COL_CAMP: Record<string, string> = { 'Planejada': 'afazer', 'Em andamento': 'fazendo', 'Em avaliação': 'verificar', 'Encerrada': 'feito' }
export const COL_PDCA: Record<string, string> = { P: 'afazer', D: 'fazendo', C: 'verificar', A: 'verificar', 'Concluído': 'feito' }
export const vazio = (): { muda: Muda; diak: Diak } => ({ muda: { multidao: { exp: [], dem: [] }, discipulos: { exp: [], dem: [] }, apostolos: { exp: [], dem: [] } }, diak: {} })
