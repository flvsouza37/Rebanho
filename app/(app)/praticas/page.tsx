import Link from 'next/link'
import { sessao, pode } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { dataBR } from '@/lib/formato'
import { CATEGORIAS_PRATICA } from '@/lib/comunidade'
import { Cabecalho } from '@/components/Cabecalho'
import { Formulario } from '@/components/Formulario'
import { compartilhar, aprovar, excluirPratica, amem } from './acoes'

export const metadata = { title: 'Boas práticas' }

export default async function Praticas({ searchParams }: { searchParams: Promise<{ c?: string; enviada?: string }> }) {
  const s = await sessao()
  const modera = pode(s, 'praticas', 'editar')
  const sp = await searchParams
  const supabase = await supabaseServidor()
  const [{ data }, { data: eu }] = await Promise.all([
    supabase.from('praticas').select('id, titulo, texto, categoria, autor_nome, autor_user, aprovado, criado_em, amens(user_id)').eq('igreja_id', s.igreja.id).order('criado_em', { ascending: false }),
    s.pessoaId ? supabase.from('pessoas').select('nome').eq('id', s.pessoaId).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const todas = (data ?? []).map((p) => ({ ...p, n: (p.amens as { user_id: string }[]).length, meu: (p.amens as { user_id: string }[]).some((a) => a.user_id === s.userId) }))
  const cat = CATEGORIAS_PRATICA.includes(sp.c as never) ? sp.c : null
  const lista = todas.filter((p) => !cat || p.categoria === cat).sort((a, b) => Number(a.aprovado) - Number(b.aprovado) || b.n - a.n)
  const pend = todas.filter((p) => !p.aprovado).length

  return (
    <>
      <Cabecalho sobre="Comunidade" titulo="Boas práticas"
        texto="O que funcionou na família, no ministério e na vida devocional, contado por quem viveu. A liderança aprova antes de ficar visível para todos."
        acoes={<details className="inline"><summary className="btn">Compartilhar prática</summary>
          <Formulario acao={compartilhar} enviar="Enviar para aprovação">
            <label className="f full">Título<input type="text" name="titulo" required minLength={3} maxLength={120} placeholder="Ex.: Culto doméstico às quartas" /></label>
            <label className="f full">Conte como foi<textarea name="texto" rows={4} required minLength={10} maxLength={2000} /></label>
            <label className="f">Tema<select name="categoria" defaultValue="Família">{CATEGORIAS_PRATICA.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="f">Como quer aparecer<input type="text" name="autor_nome" required maxLength={120} defaultValue={eu?.nome ?? ''} placeholder="Ex.: Família Souza" /></label>
          </Formulario>
        </details>} />
      {sp.enviada && <div className="sucesso" role="status">Obrigado por compartilhar! A liderança vai ler e aprovar.</div>}
      {modera && pend > 0 && <div className="banner warn">{pend} prática(s) aguardando aprovação.</div>}
      <div className="tabs">
        <Link className="tab" aria-selected={!cat} href="/praticas">Todas</Link>
        {CATEGORIAS_PRATICA.map((c) => <Link key={c} className="tab" aria-selected={cat === c} href={`/praticas?c=${encodeURIComponent(c)}`}>{c}</Link>)}
      </div>
      {lista.length ? <div className="grid g3">{lista.map((p) => (
        <div className="card" key={p.id} id={`pr-${p.id}`}>
          <header><span className="pill acc">{p.categoria}</span>{!p.aprovado && <span className="pill warn">Aguardando aprovação</span>}</header>
          <h3>{p.titulo}</h3>
          <p className="small" style={{ whiteSpace: 'pre-line' }}>{p.texto}</p>
          <div className="spread small muted"><span>{p.autor_nome} · {dataBR(p.criado_em.slice(0, 10))}</span><span className="mono">{p.n} amém{p.n === 1 ? '' : 's'}</span></div>
          <div className="row">
            {p.aprovado ? <form action={amem.bind(null, p.id, p.meu)}><button className={`btn sm${p.meu ? '' : ' ghost'}`} type="submit" aria-pressed={p.meu}>Amém</button></form>
              : modera && <form action={aprovar.bind(null, p.id)}><button className="btn sm" type="submit">Aprovar</button></form>}
            {(modera || (!p.aprovado && p.autor_user === s.userId)) && <form action={excluirPratica.bind(null, p.id)}><button className="btn ghost sm" type="submit">{p.aprovado || !modera ? 'Excluir' : 'Recusar'}</button></form>}
          </div>
        </div>
      ))}</div> : <div className="empty">Nenhuma prática compartilhada ainda. Seja o primeiro!</div>}
    </>
  )
}
