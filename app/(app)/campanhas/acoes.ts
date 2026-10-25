'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from '@/lib/z'
import { sessao } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { msgErro } from '@/lib/formato'
import { CANAIS } from '@/lib/territorio'
import type { Resultado } from '@/components/Formulario'

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).transform((x) => x || null)
const texto = (max: number) => z.string().trim().max(max).transform((x) => x || null)

const Campanha = z.object({
  titulo: z.string().trim().min(3, 'Dê um nome à campanha.').max(120),
  microarea: texto(120), municipio: texto(80), uf: z.string().trim().max(2).transform((x) => x.toUpperCase() || null),
  perfil: z.enum(['polo', 'expansao', 'social', 'alta', 'dormitorio', 'rural', 'misto']).catch('misto'),
  inicio: data, fim: data,
  meta: z.coerce.number().int().min(0, 'A meta não pode ser negativa.'),
  orcamento: z.coerce.number().min(0, 'O orçamento não pode ser negativo.'),
  status: z.enum(['Planejada', 'Em andamento', 'Em avaliação', 'Encerrada']),
  responsavel: texto(120), acoes: texto(2000), convite: texto(1000),
})

export async function salvarCampanha(id: string | null, _: Resultado, dados: FormData): Promise<Resultado> {
  const s = await sessao()
  const v = Campanha.safeParse(Object.fromEntries(dados))
  if (!v.success) return { erro: v.error.issues[0].message }
  if (v.data.inicio && v.data.fim && v.data.fim < v.data.inicio) return { erro: 'O fim vem antes do início.' }
  const canais = dados.getAll('canais').map(String).filter((c) => c in CANAIS)
  const supabase = await supabaseServidor()
  const registro = { ...v.data, canais }
  if (id) {
    const { error } = await supabase.from('campanhas').update(registro).eq('id', id)
    if (error) return { erro: msgErro(error) }
  } else {
    const { data: nova, error } = await supabase.from('campanhas').insert({ ...registro, igreja_id: s.igreja.id }).select('id').single()
    if (error) return { erro: msgErro(error) }
    id = nova.id
  }
  revalidatePath('/campanhas')
  revalidatePath('/alcance')
  redirect(`/campanhas/${id}`)
}

export async function mudarStatus(id: string, status: string) {
  if (!['Planejada', 'Em andamento', 'Em avaliação', 'Encerrada'].includes(status)) return
  const supabase = await supabaseServidor()
  await supabase.from('campanhas').update({ status }).eq('id', id)
  revalidatePath(`/campanhas/${id}`)
  revalidatePath('/campanhas')
  revalidatePath('/kanban')
}

export async function excluirCampanha(id: string) {
  const supabase = await supabaseServidor()
  const { error } = await supabase.from('campanhas').delete().eq('id', id)
  if (error) redirect(`/campanhas/${id}?erro=excluir`)
  revalidatePath('/campanhas')
  redirect('/campanhas')
}

// O município do território passa a ser a cidade da igreja (só o pastor altera a igreja).
export async function definirMunicipio(municipio: string, uf: string) {
  const s = await sessao()
  const supabase = await supabaseServidor()
  await supabase.from('igrejas').update({ cidade: municipio, uf }).eq('id', s.igreja.id)
  revalidatePath('/', 'layout')
  redirect('/alcance')
}
