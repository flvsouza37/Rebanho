import { CANAIS, PERFIL, type PerfilId } from '@/lib/territorio'

export type Campanha = {
  titulo?: string; microarea?: string | null; municipio?: string | null; uf?: string | null; perfil?: PerfilId
  inicio?: string | null; fim?: string | null; meta?: number; orcamento?: number; status?: string
  responsavel?: string | null; acoes?: string | null; convite?: string | null; canais?: string[]
}

export function CamposCampanha({ c }: { c: Campanha }) {
  const P = PERFIL[c.perfil ?? 'misto']
  const canais = c.canais ?? P.canais
  return (
    <>
      <label className="f full">Nome da campanha<input type="text" name="titulo" required minLength={3} maxLength={120} defaultValue={c.titulo ?? ''} /></label>
      <label className="f">Microárea ou bairro<input type="text" name="microarea" defaultValue={c.microarea ?? ''} /></label>
      <label className="f">Município<input type="text" name="municipio" defaultValue={c.municipio ?? ''} /></label>
      <label className="f">UF<input type="text" name="uf" maxLength={2} defaultValue={c.uf ?? ''} /></label>
      <label className="f">Perfil do bairro
        <select name="perfil" defaultValue={c.perfil ?? 'misto'}>{Object.entries(PERFIL).map(([k, p]) => <option key={k} value={k}>{p.nome}</option>)}</select>
      </label>
      <label className="f">Início<input type="date" name="inicio" defaultValue={c.inicio ?? ''} /></label>
      <label className="f">Fim<input type="date" name="fim" defaultValue={c.fim ?? ''} /></label>
      <label className="f">Meta de visitantes<input type="number" name="meta" min="0" step="1" defaultValue={c.meta ?? 20} /></label>
      <label className="f">Orçamento (R$)<input type="number" name="orcamento" min="0" step="0.01" defaultValue={c.orcamento ?? 0} /></label>
      <label className="f">Responsável<input type="text" name="responsavel" defaultValue={c.responsavel ?? ''} placeholder="Ex.: Ministério de evangelismo" /></label>
      <label className="f">Situação
        <select name="status" defaultValue={c.status ?? 'Planejada'}>{['Planejada', 'Em andamento', 'Encerrada'].map((s) => <option key={s}>{s}</option>)}</select>
      </label>
      <label className="f full">Ações<textarea name="acoes" rows={4} defaultValue={c.acoes ?? P.acoes.join('\n')} /></label>
      <label className="f full">Convite<textarea name="convite" rows={3} defaultValue={c.convite ?? P.convite} /></label>
      <div className="f full">Canais
        <div className="row">{Object.entries(CANAIS).map(([k, n]) => (
          <label key={k} className="chk"><input type="checkbox" name="canais" value={k} defaultChecked={canais.includes(k)} />{n}</label>
        ))}</div>
      </div>
    </>
  )
}
