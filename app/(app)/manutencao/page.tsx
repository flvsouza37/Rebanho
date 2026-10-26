import Link from 'next/link'
import { exigirAcesso, pode } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { brl, dataBR, hoje } from '@/lib/formato'
import { AMB, AMBN, DISC, GRAU_P, gut, respPor, nomeCargo, proximaPreventiva, type Agenda, type Ameaca, type Cargo } from '@/lib/patrimonio'
import { Cabecalho } from '@/components/Cabecalho'
import { Formulario } from '@/components/Formulario'
import { salvarAmeaca, resolverAmeaca, gerarPlano, salvarPreventiva, preventivaFeita, excluirPreventiva, preventivaNoGut } from './acoes'

export const metadata = { title: 'Manutenção GUT' }

const NOTAS = {
  g: ['Gravidade', 'Sem dano', 'Pouco grave', 'Grave', 'Muito grave', 'Risco à vida'],
  u: ['Urgência', 'Pode esperar', 'Pouco urgente', 'Logo', 'Com urgência', 'Imediato'],
  t: ['Tendência', 'Não piora', 'Piora a longo prazo', 'Piora a médio prazo', 'Piora em pouco tempo', 'Piora rápido'],
} as const

function CamposAmeaca({ a }: { a?: Ameaca }) {
  return (
    <>
      <label className="f full">O que está acontecendo<input type="text" name="titulo" required minLength={3} maxLength={160} defaultValue={a?.titulo} placeholder="Ex.: Goteira sobre a mesa de som" /></label>
      <label className="f">Ambiente<select name="ambiente" required defaultValue={a?.ambiente ?? ''}><option value="" disabled>Escolha</option>{AMB.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></label>
      <label className="f">Disciplina<select name="disciplina" required defaultValue={a?.disciplina ?? ''}><option value="" disabled>Escolha</option>{DISC.map((d) => <option key={d}>{d}</option>)}</select></label>
      {(['g', 'u', 't'] as const).map((k) => (
        <label className="f" key={k}>{NOTAS[k][0]}<select name={k} defaultValue={a?.[k] ?? 3}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} · {NOTAS[k][n]}</option>)}</select></label>
      ))}
      <label className="f">Custo estimado (R$)<input type="text" inputMode="decimal" name="custo" defaultValue={a ? String(a.custo).replace('.', ',') : ''} placeholder="0,00" /></label>
      <label className="f">Quem relatou (opcional)<input type="text" name="origem" maxLength={80} defaultValue={a?.origem ?? ''} placeholder="Ex.: Zelador, vistoria" /></label>
      <label className="f full">Detalhes (opcional)<textarea name="descricao" rows={2} maxLength={1000} defaultValue={a?.descricao ?? ''} /></label>
    </>
  )
}

