'use client'
import { useActionState } from 'react'

export type Resultado = { erro?: string; ok?: string } | null
type Acao = (antes: Resultado, dados: FormData) => Promise<Resultado>

// Formulário ligado a uma server action: mostra o erro que o banco devolver.
export function Formulario({ acao, children, enviar = 'Salvar', className = 'form', extra }: {
  acao: Acao; children: React.ReactNode; enviar?: string; className?: string; extra?: React.ReactNode
}) {
  const [res, executar, pendente] = useActionState(acao, null)
  return (
    <form action={executar} className={className}>
      {children}
      {res?.erro && <div className="erro full" role="alert">{res.erro}</div>}
      {res?.ok && <div className="sucesso full" role="status">{res.ok}</div>}
      <div className="row full">
        <button className="btn" type="submit" disabled={pendente}>{pendente ? 'Salvando…' : enviar}</button>
        {extra}
      </div>
    </form>
  )
}
