import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { supabaseServidor } from './supabase/server'
import { inicioDo, nivelOk, type Acessos, type Modulo, type Papel } from './perfis'

export type Igreja = { id: string; nome: string; cidade: string | null; uf: string | null; fundos: string[]; alcada: number }
export type Sessao = { userId: string; email: string; papel: Papel; acessos: Acessos; pessoaId: string | null; igreja: Igreja; outras: Igreja[] }

export const COOKIE_IGREJA = 'rebanho-igreja'

// Usuário logado, a igreja escolhida e o perfil nela. Sem igreja, vai para o cadastro inicial.
export const sessao = cache(async (): Promise<Sessao> => {
  const supabase = await supabaseServidor()
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) redirect('/entrar')
  const { data: vinc } = await supabase
    .from('vinculos')
    .select('papel, pessoa_id, igrejas(id, nome, cidade, uf, fundos, alcada)')
    .eq('user_id', u.user.id)
  const lista = (vinc ?? []).map((v) => ({ papel: v.papel as Papel, pessoaId: v.pessoa_id as string | null, igreja: v.igrejas as unknown as Igreja }))
  if (!lista.length) redirect('/comecar')
  const escolhida = (await cookies()).get(COOKIE_IGREJA)?.value
  const atual = lista.find((v) => v.igreja.id === escolhida) ?? lista[0]
  const { data: acessos } = await supabase.rpc('meus_acessos', { ig: atual.igreja.id })
  return {
    userId: u.user.id, email: u.user.email ?? '', papel: atual.papel, acessos: (acessos ?? {}) as Acessos, pessoaId: atual.pessoaId,
    igreja: { ...atual.igreja, alcada: Number(atual.igreja.alcada) },
    outras: lista.filter((v) => v !== atual).map((v) => v.igreja),
  }
})

export const pode = (s: Sessao, m: Modulo, n: 'ver' | 'editar' = 'ver') => s.papel === 'pastor' || nivelOk(s.acessos[m], n)

const fora = (s: Sessao) => redirect(inicioDo(s.papel, s.acessos))

// Exige o perfil (usado para o que só o pastor faz e para a área do membro).
export async function exigir(papeis: Papel[]) {
  const s = await sessao()
  if (!papeis.includes(s.papel)) fora(s)
  return s
}

// Exige o acesso a um módulo, do jeito que o pastor liberou. Com uma lista, basta um deles.
export async function exigirAcesso(m: Modulo | Modulo[], n: 'ver' | 'editar' = 'ver') {
  const s = await sessao()
  if (![m].flat().some((x) => pode(s, x, n))) fora(s)
  return s
}