export default async function Manutencao({ searchParams }: { searchParams: Promise<{ amb?: string; erro?: string }> }) {
  const s = await exigirAcesso('patrimonio')
  const sp = await searchParams
  const edita = pode(s, 'patrimonio', 'editar')
  const supabase = await supabaseServidor()
  const ig = s.igreja.id
  const [{ data: am }, { data: cg }, { data: pv }, { data: ev }] = await Promise.all([
    supabase.from('ameacas').select('*').eq('igreja_id', ig).order('data', { ascending: false }),
    supabase.from('cargos').select('id, titulo, nome, pessoa_id, areas').eq('igreja_id', ig),
    supabase.from('preventivas').select('*').eq('igreja_id', ig).order('item'),
    supabase.from('eventos').select('titulo, data, ambiente').eq('igreja_id', ig).gte('data', hoje()).not('ambiente', 'is', null),
  ])
  const todas = (am ?? []) as Ameaca[], cargos = (cg ?? []) as Cargo[]
  const abertas = todas.filter((a) => a.status !== 'resolvida'), resolvidas = todas.filter((a) => a.status === 'resolvida')
  const notas = new Map(abertas.map((a) => [a.id, gut(a, abertas, (ev ?? []) as Agenda[])]))
  const fila = abertas.filter((a) => !sp.amb || a.ambiente === sp.amb).sort((a, b) => notas.get(b.id)!.score - notas.get(a.id)!.score)
  const prevs = (pv ?? []).map((p) => ({ ...p, prox: proximaPreventiva(p) }))
  const vencidas = prevs.filter((p) => p.prox < hoje())
  const em30 = new Date(Date.now() + 30 * 864e5).toLocaleDateString('sv-SE')
  const criticas = abertas.filter((a) => notas.get(a.id)!.grau.k === 'crit').length
  const porAmb = (id: string) => abertas.filter((a) => a.ambiente === id).map((a) => notas.get(a.id)!.score)

  return (
    <>
      <Cabecalho sobre="Patrimônio" titulo="Manutenção GUT"
        texto="Cada problema do prédio recebe nota de Gravidade, Urgência e Tendência. A nota sobe quando os problemas se somam: água perto de fiação, telhado sobre o som, crianças por perto. Daí sai o plano 5W2H com responsável e prazo."
        acoes={<>{edita && <details className="inline"><summary className="btn">Registrar ameaça</summary>
          <Formulario acao={salvarAmeaca.bind(null, null)} enviar="Registrar"><CamposAmeaca /></Formulario>
        </details>}<Link className="btn ghost" href="/planos">Planos 5W2H</Link></>} />
      {sp.erro && <div className="erro" role="alert">{sp.erro}</div>}
      <div className="grid g4">
        <div className={`card kpi${criticas ? ' alert' : ''}`}><span className="lbl">Ameaças críticas</span><span className="val">{criticas}</span><span className="sub">prazo de {GRAU_P[0].dias} dias</span></div>
        <div className="card kpi"><span className="lbl">Ameaças abertas</span><span className="val">{abertas.filter((a) => a.status === 'aberta').length}</span><span className="sub">sem plano ainda</span></div>
        <div className="card kpi"><span className="lbl">Em plano</span><span className="val">{abertas.filter((a) => a.status === 'em plano').length}</span><span className="sub">com 5W2H em andamento</span></div>
        <div className={`card kpi${vencidas.length ? ' alert' : ''}`}><span className="lbl">Preventivas vencidas</span><span className="val">{vencidas.length}</span><span className="sub">de {prevs.length} cadastradas</span></div>
      </div>

      <div className="card"><header><h2>Planta do templo</h2><small>{sp.amb ? <Link href="/manutencao">mostrar todos os ambientes</Link> : 'toque num ambiente para filtrar'}</small></header>
        <div className="planta">
          {AMB.map((x) => {
            const sc = porAmb(x.id), max = sc.length ? Math.max(...sc) : 0
            return (
              <Link key={x.id} href={sp.amb === x.id ? '/manutencao' : `/manutencao?amb=${x.id}`} className={`room${sc.length ? ' ' + GRAU_P.find((g) => max >= g.min)!.k : ''}`} style={{ gridArea: x.id }} aria-pressed={sp.amb === x.id}>
                <b>{x.nome}</b><span className="row small"><span className="mono">{sc.length ? max : '—'}</span><span className="muted">{sc.length ? `${sc.length} ameaça${sc.length > 1 ? 's' : ''}` : 'ok'}</span></span>
              </Link>
            )
          })}
        </div>
        <div className="legend small muted">{GRAU_P.map((g) => <span key={g.k} className={`pill ${g.k}`}>{g.n} · {g.min}+ · {g.dias} dias</span>)}</div>
      </div>

      <div className="card"><header><h2>{sp.amb ? `Ameaças em ${AMBN[sp.amb]?.nome ?? sp.amb}` : 'Fila de ameaças'}</h2><small>da maior para a menor nota corrigida</small></header>
        {fila.length ? <div className="list">{fila.map((a) => {
          const r = notas.get(a.id)!, resp = respPor(cargos, a.disciplina) ?? respPor(cargos, 'Patrimônio')
          const juntas = r.rel.filter((id) => abertas.find((o) => o.id === id)?.status === 'aberta')
          return (
            <div className="item" key={a.id} id={`am-${a.id}`}>
              <span className={`stripe ${r.grau.k}`} />
              <div className="body">
                <div className="spread" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                  <b>{a.titulo}</b>
                  <span className="score" title={`G${a.g} × U${a.u} × T${a.t} = ${r.base}${r.fator ? `, corrigido em +${Math.round(r.fator * 100)}%` : ''}`}>{r.score}</span>
                </div>
                <div className="row small">
                  <span className={`pill ${r.grau.k}`}>{r.grau.n}</span><span className="pill">{AMBN[a.ambiente]?.nome ?? a.ambiente}</span><span className="pill">{a.disciplina}</span>
                  {a.status === 'em plano' && <span className="pill acc">Em plano</span>}
                  <span className="muted">G{a.g} U{a.u} T{a.t} = {r.base}{Number(a.custo) > 0 && ` · ${brl(a.custo)}`} · {dataBR(a.data)}{a.origem && ` · ${a.origem}`}</span>
                </div>
                {a.descricao && <span className="small">{a.descricao}</span>}
                {r.porque.length > 0 && <div className="why">{r.porque.map((w) => <span key={w[0]}><b>{w[0]} (+{Math.round(w[2] * 100)}%)</b>: {w[1]}</span>)}</div>}
                <span className="small muted">Responsável pela área: {nomeCargo(resp)}{!resp && cargos.length === 0 && <> · <Link href="/cargos">defina os cargos</Link></>}</span>
                {edita && (
                  <div className="row">
                    {a.status === 'aberta' ? <>
                      <form action={gerarPlano.bind(null, [a.id])}><button className="btn sm" type="submit">Gerar 5W2H</button></form>
                      {juntas.length > 0 && <form action={gerarPlano.bind(null, [a.id, ...juntas])}><button className="btn ghost sm" type="submit">5W2H integrado com {juntas.length} correlata{juntas.length > 1 ? 's' : ''}</button></form>}
                      <form action={resolverAmeaca.bind(null, a.id)}><button className="btn ghost sm" type="submit">Já resolvida</button></form>
                    </> : a.plano_id && <Link className="btn ghost sm" href={`/planos#pl-${a.plano_id}`}>Ver plano</Link>}
                    <details className="inline"><summary className="btn ghost sm">Editar</summary>
                      <Formulario acao={salvarAmeaca.bind(null, a.id)}><CamposAmeaca a={a} /></Formulario>
                    </details>
                  </div>
                )}
              </div>
            </div>
          )
        })}</div> : <div className="empty">{sp.amb ? 'Nenhuma ameaça aberta neste ambiente.' : edita ? 'Nenhuma ameaça aberta. Use “Registrar ameaça” quando algo no prédio precisar de atenção.' : 'Nenhuma ameaça aberta.'}</div>}
      </div>

      <div className="card" id="preventivas"><header><h2>Manutenção preventiva</h2><small>o que vence vira ameaça no GUT com um toque</small></header>
        {prevs.length ? <div className="scroll-x"><table>
          <thead><tr><th>Item</th><th>Ambiente</th><th>A cada</th><th>Última</th><th>Próxima</th>{edita && <th />}</tr></thead>
          <tbody>{prevs.sort((a, b) => a.prox.localeCompare(b.prox)).map((p) => (
            <tr key={p.id}>
              <td><b>{p.item}</b>{p.norma && <div className="small muted">{p.norma}</div>}</td>
              <td>{AMBN[p.ambiente]?.nome ?? p.ambiente}<div className="small muted">{p.disciplina}</div></td>
              <td>{p.meses} {p.meses > 1 ? 'meses' : 'mês'}</td>
              <td>{dataBR(p.ultima)}</td>
              <td>{dataBR(p.prox)} {p.prox < hoje() ? <span className="pill crit">Vencida</span> : p.prox <= em30 ? <span className="pill warn">Em 30 dias</span> : null}</td>
              {edita && <td><div className="row">
                <form action={preventivaFeita.bind(null, p.id)}><button className="btn ghost sm" type="submit">Feita hoje</button></form>
                {p.prox < hoje() && <form action={preventivaNoGut.bind(null, p.id)}><button className="btn ghost sm" type="submit">Levar ao GUT</button></form>}
                <form action={excluirPreventiva.bind(null, p.id)}><button className="btn ghost sm" type="submit" aria-label={`Excluir ${p.item}`}>Excluir</button></form>
              </div></td>}
            </tr>
          ))}</tbody>
        </table></div> : <div className="empty">Nenhuma preventiva cadastrada. Comece pelo extintor, AVCB, limpeza da caixa d’água e PMOC do ar-condicionado.</div>}
        {edita && <details className="inline"><summary className="btn ghost sm">Nova preventiva</summary>
          <Formulario acao={salvarPreventiva} enviar="Cadastrar">
            <label className="f full">Item<input type="text" name="item" required minLength={3} maxLength={120} placeholder="Ex.: Recarga dos extintores" /></label>
            <label className="f">Exigência ou norma (opcional)<input type="text" name="norma" maxLength={120} placeholder="Ex.: NBR 12962" /></label>
            <label className="f">Ambiente<select name="ambiente" required defaultValue=""><option value="" disabled>Escolha</option>{AMB.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></label>
            <label className="f">Disciplina<select name="disciplina" required defaultValue=""><option value="" disabled>Escolha</option>{DISC.map((d) => <option key={d}>{d}</option>)}</select></label>
            <label className="f">A cada quantos meses<input type="number" name="meses" min={1} max={120} required defaultValue={12} /></label>
            <label className="f">Última vez feita<input type="date" name="ultima" required defaultValue={hoje()} /></label>
          </Formulario>
        </details>}
      </div>

      {resolvidas.length > 0 && <details className="card flat"><summary><b>Resolvidas ({resolvidas.length})</b></summary>
        <div className="list small">{resolvidas.slice(0, 30).map((a) => <div className="item" key={a.id}><span className="stripe ok" /><div className="body"><b>{a.titulo}</b><span className="muted">{AMBN[a.ambiente]?.nome ?? a.ambiente} · {a.disciplina} · registrada {dataBR(a.data)}</span></div>{a.plano_id && <Link className="small" href={`/planos#pl-${a.plano_id}`}>plano</Link>}</div>)}</div>
      </details>}
    </>
  )
}
