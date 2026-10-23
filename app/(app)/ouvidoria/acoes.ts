'use server'
import { revalidatePath } from 'next/cache'
import { z } from '@/lib/z'
import { sessao } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { msgErro } from '@/lib/formato'
import type { Resultado } from '@/components/Formulario'

const Manif = z.object({
  tipo: z.enum(['Sugestão', 'Reclamação', 'Elogio', 'Pedido de cuidado']),
  assunto: z.string().trim().min(3, 'Escreva o assunto.').max(120),
  texto: z.string().trim().min(5, 'Conte um pouco mais.').max(4000),
  autor_nome: z.string().trim().max(80).optional(),
  anonimo: z.literal('on').optional().transform((x) => x === 'on'),
})

export async function registrar(_: Resultado, dados: FormData): Promise<Resultado> {
  const s = await sessao()
  const v = Manif.safeParse(Object.fromEntries(dados))
  if (!v.success) return { erro: v.error.issues[0].message }
  const supabase = await supabaseServidor()
  const { error } = await supabase.from('ouvidoria').insert({ ...v.data, igreja_id: s.igreja.id, protocolo: '-' })
  if (error) return { erro: msgErro(error) }
  revalidatePath('/ouvidoria')
  return { ok: v.data.anonimo ? 'Recebemos sua manifestação anônima. Como não guardamos quem enviou, ela não aparece na sua lista.' : 'Recebemos sua manifestação. Acompanhe o protocolo nesta página.' }
}

export async function responder(id: string, _: Resultado, dados: FormData): Promise<Resultado> {
  const supabase = await supabaseServidor()
  const { error } = await supabase.from('ouvidoria').update({
    resposta: String(dados.get('resposta') || '').slice(0, 4000) || null, status: String(dados.get('status') || 'Em análise'),
  }).eq('id', id)
  if (error) return { erro: msgErro(error) }
  revalidatePath('/ouvidoria')
  return { ok: 'Resposta salva.' }
}
