'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { exigir, exigirAcesso } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { STATUS_PLANO } from '@/lib/patrimonio'

const atualizar = () => { ['/manutencao', '/planos', '/kanban', '/painel', '/cargos'].forEach((p) => revalidatePath(p)) }

export async function atualizarPlano(id: string, dados: FormData) {
  await exigirAcesso('patrimonio', 'editar')
  const status = String(dados.get('status') || ''), quem = String(dados.get('quem') || '')
  const mud: Record<string, string | null> = {}
  if ((STATUS_PLANO as readonly string[]).includes(status)) mud.status = status
  if (dados.has('quem')) mud.quem = quem || null
  const supabase = await supabaseServidor()
  if (Object.keys(mud).length) await supabase.from('planos').update(mud).eq('id', id)
  atualizar()
  redirect('/planos#pl-' + id)
}

export async function excluirPlano(id: string) {
  await exigir(['pastor'])
  const supabase = await supabaseServidor()
  await supabase.from('planos').delete().eq('id', id)
  atualizar()
  redirect('/planos')
}
