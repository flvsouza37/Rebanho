import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Rebanho', template: '%s · Rebanho' },
  description: 'Gestão pastoral, pessoas e tesouraria para igrejas.',
  appleWebApp: { capable: true, title: 'Rebanho', statusBarStyle: 'black-translucent' },
}

export const viewport: Viewport = {
  themeColor: '#16261f',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,500;7..72,650&family=Figtree:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  )
}
