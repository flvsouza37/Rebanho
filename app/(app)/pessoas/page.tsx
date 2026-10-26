import Link from 'next/link'
import { exigirAcesso, pode } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { dataBR } from '@/lib/formato'
import { Cabecalho } from '@/components/Cabecalho'

export const metadata = { title: 'Pessoas' }

const FILTROS: Record<string, { nome: string; status: string[] }> = {
  membros: { nome: 'Membros e congregados', status: ['membro', 'congregado', 'afastado'] },
  membro: { nome: 'Membros', status: ['membro'] },
  congregado: { nome: 'Congregados', status: ['congregado'] },
  afastado: { nome: 'Afastados', status: ['afastado'] },
  visitante: { nome: 'Visitantes', status: ['visitante'] },
}

export default async function Pessoas({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await exigirAcesso('pessoas')
  const { s: grupo = 'membros', f, q } = await searchParams
  const filtro = FILTROS[grupo] ?? FILTROS.membros
  const supabase = await supabaseServidor()
  let consulta = supabase.from('pessoas')
    .select('id, nome, status, telefone, bairro, grupo, familia, ultimo_contato, primeira_visita, lgpd_data, lider, anonimizado')
    .eq('igreja_id', s.igreja.id).in('status', filtro.status).order('nome').limit(500)
  if (q) consulta = consulta.ilike('nome', `%${q.replace(/[%_,()]/g, ' ')}%`)
  if (f === 'sem-lgpd') consulta = consulta.is('lgpd_data', null)
  if (f === 'sem-contato') {
    const semana = new Date(Date.now() - 7 * 864e5).toLocaleDateString('sv-SE')
    consulta = consulta.or(`ultimo_contato.is.null,ultimo_contato.lt.${semana}`)
  }
  const { data: pessoas, error } = await consulta
  const vis = grupo === 'visitante'
  const destaque = f === 'sem-lgpd' ? 'Sem consentimento LGPD' : f === 'sem-contato' ? 'Sem contato há mais de 7 dias' : null

  return (
    <>
      <Cabecalho sobre="Pessoas" titulo={filtro.nome} texto={`${pessoas?.length ?? 0} pessoa(s)${destaque ? ' · ' + destaque : ''}`}
        acoes={pode(s, 'pessoas', 'editar') && <Link className="btn" href={`/pessoas/nova?status=${vis ? 'visitante' : 'membro'}`}>{vis ? 'Novo visitante' : 'Nova pessoa'}</Link>} />
      {destaque && <div className="banner">Você veio do painel: mostrando só “{destaque.toLowerCase()}”. <Link href={`/pessoas?s=${grupo}`}>Ver todos</Link></div>}
      <div className="tabs">
        {Object.entries(FILTROS).map(([k, v]) => (
          <Link key={k} className="tab" aria-selected={k === grupo} href={`/pessoas?s=${k}`}>{v.nome}</Link>
        ))}
      </div>
      <form className="row" action="/pessoas">
        <input type="hidden" name="s" value={grupo} />
        <input type="search" name="q" defaultValue={q} placeholder="Buscar pelo nome" style={{ flex: 1, minWidth: 200 }} />
        <button className="btn ghost" type="submit">Buscar</button>
      </form>
      {error && <div className="erro">{error.message}</div>}
      <div className="card scroll-x">
        <table>
          <thead><tr><th>Nome</th><th>Situação</th><th>{vis ? 'Primeira visita' : 'Célula'}</th><th>{vis ? 'Último contato' : 'Bairro'}</th><th>LGPD</th></tr></thead>
          <tbody>
            {(pessoas ?? []).map((p) => (
              <tr key={p.id}>
                <td><Link href={`/pessoas/${p.id}`}><b>{p.nome}</b></Link>{p.lider && <> <span className="pill acc">líder</span></>}<br /><span className="small muted">{p.familia}</span></td>
                <td><span className={`pill ${p.status === 'membro' ? 'ok' : p.status === 'afastado' ? 'warn' : p.status === 'visitante' ? 'info' : ''}`}>{p.status}</span></td>
                <td>{vis ? dataBR(p.primeira_visita) : p.grupo || '—'}</td>
                <td>{vis ? dataBR(p.ultimo_contato) : p.bairro || '—'}</td>
                <td>{p.lgpd_data ? <span className="pill ok">ok</span> : <span className="pill warn">pendente</span>}</td>
              </tr>
            ))}
            {!pessoas?.length && <tr><td colSpan={5} className="muted">Ninguém neste filtro.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}
