# PLANO DE IMPLEMENTAÇÃO — PR do Harness (render estruturado + artifacts inline)

> Para um agente Fable **subir esta PR**. É a PR que torna o harness **visível** e permite **texto +
> artefato na mesma resposta**, REUSANDO o Studio (nada substituído). Auditado linha a linha contra
> `origin/main` em 2026. Branch: **`aura/harness-render-inline`** (a partir de `origin/main`).
>
> **Escopo:** PR1 (render `StructuredAnswerView`) + PR1.5 (`artifacts[]` inline) juntas — são acopladas.
> **Fora de escopo (outras PRs):** kind `molecule` (RICH_ARTIFACTS), a decisão "café→cafeína" (hook de
> prompt), o `aura-visual-fix.patch`, o `aura-health-gitsha.patch`. Esta PR entrega o **trilho**; ele já
> funciona com o kind `image` que existe hoje.

---

## 0. Princípio de não-regressão (ler antes)
- O harness **chama** o Studio, não substitui: palette manual, texto livre e harness convergem em
  `runStudioAction → /api/studio/* → StudioBlock`. Esta PR **não toca** esse pipeline; só **soma** um novo
  modo de saída (`structured`) e a capacidade de embutir o artefato na mesma bolha.
- **Modos preservados:** `studio` (artefato puro, ex.: "gera um mapa") e `research` (trabalho na pesquisa)
  ficam **idênticos**. Só o antigo galho `text` (que achatava em markdown) vira `structured`.
- **Flag:** tudo sob `AURA_HARNESS` (default-on; `="0"` = legado intacto).

## 1. Pré-flight
```bash
git fetch origin && git checkout -b aura/harness-render-inline origin/main
# traz SÓ o componente da branch base (NÃO o route.ts/outros de lá — regridem o motor):
git checkout origin/aura/base-coworking-harness -- components/study/StructuredAnswerView.tsx
```
Confirmar props do componente: `export default function StructuredAnswerView({ answer, onNext }: { answer: StructuredAnswer; onNext?: (step:string)=>void })`.

## 2. Mudanças arquivo a arquivo (com âncoras reais)

### 2.1 `lib/agent/aura-harness.ts` — novo modo `structured` + preservar artifacts
Hoje (`:209-211`) `HarnessOutput` é união `text|studio|research`, e `resolveHarnessOutput` (`:236-256`)
no galho final achata via `renderStructuredAnswer`. Mudar:
1. Somar variante à união:
   ```ts
   export type HarnessOutput =
     | { mode: "text"; text: string }
     | { mode: "structured"; answer: StructuredAnswer }   // NOVO — carrega o objeto (inclui artifacts[])
     | { mode: "studio"; kind: string; topic: string; text: string }
     | { mode: "research"; kind: string; topic: string; text: string };
   ```
2. Em `resolveHarnessOutput`, manter a ordem e trocar SÓ o fim:
   ```ts
   // research (inalterado)  → if (intent==="criar_trabalho" && surface==="pesquisa") return {mode:"research",...}
   // ARTEFATO PURO (inalterado): gerar_artefato cujo texto é só "lead" e tem studioArt → studio
   if (studioArt && state.intent === "gerar_artefato") {
     return { mode: "studio", kind: studioArt.studioKind, topic: objective, text: lead };
   }
   // NOVO: tudo mais → structured, carregando o answer COMPLETO (com artifacts[] se houver)
   return { mode: "structured", answer };
   ```
   Manter `renderStructuredAnswer` exportado (fallback do cliente antigo / `AURA_HARNESS=0`).
   *Efeito:* `gerar_artefato` ("gera um mapa") segue `studio` idêntico; `explicar_conceito`/`conversa`/`revisar`
   viram `structured` (e se o `answer` trouxer `artifacts[]`, eles viajam junto).

