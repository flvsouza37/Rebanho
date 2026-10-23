import { exigir } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { NOME_PAPEL, type Papel } from '@/lib/perfis'
import { Cabecalho } from '@/components/Cabecalho'

export const metadata = { title: 'Auditoria' }

const ROT: Record<string, string> = { pessoas: 'Pessoa', pessoas_pastoral: 'Cuidado pastoral', compromissos: 'Compromisso', vinculos: 'Acesso', lancamentos: 'Lançamento', contribuicoes: 'Contribuição', fechamentos: 'Fechamento', igrejas: 'Igreja' }
const curto = (v: unknown) => v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v).slice(0, 40) : String(v).slice(0, 40)

// A trilha é gravada pelo próprio banco (triggers) e não pode ser editada nem apagada.
export default async function Auditoria({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const s = await exigir(['pastor', 'tesouraria'])
  const { t } = await searchParams
  const supabase = await supabaseServidor()
  let q = supabase.from('auditoria').select('*').eq('igreja_id', s.igreja.id).order('quando', { ascending: false }).limit(300)
  if (t && ROT[t]) q = q.eq('tabela', t)
  const { data } = await q
  return (
    <>
      <Cabecalho sobre="Gestão" titulo="Trilha de auditoria" texto="Toda criação, alteração e exclusão, com quem fez, quando e o que mudou. Ninguém apaga nem edita estes registros." />
      <form className="row" action="/auditoria">
        <select name="t" defaultValue={t ?? ''} style={{ width: 'auto' }}><option value="">Todos os registros</option>{Object.entries(ROT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button className="btn ghost" type="submit">Filtrar</button>
      </form>
      <div className="card scroll-x">
        <table>
          <thead><tr><th>Quando</th><th>Perfil</th><th>Ação</th><th>Registro</th><th>O que mudou</th></tr></thead>
          <tbody>
            {(data ?? []).map((a) => {
              const m = a.mudancas as Record<string, { de?: unknown; para?: unknown } | unknown>
              const linhas = a.acao === 'alterou'
                ? Object.entries(m).slice(0, 6).map(([k, v]) => `${k}: ${curto((v as { de: unknown }).de)} → ${curto((v as { para: unknown }).para)}`)
                : [curto((m as Record<string, unknown>).nome ?? (m as Record<string, unknown>).descricao ?? (m as Record<string, unknown>).categoria ?? '')]
              return (
                <tr key={a.id}>
                  <td className="small" style={{ whiteSpace: 'nowrap' }}>{new Date(a.quando).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td>{a.papel ? NOME_PAPEL[a.papel as Papel] : 'sistema'}</td>
                  <td><span className={`pill ${a.acao === 'excluiu' ? 'crit' : a.acao === 'criou' ? 'ok' : 'info'}`}>{a.acao}</span></td>
                  <td className="small">{ROT[a.tabela] ?? a.tabela}</td>
                  <td className="small">{linhas.map((l, i) => <div key={i}>{l}</div>)}</td>
                </tr>
              )
            })}
            {!data?.length && <tr><td colSpan={5} className="muted">Nada registrado ainda.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}
