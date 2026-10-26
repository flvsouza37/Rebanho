'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from '@/lib/z'
import { exigirAcesso } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { msgErro } from '@/lib/formato'
import { CATEGORIAS } from '@/lib/comunicacao'
import type { Resultado } from '@/components/Formulario'

const atualizar = () => { ['/avisos', '/minha-area', '/painel', '/eventos'].forEach((p) => revalidatePath(p)) }
const Aviso = z.object({
  titulo: z.string().trim().min(3, 'Dê um título ao aviso.').max(120),
  corpo: z.string().trim().min(3, 'Escreva o aviso.').max(2000),
  categoria: z.enum(CATEGORIAS),
  publico: z.string().trim().min(2).max(80),
  validade: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).transform((x) => x || null),
  fixado: z.string().optional().transform((x) => x === 'on'),
  no_site: z.string().optional().transform((x) => x === 'on'),
})

export async function salvarAviso(id: string | null, _: Resultado, dados: FormData): Promise<Resultado> {
  const s = await exigirAcesso('comunicacao', 'editar')
  const v = Aviso.safeParse(Object.fromEntries(dados))
  if (!v.success) return { erro: v.error.issues[0].message }
  const supabase = await supabaseServidor()
  const { error } = id ? await supabase.from('avisos').update(v.data).eq('id', id) : await supabase.from('avisos').insert({ ...v.data, igreja_id: s.igreja.id })
  if (error) return { erro: msgErro(error) }
  atualizar()
  redirect('/avisos')
}

export async function excluirAviso(id: string) {
  await exigirAcesso('comunicacao', 'editar')
  const supabase = await supabaseServidor()
  await supabase.from('avisos').delete().eq('id', id)
  atualizar()
  redirect('/avisos')
}
