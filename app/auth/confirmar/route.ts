import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { supabaseServidor } from '@/lib/supabase/server'

// Destino do link enviado por e-mail: troca o código pela sessão.
export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const supabase = await supabaseServidor()
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error('Link inválido') }
  return NextResponse.redirect(new URL(error ? '/entrar?erro=link' : '/', url.origin))
}
