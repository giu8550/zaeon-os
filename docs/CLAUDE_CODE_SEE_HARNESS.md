# VER O HARNESS AGIR — cole num agente Claude Code (repo zaeon-os, com git+SSH)

Objetivo: (1) confirmar que o motor do harness está VIVO em prod, e (2) fazer a resposta dele aparecer
ESTRUTURADA na Sala de Estudos (hoje ela chega espremida em texto). Sem banco/memória/molécula — isso é
outro assunto. Verifique com `ts.transpileModule` + `npx vitest run`. **Peça meu OK antes de push/deploy.**
Reporte 1 linha por gate.

## TRILHA 1 — Confirmar que o motor está no ar (5 min, sem código)
1. `ssh <vps> 'cd <DEPLOY_PATH> && git rev-parse --short HEAD'` → me diga se bate com `origin/main`.
2. `ssh <vps> 'grep AURA_HARNESS <DEPLOY_PATH>/.env || echo "sem linha = default ON"'` → me diga o valor.
- **Gate 1:** você me reporta "deploy = <sha> / flag = on|off". Se o deploy NÃO tem o main atual, rode antes
  a FASE 1 de `docs/CLAUDE_CODE_GO_LIVE.md` (merge+deploy+flag). Se está no ar e on → segue pra Trilha 2.

## TRILHA 2 — Fazer o harness ficar VISÍVEL (1 PR, `aura/render-estruturado` a partir de origin/main)

**Fato ancorado:** o motor já devolve um `StructuredAnswer` completo (`answer` em `app/api/ai/chat/route.ts`,
~linha 280), mas o branch de texto (~linha 288) manda só `out.text` — os campos ricos se perdem. E o
componente que os renderiza NÃO está em main (só em `origin/aura/base-coworking-harness`).

1. **Trazer o componente (sem regressão):**
   `git checkout origin/aura/base-coworking-harness -- components/study/StructuredAnswerView.tsx`
   (traz SÓ esse arquivo; NÃO traga `route.ts` nem outros dessa branch — são pré-harness e regridem).
2. **Transporte — a rota emite o estruturado.** Em `app/api/ai/chat/route.ts`: defina
   `const STRUCTURED_SENTINEL = "@@STRUCTURED@@";` (junto das outras em :13-14). No branch `else` (~:288),
   se o `answer` tiver campos além do `nucleo` (`conceitos?.length || evidencia?.length || proximos_passos?.length`),
   emita `STRUCTURED_SENTINEL + JSON.stringify(answer)`; senão mantenha `out.text` (retrocompat).
3. **Cliente — renderiza.** Em `components/study/StudyCoworkChat.tsx` (e espelhe em
   `components/research/ResearchChat.tsx`): detecte `@@STRUCTURED@@` no stream do mesmo jeito que já tratam
   `@@STUDIO_ACTION@@`; parse o JSON e renderize `<StructuredAnswerView answer={...} onNext={...} />` em vez
   da datilografia. Fallback: se não vier a sentinela, comportamento atual (texto) intacto. Preserve ⟁ + liquid glass.
- **Gate 2:** com o harness on, uma pergunta de conceito na Sala de Estudos volta com núcleo + conceitos (chips)
  + fontes + próximos-passos clicáveis (não um bloco de texto). Pedido de artefato ("gera um mapa de X") segue
  na sentinela do Studio. `AURA_HARNESS=0` → volta ao texto puro (retrocompat). Transpila; sem regressão.

**[confirmação]** push → PR → merge → deploy. Depois: abrir a Sala de Estudos em prod e conversar = harness visível.

## Opcional (depois, se quiser as fases "planejando/buscando" no ⟁)
PR-D do `MASTER_HARNESS_ACTIVATION.md`: `AuraThinking` lê os `AgentStep` reais do trace em vez do timer.

Se algo divergir do descrito, PARE e me diga — não improvise mudança estrutural.
