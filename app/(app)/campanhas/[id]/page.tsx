import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAcesso, pode } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { brl, dataBR } from '@/lib/formato'
import { CANAIS, PERFIL, perfilDe, numBR } from '@/lib/territorio'
import { Cabecalho } from '@/components/Cabecalho'
import { Formulario } from '@/components/Formulario'
import { CamposCampanha } from '../CamposCampanha'
import { salvarCampanha, mudarStatus, excluirCampanha } from '../acoes'

export const metadata = { title: 'Campanha' }

export default async function Campanha({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string }> }) {
  const s = await exigirAcesso('missao')
  const { id } = await params
  const { erro } = await searchParams
  const supabase = await supabaseServidor()
  const [{ data: c }, { data: pessoas }] = await Promise.all([
    supabase.from('campanhas').select('*').eq('id', id).maybeSingle(),
    supabase.from('pessoas').select('id, nome, status, etapa, primeira_visita, ultimo_contato').eq('campanha_id', id).eq('anonimizado', false).order('primeira_visita', { ascending: false }),
  ])
  if (!c) notFound()
  const edita = pode(s, 'missao', 'editar')
  const P = PERFIL[perfilDe(c.perfil)]
  const lista = pessoas ?? []
  const integrados = lista.filter((p) => p.status === 'congregado' || p.status === 'membro').length
  const pct = c.meta ? Math.min(100, (lista.length / c.meta) * 100) : 0
  const whats = c.convite ? `https://wa.me/?text=${encodeURIComponent(c.convite)}` : null

  return (
    <>
      <Cabecalho sobre={'Campanhas · ' + c.status} titulo={c.titulo}
        texto={[c.microarea, c.municipio && `${c.municipio}${c.uf ? ` (${c.uf})` : ''}`, P.nome].filter(Boolean).join(' · ')}
        acoes={<>
          <Link className="btn" href={`/pessoas/nova?status=visitante&campanha=${id}`}>Registrar visitante</Link>
          {c.microarea && c.municipio && c.uf && <Link className="btn ghost" href={`/alcance?${new URLSearchParams({ uf: c.uf, mun: c.municipio, ma: c.microarea })}#bairro`}>Ver bairro</Link>}
        </>} />
      {erro === 'excluir' && <div className="erro" role="alert">Não foi possível excluir. Só o pastor exclui campanhas.</div>}

      <div className="grid g4">
        <div className="card kpi"><span className="lbl">Visitantes</span><span className="val">{lista.length}</span><span className="sub">meta {c.meta} · {numBR(pct)}%</span></div>
        <div className="card kpi"><span className="lbl">Integrados</span><span className="val">{integrados}</span><span className="sub">congregados ou membros</span></div>
        <div className="card kpi"><span className="lbl">Orçamento</span><span className="val">{brl(c.orcamento)}</span><span className="sub">{lista.length ? brl(Number(c.orcamento) / lista.length) + ' por visitante' : 'sem visitantes ainda'}</span></div>
        <div className="card kpi"><span className="lbl">Período</span><span className="val" style={{ fontSize: '1.1rem' }}>{c.inicio ? dataBR(c.inicio) : '—'}</span><span className="sub">até {dataBR(c.fim)}{c.responsavel ? ` · ${c.responsavel}` : ''}</span></div>
      </div>

      <div className="grid g2">
        <div className="card"><header><h2>Visitantes desta campanha</h2><small>{lista.length} pessoa(s)</small></header>
          {lista.length ? <div className="list">{lista.map((p) => (
            <Link key={p.id} href={`/pessoas/${p.id}`} className="item" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="body"><b>{p.nome}</b><span className="small muted">{p.etapa ?? p.status} · primeira visita {dataBR(p.primeira_visita)}</span></div>
              <span className={`pill ${p.status === 'visitante' ? '' : 'ok'}`}>{p.status}</span>
            </Link>
          ))}</div> : <div className="empty">Ninguém ligado a esta campanha ainda. Use “Registrar visitante” ou escolha a campanha na ficha da pessoa.</div>}
        </div>
        <div className="card"><header><h2>Plano</h2><small>{P.hora}</small></header>
          {c.acoes && <ul className="small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>{c.acoes.split('\n').filter(Boolean).map((a: string) => <li key={a}>{a.replace(/^[-•]\s*/, '')}</li>)}</ul>}
          <div className="row">{(c.canais ?? []).map((k: string) => <span key={k} className="pill">{CANAIS[k] ?? k}</span>)}</div>
          {c.convite && <><h3>Convite</h3><p className="quote">{c.convite}</p>
            {whats && <div className="row"><a className="btn ghost sm" href={whats} target="_blank" rel="noopener noreferrer">Compartilhar no WhatsApp</a></div>}</>}
          {edita && <div className="row">
            {['Planejada', 'Em andamento', 'Em avaliação', 'Encerrada'].filter((x) => x !== c.status).map((x) => (
              <form key={x} action={mudarStatus.bind(null, id, x)}><button className="btn ghost sm" type="submit">Marcar como {x.toLowerCase()}</button></form>
            ))}
          </div>}
        </div>
      </div>

      {edita && (
        <details className="card"><summary className="btn ghost">Editar campanha</summary>
          <Formulario acao={salvarCampanha.bind(null, id)} enviar="Salvar campanha"><CamposCampanha c={c} /></Formulario>
          {s.papel === 'pastor' && <form action={excluirCampanha.bind(null, id)} className="row">
            <button className="btn ghost sm" type="submit">Excluir campanha</button>
            <span className="small muted">Os visitantes continuam cadastrados, só perdem a ligação com a campanha.</span>
          </form>}
        </details>
      )}
    </>
  )
}
