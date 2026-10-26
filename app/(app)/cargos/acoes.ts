'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from '@/lib/z'
import { exigirAcesso } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { msgErro } from '@/lib/formato'
import { AREAS } from '@/lib/patrimonio'
import type { Resultado } from '@/components/Formulario'

const atualizar = () => { ['/cargos', '/planos', '/manutencao'].forEach((p) => revalidatePath(p)) }

const Cargo = z.object({
  titulo: z.string().trim().min(2, 'Informe o cargo.').max(80),
  nome: z.string().trim().max(120),
  pessoa_id: z.string().uuid().or(z.literal('')).transform((x) => x || null),
})
export async function salvarCargo(_: Resultado, dados: FormData): Promise<Resultado> {
  const s = await exigirAcesso('cargos', 'editar')
  const v = Cargo.safeParse(Object.fromEntries(dados))
  if (!v.success) return { erro: v.error.issues[0].message }
  const supabase = await supabaseServidor()
  let nome = v.data.nome
  if (v.data.pessoa_id) {
    const { data: p } = await supabase.from('pessoas').select('nome').eq('id', v.data.pessoa_id).maybeSingle()
    nome = p?.nome ?? nome
  }
  if (nome.length < 2) return { erro: 'Escolha a pessoa ou escreva o nome.' }
  const areas = dados.getAll('areas').map(String).filter((a) => AREAS.includes(a))
  const { error } = await supabase.from('cargos').insert({ igreja_id: s.igreja.id, titulo: v.data.titulo, nome, pessoa_id: v.data.pessoa_id, areas })
  if (error) return { erro: msgErro(error) }
  atualizar()
  redirect('/cargos')
}

export async function alternarArea(id: string, area: string) {
  await exigirAcesso('cargos', 'editar')
  if (!AREAS.includes(area)) return
  const supabase = await supabaseServidor()
  const { data: c } = await supabase.from('cargos').select('areas').eq('id', id).maybeSingle()
  if (!c) return
  const areas: string[] = c.areas.includes(area) ? c.areas.filter((a: string) => a !== area) : [...c.areas, area]
  await supabase.from('cargos').update({ areas }).eq('id', id)
  atualizar()
  redirect('/cargos')
}

export async function excluirCargo(id: string) {
  await exigirAcesso('cargos', 'editar')
  const supabase = await supabaseServidor()
  await supabase.from('cargos').delete().eq('id', id)
  atualizar()
  redirect('/cargos')
}
