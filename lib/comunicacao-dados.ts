// Comunicação: consultas do servidor (quem recebe e quais públicos existem).
import { supabaseServidor } from '@/lib/supabase/server'
import { carregarRadar } from '@/lib/radar'
import { PUBLICOS_FIXOS } from '@/lib/comunicacao'

type Pessoa = { id: string; nome: string; status: string; telefone: string | null; email: string | null; lgpd_whats: boolean; lgpd_email: boolean; grupo: string | null; lider: boolean }

// Quem recebe a mensagem. Só pessoas ativas; o consentimento por canal é conferido na hora de montar os links.
export async function destinatarios(igreja: string, publico: string, comRadar: boolean, comPastoral: boolean): Promise<Pessoa[]> {
  const supabase = await supabaseServidor()
  const { data } = await supabase.from('pessoas').select('id, nome, status, telefone, email, lgpd_whats, lgpd_email, grupo, lider')
    .eq('igreja_id', igreja).eq('anonimizado', false).in('status', ['membro', 'congregado', 'visitante', 'afastado']).order('nome')
  const ps = (data ?? []) as Pessoa[]
  if (publico === 'Toda a igreja') return ps
  if (publico === 'Membros') return ps.filter((p) => p.status === 'membro' || p.status === 'congregado')
  if (publico === 'Visitantes') return ps.filter((p) => p.status === 'visitante')
  if (publico === 'Liderança') return ps.filter((p) => p.lider)
  if (publico === 'Pessoas em risco (radar)') {
    if (!comRadar) return []
    const r = await carregarRadar(igreja, comPastoral), ids = new Set(r.aCuidar.map((x) => x.id))
    return ps.filter((p) => ids.has(p.id))
  }
  if (publico.startsWith('Célula ')) return ps.filter((p) => p.grupo === publico.slice(7))
  return []
}

export async function publicos(igreja: string) {
  const supabase = await supabaseServidor()
  const { data } = await supabase.from('pessoas').select('grupo').eq('igreja_id', igreja).eq('anonimizado', false).not('grupo', 'is', null)
  return [...PUBLICOS_FIXOS, ...[...new Set((data ?? []).map((p) => p.grupo as string))].sort().map((g) => 'Célula ' + g)]
}
