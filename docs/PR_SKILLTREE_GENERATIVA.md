# PR — Árvore de Habilidades GENERATIVA por tópico

> Objetivo: pôr no ar a **skill tree que a IA gera para CADA tópico de estudo** — nós de teoria/experimental/
> prático, com pré-requisitos e desbloqueio por maestria, visível na Sala de Estudos e ciente pelo mentor.
> Hoje NÃO existe código disso (só o plano em `AGENTIC_LAYER.md §3.5`). Roda EM CIMA do harness; reusa o
> `User.skills` (RPG) e o Studio. Branch: **`aura/skilltree-generativa`** (a partir de `main`). Escrito 2026 (Fable).

## 0. Princípio
A árvore é **gerada por IA** (Gemini) a partir do tópico, **cacheada** por tópico (não regenera à toa), e o
**progresso é por usuário**. Não é currículo hardcoded — é generativo. Degrada: se a geração falhar, mostra
uma trilha linear simples (não quebra o estudo).

## 1. Schema (Prisma/Mongo, `prisma db push`)
```prisma
model SkillTree {                         // 1 árvore por tópico (cache global, reusável)
  id String @id @default(auto()) @map("_id") @db.ObjectId
  topicSlug String @unique               // normalizado do tópico ("fotossintese")
  topicLabel String
  nodes Json                             // SkillNode[] (grafo gerado): {id,title,branch,level,prereqs[],summary}
  model String                           // modelo/versão que gerou (provenance)
  createdAt DateTime @default(now())
  @@map("skill_trees")
}
model SkillProgress {                     // progresso POR usuário e nó
  id String @id @default(auto()) @map("_id") @db.ObjectId
  userId String @db.ObjectId
  topicSlug String
  nodeId String
  mastery Float @default(0)              // 0..1
  status String @default("locked")       // locked|available|in_progress|mastered
  updatedAt DateTime @updatedAt
  @@unique([userId, topicSlug, nodeId])
  @@index([userId, topicSlug])
  @@map("skill_progress")
}
```
`SkillNode` (shape do JSON): `{ id, title, branch: "teoria"|"experimental"|"pratica", level: number, prereqs: string[], summary }`.

## 2. Geração (IA) — `lib/skilltree/generate.ts` + `POST /api/skilltree`
- `POST /api/skilltree { topic }` → normaliza `topicSlug`; se `SkillTree` existe, **retorna do cache**; senão gera:
  - `geminiJson` (Flash, temp 0.3) com system: "Monte uma árvore de habilidades para o tópico X — 8 a 14 nós, cobrindo **teoria, experimental e prático**, com pré-requisitos (grafo, não lista), do básico ao avançado. Responda JSON `{nodes:[{id,title,branch,level,prereqs,summary}]}`." Valida shape; grava `SkillTree`.
  - Falha/JSON inválido → fallback: trilha linear de 5 nós teoria (nunca 500).
- **Gate:** o mesmo tópico não regenera (cache por slug); grafo tem os 3 ramos e prereqs coerentes (sem ciclo).

## 3. Progresso / desbloqueio — `lib/skilltree/progress.ts`
- `masteryUpdate(userId, topicSlug, nodeId, delta)` — sobe `mastery`; quando um nó chega a `mastered` (limiar, ex. ≥0.8), os nós cujos `prereqs` estão todos `mastered` viram `available` (desbloqueio).
- Fonte de maestria: quiz/recall do mentor (o mentor chama `masteryUpdate` quando o aluno acerta), ou marcação manual "entendi". Espelha no `User.skills` (RPG) pra XP/rank.
- `GET /api/skilltree/progress?topic=` → nós + status/mastery do usuário.

## 4. Render — `components/study/SkillTreePanel.tsx` (React Flow)
- Adicionar dep `reactflow` (MIT). Painel anexado ao tópico na Sala de Estudos (aba/drawer, opt-in — não troca a tela; mantém ⟁ + liquid glass).
- Nós desenhados por `branch` (cor) e `level` (layout em camadas); **desbloqueados acendem** no gradiente `#8b5cf6→#22d3ee`, travados foscos. Clicar num nó → abre a conversa scopada naquele KP (manda pro chat) + mostra o `summary`.
- Estados: gerando ("montando sua árvore…"), pronto, degradado (lista linear).

## 5. Ciência pelo mentor (o loop)
- O `AgentContext` do harness passa a carregar a **posição do aluno na árvore** (nós mastered/available do tópico) → o mentor sabe onde você está e conduz pro próximo nó. Reusa a memória L3 (mastery por usuário).
- Guardrail pedagógico (do `human-skill-tree`): o mentor dá pista pra você dominar o nó, não a resposta — e sobe a maestria quando você demonstra.

## 6. Gate / DoD
- [ ] `prisma db push` (skill_trees + skill_progress).
- [ ] `POST /api/skilltree {topic}` gera grafo com 3 ramos, cacheia por slug, degrada em lista se falhar.
- [ ] `SkillTreePanel` renderiza a árvore na Sala de Estudos; nós acendem/travam por status.
- [ ] Dominar um nó (quiz/entendi) **desbloqueia** o próximo; progresso por usuário persiste.
- [ ] Mentor cita a posição do aluno na árvore (AgentContext). Transpila; `build web` ok.
- [ ] **Gancho pra PR Solana:** ao um nó virar `mastered`, disparar `issueCredential(userId, {type:"skill", topicSlug, nodeId})` (ver `PR_SOLANA_CREDENCIAIS.md`). Deixar o ponto de chamada pronto.

## 7. Fora de escopo / caveats
- Custo de geração: 1 chamada Gemini por tópico novo → cache resolve. Não gerar por usuário (só o progresso é por usuário).
- Layout automático do grafo: React Flow + um layout simples por `level`; layout "bonito" (dagre) é polimento.
- Demo do pitch: dá pra mostrar ao vivo — "estudar tópico → árvore nasce → domino um nó → desbloqueia → (PR Solana) credencial cunhada".
