import type { MetadataRoute } from 'next'

// Torna o sistema instalável na tela inicial do celular (PWA).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Rebanho',
    short_name: 'Rebanho',
    description: 'Gestão pastoral, pessoas e tesouraria para igrejas.',
    lang: 'pt-BR',
    start_url: '/',
    display: 'standalone',
    background_color: '#f3f5f4',
    theme_color: '#16261f',
    icons: [{ src: '/icone.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  }
}
