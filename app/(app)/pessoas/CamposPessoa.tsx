type P = Record<string, unknown>
const v = (p: P, k: string) => (p[k] ?? '') as string

const STATUS = ['visitante', 'congregado', 'membro', 'afastado', 'transferido']
const ETAPAS = ['Primeira visita', 'Voltou', 'Em célula', 'Decidiu seguir', 'Classe de membresia']

export type OpcaoCampanha = { id: string; titulo: string }

export function CamposPessoa({ p = {}, campanhas = [] }: { p?: P; campanhas?: OpcaoCampanha[] }) {
  return (
    <>
      <label className="f full">Nome completo<input type="text" name="nome" required minLength={2} maxLength={120} defaultValue={v(p, 'nome')} /></label>
      <label className="f">Situação
        <select name="status" defaultValue={v(p, 'status') || 'visitante'}>{STATUS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
      </label>
      <label className="f">Etapa de integração (visitantes)
        <select name="etapa" defaultValue={v(p, 'etapa')}><option value="">—</option>{ETAPAS.map((s) => <option key={s}>{s}</option>)}</select>
      </label>
      <label className="f">WhatsApp<input type="tel" name="telefone" defaultValue={v(p, 'telefone')} /></label>
      <label className="f">E-mail<input type="email" name="email" defaultValue={v(p, 'email')} /></label>
      <label className="f">Nascimento<input type="date" name="nascimento" defaultValue={v(p, 'nascimento')} /></label>
      <label className="f">Família<input type="text" name="familia" defaultValue={v(p, 'familia')} placeholder="Ex.: Família Souza" /></label>
      <label className="f full">Endereço<input type="text" name="endereco" defaultValue={v(p, 'endereco')} /></label>
      <label className="f">Bairro<input type="text" name="bairro" defaultValue={v(p, 'bairro')} /></label>
      <label className="f">Cidade<input type="text" name="cidade" defaultValue={v(p, 'cidade')} /></label>
      <label className="f">Célula<input type="text" name="grupo" defaultValue={v(p, 'grupo')} /></label>
      <label className="f">Ministérios (separados por vírgula)<input type="text" name="ministerios" defaultValue={((p.ministerios as string[]) ?? []).join(', ')} /></label>
      <label className="f">Primeira visita<input type="date" name="primeira_visita" defaultValue={v(p, 'primeira_visita')} /></label>
      <label className="f">Último contato<input type="date" name="ultimo_contato" defaultValue={v(p, 'ultimo_contato')} /></label>
      <label className="f">Como conheceu<input type="text" name="como_conheceu" defaultValue={v(p, 'como_conheceu')} /></label>
      {campanhas.length > 0 && <label className="f">Veio por qual campanha
        <select name="campanha_id" defaultValue={v(p, 'campanha_id')}><option value="">Nenhuma</option>{campanhas.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}</select>
      </label>}
      <label className="f">Quem acompanha<input type="text" name="acompanhante" defaultValue={v(p, 'acompanhante')} /></label>
      <label className="f">Batismo<input type="date" name="batismo" defaultValue={v(p, 'batismo')} /></label>
      <label className="f">Membro desde<input type="date" name="membro_desde" defaultValue={v(p, 'membro_desde')} /></label>
      <label className="chk full"><input type="checkbox" name="lider" defaultChecked={!!p.lider} />É líder</label>
    </>
  )
}
