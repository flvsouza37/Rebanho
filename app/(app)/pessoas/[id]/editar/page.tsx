import { notFound } from 'next/navigation'
import { exigir } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { Cabecalho } from '@/components/Cabecalho'
import { Formulario } from '@/components/Formulario'
import { CamposPessoa } from '../../CamposPessoa'
import { salvarPessoa } from '../../acoes'
import { campanhasAbertas } from '../../campanhas'

export const metadata = { title: 'Editar ficha' }

export default async function Editar({ params }: { params: Promise<{ id: string }> }) {
  const s = await exigir(['pastor', 'secretaria', 'lider'])
  const { id } = await params
  const supabase = await supabaseServidor()
  const { data: p } = await supabase.from('pessoas').select('*').eq('id', id).maybeSingle()
  if (!p) notFound()
  const campanhas = await campanhasAbertas(s.igreja.id, p.campanha_id)
  return (
    <>
      <Cabecalho sobre="Pessoas" titulo={'Editar ' + p.nome} />
      <div className="card"><Formulario acao={salvarPessoa.bind(null, id)} enviar="Salvar alterações"><CamposPessoa p={p} campanhas={campanhas} /></Formulario></div>
    </>
  )
}
