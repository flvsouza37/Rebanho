'use client'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { MENU, vePagina, type Acessos, type Papel } from '@/lib/perfis'

// Grupos recolhíveis: um aberto por vez; o grupo da tela atual abre sozinho.
export function Menu({ papel, acessos, temFicha }: { papel: Papel; acessos: Acessos; temFicha: boolean }) {
  const caminho = usePathname()
  const busca = useSearchParams()
  const atual = caminho + (busca.toString() ? '?' + busca.toString() : '')
  const grupos = MENU.map((g) => ({ ...g, itens: g.itens.filter((i) => vePagina(i, papel, acessos, temFicha)) })).filter((g) => g.itens.length)
  const casa = (href: string) => {
    const [p, q] = href.split('?')
    return q ? atual === href || (caminho.startsWith(p) && busca.toString() === q) : caminho === p || caminho.startsWith(p + '/')
  }
  // Só o item mais específico fica marcado (/radar/chamada não acende /radar).
  const todos = grupos.flatMap((g) => g.itens.map((i) => i.href)).filter(casa)
  const ativo = (href: string) => casa(href) && !todos.some((h) => h !== href && h.split('?')[0].startsWith(href.split('?')[0] + '/'))
  const doAtual = grupos.find((g) => g.itens.some((i) => ativo(i.href)))?.grupo ?? null
  const [aberto, setAberto] = useState<string | null>(doAtual)
  useEffect(() => setAberto(doAtual), [doAtual])

  const sub = grupos.find((g) => g.grupo === aberto)?.itens ?? []
  return (
    <>
    <nav className="navlist" aria-label="Menu principal">
      {grupos.map((g) => {
        const ab = aberto === g.grupo
        return (
          <div key={g.grupo} className={`navgroup${ab ? ' open' : ''}${g.grupo === doAtual ? ' ativo' : ''}`}>
            <button type="button" className="navhead" aria-expanded={ab} onClick={() => setAberto(ab ? null : g.grupo)}>
              <span>{g.grupo}</span>
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <div className="navitems" hidden={!ab}>
              {g.itens.map((i) => (
                <Link key={i.href} href={i.href} className="nav" aria-current={ativo(i.href) ? 'page' : undefined}>{i.nome}</Link>
              ))}
            </div>
          </div>
        )
      })}
    </nav>
    {/* no celular os itens do grupo aberto aparecem numa segunda linha */}
    {sub.length > 0 && <div className="navsub">{sub.map((i) => (
      <Link key={i.href} href={i.href} className="nav" aria-current={ativo(i.href) ? 'page' : undefined}>{i.nome}</Link>
    ))}</div>}
    </>
  )
}
