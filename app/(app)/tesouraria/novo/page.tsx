import { exigir } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { hoje, brl } from '@/lib/formato'
import { Cabecalho } from '@/components/Cabecalho'
import { Formulario } from '@/components/Formulario'
import { lancar } from '../acoes'
import { CAT_E, CAT_S } from '@/lib/categorias'

export const metadata = { title: 'Novo lançamento' }

export default async function Novo({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const s = await exigir(['pastor', 'tesouraria'])
  const { tipo: t } = await searchParams
  const tipo = t === 'saida' ? 'saida' : 'entrada'
  const supabase = await supabaseServidor()
  const { data: membros } = tipo === 'entrada'
    ? await supabase.from('pessoas').select('id, nome').eq('igreja_id', s.igreja.id).in('status', ['membro', 'congregado', 'afastado']).eq('anonimizado', false).order('nome')
    : { data: [] }
  return (
    <>
      <Cabecalho sobre="Tesouraria" titulo={tipo === 'saida' ? 'Nova saída' : 'Nova entrada'}
        texto={tipo === 'saida' ? `Saídas acima de ${brl(s.igreja.alcada)} vão para aprovação do pastor.` : 'Para dízimo de um membro com carnê, prefira dar baixa em Contribuições: o recibo sai junto.'} />
      <div className="card">
        <Formulario acao={lancar} enviar="Lançar">
          <input type="hidden" name="tipo" value={tipo} />
          <label className="f">Valor (R$)<input type="number" name="valor" min="0.01" step="0.01" required /></label>
          <label className="f">Data<input type="date" name="data" defaultValue={hoje()} required /></label>
          <label className="f">Categoria<select name="categoria">{(tipo === 'saida' ? CAT_S : CAT_E).map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="f">Fundo<select name="fundo">{s.igreja.fundos.map((f) => <option key={f}>{f}</option>)}</select></label>
          <label className="f">Forma<select name="forma"><option>Pix</option><option>Dinheiro</option><option>Transferência</option><option>Boleto</option><option>Cartão</option></select></label>
          {tipo === 'entrada' && <label className="f">Membro (opcional)<select name="pessoa_id" defaultValue=""><option value="">Sem identificação</option>{(membros ?? []).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></label>}
          <label className="f full">Descrição<input type="text" name="descricao" maxLength={300} /></label>
        </Formulario>
      </div>
    </>
  )
}
