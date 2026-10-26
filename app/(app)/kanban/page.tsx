import Link from 'next/link'
import { exigirAcesso, pode } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { dataBR, hoje } from '@/lib/formato'
import { KCOL, COL_CAMP, COL_PDCA, FASEN, grauDe } from '@/lib/estrategia'
import { COL_PLANO } from '@/lib/patrimonio'
import { Cabecalho } from '@/components/Cabecalho'
import { Formulario } from '@/components/Formulario'
import { Quadro } from './Quadro'
import { moverPorBotao, salvarTarefa, excluirTarefa } from './acoes'

export const metadata = { title: 'Kanban de execução' }

type Cartao = { id: string; col: string; t: string; orig: string; prazo: string | null; resp: string | null; urg: string; sub: string; feito: string | null; href?: string; apaga?: boolean; fixo?: boolean }
const dias = (d: string) => Math.round((new Date(d + 'T00:00:00').getTime() - new Date(hoje() + 'T00:00:00').getTime()) / 864e5)

export default async function Kanban({ searchParams }: { searchParams: Promise<{ o?: string; r?: string; tudo?: string; erro?: string }> }) {
  const s = await exigirAcesso('kanban')
  const sp = await searchParams
  const supabase = await supabaseServidor()
  const ig = s.igreja.id
  const [{ data: camps }, { data: ciclos }, { data: tarefas }, { data: planos }, { data: cargos }] = await Promise.all([
    supabase.from('campanhas').select('id, titulo, status, fim, responsavel, microarea').eq('igreja_id', ig),
    supabase.from('pdca').select('id, titulo, tipo, fase, prazo, responsavel, score, ciclo, feito_em').eq('igreja_id', ig),
    supabase.from('tarefas').select('*').eq('igreja_id', ig),
    pode(s, 'patrimonio') ? supabase.from('planos').select('id, oque, onde, quando, quem, grau, score, status, feito_em').eq('igreja_id', ig) : Promise.resolve({ data: [] }),
    pode(s, 'patrimonio') ? supabase.from('cargos').select('id, nome').eq('igreja_id', ig) : Promise.resolve({ data: [] }),
  ])
  const nomeDe = (id: string | null) => (cargos ?? []).find((c: { id: string }) => c.id === id)?.nome ?? null
  const todos: Cartao[] = [
    ...(camps ?? []).map((k) => ({ id: 'campanhas:' + k.id, col: COL_CAMP[k.status] ?? 'afazer', t: k.titulo, orig: 'Captação', prazo: k.fim, resp: k.responsavel, urg: 'mod', sub: 'Campanha' + (k.microarea ? ' · ' + k.microarea : ''), feito: k.status === 'Encerrada' ? k.fim : null, href: `/campanhas/${k.id}`, fixo: !pode(s, 'missao', 'editar') })),
    ...(ciclos ?? []).map((p) => ({ id: 'pdca:' + p.id, col: COL_PDCA[p.fase] ?? 'afazer', t: p.titulo, orig: 'PDCA', prazo: p.prazo, resp: p.responsavel, urg: p.tipo === 'pratica' ? 'ok' : grauDe(p.score).k, sub: `${p.tipo === 'pratica' ? 'Boa prática' : 'Ameaça'} · ciclo ${p.ciclo} · ${FASEN[p.fase]}`, feito: p.feito_em, href: `/pdca#pd-${p.id}`, fixo: p.fase === 'Concluído' || !pode(s, 'pdca', 'editar') })),
    ...(planos ?? []).map((p) => ({ id: 'planos:' + p.id, col: COL_PLANO[p.status] ?? 'afazer', t: p.oque, orig: 'Manutenção', prazo: p.quando, resp: nomeDe(p.quem), urg: p.grau, sub: `5W2H · GUT ${p.score}${p.onde ? ' · ' + p.onde : ''}`, feito: p.feito_em, href: `/planos#pl-${p.id}`, fixo: !pode(s, 'patrimonio', 'editar') })),
    ...(tarefas ?? []).map((x) => ({ id: 'tarefas:' + x.id, col: x.coluna, t: x.titulo, orig: x.origem, prazo: x.prazo, resp: x.responsavel, urg: x.prioridade, sub: x.descricao ?? 'Tarefa', feito: x.feito_em, apaga: pode(s, 'kanban', 'editar'), fixo: !pode(s, 'kanban', 'editar') })),
  ]
  const origens = ['Todas', ...new Set(todos.map((c) => c.orig))]
  const resps = [...new Set(todos.map((c) => c.resp).filter((x): x is string => !!x))].sort()
  const lista = todos.filter((c) => (!sp.o || c.orig === sp.o) && (!sp.r || c.resp === sp.r))
  const atras = lista.filter((c) => c.col !== 'feito' && c.prazo && c.prazo < hoje())
  const feitos30 = todos.filter((c) => c.col === 'feito' && c.feito && dias(c.feito) >= -30).length
  const link = (o: Record<string, string | undefined>) => '/kanban?' + new URLSearchParams(Object.entries({ o: sp.o, r: sp.r, tudo: sp.tudo, ...o }).filter(([, v]) => v) as [string, string][])

  return (
    <>
      <Cabecalho sobre="Estratégia" titulo="Kanban de execução"
        texto="Todas as ações num só quadro: campanhas de captação, ciclos PDCA e tarefas avulsas. Arraste o cartão ou use os botões. A coluna Feito é o caminho já percorrido."
        acoes={pode(s, 'kanban', 'editar') && <details className="inline"><summary className="btn">Nova tarefa</summary>
          <Formulario acao={salvarTarefa} enviar="Criar tarefa">
            <label className="f full">O que fazer<input type="text" name="titulo" required minLength={3} maxLength={160} /></label>
            <label className="f">Origem<select name="origem" defaultValue="Geral"><option>Geral</option><option>Manutenção</option><option>Captação</option><option>PDCA</option></select></label>
            <label className="f">Responsável<input type="text" name="responsavel" maxLength={120} /></label>
            <label className="f">Prazo<input type="date" name="prazo" defaultValue={new Date(Date.now() + 14 * 864e5).toLocaleDateString('sv-SE')} /></label>
            <label className="f">Prioridade<select name="prioridade" defaultValue="mod"><option value="crit">Crítica</option><option value="alto">Alta</option><option value="mod">Moderada</option><option value="baixo">Baixa</option></select></label>
            <label className="f full">Detalhes<textarea name="descricao" rows={2} maxLength={1000} /></label>
          </Formulario>
        </details>} />
      {sp.erro && <div className="erro" role="alert">{sp.erro}</div>}
      <div className="row">
        <div className="tabs" style={{ borderBottom: 0 }}>
          {origens.map((o) => <Link key={o} className="tab" aria-selected={(sp.o ?? 'Todas') === o} href={link({ o: o === 'Todas' ? '' : o })}>{o} ({o === 'Todas' ? todos.length : todos.filter((c) => c.orig === o).length})</Link>)}
        </div>
        {resps.length > 0 && <div className="row small">Responsável: <Link className={`pill${!sp.r ? ' acc' : ''}`} href={link({ r: '' })}>Todos</Link>{resps.map((r) => <Link key={r} className={`pill${sp.r === r ? ' acc' : ''}`} href={link({ r })}>{r}</Link>)}</div>}
      </div>
      <div className="grid g4">
        <div className="card kpi"><span className="lbl">A realizar</span><span className="val">{lista.filter((c) => c.col === 'afazer' || c.col === 'fazendo').length}</span><span className="sub">{lista.filter((c) => c.col === 'fazendo').length} em execução</span></div>
        <div className={`card kpi${atras.length ? ' alert' : ''}`}><span className="lbl">Atrasadas</span><span className="val">{atras.length}</span><span className="sub">prazo vencido</span></div>
        <div className="card kpi"><span className="lbl">Aguardando verificação</span><span className="val">{lista.filter((c) => c.col === 'verificar').length}</span><span className="sub">medir antes de fechar</span></div>
        <div className="card kpi"><span className="lbl">Realizadas em 30 dias</span><span className="val">{feitos30}</span><span className="sub">{todos.filter((c) => c.col === 'feito').length} no total</span></div>
      </div>
      <Quadro>
        {KCOL.map(([k, n], ix) => {
          let cs = lista.filter((c) => c.col === k).sort((a, b) => k === 'feito' ? (b.feito ?? '').localeCompare(a.feito ?? '') : (a.prazo ?? '9').localeCompare(b.prazo ?? '9'))
          const tot = cs.length
          if (k === 'feito' && !sp.tudo) cs = cs.slice(0, 8)
          return (
            <section className="kcol" data-kcol={k} key={k} aria-label={n}>
              <header><b>{n}</b><span className="cnt">{tot}</span>{k === 'fazendo' && tot > 8 && <span className="pill warn" title="Muitas frentes ao mesmo tempo">acima de 8</span>}</header>
              {cs.map((c) => {
                const d = c.prazo ? dias(c.prazo) : NaN
                return (
                  <div className="kcard" draggable={!c.fixo} data-kcard={c.id} key={c.id}>
                    <span className={`stripe ${c.urg}`} />
                    <div className="body">
                      <div className="spread"><span className="pill">{c.orig}</span>{c.col !== 'feito' && d < 0 ? <span className="pill crit">{-d}d atraso</span> : c.col === 'feito' ? <span className="small muted">{c.feito ? dataBR(c.feito) : ''}</span> : c.prazo ? <span className="small muted">até {dataBR(c.prazo)}</span> : null}</div>
                      <b>{c.t}</b><span className="small muted">{c.sub}</span>{c.resp && <span className="small">{c.resp}</span>}
                      <div className="row kmv">
                        {!c.fixo && ix > 0 && <form action={moverPorBotao.bind(null, c.id, KCOL[ix - 1][0])}><button className="btn ghost sm" type="submit" aria-label={`Voltar para ${KCOL[ix - 1][1]}`}>‹ {KCOL[ix - 1][1]}</button></form>}
                        {!c.fixo && ix < 3 && <form action={moverPorBotao.bind(null, c.id, KCOL[ix + 1][0])}><button className="btn ghost sm" type="submit" aria-label={`Avançar para ${KCOL[ix + 1][1]}`}>{KCOL[ix + 1][1]} ›</button></form>}
                        {c.href && <Link className="btn ghost sm" href={c.href}>Abrir</Link>}
                        {c.apaga && <form action={excluirTarefa.bind(null, c.id.slice(8))}><button className="btn ghost sm" type="submit">Excluir</button></form>}
                      </div>
                    </div>
                  </div>
                )
              })}
              {!cs.length && <div className="empty small">Solte um cartão aqui.</div>}
              {k === 'feito' && tot > 8 && <Link className="btn ghost sm" href={link({ tudo: sp.tudo ? '' : '1' })}>{sp.tudo ? 'Mostrar só os recentes' : `Ver todo o caminho (${tot})`}</Link>}
            </section>
          )
        })}
      </Quadro>
    </>
  )
}
