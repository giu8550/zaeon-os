# Árvore de Habilidades GENERATIVA por tópico

Skill tree que a IA gera para **cada tópico de estudo** — nós de teoria / experimental / prática com
pré-requisitos e desbloqueio por maestria, visível na Sala de Estudos e conhecida pelo mentor.
Roda **em cima do harness** (`lib/agent/*`); reusa `User.skills` (RPG) e o Studio.

## Princípio
- **Gerada por IA (Gemini Flash)** a partir do tópico e **cacheada por tópico** (`skill_trees`, chave = slug).
  Não é currículo hardcoded. 1 chamada por tópico novo; nunca gera por usuário.
- **Progresso por usuário** (`skill_progress`): maestria 0..1 e status por nó.
- **Degrada**: se a geração falhar, responde uma trilha linear de 5 nós de teoria (`degraded=true`,
  **não** cacheada — o próximo pedido tenta de novo). Nunca 500; o estudo não quebra.

## Schema (`prisma db push`)
- `SkillTree { topicSlug @unique, topicLabel, nodes Json, model, createdAt }` → `skill_trees`
- `SkillProgress { userId, topicSlug, nodeId, mastery, status, updatedAt }` → `skill_progress`
  (`@@unique([userId, topicSlug, nodeId])`).
- `SkillNode = { id, title, branch: "teoria"|"experimental"|"pratica", level, prereqs[], summary }`.

## Código
| Peça | Onde |
|---|---|
| Tipos, slug, limiar (`MASTERY_THRESHOLD = 0.8`) | `lib/skilltree/types.ts` |
| Geração + `sanitizeTree` (3 ramos, sem ciclo, prereq com level menor) + `fallbackTree` + cache | `lib/skilltree/generate.ts` |
| `computeStates` (locked/available/in_progress/mastered), `masteryUpdate` (desbloqueio, espelho RPG, credencial), `treeContextBlock` | `lib/skilltree/progress.ts` |
| Juiz de maestria (Flash) que o mentor usa após o turno | `lib/skilltree/assess.ts` |
| Gancho PR Solana `issueCredential(userId, {type:"skill", topicSlug, nodeId})` | `lib/skilltree/credential.ts` |
| `POST /api/skilltree { topic }` → árvore (cache ou gera) + status do usuário | `app/api/skilltree/route.ts` |
| `GET /api/skilltree/progress?topic=` · `POST { topic, nodeId, mastered:true \| delta }` | `app/api/skilltree/progress/route.ts` |
| Painel React Flow (drawer opt-in na aba Aura da Sala de Estudos) | `components/study/SkillTreePanel.tsx` |
| Botão “Árvore”, chip do nó em foco, `agentContext.skillTopic/skillNodeId` | `components/study/StudyCoworkChat.tsx` |
| Bloco da árvore no `systemContext` do harness + juiz pós-turno | `app/api/ai/chat/route.ts` |

## O loop (ciência pelo mentor)
1. O aluno abre a Árvore (botão no composer). O tópico nasce do estudo focado (ou é digitado).
2. Clicar num nó → “Estudar este nó”: o composer recebe o pedido e o chip do nó; a cada turno o
   cliente manda `agentContext.skillTopic` (slug) + `skillNodeId`.
3. O harness injeta `treeContextBlock` no `systemContext`: dominados / disponíveis / nó em foco +
   **guardrail pedagógico** (pistas, não a resposta; reconhecer quando o aluno demonstra).
4. Após a resposta, `assessAndUpdate` (Flash, best-effort) pontua a MENSAGEM do aluno; score ≥0.7
   dá +0.5 de maestria (duas boas demonstrações dominam o nó), 0.4–0.7 dá +0.25, abaixo nada.
   Perguntas curtas (< 6 palavras) não são julgadas.
5. Ao cruzar 0.8: nó `mastered` → filhos com todos os prereqs dominados viram `available`;
   `User.skills.mastery` (rank F→SS por nós dominados) e `xp` (+25) sobem; `issueCredential` dispara.
6. “Entendi” no painel = maestria manual (1.0) — mesmo caminho. Nó `locked` não sobe (409).

## Custos / caveats
- 1 geração Gemini por tópico novo (cache por slug). O juiz roda só com nó em foco E mensagem ≥ 6 palavras.
- Layout: camadas por `level` (simples). Dagre/“bonito” é polimento futuro.
- `prisma db push` já roda no deploy (ver `deploy.yml`); em dev: `npx prisma db push`.
