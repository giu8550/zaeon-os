# Mentor no WhatsApp — QR onboarding + agenda/estudos/lembretes (runbook)

> Status: implementado (PR `claude/mentor-whatsapp-qr-ed0c2b`) · Escrito 2026-09-09.
> Spec de origem: seções 0–9 do PR "Mentor no WhatsApp". Plano: `docs/superpowers/plans/2026-09-09-mentor-whatsapp-qr.md`.

## O que é

O aluno conecta o WhatsApp **sem entregar a conta** (QR `wa.me` do número da plataforma + código
`CONECTAR-XXXX`). A partir daí o **mentor ativo** dele (a mesma persona/memória da web) manda:
agenda do dia, revisão espaçada, prazos, progresso na árvore e credenciais — e **responde** quando
o aluno escreve. "PARE" desliga; "VOLTAR" religa.

```
Zaeon (Next) ──► sender (bridge Redis da ChipFlow | Evolution | disparos legado) ──► WhatsApp do aluno
   ▲  cérebro = lib/whatsapp/brain.ts (harness + mentor + memória L3)     │ inbound
   └──── /api/whatsapp/webhook ◄── agent-bridge (/webhook/wa) ◄── Evolution webhook
```

Decisão-chave: o `agent-gateway` é um **bridge fino** (`app/bridge/forward.py`): normaliza o
evento do Evolution e faz POST no app com segredo. Sem Postgres/pgvector/arq. O raciocínio vive
no app (Atlas).

## Arquivos

| Camada | Arquivo | Papel |
|---|---|---|
| Schema | `prisma/schema.prisma` → `WhatsAppLink`, `WhatsAppMessage` | vínculo + log/idempotência |
| Puro | `lib/whatsapp/{phone,link,policy,format,inbound,sender,dispatch}.ts` | E.164, código/QR, opt-in/quiet-hours/gate, markdown→Zap, normalização de inbound, sender provider-agnóstico, composição dos disparos — todos com testes vitest |
| Server | `lib/whatsapp/brain.ts` | turno do mentor: `resolveMentor` + `wakeUpContext` + harness (`runTrajectoryTraced`) → fallback Gemini; grava transcript (surface `whatsapp`) e memória |
| Server | `lib/whatsapp/voice.ts` | reescreve fatos na voz do mentor (Gemini; fallback determinístico) |
| Server | `lib/whatsapp/service.ts` | `startLink`, `handleInbound`, `notifyWhatsApp`, `notifyInVoice`, `runDispatch`, ganchos `notifyCredential`/`notifyTreeProgress` |
| Rotas | `app/api/whatsapp/link/start` (POST) · `link/status` (GET/PATCH/DELETE) · `webhook` (POST) · `send` (POST, interno) · `dispatch` (POST, interno) | |
| Scheduler | `server.js` → `startWhatsAppScheduler` | tick a cada `WHATSAPP_DISPATCH_EVERY_MIN` (15) → `/api/whatsapp/dispatch` |
| UI | `components/whatsapp/WhatsAppConnectCard.tsx` (montado em `ProfilePanel`) | QR, status, quiet hours, desligar |
| Bridge | `agent-gateway/app/bridge/forward.py`, `app/api/main.py` (`/webhook/wa`) | Evolution → app |
| Infra | `docker-compose.beta.yml` perfil `whatsapp` (`agent-bridge`, `evolution`) | |

## Envs (ver `.env.example`)

| Env | Uso |
|---|---|
| `WHATSAPP_PLATFORM_PHONE` | número da plataforma (E.164). Sem ele o card mostra "não configurado". 🔒 |
| `WHATSAPP_WEBHOOK_SECRET` | segredo do inbound (`x-whatsapp-secret` ou `?token=`). Sem ele o webhook responde 503. |
| `WHATSAPP_INTERNAL_TOKEN` | token das rotas internas e do tick do scheduler. |
| `WHATSAPP_PROVIDER` | `bridge` \| `evolution` \| `disparos` \| `log` (default: inferido de `EVOLUTION_URL` → URL do bridge → `DISPAROS_URL`, senão `log`). |
| `CHIPFLOW_BRIDGE_REDIS_URL` 🔒, `BRIDGE_REDIS_URL`, `NUM_SHARDS`, `BRIDGE_INSTANCE_ID`, `BRIDGE_TIMEOUT_MS` | provider `bridge`: chip da ChipFlow via Redis Streams (`wa:cmd`/`wa:evt`). O chip de cada agente vem do `AgentChannel` (`PUT /api/admin/agents/:key/canal`); `BRIDGE_INSTANCE_ID` é o fallback. Nunca cai no `REDIS_URL`. Ver `docs/HANDOFF_AGENTE_MENSAGEIRO_V3.md`. |
| `EVOLUTION_URL`, `EVOLUTION_INSTANCE`, `EVOLUTION_API_KEY` | instância única da plataforma. 🔒 |
| `DISPAROS_URL`, `DISPAROS_API_KEY`, `DISPAROS_SEND_PATH` | sender via repo de disparos (ChipFlow). ⚠️ seam: confirmar path/corpo. |
| `WHATSAPP_OPEN_TO_ALL` | `1` abre pra todos (default: só Plus — `whatsappEnabled` de `lib/plans.ts`). |
| `WHATSAPP_DISPATCH`, `WHATSAPP_DISPATCH_EVERY_MIN` | liga/desliga e cadência do scheduler. |

