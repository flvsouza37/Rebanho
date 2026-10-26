import Link from 'next/link'
import { exigirAcesso, pode } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { brl, dataBR, hoje } from '@/lib/formato'
import { Cabecalho } from '@/components/Cabecalho'
import { Formulario } from '@/components/Formulario'
import { Pdv } from './Pdv'
import { salvarProduto, repor, abrirCaixa, vender, fecharCaixa } from './acoes'

export const metadata = { title: 'Cantina' }

type Produto = { id: string; nome: string; categoria: string; preco: number; custo: number; estoque: number; estoque_min: number; ativo: boolean }
const CATS = ['Salgados', 'Doces', 'Bebidas', 'Refeição', 'Outros']

function Campos({ p }: { p?: Produto }) {
  return (
    <>
      <label className="f">Produto<input type="text" name="nome" required minLength={2} maxLength={80} defaultValue={p?.nome} /></label>
      <label className="f">Categoria<select name="categoria" defaultValue={p?.categoria ?? 'Salgados'}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></label>
      <label className="f">Preço de venda (R$)<input type="text" inputMode="decimal" name="preco" required defaultValue={p ? String(p.preco).replace('.', ',') : ''} /></label>
      <label className="f">Custo (R$)<input type="text" inputMode="decimal" name="custo" defaultValue={p ? String(p.custo).replace('.', ',') : ''} /></label>
      <label className="f">Estoque<input type="number" name="estoque" min={0} defaultValue={p?.estoque ?? 0} /></label>
      <label className="f">Estoque mínimo<input type="number" name="estoque_min" min={0} defaultValue={p?.estoque_min ?? 5} /></label>
      <label className="chk full"><input type="checkbox" name="ativo" defaultChecked={p?.ativo ?? true} />Disponível para venda</label>
    </>
  )
}

