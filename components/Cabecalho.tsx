export function Cabecalho({ sobre, titulo, texto, acoes }: { sobre: string; titulo: string; texto?: string; acoes?: React.ReactNode }) {
  return (
    <div className="head">
      <div className="grid" style={{ gap: 6 }}>
        <span className="eyebrow">{sobre}</span>
        <h1>{titulo}</h1>
        {texto && <p>{texto}</p>}
      </div>
      {acoes && <div className="row">{acoes}</div>}
    </div>
  )
}
