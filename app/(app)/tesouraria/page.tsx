import Link from 'next/link'
import { exigirAcesso, pode } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { brl, dataBR, fimDoMes, mesAnterior, mesAtual, nomeMes } from '@/lib/formato'
import { Cabecalho } from '@/components/Cabecalho'
import { Formulario } from '@/components/Formulario'
import { estornar, decidir, conciliar, fecharMes, reabrirMes } from './acoes'

export const metadata = { title: 'Tesouraria' }

type L = { id: string; tipo: 'entrada' | 'saida'; valor: number; data: string; categoria: string; fundo: string; forma: string; descricao: string | null; status: string; estorno_de: string | null; estornado_por: string | null; conciliado: boolean; aprovado_por: string | null }
const vale = (l: L) => l.status === 'ok' && !l.estorno_de && !l.estornado_por

export default async function Tesouraria({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await exigirAcesso('financeiro')
  const edita = pode(s, 'financeiro', 'editar')
  const sp = await searchParams
  const mes = /^\d{4}-\d{2}$/.test(sp.mes ?? '') ? sp.mes! : mesAtual()
  const tipo = sp.tipo === 'entrada' || sp.tipo === 'saida' ? sp.tipo : null
  const supabase = await supabaseServidor()
  const ig = s.igreja.id
  const [{ data: doMes }, { data: saldos }, { data: pend }, { data: fech }] = await Promise.all([
    supabase.from('lancamentos').select('*').eq('igreja_id', ig).gte('data', mes + '-01').lte('data', fimDoMes(mes)).order('data', { ascending: false }).order('criado_em', { ascending: false }),
    supabase.from('lancamentos_validos').select('fundo, tipo, valor').eq('igreja_id', ig).lte('data', fimDoMes(mes)),
    supabase.from('lancamentos').select('*').eq('igreja_id', ig).eq('status', 'pendente').order('data'),
    supabase.from('fechamentos').select('mes, fechado_em').eq('igreja_id', ig).eq('mes', mes).maybeSingle(),
  ])
  const lista = ((doMes ?? []) as L[]).filter((l) => !tipo || l.tipo === tipo)
  const validos = ((doMes ?? []) as L[]).filter(vale)
  const ent = validos.filter((l) => l.tipo === 'entrada' && l.categoria !== 'Saldo anterior').reduce((t, l) => t + Number(l.valor), 0)
  const sai = validos.filter((l) => l.tipo === 'saida').reduce((t, l) => t + Number(l.valor), 0)
  const porFundo: Record<string, number> = {}
  ;(saldos ?? []).forEach((l) => { porFundo[l.fundo] = (porFundo[l.fundo] ?? 0) + (l.tipo === 'entrada' ? 1 : -1) * Number(l.valor) })
  const total = Object.values(porFundo).reduce((a, b) => a + b, 0)
  const meses = Array.from({ length: 13 }, (_, i) => mesAnterior(mesAtual(), i))

  return (
    <>
      <Cabecalho sobre="Gestão" titulo="Tesouraria" texto="Nada é apagado: erro se corrige com estorno. Saídas acima da alçada esperam o pastor. Mês fechado não aceita lançamento."
        acoes={edita && <><Link className="btn" href="/tesouraria/novo?tipo=entrada">Nova entrada</Link><Link className="btn ghost" href="/tesouraria/novo?tipo=saida">Nova saída</Link></>} />
      {sp.aviso === 'pendente' && <div className="banner warn">Saída acima de {brl(s.igreja.alcada)}: foi enviada ao pastor para aprovação e ainda não entra no caixa.</div>}
      <form className="row" action="/tesouraria">
        <select name="mes" defaultValue={mes} style={{ width: 'auto' }}>{meses.map((m) => <option key={m} value={m}>{nomeMes(m)}</option>)}</select>
        <select name="tipo" defaultValue={tipo ?? ''} style={{ width: 'auto' }}><option value="">Entradas e saídas</option><option value="entrada">Só entradas</option><option value="saida">Só saídas</option></select>
        <button className="btn ghost" type="submit">Ver</button>
      </form>
      <div className="row">
        {fech ? <>
          <span className="pill ok">Mês fechado em {dataBR(fech.fechado_em)}</span>
          {s.papel === 'pastor' && <form action={reabrirMes.bind(null, mes)}><button className="btn ghost sm" type="submit">Reabrir</button></form>}
        </> : !edita ? null : mes < mesAtual() ? <form action={fecharMes.bind(null, mes)}><button className="btn ghost sm" type="submit">Fechar {nomeMes(mes)}</button></form>
          : <span className="small muted">O mês corrente só pode ser fechado depois que terminar.</span>}
      </div>

      <div className="grid g4">
        <div className="card kpi"><span className="lbl">Saldo em caixa</span><span className="val">{brl(total)}</span><span className="sub">até o fim de {nomeMes(mes)}</span></div>
        <div className="card kpi"><span className="lbl">Entradas</span><span className="val" style={{ color: 'var(--ok)' }}>{brl(ent)}</span></div>
        <div className="card kpi"><span className="lbl">Saídas</span><span className="val" style={{ color: 'var(--crit)' }}>{brl(sai)}</span><span className="sub">resultado {brl(ent - sai)}</span></div>
        <div className="card kpi"><span className="lbl">Por fundo</span>{s.igreja.fundos.map((f) => <span key={f} className="small">{f}: <b className="mono">{brl(porFundo[f] ?? 0)}</b></span>)}</div>
      </div>

      {!!pend?.length && (
        <div className="card" style={{ borderColor: 'var(--warn)' }} id="pendentes"><header><h2>Aguardando aprovação</h2><small>saídas acima de {brl(s.igreja.alcada)}</small></header>
          <div className="list">{(pend as L[]).map((l) => (
            <div className="item" key={l.id}><div className="body"><b>{l.descricao || l.categoria}</b><span className="small muted">{dataBR(l.data)} · {l.categoria} · fundo {l.fundo}</span></div>
              <span className="mono">{brl(l.valor)}</span>
              {s.papel === 'pastor' ? <div className="row">
                <form action={decidir.bind(null, l.id, 'ok')}><button className="btn sm" type="submit">Aprovar</button></form>
                <form action={decidir.bind(null, l.id, 'rejeitada')}><button className="btn ghost sm" type="submit">Rejeitar</button></form>
              </div> : <span className="small muted">com o pastor</span>}
            </div>
          ))}</div>
        </div>
      )}

      <div className="card scroll-x">
        <table>
          <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Fundo</th><th className="num">Valor</th><th>Conferido</th><th></th></tr></thead>
          <tbody>
            {lista.map((l) => (
              <tr key={l.id} style={vale(l) ? undefined : { opacity: 0.62 }}>
                <td>{dataBR(l.data)}</td>
                <td>{l.descricao || '—'}{' '}
                  {l.estorno_de ? <span className="pill">estorno</span> : l.estornado_por ? <span className="pill warn">estornado</span>
                    : l.status === 'pendente' ? <span className="pill warn">aguardando aprovação</span> : l.status === 'rejeitada' ? <span className="pill crit">rejeitada</span>
                    : l.aprovado_por ? <span className="pill ok">aprovado</span> : null}
                </td>
                <td>{l.categoria}</td><td>{l.fundo}</td>
                <td className="num mono" style={{ color: l.tipo === 'saida' ? 'var(--crit)' : 'var(--ok)' }}>{l.tipo === 'saida' ? '−' : '+'} {brl(l.valor)}</td>
                <td>{edita ? <form action={conciliar.bind(null, l.id, !l.conciliado)}><button className="btn ghost sm" type="submit">{l.conciliado ? 'Sim' : 'Não'}</button></form> : l.conciliado ? 'Sim' : 'Não'}</td>
                <td>{edita && vale(l) && (
                  <details className="inline"><summary className="btn ghost sm">Estornar</summary>
                    <Formulario acao={estornar.bind(null, l.id)} enviar="Confirmar estorno" className="grid">
                      <label className="f">Motivo<input type="text" name="motivo" required minLength={3} /></label>
                    </Formulario>
                  </details>
                )}</td>
              </tr>
            ))}
            {!lista.length && <tr><td colSpan={7} className="muted">Nenhum lançamento neste filtro.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}
