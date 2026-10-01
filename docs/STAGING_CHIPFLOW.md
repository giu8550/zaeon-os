# STAGING — VPS própria (testar antes da prod)

> Ambiente de teste dedicado pra validar o harness + as 3 PRs ANTES de tocar a prod.
> **Host:** `75.119.140.97` — **VPS NOSSA, dedicada** (não é da ChipFlow) · **24 GB RAM · 300 GB disco**
> (folga enorme — a stack pede ~8 GB). (nome do arquivo é cosmético; a VPS é a nossa própria.)
> Cabe: Zaeon completa + sandbox de código + experimentos. Escrito 2026 (Fable).
> Regra: staging usa **DB Atlas separado** (`zaeon_staging`) — nunca o de prod.

## Prontidão (o que falta você/o executor prover — ⛔)
- [ ] **Subdomínio** → `75.119.140.97` (ex.: `staging.zaeon.space`). Caddy pega HTTPS sozinho.
- [ ] **SSH + Docker** na box (Docker + compose plugin; portas 80/443 abertas).
- [ ] **`.env` de staging** (segredos — só você tem): `GOOGLE_CREDENTIALS`+`GOOGLE_PROJECT_ID` (Vertex/IA), `GEMINI_MODEL*`, `NEXTAUTH_URL`=a URL de staging, `NEXTAUTH_SECRET`=`openssl rand -base64 32`, `DATABASE_URL`/`MONGODB_URI`=cluster Atlas apontando p/ `zaeon_staging`, `AURA_HARNESS=1`.
- [ ] **OAuth Google:** registrar o redirect da URL de staging no console.
- [ ] **Executor:** o agente Claude Code (repo+SSH) roda os passos. (Fable escreve/verifica; não tem SSH aqui.)

## Ordem — os planos, um por um

**PLANO 0 · Provisionar staging** (na ChipFlow)
`ssh root@75.119.140.97` → instalar Docker + compose → apontar o subdomínio → `git clone` do repo → `.env` (acima). **Gate:** `docker --version` ok, subdomínio resolve pro IP.

**PLANO 1 · Subir a Zaeon (baseline)** — `docker compose -f docker-compose.beta.yml up -d --build`.
**Gate:** `curl https://staging.zaeon.space/api/health` → 200. (Harness já está em main, mas **invisível** — resposta chega em texto; o PLANO 2 conserta.)

**PLANO 2 · As 3 PRs (aqui é o teste que importa)** — aplicar numa branch, testar em staging, só depois prod:
1. **PR-render** (`CLAUDE_CODE_SEE_HARNESS.md`): traz `StructuredAnswerView` + `@@STRUCTURED@@` → **harness VISÍVEL**.
2. **PR-visual/molécula** (`aura-visual-fix.patch`): "gera a molécula/imagem" → artefato.
3. **PR-health-SHA** (`aura-health-gitsha.patch`): `/api/health` mostra commit+harness.
**Gate:** em staging, Sala de Estudos responde estruturado (núcleo/conceitos/fontes) + gera artefato; `/api/health` mostra o SHA. `AURA_HARNESS=0` volta ao legado.

**PLANO 3 · Memória (Atlas staging)** — `prisma db push` no DB `zaeon_staging` + criar índices `memory_drawers_vec` e `memory_drawers_text` (comandos em `ACTIVATE_HARNESS_NOW.md`).
**Gate:** recall de um turno anterior funciona; `getSearchIndexes()` `queryable:true`.

**PLANO 4 · Validar → PROD** — com os gates de PLANO 2+3 verdes em staging, replicar as 3 PRs (merge em main) + índices no Atlas de prod + deploy prod. Kill-switch: `AURA_HARNESS=0`.

## Depois (mesma VPS, tem RAM de sobra)
- **Sandbox de código** (dsh seams / Zaeon Code / experiment-suite) — a box de 24 GB aguenta worker de sandbox no mesmo host.
- **Refinamentos do harness** (log-as-context + hooks do deepseek-harness) — código puro, sem infra.
- **Camada agêntica (Tutores)** + **camada mestra** — `AGENTIC_LAYER.md`.

## Sizing confirmado
Stack ~5.2 GB / 8 GB de pico → em 24 GB sobra ~18 GB p/ sandbox + picos. Disco 300 GB >> ~40 GB necessário. **Folga confortável pra tudo.**
