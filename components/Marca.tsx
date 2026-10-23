export function Marca({ tamanho = 30 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 30 30" aria-hidden="true">
      <path d="M8 26c0-9 3-14 7-18 4 4 7 9 7 18" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M15 3v8M11.5 6.5h7" stroke="var(--gold)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}
