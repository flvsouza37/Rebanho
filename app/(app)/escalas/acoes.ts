'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { exigirAcesso, sessao } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { msgErro } from '@/lib/formato'
import { domingos } from './dados'

const atualizar = () => { ['/escalas', '/minha-area', '/painel'].forEach((p) => revalidatePath(p)) }
const voltar = (erro?: string) => redirect('/escalas' + (erro ? '?erro=' + encodeURIComponent(erro) : ''))

// Rodízio: para cada domingo e ministério, completa as vagas com quem serviu menos nos últimos 90 dias
// e não está escalado em outro ministério no mesmo dia.
export async function gerarEscalas(dados: FormData) {
  const s = await exigirAcesso('escalas', 'editar')
  const semanas = Math.min(8, Math.max(1, Number(dados.get('semanas')) || 4)), vagas = Math.min(5, Math.max(1, Number(dados.get('vagas')) || 1))
  const supabase = await supabaseServidor()
  const ds = domingos(semanas), desde = new Date(Date.now() - 90 * 864e5).toLocaleDateString('sv-SE')
  const [{ data: ps }, { data: ex }] = await Promise.all([
    supabase.from('pessoas').select('id, nome, ministerios').eq('igreja_id', s.igreja.id).eq('anonimizado', false).in('status', ['membro', 'congregado']),
    supabase.from('escalas').select('data, ministerio, pessoa_id').eq('igreja_id', s.igreja.id).gte('data', desde),
  ])
  const pessoas = ps ?? [], escalas = [...(ex ?? [])]
  const mins = [...new Set(pessoas.flatMap((p) => p.ministerios as string[]))].sort()
  const carga = (id: string) => escalas.filter((e) => e.pessoa_id === id).length
  const novas: { igreja_id: string; data: string; ministerio: string; pessoa_id: string }[] = []
  for (const d of ds) for (const m of mins) {
    let ja = escalas.filter((e) => e.data === d && e.ministerio === m).length
    const aptos = pessoas.filter((p) => (p.ministerios as string[]).includes(m) && !escalas.some((e) => e.data === d && e.pessoa_id === p.id))
      .sort((a, b) => carga(a.id) - carga(b.id) || a.nome.localeCompare(b.nome))
    for (const p of aptos) {
      if (ja >= vagas) break
      const e = { igreja_id: s.igreja.id, data: d, ministerio: m, pessoa_id: p.id }
      novas.push(e); escalas.push(e); ja++
    }
  }
  if (!mins.length) voltar('Ninguém tem ministério na ficha. Preencha o campo Ministérios no cadastro de quem serve.')
  if (novas.length) {
    const { error } = await supabase.from('escalas').insert(novas)
    if (error) voltar(msgErro(error))
  }
  atualizar()
  voltar()
}

export async function escalar(dados: FormData) {
  const s = await exigirAcesso('escalas', 'editar')
  const data = String(dados.get('data') || ''), ministerio = String(dados.get('ministerio') || '').trim(), pessoa = String(dados.get('pessoa') || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || ministerio.length < 2 || !pessoa) voltar('Preencha data, ministério e pessoa.')
  const supabase = await supabaseServidor()
  const { error } = await supabase.from('escalas').insert({ igreja_id: s.igreja.id, data, ministerio, pessoa_id: pessoa })
  atualizar()
  voltar(error ? (error.code === '23505' ? 'Essa pessoa já está nesse ministério nesse dia.' : msgErro(error)) : undefined)
}

export async function substituir(id: string, dados: FormData) {
  await exigirAcesso('escalas', 'editar')
  const pessoa = String(dados.get('pessoa') || '')
  if (!pessoa) voltar()
  const supabase = await supabaseServidor()
  const { error } = await supabase.from('escalas').update({ pessoa_id: pessoa, status: 'pendente' }).eq('id', id)
  atualizar()
  voltar(error ? msgErro(error) : undefined)
}

export async function removerEscala(id: string) {
  await exigirAcesso('escalas', 'editar')
  const supabase = await supabaseServidor()
  await supabase.from('escalas').delete().eq('id', id)
  atualizar()
  voltar()
}

// Usada pela equipe e pelo próprio membro (a função do banco confere quem é).
export async function responderEscala(id: string, status: 'confirmado' | 'troca', volta: string) {
  await sessao()
  const supabase = await supabaseServidor()
  const { error } = await supabase.rpc('responder_escala', { p_escala: id, p_status: status })
  atualizar()
  redirect(volta + (error ? '?erro=' + encodeURIComponent(msgErro(error)) : ''))
}
