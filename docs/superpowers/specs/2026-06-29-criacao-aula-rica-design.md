# Spec — Criação de aula RICA: blocos interativos intercalados (fatia 1)

**Data:** 2026-06-29
**Branch:** `feat/criacao-aula-rica` (base: `main` @ ad7054c)
**Status:** desenho aprovado (direção + persistência). Aguardando revisão do spec.

---

## 1. Objetivo

A criação de aula do professor já é um **canvas vivo** (`MeusEstudosFeed mode="teach"`), mas
perguntas e interativos hoje são authoradas num **painel separado** (`AulaQuestionsPanel`) e
**anexadas no fim** — não são blocos do canvas e não se intercalam com o conteúdo. Este trabalho
torna as perguntas **blocos de primeira classe do canvas**, summonáveis por **"/" e dock**,
**intercalados** no fluxo da aula (vídeo → texto → pergunta → texto …), e faz o **aluno percorrer
os blocos em ordem**, com a pergunta renderizada no lugar certo.

**Fatia 1 (este spec/PR):** o pipeline intercalado ponta-a-ponta usando **apenas os 4 tipos de
pergunta que já existem** (🎤 voz, 🔘 múltipla escolha, ✍️ escrita, 🎯 roleta — todos `ready:true`
em `lib/aulas/blockTypes.ts`). Nenhuma lógica de pergunta nova; o valor é a **arquitetura
intercalada**. Os 5 jogos + drag acessível + painel de pontuação dedicado ficam para fatias
seguintes (mapeados na §9).

## 2. Estado atual (verificado no código, não no handoff)

O handoff está desatualizado: ~60% já existe em `main`.

| Item | Status real |
|---|---|
| Canvas teach (`mode="teach"`) | ✅ `StudyRoomContent.tsx:362` monta `<MeusEstudosFeed mode="teach" />` |
| Engine de blocos reusada (`kind="aula"`, `placement`/`order`) | ✅ `StudySpace`/`StudyItem` |
| Schema (`noPaste`, `config Json`, `marks`, `order`) | ✅ já em `AulaQuestion` — sem migração |
| Correção (pontos; voz/aberta = manual, nunca 0 automático) | ✅ `lib/aulas/grade.ts` |
| 4 tipos de pergunta | ✅ tipos, correção, render aluno, IA por bloco (`/api/aulas/generate-block`), editor (`AulaQuestionsPanel`), registro (`lib/aulas/blockTypes.ts`) |
| Registro único `{kind,label,emoji,evaluable,ready,baseType,genHint}` | ✅ `AULA_BLOCKS` existe — mas **não** ligado ao "/" + dock do canvas |
| Perguntas como blocos do canvas, intercaladas | ❌ **não existe** — são canal separado (`teachQuestions`) anexado no fim |
| Render do aluno em ordem (intercalado) | ❌ hoje: `body` (markdown) + perguntas no fim |
| 5 jogos (cloze/dragwords/memory/branching/flashcards) | ❌ scaffold (`ready:false`); POST `/api/aulas` ainda coage tipo desconhecido → `open` |

**Bridge de envio atual** (`MeusEstudosFeed.tsx:264-307` → `app/api/aulas/route.ts` POST):
blocos do canvas → **`body` markdown**; perguntas → array `teachQuestions` → linhas `AulaQuestion`
(com `order` interno ao array, **não** relativo ao conteúdo). Dois espaços de ordem separados.

## 3. Metas e não-metas

**Metas (fatia 1):**
- Perguntas dos 4 tipos prontos viram **blocos do canvas**, inseríveis por "/" e dock (a partir do
  registro `AULA_BLOCKS`), com edição inline (professor edita tudo: enunciado, alternativas,
  corretas, `accepted`, `marks`, `noPaste`, `config`).
