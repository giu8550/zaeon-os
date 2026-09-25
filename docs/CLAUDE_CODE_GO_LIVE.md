# GO-LIVE — cole num agente Claude Code (repo zaeon-os, com git+SSH+credenciais)

Você é o executor com as mãos no repo. Objetivo: **harness VIVO em prod** e a **feature de molécula 3D
implementada e deployada**. Trabalhe a partir de `origin/main`. NÃO re-derive contratos (importe de
`lib/agent/*.ts`). Verifique com `ts.transpileModule` + `npx vitest run` (sem `next build`; mac sem `python`).
**Pare e peça meu OK antes de QUALQUER ação irreversível de prod** (push que dispara deploy, SSH que
recria container, `prisma db push`, criar índice Atlas, ligar flag). Reporte 1 linha por gate.

Fontes-da-verdade (leia só o necessário de cada, quando chegar na fase):
`ACTIVATE_HARNESS_NOW.md` (comandos de ativação) · `MASTER_HARNESS_ACTIVATION.md` (o quê/ordem geral) ·
`RICH_ARTIFACTS_MOLECULE.md` (a feature molécula, prompt no fim) · `HANDOFF_EXECUTOR.md` Apêndice C (âncoras).

## FASE 0 — Sync (sem regressão)
- `git fetch origin`. Traga os planos/patches SEM mergear código divergente: eles estão na branch
  `origin/aura/base-coworking-harness` (commits `7a495fd` e `16b25a4`). Pegue **só docs/patches**:
  `git checkout origin/aura/base-coworking-harness -- docs/ACTIVATE_HARNESS_NOW.md docs/MASTER_HARNESS_ACTIVATION.md docs/RICH_ARTIFACTS_MOLECULE.md docs/aura-visual-fix.patch docs/aura-health-gitsha.patch`.
- **NÃO** traga `app/api/ai/chat/route.ts` dessa branch (é a versão pré-harness → regride). **NÃO** commite
  `*.b64` na raiz (`whois.b64`/`dig168.b64`/etc. — lixo de diagnóstico, ignore/`git clean` só se seu).
- **Gate 0:** working tree limpo exceto os docs trazidos; `git status` sem `route.ts` nem `.b64` staged.

## FASE 1 — ATIVAR O HARNESS (segue `ACTIVATE_HARNESS_NOW.md` à risca)
1. `git checkout -b aura/activate origin/main`; `git apply docs/aura-visual-fix.patch` (router+aura-harness:
   visual/molécula→image + trava anti-refusal) e `git apply docs/aura-health-gitsha.patch` (health expõe
   commit+harness). `npx vitest run lib/agent/__tests__/router.test.ts`. Commit.
2. `deploy.yml`: após `git reset --hard origin/main`, injetar `echo "GIT_SHA=$(git rev-parse --short HEAD)" >> .env.secrets`. Mesmo PR.
3. **[confirmação]** push → PR → merge em main → `gh run watch` o deploy. **Gate 1a:** `curl -s https://beta.zaeon.space/api/health` → `{"commit":"<sha novo>", "harness":...}`.
4. **[credencial Atlas]** `prisma db push` (via container) + criar `memory_drawers_vec` (vetorial 1536/cosine/filter userId) e `memory_drawers_text` — comandos prontos no doc. **Gate 1b:** `getSearchIndexes()` queryable=true.
5. **[confirmação]** `AURA_HARNESS` on no `.env` do VPS + `--force-recreate web`. Smoke: texto / "gera a imagem da molécula de serotonina" / recall de memória / kill-switch `=0`. **Gate 1c:** `/api/health` → `harness:"on"` e 4 smokes passam. → **HARNESS VIVO.**

## FASE 2 — MOLÉCULA 3D (implementa a feature; prompt detalhado no fim de `RICH_ARTIFACTS_MOLECULE.md`)
`git checkout -b aura/molecule-3d origin/main` (após a Fase 1 mergear). 1 PR, 6 arquivos, aditivo:
1. `lib/studio/types.ts`: `"molecule"` em `StudioKind`/`STUDIO_KINDS` (NÃO binary).
2. `app/api/studio/molecule/route.ts`: `POST {topic}` → resolve PubChem `compound/name/{topic}/SDF?record_type=3d` (fallback `/cids/JSON`→`/cid/{cid}/SDF`), cache Redis, `StudioArtifact{kind:"molecule",status:"done",meta:{name,cid,sdf,format:"sdf"}}`; erro→`status:"error"`. **Proxy server-side obrigatório** (PubChem bloqueia CORS do browser).
3. `components/studio/StudioArtifactViews.tsx`: `MoleculeView({meta})` — 3Dmol.js via `next/script` (`https://cdn.jsdelivr.net/npm/3dmol@2.5.5/build/3Dmol-min.js`, client-only) → `addModel(meta.sdf,"sdf")`/`setStyle({},{stick:{},sphere:{scale:0.3}})`/`zoomTo()`/`spin(true)`; skeleton no load; ⟁+liquid glass. `StudioBlock` despacha `kind==="molecule"`.
4. `lib/agent/tools.ts`: `"molecule"` no StudioKind do harness + aliases; descrição da `studioGenerateTool`: p/ kind molecule, `topic`=nome EN do composto (café→caffeine).
5. `lib/agent/aura-harness.ts`: `pickStudioKind` `molecula|estrutura|composto|fórmula → "molecule"`.
6. (opcional) 1 linha no sys do `draft`: temas de química/bioquímica auto-geram a molécula relevante.
- **[confirmação]** push → PR → merge → deploy. **Gate 2:** `POST /api/studio/molecule {topic:"caffeine"}` devolve SDF; na Sala de Estudos "gera a molécula de cafeína" (e "me explica o café") → card 3D girando + texto; composto inválido → erro suave; transpila. Licenças no CHANGELOG (3Dmol.js BSD-3, PubChem público).

## Se algo divergir do descrito (drift), PARE e me diga — não improvise mudança estrutural.
Ordem de segurança sempre: kill-switch `AURA_HARNESS=0` + `--force-recreate web` reverte o harness em segundos sem redeploy.
