'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from '@/lib/z'
import { exigir, exigirAcesso } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { msgErro } from '@/lib/formato'
import { AMBN } from '@/lib/patrimonio'
import type { Resultado } from '@/components/Formulario'

const atualizar = () => { ['/eventos', '/minha-area', '/painel', '/manutencao'].forEach((p) => revalidatePath(p)) }
const Evento = z.object({
  titulo: z.string().trim().min(3, 'Dê um nome ao evento.').max(120),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data.'),
  hora: z.string().regex(/^\d{2}:\d{2}$/).or(z.literal('')).transform((x) => x || null),
  ambiente: z.string().refine((x) => !x || !!AMBN[x], 'Ambiente inválido.').transform((x) => x || null),
  local: z.string().trim().max(120).transform((x) => x || null),
  descricao: z.string().trim().max(2000).transform((x) => x || null),
  videos: z.string().transform((x) => x.split(/\s+/).filter(Boolean)).refine((l) => l.length <= 6 && l.every((u) => /^https:\/\/\S+$/.test(u)), 'Vídeos: até 6 links começando com https://'),
  no_site: z.string().optional().transform((x) => x === 'on'),
})

export async function salvarEvento(id: string | null, _: Resultado, dados: FormData): Promise<Resultado> {
  const s = await exigirAcesso('comunicacao', 'editar')
  const v = Evento.safeParse(Object.fromEntries(dados))
  if (!v.success) return { erro: v.error.issues[0].message }
  const supabase = await supabaseServidor()
  const { error } = id ? await supabase.from('eventos').update(v.data).eq('id', id) : await supabase.from('eventos').insert({ ...v.data, igreja_id: s.igreja.id })
  if (error) return { erro: msgErro(error) }
  atualizar()
  redirect('/eventos')
}

export async function excluirEvento(id: string) {
  await exigirAcesso('comunicacao', 'editar')
  const supabase = await supabaseServidor()
  await supabase.from('eventos').delete().eq('id', id)
  atualizar()
  redirect('/eventos')
}

const semAcento = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '')
const Site = z.object({
  slug: z.string().trim().toLowerCase().transform((x) => semAcento(x).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''))
    .refine((x) => x.length >= 3 && x.length <= 60, 'O endereço precisa de 3 a 60 letras ou números.'),
  site_texto: z.string().trim().max(300).transform((x) => x || null),
  site_publico: z.string().optional().transform((x) => x === 'on'),
})

// Só o pastor publica o site (a política de igrejas já exige isso).
export async function salvarSite(_: Resultado, dados: FormData): Promise<Resultado> {
  const s = await exigir(['pastor'])
  const v = Site.safeParse(Object.fromEntries(dados))
  if (!v.success) return { erro: v.error.issues[0].message }
  const supabase = await supabaseServidor()
  const { error } = await supabase.from('igrejas').update(v.data).eq('id', s.igreja.id)
  if (error) return { erro: error.code === '23505' ? 'Esse endereço já é de outra igreja. Escolha outro.' : msgErro(error) }
  revalidatePath('/eventos')
  return { ok: v.data.site_publico ? 'Site publicado.' : 'Configuração salva. O site está desligado.' }
}
