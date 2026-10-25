// Leitura das microáreas: índice de potencial evangelístico e perfil de cada bairro.
// O índice compara os bairros dentro do mesmo município (percentis), de 0 a 100.

export type Microarea = {
  microarea: string; municipio: string; uf: string
  cresc_pop_aa: number; cresc_renda_aa: number; area_km2: number; populacao: number
  densidade: number; domicilios: number; renda_media: number; pea_dia: number
}
export type PerfilId = 'polo' | 'expansao' | 'social' | 'alta' | 'dormitorio' | 'rural' | 'misto'
export type Analise = Microarea & { fluxo: number; ipe: number; perfil: PerfilId; novos: number }

export const CANAIS: Record<string, string> = {
  whatsapp: 'WhatsApp', instagram: 'Instagram', facebook: 'Facebook', email: 'E-mail', sms: 'SMS',
}

export const PERFIL: Record<PerfilId, { nome: string; cls: string; cor: string; porque: string; hora: string; acoes: string[]; canais: string[]; convite: string }> = {
  polo: {
    nome: 'Polo de trabalho', cls: 'info', cor: 'var(--info)',
    porque: 'Recebe mais gente de dia do que mora ali (fluxo diurno 1,5× ou mais).',
    hora: 'Dias úteis, 11h30 às 14h e 17h30 às 19h',
    acoes: ['Culto ou devocional de meio-dia em horário de almoço', 'Capelania empresarial e oração por comerciantes', 'Panfletagem e convite para eventos curtos depois do expediente', 'Anúncio geolocalizado no Instagram e Facebook em horário comercial'],
    canais: ['instagram', 'facebook', 'whatsapp'],
    convite: 'Uma pausa no meio do dia faz diferença. Toda quarta, às 12h15, temos 30 minutos de louvor e palavra aqui perto. Venha do jeito que está!',
  },
  expansao: {
    nome: 'Bairro em expansão', cls: 'ok', cor: 'var(--ok)',
    porque: 'Crescimento populacional entre os mais altos do município: muita gente recém-chegada, ainda sem vínculo com uma igreja.',
    hora: 'Sábados de manhã e noites de semana',
    acoes: ['Kit de boas-vindas para novos moradores (mapa do bairro, contatos úteis, convite)', 'Café de vizinhança no salão de festas de condomínios novos', 'Célula de recém-chegados com foco em fazer amigos', 'Parceria com síndicos e grupos de WhatsApp do condomínio'],
    canais: ['whatsapp', 'instagram'],
    convite: 'Chegou ao bairro há pouco tempo? Queremos te conhecer! Neste sábado tem café da manhã de boas-vindas para novos vizinhos. É de graça e as crianças são bem-vindas.',
  },
  social: {
    nome: 'Vulnerabilidade social', cls: 'warn', cor: 'var(--warn)',
    porque: 'Renda média entre as 25% mais baixas do município.',
    hora: 'Sábados e contraturno escolar',
    acoes: ['Ação social com atendimento (corte de cabelo, orientação jurídica, saúde)', 'Reforço escolar e curso profissionalizante gratuito', 'Cesta básica com acompanhamento pastoral, não só entrega', 'Parceria com CRAS, escolas e associação de moradores'],
    canais: ['whatsapp', 'sms'],
    convite: 'Neste sábado, das 9h às 13h, tem mutirão de serviços gratuitos na igreja: corte de cabelo, aferição de pressão e orientação para emprego. Traga a família!',
  },
  alta: {
    nome: 'Alta renda consolidada', cls: 'acc', cor: 'var(--plum)',
    porque: 'Renda média entre as 25% mais altas do município.',
    hora: 'Noites de semana, encontros de 1h a 1h30',
    acoes: ['Ciclo de palestras: casamento, educação de filhos, ansiedade, finanças', 'Grupo de estudo bíblico em casas ou cafés', 'Conteúdo em vídeo curto e podcast do pastor', 'Voluntariado em projetos sociais como porta de entrada'],
    canais: ['instagram', 'email', 'facebook'],
    convite: 'Como cuidar da ansiedade sem deixar a vida parar? Quinta, às 20h, conversa aberta com o pastor e uma psicóloga. Entrada gratuita, vagas limitadas.',
  },
  dormitorio: {
    nome: 'Bairro dormitório', cls: '', cor: 'var(--accent)',
    porque: 'Mais da metade dos moradores sai para trabalhar fora: o bairro esvazia de dia e enche à noite e no fim de semana.',
    hora: 'Noites (19h30) e domingos',
    acoes: ['Células nas casas em noites de semana', 'Eventos de família no domingo à tarde (piquenique, cinema, gincana)', 'EBD e ministério infantil como porta de entrada para os pais', 'Carro de som e convites porta a porta no sábado'],
    canais: ['whatsapp', 'facebook'],
    convite: 'Domingo à tarde tem programação para a família toda: brincadeiras para as crianças, lanche e um momento de palavra. Esperamos vocês às 16h!',
  },
  rural: {
    nome: 'Rural ou baixa densidade', cls: '', cor: 'var(--low)',
    porque: 'Menos de 150 habitantes por km²: as casas são distantes.',
    hora: 'Fins de semana, combinando com a rotina do campo',
    acoes: ['Culto nos lares e ponto de pregação itinerante', 'Visitas de casa em casa com a equipe de cuidado', 'Rádio comunitária e mensagens em áudio no WhatsApp', 'Transporte solidário para os cultos'],
    canais: ['whatsapp', 'sms'],
    convite: 'Vamos fazer um culto na casa de uma família da região neste sábado, às 17h. Quer receber o próximo na sua casa? Responda esta mensagem.',
  },
  misto: {
    nome: 'Residencial misto', cls: '', cor: 'var(--muted)',
    porque: 'Sem um traço dominante: moradores e trabalhadores em equilíbrio.',
    hora: 'Domingos e uma noite fixa na semana',
    acoes: ['Convite pessoal: cada membro traz um vizinho', 'Evento aberto mensal (louvor na praça, feira, culto ao ar livre)', 'Divulgação no comércio local e nas escolas'],
    canais: ['whatsapp', 'instagram', 'facebook'],
    convite: 'Você é nosso convidado! Domingo, às 19h, culto especial com louvor e uma palavra de esperança. Venha e traga alguém.',
  },
}

