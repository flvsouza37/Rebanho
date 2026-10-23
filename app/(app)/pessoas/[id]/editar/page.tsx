import { notFound } from 'next/navigation'
import { exigir } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { Cabecalho } from '@/components/Cabecalho'
import { Formulario } from '@/components/Formulario'
import { CamposPessoa } from '../../CamposPessoa'
import { salvarPessoa } from '../../acoes'

export const metadata = { title: 'Editar ficha' }

export default async function Editar({ params }: { params: Promise<{ id: string }> }) {
  await exigir(['pastor', 'secretaria', 'lider'])
  const { id } = await params
  const supabase = await supabaseServidor()
  const { data: p } = await supabase.from('pessoas').select('*').eq('id', id).maybeSingle()
  if (!p) notFound()
  return (
    <>
      <Cabecalho sobre="Pessoas" titulo={'Editar ' + p.nome} />
      <div className="card"><Formulario acao={salvarPessoa.bind(null, id)} enviar="Salvar alterações"><CamposPessoa p={p} /></Formulario></div>
    </>
  )
}
