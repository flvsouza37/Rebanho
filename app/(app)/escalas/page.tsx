import { exigirAcesso, pode } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { hoje } from '@/lib/formato'
import { linkWhats } from '@/lib/radar'
import { Cabecalho } from '@/components/Cabecalho'
import { domingos, msgEscala } from './dados'
import { gerarEscalas, escalar, substituir, removerEscala, responderEscala } from './acoes'

export const metadata = { title: 'Escalas' }

const ROT: Record<string, [string, string]> = { pendente: ['aguardando', 'warn'], confirmado: ['confirmado', 'ok'], troca: ['pediu troca', 'crit'] }
const longa = (d: string) => { const t = new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }); return t[0].toUpperCase() + t.slice(1) }

export default async function Escalas({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const s = await exigirAcesso('escalas')
  const edita = pode(s, 'escalas', 'editar')
  const sp = await searchParams
  const supabase = await supabaseServidor()
  const [{ data: es }, { data: ps }] = await Promise.all([
    supabase.from('escalas').select('id, data, ministerio, pessoa_id, status').eq('igreja_id', s.igreja.id).gte('data', hoje()).order('data'),
    supabase.from('pessoas').select('id, nome, telefone, lgpd_whats, ministerios').eq('igreja_id', s.igreja.id).eq('anonimizado', false).in('status', ['membro', 'congregado']).order('nome'),
  ])
  const fut = es ?? [], pessoas = ps ?? []
  const pessoa = (id: string) => pessoas.find((p) => p.id === id)
  const mins = [...new Set([...pessoas.flatMap((p) => p.ministerios as string[]), ...fut.map((e) => e.ministerio)])].sort()
  const ds = [...new Set([...domingos(4), ...fut.map((e) => e.data)])].sort().slice(0, 6)
  const conf = fut.filter((e) => e.status === 'confirmado').length, trocas = fut.filter((e) => e.status === 'troca').length
  const carga: Record<string, number> = {}
  fut.forEach((e) => { carga[e.pessoa_id] = (carga[e.pessoa_id] ?? 0) + 1 })
  const sobre = Object.entries(carga).filter(([, n]) => n >= 3)

  return (
    <>
      <Cabecalho sobre="Comunidade" titulo="Escalas de ministérios"
        texto="Quem serve em cada domingo, com confirmação e pedido de troca. A escala é gerada em rodízio, priorizando quem serviu menos. Cada pessoa confirma pela própria área no Rebanho."
        acoes={edita && <details className="inline"><summary className="btn">Gerar escala</summary>
          <form action={gerarEscalas} className="form">
            <label className="f">Semanas<input type="number" name="semanas" min={1} max={8} defaultValue={4} /></label>
            <label className="f">Pessoas por ministério<input type="number" name="vagas" min={1} max={5} defaultValue={1} /></label>
            <p className="small muted full">Completa só as vagas vazias. Ministérios vêm do campo Ministérios da ficha de cada membro.</p>
            <div className="row full"><button className="btn" type="submit">Gerar rodízio</button></div>
          </form>
        </details>} />
      {sp.erro && <div className="erro" role="alert">{sp.erro}</div>}
      <div className="grid g4">
        <div className="card kpi"><span className="lbl">Vagas escaladas</span><span className="val">{fut.length}</span><span className="sub">{mins.length} ministério(s)</span></div>
        <div className="card kpi"><span className="lbl">Confirmados</span><span className="val">{fut.length ? Math.round((conf / fut.length) * 100) : 0}%</span><span className="sub">{conf} de {fut.length}</span></div>
        <div className={`card kpi${trocas ? ' alert' : ''}`}><span className="lbl">Pedidos de troca</span><span className="val">{trocas}</span><span className="sub">escolha um substituto</span></div>
        <div className={`card kpi${sobre.length ? ' alert' : ''}`}><span className="lbl">Sobrecarga</span><span className="val">{sobre.length}</span><span className="sub">{sobre.length ? sobre.map(([id]) => pessoa(id)?.nome.split(' ')[0]).join(', ') : 'pessoas com 3 ou mais escalas'}</span></div>
      </div>
      {!mins.length && <div className="banner">Para gerar escalas, preencha o campo Ministérios (ex.: Louvor, Recepção, Mídia, Infantil) na ficha de quem serve.</div>}
      <div className="grid g2">{ds.map((d) => (
        <div className="card" key={d} id={`d-${d}`}><header><h2>{longa(d)}</h2></header>
          {mins.map((m) => {
            const lista = fut.filter((e) => e.data === d && e.ministerio === m)
            const aptos = pessoas.filter((p) => (p.ministerios as string[]).includes(m) && !fut.some((e) => e.data === d && e.pessoa_id === p.id))
            return (
              <div className="grid" style={{ gap: 6 }} key={m}><span className="eyebrow">{m}</span>
                {lista.length ? lista.map((e) => {
                  const p = pessoa(e.pessoa_id), [rot, cor] = ROT[e.status]
                  const wa = p?.lgpd_whats ? linkWhats(p.telefone, msgEscala(p.nome, m, d)) : null
                  return (
                    <div className="item" key={e.id}><div className="body"><b>{p?.nome ?? '—'}</b><span className="small"><span className={`pill ${cor}`}>{rot}</span></span></div>
                      {edita && <div className="row" style={{ justifyContent: 'flex-end' }}>
                        {e.status !== 'confirmado' && <form action={responderEscala.bind(null, e.id, 'confirmado', '/escalas')}><button className="btn ghost sm" type="submit">Confirmar</button></form>}
                        {e.status === 'troca' && aptos.length > 0 && <form action={substituir.bind(null, e.id)} className="fl"><select name="pessoa" defaultValue="" aria-label="Substituto"><option value="" disabled>Substituir por…</option>{aptos.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select><button className="btn ghost sm" type="submit">Trocar</button></form>}
                        {wa && <a className="btn ghost sm" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
                        <form action={removerEscala.bind(null, e.id)}><button className="btn ghost sm" type="submit" aria-label={`Tirar ${p?.nome} da escala`}>Tirar</button></form>
                      </div>}
                    </div>
                  )
                }) : <span className="small muted">{aptos.length ? 'Ninguém escalado.' : 'Ninguém disponível neste ministério.'}</span>}
              </div>
            )
          })}
          {!mins.length && <span className="small muted">Sem ministérios cadastrados.</span>}
        </div>
      ))}</div>
      {edita && pessoas.length > 0 && <div className="card"><header><h2>Escalar alguém</h2></header>
        <form action={escalar} className="form">
          <label className="f">Data<input type="date" name="data" required defaultValue={ds[0]} /></label>
          <label className="f">Ministério<input type="text" name="ministerio" required list="mins" maxLength={60} /><datalist id="mins">{mins.map((m) => <option key={m} value={m} />)}</datalist></label>
          <label className="f">Pessoa<select name="pessoa" required defaultValue=""><option value="" disabled>Escolha</option>{pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
          <div className="row full"><button className="btn" type="submit">Escalar</button></div>
        </form>
      </div>}
    </>
  )
}
