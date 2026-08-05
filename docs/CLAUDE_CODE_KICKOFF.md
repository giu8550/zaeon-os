# KICKOFF — cole isto num agente Claude Code (com acesso ao repo zaeon-os)

Você é o executor local. O harness da Aura já está em `main` (núcleo dos 4 pilares, PR #113); falta
ATIVAR em prod e COMPLETAR os pilares. NÃO re-derive contratos — importe de `lib/agent/*.ts`. Pare
em cada gate e me reporte 1 linha. 1 PR por item. Verifique com `ts.transpileModule` + `npx vitest run`
(sem `next build`; sem `python` no mac). Peça minha confirmação antes de QUALQUER ação irreversível de
prod (push que dispara deploy, SSH que recria container, criação de índice Atlas, flip de flag).

## FASE 1 — ATIVAR (siga `docs/ACTIVATE_HARNESS_NOW.md` à risca)
1. `git checkout -b aura/activate origin/main`; `git apply docs/aura-visual-fix.patch` e
   `git apply docs/aura-health-gitsha.patch`; `npx vitest run lib/agent/__tests__/router.test.ts`;
   commit. **Gate:** testes verdes + transpila. → me mostra o diff e **peça ok pra push**.
2. Edite `.github/workflows/deploy.yml`: após `git reset --hard origin/main`, injete
   `echo "GIT_SHA=$(git rev-parse --short HEAD)" >> .env.secrets`. Commit no mesmo PR.
3. **[confirmação]** push → PR → merge. Monitore o deploy (`gh run watch`). **Gate:**
   `curl -s https://beta.zaeon.space/api/health` → `{"commit":"<sha>","harness":...}` com o sha novo.
4. **[credencial: string do Atlas]** rode `prisma db push` (via container) e crie os 2 índices
   (`memory_drawers_vec` vetorial + `memory_drawers_text`) — comandos prontos no doc. **Gate:**
   `getSearchIndexes()` queryable=true.
5. **[confirmação]** garanta `AURA_HARNESS` on no `.env` do VPS + `--force-recreate web`. Rode o smoke
   (texto / "gera a imagem da molécula de serotonina" / recall de memória / kill-switch). **Gate:**
   `/api/health` → `harness:"on"` e os 4 smokes passam. → **FIM DA FASE 1 = harness VIVO.**

## FASE 2 — COMPLETAR OS PILARES (siga `docs/MASTER_HARNESS_ACTIVATION.md`, PRs A→K, em ordem)
Cada PR: branch `aura/…`, ≤6 arquivos, gate binário, 1 linha de CHANGELOG citando §8/§11 do
`AURA_AGENTIC_LAYER_PLAN.md`. Ordem por dependência: PR-A render → PR-B cobertura → PR-C execMode →
PR-D trace/world-state → PR-E curadoria memória → PR-F/G conectores (model + UI Opções + Testar
conexão) → PR-H/I skills (rename + marketplace) → PR-J microserviço python → PR-K persona por curso.
Não mergeie com gate vermelho. Me peça ok antes de cada merge em main.

## Se algo estiver diferente do descrito (drift), PARE e me diga — não improvise mudança estrutural.
Fontes-da-verdade: `MASTER_HARNESS_ACTIVATION.md` (o quê/ordem), `ACTIVATE_HARNESS_NOW.md` (comandos),
`EXECUTOR_PROMPT_AURA_E2E.md` + `HANDOFF_EXECUTOR.md` (detalhe dos contratos), `AURA_AGENTIC_LAYER_PLAN.md`
(§8 contratos, §9.11 admin, §11 spec, §13 runbook).
