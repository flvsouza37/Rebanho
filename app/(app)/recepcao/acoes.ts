'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from '@/lib/z'
import { exigirAcesso, pode } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { hoje, msgErro } from '@/lib/formato'
import type { Resultado } from '@/components/Formulario'

const Visita = z.object({
  nome: z.string().trim().min(2, 'Escreva seu nome.').max(120),
  telefone: z.string().trim().max(30).transform((x) => x || null),
  bairro: z.string().trim().max(80).transform((x) => x || null),
  como_conheceu: z.string().trim().max(80).transform((x) => x || null),
  oracao: z.string().trim().max(1000),
})
const digitos = (s: string | null) => (s ?? '').replace(/\D/g, '')

// Autocadastro no tablet da entrada. Se o telefone já existe, só marca a presença de hoje.
export async function registrarVisita(_: Resultado, dados: FormData): Promise<Resultado> {
  const s = await exigirAcesso('pessoas', 'editar')
  const v = Visita.safeParse(Object.fromEntries(dados))
  if (!v.success) return { erro: v.error.issues[0].message }
  const { oracao, ...p } = v.data
  const whats = dados.get('lgpd_whats') === 'on', imagem = dados.get('lgpd_imagem') === 'on'
  const supabase = await supabaseServidor()
  const tel = digitos(p.telefone).slice(-9)
  let id: string | null = null, voltou = false
  if (tel.length >= 8) {
    const { data: ps } = await supabase.from('pessoas').select('id, telefone, status, etapa').eq('igreja_id', s.igreja.id).eq('anonimizado', false).ilike('telefone', `%${tel.slice(-4)}%`)
    const achou = (ps ?? []).find((x) => digitos(x.telefone).slice(-9) === tel)
    if (achou) {
      id = achou.id; voltou = true
      const mud: Record<string, string> = { ultimo_contato: hoje() }
      if (achou.status === 'visitante' && (!achou.etapa || achou.etapa === 'Primeira visita')) mud.etapa = 'Voltou'
      await supabase.from('pessoas').update(mud).eq('id', id)
    }
  }
  if (!id) {
    const { data: nova, error } = await supabase.from('pessoas').insert({ ...p, igreja_id: s.igreja.id, status: 'visitante', etapa: 'Primeira visita', primeira_visita: hoje(), cidade: s.igreja.cidade }).select('id').single()
    if (error) return { erro: msgErro(error) }
    id = nova.id
  }
  if (whats || imagem) await supabase.rpc('registrar_consentimento', { p_pessoa: id, p_whats: whats, p_email: false, p_imagem: imagem })
  if (pode(s, 'radar', 'editar')) await supabase.from('presencas').upsert({ igreja_id: s.igreja.id, pessoa_id: id, data: hoje(), tipo: 'culto' }, { onConflict: 'pessoa_id,data,tipo', ignoreDuplicates: true })
  if (oracao.length >= 3) await supabase.from('ouvidoria').insert({ igreja_id: s.igreja.id, tipo: 'Pedido de cuidado', assunto: 'Pedido de oração na recepção', texto: oracao, autor_nome: p.nome, anonimo: false })
  revalidatePath('/pessoas')
  redirect(`/recepcao?ok=${encodeURIComponent(p.nome.split(' ')[0])}${voltou ? '&voltou=1' : ''}`)
}
