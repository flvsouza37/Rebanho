'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from '@/lib/z'
import { exigirAcesso } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { hoje, msgErro } from '@/lib/formato'
import { KCOL, COL_CAMP, FASEN } from '@/lib/estrategia'
import type { Resultado } from '@/components/Formulario'

const atualizar = () => { revalidatePath('/kanban'); revalidatePath('/pdca'); revalidatePath('/campanhas'); revalidatePath('/painel') }
const CAMP_DE = Object.fromEntries(Object.entries(COL_CAMP).map(([k, v]) => [v, k]))
const PDCA_DE: Record<string, string> = { afazer: 'P', fazendo: 'D', verificar: 'C' }

// Move um cartão de coluna. Cada origem guarda o próprio estado; o banco decide quem pode mexer.
export async function moverCartao(cartao: string, coluna: string): Promise<{ erro?: string; ir?: string }> {
  await exigirAcesso('kanban')
  if (!KCOL.some((k) => k[0] === coluna)) return { erro: 'Coluna inválida.' }
  const [tipo, id] = cartao.split(':')
  const supabase = await supabaseServidor()
  let r
  if (tipo === 'tarefas') r = await supabase.from('tarefas').update({ coluna, feito_em: coluna === 'feito' ? hoje() : null }).eq('id', id).select('id')
  else if (tipo === 'campanhas') r = await supabase.from('campanhas').update({ status: CAMP_DE[coluna] }).eq('id', id).select('id')
  else if (tipo === 'pdca') {
    // Fechar um ciclo exige a decisão do "Agir", que fica na tela do PDCA.
    if (coluna === 'feito') return { ir: `/pdca#pd-${id}` }
    const { data: p } = await supabase.from('pdca').select('fase, historico').eq('id', id).maybeSingle()
    if (!p || p.fase === 'Concluído') return { erro: 'Ciclo não encontrado.' }
    const fase = PDCA_DE[coluna]
    r = await supabase.from('pdca').update({ fase, historico: [...(p.historico ?? []), { data: hoje(), fase, txt: 'Movido no kanban para ' + FASEN[fase] }] }).eq('id', id).select('id')
  } else return { erro: 'Cartão inválido.' }
  if (r.error) return { erro: msgErro(r.error) }
  if (!r.data?.length) return { erro: 'Seu perfil não pode mover este cartão.' }
  atualizar()
  return {}
}

// Versão para os botões (formulário sem JavaScript).
export async function moverPorBotao(cartao: string, coluna: string) {
  const r = await moverCartao(cartao, coluna)
  if (r.ir) redirect(r.ir)
  redirect('/kanban' + (r.erro ? '?erro=' + encodeURIComponent(r.erro) : ''))
}

const Tarefa = z.object({
  titulo: z.string().trim().min(3, 'Descreva a tarefa.').max(160),
  origem: z.enum(['Geral', 'Manutenção', 'Captação', 'PDCA']),
  responsavel: z.string().trim().max(120).transform((x) => x || null),
  prazo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).transform((x) => x || null),
  prioridade: z.enum(['crit', 'alto', 'mod', 'baixo']),
  descricao: z.string().trim().max(1000).transform((x) => x || null),
})
export async function salvarTarefa(_: Resultado, dados: FormData): Promise<Resultado> {
  const s = await exigirAcesso('kanban', 'editar')
  const v = Tarefa.safeParse(Object.fromEntries(dados))
  if (!v.success) return { erro: v.error.issues[0].message }
  const supabase = await supabaseServidor()
  const { error } = await supabase.from('tarefas').insert({ ...v.data, igreja_id: s.igreja.id })
  if (error) return { erro: msgErro(error) }
  atualizar()
  redirect('/kanban')
}

export async function excluirTarefa(id: string) {
  await exigirAcesso('kanban', 'editar')
  const supabase = await supabaseServidor()
  await supabase.from('tarefas').delete().eq('id', id)
  atualizar()
  redirect('/kanban')
}
