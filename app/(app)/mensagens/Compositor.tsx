'use client'
import { useState } from 'react'
import { Formulario, type Resultado } from '@/components/Formulario'
import { CANAIS, type Canal } from '@/lib/comunicacao'

// Escreve uma vez e mostra como a mensagem chega em cada canal, já com o primeiro nome do exemplo.
export function Compositor({ acao, publicos, publico, titulo, texto, exemplo }: {
  acao: (antes: Resultado, dados: FormData) => Promise<Resultado>; publicos: string[]; publico: string; titulo: string; texto: string; exemplo: string
}) {
  const [t, setT] = useState(texto), [ti, setTi] = useState(titulo)
  const [canais, setCanais] = useState<Canal[]>(['whatsapp'])
  const vista = (t || 'Escreva a mensagem para ver como ela chega em cada canal.').replaceAll('{nome}', exemplo)
  const email = (t || vista).replaceAll('{nome}', 'irmão(ã)')
  const redes = t.replace(/^Olá,\s*\{nome\}!\s*/, '').replaceAll('{nome}', '') || vista
  const alertas = canais.filter((c) => t.length > CANAIS[c].lim).map((c) => `${CANAIS[c].n} aceita até ${CANAIS[c].lim} caracteres.`)
  return (
    <div className="grid split">
      <div className="card">
        <Formulario acao={acao} enviar="Preparar envio">
          <label className="f full">Título interno (assunto do e-mail)<input type="text" name="titulo" maxLength={120} value={ti} onChange={(e) => setTi(e.target.value)} placeholder="Ex.: Convite para a Santa Ceia" /></label>
          <label className="f full">Mensagem<textarea name="texto" rows={8} required maxLength={2000} value={t} onChange={(e) => setT(e.target.value)} placeholder="Olá, {nome}! ..." /><span className="small muted mono">{t.length} caracteres · use {'{nome}'} para o primeiro nome</span></label>
          <label className="f">Público<select name="publico" defaultValue={publicos.includes(publico) ? publico : 'Membros'}>{publicos.map((p) => <option key={p}>{p}</option>)}</select></label>
          <div className="f full"><span>Canais</span><div className="row">{(Object.keys(CANAIS) as Canal[]).map((c) => (
            <label className="chk" key={c}><input type="checkbox" name="canais" value={c} checked={canais.includes(c)} onChange={(e) => setCanais(e.target.checked ? [...canais, c] : canais.filter((x) => x !== c))} />{CANAIS[c].n}</label>
          ))}</div></div>
          {alertas.length > 0 && <div className="banner warn full">{alertas.join(' ')}</div>}
        </Formulario>
      </div>
      <div className="grid" style={{ alignContent: 'start' }}>
        <h3>Como chega para {exemplo}</h3>
        <div className="previews">{canais.length ? canais.map((c) => (
          <div className="pv" key={c}><header><span>{CANAIS[c].n}</span><span className="mono">{vista.length}/{CANAIS[c].lim}</span></header>
            <div className="ct">{c === 'email' && <b>{ti || 'Assunto do e-mail'}</b>}<div className={c === 'whatsapp' ? 'bubble' : ''}>{c === 'redes' ? redes : c === 'email' ? email : vista}</div></div>
          </div>
        )) : <div className="empty">Escolha ao menos um canal.</div>}</div>
      </div>
    </div>
  )
}
