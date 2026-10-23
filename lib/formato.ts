export const brl = (v: number | string | null | undefined) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const dataBR = (d: string | null | undefined) => {
  if (!d) return '—'
  const x = new Date(d.length <= 10 ? d + 'T12:00:00' : d)
  return isNaN(+x) ? '—' : x.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const hoje = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
export const mesAtual = () => hoje().slice(0, 7)
export const nomeMes = (m: string) =>
  new Date(m + '-15T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
export const mesAnterior = (m: string, n = 1) => {
  const [a, b] = m.split('-').map(Number)
  const d = new Date(a, b - 1 - n, 15)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
}
export const fimDoMes = (m: string) => {
  const [a, b] = m.split('-').map(Number)
  return new Date(a, b, 0).toLocaleDateString('sv-SE')
}

// Mensagens do banco já vêm em português; isto tira o prefixo técnico quando houver.
export const msgErro = (e: { message?: string } | null | undefined) =>
  (e?.message ?? 'Algo deu errado. Tente de novo.').replace(/^.*?ERROR:\s*/, '')
