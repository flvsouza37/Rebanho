import Link from 'next/link'
import { exigir } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { brl, mesAtual, nomeMes, hoje } from '@/lib/formato'
import { podeFin } from '@/lib/perfis'
import { Cabecalho } from '@/components/Cabecalho'
import { carregarEstrategia } from '@/lib/estrategia-dados'
import { insights, grauDe } from '@/lib/estrategia'

export const metadata = { title: 'Painel' }

type Kpi = { rotulo: string; valor: string | number; sub: string; href: string; alerta?: boolean }

// Cada indicador é um link para a área já filtrada no que gerou o número.
export default async function Painel() {
  const s = await exigir(['pastor', 'tesouraria', 'secretaria', 'lider'])
  const supabase = await supabaseServidor()
  const ig = s.igreja.id, mes = mesAtual()
  const semana = new Date(Date.now() - 7 * 864e5).toLocaleDateString('sv-SE')
  const conta = (q: PromiseLike<{ count: number | null }>) => Promise.resolve(q).then((r) => r.count ?? 0)
  const base = () => supabase.from('pessoas').select('*', { count: 'exact', head: true }).eq('igreja_id', ig).eq('anonimizado', false)

  const [membros, congregados, visitantes, visSemContato, semLgpd] = await Promise.all([
    conta(base().eq('status', 'membro')),
    conta(base().eq('status', 'congregado')),
    conta(base().eq('status', 'visitante')),
    conta(base().eq('status', 'visitante').or(`ultimo_contato.is.null,ultimo_contato.lt.${semana}`)),
    conta(base().in('status', ['membro', 'congregado']).is('lgpd_data', null)),
  ])
  const kpis: Kpi[] = [
    { rotulo: 'Membros ativos', valor: membros, sub: `${congregados} congregados · ${visitantes} visitantes`, href: '/pessoas?s=membro' },
    { rotulo: 'Visitantes sem contato há 7 dias', valor: visSemContato, sub: 'quem precisa de uma ligação', href: '/pessoas?s=visitante&f=sem-contato', alerta: visSemContato > 0 },
    { rotulo: 'Sem consentimento LGPD', valor: semLgpd, sub: 'membros e congregados', href: '/pessoas?s=membros&f=sem-lgpd', alerta: semLgpd > 0 },
  ]

  if (podeFin(s.papel)) {
    const [{ data: ent }, pendentes, abertas] = await Promise.all([
      supabase.from('lancamentos_validos').select('valor').eq('igreja_id', ig).eq('tipo', 'entrada').gte('data', mes + '-01').lte('data', hoje()),
      conta(supabase.from('lancamentos').select('*', { count: 'exact', head: true }).eq('igreja_id', ig).eq('status', 'pendente')),
      conta(supabase.from('contribuicoes').select('*', { count: 'exact', head: true }).eq('igreja_id', ig).eq('competencia', mes).eq('status', 'aberta')),
    ])
    const total = (ent ?? []).reduce((t, l) => t + Number(l.valor), 0)
    kpis.push(
      { rotulo: 'Entradas do mês', valor: brl(total), sub: `${ent?.length ?? 0} lançamentos em ${nomeMes(mes)}`, href: `/tesouraria?mes=${mes}&tipo=entrada` },
      { rotulo: 'Saídas aguardando aprovação', valor: pendentes, sub: `acima da alçada de ${brl(s.igreja.alcada)}`, href: '/tesouraria?pendentes=1', alerta: pendentes > 0 },
      { rotulo: 'Contribuições em aberto', valor: abertas, sub: nomeMes(mes), href: `/contribuicoes?mes=${mes}&st=aberta` },
    )
  }
  if (s.papel === 'pastor') {
    const ouv = await conta(supabase.from('ouvidoria').select('*', { count: 'exact', head: true }).eq('igreja_id', ig).in('status', ['Recebida', 'Em análise']))
    kpis.push({ rotulo: 'Ouvidoria em aberto', valor: ouv, sub: 'manifestações sem resposta', href: '/ouvidoria', alerta: ouv > 0 })
  }

  // Estratégia: ameaças do último diagnóstico e o andamento do kanban.
  let estrategia: React.ReactNode = null
  if (s.papel !== 'tesouraria') {
    const [est, ciclos, tarefas] = await Promise.all([
      carregarEstrategia(ig, s.papel !== 'lider'),
      supabase.from('pdca').select('fase, prazo').eq('igreja_id', ig).neq('fase', 'Concluído'),
      supabase.from('tarefas').select('coluna, prazo').eq('igreja_id', ig).neq('coluna', 'feito'),
    ])
    const am = insights(est.atual, est.anterior, est.ctx).filter((x) => x.tipo === 'ameaca').slice(0, 4)
    const abertos = [...(ciclos.data ?? []), ...(tarefas.data ?? [])], atrasados = abertos.filter((x) => x.prazo && x.prazo < hoje()).length
    estrategia = (
      <div className="grid g2">
        {s.papel !== 'lider' && <div className="card"><header><h2>Ameaças ministeriais</h2><Link className="btn ghost sm" href="/diagnostico?aba=insights">Abrir diagnóstico</Link></header>
          {am.length ? <div className="list">{am.map((x) => <div className="item" key={x.id}><span className={`stripe ${grauDe(x.score).k}`} /><div className="body"><b>{x.titulo}</b><span className="small muted">{x.origem} · {grauDe(x.score).n}</span></div><span className="score">{x.score}</span></div>)}</div>
            : <div className="empty">{est.atual ? 'Nenhuma ameaça no último diagnóstico.' : 'Faça o primeiro diagnóstico MUDA e Diakonia.'}</div>}</div>}
        <Link href="/kanban" className={`card kpi kpi-link${atrasados ? ' alert' : ''}`}><span className="lbl">Execução: PDCA e tarefas abertas</span><span className="val">{abertos.length}</span><span className="sub">{atrasados} com prazo vencido · abrir kanban</span></Link>
      </div>
    )
  }

  return (
    <>
      <Cabecalho sobre={'Painel · ' + s.igreja.nome} titulo="Como está a igreja" texto="Toque num indicador para ver o que gerou o número." />
      <div className="grid g4">
        {kpis.map((k) => (
          <Link key={k.rotulo} href={k.href} className={`card kpi kpi-link${k.alerta ? ' alert' : ''}`}>
            <span className="lbl">{k.rotulo}</span><span className="val">{k.valor}</span><span className="sub">{k.sub}</span>
          </Link>
        ))}
      </div>
      {estrategia}
    </>
  )
}
