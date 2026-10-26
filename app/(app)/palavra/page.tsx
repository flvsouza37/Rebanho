import Link from 'next/link'
import { exigirAcesso, pode } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { dataBR, hoje } from '@/lib/formato'
import { TIPOS_POST, type TipoPost } from '@/lib/comunicacao'
import { Cabecalho } from '@/components/Cabecalho'
import { Formulario } from '@/components/Formulario'
import { Capa } from '@/components/Capa'
import { salvarPost, excluirPost } from './acoes'

export const metadata = { title: 'Palavra, blog e vlog' }

type Post = { id: string; tipo: TipoPost; titulo: string; resumo: string; corpo: string | null; video: string | null; autor: string; data: string; no_site: boolean }

function Campos({ p, autor, tipo }: { p?: Post; autor: string; tipo: TipoPost }) {
  return (
    <>
      <label className="f">Tipo<select name="tipo" defaultValue={p?.tipo ?? tipo}>{Object.entries(TIPOS_POST).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
      <label className="f">Data<input type="date" name="data" required defaultValue={p?.data ?? hoje()} /></label>
      <label className="f full">Título<input type="text" name="titulo" required minLength={3} maxLength={160} defaultValue={p?.titulo} /></label>
      <label className="f full">Resumo (vai nos cartões e nas mensagens)<textarea name="resumo" rows={3} required maxLength={600} defaultValue={p?.resumo} /></label>
      <label className="f full">Texto completo (opcional)<textarea name="corpo" rows={8} maxLength={20000} defaultValue={p?.corpo ?? ''} /></label>
      <label className="f">Link do vídeo (YouTube, Instagram…)<input type="url" name="video" maxLength={300} defaultValue={p?.video ?? ''} placeholder="https://youtu.be/…" /></label>
      <label className="f">Autor<input type="text" name="autor" required maxLength={120} defaultValue={p?.autor ?? autor} /></label>
      <label className="chk full"><input type="checkbox" name="no_site" defaultChecked={p?.no_site ?? true} />Publicar no site da igreja</label>
    </>
  )
}

export default async function Palavra({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const s = await exigirAcesso('comunicacao')
  const edita = pode(s, 'comunicacao', 'editar')
  const sp = await searchParams
  const aba = (sp.t && sp.t in TIPOS_POST ? sp.t : 'todos') as TipoPost | 'todos'
  const supabase = await supabaseServidor()
  const { data } = await supabase.from('posts').select('*').eq('igreja_id', s.igreja.id).order('data', { ascending: false })
  const todos = (data ?? []) as Post[], lista = todos.filter((p) => aba === 'todos' || p.tipo === aba)
  const autor = s.papel === 'pastor' ? 'Pastor' : ''

  return (
    <>
      <Cabecalho sobre="Comunicação" titulo="Palavra, blog e vlog"
        texto="O pastor escreve ou grava uma vez e escolhe para onde vai: site da igreja, WhatsApp, e-mail e redes. Nada de copiar e colar em cinco lugares."
        acoes={edita && <details className="inline"><summary className="btn">Nova publicação</summary>
          <Formulario acao={salvarPost.bind(null, null)} enviar="Publicar"><Campos autor={autor} tipo={aba === 'todos' ? 'palavra' : aba} /></Formulario>
        </details>} />
      <div className="tabs">
        {[['todos', 'Tudo'], ...Object.entries(TIPOS_POST)].map(([k, n]) => <Link key={k} className="tab" aria-selected={aba === k} href={k === 'todos' ? '/palavra' : `/palavra?t=${k}`}>{n} ({k === 'todos' ? todos.length : todos.filter((p) => p.tipo === k).length})</Link>)}
      </div>
      {lista.length ? <div className="grid g3">{lista.map((p) => (
        <div className="card" key={p.id} id={`po-${p.id}`}>
          <Capa video={p.video} rotulo={TIPOS_POST[p.tipo]} />
          <div className="row"><span className={`pill ${p.tipo === 'palavra' ? 'acc' : 'info'}`}>{TIPOS_POST[p.tipo]}</span><span className="small muted">{dataBR(p.data)} · {p.autor}</span>{p.no_site && <span className="pill ok">No site</span>}</div>
          <h3>{p.titulo}</h3>
          {p.tipo === 'palavra' ? <p className="quote">{p.resumo}</p> : <p className="small">{p.resumo}</p>}
          {p.corpo && <details className="inline"><summary className="small muted">Ler o texto completo</summary><p className="small" style={{ whiteSpace: 'pre-line' }}>{p.corpo}</p></details>}
          <div className="row">
            {edita && <Link className="btn sm" href={`/mensagens?post=${p.id}`}>Distribuir</Link>}
            {p.video && <a className="btn ghost sm" href={p.video} target="_blank" rel="noopener noreferrer">Assistir</a>}
            {edita && <details className="inline"><summary className="btn ghost sm">Editar</summary><Formulario acao={salvarPost.bind(null, p.id)}><Campos p={p} autor={autor} tipo={p.tipo} /></Formulario></details>}
            {edita && <form action={excluirPost.bind(null, p.id)}><button className="btn ghost sm" type="submit">Excluir</button></form>}
          </div>
        </div>
      ))}</div> : <div className="empty">Nenhuma publicação nesta seção.</div>}
    </>
  )
}
