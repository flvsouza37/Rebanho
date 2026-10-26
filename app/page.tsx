import { redirect } from 'next/navigation'
import { sessao } from '@/lib/sessao'
import { inicioDo } from '@/lib/perfis'

export default async function Inicio() {
  const s = await sessao()
  redirect(inicioDo(s.papel, s.acessos))
}
