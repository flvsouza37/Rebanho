import Link from 'next/link'
import { exigirAcesso, pode } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { brl, dataBR, hoje } from '@/lib/formato'
import { linkWhats } from '@/lib/radar'
import { AMBN, GRAU_P, STATUS_PLANO, nomeCargo, type Cargo } from '@/lib/patrimonio'
import { Cabecalho } from '@/components/Cabecalho'
import { atualizarPlano, excluirPlano } from './acoes'

export const metadata = { title: 'Planos 5W2H' }

export default async function Planos() {
  const s = await exigirAcesso('patrimonio')
  const edita = pode(s, 'patrimonio', 'editar')
  const supabase = await supabaseServidor()
  const ig = s.igreja.id
  const [{ data: pl }, { data: cg }, { data: am }] = await Promise.all([
    supabase.from('planos').select('*').eq('igreja_id', ig).order('criado_em', { ascending: false }),
    supabase.from('cargos').select('id, titulo, nome, pessoa_id, areas').eq('igreja_id', ig).order('titulo'),
    supabase.from('ameacas').select('id, titulo, ambiente, plano_id').eq('igreja_id', ig).not('plano_id', 'is', null),
  ])
  const cargos = (cg ?? []) as Cargo[], cargo = (id: string | null) => cargos.find((c) => c.id === id)
  const ids = cargos.map((c) => c.pessoa_id).filter((x): x is string => !!x)
  const { data: fones } = ids.length ? await supabase.from('pessoas').select('id, telefone, lgpd_whats').in('id', ids) : { data: [] }
  const lista = [...(pl ?? [])].sort((a, b) => Number(a.status === 'Concluído') - Number(b.status === 'Concluído') || b.score - a.score)
  const atrasado = (p: { status: string; quando: string | null }) => p.status !== 'Concluído' && !!p.quando && p.quando < hoje()

  return (
    <>
      <Cabecalho sobre="Patrimônio" titulo="Planos 5W2H"
        texto="O quê, por quê, onde, quando, quem, como e quanto. Cada plano nasce de uma ameaça do GUT, com prazo pelo grau de risco e responsável pela matriz de cargos. Concluir o plano resolve as ameaças dele."
        acoes={<><Link className="btn ghost" href="/manutencao">Manutenção GUT</Link><Link className="btn ghost" href="/kanban?o=Manutenção">Ver no kanban</Link></>} />
      <div className="grid g4">
        {STATUS_PLANO.map((st) => <div className="card kpi" key={st}><span className="lbl">{st}</span><span className="val">{(pl ?? []).filter((p) => p.status === st).length}</span><span className="sub">{st === 'Planejado' ? `${(pl ?? []).filter(atrasado).length} com prazo vencido` : ''}</span></div>)}
      </div>
      {lista.length ? <div className="grid g2">{lista.map((p) => {
        const quem = cargo(p.quem), aprova = cargo(p.aprova), g = GRAU_P.find((x) => x.k === p.grau) ?? GRAU_P[2]
        const f = (fones ?? []).find((x) => x.id === quem?.pessoa_id)
        const wa = f?.lgpd_whats ? linkWhats(f.telefone, `Olá, ${quem!.nome.split(' ')[0]}! Você é o responsável pelo plano “${p.oque}” (${p.onde ?? 'templo'}), com prazo até ${dataBR(p.quando)}. Pode confirmar que vai assumir? Detalhes no Rebanho.`) : null
        const vinc = (am ?? []).filter((a) => a.plano_id === p.id), fim = p.status === 'Concluído'
        return (
          <div className="card" key={p.id} id={`pl-${p.id}`}>
            <header>
              <div className="row"><span className={`pill ${fim ? 'ok' : g.k}`}>{g.n} · GUT {p.score}</span><span className="pill">{p.status}</span>{atrasado(p) && <span className="pill crit">Atrasado</span>}</div>
              <small>{fim ? `concluído ${dataBR(p.feito_em)}` : `até ${dataBR(p.quando)}`}</small>
            </header>
            <h3>{p.oque}</h3>
            <div className="w5">
              <div className="k">O quê<small>What</small></div><div>{p.oque}</div>
              <div className="k">Por quê<small>Why</small></div><div>{p.porque ?? '—'}</div>
              <div className="k">Onde<small>Where</small></div><div>{p.onde ?? '—'}</div>
              <div className="k">Quando<small>When</small></div><div>{dataBR(p.quando)} <span className="small muted">· {g.dias} dias pelo grau {g.n.toLowerCase()}</span></div>
              <div className="k">Quem<small>Who</small></div><div>{nomeCargo(quem)}{!quem && <span className="small muted"> · <Link href="/cargos">defina na matriz de cargos</Link></span>}</div>
              <div className="k">Aprova<small>alçada</small></div><div>{nomeCargo(aprova)} <span className="small muted">· {Number(p.quanto) > s.igreja.alcada ? `acima da alçada de ${brl(s.igreja.alcada)}` : 'dentro da alçada'}</span></div>
              <div className="k">Como<small>How</small></div><div>{p.como ?? '—'}</div>
              <div className="k">Quanto<small>How much</small></div><div className="mono">{brl(p.quanto)}</div>
            </div>
            {vinc.length > 0 && <div className="small muted">Ameaças deste plano: {vinc.map((a, i) => <span key={a.id}>{i ? ', ' : ''}<Link href={`/manutencao#am-${a.id}`}>{a.titulo}</Link></span>)}</div>}
            <div className="row">
              {edita && <form action={atualizarPlano.bind(null, p.id)} className="fl">
                <label className="sr-only" htmlFor={`st-${p.id}`}>Andamento</label>
                <select id={`st-${p.id}`} name="status" defaultValue={p.status}>{STATUS_PLANO.map((st) => <option key={st}>{st}</option>)}</select>
                <label className="sr-only" htmlFor={`qm-${p.id}`}>Responsável</label>
                <select id={`qm-${p.id}`} name="quem" defaultValue={p.quem ?? ''}><option value="">Responsável a definir</option>{cargos.map((c) => <option key={c.id} value={c.id}>{c.nome} ({c.titulo})</option>)}</select>
                <button className="btn sm" type="submit">Atualizar</button>
              </form>}
              {wa && !fim && <a className="btn ghost sm" href={wa} target="_blank" rel="noopener noreferrer">Avisar responsável</a>}
              {s.papel === 'pastor' && <form action={excluirPlano.bind(null, p.id)}><button className="btn ghost sm" type="submit">Excluir</button></form>}
            </div>
          </div>
        )
      })}</div> : <div className="empty">Nenhum plano ainda. Em <Link href="/manutencao">Manutenção GUT</Link>, use “Gerar 5W2H” numa ameaça.</div>}
    </>
  )
}
