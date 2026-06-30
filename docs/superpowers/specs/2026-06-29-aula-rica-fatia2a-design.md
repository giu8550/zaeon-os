# Spec — Aula rica FATIA 2a: cloze + dragwords + drag acessível

**Data:** 2026-06-29
**Branch:** `feat/criacao-aula-rica-2a` (empilha sobre `feat/criacao-aula-rica` = main + fatia 1)
**Status:** desenho aprovado. Aguardando revisão do spec.
**Contexto:** continua [[aula-rica]] fatia 1 (blocos de pergunta intercalados). Fatia 2a entrega os 2 **jogos avaliáveis** + a primitiva de drag acessível reusável.

## 1. Objetivo

Adicionar 2 dos 5 jogos interativos como blocos do canvas teach, ponta-a-ponta (editor → IA → render do aluno → correção): **🧩 cloze (lacunas)** e **✋ dragwords (arrastar palavras)** — ambos `evaluable:true`. Construir um **helper de drag acessível** (mouse + toque + teclado) reusável (a memória, fatia 2b, também usará).

## 2. Estado atual (verificado)

- `lib/aulas/blockTypes.AULA_BLOCKS`: `q-cloze` (baseType `cloze`, evaluable true) e `q-dragwords` (baseType `dragwords`, evaluable true) existem como **scaffold `ready:false`**; genHints definidos.
- `lib/aulas/grade.ts` (puro): trata choice/input/voice/roulette; **tipos desconhecidos caem no `else` → `marksOutOf=0` (manual)** — então adicionar os jogos não quebra nada; só não pontuam até terem ramo próprio.
- `lib/aulas/generateParse.buildQuestionBlock`: trata os 4 prontos; **retorna null** para os jogos.
- `app/api/aulas/route.ts` POST: `QT = {choice,input,open,voice,roulette}` → tipo fora disso vira `open`. (Schema `AulaQuestion.type` é String livre.)
- `QuestionEditor` (fatia 1) e `QuestionView` (aluno): tratam os 4 tipos; jogos ainda não.
- Submissão (`SubmittedAnswer`): `answer?/choiceIndex?/transcript?/picks?`. Sem campo p/ lacunas.

## 3. Metas e não-metas

**Metas (2a):** cloze e dragwords completos (editor + geração IA + render + correção parcial); `WordDrag` acessível; `ready:true` para os dois; persistência dos tipos `cloze`/`dragwords`.
**Não-metas:** flashcards e memória (2b); cenário ramificado (2c); fusão de registros / painel de pontuação dedicado (fatia 3).

## 4. Arquitetura — primitiva "fill-blanks" compartilhada

cloze e dragwords reduzem ao MESMO modelo normalizado; 2 adaptadores produzem, 1 render + 1 corretor consomem.

```ts
// modelo normalizado (em memória; não persistido cru)
type FillPart = { t: "text"; s: string } | { t: "blank"; i: number }; // i = índice da lacuna
type FillModel = { parts: FillPart[]; answers: string[]; bank: string[]; allowType: boolean };
```

**Persistência** (`AulaQuestion.config` / `AuthQ.config` — `Json`, sem migração):
- **cloze**: `config = { text: string }` com marcadores inline `*palavra*` (palavra = resposta da lacuna). `parseCloze(text) → FillModel` (puro): quebra o texto em parts, `answers` = palavras marcadas na ordem, `bank` = `answers` embaralhadas, `allowType = true` (digita **ou** arrasta).
- **dragwords**: `config = { sentence: string, words: string[] }` — `sentence` com lacunas marcadas `*palavra*` (resposta) e `words` = distratores extras. `parseDragwords(config) → FillModel` (puro): parts/answers da sentence; `bank` = `answers ∪ words`, embaralhado; `allowType = false` (só arrasta).

> Embaralhamento determinístico no servidor não é necessário; o `bank` é gerado no render do aluno a partir do config (seed por `questionId` para estabilidade entre re-renders). Mantém `config` mínimo e a IA/editor simples.

## 5. Correção (`lib/aulas/grade.ts`)

- Novo campo em `SubmittedAnswer`: `blanks?: string[]` (uma palavra por lacuna, na ordem).
- Helper puro `gradeBlanks(answers: string[], submitted: string[]): { correct: number; total: number }` — usa `normalize` (já existe); conta acertos posição-a-posição (match exato normalizado; sem "includes" frouxo — lacuna é resposta fechada).
- Ramos novos para `q.type === "cloze"` e `q.type === "dragwords"` (deriva `answers` do `config` via os parsers): **crédito parcial** — `marksOutOf = marks`, `earnedThis = round(marks × correct/total)`, `isCorrect = correct === total` (espelha a roleta). `total === 0` → trata como manual (`marksOutOf=0`).
- `GradeQuestion.config` é alargado para incluir `{ text?: string; sentence?: string; words?: string[] }` (além de pool/rounds).

