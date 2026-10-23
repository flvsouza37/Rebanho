import { exigir } from '@/lib/sessao'
import { Cabecalho } from '@/components/Cabecalho'
import { Formulario } from '@/components/Formulario'
import { CamposPessoa } from '../CamposPessoa'
import { salvarPessoa } from '../acoes'
import { hoje } from '@/lib/formato'

export const metadata = { title: 'Nova pessoa' }

export default async function Nova({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await exigir(['pastor', 'secretaria', 'lider'])
  const { status = 'visitante' } = await searchParams
  return (
    <>
      <Cabecalho sobre="Pessoas" titulo={status === 'visitante' ? 'Novo visitante' : 'Nova pessoa'} texto="O consentimento LGPD é registrado na ficha, depois de salvar." />
      <div className="card">
        <Formulario acao={salvarPessoa.bind(null, null)} enviar="Salvar ficha"
          extra={<label className="chk"><input type="checkbox" name="mesmo_assim" />Cadastrar mesmo que pareça duplicado</label>}>
          <CamposPessoa p={{ status, primeira_visita: status === 'visitante' ? hoje() : '' }} />
        </Formulario>
      </div>
    </>
  )
}
