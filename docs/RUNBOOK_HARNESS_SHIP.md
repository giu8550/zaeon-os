# RUNBOOK — Levar o Harness da Aura a PRODUÇÃO (executor: Claude Code)

> **Você é o executor.** Objetivo único: pegar o harness que já foi CONSTRUÍDO (branch do executor,
> 14 commits) + a base (L1/Fase 0/persona) e **colocar no ar no VPS**, sem quebrar prod. Isto NÃO é
> pra escrever features novas — é reconciliar branches, verificar, mergear, deployar e ligar a infra.
> Ordem estrita, gate binário em cada fase. **Pare e reporte 1 linha por gate.** Se um gate ficar
> vermelho 2x, PARE e chame o Martinez. Escrito 2026-07-11 por Fable. Fonte de estado: `zaeon-harness-gap-prod`.

## 0. Fatos de partida (verifique antes de tocar em nada)

- **Prod = `origin/main`** (VPS, deploy por `git reset --hard origin/main`). Hoje é **pré-harness** (só `lib/agent/{actions,context}.ts`).
- **3 fontes a reconciliar:**
  1. `origin/main` — base de prod.
  2. `aura/base-coworking-harness` — L1 transcript + Fase 0 (`tools.ts`) + **fix de persona anti-refusal molécula** + docs (`EXECUTOR_PROMPT_AURA_E2E.md`, plano §10.5). **Tem mudanças NÃO COMMITADAS no working tree** (persona no `route.ts`, docs). Comite-as primeiro (Fase A0).
  3. `claude/aura-executor-setup-a97d4f` — **o harness completo** (motor wired atrás de `AURA_HARNESS`, memória L3 `MemoryDrawer`, cliente MCP + `model Connector`, skills core). NÃO contém main nem a base.
- **Arquivos com conflito quase certo:** `app/api/ai/chat/route.ts` e `prisma/schema.prisma` (as 3 fontes tocam os dois). Resolva a favor da branch do executor + preserve o fix de persona da base.
- **`deploy.yml` NÃO roda `prisma db push` nem cria índice Atlas** — isso é manual (Fase D).
- **Constraints conhecidas:** o mac do Martinez não tem `python` (irrelevante aqui, só afeta o microserviço de skills — fora deste ship); `git fetch` pode travar na rede de casa (proxy ISP) → se travar, use tethering/outra rede pra push. `.git/index.lock` preso = rode `rm -f .git/index.lock` antes de operar git.
- **Decisão de segurança deste ship:** a flag `AURA_HARNESS` é default-on no código, mas **deploye com `AURA_HARNESS="0"` (dark launch)** primeiro → confirme prod idêntica ao legado → só então ligue (Fase E). Não invente: `AURA_HARNESS="0"` já cai no fluxo legado por design.

## FASE A — Reconciliar numa branch de integração (local, sem rede)

**A0.** Na `aura/base-coworking-harness`, comite o working tree pendente:
`git add -A && git commit -m "chore(aura): persona anti-refusal molécula + docs (research/runbook/§10.5)"`.
**Gate A0:** `git status` limpo.

**A1.** Crie a branch de integração a partir da MAIS COMPLETA (executor):
`git checkout -b aura/ship-harness claude/aura-executor-setup-a97d4f`.

**A2.** Traga a base (persona fix + qualquer coisa da base que o executor não tenha):
`git merge --no-ff aura/base-coworking-harness`. Resolva conflitos em `route.ts`/`schema.prisma`:
- `route.ts`: manter o wiring do harness (executor) **E** o bloco de persona `NUNCA NEGUE CAPACIDADE` (base). São regiões diferentes; ambos ficam.
- `schema.prisma`: manter `model MemoryDrawer` + `model Connector` (executor) e o resto da base; `model Plugin` segue como está (rename é outro ship).
**Gate A2:** merge sem marcadores `<<<<` remanescentes (`git grep -n '^<<<<<<<'` vazio).

**A3.** Traga o main de prod pra pegar qualquer hotfix recente (ex.: a credencial do §0):
`git merge --no-ff origin/main`. Resolva a favor do que for runtime de prod que o harness não regrida.
**Gate A3:** sem marcadores de conflito; `git log --oneline -5` mostra os 3 merges.

## FASE B — Verificar SEM build (o ambiente não builda Next; mac sem python)

**B1. Transpile** de todo `.ts/.tsx` tocado (Apêndice A do `HANDOFF_EXECUTOR.md`):
```bash
git diff --name-only origin/main...HEAD | grep -E '\.tsx?$' | xargs node -e '
const ts=require("typescript"),fs=require("fs");
let bad=0;
for(const f of process.argv.slice(1)){if(!fs.existsSync(f))continue;
 const o=ts.transpileModule(fs.readFileSync(f,"utf8"),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}});
 const e=o.diagnostics.filter(d=>d.category===1);
 if(e.length){bad++;console.log("ERR "+f+" :: "+e.map(x=>ts.flattenDiagnosticMessageText(x.messageText,"\n")).join("; "));}}
process.exit(bad?1:0);'
```
**Gate B1:** exit 0 (zero erros de sintaxe). Corrija drift dos merges aqui.

