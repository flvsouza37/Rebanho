import { exigir } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { dataBR } from '@/lib/formato'
import { MODULOS, NOME_NIVEL, NOME_PAPEL, type Acessos, type Nivel, type Papel } from '@/lib/perfis'
import { Cabecalho } from '@/components/Cabecalho'
import { Formulario } from '@/components/Formulario'
import { acessosPadrao, darAcesso, removerAcesso, salvarAcessos } from './acoes'

export const metadata = { title: 'Equipe e acessos' }

type Pessoa = { user_id: string; email: string; papel: Papel; desde: string; acessos: Acessos }
const NIVEIS: Nivel[] = ['nenhum', 'ver', 'editar']
const resumo = (a: Acessos) => {
  const ed = MODULOS.filter(([m]) => a[m] === 'editar').length, ve = MODULOS.filter(([m]) => a[m] === 'ver').length
  return ed + ve ? `edita ${ed} · só vê ${ve} de ${MODULOS.length} módulos` : 'sem acesso a módulos'
}

export default async function Equipe() {
  const s = await exigir(['pastor'])
  const supabase = await supabaseServidor()
  const [{ data: equipe }, { data: membros }] = await Promise.all([
    supabase.rpc('equipe', { ig: s.igreja.id }),
    supabase.from('pessoas').select('id, nome').eq('igreja_id', s.igreja.id).in('status', ['membro', 'congregado']).eq('anonimizado', false).order('nome'),
  ])
  const lista = (equipe ?? []) as Pessoa[]
  return (
    <>
      <Cabecalho sobre="Administração" titulo="Equipe e acessos" texto="O pastor vê tudo e decide o que cada pessoa da equipe vê ou edita. O perfil é só o ponto de partida: abra a pessoa e ajuste módulo a módulo." />
      <div className="grid split">
        <div className="card"><header><h2>Equipe</h2><small>{lista.length} pessoa(s)</small></header>
          <div className="list">{lista.map((e) => (
            <div className="item" key={e.user_id} id={`u-${e.user_id}`}>
              <div className="body">
                <div className="spread"><b>{e.email}</b><span className="pill">{NOME_PAPEL[e.papel]}</span></div>
                <span className="small muted">desde {dataBR(e.desde)} · {e.papel === 'pastor' ? 'vê e edita tudo' : resumo(e.acessos)}</span>
                {e.papel !== 'pastor' && (
                  <details className="inline"><summary className="btn ghost sm">Acessos</summary>
                    <Formulario acao={salvarAcessos.bind(null, e.user_id)} enviar="Salvar acessos" className="grid"
                      extra={<button className="btn ghost sm" formAction={acessosPadrao.bind(null, e.user_id)} formNoValidate>Voltar ao padrão do perfil</button>}>
                      <table className="acessos">
                        <thead><tr><th>Módulo</th>{NIVEIS.map((n) => <th key={n}>{NOME_NIVEL[n]}</th>)}</tr></thead>
                        <tbody>{MODULOS.map(([m, nome, desc]) => (
                          <tr key={m}>
                            <th><b>{nome}</b><span className="small muted">{desc}</span></th>
                            {NIVEIS.map((n) => <td key={n}><input type="radio" name={m} value={n} defaultChecked={e.acessos[m] === n} aria-label={`${nome}: ${NOME_NIVEL[n]}`} /></td>)}
                          </tr>
                        ))}</tbody>
                      </table>
                    </Formulario>
                  </details>
                )}
              </div>
              {e.user_id !== s.userId && <form action={removerAcesso.bind(null, e.user_id)}><button className="btn ghost sm" type="submit">Remover</button></form>}
            </div>
          ))}</div>
        </div>
        <div className="card"><header><h2>Liberar acesso</h2></header>
          <p className="small muted">A pessoa precisa ter aberto o app e pedido o link de acesso uma vez. Depois de liberar, ajuste os acessos dela na lista ao lado.</p>
          <Formulario acao={darAcesso} enviar="Liberar">
            <label className="f full">E-mail<input type="email" name="email" required /></label>
            <label className="f">Perfil<select name="papel" defaultValue="lider">{(Object.keys(NOME_PAPEL) as Papel[]).map((p) => <option key={p} value={p}>{NOME_PAPEL[p]}</option>)}</select></label>
            <label className="f">Ficha (perfil membro)<select name="pessoa_id" defaultValue=""><option value="">—</option>{(membros ?? []).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></label>
          </Formulario>
        </div>
      </div>
    </>
  )
}
