import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function supabaseServidor() {
  const loja = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => loja.getAll(),
        setAll(lista) {
          // Em Server Components não dá para gravar cookie; o proxy renova a sessão.
          try { lista.forEach(({ name, value, options }) => loja.set(name, value, options)) } catch {}
        },
      },
    },
  )
}
