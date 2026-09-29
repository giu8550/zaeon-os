# Plano — Mapa Probabilístico (cérebro virtual) + Harness das Salas + Lounge

> **Modo de leitura:** TDAH-friendly. Cada PR é uma ilha independente, com objetivo em 1
> linha, escopo do que ENTRA e do que NÃO ENTRA, passos curtos e critério de aceite.
> **Regra de ouro:** entregar hoje. Cada PR tem um **MVP mínimo** (o que fecha a entrega)
> separado do **nice-to-have** (fica pra depois sem dó).
>
> **Ordem de execução:** PR0 (spike visual) → PR1 (data-viz só forma/beleza) → PR2 (harness
> liga memória+mapa) → PR3 (TCC cross-sala) → PR4 (mobile) → PR5 (lounge imersivo).
>
> **Fontes de repositório:** o dono cola os links de exemplo em cada bloco `FONTES:` — o
> agente usa como referência de implementação, não copia cego.

---

## 0. Modelo conceitual compartilhado (leia antes de qualquer PR)

Vocabulário único pra todas as PRs não divergirem.

- **Mapa Probabilístico** = um grafo visual em forma de **cérebro** que representa o
  caminho de um estudo/pesquisa. Fica **ao lado** de cada estudo/pesquisa.
- **Nó (região do cérebro)** = uma unidade de conhecimento. Tipos de nó:
  `conceito · ação · tema · conhecimento · experimento · comprovação`.
- **Aresta (ligação)** = relação entre nós (pré-requisito, deriva-de, aplica-em…).
- **Cor** = domínio/estado do nó (ex.: azul = teoria, verde = aplicado, âmbar = em
  progresso, cinza = ainda não tocado). Preencher o cérebro = aprender/aplicar.
- **Estado de completude** = quanto do mapa está "aceso". É a **métrica de progresso** da
  sessão. Aprender um tema = completar visualmente o mapa daquele tema.
- **Memória do mapa** = a conversa daquele estudo fica **guardada dentro da região** do
  mapa correspondente (cada nó carrega as mensagens/artefatos que o preencheram).
- **Camada de papel (role)** = `student | teacher | researcher`. Não muda ONDE o
  conhecimento é buscado; muda o **objetivo final**: aplicar o conhecimento (na aula, no
  TCC, no palco). O agente é o "primeiro da cadeia" que leva até a aplicação.
- **Bússola** = o agente e o aluno olham o MESMO mapa. O agente sabe onde o aluno está e
  onde precisa chegar → conduz o próximo passo em vez de responder avulso.
- **Empírico** = o harness lê o mapa e mede "quanto falta pra aplicar de verdade" — não só
  visual, mas uma leitura que entra na decisão do agente.
- **Universalidade** = funciona pra qualquer assunto (música, direito, biologia). A IA se
  relaciona SÓ com aquele mapa/contexto.
- **Entrelace Estudos ⇄ Pesquisa** = só acontece quando o aluno aperta "gerar pesquisa"
  dentro da Sala de Estudos. Aí um chat passa a alimentar o outro (isso é a **PR3**).

**Contrato de dados do mapa (rascunho, refinado na PR2):**
```ts
type NoTipo = "conceito" | "acao" | "tema" | "conhecimento" | "experimento" | "comprovacao";
type NoEstado = "nao_tocado" | "em_progresso" | "aprendido" | "aplicado";
interface MapaNo { id; label; tipo: NoTipo; estado: NoEstado; cor; regiaoCerebral; peso; msgIds: string[]; }
interface MapaAresta { de; para; relacao: "pre_requisito"|"deriva"|"aplica"|"relaciona"; }
interface MapaProbabilistico { id; ownerId; surface: "estudos"|"pesquisa"; scopeId; objetivo; role; nos: MapaNo[]; arestas: MapaAresta[]; completude: number; }
```

