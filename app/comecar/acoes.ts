'use server'
import { redirect } from 'next/navigation'
import { z } from '@/lib/z'
import { supabaseServidor } from '@/lib/supabase/server'
import { msgErro } from '@/lib/formato'
import type { Resultado } from '@/components/Formulario'

const Esquema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome da igreja.').max(120),
  cidade: z.string().trim().max(80).optional(),
  uf: z.string().trim().max(2).optional(),
})

export async function criarIgreja(_: Resultado, dados: FormData): Promise<Resultado> {
  const v = Esquema.safeParse(Object.fromEntries(dados))
  if (!v.success) return { erro: v.error.issues[0].message }
  const supabase = await supabaseServidor()
  const { error } = await supabase.rpc('criar_igreja', { p_nome: v.data.nome, p_cidade: v.data.cidade || null, p_uf: v.data.uf || null })
  if (error) return { erro: msgErro(error) }
  redirect('/painel')
}
