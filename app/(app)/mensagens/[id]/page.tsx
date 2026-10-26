import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAcesso, pode } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { dataBR } from '@/lib/formato'
import { linkWhats } from '@/lib/radar'
import { CANAIS, personalizar, type Canal } from '@/lib/comunicacao'
import { destinatarios } from '@/lib/comunicacao-dados'
import { Cabecalho } from '@/components/Cabecalho'

export const metadata = { title: 'Enviar mensagem' }

const GRUPO_EMAIL = 40

export default async function Envio({ params }: { params: Promise<{ id: string }> }) {
  const s = await exigirAcesso('comunicacao', 'editar')
  const { id } = await params
  const supabase = await supabaseServidor()
  const { data: m } = await supabase.from('mensagens').select('*').eq('id', id).eq('igreja_id', s.igreja.id).maybeSingle()
  if (!m) notFound()
  const canais = m.canais as Canal[]
  const ps = await destinatarios(s.igreja.id, m.publico, pode(s, 'radar'), pode(s, 'pastoral'))
  const wa = ps.map((p) => ({ p, url: p.lgpd_whats ? linkWhats(p.telefone, personalizar(m.texto, p.nome)) : null }))
  const comWa = wa.filter((x) => x.url), semWa = wa.length - comWa.length
  const emails = ps.filter((p) => p.lgpd_email && p.email && /@/.test(p.email)).map((p) => p.email as string)
  const grupos = Array.from({ length: Math.ceil(emails.length / GRUPO_EMAIL) }, (_, i) => emails.slice(i * GRUPO_EMAIL, (i + 1) * GRUPO_EMAIL))
  // No e-mail em grupo (cópia oculta) não dá para personalizar: {nome} vira uma saudação geral.
  const corpoEmail = m.texto.replaceAll('{nome}', 'irmão(ã)')
  const mailto = (g: string[]) => `mailto:?bcc=${encodeURIComponent(g.join(','))}&subject=${encodeURIComponent(m.titulo ?? 'Recado da igreja')}&body=${encodeURIComponent(corpoEmail)}`

  return (
    <>
      <Cabecalho sobre="Mensageria" titulo={m.titulo || 'Enviar mensagem'} texto={`${m.publico} · ${ps.length} pessoa(s) · preparada em ${dataBR(m.criado_em.slice(0, 10))}`}
        acoes={<Link className="btn ghost" href="/mensagens">Voltar</Link>} />
      <div className="card flat"><p className="small" style={{ whiteSpace: 'pre-line' }}>{m.texto}</p></div>
      {canais.includes('whatsapp') && <div className="card" id="whatsapp"><header><h2>WhatsApp</h2><small>{comWa.length} com consentimento{semWa ? ` · ${semWa} sem consentimento ou telefone` : ''}</small></header>
        {comWa.length ? <div className="list">{comWa.map(({ p, url }) => (
          <div className="item" key={p.id}><div className="body"><b>{p.nome}</b><span className="small muted">{p.telefone}</span></div><a className="btn sm" href={url!} target="_blank" rel="noopener noreferrer">Abrir conversa</a></div>
        ))}</div> : <div className="empty">Ninguém deste público autorizou WhatsApp. O consentimento fica na ficha de cada pessoa.</div>}
      </div>}
      {canais.includes('email') && <div className="card" id="email"><header><h2>E-mail</h2><small>{emails.length} com consentimento, em cópia oculta</small></header>
        {grupos.length ? <div className="row">{grupos.map((g, i) => <a key={i} className="btn sm" href={mailto(g)}>Abrir e-mail {grupos.length > 1 ? `${i + 1} de ${grupos.length} ` : ''}({g.length})</a>)}</div>
          : <div className="empty">Ninguém deste público autorizou e-mail.</div>}
        {m.texto.includes('{nome}') && <p className="small muted">No e-mail em grupo, {'{nome}'} vira “irmão(ã)”.</p>}
      </div>}
      {canais.includes('redes') && <div className="card" id="redes"><header><h2>{CANAIS.redes.n}</h2><small>copie e cole na publicação</small></header>
        <textarea readOnly rows={6} defaultValue={m.texto.replace(/^Olá,\s*\{nome\}!\s*/, '').replaceAll('{nome}', '')} aria-label="Texto para as redes" />
      </div>}
    </>
  )
}
