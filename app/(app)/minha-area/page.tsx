import Link from 'next/link'
import { exigir } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { brl, dataBR, nomeMes } from '@/lib/formato'
import { Cabecalho } from '@/components/Cabecalho'
import { Formulario } from '@/components/Formulario'
import { salvarConsentimento } from '../pessoas/acoes'

export const metadata = { title: 'Minha área' }

// O membro vê só os próprios dados: as políticas do banco garantem isso.
export default async function MinhaArea() {
  const s = await exigir(['membro'])
  if (!s.pessoaId) return <div className="empty">Seu acesso ainda não foi ligado à sua ficha. Fale com a secretaria.</div>
  const supabase = await supabaseServidor()
  const [{ data: p }, { data: contribs }] = await Promise.all([
    supabase.from('pessoas').select('*').eq('id', s.pessoaId).single(),
    supabase.from('contribuicoes').select('id, competencia, valor, status, recibo, pago_em, vencimento').eq('pessoa_id', s.pessoaId).order('competencia', { ascending: false }).limit(24),
  ])
  const abertas = (contribs ?? []).filter((c) => c.status === 'aberta')
  return (
    <>
      <Cabecalho sobre="Área do membro" titulo={`Olá, ${p.nome.split(' ')[0]}!`} texto="Seu cadastro, suas contribuições e suas preferências de contato." />
      <div className="grid g2">
        <div className="card"><header><h2>Contribuições em aberto</h2><small>{abertas.length}</small></header>
          {abertas.length ? <div className="list">{abertas.map((c) => (
            <div className="item" key={c.id}><div className="body"><b>{nomeMes(c.competencia)}</b><span className="small muted">vence {dataBR(c.vencimento)}</span></div><span className="mono">{brl(c.valor)}</span></div>
          ))}</div> : <div className="empty">Nada em aberto. Obrigado pela fidelidade!</div>}
        </div>
        <div className="card"><header><h2>Recibos</h2></header>
          {(contribs ?? []).filter((c) => c.status === 'paga').map((c) => (
            <div className="item" key={c.id}><div className="body"><b>{c.recibo}</b><span className="small muted">{nomeMes(c.competencia)} · pago em {dataBR(c.pago_em)}</span></div><Link className="btn ghost sm" href={`/contribuicoes/recibo/${c.id}`}>Abrir</Link></div>
          ))}
        </div>
      </div>
      <div className="card"><header><h2>Como podemos falar com você</h2><small>{p.lgpd_termo ?? 'sem consentimento'}</small></header>
        <Formulario acao={salvarConsentimento.bind(null, p.id)} enviar="Salvar preferências" className="row">
          <label className="chk"><input type="checkbox" name="whats" defaultChecked={p.lgpd_whats} />WhatsApp</label>
          <label className="chk"><input type="checkbox" name="email" defaultChecked={p.lgpd_email} />E-mail</label>
          <label className="chk"><input type="checkbox" name="imagem" defaultChecked={p.lgpd_imagem} />Uso de imagem</label>
        </Formulario>
        <a className="small" href={`/pessoas/${p.id}/exportar`}>Baixar uma cópia dos meus dados</a>
      </div>
    </>
  )
}
