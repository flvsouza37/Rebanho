'use client'
import { useState } from 'react'
import { supabaseNavegador } from '@/lib/supabase/client'
import { Marca } from '@/components/Marca'

// Login sem senha: a pessoa recebe um link por e-mail.
export default function Entrar() {
  const [email, setEmail] = useState('')
  const [estado, setEstado] = useState<'livre' | 'enviando' | 'enviado' | 'erro'>('livre')
  const [erro, setErro] = useState('')

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setEstado('enviando')
    const site = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
    const { error } = await supabaseNavegador().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${site}/auth/confirmar` },
    })
    if (error) { setErro(error.message); setEstado('erro') } else setEstado('enviado')
  }

  return (
    <main className="auth">
      <div className="card">
        <div className="marca"><Marca tamanho={34} /><b>Rebanho</b></div>
        {estado === 'enviado' ? (
          <>
            <h1>Confira seu e-mail</h1>
            <p className="muted">Mandamos um link de acesso para <b>{email}</b>. Abra no mesmo aparelho para entrar.</p>
            <button className="btn ghost" onClick={() => setEstado('livre')}>Usar outro e-mail</button>
          </>
        ) : (
          <form onSubmit={enviar} className="grid" style={{ gap: 14 }}>
            <h1>Entrar</h1>
            <p className="muted">Digite seu e-mail. Você recebe um link para entrar, sem precisar de senha.</p>
            <label className="f">E-mail
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {estado === 'erro' && <div className="erro" role="alert">{erro}</div>}
            <button className="btn" type="submit" disabled={estado === 'enviando'}>
              {estado === 'enviando' ? 'Enviando…' : 'Receber link de acesso'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
