'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from '@/lib/z'
import { exigirAcesso } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { msgErro } from '@/lib/formato'
import type { Resultado } from '@/components/Formulario'

const atualizar = () => { ['/palavra', '/minha-area', '/eventos'].forEach((p) => revalidatePath(p)) }
const Post = z.object({
  tipo: z.enum(['palavra', 'blog', 'vlog']),
  titulo: z.string().trim().min(3, 'Dê um título.').max(160),
  resumo: z.string().trim().min(3, 'Escreva o resumo (aparece nos cartões e nas mensagens).').max(600),
  corpo: z.string().trim().max(20000).transform((x) => x || null),
  video: z.string().trim().max(300).refine((x) => !x || /^https:\/\/\S+$/.test(x), 'O link do vídeo precisa começar com https://').transform((x) => x || null),
  autor: z.string().trim().min(2, 'Informe o autor.').max(120),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data.'),
  no_site: z.string().optional().transform((x) => x === 'on'),
}).refine((p) => p.tipo !== 'vlog' || !!p.video, { message: 'Vlog precisa do link do vídeo.' })

export async function salvarPost(id: string | null, _: Resultado, dados: FormData): Promise<Resultado> {
  const s = await exigirAcesso('comunicacao', 'editar')
  const v = Post.safeParse(Object.fromEntries(dados))
  if (!v.success) return { erro: v.error.issues[0].message }
  const supabase = await supabaseServidor()
  const { error } = id ? await supabase.from('posts').update(v.data).eq('id', id) : await supabase.from('posts').insert({ ...v.data, igreja_id: s.igreja.id })
  if (error) return { erro: msgErro(error) }
  atualizar()
  redirect('/palavra?t=' + v.data.tipo)
}

export async function excluirPost(id: string) {
  await exigirAcesso('comunicacao', 'editar')
  const supabase = await supabaseServidor()
  await supabase.from('posts').delete().eq('id', id)
  atualizar()
  redirect('/palavra')
}
