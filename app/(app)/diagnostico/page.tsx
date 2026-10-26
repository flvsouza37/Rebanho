import Link from 'next/link'
import { exigirAcesso, pode } from '@/lib/sessao'
import { dataBR } from '@/lib/formato'
import { carregarEstrategia } from '@/lib/estrategia-dados'
import { GRUPOS, GN, PROPOS, PN, LADOS, NOTA, cel, lacuna, insights, evidencia, grauDe, type Diagnostico, type GrupoId, type Insight, type PropId, type Lado } from '@/lib/estrategia'
import { supabaseServidor } from '@/lib/supabase/server'
import { Cabecalho } from '@/components/Cabecalho'
import { Formulario } from '@/components/Formulario'
import { novoDiagnostico, concluirDiagnostico, excluirDiagnostico, salvarCelula, salvarItem, removerItem, abrirPdca, tarefaDoInsight } from './acoes'

export const metadata = { title: 'Diagnóstico ministerial' }

const ABAS = [['muda', 'Análise MUDA'], ['diakonia', 'Matriz Diakonia'], ['insights', 'Insights'], ['ciclos', 'Ciclos']] as const
const faixa = (n: number | null) => (n == null ? '' : n <= 0 ? 'h0' : n <= 2 ? 'h2' : n === 3 ? 'h3' : 'h4')

// Pirâmide de expectativas (a multidão deseja mais) e pirâmide invertida de demandas (a liderança precisa mais).
function Piramides({ d }: { d: Diagnostico }) {
  const gp = (g: GrupoId, k: 'exp' | 'dem') => { const l = d.muda?.[g]?.[k] ?? []; return l.length ? l.reduce((s, x) => s + lacuna(x), 0) / l.length / 20 : null }
  const cls = (v: number | null) => (v == null ? 'barbg' : v < 0.3 ? 'fo' : v < 0.45 ? 'fm' : v < 0.6 ? 'fa' : 'fc')
  const W = 150, top = 34, bot = 244, H = bot - top, cut = [top, top + H / 3, top + (2 * H) / 3, bot], ord: GrupoId[] = ['apostolos', 'discipulos', 'multidao']
  const tri = (cx: number, inv: boolean) => ord.map((g, i) => {
    const ya = cut[i], yb = cut[i + 1], w = (y: number) => (inv ? (W * (bot - y)) / H : (W * (y - top)) / H), v = gp(g, inv ? 'dem' : 'exp'), ty = ya + (yb - ya) * (inv ? 0.36 : 0.64)
    return (
      <g key={g}><title>{`${GN[g]}: ${v == null ? 'sem itens' : 'lacuna média ' + Math.round(v * 100) + '%'}`}</title>
        <polygon className={cls(v)} opacity={0.88} points={`${cx - w(ya)},${ya} ${cx + w(ya)},${ya} ${cx + w(yb)},${yb} ${cx - w(yb)},${yb}`} />
        <text className="lblb" x={cx} y={ty} textAnchor="middle" style={{ fill: v == null ? 'var(--muted)' : '#fff' }}><tspan x={cx} dy={-2}>{GN[g]}</tspan><tspan x={cx} dy={15}>{v == null ? 'sem itens' : Math.round(v * 100) + '%'}</tspan></text>
      </g>
    )
  })
  return (
    <svg className="chart" viewBox="0 0 660 286" role="img" aria-label="Pirâmides de expectativas e demandas">
      <text className="lbl" x={165} y={18} textAnchor="middle" style={{ fontWeight: 700 }}>EXPECTATIVAS · o que cada grupo deseja</text>
      <text className="lbl" x={495} y={18} textAnchor="middle" style={{ fontWeight: 700 }}>DEMANDAS · o que cada grupo precisa</text>
      {tri(165, false)}{tri(495, true)}
      <text className="ax" x={330} y={276} textAnchor="middle">Cor = lacuna média (importância × falta de atendimento). Verde: atendido · vermelho: grande lacuna.</text>
    </svg>
  )
}

function CamposItem({ t = '', imp = 3, at = 3 }: { t?: string; imp?: number; at?: number }) {
  const op = (sel: number) => [1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)
  return (
    <>
      <label className="f full">Item<input type="text" name="t" required minLength={3} maxLength={160} defaultValue={t} /></label>
      <label className="f">Importância (1 a 5)<select name="imp" defaultValue={imp}>{op(imp)}</select></label>
      <label className="f">Atendimento hoje (1 a 5)<select name="at" defaultValue={at}>{op(at)}</select></label>
    </>
  )
}

