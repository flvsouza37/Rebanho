import Link from 'next/link'
import { exigirAcesso, pode } from '@/lib/sessao'
import { dataBR } from '@/lib/formato'
import { carregarRadar, linkWhats, mensagemCuidado, type Risco } from '@/lib/radar'
import { Cabecalho } from '@/components/Cabecalho'
import { Formulario } from '@/components/Formulario'
import { registrarContato } from './acoes'

export const metadata = { title: 'Radar pastoral' }

export default async function Radar() {
  const s = await exigirAcesso('radar')
  const edita = pode(s, 'radar', 'editar'), fichas = pode(s, 'pessoas')
  const r = await carregarRadar(s.igreja.id, pode(s, 'pastoral'))

  const Pessoa = ({ x }: { x: Risco }) => {
    const wa = x.whats ? linkWhats(x.telefone, mensagemCuidado(x.nome)) : null
    return (
      <div className="item">
        <span className={`stripe ${x.pontos >= 70 ? 'crit' : 'alto'}`} />
        <div className="body">
          <div className="spread" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            {fichas ? <Link href={`/pessoas/${x.id}`}><b>{x.nome}</b></Link> : <b>{x.nome}</b>}
            <span className="score" title="Pontos do radar, de 0 a 100">{x.pontos}</span>
          </div>
          <span className="small muted">{x.motivos.join(' · ')}</span>
          <div className="row small">
            <span className="bars-mini" title="Presença nos cultos nas últimas 8 semanas">{x.semanas.map((v, i) => <i key={i} className={v ? 'on' : ''} />)}</span>
            <span className="muted">{x.grupo ? `Célula ${x.grupo}` : 'Sem célula'}{x.ultima ? ` · última presença ${dataBR(x.ultima)}` : ''}</span>
          </div>
          {x.contato && <span className="small">Último contato: {x.contato.forma.toLowerCase()} em {dataBR(x.contato.data)}{x.contato.nota ? ` · ${x.contato.nota}` : ''}</span>}
          {edita && (
            <div className="row">
              {wa ? <a className="btn sm" href={wa} target="_blank" rel="noopener noreferrer">Mensagem no WhatsApp</a>
                : <span className="small muted">{x.telefone ? 'Sem consentimento para WhatsApp' : 'Sem telefone na ficha'}</span>}
              <details className="inline"><summary className="btn ghost sm">Registrar contato</summary>
                <Formulario acao={registrarContato.bind(null, x.id)} enviar="Salvar contato">
                  <label className="f">Como foi<select name="forma" defaultValue="Ligação"><option>Ligação</option><option>Mensagem</option><option>Visita</option><option>Encontro</option></select></label>
                  <label className="f full">Anotação curta (opcional)<input type="text" name="nota" maxLength={300} placeholder="Ex.: está bem, viajou a trabalho" /></label>
                </Formulario>
              </details>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <Cabecalho sobre="Cuidado pastoral" titulo="Radar pastoral"
        texto="Cruza a presença nos cultos e na célula com os acontecimentos de vida. Quem passa de 40 pontos aparece aqui, com o motivo e uma mensagem pronta."
        acoes={edita && <Link className="btn" href="/radar/chamada">Fazer chamada</Link>} />
      {!r.comChamada && <div className="banner">O radar depende da chamada. Registre quem veio ao culto em <Link href="/radar/chamada">Chamada</Link>: a partir da segunda semana ele já mostra quem está faltando.</div>}
      <div className="grid g4">
        <div className={`card kpi${r.aCuidar.length ? ' alert' : ''}`}><span className="lbl">Precisam de contato</span><span className="val">{r.aCuidar.length}</span><span className="sub">40 pontos ou mais</span></div>
        <div className="card kpi"><span className="lbl">Já procurados</span><span className="val">{r.emCuidado.length}</span><span className="sub">contato nos últimos 14 dias</span></div>
        <div className="card kpi"><span className="lbl">Acompanhados</span><span className="val">{r.total}</span><span className="sub">membros, congregados e afastados</span></div>
        <div className="card kpi"><span className="lbl">Sem presença registrada</span><span className="val">{r.semRegistro}</span><span className="sub">ainda fora do radar</span></div>
      </div>
      <div className="card"><header><h2>Precisam de contato</h2><small>do maior para o menor risco</small></header>
        {r.aCuidar.length ? <div className="list">{r.aCuidar.map((x) => <Pessoa key={x.id} x={x} />)}</div>
          : <div className="empty">Ninguém precisando de contato agora.</div>}
      </div>
      {r.emCuidado.length > 0 && (
        <div className="card" id="cuidado"><header><h2>Já procurados</h2><small>continuam no radar até voltarem a frequentar</small></header>
          <div className="list">{r.emCuidado.map((x) => <Pessoa key={x.id} x={x} />)}</div>
        </div>
      )}
      <div className="card flat"><h3>Como o radar pontua</h3><p className="small muted">21 dias ou mais sem presença: 45 pontos. Entre 14 e 20 dias: 25. Queda de duas ou mais presenças em relação ao mês anterior: 30. Três semanas sem ir à célula: 15. Acontecimento de vida registrado na ficha pastoral (luto, desemprego, doença, mudança): 20{pode(s, 'pastoral') ? '' : ', visível só para quem tem acesso às anotações pastorais'}.</p></div>
    </>
  )
}