## Subir na VPS

1. `.env`: preencher as envs acima. `prisma db push` roda no deploy (aditivo: cria `whatsapp_links`, `whatsapp_messages`).
2. Perfil opcional: `COMPOSE_PROFILES=whatsapp docker compose -f docker-compose.beta.yml up -d --build`.
3. **Evolution (opção A)**: criar a instância única e parear o número da plataforma 1× (QR do admin):
   ```bash
   curl -X POST http://localhost:8080/instance/create -H "apikey: $EVOLUTION_API_KEY" \
     -H 'Content-Type: application/json' -d '{"instanceName":"zaeon","qrcode":true}'
   # webhook da instância → bridge (ou direto no web com ?token=)
   curl -X POST http://localhost:8080/webhook/set/zaeon -H "apikey: $EVOLUTION_API_KEY" \
     -H 'Content-Type: application/json' \
     -d '{"enabled":true,"url":"http://agent-bridge:8000/webhook/wa","events":["MESSAGES_UPSERT"]}'
   ```
   (Os comandos acima são executados de dentro da rede do compose, ex.: `docker compose exec web sh`.)
   **Disparos/ChipFlow (opção B)**: `WHATSAPP_PROVIDER=disparos`, `DISPAROS_URL` apontando pro serviço,
   e o webhook de inbound do disparos → `https://<dominio>/api/whatsapp/webhook?token=<WHATSAPP_WEBHOOK_SECRET>`
   com corpo `{ phone|from, text|message|body, messageId|id }` (aceito por `lib/whatsapp/inbound.ts`).
4. Smoke (DoD):
   - Perfil → "Gerar QR e conectar" → escanear → enviar `CONECTAR-XXXX` → card vira "conectado".
   - Disparo de teste (voz do mentor):
     ```bash
     curl -X POST https://<dominio>/api/whatsapp/send -H "x-internal-token: $WHATSAPP_INTERNAL_TOKEN" \
       -H 'Content-Type: application/json' \
       -d '{"userId":"<ObjectId>","kind":"test","facts":"Teste do canal: agenda de amanhã tem Cálculo às 8h.","ignoreQuiet":true}'
     ```
   - Responder no Zap → o mentor responde (harness + memória; ver `whatsapp_messages`).
   - `PARE` → `optIn=false` (disparos param; `VOLTAR` religa). Simular o scheduler:
     `curl -X POST '.../api/whatsapp/dispatch?at=2026-09-10T11:00:00Z' -H "x-internal-token: …"`.

## Disparos (o que roda quando)

| Kind | Quando | Fonte | dedupeKey |
|---|---|---|---|
| `agenda` | ≥ 7h local, 1×/dia | `UserSpaceData.schedule` (agenda da Sala de Aula) | `agenda:YYYY-MM-DD` |
| `review` | ≥ 16h local, 1×/dia | `AulaProgress.completed` em D+1/3/7/14/30 → 1 pergunta de recall | `review:YYYY-MM-DD` |
| `deadline` | tarefa/prova vence em ≤ 48h | `TeacherDocument.dueAt` (assignedTo) | `deadline:<docId>` |
| `tree` / `credential` | event-driven | ganchos `notifyTreeProgress` / `notifyCredential` (ou `POST /api/whatsapp/send` com `facts`) | `tree:<ref>` / `credential:<ref>` |

Todos respeitam `verified + optIn + quietHours` (`lib/whatsapp/policy.ts`) e o gate de plano.
Hora local por `quietHours.tz` (default `America/Sao_Paulo`).

## Consentimento & compliance

- Opt-in explícito = o envio do código. Opt-out `PARE` (também `STOP`/`SAIR`); `VOLTAR` religa. Desligar no card.
- Quiet hours (default 22h→7h) editáveis no card. Idempotência por `dedupeKey` (nada de spam por tick repetido).
- Números desconhecidos (sem vínculo) **não recebem resposta** — só quem manda `CONECTAR-…` inválido recebe 1 aviso.
- Evolution/Baileys é **não-oficial** (risco de ban/ToS): ótimo pra MVP. Pra escala, WhatsApp Business Cloud API
  (templates + janela de 24h) — o sender é provider-agnóstico, é trocar `buildSendRequest`.

## O que ficou pro dono (🔒) / próximos passos

- Número da plataforma + instância Evolution/chave, ou a API real do repo de disparos (`DISPAROS_SEND_PATH`
  e formato do webhook — o seam aceita `{phone,text,messageId}`).
- Skill tree e credenciais Solana ainda não estão no `main` desta branch: os ganchos
  `notifyTreeProgress`/`notifyCredential` estão prontos pra serem chamados quando essas features entrarem.
- Fase 2: áudio (nota de voz) — o sender ganha `sendAudio`; o harness já é o mesmo.
