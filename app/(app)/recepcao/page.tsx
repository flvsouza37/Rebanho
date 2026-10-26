import Link from 'next/link'
import { exigirAcesso } from '@/lib/sessao'
import { Formulario } from '@/components/Formulario'
import { registrarVisita } from './acoes'

export const metadata = { title: 'Modo recepção' }

const ORIGENS = ['Convite de um amigo ou parente', 'Passei em frente', 'Instagram ou Facebook', 'Google ou site', 'Evento da igreja', 'Célula', 'Outro']

// Tela para o tablet na entrada: o visitante preenche sozinho.
export default async function Recepcao({ searchParams }: { searchParams: Promise<{ ok?: string; voltou?: string }> }) {
  const s = await exigirAcesso('pessoas', 'editar')
  const sp = await searchParams
  if (sp.ok) return (
    <div className="card recepcao" style={{ textAlign: 'center' }}>
      <h1>{sp.voltou ? `Que bom te ver de novo, ${sp.ok}!` : `Que bom ter você aqui, ${sp.ok}!`}</h1>
      <p>Alguém da nossa equipe vai falar com você ainda esta semana.</p>
      <div className="row" style={{ justifyContent: 'center' }}><Link className="btn" href="/recepcao">Novo cadastro</Link></div>
    </div>
  )
  return (
    <div className="card recepcao">
      <span className="eyebrow">Bem-vindo à {s.igreja.nome}</span>
      <h1>Conte para a gente quem você é</h1>
      <p className="small muted">Leva menos de um minuto.</p>
      <Formulario acao={registrarVisita} enviar="Enviar">
        <label className="f full">Seu nome<input type="text" name="nome" required minLength={2} maxLength={120} autoComplete="name" /></label>
        <label className="f">WhatsApp<input type="tel" name="telefone" maxLength={30} autoComplete="tel" /></label>
        <label className="f">Bairro onde mora<input type="text" name="bairro" maxLength={80} /></label>
        <label className="f full">Como conheceu a igreja<select name="como_conheceu" defaultValue=""><option value="">Escolha</option>{ORIGENS.map((o) => <option key={o}>{o}</option>)}</select></label>
        <label className="f full">Quer que a gente ore por algo? (opcional)<textarea name="oracao" rows={3} maxLength={1000} /></label>
        <div className="full grid" style={{ gap: 6 }}>
          <label className="chk"><input type="checkbox" name="lgpd_whats" />Aceito receber mensagens da igreja no WhatsApp</label>
          <label className="chk"><input type="checkbox" name="lgpd_imagem" />Autorizo o uso da minha imagem em fotos dos cultos</label>
          <span className="small muted">Seus dados ficam só com a igreja, para contato e cuidado pastoral, e você pode pedir para apagar quando quiser.</span>
        </div>
      </Formulario>
    </div>
  )
}
