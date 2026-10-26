import Link from 'next/link'
import { exigirAcesso, pode } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { dataBR, hoje } from '@/lib/formato'
import { CATEGORIAS } from '@/lib/comunicacao'
import { publicos } from '@/lib/comunicacao-dados'
import { Cabecalho } from '@/components/Cabecalho'
import { Formulario } from '@/components/Formulario'
import { salvarAviso, excluirAviso } from './acoes'

export const metadata = { title: 'Avisos' }

type Aviso = { id: string; titulo: string; corpo: string; categoria: string; publico: string; validade: string | null; fixado: boolean; no_site: boolean }

function Campos({ a, pubs }: { a?: Aviso; pubs: string[] }) {
  return (
    <>
      <label className="f full">Título<input type="text" name="titulo" required minLength={3} maxLength={120} defaultValue={a?.titulo} placeholder="Ex.: Santa Ceia neste domingo" /></label>
      <label className="f full">Aviso<textarea name="corpo" rows={3} required maxLength={2000} defaultValue={a?.corpo} /></label>
      <label className="f">Categoria<select name="categoria" defaultValue={a?.categoria ?? 'Geral'}>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select></label>
      <label className="f">Público<select name="publico" defaultValue={a?.publico ?? 'Toda a igreja'}>{pubs.filter((p) => !p.includes('radar')).map((p) => <option key={p}>{p}</option>)}</select></label>
      <label className="f">Vale até (opcional)<input type="date" name="validade" defaultValue={a?.validade ?? new Date(Date.now() + 7 * 864e5).toLocaleDateString('sv-SE')} /></label>
      <div className="f full row">
        <label className="chk"><input type="checkbox" name="fixado" defaultChecked={a?.fixado} />Fixar no topo</label>
        <label className="chk"><input type="checkbox" name="no_site" defaultChecked={a?.no_site ?? false} />Mostrar no site</label>
      </div>
    </>
  )
}

export default async function Avisos() {
  const s = await exigirAcesso('comunicacao')
  const edita = pode(s, 'comunicacao', 'editar')
  const supabase = await supabaseServidor()
  const [{ data }, pubs] = await Promise.all([
    supabase.from('avisos').select('*').eq('igreja_id', s.igreja.id).order('fixado', { ascending: false }).order('criado_em', { ascending: false }),
    edita ? publicos(s.igreja.id) : Promise.resolve([] as string[]),
  ])
  const todos = (data ?? []) as Aviso[]
  const noAr = todos.filter((a) => !a.validade || a.validade >= hoje()), exp = todos.filter((a) => a.validade && a.validade < hoje())

  return (
    <>
      <Cabecalho sobre="Comunicação" titulo="Mural de avisos"
        texto="Cada aviso tem público e validade. Os membros veem o mural na área deles, e o que for marcado aparece no site. Daqui ele segue para a mensageria com um toque."
        acoes={edita && <details className="inline"><summary className="btn">Novo aviso</summary>
          <Formulario acao={salvarAviso.bind(null, null)} enviar="Publicar aviso"><Campos pubs={pubs} /></Formulario>
        </details>} />
      {noAr.length ? <div className="grid g3">{noAr.map((a) => (
        <div className="card" key={a.id} id={`av-${a.id}`}>
          <header><div className="row"><span className={`pill ${a.categoria === 'Urgente' ? 'crit' : 'acc'}`}>{a.categoria}</span>{a.no_site && <span className="pill ok">No site</span>}</div>{a.fixado && <small>Fixado</small>}</header>
          <h3>{a.titulo}</h3>
          <p className="small" style={{ whiteSpace: 'pre-line' }}>{a.corpo}</p>
          <div className="spread small muted"><span>{a.publico}</span><span>{a.validade ? `até ${dataBR(a.validade)}` : 'sem validade'}</span></div>
          {edita && <div className="row">
            <Link className="btn sm" href={`/mensagens?aviso=${a.id}`}>Enviar pelos canais</Link>
            <details className="inline"><summary className="btn ghost sm">Editar</summary>
              <Formulario acao={salvarAviso.bind(null, a.id)}><Campos a={a} pubs={pubs} /></Formulario>
            </details>
            <form action={excluirAviso.bind(null, a.id)}><button className="btn ghost sm" type="submit">Excluir</button></form>
          </div>}
        </div>
      ))}</div> : <div className="empty">Nenhum aviso no ar.{edita && ' Crie o primeiro pelo botão Novo aviso.'}</div>}
      {exp.length > 0 && <details className="card flat"><summary><b>Expirados ({exp.length})</b></summary>
        <div className="list small">{exp.map((a) => <div className="item" key={a.id}><div className="body"><b>{a.titulo}</b><span className="muted">{a.publico} · venceu {dataBR(a.validade)}</span></div>
          {edita && <form action={excluirAviso.bind(null, a.id)}><button className="btn ghost sm" type="submit">Excluir</button></form>}</div>)}</div>
      </details>}
    </>
  )
}
