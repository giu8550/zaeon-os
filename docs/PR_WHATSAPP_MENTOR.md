# PR — Mentor no WhatsApp (QR onboarding + agenda/estudos/lembretes)

> Objetivo: o aluno **conecta o WhatsApp via QR** e o **mentor dele fala com ele no Zap** — agenda,
> estudos, lembretes, revisão espaçada, progresso na árvore, credencial conquistada. E responde de volta.
> Reusa o que EXISTE: `agent-gateway` (transporte WhatsApp via Evolution, parado) + o teu repo de
> **disparos (ChipFlow)** como sender + o **harness/mentor** como cérebro. Não é motor novo. Escrito 2026 (Fable).

## 0. Arquitetura (quem faz o quê)
```
 Zaeon (Next) ──HTTP──► agent-gateway (bridge) ──► disparos/Evolution ──► WhatsApp do aluno
      ▲   cérebro = /api/ai/chat (harness+mentor)         ▲ inbound (webhook)
      └───────────────── responde ◄──────────────────────┘
```
**Decisão-chave (simplifica):** o `agent-gateway` vira um **bridge fino** (transporte + roteamento), **NÃO um cérebro paralelo**. O raciocínio é o **harness/mentor que já existe** — o gateway só chama `/api/ai/chat` com o `mentorId` + contexto do aluno e devolve a resposta pro Zap. Isso **elimina** a dependência de Postgres/pgvector que travava o gateway (a memória já é Atlas no app). O repo de **disparos** é o sender Evolution (instância única da plataforma, conectada 1× por QR pelo admin).

> ⚠️ Não consegui inspecionar o repo **disparos (ChipFlow)** daqui (é separado). O executor confirma a API HTTP dele (endpoint de "enviar mensagem" + formato do webhook de inbound) e pluga no seam abaixo.

## 1. QR onboarding — o jeito CERTO (não invasivo)
Há duas leituras de "cadastrar o WhatsApp via QR". A seguir a recomendada (segura e simples):
- **NÃO** linkar a conta WhatsApp do aluno (isso é o QR do Baileys/Evolution que dá controle da conta — invasivo, contra ToS pra consumidor).
- **SIM:** um **QR wa.me** (`https://wa.me/<NUMERO_PLATAFORMA>?text=CONECTAR-<codigo>`). O aluno escaneia → abre o WhatsApp já no chat da plataforma com um **código único** → envia → o inbound cai no disparos→gateway → **mapeia telefone ↔ userId**, marca `verified + optIn`. Pronto: o mentor pode mandar DM.
- É "cadastrar via QR" de verdade, mas **conectando o número ao tutor**, sem tomar a conta do aluno.

## 2. Modelo de dados (Prisma/Mongo, `prisma db push`)
```prisma
model WhatsAppLink {
  id String @id @default(auto()) @map("_id") @db.ObjectId
  userId String @db.ObjectId @unique
  phone String                 // E.164
  verified Boolean @default(false)
  optIn Boolean @default(false)
  verifyCode String?           // código do QR (one-time)
  quietHours Json?             // {start,end,tz} — não incomodar
  linkedAt DateTime?
  lastMsgAt DateTime?
  @@index([phone])
  @@map("whatsapp_links")
}
// User.phone já existe. Opcional: WhatsAppMessage log (dir, text, at) p/ auditoria.
```

## 3. Rotas (app) + seam (gateway)
- `POST /api/whatsapp/link/start` → gera `verifyCode`, retorna o **QR wa.me** (data URL) + o número.
- `POST /api/whatsapp/webhook` (chamado pelo disparos/gateway no inbound) → se o texto casa `CONECTAR-<code>`, verifica e liga; senão, **roteia pro mentor**: chama a lógica do harness (`/api/ai/chat`, `mentorId` do aluno, `surface:"whatsapp"`) e responde via sender.
- `POST /api/whatsapp/send` (interno) → manda pro sender do disparos (`sendMessage(phone, text)`), respeitando `optIn` + `quietHours`.
- Sender/webhook do **disparos**: o executor confirma os endpoints reais e adapta.

## 4. O mentor fala com o aluno (outbound) — os disparos
Um **scheduler** (o `arq` do gateway OU as scheduled-tasks do app) dispara, respeitando opt-in/quiet-hours:
- **Agenda do dia** (manhã): puxa da Sala de Aula/agenda → "Hoje: Cálculo 8h, revisar Fotossíntese."
- **Lembretes de estudo** + **revisão espaçada** (a ciência do aprendizado): "Faz 3 dias que você viu X — bora um recall rápido?" (o mentor manda 1 pergunta).
- **Progresso na árvore:** "Você está a 1 nó de desbloquear *Termodinâmica II*."
- **Deadlines / prova chegando.**
- **Conquista:** "🎓 Você acabou de ganhar uma credencial verificável na Solana!"
Cada disparo é **do mentor ativo do aluno** (voz do domínio) — reusa a persona.

## 5. Mentor de mão-dupla (o "uau")
Aluno responde no Zap → webhook → gateway roteia pro **harness com o mentorId** → o mentor responde no WhatsApp, com memória (é o mesmo tutor da web, agora no bolso). Áudio (voz) é fase 2.

## 6. Consentimento & compliance (obrigatório)
- **Opt-in explícito** (o envio do QR = consentimento) + **opt-out fácil** ("PARE" desliga `optIn`).
- **Quiet hours** respeitadas; não spammar.
- **Honestidade de transporte:** Evolution/Baileys é **não-oficial** (risco de ban, contra ToS) — ótimo pra **MVP/hackathon**. Pra escala/compliance, migrar pro **WhatsApp Business Cloud API** (Meta) com **mensagens template** e janela de 24h. O gateway já é provider-agnóstico (Evolution↔Cloud API) — trocar é config.
- **Gate:** WhatsApp = **Plus** (já previsto no `WHATSAPP_AGENT_PLAN`). Abrir pra todos é decisão do Martinez.

## 7. Infra
Roda na **VPS nova** (`75.119.140.97`, 24GB — sobra): `agent-gateway` + `disparos/Evolution` como serviços no compose, ao lado do web. Sem Postgres/pgvector (bridge fino → cérebro no app/Atlas). Segredos: número/instância Evolution, chave do disparos.

## 8. Gate / DoD
- [ ] `prisma db push` (whatsapp_links).
- [ ] Aluno escaneia o QR → envia o código → fica `verified+optIn`; número mapeado ao userId.
- [ ] Um disparo de teste (agenda/lembrete) chega no WhatsApp do aluno, com a voz do mentor, respeitando opt-in/quiet-hours.
- [ ] Aluno responde no Zap → o mentor responde (via harness, com memória).
- [ ] "PARE" desliga. Transpila; gateway sobe no compose da VPS nova.

## 9. Reuso vs novo / fronteira
**Reusa:** `agent-gateway` (bridge/engines/consentimento), disparos (sender Evolution), harness/mentor (cérebro), `User.phone`, agenda da Sala de Aula. **Novo:** `WhatsAppLink` + as 3 rotas + o QR wa.me + o scheduler de disparos + o roteamento inbound→harness. **🔒 Martinez:** número WhatsApp da plataforma + instância Evolution/chave do disparos + confirmar a API do repo de disparos. Fable escreveu o spec; executor implementa; eu não inspecionei o repo disparos (separado) — o seam está pronto pra plugar nele.