**B2. Vitest** na lógica pura: `npx vitest run` (router, permit, stop-conditions, examiner `checkSemFonte`, memory recall).
**Gate B2:** verde. Se o rollup nativo faltar no ambiente, rode no mac do Martinez.

**B3. Não-regressão (grep de cobertura):** confirme que o branch harness responde no MESMO formato dos chats (texto/sentinelas) e que `AURA_HARNESS="0"` cai no legado. Confirme que o wiring cobre **só `agentKey==="aura"` + stream + `!fileData`** — os demais agentes/caminhos seguem legado intactos (isto é ESPERADO neste ship; cobertura ampla é follow-up).
**Gate B3:** nenhuma rota de chat existente muda de formato de saída com a flag off.

## FASE C — Merge em main + deploy (dark launch)

**C1.** Garanta `AURA_HARNESS="0"` no VPS ANTES de subir código novo (dark launch):
```bash
ssh <vps> 'cd <DEPLOY_PATH> && grep -q "^AURA_HARNESS=" .env && sed -i "s/^AURA_HARNESS=.*/AURA_HARNESS=0/" .env || echo "AURA_HARNESS=0" >> .env'
```
**C2.** Merge e push (dispara o `deploy.yml`):
`git checkout main && git merge --no-ff aura/ship-harness && git push origin main`.
Se `git push` travar na rede de casa → trocar de rede (tethering) e repetir. NÃO force-push.
**Gate C2:** GitHub Actions verde; `curl -s https://beta.zaeon.space/api/health` → `200 {"status":"ok"}`.
**C3.** Smoke do LEGADO (flag ainda 0): abrir chat em cada sala → responde igual a antes; gerar 1 artefato; **nada** de harness ainda.
**Gate C3:** prod idêntica ao comportamento pré-merge. Se regrediu → `AURA_HARNESS` já é 0, então o problema é o merge: investigue B1/B3.

## FASE D — Infra da memória (obrigatória ANTES de ligar a flag)

**D1. `prisma db push`** no VPS (cria coleções `memory_drawers`/`connectors`, sem migração):
```bash
ssh <vps> 'cd <DEPLOY_PATH> && docker compose -f docker-compose.beta.yml exec -T web npx prisma db push'
```
(se o container não tiver o CLI, rode `npx prisma db push` com o `DATABASE_URL` de prod a partir de um shell com acesso ao Atlas.)
**Gate D1:** coleções existem no Atlas.

**D2. Índice Atlas Vector Search** (na UI do Atlas ou via `atlas` CLI) sobre `memory_drawers`:
- nome `memory_drawers_vec`; tipo **vectorSearch**; campo `embedding`; **dims = 1536** (bate com `gemini-embedding-001`, `EMBED_DIM` em `lib/agent/memory.ts`); similaridade **cosine**; adicionar **filter** em `userId`.
- se o recall híbrido usa `$search`/`$text`, criar também o índice de texto sobre `memory_drawers.text`.
**Gate D2:** índice `Active` no Atlas; um `$vectorSearch` de teste não dá erro de "index not found".

## FASE E — Ligar a flag + smoke do HARNESS

**E1.** `AURA_HARNESS=1` (ou remover a linha, já que default é on) no `.env` do VPS e recriar só o web:
```bash
ssh <vps> 'cd <DEPLOY_PATH> && sed -i "s/^AURA_HARNESS=.*/AURA_HARNESS=1/" .env && docker compose -f docker-compose.beta.yml up -d --force-recreate web'
```
**E2. Smoke do harness** (logado, na Sala de Estudos — surface que o wiring cobre):
1. 1 turno de texto → responde (streaming ok, sem 500).
2. "gera a imagem da molécula de serotonina" → dispara a sentinela do Studio (persona fix + tool-loop).
3. 1 pedido que puxe memória → sem erro; derruba o Atlas mentalmente: se cair, o chat degrada **silencioso** (`memory_unavailable`), não polui.
4. `AURA_HARNESS=0` de volta por 30s → confirma que o kill-switch devolve o legado na hora.
**Gate E2:** os 4 passam. Logs do `web` sem stack trace não tratado.

## FASE F — Rollback (se qualquer gate de E falhar em prod)

Kill-switch primeiro, sempre: `AURA_HARNESS=0` + `--force-recreate web` → prod volta ao legado em segundos (sem redeploy). Se o problema for o próprio merge (não a flag), `git revert` do merge de C2 + push. Memória: coleções/índice ficam (inertes sem a flag), não precisam rollback.

## FORA DE ESCOPO DESTE SHIP (follow-ups, não faça agora)

Cobertura ampla (não-stream, fileData, agentes Scholar/Examiner/Zaeon/Zenita/Zion, surface Projetos) · render `StructuredAnswerView` no cliente (PASSO 4) · `execMode`/`approvalGate` (PR07) · trace real no ⟁ (PR06) · **UI de Opções (Skills/Conectores/MCP) + rename Plugin→Skill** (PASSO 7/9 UI — o incômodo do menu). Cada um é um PR próprio depois que o motor estiver no ar e estável.

## Resumo dos gates (checklist binário)
A0 status limpo · A2/A3 sem conflito · B1 transpile 0 · B2 vitest verde · B3 legado intacto · C2 Actions verde + health 200 · C3 prod == legado · D1 coleções · D2 índice Active · E2 4 smokes ok · F kill-switch testado.
