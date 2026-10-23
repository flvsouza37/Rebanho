import { exigir } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { Cabecalho } from '@/components/Cabecalho'
import { Formulario } from '@/components/Formulario'
import { salvarIgreja } from './acoes'

export const metadata = { title: 'Dados da igreja' }

export default async function Igreja() {
  const s = await exigir(['pastor'])
  const supabase = await supabaseServidor()
  const { data: i } = await supabase.from('igrejas').select('*').eq('id', s.igreja.id).single()
  return (
    <>
      <Cabecalho sobre="Administração" titulo="Dados da igreja" texto="Aparecem nos recibos e no Pix. A alçada define a partir de que valor uma saída precisa da aprovação do pastor." />
      <div className="card">
        <Formulario acao={salvarIgreja}>
          <label className="f full">Nome<input type="text" name="nome" defaultValue={i.nome} required /></label>
          <label className="f">CNPJ<input type="text" name="cnpj" defaultValue={i.cnpj ?? ''} /></label>
          <label className="f">Cidade<input type="text" name="cidade" defaultValue={i.cidade ?? ''} /></label>
          <label className="f">UF<input type="text" name="uf" maxLength={2} defaultValue={i.uf ?? ''} /></label>
          <label className="f">Alçada de aprovação (R$)<input type="number" name="alcada" min="0" step="100" defaultValue={i.alcada} /></label>
          <label className="f">Chave Pix<input type="text" name="pix_chave" defaultValue={i.pix_chave ?? ''} /></label>
          <label className="f">Nome do recebedor (até 25 letras)<input type="text" name="pix_nome" maxLength={25} defaultValue={i.pix_nome ?? ''} /></label>
          <label className="f">Cidade do Pix (até 15 letras)<input type="text" name="pix_cidade" maxLength={15} defaultValue={i.pix_cidade ?? ''} /></label>
          <label className="f full">Fundos (separados por vírgula)<input type="text" name="fundos" defaultValue={(i.fundos ?? []).join(', ')} /></label>
        </Formulario>
      </div>
    </>
  )
}