**Onde isto encaixa no que já existe:** reusar a infra de background da fase 1/2
(`lib/queue/*`, `instrumentation.ts`, `StudioArtifact`/`ScholarSession`), o harness
(`lib/agent/trajectory.ts`, `buildHarnessDeps`), o Studio (`/api/studio/*`) e o handoff
mobile já escrito (`docs/AGENTE_FASE3_CHAT_RETOMAVEL_E_MOBILE.md`).

---

## PR 0 — Spike: "desenhar qualquer assunto" no harness (foco mobile)

**Objetivo:** hoje o harness só gera **molécula** (química, via PubChem). Generalizar para
um agente que **desenha na tela qualquer assunto** relacionado à pergunta; quando não
souber desenhar, cai num **card com imagem** relacionada. É o experimento que prova que
"arte + código" viram visual útil no chat. **Sem data engineering.**

**Por quê primeiro:** é pequeno, isolado, e valida a estética/o pipeline visual que as
PRs 1–5 vão reusar.

**Escopo — ENTRA:**
- Novo "studio kind" `sketch` (desenho vetorial genérico) no mesmo padrão do `molecule`.
- Geração: LLM produz um **SVG semântico** (ou um JSON de primitivas → SVG) do assunto —
  diagramas simples, esquemas, ícones conceituais. Nada de 3D.
- Fallback: se o modelo não conseguir um SVG bom (heurística de validação), gera/anexa uma
  **imagem** (reusa `/api/studio/image`) num **card** com legenda.
- Render mobile-first: `StudioBlock` ganha um caso `sketch` (SVG responsivo, largura total).

**Escopo — NÃO ENTRA:** mapa/cérebro, memória, realtime, edição de TCC. É só "desenhar 1
coisa".

**Arquivos:**
- `lib/studio/sketch.ts` — `gerarSketch(topic): {svg} | {precisaImagem:true, promptImagem}`.
- `app/api/studio/sketch/route.ts` — espelha `molecule/route.ts` (fire-and-forget + status).
- `components/studio/StudioBlock.tsx` — render do `sketch` + card de imagem fallback.
- `components/study/StudyCoworkChat.tsx` — `runStudioAction("sketch", ...)` (poll já existe).
- Prompt do harness (`lib/agent/*` / `lib/ai/personas`) — ensinar a Aura a chamar `sketch`
  quando "desenhar/ilustrar/esquematizar" ajudar a resposta.

**Passos (curtos):**
1. Definir o mini-DSL do SVG (lista de primitivas seguras: retângulo, círculo, seta,
   rótulo, grupo, cor). Validador que rejeita SVG inseguro/quebrado.
2. `gerarSketch()` chama o LLM (JSON estrito) → valida → devolve SVG ou pede imagem.
3. Rota + kind no client + render no `StudioBlock`.
4. Ensinar o harness a acionar (1 exemplo no prompt).

**Testes (vitest):** validador de SVG (aceita bom, rejeita ruído/`<script>`); `gerarSketch`
com LLM mockado (caminho SVG e caminho fallback-imagem); contrato da rota (auth, status).
Cobertura ≥80% nos arquivos novos.

**Critério de aceite:** no chat (desktop e mobile), pedir "desenhe o ciclo da água" mostra
um SVG limpo; pedir algo não-desenhável mostra um card com imagem + legenda; nada quebra
se o LLM falhar (card de erro amigável).

**Flag:** `SKETCH_ENABLED` (default on em dev, off em prod até validar).
**Risco:** LLM gerar SVG feio/inválido → mitigar com validador + fallback imagem.
**FONTES:** _(cole aqui repos de "text-to-SVG", diagram-as-code, generative SVG)_

---

## PR 1 — Data-viz: arte + código (SÓ forma e beleza, zero data engineering)

**Objetivo:** aprender e montar a **linguagem visual** do cérebro/mapa — o "como desenhar
dados bonitos na tela". Entregar **componentes visuais reutilizáveis** com dados **fake/mock**.

