import { notFound } from 'next/navigation'
import { cache } from 'react'
import { supabaseServidor } from '@/lib/supabase/server'
import { dataBR, hoje } from '@/lib/formato'
import { TIPOS_POST, ondeE, youtubeId, type TipoPost } from '@/lib/comunicacao'
import { Capa } from '@/components/Capa'

type Site = {
  nome: string; cidade: string | null; uf: string | null; texto: string | null
  avisos: { titulo: string; corpo: string; categoria: string }[]
  eventos: { titulo: string; data: string; hora: string | null; ambiente: string | null; local: string | null; descricao: string | null; videos: string[] }[]
  posts: { id: string; tipo: TipoPost; titulo: string; resumo: string; corpo: string | null; video: string | null; autor: string; data: string }[]
}

// Página pública da igreja: a função site() só devolve o que foi marcado para o site.
const carregar = cache(async (slug: string) => {
  const supabase = await supabaseServidor()
  const { data } = await supabase.rpc('site', { p_slug: slug })
  return data as Site | null
})

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const s = await carregar((await params).slug)
  return s ? { title: { absolute: s.nome }, description: s.texto ?? `${s.nome}${s.cidade ? ' · ' + s.cidade : ''}` } : { title: 'Site não encontrado' }
}

export default async function SitePublico({ params }: { params: Promise<{ slug: string }> }) {
  const s = await carregar((await params).slug)
  if (!s) notFound()
  const fut = s.eventos.filter((e) => e.data >= hoje()), pass = s.eventos.filter((e) => e.data < hoje()).reverse()
  const pal = s.posts.find((p) => p.tipo === 'palavra'), outros = s.posts.filter((p) => p !== pal)
  const yt = pal?.video ? youtubeId(pal.video) : null

  return (
    <main className="site publico">
      <div className="hero">
        <span className="eyebrow">{[s.cidade, s.uf].filter(Boolean).join(' · ') || 'Bem-vindo'}</span>
        <h1>{s.nome}</h1>
        {s.texto && <p>{s.texto}</p>}
      </div>
      {s.avisos.length > 0 && <section className="sect"><h2>Avisos</h2>
        <div className="grid g3">{s.avisos.map((a, i) => <div className="card" key={i}><span className={`pill ${a.categoria === 'Urgente' ? 'crit' : 'acc'}`}>{a.categoria}</span><h3>{a.titulo}</h3><p className="small" style={{ whiteSpace: 'pre-line' }}>{a.corpo}</p></div>)}</div>
      </section>}
      {pal && <section className="sect"><span className="eyebrow">Palavra do Pastor · {dataBR(pal.data)}</span><h2>{pal.titulo}</h2>
        <p className="quote">{pal.resumo}</p>
        {yt && <iframe className="video" src={`https://www.youtube-nocookie.com/embed/${yt}`} title={pal.titulo} allow="encrypted-media; picture-in-picture" allowFullScreen loading="lazy" />}
        {pal.corpo && <details><summary className="small">Ler a mensagem completa</summary><p style={{ whiteSpace: 'pre-line' }}>{pal.corpo}</p></details>}
        <span className="small muted">{pal.autor}</span>
      </section>}
      <section className="sect"><h2>Próximos eventos</h2>
        {fut.length ? <div className="grid g3">{fut.map((e, i) => <div className="grid" style={{ gap: 6, alignContent: 'start' }} key={i}>
          <Capa video={e.videos[0]} rotulo={dataBR(e.data) + (e.hora ? ' · ' + e.hora.slice(0, 5) : '')} />
          <b>{e.titulo}</b>{ondeE(e) && <span className="small muted">{ondeE(e)}</span>}{e.descricao && <span className="small">{e.descricao}</span>}
        </div>)}</div> : <div className="empty">Nenhum evento marcado no momento.</div>}
      </section>
      {pass.length > 0 && <section className="sect"><h2>Galeria</h2>
        <div className="grid g3">{pass.map((e, i) => <div className="grid" style={{ gap: 6, alignContent: 'start' }} key={i}>
          <Capa video={e.videos[0]} rotulo={dataBR(e.data)} /><b>{e.titulo}</b>
          {e.videos.length > 0 && <div className="row">{e.videos.map((v, j) => <a key={j} className="btn ghost sm" href={v} target="_blank" rel="noopener noreferrer">{e.videos.length > 1 ? `Vídeo ${j + 1}` : 'Assistir'}</a>)}</div>}
        </div>)}</div>
      </section>}
      {outros.length > 0 && <section className="sect"><h2>Blog e vlog</h2>
        <div className="grid g3">{outros.map((p) => <article className="grid" style={{ gap: 6, alignContent: 'start' }} key={p.id}>
          <Capa video={p.video} rotulo={TIPOS_POST[p.tipo]} /><b>{p.titulo}</b><span className="small muted">{dataBR(p.data)} · {p.autor}</span><span className="small">{p.resumo}</span>
          {p.corpo && <details><summary className="small">Ler mais</summary><p className="small" style={{ whiteSpace: 'pre-line' }}>{p.corpo}</p></details>}
          {p.video && <a className="btn ghost sm" href={p.video} target="_blank" rel="noopener noreferrer">Assistir</a>}
        </article>)}</div>
      </section>}
      <footer className="sect small muted">{s.nome} · site feito com o Rebanho</footer>
    </main>
  )
}
