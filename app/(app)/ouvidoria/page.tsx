import { pode, sessao } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { dataBR } from '@/lib/formato'
import { Cabecalho } from '@/components/Cabecalho'
import { Formulario } from '@/components/Formulario'
import { registrar, responder } from './acoes'

export const metadata = { title: 'Sugestões e reclamações' }

export default async function Ouvidoria() {
  const s = await sessao()
  const supabase = await supabaseServidor()
  // O banco devolve tudo para o pastor e só as próprias para os demais.
  const { data } = await supabase.from('ouvidoria').select('*').eq('igreja_id', s.igreja.id).order('criado_em', { ascending: false }).limit(200)
  const pastor = pode(s, 'ouvidoria'), responde = pode(s, 'ouvidoria', 'editar')
  return (
    <>
      <Cabecalho sobre="Comunidade" titulo="Sugestões e reclamações" texto={pastor ? 'Todas as manifestações da igreja. Reclamações e pedidos de cuidado pedem resposta em até 72 horas.' : 'Fale direto com a liderança. Só o pastor lê.'} />
      <div className="grid split">
        <div className="card"><header><h2>{pastor ? 'Manifestações' : 'Minhas manifestações'}</h2><small>{data?.length ?? 0}</small></header>
          {data?.length ? <div className="list">{data.map((o) => (
            <div className="item" key={o.id}><span className={`stripe ${['Respondida', 'Encerrada'].includes(o.status) ? 'ok' : o.tipo === 'Reclamação' || o.tipo === 'Pedido de cuidado' ? 'crit' : 'mod'}`} />
              <div className="body">
                <b>{o.assunto} <span className="small muted mono">{o.protocolo}</span></b>
                <span className="small muted">{o.tipo} · {dataBR(o.criado_em)} · {o.anonimo ? 'anônimo' : o.autor_nome || 'sem nome'} · {o.status}</span>
                <p className="small">{o.texto}</p>
                {o.resposta && <p className="small"><b>Resposta:</b> {o.resposta}</p>}
                {responde && <details className="inline"><summary className="btn ghost sm">Responder</summary>
                  <Formulario acao={responder.bind(null, o.id)} enviar="Salvar resposta" className="grid">
                    <label className="f">Situação<select name="status" defaultValue={o.status}><option>Em análise</option><option>Respondida</option><option>Encerrada</option></select></label>
                    <label className="f">Resposta<textarea name="resposta" defaultValue={o.resposta ?? ''} /></label>
                  </Formulario>
                </details>}
              </div>
            </div>
          ))}</div> : <div className="empty">Nenhuma manifestação ainda.</div>}
        </div>
        <div className="card"><header><h2>Nova manifestação</h2></header>
          <Formulario acao={registrar} enviar="Enviar">
            <label className="f">Tipo<select name="tipo"><option>Sugestão</option><option>Reclamação</option><option>Elogio</option><option>Pedido de cuidado</option></select></label>
            <label className="f">Seu nome<input type="text" name="autor_nome" maxLength={80} /></label>
            <label className="f full">Assunto<input type="text" name="assunto" required maxLength={120} /></label>
            <label className="f full">Conte com suas palavras<textarea name="texto" required /></label>
            <label className="chk full"><input type="checkbox" name="anonimo" />Enviar como anônimo</label>
          </Formulario>
        </div>
      </div>
    </>
  )
}
