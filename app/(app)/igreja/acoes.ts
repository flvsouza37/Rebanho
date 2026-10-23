'use server'
import { revalidatePath } from 'next/cache'
import { z } from '@/lib/z'
import { sessao } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { msgErro } from '@/lib/formato'
import type { Resultado } from '@/components/Formulario'

const Igreja = z.object({
  nome: z.string().trim().min(2).max(120), cnpj: z.string().trim().max(20), cidade: z.string().trim().max(80), uf: z.string().trim().max(2),
  pix_chave: z.string().trim().max(77), pix_nome: z.string().trim().max(25), pix_cidade: z.string().trim().max(15),
  alcada: z.coerce.number().min(0),
  fundos: z.string().transform((x) => [...new Set(['Geral', ...x.split(',').map((f) => f.trim()).filter(Boolean)])]),
})

export async function salvarIgreja(_: Resultado, dados: FormData): Promise<Resultado> {
  const s = await sessao()
  const v = Igreja.safeParse(Object.fromEntries(dados))
  if (!v.success) return { erro: v.error.issues[0].message }
  const supabase = await supabaseServidor()
  const { error } = await supabase.from('igrejas').update({ ...v.data, uf: v.data.uf.toUpperCase() || null }).eq('id', s.igreja.id)
  if (error) return { erro: msgErro(error) }
  revalidatePath('/', 'layout')
  return { ok: 'Dados da igreja salvos.' }
}
