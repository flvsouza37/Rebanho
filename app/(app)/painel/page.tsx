import Link from 'next/link'
import { exigir } from '@/lib/sessao'
import { supabaseServidor } from '@/lib/supabase/server'
import { brl, mesAtual, nomeMes, hoje } from '@/lib/formato'
import { podeFin } from '@/lib/perfis'
import { Cabecalho } from '@/components/Cabecalho'

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
    </>
  )
}
