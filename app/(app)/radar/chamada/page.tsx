import Link from 'next/link'
import { exigirAcesso } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { dataBR, hoje } from '@/lib/formato'
import { Cabecalho } from '@/components/Cabecalho'
import { Formulario } from '@/components/Formulario'
import { salvarChamada } from '../acoes'

export const metadata = { title: 'Chamada' }

// Último domingo (ou hoje, se for domingo): é o dia mais comum de chamada.
const domingo = () => { const d = new Date(hoje() + 'T12:00:00'); d.setDate(d.getDate() - d.getDay()); return d.toLocaleDateString('sv-SE') }

export default async function Chamada({ searchParams }: { searchParams: Promise<{ data?: string; tipo?: string; g?: string }> }) {
  const s = await exigirAcesso('radar', 'editar')
  const sp = await searchParams
  const data = sp.data && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) && sp.data <= hoje() ? sp.data : domingo()
  const tipo = sp.tipo === 'celula' ? 'celula' : 'culto'
  const supabase = await supabaseServidor()
  const [{ data: pessoas }, { data: pres }, { data: recentes }] = await Promise.all([
    supabase.from('pessoas').select('id, nome, grupo, status').eq('igreja_id', s.igreja.id).in('status', ['membro', 'congregado', 'afastado', 'visitante']).eq('anonimizado', false).order('nome').limit(1000),
    supabase.from('presencas').select('pessoa_id').eq('igreja_id', s.igreja.id).eq('data', data).eq('tipo', tipo),
    supabase.from('presencas').select('data').eq('igreja_id', s.igreja.id).eq('tipo', tipo).order('data', { ascending: false }).limit(400),
  ])
  const grupos = [...new Set((pessoas ?? []).map((p) => p.grupo).filter((g): g is string => !!g))].sort()
  const lista = (pessoas ?? []).filter((p) => (tipo === 'culto' || p.grupo) && (!sp.g || p.grupo === sp.g))
  const veio = new Set((pres ?? []).map((p) => p.pessoa_id))
  const dias = [...new Set((recentes ?? []).map((r) => r.data))].slice(0, 6)
  const link = (o: Record<string, string>) => '/radar/chamada?' + new URLSearchParams({ data, tipo, ...(sp.g ? { g: sp.g } : {}), ...o })

  return (
    <>
      <Cabecalho sobre="Pessoas" titulo="Chamada"
        texto="Marque quem esteve presente. Leva um minuto por culto e é o que alimenta o radar pastoral."
        acoes={<Link className="btn ghost" href="/radar">Ver radar</Link>} />
      <div className="tabs">
        <Link className="tab" aria-selected={tipo === 'culto'} href={link({ tipo: 'culto', g: '' })}>Culto</Link>
        <Link className="tab" aria-selected={tipo === 'celula'} href={link({ tipo: 'celula' })}>Célula</Link>
      </div>
      <form className="row" action="/radar/chamada">
        <input type="hidden" name="tipo" value={tipo} />
        <label className="f" style={{ width: 'auto' }}>Data<input type="date" name="data" defaultValue={data} max={hoje()} /></label>
        {tipo === 'celula' && grupos.length > 0 && <label className="f" style={{ width: 'auto' }}>Célula<select name="g" defaultValue={sp.g ?? ''}><option value="">Todas</option>{grupos.map((g) => <option key={g}>{g}</option>)}</select></label>}
        <button className="btn ghost" type="submit">Abrir</button>
      </form>
      {dias.length > 0 && <div className="row small">Chamadas recentes: {dias.map((d) => <Link key={d} className={`pill${d === data ? ' acc' : ''}`} href={link({ data: d })}>{dataBR(d)}</Link>)}</div>}
      <div className="card">
        <header><h2>{tipo === 'culto' ? 'Culto' : 'Célula'} de {dataBR(data)}</h2><small>{veio.size} presente(s) de {lista.length}</small></header>
        {lista.length ? (
          <Formulario acao={salvarChamada} enviar="Salvar chamada" className="grid">
            <input type="hidden" name="data" value={data} /><input type="hidden" name="tipo" value={tipo} />
            <div className="chamada">
              {lista.map((p) => (
                <label className="chk" key={p.id}>
                  <input type="hidden" name="todos" value={p.id} />
                  <input type="checkbox" name="p" value={p.id} defaultChecked={veio.has(p.id)} />
                  <span>{p.nome}<small className="muted"> · {p.status}{p.grupo ? ' · ' + p.grupo : ''}</small></span>
                </label>
              ))}
            </div>
          </Formulario>
        ) : <div className="empty">{tipo === 'celula' ? 'Ninguém com célula informada na ficha.' : 'Nenhuma pessoa cadastrada ainda.'}</div>}
      </div>
    </>
  )
}
