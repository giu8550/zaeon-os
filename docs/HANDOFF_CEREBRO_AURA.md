# Handoff ÚNICO — Cérebro (mapa adaptativo) + Memória + AURA

> Fonte única desta frente. Substitui `HANDOFF_PR2_MAPA_PERCURSO_VALIDACAO.md`, `HANDOFF_AURA_GAMIFICACAO.md`
> e `HANDOFF_CEREBRO_SEMPRE_PLUGADO.md`. Economia AURA base: `HANDOFF_AURA_ECONOMIA.md` (PR #166).

## Estado (out/2026) — entregue em 4 PRs empilhadas
| PR | O quê | Flags | Arquivos-chave |
|---|---|---|---|
| A #174 | Grafo canônico (`MapaProbabilistico`) + **fonte única de memória** por turno; cartolina = projeção (`card.id === nó.id`) | `MAP_HARNESS` | `lib/map/{tipos,grafo,store,memoria-turno}.ts` |
| B #175 | Classificação por arquétipo (5 tipos) + backbone (percurso) + completudes + bússola adaptativa + `generateMap` | — | `lib/map/{arquetipo,backbone,generateMap}.ts` |
| C #176 | Gatekeeper (bolinha azul) + chain worker (fila `cerebro`) + painel ao vivo (Pusher `private-cerebro-<mapaId>` + poll) na aba Chat da Sala de Pesquisa; mobile = lista | `ESTUDO_GATEKEEPER`, `NEXT_PUBLIC_MAP_HARNESS` (build-arg) | `lib/map/{gatekeeper,queue,realtime,bolinha}.ts`, `components/cerebro/*`, `app/api/map/{route,generate,pusher-auth}` |
| E | **Memória viva** (§4 do handoff "cérebro ausente"): gavetas verbatim + closet + tLast por nó; arestas `percurso` (amarelo) × `memoria` (azul pulsante); consolidação associativa (A-MEM) + regiões/novas áreas; recuperação PPR × recência × importância na bússola (`recuperarMemoria`); ficha de gavetas no painel; painel com fade/Esc/clique-fora abaixo da barra de conversas; bolinha maior | — | `lib/map/memoria.ts`, `lib/map/grafo.ts` (drawers), `components/cerebro/*` |
| D | Validação humana (`MapaValidacao`) + atestado Solana (só `humana`) + AURA pesada por arquétipo × validação + perfil (cérebros, fila de validação) | `AURA_ECONOMY` | `lib/map/{validacao,validacao-server}.ts`, `lib/aura/rules.ts` (`auraDoNo`), `app/api/map/{[id],validacoes,validacao/[vId]}` |

**Ligar em prod (ordem):** `prisma db push` (aditivo; o deploy faz) → `MAP_HARNESS=1` → `ESTUDO_GATEKEEPER=1` →
Variable `NEXT_PUBLIC_MAP_HARNESS=1` + redeploy → `AURA_ECONOMY=1` (+ migração `scripts/aura-migrate-xp.mjs`).
Worker: o container com `SCHOLAR_WORKER=1` já sobe a fila `cerebro`; sem Redis a geração roda inline.

## 1. Modelo conceitual
- **Estudo = grafo = cérebro.** `scopeId` da conversa ↔ um `MapaProbabilistico` (nós + arestas) renderizado como nuvem de partículas.
- **O grafo é a FONTE ÚNICA de memória.** Cartolina/visor/artefatos são projeções. Um só ponto de escrita por turno: `lib/map/memoria-turno.fixarTurno` (grafo → projeção na cartolina). Com `MAP_HARNESS` off, a ponte antiga (cartolina direta) segue intacta.
- **Universalidade com adaptação:** o mapa de aprendizado vale pra qualquer tópico; o gate de conclusão e o atestado dependem do arquétipo (§4).

## 2. Quando o cérebro nasce
1. **Gatekeeper** (`lib/map/gatekeeper.ts`, fire-and-forget no `runChatTurn`): heurística (intenção, ≥2–3 turnos, conceito/artefato) + modelo só na zona cinzenta → `Conversation.estudavel/tituloSugerido`. Nunca gera grafo.
2. **Clique na bolinha** → `POST /api/map/generate` → fila `cerebro` (jobId `userId:scopeId`, idempotente) → `generateMap` → `Conversation.mapaId` → evento `gerado`.
3. **Pedido explícito** cai no mesmo caminho (score alto no gatekeeper).

## 3. Cérebro sempre plugado
Painel na aba **Chat** da Sala de Pesquisa unificada (`components/cerebro/CerebroPanel`), amarrado ao `scopeId` da conversa ativa (`ResearchChat` manda `agentContext.cartolinaScopeId`). Estados da bolinha: oculta · sugerida · gerando · ativa · vazia (`lib/map/bolinha.ts`). Reação ao vivo: `fixarTurno` publica `turno` no canal; sem Pusher, poll de 3s. Desktop = canvas (lazy, pausa fora de tela/aba); mobile = lista + barras + "você está aqui". Tap no nó → reabre a mensagem (`msgIds`).

## 4. Arquétipos (`lib/map/arquetipo.ts` = a tabela única)
| Arquétipo | Gate | Atestado on-chain | AURA (peso) |
|---|---|---|---|
| aplicavel | validação humana (`validado`) | sim | 1.0 |
| habilidade | rubrica (`aplicado`) | não | 0.9 × modo |
| conceitual | quiz (`aplicado`) | não | 0.75 × modo |
| exploratorio | cobertura (`aprendido`) | não | 0.5 × modo |
| criativo | feedback por critério | não | 0.35 × modo |
Pesos finais em `lib/aura/rules.ts` (`pesoAura`, `auraDoNo`, `daAtestado`).

## 5. Percurso, validação & atestado
Backbone = cadeia linear `pre_requisito` (normalizador puro em `lib/map/backbone.ts`); merge planejado × realizado em `fundirNoGrafo` (nó do plano que um turno realiza perde `planejado`; `realizados` paga `node_learned`). Duas barras: `completudes()`. Validação humana: `POST /api/map/:id/node/:noId/apply` (aluno, com evidência) → `MapaValidacao` pendente pro professor vinculado (`TeacherStudent`) → `POST /api/map/validacao/:vId` (aprova/rejeita; nunca o próprio, 403). Aprovar → `validado` + `node_validated` + `issueCredential` (type `skill`, `token2022-nt`) — mint falha não derruba. Backbone inteiro no gate → `brain_completed` 1×.

## 6. Memória chat ⇄ grafo (MemPalace sobre o grafo)
`runChatTurn` → `bussolaParaTurno(userId, scopeId, prompt)` (grafo + "o que falta" + **lembranças**: `recuperarMemoria` = PageRank personalizado semeado pela pergunta × recência (meia-vida 7d) × importância, k=4, só gavetas relevantes entram) e `fixarTurno` (cada nó tocado ganha uma **gaveta verbatim** `Aluno: … / Aura: …` + `closet` + `tLast`; consolidação associativa por sobreposição lexical; regiões por BFS a partir do percurso — nó sem alcance = "nova-area"). Sem LLM e sem embeddings (determinístico); semântica pode entrar depois como mais um sinal.

## 7. Fonte única — resolvido na PR-A
`card.id === nó.id` por construção (mesmo hash de conteúdo). Projeção preserva o card existente inteiro (posição, texto editado, desenho). Nada é removido pela projeção. Edição de card pelo aluno NÃO volta pro grafo (decisão: o grafo é a memória do agente; o texto do card é do aluno).

## 8–10. AURA, schema, rotas
Ver tabela de PRs. `GET /api/profile/aura` ganhou `cerebros[]` e `habilidadesValidadas[]`; `AuraCard` mostra cérebros (duas barras) e a fila "Validações de estudo" do professor.

## Pendências / não verificado
- Fluxo ponta a ponta logado (gatekeeper → bolinha → gerar → painel ao vivo → aplicar → validar) só em prod (chat 404 em dev; sem Redis/Pusher local).
- Instituição como validadora de cérebro usa aproximação (aluno com credencial acadêmica verificada dela).
- Edição de card → grafo (reverse projection) fora de escopo.
- `/viz-lab` (mock) pode ser removido quando a flag virar padrão.