- Geração por IA de **um bloco** reusando `/api/aulas/generate-block` + `genHint` do registro.
- Envio serializa **uma única sequência ordenada** (`Aula.blocks`) + cria `AulaQuestion` (corre­ção).
- Aluno renderiza os blocos **em ordem**, com a pergunta no meio; submit → `grade.ts` (inalterado).
- **Compatibilidade**: aulas antigas (sem `blocks`) renderizam pelo caminho atual (body + perguntas
  no fim).

**Não-metas (fatia 1):**
- Os 5 jogos interativos e o helper de drag acessível (fatia 2).
- Painel "Pontuação da aula" com total dedicado (fatia 3) — nesta fatia, `marks` é editável **inline**
  no bloco (já suportado pelo schema).
- Fusão dos registros de Studio (estudo) e de aula num só (fatia 3); aqui o `AULA_BLOCKS` dirige só
  os blocos de aula, somados aos blocos de Studio existentes no "/" + dock.
- Vídeo com pergunta ancorada em timestamp (roadmap).

## 4. Arquitetura (fluxo)

```
Canvas do professor (StudyItems, mode="teach")
   ├─ blocos de conteúdo: text / video / studio
   └─ NOVO bloco "aula-question" (payload = def da pergunta)   ← inserido por "/" + dock (AULA_BLOCKS)
                         │
        ENVIAR (sendToTurma): percorre o feed por `order` →
           • blocks Json = [ {kind:'text',md} | {kind:'video',youtubeId} | {kind:'studio',studioKind,data}
                             | {kind:'q', questionId, qkind} ]   (sequência ordenada única)
           • cria AulaQuestion[] (uma por bloco de pergunta; order = posição global)
           • body markdown mantido como fallback
                         │
        Aluno (StudentAulasModule): itera `blocks` em ordem →
           conteúdo renderizado inline; em {kind:'q'} renderiza a pergunta no lugar → submit → grade.ts
```

## 5. Modelo de dados

Aditivo, Mongo (sem migração destrutiva; rodar `prisma generate`).

```prisma
model Aula {
  // ...campos atuais...
  body   String?   // mantido: fallback / aulas antigas
  blocks Json?      // NOVO: sequência ordenada de blocos da aula (ver formato abaixo)
}
```

**Formato de `Aula.blocks`** (array ordenado; `questionId` referencia uma `AulaQuestion`):
```ts
type AulaBlock =
  | { kind: "text";   md: string }
  | { kind: "video";  youtubeId: string }
  | { kind: "studio"; studioKind: string; title?: string; data: unknown }
  | { kind: "q";      questionId: string; qkind: AulaBlockKind }   // qkind: q-voice|q-choice|q-written|q-roulette
```
`AulaQuestion` permanece a fonte de verdade da correção (intacto). `blocks[i].kind==="q"` só aponta
para a linha; nada de gabarito é duplicado no `blocks` (o aluno recebe `blocks` sem `isCorrect`,
igual hoje o detail strip-a as respostas).

## 6. Unidades (isoladas, testáveis)

1. **Editor de pergunta reutilizável** — extrair o editor de UMA pergunta de `AulaQuestionsPanel`
   para `components/aulas/QuestionEditor.tsx` (props: `value: AuthQ`, `onChange`). `AulaQuestionsPanel`
   passa a usá-lo (sem regressão) e o bloco do canvas também. Sem duplicar UI.
2. **Bloco `aula-question` no canvas** — novo `StudyItem.type="aula-question"`; `payload` = `AuthQ`
   (`qkind`, `text`, `options`, `accepted`, `marks`, `noPaste`, `config`). Renderiza `QuestionEditor`
   inline no feed; arrastável/reordenável como qualquer bloco (herda do canvas).
3. **Registro → "/" + dock (teach)** — em `mode="teach"`, o `slashMenu` e o `StudioDock` listam os
   blocos `ready:true` de `AULA_BLOCKS` (além dos de Studio). Selecionar insere um bloco
   `aula-question` no cursor (mesmo fluxo `zaeon:studio:generate` → `zaeon:study:embed`), com opção de
   **gerar por IA** via `/api/aulas/generate-block` (usa `genHint`).
