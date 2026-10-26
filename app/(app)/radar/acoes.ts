'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from '@/lib/z'
import { exigirAcesso } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { hoje, msgErro } from '@/lib/formato'
import type { Resultado } from '@/components/Formulario'

const atualizar = () => { revalidatePath('/radar'); revalidatePath('/radar/chamada'); revalidatePath('/painel') }

const Contato = z.object({ forma: z.enum(['Ligação', 'Mensagem', 'Visita', 'Encontro']), nota: z.string().trim().max(300).transform((x) => x || null) })
export async function registrarContato(pessoa: string, _: Resultado, dados: FormData): Promise<Resultado> {
  const s = await exigirAcesso('radar', 'editar')
  const v = Contato.safeParse(Object.fromEntries(dados))
  if (!v.success) return { erro: v.error.issues[0].message }
  const supabase = await supabaseServidor()
  const { error } = await supabase.from('cuidados').insert({ igreja_id: s.igreja.id, pessoa_id: pessoa, data: hoje(), ...v.data })
  if (error) return { erro: msgErro(error) }
  // o contato também conta como último contato na ficha (se a pessoa puder editar fichas)
  await supabase.from('pessoas').update({ ultimo_contato: hoje() }).eq('id', pessoa)
  atualizar()
  redirect('/radar#cuidado')
}

// Chamada: grava quem veio e apaga quem foi desmarcado naquele dia.
export async function salvarChamada(_: Resultado, dados: FormData): Promise<Resultado> {
  const s = await exigirAcesso('radar', 'editar')
  const data = String(dados.get('data') || ''), tipo = String(dados.get('tipo') || 'culto')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data > hoje()) return { erro: 'Escolha uma data até hoje.' }
  if (tipo !== 'culto' && tipo !== 'celula') return { erro: 'Tipo inválido.' }
  const marcados = new Set(dados.getAll('p').map(String)), lista = dados.getAll('todos').map(String)
  const supabase = await supabaseServidor()
  const novos = lista.filter((id) => marcados.has(id)).map((id) => ({ igreja_id: s.igreja.id, pessoa_id: id, data, tipo }))
  const fora = lista.filter((id) => !marcados.has(id))
  if (novos.length) {
    const { error } = await supabase.from('presencas').upsert(novos, { onConflict: 'pessoa_id,data,tipo', ignoreDuplicates: true })
    if (error) return { erro: msgErro(error) }
  }
  if (fora.length) await supabase.from('presencas').delete().eq('igreja_id', s.igreja.id).eq('data', data).eq('tipo', tipo).in('pessoa_id', fora)
  atualizar()
  return { ok: `Chamada salva: ${novos.length} presente(s) em ${data.split('-').reverse().join('/')}.` }
}
