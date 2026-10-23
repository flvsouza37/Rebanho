import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigir } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { brl, dataBR } from '@/lib/formato'
import { podeCadastrar, podeFin } from '@/lib/perfis'
import { Cabecalho } from '@/components/Cabecalho'
import { Formulario } from '@/components/Formulario'
import { salvarConsentimento, salvarPastoral, salvarCompromisso, anonimizarPessoa } from '../acoes'

export const metadata = { title: 'Ficha' }

function Kv({ itens }: { itens: [string, React.ReactNode][] }) {
  const v = itens.filter(([, x]) => x !== null && x !== undefined && x !== '' && x !== '—')
  return v.length ? <dl className="kv">{v.map(([k, x]) => <><dt key={k + 't'}>{k}</dt><dd key={k + 'd'}>{x}</dd></>)}</dl> : <p className="small muted">Nada informado.</p>
}

export default async function Ficha({ params }: { params: Promise<{ id: string }> }) {
  const s = await exigir(['pastor', 'tesouraria', 'secretaria', 'lider'])
  const { id } = await params
  const supabase = await supabaseServidor()
  const { data: p } = await supabase.from('pessoas').select('*').eq('id', id).maybeSingle()
  if (!p) notFound()
  const pastor = s.papel === 'pastor', fin = podeFin(s.papel)
  const [{ data: pastoral }, { data: comp }, { data: contribs }] = await Promise.all([
    pastor ? supabase.from('pessoas_pastoral').select('*').eq('pessoa_id', id).maybeSingle() : Promise.resolve({ data: null }),
    fin ? supabase.from('compromissos').select('*').eq('pessoa_id', id).maybeSingle() : Promise.resolve({ data: null }),
    fin ? supabase.from('contribuicoes').select('competencia, valor, status, recibo, pago_em').eq('pessoa_id', id).order('competencia', { ascending: false }).limit(12) : Promise.resolve({ data: null }),
  ])

  return (
    <>
      <Cabecalho sobre={'Pessoas · ' + p.status} titulo={p.nome}
        acoes={<>
          {podeCadastrar(s.papel) && !p.anonimizado && <Link className="btn" href={`/pessoas/${id}/editar`}>Editar ficha</Link>}
          {(pastor || s.papel === 'secretaria') && <a className="btn ghost" href={`/pessoas/${id}/exportar`}>Exportar dados (LGPD)</a>}
        </>} />
      {p.anonimizado && <div className="banner warn">Cadastro anonimizado a pedido do titular. Restou só o histórico financeiro.</div>}
      <div className="grid g2">
        <div className="card"><header><h2>Contato e família</h2></header>
          <Kv itens={[['WhatsApp', p.telefone], ['E-mail', p.email], ['Endereço', [p.endereco, p.bairro, p.cidade].filter(Boolean).join(', ')], ['Família', p.familia], ['Nascimento', p.nascimento && dataBR(p.nascimento)]]} />
        </div>
        <div className="card"><header><h2>Vida na igreja</h2></header>
          <Kv itens={[['Célula', p.grupo], ['Ministérios', (p.ministerios ?? []).join(', ')], ['Batismo', p.batismo && dataBR(p.batismo)], ['Membro desde', p.membro_desde && dataBR(p.membro_desde)],
            ['Primeira visita', p.primeira_visita && dataBR(p.primeira_visita)], ['Etapa', p.etapa], ['Como conheceu', p.como_conheceu], ['Acompanha', p.acompanhante], ['Último contato', p.ultimo_contato && dataBR(p.ultimo_contato)]]} />
        </div>
      </div>
      <div className="grid g2">
        <div className="card"><header><h2>Consentimento LGPD</h2><small>{p.lgpd_data ? `${dataBR(p.lgpd_data)} · ${p.lgpd_termo}` : 'não registrado'}</small></header>
          {!p.lgpd_data && <div className="banner warn">Sem consentimento. Não envie mensagens até a pessoa autorizar.</div>}
          {!p.anonimizado && <Formulario acao={salvarConsentimento.bind(null, id)} enviar="Registrar consentimento" className="row">
            <label className="chk"><input type="checkbox" name="whats" defaultChecked={p.lgpd_whats} />WhatsApp</label>
            <label className="chk"><input type="checkbox" name="email" defaultChecked={p.lgpd_email} />E-mail</label>
            <label className="chk"><input type="checkbox" name="imagem" defaultChecked={p.lgpd_imagem} />Uso de imagem</label>
          </Formulario>}
        </div>
        {pastor && <div className="card"><header><h2>Cuidado pastoral</h2><small>confidencial · só o pastor vê</small></header>
          <Formulario acao={salvarPastoral.bind(null, id)} enviar="Salvar observação">
            <label className="f full">Acontecimento de vida<input type="text" name="evento_vida" defaultValue={pastoral?.evento_vida ?? ''} placeholder="Ex.: luto na família" /></label>
            <label className="f full">Observação<textarea name="observacao" defaultValue={pastoral?.observacao ?? ''} /></label>
          </Formulario>
        </div>}
      </div>
      {fin && p.status !== 'visitante' && (
        <div className="grid g2">
          <div className="card"><header><h2>Compromisso de contribuição</h2><small>pastor e tesouraria</small></header>
            <Formulario acao={salvarCompromisso.bind(null, id)} enviar="Salvar compromisso"
              extra={comp && <label className="chk"><input type="checkbox" name="remover" />Remover compromisso</label>}>
              <label className="f">Tipo<select name="tipo" defaultValue={comp?.tipo ?? 'Dízimo'}><option>Dízimo</option><option>Oferta mensal</option><option>Missões</option></select></label>
              <label className="f">Valor por mês (R$)<input type="number" name="valor" min="1" step="0.01" defaultValue={comp?.valor ?? ''} /></label>
              <label className="f">Dia do vencimento<input type="number" name="dia" min="1" max="28" defaultValue={comp?.dia ?? 10} /></label>
              <label className="f">Forma<select name="forma" defaultValue={comp?.forma ?? 'Pix'}><option>Pix</option><option>Boleto</option><option>Dinheiro</option><option>Transferência</option></select></label>
            </Formulario>
          </div>
          <div className="card"><header><h2>Últimos meses</h2><Link className="small" href={`/contribuicoes?pessoa=${id}`}>ver tudo</Link></header>
            {contribs?.length ? <div className="list">{contribs.map((c) => (
              <div className="item" key={c.competencia}><div className="body"><b>{c.competencia}</b><span className="small muted">{c.status === 'paga' ? `pago em ${dataBR(c.pago_em)} · ${c.recibo}` : c.status}</span></div><span className="mono">{brl(c.valor)}</span></div>
            ))}</div> : <div className="empty">Nenhuma contribuição gerada ainda.</div>}
          </div>
        </div>
      )}
      {pastor && !p.anonimizado && (
        <details className="card flat"><summary className="small">Pedido de exclusão (LGPD)</summary>
          <p className="small muted">Apaga nome, contatos e observações. O histórico financeiro continua, sem identificar a pessoa. Não tem volta.</p>
          <Formulario acao={anonimizarPessoa.bind(null, id)} enviar="Anonimizar cadastro" className="row">
            <label className="chk"><input type="checkbox" name="confirmo" />Confirmo que a pessoa pediu a exclusão</label>
          </Formulario>
        </details>
      )}
    </>
  )
}
