# Mentor no WhatsApp (QR onboarding + agenda/estudos/lembretes) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O aluno conecta o WhatsApp via QR `wa.me` (código `CONECTAR-XXXX`), o mentor ativo dele manda disparos (agenda do dia, revisão espaçada, prazos, progresso/credencial) e responde de volta pelo Zap com a mesma memória da web. "PARE" desliga.

**Architecture:** O cérebro fica NO APP (Next): `lib/whatsapp/*` reusa o harness (`buildHarnessDeps` + `runTrajectoryTraced`), o resolver de mentores (`resolveMentor`) e a memória L3 (`wakeUpContext`/`writeTurnMemory`). O transporte é provider-agnóstico (`lib/whatsapp/sender.ts`: `evolution` direto | `disparos` (ChipFlow, seam) | `log`). O `agent-gateway` vira um **bridge fino** (`/webhook/wa` → POST `/api/whatsapp/webhook` do app, com segredo) — sem Postgres/pgvector. Scheduler = tick no `server.js` (a cada N min) chamando `/api/whatsapp/dispatch` (idempotente por `dedupeKey`).

**Tech Stack:** Next.js 14 App Router, Prisma + MongoDB (`prisma db push`), vitest, `qrcode` (QR como data URL), FastAPI (bridge), Docker Compose (perfil `whatsapp`).

## Global Constraints

- Branch `claude/mentor-whatsapp-qr-ed0c2b`. **Nunca `git add -A`**. Commits por task.
- `npx tsc --noEmit`: zero erros novos (baseline ≤5). `npm test` verde (baseline 354+).
- Prisma/Mongo: só campos/coleções novas (aditivo). `npx prisma generate` após o schema.
- Sem segredos no git. Envs novas documentadas em `.env.example`.
- Não linkar a conta do aluno (sem QR Baileys por usuário). O QR é `wa.me` do número da plataforma.
- Opt-in explícito (envio do código = consentimento), opt-out "PARE", quiet hours respeitadas.
- Gate: WhatsApp = Plus (`whatsappEnabled` de `lib/plans.ts`); `WHATSAPP_OPEN_TO_ALL=1` abre pra todos.
- Strings de UI/WhatsApp em português.

## File map

| Arquivo | Responsabilidade |
|---|---|
| `prisma/schema.prisma` | `WhatsAppLink` (+ `WhatsAppMessage` log/idempotência) |
| `lib/whatsapp/phone.ts` | E.164 BR, jid ↔ phone (puro) |
| `lib/whatsapp/link.ts` | código de verificação, URL `wa.me`, parser de inbound (CONECTAR/PARE/VOLTAR/chat) (puro) |
| `lib/whatsapp/policy.ts` | opt-in/verified/quiet-hours/gate de plano, hora local por tz (puro) |
| `lib/whatsapp/format.ts` | markdown → texto WhatsApp (puro) |
| `lib/whatsapp/inbound.ts` | normaliza payload Evolution / bridge / genérico (puro) |
| `lib/whatsapp/sender.ts` | `buildSendRequest` (puro) + `sendWhatsAppText` (fetch) |
| `lib/whatsapp/dispatch.ts` | composição dos disparos: agenda do dia, revisão espaçada, prazos, kinds devidos (puro) |
| `lib/whatsapp/voice.ts` | reescreve fatos na voz do mentor (Gemini; fallback determinístico) |
| `lib/whatsapp/brain.ts` | turno do mentor via harness (+ fallback Gemini), memória, transcript |
| `lib/whatsapp/service.ts` | orquestração server (Prisma): startLink, handleInbound, notify, runDispatch |
| `app/api/whatsapp/link/start/route.ts` | POST → QR + número |
| `app/api/whatsapp/link/status/route.ts` | GET status · DELETE desliga |
| `app/api/whatsapp/webhook/route.ts` | inbound (bridge/Evolution/disparos) |
| `app/api/whatsapp/send/route.ts` | interno: enviar respeitando policy |
| `app/api/whatsapp/dispatch/route.ts` | interno: roda os disparos devidos |
| `server.js` | tick do scheduler |
| `components/whatsapp/WhatsAppConnectCard.tsx` + `ProfilePanel.tsx` | UI do QR |
| `agent-gateway/app/bridge/forward.py` + `app/api/main.py` | bridge fino |
| `docker-compose.beta.yml` | perfil `whatsapp` (bridge + evolution) |
| `docs/WHATSAPP_MENTOR.md`, `.env.example` | runbook + envs |

---

### Task 1: Schema — `WhatsAppLink` + `WhatsAppMessage`

**Files:** Modify `prisma/schema.prisma` (fim do arquivo).

- [ ] Adicionar:

