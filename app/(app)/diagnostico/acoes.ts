'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from '@/lib/z'
import { exigir } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { hoje, msgErro } from '@/lib/formato'
import { carregarEstrategia } from '@/lib/estrategia-dados'
import { GRUPOS, PROPOS, LADOS, grauDe, insights, vazio, type Diagnostico, type GrupoId, type Lado, type PropId } from '@/lib/estrategia'
import type { Resultado } from '@/components/Formulario'

const EQUIPE = ['pastor', 'secretaria'] as const
const ehGrupo = (g: string): g is GrupoId => GRUPOS.some((x) => x[0] === g)
const ehProp = (p: string): p is PropId => PROPOS.some((x) => x[0] === p)
const ehLado = (l: string): l is Lado => LADOS.some((x) => x[0] === l)
const somaDias = (n: number) => new Date(Date.now() + n * 864e5).toLocaleDateString('sv-SE')
const atualizar = () => { revalidatePath('/diagnostico'); revalidatePath('/pdca'); revalidatePath('/kanban'); revalidatePath('/painel') }

async function doc(id: string) {
  const supabase = await supabaseServidor()
  const { data } = await supabase.from('diagnosticos').select('id, titulo, data, status, muda, diak').eq('id', id).maybeSingle()
  return { supabase, d: data as Diagnostico | null }
}

// Um ciclo novo copia o anterior: a equipe só atualiza as notas, e a comparação vira a verificação do PDCA.
export async function novoDiagnostico() {
  const s = await exigir([...EQUIPE])
  const { atual } = await carregarEstrategia(s.igreja.id)
  const agora = new Date(), tri = Math.floor(agora.getMonth() / 3) + 1
  const base = atual ? { muda: atual.muda, diak: atual.diak } : vazio()
  const titulo = `Diagnóstico ${tri}º trimestre ${agora.getFullYear()}${atual?.data === hoje() ? ' (revisão)' : ''}`
  const supabase = await supabaseServidor()
  const { error } = await supabase.from('diagnosticos').insert({ igreja_id: s.igreja.id, titulo, data: hoje(), ...base })
  if (error) redirect('/diagnostico?erro=' + encodeURIComponent(msgErro(error)))
  atualizar()
  redirect(atual ? '/diagnostico?aba=diakonia' : '/diagnostico')
}

export async function concluirDiagnostico(id: string) {
  await exigir([...EQUIPE])
  const supabase = await supabaseServidor()
  await supabase.from('diagnosticos').update({ status: 'Concluído', concluido_em: hoje() }).eq('id', id)
  atualizar()
  redirect('/diagnostico?aba=insights')
}

export async function excluirDiagnostico(id: string) {
  await exigir(['pastor'])
  const supabase = await supabaseServidor()
  await supabase.from('diagnosticos').delete().eq('id', id)
  atualizar()
  redirect('/diagnostico?aba=ciclos')
}

const Celula = z.object({ n: z.coerce.number().int().min(0).max(5), t: z.string().trim().max(300) })
export async function salvarCelula(id: string, p: string, g: string, l: string, _: Resultado, dados: FormData): Promise<Resultado> {
  await exigir([...EQUIPE])
  if (!ehProp(p) || !ehGrupo(g) || !ehLado(l)) return { erro: 'Célula inválida.' }
  const v = Celula.safeParse(Object.fromEntries(dados))
  if (!v.success) return { erro: v.error.issues[0].message }
  const { supabase, d } = await doc(id)
  if (!d) return { erro: 'Diagnóstico não encontrado.' }
  const diak = structuredClone(d.diak ?? {})
  diak[p] = { ...diak[p], [g]: { ...diak[p]?.[g], [l]: v.data } }
  const { error } = await supabase.from('diagnosticos').update({ diak }).eq('id', id)
  if (error) return { erro: msgErro(error) }
  atualizar()
  redirect('/diagnostico?aba=diakonia')
}

