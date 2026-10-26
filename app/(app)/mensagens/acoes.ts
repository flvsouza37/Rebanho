'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from '@/lib/z'
import { exigirAcesso, pode } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { msgErro } from '@/lib/formato'
import { destinatarios } from '@/lib/comunicacao-dados'
import type { Resultado } from '@/components/Formulario'

const Msg = z.object({
  titulo: z.string().trim().max(120).transform((x) => x || null),
  texto: z.string().trim().min(3, 'Escreva a mensagem.').max(2000),
  publico: z.string().trim().min(2).max(80),
})

// Registra a mensagem e abre a tela de envio, com os links de cada pessoa.
export async function salvarMensagem(_: Resultado, dados: FormData): Promise<Resultado> {
  const s = await exigirAcesso('comunicacao', 'editar')
  const v = Msg.safeParse(Object.fromEntries(dados))
  if (!v.success) return { erro: v.error.issues[0].message }
  const canais = dados.getAll('canais').map(String).filter((c) => ['whatsapp', 'email', 'redes'].includes(c))
  if (!canais.length) return { erro: 'Escolha ao menos um canal.' }
  const ps = await destinatarios(s.igreja.id, v.data.publico, pode(s, 'radar'), pode(s, 'pastoral'))
  const supabase = await supabaseServidor()
  const { data, error } = await supabase.from('mensagens').insert({ ...v.data, canais, alcance: ps.length, igreja_id: s.igreja.id }).select('id').single()
  if (error) return { erro: msgErro(error) }
  revalidatePath('/mensagens')
  redirect('/mensagens/' + data.id)
}
