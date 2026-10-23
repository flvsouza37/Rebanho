'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from '@/lib/z'
import { sessao } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { msgErro, hoje } from '@/lib/formato'
import type { Resultado } from '@/components/Formulario'

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).transform((x) => x || null)
const texto = (max = 200) => z.string().trim().max(max).transform((x) => x || null)

const Pessoa = z.object({
  nome: z.string().trim().min(2, 'Informe o nome.').max(120),
  status: z.enum(['visitante', 'congregado', 'membro', 'afastado', 'transferido']),
  etapa: texto(60), telefone: texto(30), email: z.string().trim().email('E-mail inválido.').or(z.literal('')).transform((x) => x || null),
  nascimento: data, familia: texto(80), endereco: texto(200), bairro: texto(80), cidade: texto(80), grupo: texto(80),
  ministerios: z.string().max(300).transform((x) => x.split(',').map((m) => m.trim()).filter(Boolean)),
  primeira_visita: data, ultimo_contato: data, como_conheceu: texto(80), acompanhante: texto(80), batismo: data, membro_desde: data,
  lider: z.literal('on').optional().transform((x) => x === 'on'),
})

const digitos = (s: string | null) => (s ?? '').replace(/\D/g, '')
const limpar = (s: string) => s.replace(/["\\%_,()]/g, ' ')

export async function salvarPessoa(id: string | null, _: Resultado, dados: FormData): Promise<Resultado> {
  const s = await sessao()
  const v = Pessoa.safeParse(Object.fromEntries(dados))
  if (!v.success) return { erro: v.error.issues[0].message }
  const supabase = await supabaseServidor()
  const p = v.data

  if (!id && dados.get('mesmo_assim') !== 'on') {
    // Aviso de cadastro duplicado por telefone, e-mail ou nome igual.
    const { data: parecidas } = await supabase.from('pessoas').select('id, nome, telefone, email')
      .eq('igreja_id', s.igreja.id).eq('anonimizado', false)
      .or([`nome.ilike."${limpar(p.nome)}"`, p.email && `email.ilike."${limpar(p.email)}"`, digitos(p.telefone).length >= 8 && `telefone.ilike."%${digitos(p.telefone).slice(-4)}%"`].filter(Boolean).join(','))
      .limit(20)
    const tel = digitos(p.telefone).slice(-9)
    const igual = (parecidas ?? []).find((x) =>
      x.nome.trim().toLowerCase() === p.nome.toLowerCase() || (p.email && x.email?.toLowerCase() === p.email.toLowerCase())
      || (tel.length >= 8 && digitos(x.telefone).slice(-9) === tel))
    if (igual) return { erro: `Já existe o cadastro de ${igual.nome} com dados parecidos. Abra a ficha existente ou marque “cadastrar mesmo assim”.` }
  }

  if (id) {
    const { data: antes } = await supabase.from('pessoas').select('status, congregado_em').eq('id', id).single()
    const extra = antes?.status === 'visitante' && p.status === 'congregado' && !antes.congregado_em ? { congregado_em: hoje() } : {}
    const { error } = await supabase.from('pessoas').update({ ...p, ...extra }).eq('id', id)
    if (error) return { erro: msgErro(error) }
  } else {
    const { data: nova, error } = await supabase.from('pessoas').insert({ ...p, igreja_id: s.igreja.id }).select('id').single()
    if (error) return { erro: msgErro(error) }
    id = nova.id
  }
  revalidatePath('/pessoas')
  redirect(`/pessoas/${id}`)
}

export async function salvarConsentimento(id: string, _: Resultado, dados: FormData): Promise<Resultado> {
  const supabase = await supabaseServidor()
  const { error } = await supabase.rpc('registrar_consentimento', {
    p_pessoa: id, p_whats: dados.get('whats') === 'on', p_email: dados.get('email') === 'on', p_imagem: dados.get('imagem') === 'on',
  })
  if (error) return { erro: msgErro(error) }
  revalidatePath(`/pessoas/${id}`)
  return { ok: 'Consentimento registrado com a versão atual do termo.' }
}

export async function salvarPastoral(id: string, _: Resultado, dados: FormData): Promise<Resultado> {
  const s = await sessao()
  const supabase = await supabaseServidor()
  const { error } = await supabase.from('pessoas_pastoral').upsert({
    pessoa_id: id, igreja_id: s.igreja.id,
    observacao: String(dados.get('observacao') || '').slice(0, 4000) || null,
    evento_vida: String(dados.get('evento_vida') || '').slice(0, 200) || null,
  })
  if (error) return { erro: msgErro(error) }
  return { ok: 'Observação salva. Só o pastor vê.' }
}

const Compromisso = z.object({
  tipo: z.string().trim().min(2).max(40), valor: z.coerce.number().positive('Informe o valor.'),
  dia: z.coerce.number().int().min(1).max(28), forma: z.string().trim().max(30),
})

export async function salvarCompromisso(id: string, _: Resultado, dados: FormData): Promise<Resultado> {
  const s = await sessao()
  const supabase = await supabaseServidor()
  if (dados.get('remover') === 'on') {
    const { error } = await supabase.from('compromissos').delete().eq('pessoa_id', id)
    return error ? { erro: msgErro(error) } : { ok: 'Compromisso removido.' }
  }
  const v = Compromisso.safeParse(Object.fromEntries(dados))
  if (!v.success) return { erro: v.error.issues[0].message }
  const { error } = await supabase.from('compromissos').upsert({ ...v.data, pessoa_id: id, igreja_id: s.igreja.id })
  if (error) return { erro: msgErro(error) }
  revalidatePath(`/pessoas/${id}`)
  return { ok: 'Compromisso salvo.' }
}

export async function anonimizarPessoa(id: string, _: Resultado, dados: FormData): Promise<Resultado> {
  if (dados.get('confirmo') !== 'on') return { erro: 'Marque a confirmação. Esta ação não pode ser desfeita.' }
  const supabase = await supabaseServidor()
  const { error } = await supabase.rpc('anonimizar', { p_pessoa: id })
  if (error) return { erro: msgErro(error) }
  revalidatePath(`/pessoas/${id}`)
  return { ok: 'Dados pessoais removidos. O histórico financeiro continua, sem o nome.' }
}
