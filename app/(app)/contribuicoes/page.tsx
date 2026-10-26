import Link from 'next/link'
import { exigirAcesso, pode } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { brl, dataBR, hoje, mesAnterior, mesAtual, nomeMes } from '@/lib/formato'
import { Cabecalho } from '@/components/Cabecalho'
import { Formulario } from '@/components/Formulario'
import { gerarMes, darBaixa } from './acoes'

export const metadata = { title: 'Contribuições' }

export default async function Contribuicoes({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await exigirAcesso('financeiro')
  const edita = pode(s, 'financeiro', 'editar')
  const sp = await searchParams
  const mes = /^\d{4}-\d{2}$/.test(sp.mes ?? '') ? sp.mes! : mesAtual()
  const supabase = await supabaseServidor()
  let q = supabase.from('contribuicoes').select('id, competencia, tipo, valor, vencimento, status, valor_pago, pago_em, recibo, recibo_cancelado, pessoas(id, nome)')
    .eq('igreja_id', s.igreja.id).order('vencimento')
  q = sp.pessoa ? q.eq('pessoa_id', sp.pessoa).order('competencia', { ascending: false }) : q.eq('competencia', mes)
  if (sp.st === 'aberta' || sp.st === 'paga') q = q.eq('status', sp.st)
  const { data: lista } = await q
  const previsto = (lista ?? []).reduce((t, c) => t + Number(c.valor), 0)
  const recebido = (lista ?? []).filter((c) => c.status === 'paga').reduce((t, c) => t + Number(c.valor_pago), 0)
  const meses = [1, 0, ...Array.from({ length: 12 }, (_, i) => -(i + 1))].map((n) => mesAnterior(mesAtual(), -n))

  return (
    <>
      <Cabecalho sobre="Gestão" titulo="Contribuições" texto="Carnê mensal de quem tem compromisso. A baixa lança no caixa e emite o recibo numerado num passo só." />
      {(sp.st || sp.pessoa) && <div className="banner">Filtro: {sp.pessoa ? 'uma pessoa' : sp.st === 'aberta' ? 'só em aberto' : 'só pagas'}. <Link href={`/contribuicoes?mes=${mes}`}>Ver todas do mês</Link></div>}
      <div className="row">
        <form className="row" action="/contribuicoes">
          <select name="mes" defaultValue={mes} style={{ width: 'auto' }}>{meses.map((m) => <option key={m} value={m}>{nomeMes(m)}</option>)}</select>
          <button className="btn ghost" type="submit">Ver</button>
        </form>
        {edita && <Formulario acao={gerarMes.bind(null, mes)} enviar={`Gerar carnês de ${nomeMes(mes)}`} className="row"><></></Formulario>}
      </div>
      <div className="grid g3">
        <div className="card kpi"><span className="lbl">Previsto</span><span className="val">{brl(previsto)}</span><span className="sub">{lista?.length ?? 0} carnê(s)</span></div>
        <div className="card kpi"><span className="lbl">Recebido</span><span className="val" style={{ color: 'var(--ok)' }}>{brl(recebido)}</span></div>
        <div className="card kpi"><span className="lbl">Em aberto</span><span className="val">{(lista ?? []).filter((c) => c.status === 'aberta').length}</span></div>
      </div>
      <div className="card scroll-x">
        <table>
          <thead><tr><th>Membro</th><th>Mês</th><th>Vencimento</th><th className="num">Valor</th><th>Situação</th><th></th></tr></thead>
          <tbody>
            {(lista ?? []).map((c) => {
              const p = c.pessoas as unknown as { id: string; nome: string }
              return (
                <tr key={c.id}>
                  <td><Link href={`/pessoas/${p.id}`}>{p.nome}</Link><br /><span className="small muted">{c.tipo}</span></td>
                  <td>{c.competencia}</td><td>{dataBR(c.vencimento)}</td><td className="num mono">{brl(c.valor)}</td>
                  <td>{c.status === 'paga' ? <span className="pill ok">pago {dataBR(c.pago_em)}</span> : <span className="pill warn">em aberto</span>}
                    {c.recibo_cancelado && <><br /><span className="small muted">recibo {c.recibo_cancelado} cancelado</span></>}</td>
                  <td>{c.status === 'paga' ? <Link className="btn ghost sm" href={`/contribuicoes/recibo/${c.id}`}>Recibo {c.recibo}</Link> : edita && (
                    <details className="inline"><summary className="btn sm">Dar baixa</summary>
                      <Formulario acao={darBaixa.bind(null, c.id)} enviar="Confirmar recebimento" className="grid">
                        <label className="f">Valor recebido<input type="number" name="valor" min="0.01" step="0.01" defaultValue={c.valor} required /></label>
                        <label className="f">Data<input type="date" name="data" defaultValue={hoje()} required /></label>
                        <label className="f">Forma<select name="forma"><option>Pix</option><option>Dinheiro</option><option>Boleto</option><option>Transferência</option></select></label>
                        <label className="f">Fundo<select name="fundo">{s.igreja.fundos.map((f) => <option key={f}>{f}</option>)}</select></label>
                      </Formulario>
                    </details>
                  )}</td>
                </tr>
              )
            })}
            {!lista?.length && <tr><td colSpan={6} className="muted">Nenhuma contribuição. Cadastre o compromisso na ficha do membro e gere os carnês do mês.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}