const Item = z.object({
  t: z.string().trim().min(3, 'Descreva o item.').max(160),
  imp: z.coerce.number().int().min(1).max(5), at: z.coerce.number().int().min(1).max(5),
})
export async function salvarItem(id: string, g: string, k: string, i: number | null, _: Resultado, dados: FormData): Promise<Resultado> {
  await exigir([...EQUIPE])
  if (!ehGrupo(g) || (k !== 'exp' && k !== 'dem')) return { erro: 'Item inválido.' }
  const v = Item.safeParse(Object.fromEntries(dados))
  if (!v.success) return { erro: v.error.issues[0].message }
  const { supabase, d } = await doc(id)
  if (!d) return { erro: 'Diagnóstico não encontrado.' }
  const muda = structuredClone(d.muda ?? {})
  const lista = [...(muda[g]?.[k] ?? [])]
  if (lista.some((x, j) => j !== i && x.t.toLowerCase() === v.data.t.toLowerCase())) return { erro: 'Esse item já existe neste grupo.' }
  if (i == null) lista.push(v.data); else lista[i] = v.data
  muda[g] = { ...muda[g], [k]: lista }
  const { error } = await supabase.from('diagnosticos').update({ muda }).eq('id', id)
  if (error) return { erro: msgErro(error) }
  atualizar()
  redirect('/diagnostico#g-' + g)
}

export async function removerItem(id: string, g: string, k: string, i: number) {
  await exigir([...EQUIPE])
  if (!ehGrupo(g) || (k !== 'exp' && k !== 'dem')) return
  const { supabase, d } = await doc(id)
  if (!d) return
  const muda = structuredClone(d.muda ?? {})
  muda[g] = { ...muda[g], [k]: (muda[g]?.[k] ?? []).filter((_, j) => j !== i) }
  await supabase.from('diagnosticos').update({ muda }).eq('id', id)
  atualizar()
  redirect('/diagnostico#g-' + g)
}

// O insight é recalculado no servidor: a tela só manda a chave.
async function acharInsight(chave: string) {
  const s = await exigir([...EQUIPE])
  const { atual, anterior, ctx } = await carregarEstrategia(s.igreja.id)
  return { s, atual, ins: insights(atual, anterior, ctx).find((x) => x.id === chave) }
}

export async function abrirPdca(chave: string) {
  const { s, atual, ins } = await acharInsight(chave)
  if (!ins) redirect('/diagnostico?aba=insights')
  const supabase = await supabaseServidor()
  const { data: aberto } = await supabase.from('pdca').select('id').eq('igreja_id', s.igreja.id).eq('chave', chave).neq('fase', 'Concluído').maybeSingle()
  if (aberto) redirect('/pdca#pd-' + aberto.id)
  const { count } = await supabase.from('pdca').select('*', { count: 'exact', head: true }).eq('igreja_id', s.igreja.id).eq('chave', chave)
  const meta = ins.tipo === 'pratica'
    ? (ins.ref.startsWith('camp') ? 'Repetir e chegar a 30% de integração' : 'Manter 4 ou mais e levar a prática a outro grupo')
    : ins.base != null ? `Subir de ${ins.base} para ${Math.min(5, ins.base + 2)} no próximo diagnóstico` : 'Eliminar a causa até o próximo diagnóstico'
  const { data: novo, error } = await supabase.from('pdca').insert({
    igreja_id: s.igreja.id, titulo: ins.titulo, tipo: ins.tipo, chave, ref: ins.ref, diagnostico_id: atual?.id ?? null,
    area: ins.area, origem: ins.origem, ciclo: (count ?? 0) + 1, score: ins.score, meta, hipotese: ins.porque, indicador: ins.indicador,
    prazo: somaDias(ins.tipo === 'ameaca' ? grauDe(ins.score).dias : 60), acoes: ins.acoes.map((t) => ({ t, feito: false })), base: ins.base,
    historico: [{ data: hoje(), fase: 'P', txt: `Criado a partir do insight (${ins.origem}): ${ins.titulo}` }],
  }).select('id').single()
  if (error) redirect('/diagnostico?aba=insights&erro=' + encodeURIComponent(msgErro(error)))
  atualizar()
  redirect('/pdca#pd-' + novo.id)
}

export async function tarefaDoInsight(chave: string) {
  const { s, ins } = await acharInsight(chave)
  if (!ins) redirect('/diagnostico?aba=insights')
  const supabase = await supabaseServidor()
  const g = grauDe(ins.score)
  await supabase.from('tarefas').insert({
    igreja_id: s.igreja.id, titulo: ins.titulo.slice(0, 160), origem: ins.captar ? 'Captação' : 'PDCA',
    prazo: somaDias(g.dias), prioridade: ins.tipo === 'pratica' ? 'baixo' : g.k, descricao: ins.acoes.join(' · '),
  })
  atualizar()
  redirect('/kanban')
}
