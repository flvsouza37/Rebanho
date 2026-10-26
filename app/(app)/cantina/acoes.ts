'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from '@/lib/z'
import { exigirAcesso } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { hoje, msgErro } from '@/lib/formato'
import type { Resultado } from '@/components/Formulario'

const atualizar = () => { ['/cantina', '/tesouraria', '/painel'].forEach((p) => revalidatePath(p)) }
const dinheiro = z.string().trim().transform((x) => Number(x.replace(/\./g, '').replace(',', '.') || 0))
const Produto = z.object({
  nome: z.string().trim().min(2, 'Informe o produto.').max(80),
  categoria: z.enum(['Salgados', 'Doces', 'Bebidas', 'Refeição', 'Outros']),
  preco: dinheiro.refine((x) => x > 0, 'Informe o preço de venda.'),
  custo: dinheiro.refine((x) => x >= 0, 'Custo inválido.'),
  estoque: z.coerce.number().int().min(0), estoque_min: z.coerce.number().int().min(0),
  ativo: z.string().optional().transform((x) => x === 'on'),
})

export async function salvarProduto(id: string | null, _: Resultado, dados: FormData): Promise<Resultado> {
  const s = await exigirAcesso('cantina', 'editar')
  const v = Produto.safeParse(Object.fromEntries(dados))
  if (!v.success) return { erro: v.error.issues[0].message }
  const supabase = await supabaseServidor()
  const { error } = id ? await supabase.from('produtos').update(v.data).eq('id', id) : await supabase.from('produtos').insert({ ...v.data, igreja_id: s.igreja.id })
  if (error) return { erro: msgErro(error) }
  atualizar()
  redirect('/cantina?aba=estoque')
}

export async function repor(id: string) {
  await exigirAcesso('cantina', 'editar')
  const supabase = await supabaseServidor()
  const { data: p } = await supabase.from('produtos').select('estoque').eq('id', id).maybeSingle()
  if (p) await supabase.from('produtos').update({ estoque: p.estoque + 10 }).eq('id', id)
  atualizar()
  redirect('/cantina?aba=estoque')
}

export async function abrirCaixa(_: Resultado, dados: FormData): Promise<Resultado> {
  const s = await exigirAcesso('cantina', 'editar')
  const troco = Number(String(dados.get('troco') || 0).replace(',', '.'))
  const evento = String(dados.get('evento') || '') || null
  if (!Number.isFinite(troco) || troco < 0) return { erro: 'Troco inválido.' }
  const supabase = await supabaseServidor()
  const { error } = await supabase.from('caixas').insert({ igreja_id: s.igreja.id, data: hoje(), troco, evento_id: evento })
  if (error) return { erro: error.code === '23505' ? 'Já existe um caixa aberto.' : msgErro(error) }
  atualizar()
  redirect('/cantina')
}

// O preço e o estoque são conferidos no banco (função vender).
export async function vender(caixa: string, itens: { id: string; qtd: number }[], forma: string): Promise<Resultado> {
  await exigirAcesso('cantina', 'editar')
  const supabase = await supabaseServidor()
  const { error } = await supabase.rpc('vender', { p_caixa: caixa, p_itens: itens, p_forma: forma })
  if (error) return { erro: msgErro(error) }
  revalidatePath('/cantina')
  return { ok: 'Venda registrada.' }
}

export async function fecharCaixa(caixa: string) {
  await exigirAcesso('cantina', 'editar')
  const supabase = await supabaseServidor()
  const { error } = await supabase.rpc('fechar_caixa', { p_caixa: caixa, p_data: hoje() })
  atualizar()
  redirect('/cantina?aba=caixas' + (error ? '&erro=' + encodeURIComponent(msgErro(error)) : ''))
}
