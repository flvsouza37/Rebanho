import Link from 'next/link'
import { exigir } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { brl, dataBR } from '@/lib/formato'
import { PERFIL, perfilDe, numBR } from '@/lib/territorio'
import { Cabecalho } from '@/components/Cabecalho'

export const metadata = { title: 'Campanhas' }

const COR: Record<string, string> = { Planejada: '', 'Em andamento': 'info', 'Em avaliação': 'warn', Encerrada: 'ok' }

export default async function Campanhas() {
  const s = await exigir(['pastor', 'secretaria', 'lider'])
  const supabase = await supabaseServidor()
  const [{ data: camps }, { data: res }] = await Promise.all([
    supabase.from('campanhas').select('*').eq('igreja_id', s.igreja.id).order('criado_em', { ascending: false }),
    supabase.from('campanhas_resultado').select('id, visitantes, integrados').eq('igreja_id', s.igreja.id),
  ])
  const r = new Map((res ?? []).map((x) => [x.id, { v: Number(x.visitantes), i: Number(x.integrados) }]))
  const lista = [...(camps ?? [])].sort((a, b) => Number(a.status === 'Encerrada') - Number(b.status === 'Encerrada'))
  const tv = [...r.values()].reduce((t, x) => t + x.v, 0), ti = [...r.values()].reduce((t, x) => t + x.i, 0)
  const orc = lista.reduce((t, c) => t + Number(c.orcamento), 0)

  return (
    <>
      <Cabecalho sobre="Missão" titulo="Campanhas"
        texto="Cada visitante pode ser ligado à campanha que o trouxe. Assim dá para ver quais ações trazem gente e quais viram congregados e membros."
        acoes={<><Link className="btn ghost" href="/alcance">Ver território</Link>{s.papel !== 'lider' && <Link className="btn" href="/campanhas/nova">Nova campanha</Link>}</>} />
      <div className="grid g4">
        <div className="card kpi"><span className="lbl">Campanhas ativas</span><span className="val">{lista.filter((c) => c.status !== 'Encerrada').length}</span><span className="sub">{lista.length} no total</span></div>
        <div className="card kpi"><span className="lbl">Visitantes vindos de campanhas</span><span className="val">{tv}</span><span className="sub">meta somada: {lista.reduce((t, c) => t + c.meta, 0)}</span></div>
        <div className="card kpi"><span className="lbl">Já são congregados ou membros</span><span className="val">{ti}</span><span className="sub">{tv ? numBR((ti / tv) * 100) : 0}% dos visitantes</span></div>
        <div className="card kpi"><span className="lbl">Investimento previsto</span><span className="val">{brl(orc)}</span><span className="sub">{tv ? brl(orc / tv) + ' por visitante' : 'sem visitantes ainda'}</span></div>
      </div>
      {lista.length ? <div className="grid g2">{lista.map((c) => {
        const x = r.get(c.id) ?? { v: 0, i: 0 }, pct = c.meta ? Math.min(100, (x.v / c.meta) * 100) : 0
        const P = PERFIL[perfilDe(c.perfil)]
        return (
          <Link key={c.id} href={`/campanhas/${c.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <header><h2>{c.titulo}</h2><span className={`pill ${COR[c.status]}`}>{c.status}</span></header>
            <span className="small muted">{[c.microarea, c.municipio].filter(Boolean).join(' · ') || 'Sem bairro definido'} · <span className={`pill ${P.cls}`}>{P.nome}</span></span>
            <span className="small muted">{c.inicio ? `${dataBR(c.inicio)} a ${dataBR(c.fim)}` : 'Sem datas'}{c.responsavel ? ` · ${c.responsavel}` : ''}</span>
            <div className="spread small"><span>Visitantes: <b className="mono">{x.v}</b> de {c.meta} · integrados {x.i}</span><span className="mono">{numBR(pct)}%</span></div>
            <svg className="chart" viewBox="0 0 300 8" aria-hidden="true"><rect className="barbg" width="300" height="8" rx="3" /><rect className="bar" width={pct * 3} height="8" rx="3" /></svg>
          </Link>
        )
      })}</div> : <div className="empty">Nenhuma campanha ainda. No território, escolha um bairro e use “Criar campanha aqui”: o perfil, as ações e o convite já vêm preenchidos.</div>}
    </>
  )
}
