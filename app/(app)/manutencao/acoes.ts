'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from '@/lib/z'
import { exigirAcesso } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { hoje, msgErro } from '@/lib/formato'
import { AMBN, COMO, DISC, gut, respPor, type Agenda, type Ameaca, type Cargo } from '@/lib/patrimonio'
import type { Resultado } from '@/components/Formulario'

const atualizar = () => { ['/manutencao', '/planos', '/kanban', '/painel', '/cargos'].forEach((p) => revalidatePath(p)) }
const nota = z.coerce.number().int().min(1).max(5)
const Ameaca = z.object({
  titulo: z.string().trim().min(3, 'Descreva a ameaça.').max(160),
  descricao: z.string().trim().max(1000).transform((x) => x || null),
  ambiente: z.string().refine((x) => !!AMBN[x], 'Escolha o ambiente.'),
  disciplina: z.string().refine((x) => DISC.includes(x), 'Escolha a disciplina.'),
  g: nota, u: nota, t: nota,
  custo: z.string().trim().transform((x) => Number(x.replace(/\./g, '').replace(',', '.') || 0)).refine((x) => Number.isFinite(x) && x >= 0, 'Custo inválido.'),
  origem: z.string().trim().max(80).transform((x) => x || null),
})

export async function salvarAmeaca(id: string | null, _: Resultado, dados: FormData): Promise<Resultado> {
  const s = await exigirAcesso('patrimonio', 'editar')
  const v = Ameaca.safeParse(Object.fromEntries(dados))
  if (!v.success) return { erro: v.error.issues[0].message }
  const supabase = await supabaseServidor()
  const { data, error } = id
    ? await supabase.from('ameacas').update(v.data).eq('id', id).select('id').single()
    : await supabase.from('ameacas').insert({ ...v.data, igreja_id: s.igreja.id, data: hoje() }).select('id').single()
  if (error) return { erro: msgErro(error) }
  atualizar()
  redirect('/manutencao#am-' + data.id)
}

export async function resolverAmeaca(id: string) {
  await exigirAcesso('patrimonio', 'editar')
  const supabase = await supabaseServidor()
  await supabase.from('ameacas').update({ status: 'resolvida' }).eq('id', id).is('plano_id', null)
  atualizar()
  redirect('/manutencao')
}

// Gera o 5W2H de uma ameaça (ou dela com as correlatas): prazo pelo grau, "quem" pela matriz de cargos,
// aprovação pela alçada da igreja.
export async function gerarPlano(ids: string[]) {
  const s = await exigirAcesso('patrimonio', 'editar')
  const supabase = await supabaseServidor()
  const [{ data: abertas }, { data: cargos }, { data: ev }] = await Promise.all([
    supabase.from('ameacas').select('*').eq('igreja_id', s.igreja.id).neq('status', 'resolvida'),
    supabase.from('cargos').select('id, titulo, nome, pessoa_id, areas').eq('igreja_id', s.igreja.id),
    supabase.from('eventos').select('titulo, data, ambiente').eq('igreja_id', s.igreja.id).gte('data', hoje()).not('ambiente', 'is', null),
  ])
  const todas = (abertas ?? []) as Ameaca[], cs = (cargos ?? []) as Cargo[]
  const lista = ids.map((id) => todas.find((a) => a.id === id && a.status === 'aberta')).filter((a): a is Ameaca => !!a)
  if (!lista.length) redirect('/manutencao')
  const rs = lista.map((a) => gut(a, todas, (ev ?? []) as Agenda[])), top = rs.reduce((m, r) => (r.score > m.score ? r : m), rs[0])
  const princ = lista[rs.indexOf(top)], discs = [...new Set(lista.map((a) => a.disciplina))]
  const custo = lista.reduce((t, a) => t + Number(a.custo), 0)
  const quem = respPor(cs, princ.disciplina) ?? respPor(cs, 'Patrimônio')
  const aprova = custo > s.igreja.alcada ? respPor(cs, 'Tesouraria') : respPor(cs, 'Patrimônio')
  const { data: plano, error } = await supabase.from('planos').insert({
    igreja_id: s.igreja.id,
    oque: (lista.length > 1 ? 'Correção integrada: ' + lista.map((a) => a.titulo).join(' + ') : 'Corrigir: ' + princ.titulo).slice(0, 300),
    porque: top.porque.length ? `GUT ${top.base} elevado a ${top.score} por correlação: ${top.porque.map((w) => w[0].toLowerCase()).join('; ')}.` : `GUT ${top.base} sem correlações agravantes.`,
    onde: [...new Set(lista.map((a) => AMBN[a.ambiente]?.nome ?? a.ambiente))].join(', '),
    quando: new Date(Date.now() + top.grau.dias * 864e5).toLocaleDateString('sv-SE'),
    quem: quem?.id ?? null, aprova: aprova?.id ?? null,
    como: discs.map((d) => COMO[d]).join(' '), quanto: custo, grau: top.grau.k, score: top.score,
  }).select('id').single()
  if (error) redirect('/manutencao?erro=' + encodeURIComponent(msgErro(error)))
  await supabase.from('ameacas').update({ status: 'em plano', plano_id: plano.id }).in('id', lista.map((a) => a.id))
  atualizar()
  redirect('/planos#pl-' + plano.id)
}

