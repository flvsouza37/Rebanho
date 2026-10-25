import { supabaseServidor } from './supabase/server'
import type { Contexto, Diagnostico } from './estrategia'

// Diagnósticos da igreja (mais recente primeiro) e o que o resto do sistema sabe para os cruzamentos.
export async function carregarEstrategia(igreja: string, comDiagnosticos = true) {
  const supabase = await supabaseServidor()
  const conta = (st: string) => supabase.from('pessoas').select('*', { count: 'exact', head: true }).eq('igreja_id', igreja).eq('anonimizado', false).eq('status', st).then((r) => r.count ?? 0)
  const [dg, camps, res, membros, congregados, visitantes] = await Promise.all([
    comDiagnosticos ? supabase.from('diagnosticos').select('id, titulo, data, status, muda, diak').eq('igreja_id', igreja).order('data', { ascending: false }).order('criado_em', { ascending: false }) : Promise.resolve({ data: [] }),
    supabase.from('campanhas').select('id, titulo').eq('igreja_id', igreja),
    supabase.from('campanhas_resultado').select('id, visitantes, integrados').eq('igreja_id', igreja),
    conta('membro'), conta('congregado'), conta('visitante'),
  ])
  const r = new Map((res.data ?? []).map((x) => [x.id, x]))
  const ctx: Contexto = {
    campanhas: (camps.data ?? []).map((c) => ({ id: c.id, titulo: c.titulo, visitantes: Number(r.get(c.id)?.visitantes ?? 0), integrados: Number(r.get(c.id)?.integrados ?? 0) })),
    membros, congregados, visitantes,
  }
  const diags = (dg.data ?? []) as Diagnostico[]
  return { diags, atual: diags[0], anterior: diags[1], ctx }
}
