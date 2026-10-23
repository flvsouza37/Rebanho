import { notFound } from 'next/navigation'
import { exigir } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { brl, dataBR, nomeMes } from '@/lib/formato'
import { Imprimir } from '@/components/Imprimir'

export const metadata = { title: 'Recibo' }

export default async function Recibo({ params }: { params: Promise<{ id: string }> }) {
  const s = await exigir(['pastor', 'tesouraria', 'membro'])
  const { id } = await params
  const supabase = await supabaseServidor()
  const { data: c } = await supabase.from('contribuicoes').select('*, pessoas(nome)').eq('id', id).maybeSingle()
  if (!c || c.status !== 'paga') notFound()
  const nome = (c.pessoas as unknown as { nome: string }).nome
  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <span className="eyebrow">{s.igreja.nome}</span>
      <h1>Recibo {c.recibo}</h1>
      <p>Recebemos de <b>{nome}</b> a quantia de <b>{brl(c.valor_pago)}</b>, referente a {c.tipo.toLowerCase()} de {nomeMes(c.competencia)}, em {dataBR(c.pago_em)}, por {c.forma}.</p>
      <p className="small muted">Documento emitido pelo Rebanho. A autenticidade pode ser conferida com a tesouraria pelo número do recibo.</p>
      <div className="row"><Imprimir /></div>
    </div>
  )
}
