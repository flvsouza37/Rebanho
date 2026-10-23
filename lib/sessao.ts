import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { supabaseServidor } from './supabase/server'
import type { Papel } from './perfis'

export type Igreja = { id: string; nome: string; cidade: string | null; uf: string | null; fundos: string[]; alcada: number }
export type Sessao = { userId: string; email: string; papel: Papel; pessoaId: string | null; igreja: Igreja; outras: Igreja[] }

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
  return {
    userId: u.user.id, email: u.user.email ?? '', papel: atual.papel, pessoaId: atual.pessoaId,
    igreja: { ...atual.igreja, alcada: Number(atual.igreja.alcada) },
    outras: lista.filter((v) => v !== atual).map((v) => v.igreja),
  }
})

export async function exigir(papeis: Papel[]) {
  const s = await sessao()
  if (!papeis.includes(s.papel)) redirect(s.papel === 'membro' ? '/minha-area' : '/painel')
  return s
}
