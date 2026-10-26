import { supabaseServidor } from './supabase/server'
import { hoje } from './formato'

export type Risco = {
  id: string; nome: string; telefone: string | null; whats: boolean; grupo: string | null; status: string
  pontos: number; motivos: string[]; semanas: boolean[]; ultima: string | null; contato: { data: string; forma: string; nota: string | null } | null
}

const diasEntre = (a: string, b: string) => Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 864e5)
const menosDias = (d: string, n: number) => new Date(new Date(d + 'T12:00:00').getTime() - n * 864e5).toLocaleDateString('sv-SE')
export const LIMITE = 40

// Pontos do radar (os mesmos do protótipo): ausência nos cultos, queda de frequência,
// ausência na célula e acontecimento de vida. Só pontua ausência de quem já teve presença registrada,
// para uma igreja que ainda não faz chamada não ver todo mundo em risco.
export async function carregarRadar(igreja: string, comPastoral: boolean) {
  const supabase = await supabaseServidor()
  const h = hoje(), ini = menosDias(h, 120)
  const [{ data: pessoas }, { data: pres }, { data: cuid }, past] = await Promise.all([
    supabase.from('pessoas').select('id, nome, telefone, lgpd_whats, grupo, status').eq('igreja_id', igreja).in('status', ['membro', 'congregado', 'afastado']).eq('anonimizado', false),
    supabase.from('presencas').select('pessoa_id, data, tipo').eq('igreja_id', igreja).gte('data', ini),
    supabase.from('cuidados').select('pessoa_id, data, forma, nota').eq('igreja_id', igreja).gte('data', menosDias(h, 60)).order('data', { ascending: false }),
    comPastoral ? supabase.from('pessoas_pastoral').select('pessoa_id, evento_vida').eq('igreja_id', igreja).not('evento_vida', 'is', null) : Promise.resolve({ data: [] as { pessoa_id: string; evento_vida: string | null }[] }),
  ])
  const porPessoa = new Map<string, { data: string; tipo: string }[]>()
  ;(pres ?? []).forEach((p) => porPessoa.set(p.pessoa_id, [...(porPessoa.get(p.pessoa_id) ?? []), p]))
  const evento = new Map((past.data ?? []).map((x) => [x.pessoa_id, x.evento_vida as string]))
  const contato = new Map<string, Risco['contato']>()
  ;(cuid ?? []).forEach((c) => { if (!contato.has(c.pessoa_id)) contato.set(c.pessoa_id, { data: c.data, forma: c.forma, nota: c.nota }) })
  const comChamada = (pres ?? []).length > 0

  const lista: Risco[] = (pessoas ?? []).map((p) => {
    const ps = porPessoa.get(p.id) ?? [], cultos = ps.filter((x) => x.tipo === 'culto').map((x) => x.data).sort()
    const ultima = cultos.at(-1) ?? null
    // presença nas últimas 8 semanas, da mais antiga para a mais recente
    const semanas = Array.from({ length: 8 }, (_, i) => {
      const fim = menosDias(h, (7 - i) * 7), inicio = menosDias(fim, 6)
      return cultos.some((d) => d >= inicio && d <= fim)
    })
    let pontos = 0
    const motivos: string[] = []
    if (ultima) {
      const sem = diasEntre(ultima, h)
      if (sem >= 21) { pontos += 45; motivos.push(`${sem} dias sem presença`) }
      else if (sem >= 14) { pontos += 25; motivos.push(`${sem} dias sem presença`) }
      const ult = semanas.slice(4).filter(Boolean).length, ant = semanas.slice(0, 4).filter(Boolean).length
      if (ant - ult >= 2) { pontos += 30; motivos.push(`queda de ${ant} para ${ult} presenças no último mês`) }
    }
    const cel = ps.filter((x) => x.tipo === 'celula').map((x) => x.data).sort().at(-1)
    if (p.grupo && cel && diasEntre(cel, h) >= 21) { pontos += 15; motivos.push(`ausente da célula ${p.grupo}`) }
    const ev = evento.get(p.id)
    if (ev) { pontos += 20; motivos.push(ev) }
    return { id: p.id, nome: p.nome, telefone: p.telefone, whats: p.lgpd_whats, grupo: p.grupo, status: p.status, pontos: Math.min(100, pontos), motivos, semanas, ultima, contato: contato.get(p.id) ?? null }
  })
  const emRisco = lista.filter((x) => x.pontos >= LIMITE).sort((a, b) => b.pontos - a.pontos)
  const recente = (x: Risco) => !!x.contato && diasEntre(x.contato.data, h) <= 14
  return {
    comChamada,
    semRegistro: lista.filter((x) => !x.ultima).length,
    aCuidar: emRisco.filter((x) => !recente(x)),
    emCuidado: emRisco.filter(recente),
    total: lista.length,
  }
}

export const mensagemCuidado = (nome: string) =>
  `Oi, ${nome.split(' ')[0]}! Senti sua falta nos últimos domingos e queria saber como você está. Posso te ligar esta semana ou passar aí para um café? Estamos orando por você e sua família.`

export function linkWhats(tel: string | null, texto: string) {
  const n = (tel ?? '').replace(/\D/g, '')
  if (n.length < 10) return null
  return `https://wa.me/${n.length <= 11 ? '55' + n : n}?text=${encodeURIComponent(texto)}`
}
