// Comunicação: canais da mensageria, públicos e as ajudas de vídeo do blog e do site.
import { AMBN } from '@/lib/patrimonio'

export const CANAIS = {
  whatsapp: { n: 'WhatsApp', lim: 1000 },
  email: { n: 'E-mail', lim: 2000 },
  redes: { n: 'Instagram e Facebook', lim: 2200 },
} as const
export type Canal = keyof typeof CANAIS
export const CATEGORIAS = ['Geral', 'Urgente', 'Evento', 'Cuidado'] as const
export const TIPOS_POST = { palavra: 'Palavra do Pastor', blog: 'Blog', vlog: 'Vlog' } as const
export type TipoPost = keyof typeof TIPOS_POST

export const personalizar = (texto: string, nome: string) => texto.replaceAll('{nome}', nome.split(' ')[0])

// Aceita links do YouTube (watch, youtu.be, shorts) e devolve o id, para capa e incorporação.
export function youtubeId(url: string | null | undefined) {
  const m = (url ?? '').match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/)
  return m ? m[1] : null
}
export const capaVideo = (url: string | null | undefined) => { const id = youtubeId(url); return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null }

export const ondeE = (e: { ambiente: string | null; local: string | null }) => [e.ambiente ? AMBN[e.ambiente]?.nome : null, e.local].filter(Boolean).join(' · ')

export const PUBLICOS_FIXOS = ['Toda a igreja', 'Membros', 'Visitantes', 'Liderança', 'Pessoas em risco (radar)'] as const