### 2.2 `app/api/ai/chat/route.ts` — emitir a sentinela estruturada
- Junto de `STUDIO_SENTINEL`/`RESEARCH_SENTINEL` (`:13-14`): `const STRUCTURED_SENTINEL = "@@STRUCTURED@@";`
- No branch do harness (o `if (out.mode === "studio") … else if research … else …` ~`:283-289`), somar o caso:
  ```ts
  } else if (out.mode === "structured") {
    controller.enqueue(encoder.encode(STRUCTURED_SENTINEL + JSON.stringify(out.answer)));
  } else {
    controller.enqueue(encoder.encode(out.text)); // fallback texto (retrocompat)
  }
  ```
  (Studio/research inalterados.) Nada mais muda na rota.

### 2.3 `components/study/StructuredAnswerView.tsx`
Já trazido no pré-flight. Sem edição (usa `answer` + `onNext`). Confirmar que importa `StructuredAnswer` de `@/lib/agent/contracts` (é o mesmo tipo que a rota serializa).

### 2.4 `components/study/StudyCoworkChat.tsx` — parse + render + artefato inline
1. **Import** (topo, junto do StudioBlock `:30`): `import StructuredAnswerView from "@/components/study/StructuredAnswerView";` e `import type { StructuredAnswer } from "@/lib/agent/contracts";`
2. **Const** (junto de `STUDIO_SENTINEL` `:40`): `const STRUCTURED_SENTINEL = "@@STRUCTURED@@";`
3. **Msg type** (`:43-52`): somar `"structured"` ao `kind` e o campo `answer?: StructuredAnswer;` (o `studioBlock?` já existe → serve pro artefato inline).
4. **Loop de stream** (`:315-334`): hoje corta em `STUDIO_SENTINEL`. Antes do bloco de texto final, checar a estruturada:
   ```ts
   const sti = acc.indexOf(STRUCTURED_SENTINEL);
   if (sti >= 0) {
     ended = true; target = "";
     let ans: StructuredAnswer | null = null;
     try { ans = JSON.parse(acc.slice(sti + STRUCTURED_SENTINEL.length)); } catch {}
     if (ans) {
       const msgId = uid();
       setMessages(prev => [...prev, { id: msgId, role:"assistant", kind:"structured", answer: ans!, at: Date.now() }]);
       // PR1.5: artefatos inline — reusa runStudioAction, anexa NA MESMA msg
       for (const art of (ans.artifacts ?? [])) {
         if (art.studioKind) void runStudioAction(art.studioKind, objectiveOrPrompt, msgId);
       }
       appendTranscript("estudos", focusIds[0] ?? null, [
         { role:"user", text: prompt }, { role:"assistant", text: ans.nucleo ?? "" }]);
     }
   } else if (si >= 0) { /* …STUDIO_SENTINEL, inalterado… */ }
   else { /* …texto puro, inalterado… */ }
   ```
   (Manter a ordem: checar estruturada e studio; datilografia só quando nenhuma sentinela.)
5. **`runStudioAction`** (`:194`): assinatura ganha 3º param opcional `attachMsgId?: string`; propagar no `fire`:
   `const fire = (detail:any)=> window.dispatchEvent(new CustomEvent("zaeon:study:embed",{ detail: { ...detail, attachMsgId } }));`
6. **`onEmbed`** (`:136-146`): se `d.attachMsgId`, **anexar** o block à msg existente em vez de criar nova:
   ```ts
   if (d.attachMsgId) {
     setMessages(prev => prev.map(m => m.id === d.attachMsgId ? { ...m, studioBlock: block } : m));
   } else {
     setMessages(prev => [...prev, { id: uid(), role:"assistant", kind:"studio", studioBlock: block, at: Date.now() }]);
   }
   ```
   *Retrocompat:* sem `attachMsgId` (palette manual, texto livre) → comportamento atual (msg nova).
