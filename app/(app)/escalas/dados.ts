import { hoje } from '@/lib/formato'

// Próximos domingos a partir de hoje (hoje entra se for domingo).
export function domingos(n: number) {
  const d = new Date(hoje() + 'T12:00:00')
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7))
  return Array.from({ length: n }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + 7 * i); return x.toLocaleDateString('sv-SE') })
}
export const msgEscala = (nome: string, ministerio: string, data: string) =>
  `Olá, ${nome.split(' ')[0]}! Você está na escala de ${ministerio} no domingo, ${new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}. Pode confirmar pela sua área no Rebanho ou responder aqui? Obrigado por servir!`
