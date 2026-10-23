'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { COOKIE_IGREJA } from '@/lib/sessao'

export async function trocarIgreja(dados: FormData) {
  const id = String(dados.get('igreja') || '')
  if (id) (await cookies()).set(COOKIE_IGREJA, id, { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 24 * 365 })
  redirect('/')
}