**Por quê:** separar beleza de dados. Primeiro a forma fica linda e performática; só depois
(PR2) ligamos dados/memória reais.

**Escopo — ENTRA:**
- `components/viz/BrainMap.tsx` — o cérebro como grafo/canvas: nós coloridos por região,
  arestas, brilho/glow, animação de "preenchimento" (nó acende), pan/zoom, hover/tap.
- Paleta e tokens visuais (`lib/viz/theme.ts`): cores por tipo/estado, efeitos (glow,
  gradiente, blur), respeitando claro/escuro e o glossy-blue da casa.
- Playground `app/viz-lab/page.tsx` (dev-only, atrás de flag) com dados MOCK pra iterar a
  estética.
- Escolha da tecnologia de render: **Canvas 2D** ou **SVG** (para grafos médios) e/ou
  `three.js` (já disponível) só se o cérebro 3D valer a pena — decidir no PR e documentar.

**Escopo — NÃO ENTRA:** ligação com harness, memória, dados reais, persistência. Tudo mock.

**Arquivos:** `components/viz/BrainMap.tsx`, `components/viz/nodes/*`, `lib/viz/theme.ts`,
`lib/viz/layout.ts` (posicionamento dos nós — força/anatômico), `app/viz-lab/page.tsx`.

**Passos:**
1. Definir o alvo visual (referência do dono) + escolher Canvas vs SVG vs 3D.
2. Layout dos nós (força dirigida OU mapa anatômico fixo do cérebro).
3. Estados/cores/efeitos (acender, pulsar, completar) — puramente visual.
4. Interações: pan, zoom, tap/hover mostra rótulo; mobile-first (gesto de pinça).
5. Playground com botões pra simular "completar X%".

**Testes:** `lib/viz/layout.test.ts` (determinístico: mesmos nós → mesmas posições);
`lib/viz/theme.test.ts` (mapeia tipo/estado→cor certo). UI: BrainMap renderiza N nós/arestas
mock sem erro; snapshot leve. Perf: 200 nós a 60fps no desktop, degradar suave no mobile.

**Critério de aceite:** abrir `/viz-lab`, ver um cérebro bonito com nós/ligações mock,
completar % anima o preenchimento, funciona no toque. Nenhuma dependência de dados reais.

**Flag:** `NEXT_PUBLIC_VIZ_LAB` (dev).
**Risco:** performance com muitos nós → começar com Canvas + culling; teto de nós visíveis.
**FONTES:** _(cole repos de generative art, força-dirigida, canvas/particles, shaders)_

---

## PR 2 — Harness ⇄ Mapa: memória + visualização (o "cérebro que pensa")

**Objetivo:** ligar o mapa (PR1) à **memória** e ao **harness**. O mapa vira a **bússola**:
o agente e o aluno olham o mesmo mapa; o agente sabe onde o aluno está e aonde chegar; cada
conversa preenche uma região; a completude é medida e usada nas decisões do agente.

**Escopo — ENTRA:**
- Modelo `MapaProbabilistico` no Prisma (contrato da seção 0), por `surface+scopeId`.
- **Worker generativo do mapa** (reusa BullMQ): a partir do objetivo do estudo/pesquisa,
  gera o mapa inicial (nós/arestas/regiões) → o "onde chegar". Roda em background.
- **Harness lê e escreve o mapa:** `buildHarnessDeps` recebe o mapa; a cada turno o agente
  (a) sabe a completude, (b) escolhe o próximo nó, (c) marca nós como
  `em_progresso/aprendido/aplicado` e vincula `msgIds` à região.
- **Camada empírica:** função `quantoFaltaAplicar(mapa, role)` → o agente usa pra decidir o
  próximo passo (ex.: "faltam 2 comprovações e 1 experimento pra aplicar").
