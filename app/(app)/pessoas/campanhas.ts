import { supabaseServidor } from '@/lib/supabase/server'
import type { OpcaoCampanha } from './CamposPessoa'

// Campanhas que podem ser origem de um visitante: as não encerradas e a já escolhida.
export async function campanhasAbertas(igreja: string, atual?: string | null): Promise<OpcaoCampanha[]> {
  const supabase = await supabaseServidor()
  const { data } = await supabase.from('campanhas').select('id, titulo, status').eq('igreja_id', igreja).order('criado_em', { ascending: false })
  return (data ?? []).filter((c) => c.status !== 'Encerrada' || c.id === atual).map(({ id, titulo }) => ({ id, titulo }))
}
