import { exigirAcesso } from '@/lib/sessao'
import { PERFIL, ehPerfil } from '@/lib/territorio'
import { Cabecalho } from '@/components/Cabecalho'
import { Formulario } from '@/components/Formulario'
import { CamposCampanha } from '../CamposCampanha'
import { salvarCampanha } from '../acoes'

export const metadata = { title: 'Nova campanha' }

const somaDias = (n: number) => new Date(Date.now() + n * 864e5).toLocaleDateString('sv-SE')

// Vinda do território, a campanha já chega com o bairro, o perfil, as ações e o convite sugeridos.
export default async function Nova({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await exigirAcesso('missao', 'editar')
  const sp = await searchParams
  const perfil = ehPerfil(sp.perfil) ? sp.perfil : 'misto'
  return (
    <>
      <Cabecalho sobre="Missão · Campanhas" titulo="Nova campanha"
        texto={sp.ma ? `${sp.ma}: ${PERFIL[perfil].nome}. As ações e o convite abaixo são sugestões para esse perfil, ajuste à vontade.` : 'Defina o bairro, a meta e o convite. Depois ligue cada visitante à campanha que o trouxe.'} />
      <div className="card">
        <Formulario acao={salvarCampanha.bind(null, null)} enviar="Criar campanha">
          <CamposCampanha c={{
            titulo: sp.ma ? `${PERFIL[perfil].nome}: ${sp.ma}` : '', microarea: sp.ma ?? '', perfil,
            municipio: sp.mun ?? s.igreja.cidade ?? '', uf: sp.uf ?? s.igreja.uf ?? '',
            inicio: somaDias(7), fim: somaDias(37),
          }} />
        </Formulario>
      </div>
    </>
  )
}