```prisma
// ─── Mentor no WhatsApp ─── (docs/WHATSAPP_MENTOR.md). Vínculo número↔usuário por QR wa.me
// (NÃO pareia a conta do aluno). optIn = consentimento; "PARE" desliga. quietHours = não incomodar.
model WhatsAppLink {
  id         String    @id @default(auto()) @map("_id") @db.ObjectId
  userId     String    @unique @db.ObjectId
  phone      String?                     // E.164 (+55…); null até o aluno mandar o código
  verified   Boolean   @default(false)
  optIn      Boolean   @default(false)
  verifyCode String?                     // código one-time do QR (CONECTAR-XXXX)
  codeIssuedAt DateTime?
  quietHours Json?                       // { start: 22, end: 7, tz: "America/Sao_Paulo" }
  linkedAt   DateTime?
  lastMsgAt  DateTime?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  @@index([phone])
  @@index([verifyCode])
  @@map("whatsapp_links")
}

model WhatsAppMessage {               // auditoria + idempotência dos disparos (dedupeKey)
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  userId    String   @db.ObjectId
  dir       String   // "in" | "out"
  kind      String   // chat | connect | stop | agenda | review | deadline | tree | credential | test
  text      String
  dedupeKey String?  // ex.: "agenda:2026-09-09" — findFirst antes de enviar
  at        DateTime @default(now())

  @@index([userId, at])
  @@index([userId, dedupeKey])
  @@map("whatsapp_messages")
}
```

- [ ] `npx prisma generate` → OK. `npx tsc --noEmit` → sem erros novos.
- [ ] Commit: `feat(whatsapp): schema WhatsAppLink + WhatsAppMessage`

---

### Task 2: Puro — `phone.ts`, `link.ts`, `format.ts` (TDD)

**Interfaces produzidas:**
- `toE164(raw: string): string | null` — BR default (`5511…`→`+5511…`, `11 99999-9999`→`+5511999999999`).
- `phoneFromJid(jid: string): string | null` (`5511999999999@s.whatsapp.net` → `+5511999999999`; grupos `@g.us` → null).
- `jidNumber(phone: string): string` (`+5511…` → `5511…`).
- `newVerifyCode(): string` (6 chars `[A-Z2-9]`, sem 0/O/1/I).
- `connectText(code): string` = `CONECTAR-<code>`; `waMeUrl(platformPhone, text)`.
- `parseInbound(text): { kind: "connect"; code } | { kind: "stop" } | { kind: "resume" } | { kind: "chat"; text }`.
- `toWhatsAppText(md: string, max = 3500): string`.

- [ ] Testes em `lib/whatsapp/phone.test.ts`, `link.test.ts`, `format.test.ts` (ver código nas seções abaixo). Rodar → FAIL. Implementar → PASS.
- [ ] Commit: `feat(whatsapp): helpers puros (phone, link code, format)`

---

### Task 3: Puro — `policy.ts` (quiet hours, opt-in, gate) (TDD)

- `localParts(now: Date, tz: string): { hour; minute; weekday(1=Seg…7=Dom); dateKey }` via `Intl.DateTimeFormat`.
- `inQuietHours(qh: QuietHours | null, now: Date): boolean` (suporta janela cruzando meia-noite; default 22→7 America/Sao_Paulo).
- `canSend(link: { verified; optIn; phone; quietHours }, now: Date): { ok: true } | { ok: false; reason: "not_verified" | "opted_out" | "no_phone" | "quiet_hours" }`.
- `whatsappAllowed(plan: PlanState, env = process.env): boolean` (`WHATSAPP_OPEN_TO_ALL=1` ou `whatsappEnabled`).

- [ ] `lib/whatsapp/policy.test.ts` → FAIL → implementar → PASS. Commit.

---

### Task 4: Puro — `inbound.ts` + `sender.ts` (TDD)

- `normalizeInbound(payload: unknown): InboundMsg | null` com `InboundMsg = { phone: string; text: string; messageId?: string }`. Aceita: Evolution `messages.upsert` (`data.key.remoteJid`, `data.message.conversation|extendedTextMessage.text`, ignora `fromMe`/grupos), bridge/genérico `{ phone|from|number, text|message|body, messageId|id }`.
- `buildSendRequest(provider, cfg, phone, text): { url; init: RequestInit } | null` (puro). Providers: `evolution` (`POST {url}/message/sendText/{instance}`, header `apikey`, body `{number, text}`), `disparos` (`POST {url}{sendPath}`, `Authorization: Bearer`, body `{phone, text}`), `log` (null → console).
- `sendWhatsAppText(phone, text): Promise<{ ok: boolean; provider: string; status?: number }>`.

- [ ] Testes `inbound.test.ts`, `sender.test.ts` → implementar → PASS. Commit.

---

### Task 5: Puro — `dispatch.ts` (agenda, revisão espaçada, prazos, kinds devidos) (TDD)

- `agendaForWeekday(schedule: unknown, weekday: number): AgendaItem[]` ordenados por hora (`{ name, hour, endHour, teacher?, room? }`; item tem `days: number[]` 1..7).
- `agendaFacts(items): string` → `"Hoje: Cálculo 8h–10h (Prof. Ana, sala 12); …"` ou `""`.
- `reviewCandidates(rows: { title; completedAt: Date }[], now, intervalsDays = [1,3,7,14,30]): { title; daysAgo }[]` (batem num intervalo ±0 dia).
- `deadlineFacts(docs: { id; title; dueAt: Date }[], now, withinHours = 48)`.
- `dueKinds(now, tz, sentKeys: Set<string>, opts): { kind: "agenda"|"review"; dedupeKey }[]` (agenda a partir de `digestHour` (7), review a partir de 16h; um por dia).

