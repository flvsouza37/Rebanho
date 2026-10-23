import { redirect } from 'next/navigation'
import { supabaseServidor } from '@/lib/supabase/server'
import { Formulario } from '@/components/Formulario'
import { Marca } from '@/components/Marca'
import { criarIgreja } from './acoes'

export const metadata = { title: 'Começar' }

export default async function Comecar() {
  const supabase = await supabaseServidor()
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) redirect('/entrar')
  const { count } = await supabase.from('vinculos').select('*', { count: 'exact', head: true }).eq('user_id', u.user.id)
  if (count) redirect('/')
  return (
    <main className="auth">
      <div className="card">
        <div className="marca"><Marca tamanho={34} /><b>Rebanho</b></div>
        <h1>Bem-vindo!</h1>
        <p className="muted">Você entrou como <b>{u.user.email}</b>. Se faz parte da equipe de uma igreja que já usa o Rebanho, peça ao pastor para liberar seu acesso por este e-mail.</p>
        <p className="muted">Se é o pastor, cadastre a igreja agora. Você fica como responsável e libera o acesso da equipe depois.</p>
        <Formulario acao={criarIgreja} enviar="Cadastrar igreja">
          <label className="f full">Nome da igreja<input type="text" name="nome" required minLength={2} maxLength={120} /></label>
          <label className="f">Cidade<input type="text" name="cidade" /></label>
          <label className="f">UF<input type="text" name="uf" maxLength={2} /></label>
        </Formulario>
        <form action="/sair" method="post"><button className="btn ghost sm" type="submit">Sair</button></form>
      </div>
    </main>
  )
}
