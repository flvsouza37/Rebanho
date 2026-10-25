import Link from 'next/link'
import { exigir } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { dataBR, hoje } from '@/lib/formato'
import { carregarEstrategia } from '@/lib/estrategia-dados'
import { FASES, FASEN, grauDe, medir } from '@/lib/estrategia'
import { Cabecalho } from '@/components/Cabecalho'
import { Formulario } from '@/components/Formulario'
import { salvarFase, avancar, marcarAcao, excluirPdca } from './acoes'

export const metadata = { title: 'Ciclos PDCA' }

type Acao = { t: string; feito: boolean }
type Hist = { data: string; fase: string; txt: string }

export default async function Pdca() {
  const s = await exigir(['pastor', 'secretaria', 'lider'])
  const edita = s.papel !== 'lider'
  const supabase = await supabaseServidor()
  const [{ data }, est] = await Promise.all([
    supabase.from('pdca').select('*').eq('igreja_id', s.igreja.id).order('criado_em', { ascending: false }),
    carregarEstrategia(s.igreja.id, edita),
  ])
  const todos = data ?? []
  const lista = [...todos].sort((a, b) => Number(a.fase === 'Concluído') - Number(b.fase === 'Concluído') || b.score - a.score)
  const padroes = todos.filter((p) => p.decisao === 'Padronizar')
  const conta = (f: string) => todos.filter((p) => p.fase === f).length

  return (
    <>
      <Cabecalho sobre="Estratégia" titulo="Ciclos PDCA"
        texto="Cada ameaça ou boa prática do diagnóstico vira um ciclo: planejar, executar, verificar no próximo diagnóstico e agir. O que deu certo vira padrão da igreja; o que não deu volta como novo ciclo."
        acoes={<><Link className="btn ghost" href="/kanban">Ver no kanban</Link>{edita && <Link className="btn ghost" href="/diagnostico?aba=insights">Insights</Link>}</>} />
      <div className="grid g4">
        {FASES.map(([k, n]) => <div className="card kpi" key={k}><span className="lbl">{k} · {n}</span><span className="val">{conta(k)}</span><span className="sub">{k === 'C' ? 'aguardando medição' : k === 'A' ? 'aguardando decisão' : ''}</span></div>)}
      </div>
      {lista.length ? (
        <div className="grid g2">
          {lista.map((p) => {
            const fim = p.fase === 'Concluído', ix = FASES.findIndex((f) => f[0] === p.fase), at = !fim && p.prazo && p.prazo < hoje()
            const m = medir(p.ref, est.atual, est.ctx), pct = String(p.ref ?? '').startsWith('camp') ? '%' : ''
            const acoes = (p.acoes ?? []) as Acao[], hist = (p.historico ?? []) as Hist[]
            const base = p.base == null ? null : Number(p.base), med = p.medido != null ? Number(p.medido) : p.fase === 'C' || p.fase === 'A' ? m : null
            return (
              <div className="card" key={p.id} id={`pd-${p.id}`}>
                <header>
                  <div className="row"><span className={`pill ${p.tipo === 'pratica' ? 'ok' : grauDe(p.score).k}`}>{p.tipo === 'pratica' ? 'Boa prática' : `Ameaça · GUT ${p.score}`}</span><span className="pill">Ciclo {p.ciclo}</span>{at && <span className="pill crit">Atrasado</span>}</div>
                  <small>{fim ? `concluído ${dataBR(p.feito_em)}` : `até ${dataBR(p.prazo)}`}</small>
                </header>
                <h3>{p.titulo}</h3>
                <div className="pdca-steps">{FASES.map(([k, n], i) => <span key={k} className={fim || i < ix ? 'ok' : i === ix ? 'on' : ''}><b>{k}</b>{n}</span>)}</div>
                <div className="w5">
                  <div className="k">Meta<small>Plan</small></div><div>{p.meta ?? '—'}{p.indicador && <span className="small muted"> · indicador: {p.indicador}</span>}</div>
                  <div className="k">Ações<small>Do</small></div>
                  <div className="grid" style={{ gap: 6, justifyItems: 'start' }}>
                    {acoes.length ? acoes.map((a, i) => edita && !fim
                      ? <form key={i} action={marcarAcao.bind(null, p.id, i)}><button type="submit" className="chk" aria-pressed={a.feito} style={{ textAlign: 'left' }}><input type="checkbox" checked={a.feito} readOnly tabIndex={-1} aria-hidden="true" />{a.t}</button></form>
                      : <span key={i} className="small">{a.feito ? '✓ ' : '○ '}{a.t}</span>) : '—'}
                    <span className="small muted">Responsável: {p.responsavel ?? 'a definir'}</span>
                  </div>
                  <div className="k">Medição<small>Check</small></div>
                  <div>Início: <b className="mono">{base ?? '—'}{base != null && pct}</b> · agora: <b className="mono">{med ?? '—'}{med != null && pct}</b>
                    {med != null && base != null && <> <span className={`pill ${med > base ? 'ok' : med < base ? 'crit' : ''}`}>{med > base ? 'melhorou' : med < base ? 'piorou' : 'igual'}</span></>}
                    {p.obs_check && <span className="small muted"> · {p.obs_check}</span>}</div>
                  <div className="k">Decisão<small>Act</small></div><div>{p.decisao ?? '—'}{p.obs_act && <span className="small muted"> · {p.obs_act}</span>}</div>
                </div>
                {edita && !fim && (
                  <>
                    <details className="inline"><summary className="btn sm">{({ P: 'Editar plano', D: 'Editar execução', C: 'Registrar medição', A: 'Decidir' } as Record<string, string>)[p.fase]}</summary>
                      <Formulario acao={salvarFase.bind(null, p.id)} enviar={p.fase === 'A' ? 'Registrar decisão' : 'Salvar'}>
                        {p.fase === 'P' && <>
                          <label className="f full">Meta<input type="text" name="meta" required defaultValue={p.meta ?? ''} /></label>
                          <label className="f full">Hipótese: por que vai funcionar<textarea name="hipotese" rows={2} defaultValue={p.hipotese ?? ''} /></label>
                          <label className="f">Indicador<input type="text" name="indicador" defaultValue={p.indicador ?? ''} /></label>
                          <label className="f">Prazo<input type="date" name="prazo" defaultValue={p.prazo ?? ''} /></label>
                        </>}
                        {p.fase === 'D' && <>
                          <label className="f full">Ações, uma por linha<textarea name="acoes" rows={4} defaultValue={acoes.map((a) => a.t).join('\n')} /></label>
                          <label className="f">Responsável<input type="text" name="responsavel" defaultValue={p.responsavel ?? ''} placeholder="Ex.: Coordenação de relacionamento" /></label>
                        </>}
                        {p.fase === 'C' && <>
                          <p className="small muted full">Início: {base ?? '—'} · último diagnóstico: {m ?? 'sem medição'}. Para medir de novo, crie um novo ciclo no diagnóstico e atualize a nota.</p>
                          <label className="f">Resultado medido<input type="text" inputMode="decimal" name="medido" defaultValue={p.medido ?? m ?? ''} /></label>
                          <label className="f full">O que se observou<textarea name="obs_check" rows={2} defaultValue={p.obs_check ?? ''} /></label>
                        </>}
                        {p.fase === 'A' && <>
                          <p className="small muted full">Início {base ?? '—'} · medido {med ?? '—'}. Padronizar registra a prática como padrão da igreja. Ajustar abre um novo ciclo com o resultado atual como ponto de partida.</p>
                          <label className="f">Decisão<select name="decisao" defaultValue={med != null && base != null && med > base ? 'Padronizar' : 'Ajustar e re-testar'}><option>Padronizar</option><option>Ajustar e re-testar</option><option>Abandonar</option></select></label>
                          <label className="f full">Por quê<textarea name="obs_act" rows={2} defaultValue={p.obs_act ?? ''} /></label>
                        </>}
                        {p.fase !== 'A' && <label className="chk full"><input type="checkbox" name="avanca" value="1" />Salvar e avançar para {FASEN[FASES[ix + 1][0]]}</label>}
                      </Formulario>
                    </details>
                    <div className="row">
                      {p.fase !== 'A' && <form action={avancar.bind(null, p.id)}><button className="btn ghost sm" type="submit">Avançar para {FASEN[FASES[ix + 1][0]]}</button></form>}
                      {s.papel === 'pastor' && <form action={excluirPdca.bind(null, p.id)}><button className="btn ghost sm" type="submit">Excluir</button></form>}
                    </div>
                  </>
                )}
                <details className="inline"><summary className="small muted">Caminho do ciclo ({hist.length})</summary>
                  <div className="list small">{hist.map((h, i) => <div className="item" key={i}><span className="mono muted">{dataBR(h.data)}</span><div className="body">{h.txt}</div><span className="pill">{h.fase}</span></div>)}</div>
                </details>
              </div>
            )
          })}
        </div>
      ) : <div className="empty">Nenhum ciclo ainda. No Diagnóstico, aba Insights, use “Abrir PDCA” numa ameaça ou “Re-testar no PDCA” numa boa prática.</div>}
      {padroes.length > 0 && (
        <div className="card"><header><h2>Práticas padronizadas</h2><small>o que a igreja testou e decidiu manter</small></header>
          <div className="list">{padroes.map((p) => <div className="item" key={p.id}><span className="stripe ok" /><div className="body"><b>{p.titulo}</b><span className="small muted">Ciclo {p.ciclo} · {dataBR(p.feito_em)} · {p.base ?? '—'} → {p.medido ?? '—'}{p.obs_act ? ' · ' + p.obs_act : ''}</span></div></div>)}</div>
        </div>
      )}
    </>
  )
}
