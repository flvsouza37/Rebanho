'use server'
import { revalidatePath } from 'next/cache'
import { exigirAcesso } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { msgErro } from '@/lib/formato'
import { CAT_S } from '@/lib/categorias'
import type { Resultado } from '@/components/Formulario'

const valor = (x: FormDataEntryValue | null) => Number(String(x ?? '').replace(/\./g, '').replace(',', '.') || 0)

// Grava o orçado de cada categoria de saída para o ano.
export async function salvarOrcamento(ano: number, _: Resultado, dados: FormData): Promise<Resultado> {
  const s = await exigirAcesso('financeiro', 'editar')
  const linhas = CAT_S.map((categoria, i) => ({ igreja_id: s.igreja.id, ano, categoria, valor: valor(dados.get('c' + i)) }))
  if (linhas.some((l) => !Number.isFinite(l.valor) || l.valor < 0)) return { erro: 'Valores inválidos.' }
  const supabase = await supabaseServidor()
  const { error } = await supabase.from('orcamentos').upsert(linhas, { onConflict: 'igreja_id,ano,categoria' })
  if (error) return { erro: msgErro(error) }
  revalidatePath('/tesouraria/orcamento')
  return { ok: `Orçamento de ${ano} salvo.` }
}