- **Universalidade + role:** o gerador entende qualquer assunto (música incluída) e ajusta o
  objetivo pelo papel (student/teacher/researcher).
- **UI:** o `BrainMap` (PR1) agora ao lado de cada estudo/pesquisa, com dados REAIS; tap num
  nó abre as mensagens/artefatos guardados ali.

**Escopo — NÃO ENTRA:** edição de TCC cross-sala (PR3), mobile (PR4), realtime (PR5).

**Arquivos:** `prisma/schema.prisma` (+db push), `lib/map/generateMap.ts`,
`lib/map/scoring.ts` (`quantoFaltaAplicar`/`completude`), `lib/queue/map.ts`,
`instrumentation.ts` (worker do mapa), `lib/agent/*` (injeção do mapa no harness),
`app/api/map/*` (get/patch do mapa), integração no `BrainMap`.

**Passos:**
1. Schema + geração inicial do mapa (worker) a partir do objetivo.
2. `scoring.ts` puro (completude, faltas por tipo) — 100% testável.
3. Harness lê o mapa no contexto e escreve updates ao fim do turno (nó/estado/msgIds).
4. UI liga dados reais; tap-no-nó mostra a conversa daquela região.
5. Persistência da conversa POR região (memória do mapa).

**Testes:** `scoring.test.ts` (completude, faltas, casos vazios) — cobertura alta;
`generateMap` com LLM mockado (assunto científico E música → mapas coerentes);
harness-update (dado um turno, marca o nó certo); contrato das rotas (IDOR/role).

**Critério de aceite:** criar um estudo "aprender harmonia musical" gera um mapa; conversar
acende regiões; a barra de completude sobe; o agente cita o que falta pra aplicar; recarregar
mantém tudo (memória por região).

**Flag:** `MAP_HARNESS` (off por default).
**Risco:** o LLM produzir mapas inconsistentes → validar/normalizar o grafo; scoring puro e
determinístico fora do LLM.
**FONTES:** _(cole repos de knowledge-graph, skill-tree, spaced-repetition/mastery models)_

---

## PR 3 — TCC cross-sala: o agente de Estudos edita a Pesquisa

**Objetivo:** quando o aluno aperta "gerar pesquisa" na Sala de Estudos, um chat passa a
**alimentar o outro**: o agente conversa os tópicos na Sala de Estudos e vai **editando o
trabalho (TCC) na Sala de Pesquisa** em paralelo — tornando a edição manual **opcional**.
"Um chat só que resolve a dor do outro."

**Escopo — ENTRA:**
- Gatilho: botão "gerar pesquisa" no chat de Estudos cria/liga um `scopeId` de pesquisa ao
  mapa do estudo (entrelace só aqui, como você definiu).
- Ponte de estado: o turno do agente de Estudos emite "edições" estruturadas que aplicam ao
  documento de pesquisa (usar o pipeline/documento da Sala de Pesquisa existente).
- Reflexo visual: as edições aparecem na Sala de Pesquisa em tempo (poll ou realtime leve) e
  acendem as regiões do mapa correspondentes.

**Escopo — NÃO ENTRA:** co-edição multiusuário (isso é PR5); mobile (PR4).

**Arquivos:** botão/gatilho em `StudyCoworkChat`, `lib/map/link.ts` (liga estudo↔pesquisa),
handler de "edições do documento" no lado da pesquisa, reuso do harness da PR2.

**Passos:** 1) gatilho + vínculo de scope; 2) formato de "edição" que o agente emite; 3)
aplicação no doc de pesquisa; 4) reflexo no mapa; 5) opção de aceitar/desfazer edição.

**Testes:** vínculo estudo↔pesquisa; aplicação de edição (dado um patch, o doc muda);
idempotência; o mapa reflete. Cobertura ≥80% no núcleo.

**Critério de aceite:** conversar na Sala de Estudos escreve o TCC na Sala de Pesquisa
sozinho; o aluno pode ignorar a edição manual; tudo rastreável no mapa.