export default async function DiagnosticoPagina({ searchParams }: { searchParams: Promise<{ aba?: string; cel?: string; todas?: string; erro?: string }> }) {
  const s = await exigirAcesso('diagnostico')
  const edita = pode(s, 'diagnostico', 'editar'), fazPdca = pode(s, 'pdca', 'editar'), fazTarefa = pode(s, 'kanban', 'editar')
  const sp = await searchParams
  const aba = ABAS.some((a) => a[0] === sp.aba) ? sp.aba! : 'muda'
  const { diags, atual: d, anterior: ant, ctx } = await carregarEstrategia(s.igreja.id)
  const L = insights(d, ant, ctx)
  const supabase = await supabaseServidor()
  const { data: abertos } = await supabase.from('pdca').select('id, chave, fase').eq('igreja_id', s.igreja.id).neq('fase', 'Concluído')
  const pdcaDe = new Map((abertos ?? []).map((p) => [p.chave, p]))

  const cab = (
    <Cabecalho sobre="Estratégia" titulo="Diagnóstico ministerial"
      texto="A Análise MUDA compara o que cada grupo deseja com o que precisa. A Matriz Diakonia mostra como cada grupo serve e é servido nos cinco propósitos. Ao concluir, o sistema gera ameaças e boas práticas que entram no PDCA e no kanban."
      acoes={edita && <>
        {d && d.status !== 'Concluído' && <form action={concluirDiagnostico.bind(null, d.id)}><button className="btn" type="submit">Concluir e gerar insights</button></form>}
        <form action={novoDiagnostico}><button className={d ? 'btn ghost' : 'btn'} type="submit">{d ? 'Novo ciclo de diagnóstico' : 'Começar diagnóstico'}</button></form>
      </>} />
  )
  if (!d) return <>{cab}{sp.erro && <div className="erro" role="alert">{sp.erro}</div>}<div className="empty">Nenhum diagnóstico ainda. Use “Começar diagnóstico”: a estrutura das duas ferramentas já vem montada.</div></>

  const [cp, cg, cl] = (sp.cel ?? '').split('|') as [PropId, GrupoId, Lado]
  const celAtual = edita && cp && cg && cl && PN[cp] && GN[cg] ? cel(d, cp, cg, cl) : null
  const am = L.filter((x) => x.tipo === 'ameaca'), pr = L.filter((x) => x.tipo === 'pratica')

  const Card = ({ x }: { x: Insight }) => {
    const pd = pdcaDe.get(x.id), g = grauDe(x.score)
    return (
      <div className="item">
        <span className={`stripe ${x.tipo === 'pratica' ? 'ok' : g.k}`} />
        <div className="body">
          <div className="spread" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}><b>{x.titulo}</b>{x.tipo === 'ameaca' ? <span className="score" title={`G ${x.g} × U ${x.u} × T ${x.t}`}>{x.score}</span> : <span className="pill ok">{x.status}</span>}</div>
          <span className="small muted">{x.porque}</span>
          <div className="row small"><span className="pill">{x.origem}</span>{x.tipo === 'ameaca' && <span className={`pill ${g.k}`}>{g.n}</span>}<span className="muted">Área: {x.area}</span></div>
          <div className="row">
            {pd ? <Link className="btn ghost sm" href={`/pdca#pd-${pd.id}`}>Ver PDCA</Link>
              : fazPdca && <form action={abrirPdca.bind(null, x.id)}><button className="btn sm" type="submit">{x.tipo === 'pratica' ? 'Re-testar no PDCA' : 'Abrir PDCA'}</button></form>}
            {fazTarefa && <form action={tarefaDoInsight.bind(null, x.id)}><button className="btn ghost sm" type="submit">Tarefa no kanban</button></form>}
            {x.captar && pode(s, 'missao', 'editar') && <Link className="btn ghost sm" href="/alcance">Criar campanha</Link>}
            {x.campanha && <Link className="btn ghost sm" href={`/campanhas/${x.campanha}`}>Ver campanha</Link>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {cab}
      {sp.erro && <div className="erro" role="alert">{sp.erro}</div>}
      <div className="banner"><b>{d.titulo}</b> · {dataBR(d.data)} · <span className={`pill ${d.status === 'Concluído' ? 'ok' : 'warn'}`}>{d.status}</span>{ant && <span className="small">Comparado com {ant.titulo} ({dataBR(ant.data)})</span>}</div>
      <div className="tabs" role="tablist">
        {ABAS.map(([k, n]) => <Link key={k} className="tab" role="tab" aria-selected={aba === k} href={`/diagnostico?aba=${k}`}>{n}{k === 'insights' ? ` (${L.length})` : k === 'ciclos' ? ` (${diags.length})` : ''}</Link>)}
      </div>

      {aba === 'muda' && <>
        <div className="card"><header><h2>Expectativas × demandas</h2><small>quanto maior a lacuna, mais quente a faixa</small></header><Piramides d={d} /></div>
        <div className="grid g3">
          {GRUPOS.map(([g, n, desc]) => (
            <div className="card" key={g} id={`g-${g}`}>
              <header><h2>{n}</h2><small>{desc}</small></header>
              {(['exp', 'dem'] as const).map((k) => (
                <div className="grid" style={{ gap: 8 }} key={k}>
                  <h3>{k === 'exp' ? 'O que deseja' : 'O que precisa'}</h3>
                  <div className="list">
                    {(d.muda?.[g]?.[k] ?? []).map((it, i) => {
                      const gap = lacuna(it), a = (ant?.muda?.[g]?.[k] ?? []).find((x) => x.t === it.t)
                      return (
                        <div className="item" key={it.t}>
                          <span className={`stripe ${gap >= 12 ? 'crit' : gap >= 8 ? 'alto' : gap >= 4 ? 'mod' : 'ok'}`} />
                          <div className="body">
                            <div className="spread" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}><b>{it.t}</b><span className="score" title="Lacuna de 0 a 20">{gap}</span></div>
                            <span className="small muted">importância {it.imp} · atendimento {it.at}{a && a.at !== it.at ? ` (antes ${a.at})` : ''}</span>
                            {edita && <details className="inline"><summary className="small">Editar</summary>
                              <Formulario acao={salvarItem.bind(null, d.id, g, k, i)} enviar="Salvar item" extra={<button className="btn ghost sm" formAction={removerItem.bind(null, d.id, g, k, i)} formNoValidate>Remover</button>}>
                                <CamposItem t={it.t} imp={it.imp} at={it.at} />
                              </Formulario>
                            </details>}
                          </div>
                        </div>
                      )
                    })}
                    {!(d.muda?.[g]?.[k] ?? []).length && <div className="empty small">Nenhum item.</div>}
                  </div>
                  {edita && <details className="inline"><summary className="small">Adicionar {k === 'exp' ? 'expectativa' : 'demanda'}</summary>
                    <Formulario acao={salvarItem.bind(null, d.id, g, k, null)} enviar="Adicionar"><CamposItem /></Formulario>
                  </details>}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="card flat"><h3>Como ler</h3><p className="small muted">Cada item recebe importância e atendimento de 1 a 5. A lacuna é importância × (5 − atendimento), de 0 a 20. Lacuna 12 ou mais vira ameaça; importância 5 com atendimento 4 ou mais vira boa prática. Se a igreja atende bem os desejos e mal as necessidades de um grupo, o sistema avisa: o grupo fica satisfeito sem crescer.</p></div>
      </>}

      {aba === 'diakonia' && <>
        {celAtual && (
          <div className="card" id="editar">
            <header><h2>{PN[cp]} · {GN[cg]} · {cl === 'serve' ? 'como serve' : 'como é servido'}</h2><Link className="btn ghost sm" href="/diagnostico?aba=diakonia">Fechar</Link></header>
            {cel(ant, cp, cg, cl).n != null && <span className="small muted">Ciclo anterior: nota {cel(ant, cp, cg, cl).n}{cel(ant, cp, cg, cl).t ? ` (“${cel(ant, cp, cg, cl).t}”)` : ''}</span>}
            <Formulario acao={salvarCelula.bind(null, d.id, cp, cg, cl)} enviar="Salvar nota">
              <label className="f">Nota<select name="n" defaultValue={celAtual.n ?? 3}>{NOTA.map((t, i) => <option key={i} value={i}>{t}</option>)}</select></label>
              <label className="f full">Como acontece hoje<textarea name="t" rows={3} maxLength={300} defaultValue={celAtual.t} placeholder="Ex.: recepção acolhe, mas ninguém procura quem falta" /></label>
            </Formulario>
          </div>
        )}
        <div className="card scroll-x">
          <table className="diak">
            <thead>
              <tr><th rowSpan={2}>Propósitos</th>{GRUPOS.map(([g, n]) => <th key={g} colSpan={2} className="gh">{n}</th>)}<th rowSpan={2}>O que o sistema mostra</th></tr>
              <tr>{GRUPOS.map(([g]) => LADOS.map(([l, ln]) => <th key={g + l} className="sub">{ln}</th>))}</tr>
            </thead>
            <tbody>
              {PROPOS.map(([p, pn], i) => (
                <tr key={p}>
                  <th>{i + 1} · {pn}</th>
                  {GRUPOS.map(([g]) => LADOS.map(([l]) => {
                    const c = cel(d, p, g, l), a = cel(ant, p, g, l).n
                    return (
                      <td key={g + l}>
                        {(() => {
                          const dentro = <><b className="mono">{c.n ?? '·'}{a != null && c.n != null && a !== c.n && <small>{c.n > a ? '▲' : '▼'}{a}</small>}</b><span>{c.t}</span></>
                          const rot = `${pn}, ${GN[g]}, ${l === 'serve' ? 'como serve' : 'como é servido'}: nota ${c.n ?? 'sem nota'}`
                          return edita
                            ? <Link className={`hcel ${faixa(c.n)}`} href={`/diagnostico?aba=diakonia&cel=${p}|${g}|${l}#editar`} aria-label={rot}>{dentro}</Link>
                            : <div className={`hcel ${faixa(c.n)}`} aria-label={rot}>{dentro}</div>
                        })()}
                      </td>
                    )
                  }))}
                  <td className="small muted evid">{evidencia(p, ctx)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="legend"><span><i style={{ background: 'var(--crit-soft)' }} />0 · não acontece</span><span><i style={{ background: 'var(--warn-soft)' }} />1 a 2 · fraco</span><span><i style={{ background: 'var(--surface-2)' }} />3 · razoável</span><span><i style={{ background: 'var(--ok-soft)' }} />4 a 5 · forte</span><span>▲▼ mudança desde o ciclo anterior</span></div>
        <div className="card flat"><h3>O que mudou em relação à planilha</h3><p className="small muted">Cada célula ganhou uma nota de 0 a 5 além da descrição, para medir e comparar ciclos. A última coluna traz o que o sistema já sabe (pessoas e campanhas) para confrontar a percepção com os dados. Toque numa célula para preencher.</p></div>
      </>}

      {aba === 'insights' && <>
        {d.status !== 'Concluído' && <div className="banner warn">Prévia: o diagnóstico ainda está em preenchimento. Os insights se atualizam a cada nota.</div>}
        <div className="grid g4">
          <div className="card kpi"><span className="lbl">Ameaças ministeriais</span><span className="val">{am.length}</span><span className="sub">{am.filter((x) => x.score >= 60).length} altas ou críticas</span></div>
          <div className="card kpi"><span className="lbl">Boas práticas</span><span className="val">{pr.length}</span><span className="sub">{pr.filter((x) => x.status === 'Re-testar').length} para re-testar</span></div>
          <div className="card kpi"><span className="lbl">Cruzamentos com o sistema</span><span className="val">{L.filter((x) => x.origem === 'Cruzamento').length}</span><span className="sub">campanhas e integração</span></div>
          <Link href="/pdca" className="card kpi kpi-link"><span className="lbl">Em PDCA</span><span className="val">{abertos?.length ?? 0}</span><span className="sub">ciclos abertos</span></Link>
        </div>
        <div className="grid g2">
          <div className="card"><header><h2>Ameaças</h2><small>GUT: gravidade × urgência × tendência</small></header>
            {am.length ? <div className="list">{(sp.todas ? am : am.slice(0, 6)).map((x) => <Card key={x.id} x={x} />)}</div> : <div className="empty">Nenhuma ameaça neste ciclo.</div>}
            {am.length > 6 && <Link className="btn ghost sm" href={sp.todas ? '/diagnostico?aba=insights' : '/diagnostico?aba=insights&todas=1'}>{sp.todas ? 'Mostrar só as 6 maiores' : `Ver todas as ${am.length} ameaças`}</Link>}
          </div>
          <div className="card"><header><h2>Boas práticas para valorizar</h2><small>re-testar e padronizar</small></header>
            {pr.length ? <div className="list">{pr.map((x) => <Card key={x.id} x={x} />)}</div> : <div className="empty">Nenhuma prática forte ainda.</div>}
          </div>
        </div>
      </>}

      {aba === 'ciclos' && <>
        <div className="card"><div className="list">
          {diags.map((x, i) => {
            const li = insights(x, diags[i + 1], ctx)
            return (
              <div className="item" key={x.id}>
                <div className="body"><b>{x.titulo}</b><span className="small muted">{dataBR(x.data)} · {li.filter((y) => y.tipo === 'ameaca').length} ameaças · {li.filter((y) => y.tipo === 'pratica').length} boas práticas</span></div>
                <span className={`pill ${x.status === 'Concluído' ? 'ok' : 'warn'}`}>{x.status}</span>
                {s.papel === 'pastor' && i > 0 && <form action={excluirDiagnostico.bind(null, x.id)}><button className="btn ghost sm" type="submit">Excluir</button></form>}
              </div>
            )
          })}
        </div></div>
        <p className="small muted">Cada ciclo copia o anterior para você só atualizar as notas. A comparação entre ciclos é a verificação (C) do PDCA.</p>
      </>}
    </>
  )
}
