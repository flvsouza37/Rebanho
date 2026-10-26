import { capaVideo } from '@/lib/comunicacao'

// Capa de cartão: miniatura do YouTube quando há vídeo, senão o degradê da marca com o rótulo.
export function Capa({ video, rotulo }: { video?: string | null; rotulo: string }) {
  const img = capaVideo(video)
  return (
    <div className={`cover${video ? ' vid' : ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {img && <img src={img} alt="" loading="lazy" />}
      <span>{rotulo}</span>
    </div>
  )
}