export const ehPerfil = (x: unknown): x is PerfilId => typeof x === 'string' && x in PERFIL

// Posição relativa de um valor na lista (0 = menor, 1 = maior), tratando empates pelo meio.
function percentil(lista: number[]) {
  const s = [...lista].sort((a, b) => a - b), n = s.length
  const busca = (v: number, incl: boolean) => {
    let lo = 0, hi = n
    while (lo < hi) { const m = (lo + hi) >> 1; if (s[m] < v || (incl && s[m] === v)) lo = m + 1; else hi = m }
    return lo
  }
  return (v: number) => {
    if (n < 2) return 0.5
    const menor = busca(v, false), ateIgual = busca(v, true)
    return Math.max(0, (menor + (ateIgual - menor) / 2 - 0.5) / (n - 1))
  }
}

export function quantil(lista: number[], p: number) {
  const s = [...lista].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0
}

// Pesos: 30% crescimento da população, 25% densidade, 20% população, 15% moradores por domicílio, 10% crescimento da renda.
export function analisar(lista: Microarea[]): Analise[] {
  const mor = (x: Microarea) => (x.domicilios ? x.populacao / x.domicilios : 0)
  const r = {
    tp: percentil(lista.map((x) => x.cresc_pop_aa)), d: percentil(lista.map((x) => x.densidade)),
    p: percentil(lista.map((x) => x.populacao)), tr: percentil(lista.map((x) => x.cresc_renda_aa)), mh: percentil(lista.map(mor)),
  }
  const tp75 = quantil(lista.map((x) => x.cresc_pop_aa), 0.75)
  const ry25 = quantil(lista.map((x) => x.renda_media), 0.25), ry75 = quantil(lista.map((x) => x.renda_media), 0.75)
  return lista.map((x) => {
    const fluxo = x.populacao ? x.pea_dia / x.populacao : 0
    const ipe = Math.round(100 * (0.3 * r.tp(x.cresc_pop_aa) + 0.25 * r.d(x.densidade) + 0.2 * r.p(x.populacao) + 0.15 * r.mh(mor(x)) + 0.1 * r.tr(x.cresc_renda_aa)))
    const perfil: PerfilId = fluxo >= 1.5 ? 'polo' : x.densidade < 150 ? 'rural'
      : x.cresc_pop_aa >= tp75 && x.cresc_pop_aa >= 2.5 ? 'expansao'
      : x.renda_media <= ry25 ? 'social' : x.renda_media >= ry75 ? 'alta' : fluxo < 0.6 ? 'dormitorio' : 'misto'
    return { ...x, fluxo, ipe, perfil, novos: Math.round((x.populacao * x.cresc_pop_aa) / 100) }
  }).sort((a, b) => b.ipe - a.ipe)
}

export const semAcento = (t: string | null | undefined) =>
  String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export const numBR = (v: number, casas = 0) =>
  (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: casas })
export const perfilDe = (x: unknown): PerfilId => (ehPerfil(x) ? x : 'misto')
