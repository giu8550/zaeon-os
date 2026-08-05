# PLANO-MESTRE — Ativar o Harness em Produção + Completar os 4 Pilares

> **Documento único de convergência (2026-07-29, Fable).** Reúne o que estava espalhado em
> `EXECUTOR_PROMPT_AURA_E2E.md`, `HANDOFF_EXECUTOR.md`, `RUNBOOK_HARNESS_SHIP.md`, `MEMORY_AND_PERSISTENCE.md`,
> `PLANO_SKILLS_PRS.md` e o `AURA_AGENTIC_LAYER_PLAN.md §13`. Objetivo: zero ambiguidade sobre "onde paramos"
> e uma trilha executável até o harness VIVO em prod e os 4 pilares completos.
> **Regra:** o executor NÃO re-deriva contratos (importa de `lib/agent/*.ts`); pára em cada gate; 1 PR por item.

## ESTADO REAL (main, verificado 2026-07-29)

**✅ JÁ EM MAIN (núcleo dos 4 pilares — mergeado via PR #113):**
`lib/agent/{contracts,router,runtime,trajectory,examiner,errors,memory,mcp,aura-harness,transcript,tools,context,actions}.ts`.
Motor `runTrajectory` fiado no `/api/ai/chat` atrás de `AURA_HARNESS` (default-on; condição: `stream && agentKey==="aura" && !fileData`). Memória L3 (`MemoryDrawer`, `$vectorSearch`+`$rankFusion`), cliente MCP (`mcp.ts`), examiner ScholarEval. Contratos/erros/provenance encarnados.

**❌ FALTA (o que estagnou):**
| # | Falta | Onde | Bloqueia |
|---|---|---|---|
| G1 | Patch visual (`aura-visual-fix.patch`) não aplicado | router.ts + aura-harness.ts | "gera a molécula" ainda recusa |
| G2 | Índice **Atlas Vector** `memory_drawers_vec` não criado | infra Atlas | memória muda (degrada silenciosa) |
| G3 | Deploy do main no VPS não confirmado + flag | infra VPS | harness pode nem estar rodando |
| G4 | Render `StructuredAnswerView` não plugado no cliente | components/study | resposta rica vira texto plano |
| G5 | Cobertura estreita (só aura/stream/!fileData) | route.ts | outros agentes/caminhos fora do laço |
| G6 | `execMode`/`approvalGate` (modo Guiado) não liga no motor | trajectory + PR07 | HITL não funciona |
| G7 | PR-M2 (world-state alimentado) + PR06 (trace real ⟁) | context/actions | UX do laço invisível |
| G8 | Conectores: catálogo + **UI admin Opções (Conectores/MCP)** + Testar conexão | novo | pilar conectores não usável |
| G9 | Skills: rename Plugin→Skill + **UI Opções/marketplace** | schema + app | pilar skills não visível ("menu") |
| G10 | Microserviço Python (`paper-lookup`/`scholar-evaluation`) | novo serviço | skills python (F2) inertes |
| G11 | Persona por curso no systemContext | aura-harness | qualidade por domínio |

---

## PARTE 1 — ATIVAR (próximas horas) · deixa o harness VIVO e correto

> Meta: o laço rodando em prod, respondendo certo (inclusive visual) e com memória funcional.
> Mistura 1 PR pequeno de código + passos de infra que **só o dono/CI faz** (marcados 🔒).

**P1.1 · Aplicar o patch visual (G1)** — `git checkout -b aura/visual-fix origin/main && git apply docs/aura-visual-fix.patch`. Roda `npx vitest run lib/agent/__tests__/router.test.ts`. Commit + PR + merge.
- **Gate:** router classifica "gera a molécula de X" → `gerar_artefato`; `pickStudioKind` → `image`; transpila.

**P1.2 · 🔒 Confirmar deploy do main no VPS** — `ssh <vps> 'cd <DEPLOY_PATH> && git rev-parse HEAD'` bate com o HEAD de `origin/main` (após P1.1). Se não, `deploy.yml` roda no push; ou deploy manual (`docker compose -f docker-compose.beta.yml up -d --build web`).
- **Gate:** `curl https://beta.zaeon.space/api/health` 200 **e** SHA do VPS == origin/main.

**P1.3 · 🔒 Criar índice Atlas Vector (G2)** — no Atlas (UI ou `atlas`/`mongosh`): índice **vectorSearch** `memory_drawers_vec` na coleção `memory_drawers`, campo `embedding`, **1536 dims, similaridade cosine, filter `userId`**. Se o recall usa `$search`/`$rankFusion`, criar também o índice de texto sobre `memory_drawers.text`. Rodar `npx prisma db push` antes se as coleções não existirem.
- **Gate:** um `$vectorSearch` de teste não dá "index not found"; `memory_search` volta drawer por escopo.

**P1.4 · 🔒 Flag + smoke** — garantir `AURA_HARNESS` != "0" no `.env` do VPS; `--force-recreate web`. Smoke logado na Sala de Estudos: (a) 1 texto responde; (b) "gera a imagem da molécula de serotonina" → sentinela do Studio; (c) pergunta que puxe memória → sem erro; (d) `AURA_HARNESS=0` por 30s → volta ao legado (kill-switch ok).
- **Gate:** os 4 passam; logs do `web` sem stack não tratado.

**➡ Fim da Parte 1 = harness VIVO e correto em prod.** O resto (Parte 2) é aditivo, sala por sala, sem downtime.

---

## PARTE 2 — COMPLETAR OS 4 PILARES (sequência de PRs, cada um atrás do default-on)

> Ordem por dependência. Cada PR: branch `aura/…`, ≤6 arquivos, `transpileModule`+`vitest`, gate binário, 1 linha de CHANGELOG citando §8/§11. Nada mergeia com gate vermelho.

### Pilar HARNESS (fechar a experiência)
- **PR-A · Render estruturado (G4)** — cliente usa `StructuredAnswerView` p/ resposta e `studio-pending`→`StudioBlock` p/ artefato (replicar na Sala de Pesquisa). *Gate:* núcleo/conceitos/fontes/próximos-passos aparecem quando o `draft` os preenche.
- **PR-B · Cobertura total (G5)** — grep por chamadas de IA em chat; fazer não-stream, `fileData`, e Projetos (`surface:"projetos"`) passarem pelo `runTrajectory`. Execução de código = tool/handoff dentro do laço. *Gate:* nenhum chat de IA fora do motor.
- **PR-C · execMode/HITL (G6)** — `permit()` lê `ctx.execMode`; `approvalGate(phase,st)` após plan / antes de tool write-cara / antes de finalize; renderiza `ApprovalCard`. *Gate:* Guiado pausa e retoma; Auto corre.
- **PR-D · Trace + world-state (G7)** — `AuraThinking` lê `AgentStep` reais (PR06); salas chamam `setAgentContext`/`pushAgentAction` (PR-M2). *Gate:* UI mostra fase corrente; wakeUp injeta recall no contexto.

### Pilar MEMÓRIA (afinar — núcleo já vivo pós-Parte 1)
- **PR-E · Curadoria + perfil pinado** — no `finalize`, nudge ADD/SUPERSEDE/NOOP (verbatim-safe, §10.5 #2); `invalidatedAt`/`supersededBy`; wakeUp injeta 1 doc "perfil" reconstruído em background. *Gate:* supersede não deleta; recall filtra `invalidatedAt:null`.

### Pilar CONECTORES (G8)
- **PR-F · `model Connector` + catálogo seed** — campos §9.11 (transport/endpoint/authRef/status/lastCheckedAt/discoveredTools). Catálogo: paper-search-mcp, biomcp, openalex-research-mcp (TS/npx = 1º smoke local), fetch/filesystem/git. `db push`. *Gate:* seed lista; `authRef` só referência (segredo no cofre).
- **PR-G · Admin Opções: Conectores + MCP** — 2 telas aditivas em Opções: adicionar → handshake (`initialize`+`tools/list`) → registrar como `ToolDef runtime:"mcp"` via `permit()` → **Testar conexão** (round-trip real → chip verde/vermelho via `messageForError`). Estados: desconectado/verificando/conectado/precisa_autorizar/erro. *Gate:* conectar openalex-research-mcp via npx → tools reais no handshake → Testar acende verde; derrubar → vermelho.

### Pilar SKILLS (G9, G10)
- **PR-H · Rename Plugin→Skill** — `model Skill @@map("Plugin")` (sem migração), `/api/skills` (+shim `/api/plugins`), `skills-store` + redirect de `plugin-store`, navbar/admin/i18n (mapa em `PLANO_SKILLS_PRS.md` PR#2). *Gate:* `grep -ri plugin` só sobra `@@map` + shim; store carrega.
- **PR-I · Skill model spec + marketplace** — campos agentskills.io (§10.5 #13): name(regex)/description/license/compatibility/metadata(version)/allowedTools + envelope (runtime/risk/minPlan/tier/courseTags/defaultOn/autoAuthored); validação lenient/strict na instalação; progressive disclosure (só name+desc no prompt; `activate_skill(enum)`); tela Opções→Skills (liga/desliga por agente). *Gate:* instala 1 skill K-Dense → valida → aparece no runtime respeitando minPlan.
- **PR-J · Microserviço Python (G10)** — molde `voice-engine`/`abnt-service`: `paper-lookup`/`scholar-evaluation`/`statistical-analysis` como `ToolDef runtime:"python"` (HTTP, contrato `ToolResult`, minPlan §9.10). *Gate (CI/VPS, não no mac):* endpoint responde `ToolResult`; cliente TS transpila.

### Pilar PERSONA (barato, alta alavanca)
- **PR-K · Persona por curso (G11)** — injeta perfil `AGENTS.md`-style (§9.6, roster §9.7) no systemContext do `draft`, resolvido por curso/`academicLevel`. *Gate:* Aura assume a voz do curso; sem curso → geral.

---

## PARTE 3 — Checklist de ativação (🔒 = só o dono/CI; o resto o executor faz)

1. [ ] PR-visual aplicado e mergeado (P1.1)
2. [ ] 🔒 Deploy do main confirmado no VPS (P1.2)
3. [ ] 🔒 Índice Atlas `memory_drawers_vec` Active + `prisma db push` (P1.3)
4. [ ] 🔒 `AURA_HARNESS` on + smoke dos 4 casos + kill-switch (P1.4)
5. [ ] PRs A→K mergeados em ordem, cada um com gate verde (Parte 2)
6. [ ] Adicionar `GIT_SHA` ao `/api/health` (mata a dessincronia "o que está em prod?")

## O que Fable (não-interativo) NÃO faz e por quê
Sem `git push`/SSH/CI/Atlas nesta sessão: os passos 🔒 e o deploy são humanos/infra. Fable entrega os specs, os patches verificados e os gates; o executor (Claude Code, com acesso ao repo) roda os PRs; o dono roda os 🔒.