- [ ] `dispatch.test.ts` → implementar → PASS. Commit.

---

### Task 6: Server — `voice.ts`, `brain.ts`, `service.ts` + `Surface` "whatsapp"

- `lib/agent/transcript.ts`: adicionar `"whatsapp"` ao `Surface` e ao array `SURFACES`.
- `voice.ts`: `inMentorVoice({ mentorContext, mentorName, facts, kind }): Promise<string>` — `geminiJson` com prompt "reescreva em 1–3 frases como mensagem de WhatsApp na voz do mentor"; fallback = `facts` com prefixo do kind. Injetável (`genJson`).
- `brain.ts`: `answerOnWhatsApp({ userId, text }): Promise<string>` — resolve `activeMentorId` do user → `resolveMentor`; histórico via `getRecent(userId,"whatsapp")` (últimas 12); `AURA_HARNESS !== "0"` → `buildHarnessDeps(hctx, { systemContext, history })` + `runTrajectoryTraced` + `renderStructuredAnswer`; senão/erro → `getGeminiChatModel(system).startChat({history})`; `appendMessages`; `writeTurnMemory` fire-and-forget; devolve `toWhatsAppText(...)`.
- `service.ts`: `startLink(userId)`, `getLinkStatus(userId)`, `unlink(userId)`, `handleInbound(msg)`, `notifyWhatsApp({ userId, kind, text, dedupeKey })`, `runDispatch(now)`; hooks `notifyCredential(userId, label)`, `notifyTreeProgress(userId, text)`.

- [ ] tsc limpo. Commit: `feat(whatsapp): cérebro (harness+mentor), voz do mentor e serviço`

---

### Task 7: Rotas + scheduler no `server.js`

- `POST /api/whatsapp/link/start` (auth sessão; gate de plano) → `{ qrDataUrl, waUrl, code, phone }` (`qrcode.toDataURL`).
- `GET /api/whatsapp/link/status` → `{ linked, verified, optIn, phone(mascarado), quietHours }`; `DELETE` → optIn=false + verified=false.
- `POST /api/whatsapp/webhook` (segredo `x-whatsapp-secret` ou `?token=`) → `normalizeInbound` → `handleInbound` → `{ ok, action }`.
- `POST /api/whatsapp/send` (`x-internal-token`) `{ userId, text, kind?, dedupeKey? }`.
- `POST /api/whatsapp/dispatch` (`x-internal-token`) → `runDispatch(new Date())` → `{ sent, skipped }`.
- `server.js`: se `WHATSAPP_PROVIDER` e `WHATSAPP_INTERNAL_TOKEN` estão setados, `setInterval` (`WHATSAPP_DISPATCH_EVERY_MIN`, default 15) → fetch local `/api/whatsapp/dispatch`.

- [ ] `npm i qrcode @types/qrcode`. tsc limpo. Commit.

---

### Task 8: UI — `WhatsAppConnectCard` no perfil

- Card: status (não conectado / aguardando código / conectado ✓), botão "Gerar QR", mostra QR + botão "Abrir no WhatsApp" (link `wa.me`) + texto do código, botão "Desligar". Aviso de consentimento e "PARE".
- Montar em `components/research/ProfilePanel.tsx` abaixo do `PresenceGraph`.

- [ ] tsc limpo. Commit.

---

### Task 9: Bridge fino no `agent-gateway` + compose + docs

- `agent-gateway/app/bridge/forward.py`: `to_app_payload(evolution_payload) -> dict | None` (puro) + `forward_to_app(payload, *, client)`.
- `app/api/main.py`: `/webhook/wa` → `to_app_payload` → POST `ZAEON_WEBHOOK_URL` com `x-whatsapp-secret`.
- `app/core/config.py`: `ZAEON_WEBHOOK_URL`, `WHATSAPP_WEBHOOK_SECRET`.
- `tests/test_bridge_forward.py` (pytest).
- `docker-compose.beta.yml`: perfil `whatsapp` → `agent-bridge` (uvicorn, sem Postgres) + `evolution` (v1.x, sem Postgres).
- `.env.example` + `docs/WHATSAPP_MENTOR.md`.

- [ ] `python3 -m pytest agent-gateway/tests/test_bridge_forward.py`. Commit.

---

### Self-review (spec coverage)

- §1 QR wa.me → Task 2/7/8. §2 modelo → Task 1. §3 rotas → Task 7. §4 disparos → Task 5/6/7 (+ hooks tree/credential em service.ts; skill tree/Solana ainda não estão no main → hooks expostos). §5 mão-dupla → Task 6. §6 consentimento/PARE/quiet hours/gate → Task 2/3/6. §7 infra → Task 9. §8 DoD → smoke manual no VPS (README).