export default async function Cantina({ searchParams }: { searchParams: Promise<{ aba?: string; erro?: string }> }) {
  const s = await exigirAcesso('cantina')
  const edita = pode(s, 'cantina', 'editar')
  const sp = await searchParams, aba = ['estoque', 'caixas'].includes(sp.aba ?? '') ? sp.aba! : 'vender'
  const supabase = await supabaseServidor()
  const ig = s.igreja.id
  const [{ data: pr }, { data: cx }, { data: vd }, { data: ev }] = await Promise.all([
    supabase.from('produtos').select('*').eq('igreja_id', ig).order('nome'),
    supabase.from('caixas').select('*').eq('igreja_id', ig).order('criado_em', { ascending: false }).limit(60),
    supabase.from('vendas').select('caixa_id, itens, total, custo, forma').eq('igreja_id', ig).gte('criado_em', new Date(Date.now() - 365 * 864e5).toISOString()),
    supabase.from('eventos').select('id, titulo, data').eq('igreja_id', ig).gte('data', new Date(Date.now() - 7 * 864e5).toLocaleDateString('sv-SE')).lte('data', new Date(Date.now() + 7 * 864e5).toLocaleDateString('sv-SE')),
  ])
  const produtos = (pr ?? []) as Produto[], vendas = vd ?? [], caixas = cx ?? []
  const fundo = s.igreja.fundos.includes('Cantina') ? 'Cantina' : 'Geral'
  const aberto = caixas.find((c) => c.status === 'aberto')
  const baixo = produtos.filter((p) => p.ativo && p.estoque <= p.estoque_min)
  const doCaixa = (id: string) => vendas.filter((v) => v.caixa_id === id)
  const nomeEv = (id: string | null) => (ev ?? []).find((e) => e.id === id)?.titulo

  const abas = <div className="tabs">{[['vender', 'Vender'], ['estoque', 'Estoque'], ['caixas', 'Caixas e resultados']].map(([k, n]) => <Link key={k} className="tab" aria-selected={aba === k} href={k === 'vender' ? '/cantina' : `/cantina?aba=${k}`}>{n}</Link>)}</div>
  let corpo: React.ReactNode
  if (aba === 'estoque') {
    corpo = <>
      {baixo.length > 0 && <div className="banner warn">Repor: {baixo.map((p) => `${p.nome} (${p.estoque})`).join(', ')}.</div>}
      <div className="card"><div className="scroll-x"><table>
        <thead><tr><th>Produto</th><th>Categoria</th><th className="num">Preço</th><th className="num">Custo</th><th className="num">Margem</th><th className="num">Estoque</th>{edita && <th />}</tr></thead>
        <tbody>{produtos.map((p) => (
          <tr key={p.id}>
            <td><b>{p.nome}</b>{!p.ativo && <> <span className="pill">inativo</span></>}</td><td>{p.categoria}</td>
            <td className="num mono">{brl(p.preco)}</td><td className="num mono">{brl(p.custo)}</td>
            <td className="num mono">{p.preco ? Math.round(((p.preco - p.custo) / p.preco) * 100) : 0}%</td>
            <td className="num"><span className={`pill ${p.estoque <= p.estoque_min ? 'crit' : 'ok'}`}>{p.estoque}</span><div className="small muted">mín. {p.estoque_min}</div></td>
            {edita && <td><div className="row">
              <form action={repor.bind(null, p.id)}><button className="btn ghost sm" type="submit" aria-label={`Repor 10 de ${p.nome}`}>+10</button></form>
              <details className="inline"><summary className="btn ghost sm">Editar</summary><Formulario acao={salvarProduto.bind(null, p.id)}><Campos p={p} /></Formulario></details>
            </div></td>}
          </tr>
        ))}</tbody>
      </table></div>{!produtos.length && <div className="empty">Nenhum produto cadastrado.</div>}</div>
      {edita && <div className="card"><header><h2>Novo produto</h2></header><Formulario acao={salvarProduto.bind(null, null)} enviar="Cadastrar produto"><Campos /></Formulario></div>}
    </>
  } else if (aba === 'caixas') {
    const fat = vendas.reduce((t, v) => t + Number(v.total), 0), custo = vendas.reduce((t, v) => t + Number(v.custo), 0)
    const tot: Record<string, number> = {}
    vendas.forEach((v) => (v.itens as { nome: string; qtd: number }[]).forEach((i) => { tot[i.nome] = (tot[i.nome] ?? 0) + i.qtd }))
    const top = Object.entries(tot).sort((a, b) => b[1] - a[1]).slice(0, 8), max = top[0]?.[1] ?? 1
    corpo = <>
      {sp.erro && <div className="erro" role="alert">{sp.erro}</div>}
      <div className="grid g4">
        <div className="card kpi"><span className="lbl">Faturamento em 12 meses</span><span className="val">{brl(fat)}</span><span className="sub">{vendas.length} vendas</span></div>
        <div className="card kpi"><span className="lbl">Lucro bruto</span><span className="val">{brl(fat - custo)}</span><span className="sub">margem de {fat ? Math.round(((fat - custo) / fat) * 100) : 0}%</span></div>
        <div className="card kpi"><span className="lbl">Ticket médio</span><span className="val">{brl(vendas.length ? fat / vendas.length : 0)}</span></div>
        <div className="card kpi"><span className="lbl">Caixas fechados</span><span className="val">{caixas.filter((c) => c.status === 'fechado').length}</span><span className="sub">lançados na tesouraria</span></div>
      </div>
      <div className="grid split">
        <div className="card"><header><h2>Caixas</h2></header>{caixas.length ? <div className="list">{caixas.map((c) => (
          <div className="item" key={c.id}><div className="body">
            <div className="spread"><b>{dataBR(c.data)}{nomeEv(c.evento_id) ? ' · ' + nomeEv(c.evento_id) : ''}</b><span className="mono">{brl(c.status === 'aberto' ? doCaixa(c.id).reduce((t, v) => t + Number(v.total), 0) : c.total)}</span></div>
            <span className="small muted">{c.status === 'aberto' ? 'Aberto agora' : 'Fechado'} · troco inicial {brl(c.troco)} · {doCaixa(c.id).length} venda(s){Object.entries(c.por_forma ?? {}).map(([k, v]) => ` · ${k} ${brl(v as number)}`).join('')}</span>
          </div>{c.lancamento_id ? <span className="pill ok">Na tesouraria</span> : c.status === 'aberto' ? <span className="pill warn">Aberto</span> : null}</div>
        ))}</div> : <div className="empty">Nenhum caixa ainda.</div>}</div>
        <div className="card"><header><h2>Mais vendidos</h2></header>{top.length ? <div className="grid" style={{ gap: 8 }}>{top.map(([n, q]) => (
          <div key={n} className="grid" style={{ gap: 3 }}><div className="spread small"><span>{n}</span><span className="mono">{q} un.</span></div><div className="barra"><i style={{ width: `${(q / max) * 100}%` }} /></div></div>
        ))}</div> : <div className="empty">Sem vendas ainda.</div>}</div>
      </div>
    </>
  } else if (!aberto) {
    corpo = edita ? <div className="card" style={{ maxWidth: 560 }}><h2>Abrir o caixa</h2><p className="small muted">Informe o troco que está na gaveta. Se a venda for de um evento, escolha qual para ver o resultado dele depois.</p>
      <Formulario acao={abrirCaixa} enviar="Abrir caixa">
        <label className="f">Troco inicial (R$)<input type="text" inputMode="decimal" name="troco" defaultValue="50" /></label>
        <label className="f">Evento (opcional)<select name="evento" defaultValue=""><option value="">Culto ou dia comum</option>{(ev ?? []).map((e) => <option key={e.id} value={e.id}>{e.titulo} · {dataBR(e.data)}</option>)}</select></label>
      </Formulario>
      {baixo.length > 0 && <div className="banner warn">Antes de abrir: repor {baixo.map((p) => p.nome).join(', ')}.</div>}
    </div> : <div className="empty">Nenhum caixa aberto agora.</div>
  } else {
    const vc = doCaixa(aberto.id), tc = vc.reduce((t, v) => t + Number(v.total), 0)
    corpo = <>
      <div className="banner spread"><span>Caixa aberto {aberto.data === hoje() ? 'hoje' : 'em ' + dataBR(aberto.data)}{nomeEv(aberto.evento_id) ? ' para ' + nomeEv(aberto.evento_id) : ''} · {vc.length} venda(s) · <b>{brl(tc)}</b></span>
        {edita && <details className="inline"><summary className="btn ghost sm">Fechar caixa</summary>
          <form action={fecharCaixa.bind(null, aberto.id)} className="row"><span className="small">O total de {brl(tc)} entra na tesouraria, no fundo {fundo}.</span><button className="btn sm" type="submit">Confirmar fechamento</button></form>
        </details>}</div>
      {edita ? <Pdv caixa={aberto.id} produtos={produtos.filter((p) => p.ativo).map((p) => ({ id: p.id, nome: p.nome, categoria: p.categoria, preco: Number(p.preco), estoque: p.estoque }))} acao={vender} /> : <div className="empty">Só quem edita a cantina registra vendas.</div>}
    </>
  }

  return (
    <>
      <Cabecalho sobre="Gestão" titulo="Cantina" texto={`Venda rápida no celular, estoque com alerta de reposição e fechamento de caixa que lança o resultado direto na tesouraria, no fundo ${fundo}.`} />
      {abas}
      {corpo}
    </>
  )
}
