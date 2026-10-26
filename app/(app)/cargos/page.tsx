import { exigirAcesso, pode } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { AREAS, DISC, MIN, type Cargo } from '@/lib/patrimonio'
import { Cabecalho } from '@/components/Cabecalho'
import { Formulario } from '@/components/Formulario'
import { salvarCargo, alternarArea, excluirCargo } from './acoes'

export const metadata = { title: 'Cargos e responsáveis' }

export default async function Cargos() {
  const s = await exigirAcesso(['cargos', 'patrimonio'])
  const edita = pode(s, 'cargos', 'editar')
  const supabase = await supabaseServidor()
  const [{ data: cg }, { data: ps }] = await Promise.all([
    supabase.from('cargos').select('id, titulo, nome, pessoa_id, areas').eq('igreja_id', s.igreja.id).order('titulo'),
    edita ? supabase.from('pessoas').select('id, nome').eq('igreja_id', s.igreja.id).eq('anonimizado', false).in('status', ['membro', 'congregado']).order('nome') : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
  ])
  const cargos = (cg ?? []) as Cargo[]
  const semDono = AREAS.filter((a) => !cargos.some((c) => c.areas.includes(a)))

  return (
    <>
      <Cabecalho sobre="Administração" titulo="Cargos e responsáveis"
        texto="Quem responde por cada área. Os planos 5W2H usam esta matriz para escolher o responsável (disciplina do problema) e quem aprova (Patrimônio dentro da alçada, Tesouraria acima dela)." />
      {semDono.length > 0 && <div className="banner">Áreas sem responsável: {semDono.join(', ')}. Planos dessas áreas ficam com “a definir”.</div>}
      <div className="card"><header><h2>Matriz de responsabilidade</h2><small>{edita ? 'toque para marcar ou desmarcar' : 'somente leitura'}</small></header>
        {cargos.length ? <div className="scroll-x"><table className="matrix">
          <thead><tr><th>Cargo</th>{AREAS.map((a) => <th key={a} className="rot" title={DISC.includes(a) ? 'Disciplina do prédio' : 'Ministério'}>{a}</th>)}{edita && <th />}</tr></thead>
          <tbody>{cargos.map((c) => (
            <tr key={c.id}>
              <td><b>{c.nome}</b><div className="small muted">{c.titulo}</div></td>
              {AREAS.map((a) => {
                const on = c.areas.includes(a)
                return <td key={a} className={`cell${on ? ' on' : ''}`}>{edita
                  ? <form action={alternarArea.bind(null, c.id, a)}><button type="submit" aria-pressed={on} aria-label={`${c.titulo}: ${a}`}><span>{on ? '✓' : ''}</span></button></form>
                  : <span aria-label={on ? 'responsável' : ''}>{on ? '✓' : ''}</span>}</td>
              })}
              {edita && <td><form action={excluirCargo.bind(null, c.id)}><button className="btn ghost sm" type="submit" aria-label={`Excluir ${c.titulo}`}>Excluir</button></form></td>}
            </tr>
          ))}</tbody>
        </table></div> : <div className="empty">Nenhum cargo ainda. Comece por Patrimônio (zeladoria), Tesouraria e quem cuida de elétrica e som.</div>}
      </div>
      {edita && <div className="card"><header><h2>Novo cargo</h2></header>
        <Formulario acao={salvarCargo} enviar="Adicionar cargo">
          <label className="f">Cargo<input type="text" name="titulo" required minLength={2} maxLength={80} placeholder="Ex.: Zelador, Diácono de patrimônio" /></label>
          <label className="f">Pessoa da igreja<select name="pessoa_id" defaultValue=""><option value="">Não está no cadastro</option>{(ps ?? []).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
          <label className="f">Nome (se não está no cadastro)<input type="text" name="nome" maxLength={120} placeholder="Ex.: Eletricista João" /></label>
          <fieldset className="full"><legend className="small muted">Disciplinas do prédio</legend><div className="row">{DISC.map((a) => <label className="chk" key={a}><input type="checkbox" name="areas" value={a} />{a}</label>)}</div></fieldset>
          <fieldset className="full"><legend className="small muted">Ministérios</legend><div className="row">{MIN.map((a) => <label className="chk" key={a}><input type="checkbox" name="areas" value={a} />{a}</label>)}</div></fieldset>
        </Formulario>
      </div>}
    </>
  )
}
