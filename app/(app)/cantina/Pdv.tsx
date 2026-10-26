'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { brl } from '@/lib/formato'
import type { Resultado } from '@/components/Formulario'

type Produto = { id: string; nome: string; categoria: string; preco: number; estoque: number }

// Ponto de venda: toca no produto, escolhe a forma e finaliza. O total final é recalculado no banco.
export function Pdv({ caixa, produtos, acao }: { caixa: string; produtos: Produto[]; acao: (caixa: string, itens: { id: string; qtd: number }[], forma: string) => Promise<Resultado> }) {
  const [cart, setCart] = useState<Record<string, number>>({})
  const [forma, setForma] = useState('Pix'), [receb, setReceb] = useState('')
  const [res, setRes] = useState<Resultado>(null), [pend, start] = useTransition()
  const router = useRouter()
  const itens = produtos.filter((p) => cart[p.id] > 0).map((p) => ({ p, q: cart[p.id] }))
  const total = itens.reduce((t, x) => t + x.q * x.p.preco, 0), qtd = itens.reduce((t, x) => t + x.q, 0)
  const troco = Number(receb.replace(',', '.')) - total
  const mais = (id: string, n: number) => { setRes(null); setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + n) })) }
  const finalizar = () => start(async () => {
    const r = await acao(caixa, itens.map((x) => ({ id: x.p.id, qtd: x.q })), forma)
    setRes(r)
    if (!r?.erro) { setCart({}); setReceb(''); router.refresh() }
  })
  const cats = [...new Set(produtos.map((p) => p.categoria))]
  return (
    <div className="grid split">
      <div className="grid" style={{ alignContent: 'start' }}>
        {cats.map((c) => (
          <div className="grid" style={{ gap: 8 }} key={c}><span className="eyebrow">{c}</span>
            <div className="pdv">{produtos.filter((p) => p.categoria === c).map((p) => {
              const resta = p.estoque - (cart[p.id] ?? 0)
              return <button type="button" className="room" key={p.id} disabled={resta <= 0} onClick={() => mais(p.id, 1)}><b>{p.nome}</b><span className="row spread"><span className="mono">{brl(p.preco)}</span><span className="small muted">{resta} un.</span></span></button>
            })}</div>
          </div>
        ))}
        {!produtos.length && <div className="empty">Cadastre os produtos na aba Estoque.</div>}
      </div>
      <div className="card pedido"><header><h2>Pedido</h2><small>{qtd} item(ns)</small></header>
        {itens.length ? <div className="list">{itens.map((x) => (
          <div className="item" key={x.p.id}><div className="body"><b>{x.p.nome}</b><span className="small muted mono">{x.q} × {brl(x.p.preco)}</span></div><span className="mono">{brl(x.q * x.p.preco)}</span><button type="button" className="btn ghost sm" onClick={() => mais(x.p.id, -1)} aria-label={`Tirar um ${x.p.nome}`}>−</button></div>
        ))}</div> : <div className="empty">Toque nos produtos para montar o pedido.</div>}
        <div className="spread"><b>Total</b><span className="mono" style={{ fontSize: '1.6rem' }} aria-live="polite">{brl(total)}</span></div>
        <div className="row" role="radiogroup" aria-label="Forma de pagamento">{['Pix', 'Dinheiro', 'Cartão'].map((f) => <label className="chk" key={f}><input type="radio" name="forma" value={f} checked={forma === f} onChange={() => setForma(f)} />{f}</label>)}</div>
        {forma === 'Dinheiro' && total > 0 && <label className="f">Valor recebido<input type="text" inputMode="decimal" value={receb} onChange={(e) => setReceb(e.target.value)} />{troco >= 0 && <span className="small">Troco: <b className="mono">{brl(troco)}</b></span>}</label>}
        {res?.erro && <div className="erro" role="alert">{res.erro}</div>}
        {res?.ok && <div className="sucesso" role="status">{res.ok}</div>}
        <div className="row"><button type="button" className="btn" disabled={!itens.length || pend} onClick={finalizar}>{pend ? 'Registrando…' : 'Finalizar venda'}</button>{itens.length > 0 && <button type="button" className="btn ghost" onClick={() => setCart({})}>Limpar</button>}</div>
      </div>
    </div>
  )
}
