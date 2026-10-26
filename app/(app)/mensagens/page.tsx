import Link from 'next/link'
import { exigirAcesso, pode } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { dataBR } from '@/lib/formato'
import { CANAIS, type Canal } from '@/lib/comunicacao'
import { publicos } from '@/lib/comunicacao-dados'
import { Cabecalho } from '@/components/Cabecalho'
import { Compositor } from './Compositor'
import { salvarMensagem } from './acoes'

export const metadata = { title: 'Mensageria' }

// Aviso, publicação ou evento chegam já com o texto pronto.
async function textoDe(sp: { aviso?: string; post?: string; evento?: string }, site: string | null) {
  const supabase = await supabaseServidor()
  const link = site ? `\n\n${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/site/${site}` : ''
  if (sp.aviso) { const { data: a } = await supabase.from('avisos').select('titulo, corpo, publico').eq('id', sp.aviso).maybeSingle(); if (a) return { publico: a.publico, titulo: a.titulo, texto: `Olá, {nome}! ${a.titulo}\n\n${a.corpo}` } }
  if (sp.post) { const { data: p } = await supabase.from('posts').select('titulo, resumo, video, autor').eq('id', sp.post).maybeSingle(); if (p) return { publico: 'Toda a igreja', titulo: p.titulo, texto: `Olá, {nome}! ${p.titulo}\n\n${p.resumo}${p.video ? '\n\nAssista: ' + p.video : ''}\n\n${p.autor}${link}` } }
  if (sp.evento) { const { data: e } = await supabase.from('eventos').select('titulo, data, hora, local, descricao').eq('id', sp.evento).maybeSingle(); if (e) return { publico: 'Toda a igreja', titulo: e.titulo, texto: `Olá, {nome}! Você é nosso convidado: ${e.titulo}, ${dataBR(e.data)}${e.hora ? ' às ' + e.hora.slice(0, 5) : ''}${e.local ? ', ' + e.local : ''}.${e.descricao ? '\n\n' + e.descricao : ''}${link}` } }
  return { publico: 'Membros', titulo: '', texto: '' }
}

export default async function Mensagens({ searchParams }: { searchParams: Promise<{ aviso?: string; post?: string; evento?: string }> }) {
  const s = await exigirAcesso('comunicacao')
  const edita = pode(s, 'comunicacao', 'editar')
  const sp = await searchParams
  const supabase = await supabaseServidor()
  const [{ data: hist }, { data: ig }] = await Promise.all([
    supabase.from('mensagens').select('id, titulo, texto, publico, canais, alcance, criado_em').eq('igreja_id', s.igreja.id).order('criado_em', { ascending: false }).limit(50),
    supabase.from('igrejas').select('slug, site_publico').eq('id', s.igreja.id).single(),
  ])
  const pubs = edita ? (await publicos(s.igreja.id)).filter((p) => !p.includes('radar') || pode(s, 'radar')) : []
  const ini = edita ? await textoDe(sp, ig?.site_publico ? ig.slug : null) : { publico: 'Membros', titulo: '', texto: '' }
  const { data: ex } = edita ? await supabase.from('pessoas').select('nome').eq('igreja_id', s.igreja.id).eq('status', 'membro').order('nome').limit(1).maybeSingle() : { data: null }

  return (
    <>
      <Cabecalho sobre="Comunicação" titulo="Mensageria"
        texto="Escreva uma vez e veja como fica no WhatsApp, no e-mail e nas redes. O envio respeita o consentimento de cada pessoa: só recebe por WhatsApp ou e-mail quem autorizou." />
      {edita && <>
        <div className="banner">Os envios saem do seu WhatsApp e do seu e-mail: o Rebanho prepara um link por pessoa, já com o nome dela. O disparo automático entra quando a igreja tiver a API oficial do WhatsApp Business.</div>
        <Compositor acao={salvarMensagem} publicos={pubs} publico={ini.publico} titulo={ini.titulo} texto={ini.texto} exemplo={(ex?.nome ?? 'Maria').split(' ')[0]} />
      </>}
      <div className="card"><header><h2>Histórico</h2><small>{hist?.length ?? 0} mensagem(ns)</small></header>
        {hist?.length ? <div className="list">{hist.map((m) => (
          <div className="item" key={m.id}><div className="body">
            <Link href={`/mensagens/${m.id}`}><b>{m.titulo || m.texto.slice(0, 60)}</b></Link>
            <span className="small muted">{dataBR(m.criado_em.slice(0, 10))} · {m.publico} · {m.alcance} pessoa(s)</span>
            <div className="row">{(m.canais as Canal[]).map((c) => <span className="pill" key={c}>{CANAIS[c]?.n ?? c}</span>)}</div>
          </div></div>
        ))}</div> : <div className="empty">Nenhuma mensagem ainda.</div>}
      </div>
    </>
  )
}
