# Rebanho

Gestão pastoral, pessoas e tesouraria para igrejas. Funciona no computador e no celular, e pode ser instalado na tela inicial como app (PWA).

Esta é a primeira versão de produção, construída a partir do protótipo navegável. Ela traz o núcleo com regras reais:

- **Login por link no e-mail**, sem senha.
- **Várias igrejas no mesmo sistema**: cada igreja só enxerga os próprios dados.
- **Perfis** pastor, tesouraria, secretaria, líder de célula e membro. A permissão é decidida no banco, não na tela.
- **Pessoas**: ficha completa, aviso de cadastro duplicado, consentimento LGPD com versão do termo, cuidado pastoral visível só ao pastor, exportação e anonimização a pedido do titular.
- **Tesouraria**: livro-caixa por fundo. Lançamento não se apaga nem se altera, só se estorna. Saída acima da alçada espera o pastor, e o mês fechado não aceita lançamento.
- **Contribuições**: carnê do mês a partir do compromisso de cada membro. A baixa lança no caixa e emite recibo numerado (REC-AAAA-NNNN) no mesmo passo.
- **Auditoria** gravada pelo próprio banco. Ninguém edita nem apaga, e a observação pastoral nunca vai para a trilha.
- **Ouvidoria** com protocolo (OUV-AAAA-NNNN). A manifestação anônima não guarda quem enviou.
- **Área do membro**: contribuições em aberto, recibos, preferências de contato e cópia dos próprios dados.

## Como está organizado

| Pasta | O que tem |
|---|---|
| `supabase/migrations` | Banco PostgreSQL: tabelas, regras de acesso (RLS), gatilhos e funções |
| `supabase/tests` | Testes das regras do banco (`npm run test:db`) |
| `app/` | Telas e ações do servidor (Next.js App Router) |
| `lib/` | Sessão, perfis, formatação e clientes do Supabase |
| `proxy.ts` | Renova a sessão e manda para o login quem não entrou |

**Regra de ouro:** a tela só esconde o que o banco já nega. Toda permissão nova precisa existir primeiro numa política RLS ou numa função do banco, com teste em `supabase/tests/01_regras.sql`.

## Rodar no seu computador

1. Instale Node 20 ou mais novo e crie um projeto gratuito em [supabase.com](https://supabase.com).
2. No Supabase, abra **SQL Editor** e rode, em ordem, os arquivos de `supabase/migrations`. Se preferir a linha de comando, use `supabase link` e depois `supabase db push`.
3. Copie `.env.example` para `.env.local` e preencha com **Project Settings → API**.
4. Em **Authentication → URL Configuration**, coloque `http://localhost:3000` em *Site URL* e `http://localhost:3000/auth/confirmar` em *Redirect URLs*.
5. Rode `npm install` e depois `npm run dev`. Abra http://localhost:3000, peça o link de acesso e cadastre a igreja: quem cadastra vira o pastor.

Para testar as regras do banco sem o Supabase, com um PostgreSQL 15 ou mais novo instalado, rode `npm run test:db`.

## Colocar no ar

1. **GitHub:** envie este código para um repositório privado.
2. **Vercel:** importe o repositório em [vercel.com/new](https://vercel.com/new) e cadastre as três variáveis do `.env.example`. Em `NEXT_PUBLIC_SITE_URL`, use o endereço final.
3. **Supabase:** em *Authentication → URL Configuration*, troque as URLs pelo endereço final. Em *Authentication → Emails*, configure um SMTP próprio, como Resend ou Amazon SES: o envio padrão do Supabase tem limite baixo e serve só para testes.
4. **Domínio:** registre o domínio, por exemplo `rebanho.app.br` no [registro.br](https://registro.br), e aponte para a Vercel em *Settings → Domains*.
5. **Backup:** o plano Pro do Supabase faz backup diário. No plano gratuito, faça um `pg_dump` semanal.

Custo de referência: tudo cabe no plano gratuito durante os testes. Em uso comercial ficam cerca de US$ 25/mês do Supabase Pro e US$ 20/mês da Vercel Pro, mais uns R$ 40/ano de domínio.

## Próximas fases

1. **Pagamentos:** Pix com QR por contribuição, boleto registrado e baixa automática pelo webhook de um gateway brasileiro, como Asaas ou Efí. Depois, Pix Automático.
2. **WhatsApp Business (API oficial da Meta):** lembretes e recibos automáticos, só para quem consentiu.
3. **Módulos do protótipo ainda não portados:** visitantes com funil e modo recepção, radar pastoral, manutenção GUT e 5W2H, escalas, avisos e mensageria, site e eventos, cantina, orçamento e conciliação por extrato.
4. **App nas lojas** (opcional): empacotar o PWA ou criar um app nativo usando o mesmo banco.
