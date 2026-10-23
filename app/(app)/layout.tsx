import { Suspense } from 'react'
import { sessao } from '@/lib/sessao'
import { NOME_PAPEL } from '@/lib/perfis'
import { Menu } from '@/components/Menu'
import { Marca } from '@/components/Marca'
import { trocarIgreja } from './acoes'

export default async function AreaLogada({ children }: { children: React.ReactNode }) {
  const s = await sessao()
  return (
    <div className="app">
      <aside className="rail" id="rail">
        <div className="brand"><Marca /><div><b>Rebanho</b><small>CRM para igrejas</small></div></div>
        <div className="igreja-atual"><b>{s.igreja.nome}</b>{NOME_PAPEL[s.papel]} · {s.email}</div>
        <Suspense><Menu papel={s.papel} /></Suspense>
        <div className="perfilbox">
          {s.outras.length > 0 && (
            <form action={trocarIgreja} className="trocar">
              <label><span>Trocar de igreja</span>
                <select name="igreja" defaultValue="">
                  <option value="" disabled>Escolha</option>
                  {s.outras.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
                </select>
              </label>
              <button className="nav" type="submit">Trocar</button>
            </form>
          )}
          <form action="/sair" method="post"><button className="nav" type="submit">Sair</button></form>
        </div>
      </aside>
      <main id="main">{children}</main>
    </div>
  )
}
