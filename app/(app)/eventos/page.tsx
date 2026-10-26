import Link from 'next/link'
import { exigirAcesso, pode } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { dataBR, hoje } from '@/lib/formato'
import { AMB, AMBN } from '@/lib/patrimonio'
import { ondeE } from '@/lib/comunicacao'
import { Cabecalho } from '@/components/Cabecalho'
import { Formulario } from '@/components/Formulario'
import { Capa } from '@/components/Capa'
import { salvarEvento, excluirEvento, salvarSite } from './acoes'

export const metadata = { title: 'Eventos e site' }

type Evento = { id: string; titulo: string; data: string; hora: string | null; ambiente: string | null; local: string | null; descricao: string | null; videos: string[]; no_site: boolean }
const sugestao = (nome: string) => nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

function Campos({ e }: { e?: Evento }) {
  return (
    <>
      <label className="f full">Evento<input type="text" name="titulo" required minLength={3} maxLength={120} defaultValue={e?.titulo} placeholder="Ex.: Conferência de jovens" /></label>
      <label className="f">Data<input type="date" name="data" required defaultValue={e?.data ?? ''} /></label>
      <label className="f">Hora (opcional)<input type="time" name="hora" defaultValue={e?.hora?.slice(0, 5) ?? ''} /></label>
      <label className="f">Ambiente do templo<select name="ambiente" defaultValue={e?.ambiente ?? ''}><option value="">Fora do templo / não se aplica</option>{AMB.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></label>
      <label className="f">Local ou endereço (opcional)<input type="text" name="local" maxLength={120} defaultValue={e?.local ?? ''} /></label>
      <label className="f full">Descrição (opcional)<textarea name="descricao" rows={3} maxLength={2000} defaultValue={e?.descricao ?? ''} /></label>
      <label className="f full">Vídeos ou álbum de fotos (links, um por linha)<textarea name="videos" rows={2} defaultValue={(e?.videos ?? []).join('\n')} placeholder="https://youtu.be/…" /></label>
      <label className="chk full"><input type="checkbox" name="no_site" defaultChecked={e?.no_site ?? true} />Mostrar no site da igreja</label>
    </>
  )
}

export default async function Eventos() {
  const s = await exigirAcesso('comunicacao')
  const edita = pode(s, 'comunicacao', 'editar')
  const supabase = await supabaseServidor()
  const [{ data }, { data: ig }] = await Promise.all([
    supabase.from('eventos').select('*').eq('igreja_id', s.igreja.id).order('data'),
    supabase.from('igrejas').select('nome, slug, site_publico, site_texto').eq('id', s.igreja.id).single(),
  ])
  const todos = (data ?? []) as Evento[]
  const prox = todos.filter((e) => e.data >= hoje()), pass = todos.filter((e) => e.data < hoje()).reverse()
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? ''

  const Cartao = ({ e }: { e: Evento }) => (
    <div className="card" id={`ev-${e.id}`}>
      <Capa video={e.videos[0]} rotulo={dataBR(e.data) + (e.hora ? ' · ' + e.hora.slice(0, 5) : '')} />
      <div className="row">{e.no_site ? <span className="pill ok">No site</span> : <span className="pill">Interno</span>}{e.ambiente && <span className="pill">{AMBN[e.ambiente]?.nome}</span>}</div>
      <h3>{e.titulo}</h3>
      {ondeE(e) && <span className="small muted">{ondeE(e)}</span>}
      {e.descricao && <p className="small" style={{ whiteSpace: 'pre-line' }}>{e.descricao}</p>}
      {e.videos.length > 0 && <div className="row">{e.videos.map((v, i) => <a key={i} className="btn ghost sm" href={v} target="_blank" rel="noopener noreferrer">{e.videos.length > 1 ? `Vídeo ${i + 1}` : 'Assistir'}</a>)}</div>}
      {edita && <div className="row">
        {e.data >= hoje() && <Link className="btn sm" href={`/mensagens?evento=${e.id}`}>Convidar</Link>}
        <details className="inline"><summary className="btn ghost sm">{e.data < hoje() ? 'Adicionar vídeos ou editar' : 'Editar'}</summary><Formulario acao={salvarEvento.bind(null, e.id)}><Campos e={e} /></Formulario></details>
        <form action={excluirEvento.bind(null, e.id)}><button className="btn ghost sm" type="submit">Excluir</button></form>
      </div>}
    </div>
  )

  return (
    <>
      <Cabecalho sobre="Comunicação" titulo="Eventos e site"
        texto="A agenda da igreja. O que for marcado para o site aparece na página pública, junto com os avisos e a Palavra do Pastor. Eventos dentro do templo também entram na conta do GUT da manutenção."
        acoes={<>{edita && <details className="inline"><summary className="btn">Novo evento</summary><Formulario acao={salvarEvento.bind(null, null)} enviar="Criar evento"><Campos /></Formulario></details>}
          {ig?.site_publico && ig.slug && <a className="btn ghost" href={`/site/${ig.slug}`} target="_blank" rel="noopener noreferrer">Abrir o site</a>}</>} />
      <div className="card"><header><h2>Próximos eventos</h2><small>{prox.length}</small></header>
        {prox.length ? <div className="grid g3">{prox.map((e) => <Cartao key={e.id} e={e} />)}</div> : <div className="empty">Nenhum evento marcado.</div>}
      </div>
      {pass.length > 0 && <div className="card"><header><h2>Galeria</h2><small>eventos que já aconteceram, com vídeos e fotos</small></header>
        <div className="grid g3">{pass.slice(0, 12).map((e) => <Cartao key={e.id} e={e} />)}</div>
      </div>}
      {s.papel === 'pastor' && <div className="card" id="site"><header><h2>Site da igreja</h2><small>{ig?.site_publico ? 'no ar' : 'desligado'}</small></header>
        <p className="small muted">Página pública, sem login, com os avisos, eventos e publicações marcados para o site. Nenhum dado de membro aparece.</p>
        <Formulario acao={salvarSite} enviar="Salvar site">
          <label className="f">Endereço<input type="text" name="slug" required minLength={3} maxLength={60} defaultValue={ig?.slug ?? sugestao(ig?.nome ?? '')} /></label>
          <label className="f full">Frase de boas-vindas (horários de culto, por exemplo)<input type="text" name="site_texto" maxLength={300} defaultValue={ig?.site_texto ?? ''} placeholder="Cultos aos domingos às 9h e 19h · Células durante a semana" /></label>
          <label className="chk full"><input type="checkbox" name="site_publico" defaultChecked={ig?.site_publico} />Site no ar</label>
        </Formulario>
        {ig?.slug && ig.site_publico && <p className="small">Endereço para divulgar: <a href={`/site/${ig.slug}`} target="_blank" rel="noopener noreferrer" className="mono">{base}/site/{ig.slug}</a></p>}
      </div>}
    </>
  )
}
