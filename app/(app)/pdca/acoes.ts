'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from '@/lib/z'
import { exigir, exigirAcesso } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { hoje, msgErro } from '@/lib/formato'
import { FASES, FASEN } from '@/lib/estrategia'
import type { Resultado } from '@/components/Formulario'

type Acao = { t: string; feito: boolean }
type Hist = { data: string; fase: string; txt: string }
const atualizar = () => { revalidatePath('/pdca'); revalidatePath('/kanban'); revalidatePath('/diagnostico'); revalidatePath('/painel') }
const proxima = (f: string) => FASES[FASES.findIndex((x) => x[0] === f) + 1]?.[0] ?? 'A'
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).transform((x) => x || null)
const texto = (max: number) => z.string().trim().max(max).transform((x) => x || null)

async function ciclo(id: string) {
  await exigirAcesso('pdca', 'editar')
  const supabase = await supabaseServidor()
  const { data: p } = await supabase.from('pdca').select('*').eq('id', id).maybeSingle()
  return { supabase, p }
}
const comHist = (p: { historico: Hist[] }, fase: string, txt: string) => [...(p.historico ?? []), { data: hoje(), fase, txt }]

const Plan = z.object({ meta: z.string().trim().min(3, 'Escreva a meta.').max(300), hipotese: texto(1000), indicador: texto(300), prazo: data })
const Check = z.object({ medido: z.string().trim().transform((x) => (x === '' ? null : Number(x.replace(',', '.')))).refine((x) => x == null || Number.isFinite(x), 'Resultado inválido.'), obs_check: texto(1000) })
const Act = z.object({ decisao: z.enum(['Padronizar', 'Ajustar e re-testar', 'Abandonar']), obs_act: texto(1000) })

// Salva a fase atual; com "avançar" marcado, passa para a próxima.
export async function salvarFase(id: string, _: Resultado, dados: FormData): Promise<Resultado> {
  const { supabase, p } = await ciclo(id)
  if (!p || p.fase === 'Concluído') return { erro: 'Ciclo não encontrado ou já concluído.' }
  const f = p.fase as string, o = Object.fromEntries(dados), avanca = dados.get('avanca') === '1'
  let mud: Record<string, unknown> = {}, txt = ''
  if (f === 'P') { const v = Plan.safeParse(o); if (!v.success) return { erro: v.error.issues[0].message }; mud = v.data; txt = 'Plano: ' + v.data.meta }
  if (f === 'D') {
    const antigas = (p.acoes ?? []) as Acao[]
    const acoes = String(o.acoes ?? '').split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 20).map((t) => ({ t: t.slice(0, 200), feito: !!antigas.find((a) => a.t === t)?.feito }))
    mud = { acoes, responsavel: String(o.responsavel ?? '').trim().slice(0, 120) || null }; txt = `Execução: ${acoes.length} ação(ões)`
  }
  if (f === 'C') { const v = Check.safeParse(o); if (!v.success) return { erro: v.error.issues[0].message }; mud = v.data; txt = `Medido: ${v.data.medido ?? '—'}${v.data.obs_check ? ' · ' + v.data.obs_check : ''}` }
  if (f === 'A') {
    const v = Act.safeParse(o); if (!v.success) return { erro: v.error.issues[0].message }
    const { error } = await supabase.from('pdca').update({ ...v.data, fase: 'Concluído', feito_em: hoje(), historico: comHist(p, 'A', 'Decisão: ' + v.data.decisao + (v.data.obs_act ? ' · ' + v.data.obs_act : '')) }).eq('id', id)
    if (error) return { erro: msgErro(error) }
    // Ajustar: o resultado medido vira o ponto de partida de um novo ciclo da mesma ameaça ou prática.
    if (v.data.decisao === 'Ajustar e re-testar') {
      const base = p.medido ?? p.base
      const { error: e2 } = await supabase.from('pdca').insert({
        igreja_id: p.igreja_id, titulo: p.titulo, tipo: p.tipo, chave: p.chave, ref: p.ref, diagnostico_id: p.diagnostico_id, area: p.area, origem: p.origem,
        ciclo: p.ciclo + 1, score: p.score, meta: p.meta, hipotese: p.hipotese, indicador: p.indicador, responsavel: p.responsavel, base,
        prazo: new Date(Date.now() + 60 * 864e5).toLocaleDateString('sv-SE'), acoes: ((p.acoes ?? []) as Acao[]).map((a) => ({ t: a.t, feito: false })),
        historico: [{ data: hoje(), fase: 'P', txt: `Novo ciclo a partir do ciclo ${p.ciclo}. Ponto de partida: ${base ?? '—'}` }],
      })
      if (e2) return { erro: msgErro(e2) }
    }
    atualizar()
    redirect('/pdca')
  }
  const fase = avanca ? proxima(f) : f
  const { error } = await supabase.from('pdca').update({ ...mud, fase, historico: comHist(p, f, txt + (avanca ? ` · avançou para ${FASEN[fase]}` : '')) }).eq('id', id)
  if (error) return { erro: msgErro(error) }
  atualizar()
  redirect('/pdca#pd-' + id)
}

export async function avancar(id: string) {
  const { supabase, p } = await ciclo(id)
  if (!p || p.fase === 'Concluído' || p.fase === 'A') return
  const fase = proxima(p.fase)
  await supabase.from('pdca').update({ fase, historico: comHist(p, fase, 'Avançou para ' + FASEN[fase]) }).eq('id', id)
  atualizar()
  redirect('/pdca#pd-' + id)
}

export async function marcarAcao(id: string, i: number) {
  const { supabase, p } = await ciclo(id)
  if (!p || p.fase === 'Concluído') return
  const acoes = [...((p.acoes ?? []) as Acao[])]
  if (!acoes[i]) return
  acoes[i] = { ...acoes[i], feito: !acoes[i].feito }
  let hist = comHist(p, p.fase, (acoes[i].feito ? 'Feito: ' : 'Reaberto: ') + acoes[i].t), fase = p.fase
  if (p.fase === 'P' && acoes[i].feito) { fase = 'D'; hist = [...hist, { data: hoje(), fase: 'D', txt: 'Execução começou' }] }
  await supabase.from('pdca').update({ acoes, fase, historico: hist }).eq('id', id)
  atualizar()
  redirect('/pdca#pd-' + id)
}

export async function excluirPdca(id: string) {
  await exigir(['pastor'])
  const supabase = await supabaseServidor()
  await supabase.from('pdca').delete().eq('id', id)
  atualizar()
  redirect('/pdca')
}
