'use server'
import { revalidatePath } from 'next/cache'
import { sessao } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { msgErro } from '@/lib/formato'
import type { Resultado } from '@/components/Formulario'

export async function darAcesso(_: Resultado, dados: FormData): Promise<Resultado> {
  const s = await sessao()
  const supabase = await supabaseServidor()
  const { error } = await supabase.rpc('adicionar_acesso', {
    ig: s.igreja.id, p_email: String(dados.get('email') || ''), p_papel: String(dados.get('papel') || 'lider'),
    p_pessoa: String(dados.get('pessoa_id') || '') || null,
  })
  if (error) return { erro: msgErro(error) }
  revalidatePath('/equipe')
  return { ok: 'Acesso liberado. A pessoa já pode entrar.' }
}

export async function removerAcesso(userId: string) {
  const s = await sessao()
  const supabase = await supabaseServidor()
  await supabase.from('vinculos').delete().eq('igreja_id', s.igreja.id).eq('user_id', userId)
  revalidatePath('/equipe')
}
