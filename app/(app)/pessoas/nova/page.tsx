import { exigir } from '@/lib/sessao'
import { Cabecalho } from '@/components/Cabecalho'
import { Formulario } from '@/components/Formulario'
import { CamposPessoa } from '../CamposPessoa'
import { salvarPessoa } from '../acoes'
import { hoje } from '@/lib/formato'
import { campanhasAbertas } from '../campanhas'

export const metadata = { title: 'Nova pessoa' }

export default async function Nova({ searchParams }: { searchParams: Promise<{ status?: string; campanha?: string }> }) {
  const s = await exigir(['pastor', 'secretaria', 'lider'])
  const { status = 'visitante', campanha } = await searchParams
  const campanhas = await campanhasAbertas(s.igreja.id, campanha)
  return (
    <>
      <Cabecalho sobre="Pessoas" titulo={status === 'visitante' ? 'Novo visitante' : 'Nova pessoa'} texto="O consentimento LGPD é registrado na ficha, depois de salvar." />
      <div className="card">
        <Formulario acao={salvarPessoa.bind(null, null)} enviar="Salvar ficha"
          extra={<label className="chk"><input type="checkbox" name="mesmo_assim" />Cadastrar mesmo que pareça duplicado</label>}>
          <CamposPessoa campanhas={campanhas} p={{ status, primeira_visita: status === 'visitante' ? hoje() : '', campanha_id: campanhas.some((c) => c.id === campanha) ? campanha : '' }} />
        </Formulario>
      </div>
    </>
  )
}
