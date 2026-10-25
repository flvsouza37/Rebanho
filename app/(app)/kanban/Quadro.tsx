'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { moverCartao } from './acoes'

// Arrastar e soltar entre colunas. Os botões de cada cartão continuam funcionando sem isso.
export function Quadro({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [erro, setErro] = useState('')
  const [pendente, iniciar] = useTransition()
  const [arrastando, setArrastando] = useState<string | null>(null)
  const sobre = (e: React.DragEvent) => {
    const col = (e.target as HTMLElement).closest('[data-kcol]')
    document.querySelectorAll('.kcol.over').forEach((x) => x !== col && x.classList.remove('over'))
    if (col && arrastando) { e.preventDefault(); col.classList.add('over') }
  }
  return (
    <>
      {erro && <div className="erro" role="alert">{erro}</div>}
      <div className={`kanban${pendente ? ' salvando' : ''}`}
        onDragStart={(e) => { const c = (e.target as HTMLElement).closest('[data-kcard]') as HTMLElement | null; if (!c) return; setArrastando(c.dataset.kcard!); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', c.dataset.kcard!) }}
        onDragEnd={() => { setArrastando(null); document.querySelectorAll('.kcol.over').forEach((x) => x.classList.remove('over')) }}
        onDragOver={sobre}
        onDrop={(e) => {
          const col = (e.target as HTMLElement).closest('[data-kcol]') as HTMLElement | null
          document.querySelectorAll('.kcol.over').forEach((x) => x.classList.remove('over'))
          const id = arrastando; setArrastando(null)
          if (!col || !id) return
          e.preventDefault()
          const atual = document.querySelector(`[data-kcard="${CSS.escape(id)}"]`)?.closest('[data-kcol]') as HTMLElement | null
          if (atual?.dataset.kcol === col.dataset.kcol) return
          iniciar(async () => {
            const r = await moverCartao(id, col.dataset.kcol!)
            if (r.ir) { router.push(r.ir); return }
            setErro(r.erro ?? '')
            router.refresh()
          })
        }}>
        {children}
      </div>
    </>
  )
}
