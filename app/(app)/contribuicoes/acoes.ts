'use server'
import { revalidatePath } from 'next/cache'
import { sessao } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { msgErro, hoje } from '@/lib/formato'
import type { Resultado } from '@/components/Formulario'

// Cria a contribuição em aberto do mês para cada compromisso que ainda não tem.
export async function gerarMes(mes: string, _: Resultado): Promise<Resultado> {
  const s = await sessao()
  const supabase = await supabaseServidor()
  const [{ data: comps }, { data: ja }] = await Promise.all([
    supabase.from('compromissos').select('pessoa_id, tipo, valor, dia, pessoas!inner(status, anonimizado)').eq('igreja_id', s.igreja.id),
    supabase.from('contribuicoes').select('pessoa_id').eq('igreja_id', s.igreja.id).eq('competencia', mes),
  ])
  const tem = new Set((ja ?? []).map((c) => c.pessoa_id))
  const novas = (comps ?? [])
    .filter((c) => {
      const p = c.pessoas as unknown as { status: string; anonimizado: boolean }
      return !tem.has(c.pessoa_id) && !p.anonimizado && p.status !== 'transferido'
    })
    .map((c) => ({ igreja_id: s.igreja.id, pessoa_id: c.pessoa_id, competencia: mes, tipo: c.tipo, valor: c.valor, vencimento: `${mes}-${String(c.dia).padStart(2, '0')}` }))
  if (!novas.length) return { ok: 'Todos os compromissos deste mês já foram gerados.' }
  const { error } = await supabase.from('contribuicoes').insert(novas)
  if (error) return { erro: msgErro(error) }
  revalidatePath('/contribuicoes')
  return { ok: `${novas.length} contribuição(ões) gerada(s) para o mês.` }
}

export async function darBaixa(id: string, _: Resultado, dados: FormData): Promise<Resultado> {
  const supabase = await supabaseServidor()
  const { data, error } = await supabase.rpc('dar_baixa', {
    p_contrib: id, p_valor: Number(dados.get('valor')), p_data: String(dados.get('data') || hoje()),
    p_forma: String(dados.get('forma') || 'Pix'), p_fundo: String(dados.get('fundo') || 'Geral'),
  })
  if (error) return { erro: msgErro(error) }
  revalidatePath('/contribuicoes')
  return { ok: `Recebido. Recibo ${(data as { recibo: string }).recibo}.` }
}