7. **Render** (junto do `if (m.kind === "studio" …)` `:449`): somar antes:
   ```tsx
   if (m.kind === "structured" && m.answer) {
     return (
       <div key={m.id} className="flex justify-start"><div className="max-w-[85%] w-full">
         <StructuredAnswerView answer={m.answer} onNext={(s)=>{ setInput(s); }} />
         {m.studioBlock && <div className="mt-2"><StudioBlock block={m.studioBlock} collapsed={false} /></div>}
       </div></div>
     );
   }
   ```

### 2.5 `components/research/ResearchChat.tsx` — espelhar
Mesmo parse de `@@STRUCTURED@@` + render de `StructuredAnswerView` (a Sala de Pesquisa usa `RESEARCH_SENTINEL` `:161-169` no mesmo padrão). Se o tempo apertar, cobrir a Sala de Estudos primeiro e abrir issue pra a Pesquisa — mas o ideal é as duas na PR.

## 3. Matriz de compatibilidade (antes → depois)
| Intenção / caminho | Antes | Depois | Studio afetado? |
|---|---|---|---|
| "gera um mapa/podcast/imagem" (`gerar_artefato`) | studio sentinel → artefato | **idêntico** (studio) | não |
| trabalho na Pesquisa (`criar_trabalho`+pesquisa) | research sentinel | **idêntico** | não |
| "me explica X" (`explicar_conceito`) | texto achatado | **StructuredAnswerView** (+artefato inline se `artifacts[]`) | reusa |
| palette manual | prompt→harness→studio | **idêntico** | não |
| `AURA_HARNESS=0` | legado | **idêntico** (legado) | não |

## 4. Verificação (gates binários)
- **Transpile:** `ts.transpileModule` em `aura-harness.ts`, `route.ts`, `StudyCoworkChat.tsx`, `ResearchChat.tsx`, `StructuredAnswerView.tsx` → 0 erro categoria 1.
- **Vitest (lógica pura):** teste de `resolveHarnessOutput`: (a) `gerar_artefato`+studioArt → `mode:"studio"`; (b) `explicar_conceito` → `mode:"structured"` e `answer.artifacts` preservado; (c) `criar_trabalho`+pesquisa → `research`.
- **Smoke manual (staging):** "me explica o café" → cartão estruturado (núcleo/conceitos/fontes/próximos); "gera um mapa mental de X" → StudioBlock (inalterado); um `explicar_conceito` cujo `answer.artifacts` tenha `{studioKind:"image"}` → texto **+** imagem na mesma bolha; `AURA_HARNESS=0` → datilografia legada.

## 5. DoD
- [ ] Os 3 gates da §4 verdes.
- [ ] Matriz §3 confere (studio/research/legado idênticos; explicar vira estruturado; artefato inline funciona com `image`).
- [ ] `docker compose -f docker-compose.beta.yml build web` sem erro.
- [ ] CHANGELOG: 1 linha citando §7 (estados H/I) do `HANDOFF_EXECUTOR` + o contrato `StructuredAnswer` (§8.2).

## 6. Riscos & mitigação
- **Mudar a união excludente pode afetar `gerar_artefato`** → mitigado: mantemos o galho `studio` explícito p/ `gerar_artefato`+studioArt; só o resto vira `structured`.
- **`onEmbed` refatorado pode quebrar o artefato standalone** → mitigado: sem `attachMsgId`, comportamento é o atual (msg nova). Testar os dois caminhos.
- **Cliente antigo x sentinela nova** → controlamos o cliente; muda na mesma PR. `AURA_HARNESS=0` cai no legado sem sentinela.
- **Kind sem viewer** (ex.: `molecule` antes da RICH_ARTIFACTS) → `StudioBlock` faz switch por kind; kind desconhecido deve cair num fallback discreto (verificar/adicionar `default` no switch). Por ora usar só `image`.

## 7. Rollback
`AURA_HARNESS=0` + recreate → legado em segundos. Ou `git revert` do merge. Sem migração de dados.

## 8. Fronteira
Fable escreve/verifica (transpile/vitest); o agente que sobe a PR aplica na branch, roda os gates, e abre o PR contra `main`. Merge só com gate verde.