## 6. Drag acessível (`components/aulas/WordDrag.tsx` + reducer puro)

- **Reducer puro** `lib/aulas/dragPlacement.ts` (testável): estado `{ slots: (string|null)[]; used: number[] }` derivável; ações `place(word, slotIdx)`, `clearSlot(slotIdx)`, `swap`. Foco em correção: cada lacuna guarda 1 palavra; mover palavra do banco/entre lacunas.
- **Componente** `WordDrag`: render do banco (chips) + lacunas (slots). Interações:
  - **Mouse**: HTML5 DnD (`draggable`, `onDragStart/onDrop`).
  - **Toque**: Pointer Events (pointerdown→move→up; chip segue o dedo; solta na lacuna sob o ponto).
  - **Teclado**: foca um chip (`tabIndex`), Enter/Espaço "pega"; foca uma lacuna, Enter "solta"; Backspace numa lacuna devolve ao banco. `aria-grabbed`/`aria-label` p/ leitor de tela.
  - Feedback de acerto/erro **só após enviar** (locked): lacuna verde/vermelha; estética liquid-glass (mesma paleta).
- Props: `{ slots: number; bank: string[]; value: (string|null)[]; allowType?: boolean; locked?: boolean; correct?: boolean[]; onChange: (v: (string|null)[]) => void }`. `allowType` mostra também um input por lacuna (cloze).

## 7. Unidades (isoladas, testáveis)

1. `lib/aulas/fillBlanks.ts` — `parseCloze`, `parseDragwords`, `gradeBlanks` (PURO, TDD).
2. `lib/aulas/dragPlacement.ts` — reducer puro de colocação (TDD).
3. `lib/aulas/grade.ts` — ramos cloze/dragwords + `blanks?` no `SubmittedAnswer` + alarga `config` (TDD).
4. `lib/aulas/generateParse.ts` — `buildQuestionBlock` p/ cloze (parse `*marcada*`) e dragwords (sentence+words) (TDD).
5. `components/aulas/WordDrag.tsx` — componente acessível (reducer testado; UI por smoke).
6. `components/aulas/QuestionEditor.tsx` — editor cloze (textarea `*marcada*` + preview das lacunas) e dragwords (sentence + banco de distratores).
7. `components/aulas/StudentAulasModule.tsx` (`QuestionView`) — `FillBlanksView` (usa `WordDrag`) p/ cloze e dragwords; coleta `blanks[]` no submit.
8. `lib/aulas/blockTypes.ts` — `ready:true` p/ q-cloze e q-dragwords.
9. `app/api/aulas/route.ts` + `app/api/aulas/[id]/submit/route.ts` — aceitar tipos `cloze`/`dragwords`; submit repassa `blanks` ao grade.

## 8. Compatibilidade

- Aditivo: novos tipos não afetam os 4 existentes nem aulas antigas. `blanks?` é opcional. `config` Json já existe.
- O bloco no canvas continua sendo `aula-question` (payload `AuthQ` com `kind` q-cloze/q-dragwords) — a serialização/persistência da fatia 1 já carrega tudo via `config`.

## 9. Testes / verificação

- `vitest`: parseCloze/parseDragwords (parts/answers/bank); gradeBlanks (parcial, vazio, acentos); ramos cloze/dragwords no gradeSubmission; reducer de drag (place/clear/swap); buildQuestionBlock cloze/dragwords (incl. degenerado→null).
- `tsc --noEmit`: zero novos (baseline 5).
- Smoke manual: inserir cloze e dragwords pelo "/" e dock; editar; gerar por IA; como aluno **arrastar** (mouse), **tocar** (toque) e **teclado** (foco+Enter) para preencher; enviar; nota soma parcial; lacunas mostram verde/vermelho.

## 10. Riscos

- **Acessibilidade do drag** é o ponto mais difícil — por isso o reducer é puro/testado e as 3 modalidades são explícitas; teclado é fallback obrigatório.
- **Toque + HTML5 DnD** não combinam bem → usar Pointer Events para toque (não depender de DnD nativo no mobile).
- Não quebrar a correção atual (grade.ts) — ramos novos isolados; total=0 cai no manual.
- Base/entrega: implementar no worktree (sobre fatia 1) e entregar via Git Trees API sobre `feat/criacao-aula-rica` (proxy ISP trava git fetch) — ver [[aula-rica]].