**Flag:** `CROSS_ROOM_TCC` (off).
**Risco:** edições destrutivas → sempre diffs reversíveis + confirmação opcional.
**FONTES:** _(cole repos de colaborative doc editing / operational-transform / patches)_

---

## PR 4 — Mobile de tudo isso

**Objetivo:** modelar mapa + salas + geração visual pro celular (segue o handoff já escrito
em `docs/AGENTE_FASE3_CHAT_RETOMAVEL_E_MOBILE.md`, agora incluindo o `BrainMap`).

**Escopo — ENTRA:** `BrainMap` em modo mobile (tela cheia deslizável, tap-nó → sheet com a
conversa da região), chat de coluna única (Estudos/Pesquisa), geração visual (PR0) e
artefatos simplificados. Reusa os hooks de rede da PR mobile.

**Escopo — NÃO ENTRA:** lounge (PR5).

**Testes/aceite/flags:** herdam o padrão-ouro do handoff mobile (cobertura, a11y, perf,
`NEXT_PUBLIC_MOBILE_UI`). Aceite: no celular dá pra estudar, ver o mapa acender e gerar
documento sem se perder.
**FONTES:** _(cole repos de mobile canvas/gesture, PWA)_

---

## PR 5 — Lounge imersivo (co-working generativo em grupo)

**Objetivo:** um espaço de co-working **visualmente apelativo**: canvas + generativo, foco
em trabalho e dinâmica de grupo. Alunos veem os **mesmos dados em tempo real**, conversam
sobre eles, e veem os **comentários um do outro na tela** — tudo conceituado artisticamente.

**Escopo — ENTRA:** sala compartilhada com o `BrainMap`/canvas sincronizado (realtime),
cursores/comentários dos participantes, chat da sala, estética generativa (partículas/arte).

**Escopo — NÃO ENTRA:** nada além de grupo+realtime+arte; sem novas features de aprendizado.

**Arquivos/infra:** realtime (Pusher já no projeto, ou socket), `app/study-rooms/lounge/*`,
canvas compartilhado, presença/cursores/comentários.

**Passos:** 1) presença + sync do canvas; 2) comentários ancorados a nós/pontos; 3) chat da
sala; 4) camada artística; 5) permissões (quem edita/vê).

**Testes:** merge de estado concorrente; presença entra/sai; comentário ancora certo.
**Critério de aceite:** 2+ pessoas veem o mesmo mapa mudando ao vivo, comentam e conversam.
**Flag:** `LOUNGE_REALTIME` (off).
**Risco:** conflito de estado multiusuário → começar com "quem edita por vez" simples.
**FONTES:** _(cole repos de realtime canvas/multiplayer/CRDT/liveblocks-like)_

---

## Sequência, cortes e "não passar de hoje"

- **Caminho crítico p/ entregar valor visível rápido:** PR0 → PR1 → PR2. Essas três já dão
  "cérebro que acende conforme você aprende, com o agente de bússola". PR3/4/5 são camadas.
- **Cada PR entrega sozinha** (atrás de flag) — dá pra parar em qualquer ponto e ainda ter
  algo íntegro em prod.
- **Padrão-ouro em todas:** vitest com cobertura ≥80% nos arquivos novos, `tsc --noEmit`
  limpo, auth por sessão + rate-limit, flag off por default, sem segredo em log, docs
  atualizados. Reusar SEMPRE a infra de fila/worker já existente (não criar outra).
- **Créditos baixos:** priorizar núcleos PUROS e testáveis (validador SVG, `scoring.ts`,
  `layout.ts`) que um agente fecha rápido e com confiança; deixar o LLM sempre mockado nos
  testes.

## Onde o dono cola as fontes
Cada PR tem um bloco `FONTES:`. Cole os links lá; o agente lê como referência de
implementação (estilo/estrutura), nunca copia cego, e credita no PR.
