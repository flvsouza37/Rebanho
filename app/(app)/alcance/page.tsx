import Link from 'next/link'
import { exigir } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { brl } from '@/lib/formato'
import { PERFIL, CANAIS, analisar, quantil, semAcento, numBR, type Analise, type Microarea } from '@/lib/territorio'
import { Cabecalho } from '@/components/Cabecalho'
import { definirMunicipio } from '../campanhas/acoes'

export const metadata = { title: 'Marketing evangelístico' }

const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO']
const COLS = 'microarea, municipio, uf, cresc_pop_aa, cresc_renda_aa, area_km2, populacao, densidade, domicilios, renda_media, pea_dia'

// Gráfico de bolhas: crescimento × densidade, tamanho = população. Cada bolha abre o bairro.
function Mapa({ lista, sel, link }: { lista: Analise[]; sel: string; link: (m: string) => string }) {
  const w = 600, h = 300, pad = { l: 46, r: 16, t: 14, b: 34 }, iw = w - pad.l - pad.r, ih = h - pad.t - pad.b
  const xs = lista.map((x) => x.cresc_pop_aa)
  const xmin = Math.floor(Math.min(0, ...xs)), xmax = Math.ceil(Math.max(...xs))
  const lg = (v: number) => Math.log10(Math.max(1, v))
  const ys = lista.map((x) => lg(x.densidade)), ymin = Math.floor(Math.min(...ys)), ymax = Math.ceil(Math.max(...ys))
  const X = (v: number) => pad.l + ((v - xmin) / (xmax - xmin || 1)) * iw
  const Y = (v: number) => pad.t + ih - ((lg(v) - ymin) / (ymax - ymin || 1)) * ih
  const pmax = Math.max(...lista.map((x) => x.populacao))
  const R = (p: number) => 3 + Math.sqrt(p / pmax) * 14
  const med = quantil(xs, 0.5)
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Mapa de oportunidade dos bairros">
      {Array.from({ length: ymax - ymin + 1 }, (_, i) => ymin + i).map((e) => {
        const yy = pad.t + ih - ((e - ymin) / (ymax - ymin || 1)) * ih
        return <g key={'y' + e}><line className="gridl" x1={pad.l} x2={w - pad.r} y1={yy} y2={yy} /><text className="ax" x={pad.l - 6} y={yy + 3} textAnchor="end">{numBR(10 ** e)}</text></g>
      })}
      {Array.from({ length: xmax - xmin + 1 }, (_, i) => xmin + i).map((v) => <text key={'x' + v} className="ax" x={X(v)} y={h - 16} textAnchor="middle">{v}%</text>)}
      <line x1={X(med)} x2={X(med)} y1={pad.t} y2={pad.t + ih} style={{ stroke: 'var(--muted)', strokeDasharray: '3 3' }} />
      <text className="ax" x={X(med) + 4} y={pad.t + 9}>mediana {numBR(med, 1)}%</text>
      {[...lista].sort((a, b) => b.populacao - a.populacao).map((x) => (
        <a key={x.microarea} href={link(x.microarea)} aria-label={`${x.microarea}: índice ${x.ipe}`}>
          <circle cx={X(x.cresc_pop_aa).toFixed(1)} cy={Y(x.densidade).toFixed(1)} r={R(x.populacao).toFixed(1)}
            style={{ fill: PERFIL[x.perfil].cor, fillOpacity: x.microarea === sel ? 0.75 : 0.45, stroke: x.microarea === sel ? 'var(--fg)' : PERFIL[x.perfil].cor, strokeWidth: x.microarea === sel ? 2.5 : 1 }}>
            <title>{`${x.microarea}: ${numBR(x.populacao)} hab., ${numBR(x.cresc_pop_aa, 1)}% a.a., índice ${x.ipe}`}</title>
          </circle>
        </a>
      ))}
      <text className="ax" x={pad.l + iw / 2} y={h - 2} textAnchor="middle">Crescimento da população ao ano →</text>
      <text className="ax" transform={`translate(10 ${pad.t + ih / 2}) rotate(-90)`} textAnchor="middle">Habitantes por km² (escala log) →</text>
    </svg>
  )
}

