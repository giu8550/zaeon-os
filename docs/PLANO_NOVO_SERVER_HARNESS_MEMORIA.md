# PLANO — Subir a Zaeon num SERVER NOVO com Harness + Memória (para conferir ao vivo)

> Entregável final (Martinez): a Zaeon rodando num **server novo**, com o **harness** agindo nas
> conversas e a **memória** integrada, pra observar o comportamento. Escrito 2026-08 (Fable).
> **Ressalva de contexto:** meu espelho do git é do último sync (11/jul, `16b6f48`); não consigo
> `fetch` daqui. Confirme no GitHub se há commit mais novo antes de executar (passo 0).

---

## 0. STATUS ATUAL (verificado no espelho local — reconfirme no GitHub)

**✅ JÁ EM `main` (via PR #113) — harness E memória são CÓDIGO, não só plano:**
- Motor: `lib/agent/{trajectory,aura-harness,router,runtime,examiner,contracts,errors}.ts` — o laço tipado (route→plan→gather→reason→draft→critique→finalize), inspirado em awesome-harness-engineering + AI-Scientist + LangGraph.
- **Memória L3 (a "att de memória" que você lembrou — foi iniciada e mergeada):** `lib/agent/memory.ts` + `memory-provider.ts` — `MemoryDrawer`, recall **híbrido** (`$vectorSearch`+`$rankFusion`/RRF), `memory_search`, `wakeUp` + `write` no finalize, curadoria verbatim. Commits `1eb47f2`/`34415d8`. Modelo MemPalace, nativo Mongo Atlas.
- Conectores (cliente MCP + `model Connector`) e skills marketplace core.
- Wiring: `runTrajectory` ligado no `/api/ai/chat` atrás da flag `AURA_HARNESS` (default-on; só Aura, streaming, sem arquivo).

**❌ FALTA pra "ver funcionar" no server novo:**
1. **Render** — `StructuredAnswerView` **não está em main** (ficou na branch `aura/base-coworking-harness`). Sem ele a resposta do harness chega espremida em texto. → PR-Render (§1).
2. **Índices Atlas** — a memória só recupera com os índices criados (senão degrada muda). → §4.
3. **O server novo em si** — provisionar + deploy. → §2, §5.

> Passo 0 obrigatório: `git fetch origin && git log --oneline -5 origin/main` — se houver commit além de `16b6f48`, releia o que mudou antes de seguir.

---

## 1. FECHAR A INTEGRAÇÃO (código — 1-2 PRs antes do deploy)

**PR-Render (essencial pra "ver o harness"):** detalhe pronto em `docs/CLAUDE_CODE_SEE_HARNESS.md`.
- Trazer `components/study/StructuredAnswerView.tsx` de `origin/aura/base-coworking-harness` (só esse arquivo; NÃO o `route.ts` dessa branch — regride o motor).
- Rota emite `@@STRUCTURED@@ + JSON.stringify(answer)` no branch de texto quando o `answer` tem campos ricos.
- Cliente (`StudyCoworkChat.tsx`, `ResearchChat.tsx`) detecta a sentinela e renderiza `StructuredAnswerView`.
- **Gate:** pergunta de conceito → núcleo + conceitos (chips) + fontes + próximos-passos; `AURA_HARNESS=0` = texto puro.

**PR-Health-SHA (recomendado — acaba com "o que está no ar?"):** `docs/aura-health-gitsha.patch` → `/api/health` devolve `{commit, harness}`. Injetar `GIT_SHA` no deploy.

**(opcional) PR-Visual/Molécula:** `docs/aura-visual-fix.patch` + `docs/RICH_ARTIFACTS_MOLECULE.md` — molécula 3D. Não bloqueia o server novo; entra depois.

Memória: **não precisa de PR** — o código já está; ela liga com os índices do §4.

---

## 2. PROVISIONAR O SERVER NOVO

- **Specs:** o `docker-compose.beta.yml` foi dimensionado pra **2 vCPU / 8 GB** (web 1.5g + voz 1g + abnt 1.2g + pdf-loader 0.9g + redis + caddy ≈ 5.2g). Um VPS Ubuntu 22/24 com 8 GB serve.
- **Instalar:** Docker + Docker Compose plugin, git. Abrir portas 80/443.
- **Domínio (decisão):** o **Caddy** faz HTTPS automático se você apontar um subdomínio (ex.: `staging.zaeon.space`) pro IP. Pra teste rápido sem domínio, dá pra rodar por IP:porta (sem HTTPS do Caddy) — mas o OAuth do Google exige URL estável, então **recomendo um subdomínio** (ex.: `teste.zaeon.space`).

---

## 3. CONFIGURAR O `.env` (base, no server novo)

Copiar de `.env.example` e preencher. **Essenciais pro harness+memória:**
- `DATABASE_URL` / `MONGODB_URI` — Mongo Atlas (ver §4 — DB de teste ou prod).
- `NEXTAUTH_URL` = a URL do server novo (ex.: `https://teste.zaeon.space`) · `NEXTAUTH_SECRET` (novo: `openssl rand -base64 32`).
- `GOOGLE_CREDENTIALS` + `GOOGLE_PROJECT_ID` + `GOOGLE_LOCATION` — **a IA inteira (Gemini/Vertex) e os embeddings da memória (`gemini-embedding-001`) usam isto.** Segredo multiline → base64 (padrão do `PLANO_SKILLS_PRS.md §0`).
- `GEMINI_MODEL` / `GEMINI_MODEL_FLASH` / `GEMINI_MODEL_PRO`.
- `AURA_HARNESS=1` (ou omitir — default é on). **É o que liga o harness.**
- `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` — login OAuth (registrar a nova `NEXTAUTH_URL` no console Google como redirect).
- Redis: o compose sobe um `redis` interno (`REDIS_URL=redis://redis:6379/0`) — Upstash é opcional.

**Opcionais (não bloqueiam o teste do harness):** GitHub App (sala Projetos), YouTube, Semantic Scholar/Unpaywall, Pusher (colab), voz avançada. Deixar vazio degrada só essas features.

---

## 4. BANCO & MEMÓRIA (Atlas) — decisão + índices

**Decisão (isolamento):** pra "conferir como funciona" sem sujar prod, recomendo **um DB novo** — ou um cluster Atlas separado, ou o mesmo cluster com **outro nome de database** no `DATABASE_URL` (ex.: `.../zaeon_staging`). Assim os `memory_drawers` do teste não misturam com os reais.

Passos:
1. `npx prisma db push` (com o `DATABASE_URL` do server novo) → cria coleções incl. `memory_drawers`, `connectors`.
2. Criar os índices Atlas (UI → Atlas Search, ou mongosh) — comandos prontos em `docs/ACTIVATE_HARNESS_NOW.md`:
   - `memory_drawers_vec` (vectorSearch, `embedding`, **1536**, cosine, filter `userId`).
   - `memory_drawers_text` (search, campos `text`/`room`/`wingLabel`).
3. Conferir: `db.memory_drawers.getSearchIndexes()` → ambos `queryable:true`; `db.version()` (≥8.1 = `$rankFusion` nativo; senão RRF app-side — funciona).

Sem os índices: o harness roda e conversa, mas a **memória fica muda** (degrada em silêncio, sem quebrar).

---

## 5. SUBIR A STACK

```bash
ssh <server-novo>
git clone https://github.com/web3-engineer/zaeon-os && cd zaeon-os
# .env base (do §3) + .env.secrets (segredos multiline via base64) — NUNCA commitados
nano .env
export COMPOSE_FILE=docker-compose.beta.yml
docker compose -f docker-compose.beta.yml up -d --build
docker compose -f docker-compose.beta.yml logs -f web caddy
```
- Caddy pega HTTPS do domínio automaticamente. `web` tem healthcheck em `/api/health`.
- (Se quiser CI/CD como o beta: replicar o `deploy.yml` apontando os secrets/HOST pro server novo.)

---

## 6. LIGAR E VER O HARNESS AGIR (o momento "conferir")

1. `curl https://teste.zaeon.space/api/health` → `200`, e (com PR-Health) `{"commit":..., "harness":"on"}`.
2. Login → **Sala de Estudos** → conversa de conceito ("me explica fotossíntese") → resposta **estruturada** (núcleo/conceitos/fontes/próximos-passos) = harness visível (após PR-Render).
3. Pedir artefato ("gera um mapa mental disso") → cartão do Studio via sentinela.
4. **Testar memória:** dizer algo memorável num turno; em outro, referenciar ("o que eu te falei sobre X?") → recall traz de volta (índices do §4 ativos).
5. Kill-switch: `AURA_HARNESS=0` + `--force-recreate web` → volta ao chat legado em segundos.

---

## 7. DoD (entregável pronto)
- [ ] Passo 0: main confirmado no GitHub (sem surpresa de commit novo).
- [ ] PR-Render mergeado (harness visível). PR-Health opcional.
- [ ] Server novo no ar: `/api/health` 200 + HTTPS.
- [ ] `.env` com Google/Vertex + `AURA_HARNESS` on + `NEXTAUTH_URL` do domínio.
- [ ] `prisma db push` + 2 índices Atlas `queryable:true`.
- [ ] Smoke §6 (1–5) passa: resposta estruturada + artefato + recall de memória + kill-switch.

## Divisão de trabalho (honesta)
Fable (eu, sandbox): escrevo planos/patches/specs verificados — não tenho push/SSH/provisionamento aqui.
Claude Code (repo+SSH): roda o PR-Render e o deploy no server novo, parando pra teu OK nos passos irreversíveis.
Você: provisiona o VPS, o domínio, os segredos (Google/Atlas/OAuth) e cria os índices Atlas.
```
Ordem: Passo 0 → PR-Render (§1) → provisionar (§2) → .env (§3) → Atlas (§4) → subir (§5) → conferir (§6).
```