const Prev = z.object({
  item: z.string().trim().min(3, 'Descreva o item.').max(120), norma: z.string().trim().max(120).transform((x) => x || null),
  ambiente: z.string().refine((x) => !!AMBN[x], 'Escolha o ambiente.'), disciplina: z.string().refine((x) => DISC.includes(x), 'Escolha a disciplina.'),
  meses: z.coerce.number().int().min(1).max(120), ultima: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a última execução.'),
})
export async function salvarPreventiva(_: Resultado, dados: FormData): Promise<Resultado> {
  const s = await exigirAcesso('patrimonio', 'editar')
  const v = Prev.safeParse(Object.fromEntries(dados))
  if (!v.success) return { erro: v.error.issues[0].message }
  const supabase = await supabaseServidor()
  const { error } = await supabase.from('preventivas').insert({ ...v.data, igreja_id: s.igreja.id })
  if (error) return { erro: msgErro(error) }
  atualizar()
  redirect('/manutencao#preventivas')
}

export async function preventivaFeita(id: string) {
  await exigirAcesso('patrimonio', 'editar')
  const supabase = await supabaseServidor()
  await supabase.from('preventivas').update({ ultima: hoje() }).eq('id', id)
  atualizar()
  redirect('/manutencao#preventivas')
}

export async function excluirPreventiva(id: string) {
  await exigirAcesso('patrimonio', 'editar')
  const supabase = await supabaseServidor()
  await supabase.from('preventivas').delete().eq('id', id)
  atualizar()
  redirect('/manutencao#preventivas')
}

// Preventiva vencida vira ameaça no GUT, já com urgência alta.
export async function preventivaNoGut(id: string) {
  const s = await exigirAcesso('patrimonio', 'editar')
  const supabase = await supabaseServidor()
  const { data: p } = await supabase.from('preventivas').select('*').eq('id', id).maybeSingle()
  if (!p) redirect('/manutencao')
  const { data: a } = await supabase.from('ameacas').insert({
    igreja_id: s.igreja.id, titulo: 'Preventiva vencida: ' + p.item, descricao: p.norma ? 'Exigência: ' + p.norma : null,
    ambiente: p.ambiente, disciplina: p.disciplina, g: p.disciplina === 'Incêndio e segurança' ? 5 : 3, u: 4, t: 3, origem: 'Preventiva', data: hoje(),
  }).select('id').single()
  atualizar()
  redirect('/manutencao' + (a ? '#am-' + a.id : ''))
}
