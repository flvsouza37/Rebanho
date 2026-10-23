'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from '@/lib/z'
import { sessao } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { msgErro } from '@/lib/formato'
import type { Resultado } from '@/components/Formulario'


const Lanc = z.object({
  tipo: z.enum(['entrada', 'saida']),
  valor: z.coerce.number().positive('Informe um valor maior que zero.').max(10_000_000),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data.'),
  categoria: z.string().trim().min(2).max(60),
  fundo: z.string().trim().min(1).max(60),
  forma: z.string().trim().max(30),
  descricao: z.string().trim().max(300).transform((x) => x || null),
  pessoa_id: z.string().uuid().or(z.literal('')).optional().transform((x) => x || null),
})

export async function lancar(_: Resultado, dados: FormData): Promise<Resultado> {
  const s = await sessao()
  const v = Lanc.safeParse(Object.fromEntries(dados))
  if (!v.success) return { erro: v.error.issues[0].message }
  const supabase = await supabaseServidor()
  const { data, error } = await supabase.from('lancamentos').insert({ ...v.data, igreja_id: s.igreja.id }).select('status').single()
  if (error) return { erro: msgErro(error) }
  revalidatePath('/tesouraria')
  redirect(`/tesouraria?mes=${v.data.data.slice(0, 7)}${data.status === 'pendente' ? '&aviso=pendente' : ''}`)
}

export async function estornar(id: string, _: Resultado, dados: FormData): Promise<Resultado> {
  const supabase = await supabaseServidor()
  const { error } = await supabase.rpc('estornar', { p_lanc: id, p_motivo: String(dados.get('motivo') || '') })
  if (error) return { erro: msgErro(error) }
  revalidatePath('/tesouraria')
  return { ok: 'Estorno lançado.' }
}

export async function decidir(id: string, status: 'ok' | 'rejeitada') {
  const supabase = await supabaseServidor()
  const { error } = await supabase.from('lancamentos').update({ status }).eq('id', id)
  if (error) throw new Error(msgErro(error))
  revalidatePath('/tesouraria')
}

export async function conciliar(id: string, valor: boolean) {
  const supabase = await supabaseServidor()
  await supabase.from('lancamentos').update({ conciliado: valor }).eq('id', id)
  revalidatePath('/tesouraria')
}

export async function fecharMes(mes: string) {
  const s = await sessao()
  const supabase = await supabaseServidor()
  const { error } = await supabase.rpc('fechar_mes', { ig: s.igreja.id, p_mes: mes })
  if (error) throw new Error(msgErro(error))
  revalidatePath('/tesouraria')
}

export async function reabrirMes(mes: string) {
  const s = await sessao()
  const supabase = await supabaseServidor()
  await supabase.from('fechamentos').delete().eq('igreja_id', s.igreja.id).eq('mes', mes)
  revalidatePath('/tesouraria')
}