4. **Serializador de envio** — `MeusEstudosFeed.sendToTurma` percorre o feed ordenado e monta
   `blocks` + payloads de pergunta (substitui "body markdown + `teachQuestions` separado"; `body`
   ainda é gerado como fallback).
5. **Persistência** — `POST /api/aulas` aceita `blocks`; persiste `Aula.blocks`; cria `AulaQuestion`
   por bloco de pergunta com `order` = posição global; valida `qkind` via `AULA_BLOCKS` (mapeando
   `baseType`), substituindo a whitelist `QT` hardcoded.
6. **Render intercalado do aluno** — `StudentAulasModule` itera `Aula.blocks`; em `text`/`video`/
   `studio` renderiza o conteúdo, em `q` renderiza a pergunta (reusa os `QuestionView` atuais);
   **fallback** ao caminho atual (body + perguntas no fim) quando `blocks` é ausente/vazio.

## 7. Compatibilidade

- Aulas já enviadas (sem `blocks`) → render pelo caminho atual. Sem migração de dados.
- `GET /api/aulas/[id]` continua removendo gabarito para alunos; `blocks` enviado ao aluno carrega só
  `questionId`+`qkind` (a pergunta vem das linhas já sanitizadas).
- `AulaQuestionsPanel` segue existindo (agora consumindo `QuestionEditor`); pode coexistir como
  atalho "adicionar pergunta" — mas o caminho principal passa a ser o bloco no canvas.

## 8. Testes / verificação

- **tsc:** `npx tsc --noEmit` — zero erros novos (baseline ≤5 conhecido).
- **prisma:** `prisma generate` após adicionar `Aula.blocks` (objeto `data` em `const` separada —
  excess-property).
- **Unit:** serializador feed→`blocks` (ordem preservada; tipos mapeados; `marks`/`config` íntegros);
  `qkind`→`baseType` via `AULA_BLOCKS`; fallback do aluno quando `blocks` ausente.
- **Smoke (PR):** criar aula → "/" e dock mostram os 4 tipos de pergunta + blocos de Studio; inserir
  pergunta no meio do conteúdo, editar e (opcional) gerar por IA; enviar; como aluno, ver
  **conteúdo→pergunta→conteúdo** em ordem; responder; nota soma pelos `marks`; voz/aberta → "a
  corrigir". **Se a criação parecer formulário, está errado.**

## 9. Diferido (mapeado, encaixa no registro sem re-arquitetura)

- **Fatia 2 — 5 jogos** (cloze, arrastar palavras, memória, cenário ramificado, flashcards) + **helper
  de drag acessível** (mouse+toque+teclado; snap; feedback). Cada um: editor, render aluno, correção
  (estender `grade.ts`), `ready:true` no `AULA_BLOCKS`. Relaxar a persistência p/ `config` dos jogos.
- **Fatia 3 — polish**: painel "Pontuação da aula" (lista avaliáveis + total editável antes do envio);
  fusão dos registros Studio+aula num só surface; geração por bloco para os jogos.
- **Roadmap (handoff):** vídeo interativo com pergunta em timestamp, ordenar parágrafos, marcar
  palavras, hotspots na imagem, cruzadinha, V/F, resumo automático.

## 10. Riscos / armadilhas

- **Base stale:** este worktree não tem o subsistema de aulas (está em `fix/abnt-prod`). Implementar
  só sobre `feat/criacao-aula-rica` (base `main` atual). Confirmar cada trecho no código real antes
  de editar (o handoff diverge da realidade).
- **Proxy ISP:** `git fetch`/push podem travar; se travar, deixar commit pronto e avisar o Martinez.
- **Não quebrar** o caminho atual (aulas antigas, `AulaQuestionsPanel`, `grade.ts`, submit).
- **Excess-property no Prisma:** montar objetos `data` em `const` tipada.
```
