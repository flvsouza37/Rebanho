import { exigir } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { dataBR } from '@/lib/formato'
import { NOME_PAPEL, type Papel } from '@/lib/perfis'
import { Cabecalho } from '@/components/Cabecalho'
import { Formulario } from '@/components/Formulario'
import { darAcesso, removerAcesso } from './acoes'

export const metadata = { title: 'Equipe e acessos' }

export default async function Equipe() {
  const s = await exigir(['pastor'])
  const supabase = await supabaseServidor()
  const [{ data: equipe }, { data: membros }] = await Promise.all([
    supabase.rpc('equipe', { ig: s.igreja.id }),
    supabase.from('pessoas').select('id, nome').eq('igreja_id', s.igreja.id).in('status', ['membro', 'congregado']).eq('anonimizado', false).order('nome'),
  ])
  return (
    <>
      <Cabecalho sobre="Administração" titulo="Equipe e acessos" texto="Cada pessoa entra com o próprio e-mail e vê só o que o perfil permite. Peça para a pessoa abrir o app e pedir o link de acesso uma vez; depois libere aqui." />
      <div className="grid split">
        <div className="card scroll-x"><table>
          <thead><tr><th>E-mail</th><th>Perfil</th><th>Desde</th><th></th></tr></thead>
          <tbody>{(equipe ?? []).map((e: { user_id: string; email: string; papel: Papel; desde: string }) => (
            <tr key={e.user_id}><td>{e.email}</td><td>{NOME_PAPEL[e.papel]}</td><td>{dataBR(e.desde)}</td>
              <td>{e.user_id !== s.userId && <form action={removerAcesso.bind(null, e.user_id)}><button className="btn ghost sm" type="submit">Remover</button></form>}</td></tr>
          ))}</tbody>
        </table></div>
        <div className="card"><header><h2>Liberar acesso</h2></header>
          <Formulario acao={darAcesso} enviar="Liberar">
            <label className="f full">E-mail<input type="email" name="email" required /></label>
            <label className="f">Perfil<select name="papel">{(Object.keys(NOME_PAPEL) as Papel[]).map((p) => <option key={p} value={p}>{NOME_PAPEL[p]}</option>)}</select></label>
            <label className="f">Ficha (perfil membro)<select name="pessoa_id" defaultValue=""><option value="">—</option>{(membros ?? []).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></label>
          </Formulario>
        </div>
      </div>
    </>
  )
}