export default async function Alcance({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await exigir(['pastor', 'secretaria', 'lider'])
  const sp = await searchParams
  const supabase = await supabaseServidor()
  const uf = UFS.includes((sp.uf ?? '').toUpperCase()) ? sp.uf!.toUpperCase() : (s.igreja.uf ?? '').toUpperCase()
  const podeCriar = s.papel !== 'lider'

  const { data: munsUf } = uf ? await supabase.from('microareas').select('municipio').eq('uf', uf).limit(2000) : { data: [] }
  const municipios = [...new Set((munsUf ?? []).map((m) => m.municipio))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const pedido = sp.mun ?? (uf === (s.igreja.uf ?? '').toUpperCase() ? s.igreja.cidade : '')
  const mun = municipios.find((m) => semAcento(m) === semAcento(pedido)) ?? ''
  const daIgreja = !!mun && semAcento(mun) === semAcento(s.igreja.cidade) && uf === (s.igreja.uf ?? '').toUpperCase()

  const cab = <Cabecalho sobre="Missão" titulo="Marketing evangelístico"
    texto="Onde estão as pessoas que a igreja ainda não alcançou, quando elas estão disponíveis e qual abordagem conversa com cada bairro."
    acoes={<><Link className="btn ghost" href="/campanhas">Campanhas</Link>{podeCriar && <Link className="btn" href="/campanhas/nova">Nova campanha</Link>}</>} />

  const seletor = (
    <form className="card" action="/alcance">
      <div className="form">
        <label className="f">Estado
          <select name="uf" defaultValue={uf}><option value="">Escolha</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select>
        </label>
        <label className="f">Município
          <select name="mun" defaultValue={mun} disabled={!municipios.length}>
            <option value="">{municipios.length ? 'Escolha' : 'Escolha o estado e clique em Ver'}</option>
            {municipios.map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
        <label className="f full">Filtrar bairros<input type="text" name="q" defaultValue={sp.q ?? ''} placeholder="Digite parte do nome" /></label>
      </div>
      <div className="spread">
        <span className="small muted">{s.igreja.cidade ? <>Cidade da igreja: <b>{s.igreja.cidade}{s.igreja.uf ? ` (${s.igreja.uf})` : ''}</b></> : 'A igreja ainda não tem cidade cadastrada.'}</span>
        <button className="btn ghost sm" type="submit">Ver</button>
      </div>
    </form>
  )

  if (!mun) {
    return <>{cab}{seletor}<div className="empty">{s.igreja.cidade && uf
      ? `A planilha não tem microáreas de ${s.igreja.cidade} (${uf}). Ela cobre 212 municípios: escolha outro para comparar.`
      : 'Escolha o estado e o município para ver o ranking dos bairros, o mapa de oportunidade e as ações sugeridas.'}</div></>
  }

  const [{ data: linhas }, { data: camps }] = await Promise.all([
    supabase.from('microareas').select(COLS).eq('uf', uf).eq('municipio', mun),
    supabase.from('campanhas').select('id, titulo, microarea, status').eq('igreja_id', s.igreja.id).eq('municipio', mun),
  ])
  const todos = analisar(((linhas ?? []) as Microarea[]).map((x) => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, typeof v === 'string' && !['microarea', 'municipio', 'uf'].includes(k) ? Number(v) : v])) as Microarea))
  const q = semAcento(sp.q)
  const lista = q ? todos.filter((x) => semAcento(x.microarea).includes(q)) : todos
  const sel = lista.find((x) => x.microarea === sp.ma) ?? lista[0] ?? todos[0]
  const P = PERFIL[sel.perfil]
  const link = (m: string) => `/alcance?${new URLSearchParams({ uf, mun, ...(sp.q ? { q: sp.q } : {}), ma: m })}#bairro`
  const campsDe = (m: string) => (camps ?? []).filter((c) => c.microarea === m)

  const pop = todos.reduce((t, x) => t + x.populacao, 0), dom = todos.reduce((t, x) => t + x.domicilios, 0)
  const novos = todos.reduce((t, x) => t + x.novos, 0)
  const cres = todos.reduce((t, x) => t + x.populacao * x.cresc_pop_aa, 0) / pop
  const renda = todos.reduce((t, x) => t + x.populacao * x.renda_media, 0) / pop
  const dorm = todos.filter((x) => x.fluxo < 0.6).reduce((t, x) => t + x.populacao, 0) / pop
  const porPerfil: Record<string, number> = {}
  todos.forEach((x) => { porPerfil[x.perfil] = (porPerfil[x.perfil] ?? 0) + x.populacao })
  const medTp = quantil(todos.map((x) => x.cresc_pop_aa), 0.5)
  const comCamp = new Set((camps ?? []).map((c) => c.microarea))
  const funil = [
    { n: 'Bairros de ' + mun, v: todos.length, s: numBR(pop) + ' hab.' },
    { n: 'Com índice 50 ou mais', v: todos.filter((x) => x.ipe >= 50).length, s: numBR(todos.filter((x) => x.ipe >= 50).reduce((t, x) => t + x.populacao, 0)) + ' hab.' },
    { n: 'Crescendo acima da mediana', v: todos.filter((x) => x.ipe >= 50 && x.cresc_pop_aa >= medTp).length, s: numBR(todos.filter((x) => x.ipe >= 50 && x.cresc_pop_aa >= medTp).reduce((t, x) => t + x.novos, 0)) + ' novos moradores/ano' },
    { n: 'Já com campanha da igreja', v: todos.filter((x) => comCamp.has(x.microarea)).length, s: (camps?.length ?? 0) + ' campanha(s)' },
  ]
  const proximos = todos.filter((x) => !comCamp.has(x.microarea)).slice(0, 3)
  const novaCamp = (x: Analise) => `/campanhas/nova?${new URLSearchParams({ uf, mun, ma: x.microarea, perfil: x.perfil })}`

  return (
    <>
      {cab}{seletor}
      {!daIgreja && s.papel === 'pastor' && (
        <form className="banner" action={definirMunicipio.bind(null, mun, uf)}>
          Você está vendo {mun} ({uf}), que não é a cidade cadastrada da igreja. <button className="btn ghost sm" type="submit">Definir {mun} como cidade da igreja</button>
        </form>
      )}
      <div className="grid g4">
        <div className="card kpi"><span className="lbl">População de {mun}</span><span className="val">{numBR(pop / 1000)} mil</span><span className="sub">{numBR(dom / 1000)} mil domicílios · {todos.length} microáreas</span></div>
        <div className="card kpi"><span className="lbl">Novos moradores por ano</span><span className="val">{numBR(novos)}</span><span className="sub">crescimento médio de {numBR(cres, 1)}% a.a.</span></div>
        <div className="card kpi"><span className="lbl">Renda média ponderada</span><span className="val">{brl(renda)}</span><span className="sub">por pessoa, segundo a planilha</span></div>
        <div className="card kpi"><span className="lbl">Moram em bairro dormitório</span><span className="val">{numBR(dorm * 100)}%</span><span className="sub">alcance melhor à noite e no fim de semana</span></div>
      </div>

      {!lista.length && <div className="empty">Nenhum bairro de {mun} com “{sp.q}”. A planilha usa microáreas, que às vezes juntam bairros vizinhos com outro nome.</div>}

      <div className="grid split">
        <div className="card"><header><h2>Mapa de oportunidade</h2><small>cada bolha é uma microárea; tamanho = população</small></header>
          <Mapa lista={todos} sel={sel.microarea} link={link} />
          <div className="legend">{Object.entries(PERFIL).filter(([k]) => porPerfil[k]).map(([k, p]) => <span key={k}><i style={{ background: p.cor }} />{p.nome} · {numBR((porPerfil[k] / pop) * 100)}%</span>)}</div>
        </div>
        <div className="card" id="bairro"><header><h2>{sel.microarea}</h2><span className={`pill ${P.cls}`}>{P.nome}</span></header>
          <div className="row"><span className="score" style={{ fontSize: '2rem', fontFamily: 'var(--f-display)' }}>{sel.ipe}</span><span className="small muted">Índice de potencial evangelístico, de 0 a 100, comparado com as outras microáreas de {mun}</span></div>
          <p className="small">{P.porque}</p>
          <div className="w5">
            <div className="k">População</div><div className="mono">{numBR(sel.populacao)} hab. · {numBR(sel.domicilios)} domicílios</div>
            <div className="k">Crescimento</div><div className="mono">{numBR(sel.cresc_pop_aa, 2)}% a.a. ≈ {numBR(sel.novos)} novos/ano</div>
            <div className="k">Densidade</div><div className="mono">{numBR(sel.densidade)} hab./km²</div>
            <div className="k">Renda média</div><div className="mono">{brl(sel.renda_media)}</div>
            <div className="k">Fluxo diurno</div><div className="mono">{numBR(sel.fluxo, 2)}× a população</div>
            <div className="k">Melhor horário</div><div>{P.hora}</div>
          </div>
          <h3>Ações sugeridas</h3>
          <ul className="small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>{P.acoes.map((a) => <li key={a}>{a}</li>)}</ul>
          <div className="row">{P.canais.map((c) => <span key={c} className="pill">{CANAIS[c]}</span>)}</div>
          {podeCriar && <div className="row"><Link className="btn" href={novaCamp(sel)}>Criar campanha aqui</Link></div>}
          {campsDe(sel.microarea).length > 0 && <span className="small muted">Campanhas aqui: {campsDe(sel.microarea).map((c, i) => <span key={c.id}>{i ? ', ' : ''}<Link href={`/campanhas/${c.id}`}>{c.titulo}</Link></span>)}</span>}
        </div>
      </div>

      <div className="grid g2">
        <div className="card"><header><h2>Funil de bairros</h2><small>do total da cidade até onde a igreja já atua</small></header>
          <div className="list">{funil.map((f, i) => (
            <div className="item" key={f.n}><div className="body">
              <div className="spread"><b>{f.n}</b><span className="mono">{f.v}{i > 0 && <span className="muted small"> ({numBR((f.v / todos.length) * 100)}%)</span>}</span></div>
              <span className="small muted">{f.s}</span>
              <svg className="chart" viewBox="0 0 300 10" aria-hidden="true"><rect className="barbg" width="300" height="10" rx="3" /><rect className="bar" x={(300 - (f.v / todos.length) * 300) / 2} width={(f.v / todos.length) * 300} height="10" rx="3" /></svg>
            </div></div>
          ))}</div>
        </div>
        <div className="card"><header><h2>Próximas campanhas recomendadas</h2><small>maior índice entre os bairros sem campanha</small></header>
          {proximos.length ? <div className="list">{proximos.map((x, i) => (
            <div className="item" key={x.microarea}><div className="body"><b>{i + 1}ª · {x.microarea}</b>
              <span className="small muted">Índice {x.ipe} · {numBR(x.populacao)} hab. · {PERFIL[x.perfil].hora}</span><span className="small">{PERFIL[x.perfil].acoes[0]}.</span></div>
              <div className="row"><Link className="btn ghost sm" href={link(x.microarea)}>Ver</Link>{podeCriar && <Link className="btn sm" href={novaCamp(x)}>Criar</Link>}</div>
            </div>
          ))}</div> : <div className="empty">Todos os bairros já têm campanha.</div>}
        </div>
      </div>

      <div className="card scroll-x"><header><h2>Ranking dos bairros de {mun}</h2><small>{q ? `${lista.length} de ${todos.length} · ` : ''}toque num bairro para ver o detalhe</small></header>
        <table>
          <thead><tr><th>#</th><th>Microárea</th><th>Perfil</th><th className="num">Índice</th><th className="num">População</th><th className="num">Cresc. a.a.</th><th className="num">Novos/ano</th><th className="num">hab./km²</th><th className="num">Renda</th><th className="num">Fluxo</th><th>Campanhas</th></tr></thead>
          <tbody>{lista.map((x, i) => (
            <tr key={x.microarea} style={x.microarea === sel.microarea ? { background: 'var(--accent-soft)' } : undefined}>
              <td className="mono">{i + 1}</td><td><Link href={link(x.microarea)}><b>{x.microarea}</b></Link></td>
              <td><span className={`pill ${PERFIL[x.perfil].cls}`}>{PERFIL[x.perfil].nome}</span></td>
              <td className="num mono"><b>{x.ipe}</b></td><td className="num mono">{numBR(x.populacao)}</td><td className="num mono">{numBR(x.cresc_pop_aa, 1)}%</td>
              <td className="num mono">{numBR(x.novos)}</td><td className="num mono">{numBR(x.densidade)}</td><td className="num mono">{brl(x.renda_media)}</td><td className="num mono">{numBR(x.fluxo, 2)}</td>
              <td>{campsDe(x.microarea).length ? <span className="pill ok">{campsDe(x.microarea).length}</span> : <span className="small muted">—</span>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className="small muted">Fonte: planilha População - Municípios (microáreas). Índice: 30% crescimento da população, 25% densidade, 20% população, 15% moradores por domicílio e 10% crescimento da renda, comparados dentro do município.</p>
    </>
  )
}
