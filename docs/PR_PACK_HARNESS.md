# PR PACK — 3 PRs pra deixar o `main` PRONTO pra empacotar numa VPS

> Foco: mergear estas 3 PRs em `main` → o harness fica **visível e funcional**, e o `main` vira
> **empacotável** (deploy numa VPS depois, sem mais código pendente). Cada PR é pequena, verificável,
> atrás da flag `AURA_HARNESS` (default-on; `="0"` = legado). Executor: Claude Code (repo). Verificar
> com `ts.transpileModule` + `npx vitest run`. Nada mergeia com gate vermelho. Escrito 2026 (Fable).
> **Nota:** os 2 patches (PR2/PR3) já foram testados com `patch --dry-run` contra `origin/main` → aplicam limpo.

## Ordem: PR1 → PR2 → PR3 (independentes, mas render primeiro = maior valor)

---

### PR1 · Render estruturado — deixa o harness VISÍVEL  `aura/pr1-render`
**Problema:** o motor já devolve `StructuredAnswer` completo, mas a rota achata em texto (`route.ts` ~:288) e o componente que mostraria não está em main. Resultado: resposta rica vira bloco de texto.

**Passos:**
1. Trazer o componente (só ele, de outra branch):
   `git checkout origin/aura/base-coworking-harness -- components/study/StructuredAnswerView.tsx`
   (NÃO trazer `route.ts`/outros dessa branch — regridem o motor.)
2. **Transporte** — `app/api/ai/chat/route.ts`: junto das sentinelas (`:13-14`) adicionar
   `const STRUCTURED_SENTINEL = "@@STRUCTURED@@";`. No branch `else` de texto (~:288), se o `answer`
   tiver campo rico (`answer.conceitos?.length || answer.evidencia?.length || answer.proximos_passos?.length || answer.desenvolvimento`),
   emitir `controller.enqueue(encoder.encode(STRUCTURED_SENTINEL + JSON.stringify(answer)))`; senão manter `out.text` (retrocompat).
3. **Cliente** — `components/study/StudyCoworkChat.tsx` e `components/research/ResearchChat.tsx`: espelhar o parser que já existe (`acc.indexOf(SENTINEL)` → `JSON.parse(acc.slice(si+len))` — ver StudyCoworkChat :319-328 / ResearchChat :161-169) para `@@STRUCTURED@@`; ao achar, renderizar `<StructuredAnswerView answer={parsed} onNext={...}/>` em vez da datilografia. Sem a sentinela → comportamento atual intacto. Manter ⟁ + liquid glass.
**Gate:** pergunta de conceito na Sala de Estudos → núcleo + conceitos (chips) + fontes + próximos-passos; pedido de artefato segue na sentinela do Studio; `AURA_HARNESS=0` → texto puro. Transpila.

---

### PR1.5 · `artifacts[]` inline — texto + artefato JUNTOS (a ponte pro Studio e pra camada agêntica)  `aura/pr15-artifacts-inline`
**Auditoria de compatibilidade (feita):** o harness **não substitui** o Studio — ele o **chama**. Palette
manual, texto livre e harness convergem no MESMO `runStudioAction` → `/api/studio/*` → `StudioBlock`.
As PRs 1/2/3 são não-quebra. **Porém** hoje `resolveHarnessOutput` é excludente (`mode: text | studio |
research`) → um turno é OU texto OU artefato. O contrato `StructuredAnswer.artifacts[]` já existe mas é
descartado no galho de texto. Esta PR abre "texto **com** artefato inline" — **reusando** o Studio, sem duplicar.

**Passos:**
1. `lib/agent/aura-harness.ts` — `resolveHarnessOutput` do galho de texto passa a **incluir** `answer.artifacts`
   (não descartar). Manter os modos studio/research como estão (retrocompat).
2. `app/api/ai/chat/route.ts` — no envio do `@@STRUCTURED@@` (PR1), o JSON já leva `artifacts[]` (é parte do `answer`).
3. Cliente (`StudyCoworkChat`) — ao renderizar `StructuredAnswerView`, para cada item de `answer.artifacts`,
   disparar o **mesmo** `runStudioAction(kind, topic)` que a palette usa (ex.: `{kind:"image"|"molecule", topic}`),
   embutindo o `StudioBlock` resultante **abaixo do texto, na mesma mensagem**. Zero endpoint novo.
**Gate:** "me explica o café" → resposta estruturada **+** um `StudioBlock` (imagem/molécula) na mesma bolha;
a palette manual e a geração por texto livre continuam idênticas; `AURA_HARNESS=0` = legado.
**Por que agora:** é o trilho que a **camada agêntica** (tutores respondendo com molécula/diagrama junto) exige. Sem ela, o tutor responde OU texto OU artefato, nunca os dois.

### PR2 · Visual / Molécula  `aura/pr2-visual`
Aplica o patch pronto: `git apply docs/aura-visual-fix.patch` (router: `molécula/estrutura/imagem` + verbo de geração → `gerar_artefato`; `pickStudioKind` → `image`; trava anti-refusal no `draft`).
**Gate:** `npx vitest run lib/agent/__tests__/router.test.ts`; "gera a imagem/molécula de X" cai em artefato, não em recusa. Transpila. (dry-run já OK contra main.)

---

### PR3 · Health + GIT_SHA — visibilidade de deploy  `aura/pr3-health`
1. `git apply docs/aura-health-gitsha.patch` (`/api/health` passa a devolver `{commit, harness}`).
2. `deploy.yml`: após `git reset --hard origin/main`, injetar `echo "GIT_SHA=$(git rev-parse --short HEAD)" >> .env.secrets`.
**Gate:** `/api/health` responde `{commit, harness}`. Transpila. (dry-run já OK contra main.)

---

## DoD do pacote (quando o `main` está "VPS-ready")
- [ ] PR1+PR2+PR3 mergeadas em `main`, cada uma com gate verde + transpila + `AURA_HARNESS=0` = legado idêntico.
- [ ] `main` builda a imagem (`docker compose -f docker-compose.beta.yml build web`) sem erro.
- [ ] Código-completo: nada mais pendente pra o harness ficar visível/funcional **exceto infra** (índices Atlas + `.env` + deploy — isso é o empacotamento na VPS, não código).
- [ ] 1 linha de CHANGELOG por PR citando o contrato (§8/§11 do `AURA_AGENTIC_LAYER_PLAN.md`).

## O que fica FORA deste pacote (é empacotamento/infra, não código)
Índices Atlas (`memory_drawers_vec`/`_text`) · `.env` de prod/staging · subir na VPS. Runbook: `STAGING_CHIPFLOW.md` + `ACTIVATE_HARNESS_NOW.md`. A memória L3 já é código em main; só **acende** quando os índices existem (degrada muda sem eles — não quebra).

## Fronteira
Fable escreveu os specs + os 2 patches verificados. O **Claude Code** aplica/mergeia (tem repo). Depois de merjado, o `main` está pronto pra empacotar na VPS quando você quiser.
