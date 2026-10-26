'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from '@/lib/z'
import { exigirAcesso, sessao } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { msgErro } from '@/lib/formato'
import { CATEGORIAS_PRATICA } from '@/lib/comunidade'
import type { Resultado } from '@/components/Formulario'

const Pratica = z.object({
  titulo: z.string().trim().min(3, 'Dê um título.').max(120),
  texto: z.string().trim().min(10, 'Conte um pouco mais (pelo menos 10 letras).').max(2000),
  categoria: z.enum(CATEGORIAS_PRATICA),
  autor_nome: z.string().trim().min(2, 'Como quer aparecer?').max(120),
})

// Qualquer pessoa da igreja compartilha; a moderação aprova antes de ficar visível para todos.
export async function compartilhar(_: Resultado, dados: FormData): Promise<Resultado> {
  const s = await sessao()
  const v = Pratica.safeParse(Object.fromEntries(dados))
  if (!v.success) return { erro: v.error.issues[0].message }
  const supabase = await supabaseServidor()
  const { error } = await supabase.from('praticas').insert({ ...v.data, igreja_id: s.igreja.id })
  if (error) return { erro: msgErro(error) }
  revalidatePath('/praticas')
  redirect('/praticas?enviada=1')
}

export async function aprovar(id: string) {
  await exigirAcesso('praticas', 'editar')
  const supabase = await supabaseServidor()
  await supabase.from('praticas').update({ aprovado: true }).eq('id', id)
  revalidatePath('/praticas')
  redirect('/praticas')
}

export async function excluirPratica(id: string) {
  await sessao()
  const supabase = await supabaseServidor()
  await supabase.from('praticas').delete().eq('id', id)
  revalidatePath('/praticas')
  redirect('/praticas')
}

export async function amem(id: string, tem: boolean) {
  const s = await sessao()
  const supabase = await supabaseServidor()
  if (tem) await supabase.from('amens').delete().eq('pratica_id', id).eq('user_id', s.userId)
  else await supabase.from('amens').insert({ pratica_id: id })
  revalidatePath('/praticas')
  redirect('/praticas#pr-' + id)
}
