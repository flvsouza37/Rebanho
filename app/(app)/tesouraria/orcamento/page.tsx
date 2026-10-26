import Link from 'next/link'
import { exigirAcesso, pode } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { brl, hoje } from '@/lib/formato'
import { CAT_S } from '@/lib/categorias'
import { Cabecalho } from '@/components/Cabecalho'
import { Formulario } from '@/components/Formulario'
import { salvarOrcamento } from './acoes'

export const metadata = { title: 'Orçamento' }

const COR: Record<string, string> = { estourado: 'crit', 'acima do ritmo': 'warn', dentro: 'ok', 'sem orçamento': 'info' }

export default async function Orcamento({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const s = await exigirAcesso('financeiro')
  const edita = pode(s, 'financeiro', 'editar')
  const atual = Number(hoje().slice(0, 4)), ano = Math.min(2100, Math.max(2000, Number((await searchParams).ano) || atual))
  const supabase = await supabaseServidor()
  const [{ data: orc }, { data: lanc }] = await Promise.all([
    supabase.from('orcamentos').select('categoria, valor').eq('igreja_id', s.igreja.id).eq('ano', ano),
    supabase.from('lancamentos_validos').select('tipo, categoria, valor').eq('igreja_id', s.igreja.id).gte('data', `${ano}-01-01`).lte('data', `${ano}-12-31`),
  ])
  // Meses decorridos do exercício: ano passado conta inteiro, ano futuro ainda não começou.
  const meses = ano < atual ? 12 : ano > atual ? 0 : Number(hoje().slice(5, 7))
  const real = (c: string) => (lanc ?? []).filter((l) => l.tipo === 'saida' && l.categoria === c).reduce((t, l) => t + Number(l.valor), 0)
  const linhas = CAT_S.map((c) => {
    const r = real(c), b = Number((orc ?? []).find((o) => o.categoria === c)?.valor ?? 0), pj = meses ? (r / meses) * 12 : 0
    return { c, r, b, pj, st: !b ? (r ? 'sem orçamento' : '—') : r > b ? 'estourado' : pj > b * 1.05 ? 'acima do ritmo' : 'dentro' }
  })
  const tb = linhas.reduce((t, x) => t + x.b, 0), tr = linhas.reduce((t, x) => t + x.r, 0), tp = linhas.reduce((t, x) => t + x.pj, 0)
  const ent = (lanc ?? []).filter((l) => l.tipo === 'entrada' && l.categoria !== 'Saldo anterior').reduce((t, l) => t + Number(l.valor), 0)
  const entPj = meses ? (ent / meses) * 12 : 0

  const tabela = (
    <div className="scroll-x full"><table>
            <thead><tr><th>Categoria</th><th className="num">Orçado no ano</th><th className="num">Realizado</th><th className="num">Projeção</th><th>Situação</th></tr></thead>
            <tbody>{linhas.map((x, i) => (
              <tr key={x.c}>
                <td>{x.c}</td>
                <td className="num">{edita ? <input type="text" inputMode="decimal" name={'c' + i} defaultValue={x.b ? String(x.b).replace('.', ',') : ''} placeholder="0" aria-label={`Orçado para ${x.c}`} style={{ maxWidth: 130, textAlign: 'right' }} /> : brl(x.b)}</td>
                <td className="num mono">{brl(x.r)}{x.b > 0 && <div className="small muted">{Math.round((x.r / x.b) * 100)}%</div>}</td>
                <td className="num mono">{brl(x.pj)}</td>
                <td>{x.st !== '—' ? <span className={`pill ${COR[x.st]}`}>{x.st}</span> : <span className="muted">—</span>}</td>
              </tr>
            ))}</tbody>
          </table></div>
  )

  return (
    <>
      <Cabecalho sobre="Gestão" titulo={`Orçamento ${ano}`}
        texto="Quanto a igreja planeja gastar em cada categoria e quanto já saiu. A projeção segue o ritmo dos meses passados e avisa antes de a conta estourar."
        acoes={<><Link className="btn ghost" href={`/tesouraria/orcamento?ano=${ano - 1}`}>{ano - 1}</Link><Link className="btn ghost" href={`/tesouraria/orcamento?ano=${ano + 1}`}>{ano + 1}</Link></>} />
      <div className="grid g4">
        <div className="card kpi"><span className="lbl">Saídas orçadas</span><span className="val">{brl(tb)}</span><span className="sub">{meses} de 12 meses decorridos</span></div>
        <div className="card kpi"><span className="lbl">Realizado</span><span className="val">{brl(tr)}</span><span className="sub">{tb ? Math.round((tr / tb) * 100) : 0}% do orçado</span></div>
        <div className={`card kpi${tb && tp > tb ? ' alert' : ''}`}><span className="lbl">Projeção de saídas</span><span className="val">{brl(tp)}</span><span className="sub">no ritmo atual, até dezembro</span></div>
        <div className={`card kpi${entPj - tp < 0 ? ' alert' : ''}`}><span className="lbl">Resultado projetado</span><span className="val">{brl(entPj - tp)}</span><span className="sub">entradas projetadas {brl(entPj)}</span></div>
      </div>
      <div className="card"><header><h2>Por categoria</h2><small>saídas válidas, sem estornos</small></header>
        {edita ? <Formulario acao={salvarOrcamento.bind(null, ano)} enviar="Salvar orçamento">{tabela}</Formulario> : tabela}
      </div>
    </>
  )
}
