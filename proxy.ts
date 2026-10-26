import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLICAS = ['/entrar', '/auth', '/site']

// Renova a sessão do Supabase a cada pedido e manda para o login quem não entrou.
export async function proxy(request: NextRequest) {
  let resposta = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(lista, cabecalhos) {
          lista.forEach(({ name, value }) => request.cookies.set(name, value))
          resposta = NextResponse.next({ request })
          lista.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options))
          Object.entries(cabecalhos ?? {}).forEach(([k, v]) => resposta.headers.set(k, v))
        },
      },
    },
  )
  const { data } = await supabase.auth.getClaims()
  const caminho = request.nextUrl.pathname
  if (!data?.claims && !PUBLICAS.some((p) => caminho.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = '/entrar'
    url.search = ''
    return NextResponse.redirect(url)
  }
  return resposta
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|.*\\.(?:svg|png|jpg|webp)$).*)'],
}
