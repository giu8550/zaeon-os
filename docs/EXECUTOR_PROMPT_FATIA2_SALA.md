# PROMPT DE EXECUÇÃO — Claude Code (Opus) · Escritório Zaeon · **Fatia 2 · A sala aguenta**

> **Você é o EXECUTOR.** Todo o projeto já foi decidido, pesquisado e contratado em código.
> Você NÃO redesenha, NÃO reabre decisão, NÃO re-deriva tipo, NÃO explora o repo além das
> âncoras dadas. Você integra, verifica e **para em cada gate**. Co-autorado pelo Fable em
> 2026-10-07 a partir de `docs/HANDOFF_ESCRITORIO_AGENTES_V2.md` (§4 C3/C12, §5 camada 1, §7, §8)
> + `docs/PROSPECCAO_AGENTES_AUTONOMOS.md` (PR-S1 `:1062`, PR-S2 `:1084`, PR-S7 `:1176`).
>
> **Esta fatia = 3 PRs: S1 (threads) → S2 (histórico + leitura) → S7 (lock).** Ela nasce os
> contratos **C3** (thread) e **C12** (lock distribuído). **É pré-requisito, não melhoria**
> (handoff §6): sem thread e sem lock, comitê (A6) e proatividade (P*) produzem uma sala ilegível.
> S7 não depende de S1/S2 — pode andar em paralelo se houver duas mãos. **Toda âncora
> `arquivo:linha` abaixo foi verificada em `origin/main` = `5d3971d` (2026-10-07).**
> Não depende da Fatia 1 (nada aqui toca gateway ou ledger).

---

## 0. Leia antes de codar (só isto, nesta ordem)

1. `docs/HANDOFF_ESCRITORIO_AGENTES_V2.md` — §3.1 **leis 2 e 3** (debate vive em thread; consulta a colega é fechada — a S1 é o chão delas), §4 (**C3**, **C12** — você os cria; não toque nos outros), §5 "CAMADA 1", §7, §8.
2. `docs/PROSPECCAO_AGENTES_AUTONOMOS.md` — só PR-S1 (`:1062-1083`), PR-S2 (`:1084-1104`), PR-S7 (`:1176-1189`).
3. `docs/HANDOFF_ESCRITORIO_COWORKING.md` — a sala atual: canal, `@mention`, turno, Pusher, não-lidas (estado local), fila `canal-turnos`.

## 1. Guardrails invioláveis (violar = PR rejeitado)

- **Flag off por padrão; merge não muda comportamento.** `CANAL_THREADS=""` → `parentId` recusado (400 declarado, nunca descartado em silêncio) e a UI não mostra nada de thread. `CANAL_LOCK_REDIS=""` → `emSerie` continua o `Map` por processo de hoje. S2 **não tem flag** (handoff §7 não define): paginação devolve os mesmos 60 na 1ª página; leitura persistida é aditiva e só muda o que a UI mostra quando existe linha.
- **A UI descobre capacidade pelo servidor, não por `NEXT_PUBLIC_*`.** `GET /api/canal/[id]` passa a devolver `recursos: { threads: boolean, leitura: true, lock: "redis" | "processo" }`; o cliente liga afordâncias por isso. Zero build-arg novo nesta fatia (lição do handoff §7).
- **Profundidade de thread = 1.** Responder a uma resposta = responder ao pai (o cliente manda `parentId` do **root**; o servidor recusa `parentId` que aponte para mensagem que já tem `parentId`).
- **Mensagem de agente convocada numa thread responde NA thread** (lei 2) — nunca no fio. Contexto do turno = a thread (root + respostas), não as últimas 30 do fio.
- **Author gate em toda rota nova** (`podeLer`/`podeEscrever`/`podeGerir` de `lib/canal/gate.ts`), com teste IDOR A/B/C como `app/api/canal/[id]/mensagem/route.test.ts` já faz.
- **Nunca `take` sem teto; nunca `skip` numérico.** Cursor sempre `createdAt + id` (empate de `createdAt` existe).
- **Lock: lease com TTL + renovação + release por token** (compare-and-delete). Nunca `DEL` cego. Fila de espera por canal com **teto 3**: o 4º é recusado com erro próprio, não empilhado.
- **Erros via `messageForError`** (`lib/agent/errors.ts`) no que chega ao usuário; adicione as chaves que faltarem lá, nunca string à mão na rota.
- **Vidro claro === escuro** (`lib/canal/vidro.ts`), alvos ≥ 44px, mobile = drawer. UI aditiva: a lista de mensagens, o input e o autocomplete de `@` **não** são reescritos — o painel de thread **reusa** `Bolha` e o composer existentes.
- **Verificação:** `npx tsc --noEmit` limpo + `npx vitest run` verde por PR (CI `build-test`). `npx prisma generate` só com schema novo; `npx prisma db push`. **Nunca `next build` no loop.**
- **1 PR por passo**, branch `escritorio/fatia2-<passo>-<slug>`, ≤ ~8 arquivos, descrição citando o contrato (C3/C12) e a flag.

## 2. Importe, não reescreva (símbolo existente = import)

| O que | Onde (verificado) |
|---|---|
| Model da mensagem | `prisma/schema.prisma` `model CanalMensagem` (`canalId`, `autorTipo`, `autorId`, `texto`, `mencoes :1082`, `createdAt :1083`, `@@index([canalId, createdAt]) :1085`) |
| Detalhe do canal (o `take: 60`) | `app/api/canal/[id]/route.ts` — `GET :12`, `findMany … take: 60 :22`, `reverse() :25`, `mensagens: msgs.map(paraWire) :30`; `PATCH :36`, `DELETE :65` |
| Enviar mensagem | `app/api/canal/[id]/mensagem/route.ts` — `MAX_TEXTO :15`, `POST :17`, `texto :27`, `parseMentions :32`, `create :34`, `publicarPusher :44`, `dispararTurnos :46` · teste IDOR em `route.test.ts` ao lado |
| Fio (eventos + tipo) | `lib/canal/wire.ts` — `EV_MENSAGEM :5`, `EV_DIGITANDO :6`, `MensagemWire :16-25` |
| Helpers server | `lib/canal/server.ts` — `sessaoUsuario`, `exigirFlag`, `isObjectId`, `agentesDoCanal`, `pessoas`, `paraWire`, `agentesPublicos` |
| Gate | `lib/canal/gate.ts` — `podeLer`, `podeEscrever`, `podeGerir` |
| Turno do agente | `lib/canal/agent-turn.ts` — `N_CONTEXTO = 30 :19`, `TurnoPrisma.canalMensagem.findMany :38`, `executarTurno`, `montarObjetivo`, `montarHistorico`, mensagem **efêmera** (`efemera:true`) |
| Fila + serialização | `lib/canal/queue.ts` — `emSerie :10,56,82`, `CanalTurnoJob`, `dispararTurnos`, `iniciarWorkerCanal` · `lib/canal/serial.ts` — `filas Map :7`, `emSerie :9`, `emAndamento :19` · testes `serial.test.ts`, `queue.test.ts` |
| Redis TCP (ioredis) | `lib/queue/scholar.ts` — `getRedisConnection() :33` (`REDIS_URL`, `maxRetriesPerRequest: null`) — **é este, não `src/lib/redis.ts` (Upstash REST)** |
| Não-lidas (estado local hoje) | `components/office/CoworkingCanal.tsx` (448 linhas) — `naoLidas :35`, `carregarDetalhe :86` (zera `:95`), `totalNaoLidas :101`, `badgeTitulo :102`, zera ao ficar visível `:103`, `subscribe :116`, `bind(EV_MENSAGEM) :117`, `aoChegar :145` (incrementa `:153`), autoscroll `fimRef :164`, `enviar :197`, badge no seletor `:281`, lista `det.mensagens.map(Bolha) :349`, `fimRef :361`, `function Bolha :426` |
| Regras puras de notificação | `lib/canal/notificacoes.ts` — `prioridadeDe :29`, `deveNotificar :41`, `contaNaoLida :47`, `tituloComBadge :50` · DOM em `components/office/useNotificacoesSO.ts` (`badgeTitulo :36`, `notificar :44`) |
| Lista de canais | `app/api/canal/route.ts` — `GET findMany :16` (devolve `canais` + `souDono :21`) |
| Reaper (molde de varredura) | `lib/queue/reaper.ts` — `reapStuckJobs :21` |

## 3. Os dois contratos que esta fatia CRIA (texto final — copie, não reinterprete)

### C3 · Thread

```prisma
// prisma/schema.prisma — model CanalMensagem (campos novos; os atuais ficam)
  parentId         String?   @db.ObjectId   // null = fio principal; preenchido = resposta (profundidade 1)
  respostas        Int       @default(0)    // só no root: nº de respostas
  ultimaRespostaEm DateTime?                // só no root
  @@index([parentId, createdAt])
```
```ts
// lib/canal/wire.ts — MensagemWire ganha (aditivo)
  parentId: string | null;
  respostas?: number;                // root
  ultimaRespostaEm?: string | null;  // root
// EV_DIGITANDO payload ganha `parentId: string | null` (o "está escrevendo…" aparece na thread certa)
```
Regras: (1) `POST /api/canal/[id]/mensagem { texto, parentId? }` — `parentId` só com `CANAL_THREADS=1`; o pai tem que existir **no mesmo canal** e ter `parentId == null` (senão 400 `thread_profundidade`); ao criar a resposta, `update` do root `{ respostas: {increment:1}, ultimaRespostaEm: now }`. (2) `GET /api/canal/[id]` devolve **só o fio** (`parentId: null`). (3) `GET /api/canal/[id]/thread/[msgId]?antes=<cursor>` devolve `{ root: MensagemWire, respostas: MensagemWire[], cursorAnterior }` (asc, `take 50`). (4) `@mention` numa resposta convoca o agente **na thread**: `CanalTurnoJob` ganha `parentId: string | null`, e `executarTurno` grava a resposta do agente com o mesmo `parentId` e monta o contexto a partir da thread. (5) Pusher: resposta vai pelo mesmo `EV_MENSAGEM`, com `parentId` preenchido — o cliente roteia para o painel, não para o fio, e incrementa `respostas` do root na tela.

### C12 · Lock distribuído de turno

```ts
// lib/canal/serial.ts — a assinatura pública NÃO muda
export function emSerie<T>(chave: string, fn: () => Promise<T>): Promise<T>;
export class OcupadoError extends Error { readonly code = "canal_ocupado"; }
// implementação escolhida por ambiente:
//   CANAL_LOCK_REDIS=1 + REDIS_URL  → lease no Redis: key `canal:<id>:turno`, SET NX PX <ttl>, token aleatório,
//                                      renovação a cada ttl/3 enquanto fn roda, release por Lua compare-and-del
//   senão                            → Map<string, Promise> por processo (o de hoje)
// nos DOIS modos: fila de espera por chave com teto 3 → o 4º recebe OcupadoError na hora (não empilha)
export const emAndamento: () => number;        // já existe
export function __setRedisForTest(client: RedisLike | null): void; // injeção p/ teste
```
`RedisLike` = `{ set(key, val, "PX", ttl, "NX"): Promise<"OK"|null>; pexpire(key, ttl): Promise<number>; eval(script, 1, key, token): Promise<number> }` (subset do ioredis). `ttl` = `CANAL_LOCK_TTL_MS` (default 90_000). Quem chama (`queue.ts :56,82`) não muda uma linha; a rota de mensagem passa a tratar `OcupadoError` → 429 com `messageForError("canal_ocupado")` ("a sala está ocupada — tenta de novo em instantes").

## 4. OS PASSOS (ordem executável; pare e reporte 1 linha em cada gate)

### PASSO 1 — PR-S1 · Threads (nasce C3)
Branch `escritorio/fatia2-s1-threads`. Flag `CANAL_THREADS` (server; `lib/canal/flags.ts` ganha `canalThreads()`).
1. **Schema** (bloco da §3) → `generate` + `db push`. `lib/canal/wire.ts`: campos novos do `MensagemWire` + `parentId` no payload de `EV_DIGITANDO`. `lib/canal/server.ts` `paraWire`: preenche `parentId`, `respostas`, `ultimaRespostaEm`.
2. **Rotas:** `mensagem/route.ts` — aceitar `parentId` (regras (1) da §3; `isObjectId`; pai no mesmo canal; profundidade 1; flag off → 400 `threads_desligadas`), gravar, `update` do root, publicar com `parentId`, passar `parentId` em cada job de `dispararTurnos`. `[id]/route.ts` — `where: { canalId, parentId: null }` e `recursos: { threads: canalThreads(), leitura: false, lock: "processo" }` (S2/S7 atualizam). **Nova** `app/api/canal/[id]/thread/[msgId]/route.ts` — `GET` com `podeLer`, root tem que ser do canal e `parentId == null`; cursor `antes` (formato da S2: `${createdAt.toISOString()}_${id}`; nesta PR só o `take: 50` asc — a S2 fecha a paginação).
3. **Turno na thread** (`lib/canal/agent-turn.ts`): `TurnoInput.parentId?: string | null`; se preenchido, o contexto é **root + respostas da thread** (`findMany({ where: { OR: [{ id: parentId }, { parentId }] } , orderBy asc, take N_CONTEXTO })`) em vez das últimas 30 do fio; a resposta do agente é criada com `parentId` e o root recebe `respostas +1`; `EV_DIGITANDO` e `EV_MENSAGEM` saem com `parentId`. `montarObjetivo` passa a aceitar a mensagem convocadora da thread. `lib/canal/queue.ts`: `CanalTurnoJob.parentId`, `jobIdDe` **não muda** (mensagemId já é único).
4. **UI** (`CoworkingCanal.tsx` + novo `components/office/ThreadPanel.tsx`): na `Bolha` do fio, rodapé **"💬 n respostas · ver thread"** (ou "responder em thread" quando `respostas === 0`), só quando `det.recursos.threads`. Painel à direita no `lg` (coluna de ~380px dentro do mesmo painel de vidro) e **drawer** de baixo no mobile; carrega `GET …/thread/[root]`, lista com a **mesma `Bolha`**, composer **reusando** o mesmo autocomplete de `@` (extraia o bloco do input + sugestões para `components/office/Composer.tsx` sem mudar lógica e use nos dois lugares), `POST` com `parentId`. `aoChegar :145`: se `m.parentId` → entra no painel se for a thread aberta, incrementa `respostas` do root no `det.mensagens`, e **conta como não-lida do canal** sem criar vocabulário novo. `digitando` por thread (`parentId` do evento).
5. **Erros:** `lib/agent/errors.ts` ganha `thread_profundidade` ("Responda direto na conversa principal — a thread só tem um nível.") e `threads_desligadas`.
6. **Testes:** `mensagem/route.test.ts` (casos novos: `parentId` com flag off → 400; pai de outro canal → 404; pai com `parentId` → 400; resposta válida → root `respostas +1` e evento com `parentId`; `@aura` na resposta → job com `parentId`); `thread/[msgId]/route.test.ts` (IDOR A/B/C; root inválido 404); `agent-turn.test.ts` (turno com `parentId`: contexto = thread, resposta gravada com `parentId`, `EV_DIGITANDO` com `parentId`); `[id]/route.test.ts` (fio não traz respostas).
**Gate S1:** com a flag on, **20 respostas** numa thread (10 humanas + 10 de agente via `@`) deixam o fio exatamente como estava (**+0 linhas**; o root mostra "20 respostas"); com a flag off, `parentId` é recusado com a mensagem do catálogo e a sala é idêntica a hoje; `tsc`+`vitest` verdes. **Reporte:** `PASSO 1: verde/vermelho + contagem do fio antes/depois`.

### PASSO 2 — PR-S2 · Histórico paginado + leitura persistida
Branch `escritorio/fatia2-s2-historico-leitura`. Sem flag (ver §1).
1. **`lib/canal/historico.ts`** (PURO): `cursorDe(m: {createdAt, id})` → `"<iso>_<id>"`, `parseCursor(s)` → `{createdAt, id} | null`, `whereAntes(cursor)` → `{ OR: [{ createdAt: { lt } }, { createdAt: equals, id: { lt } }] }`, `contarNaoLidas(msgs, ultimaLidaEm, meuId)` (ignora as minhas), `indiceDoDivisor(msgs, ultimaLidaEm)` → índice da 1ª mensagem nova ou −1. Teste com empate de `createdAt`.
2. **Paginação** — `[id]/route.ts`: `?antes=<cursor>` opcional; `where` ganha `whereAntes`; `take: 60` **continua** (`desc` + `reverse`); resposta ganha `cursorAnterior` (= `cursorDe(primeira da página)` se vieram 60, senão `null`). `thread/[msgId]`: mesma mecânica com `take 50`.
3. **Leitura persistida** — model `CanalLeitura { id, userId @db.ObjectId, canalId @db.ObjectId, ultimaLidaEm DateTime, ultimaLidaId String?, @@unique([userId, canalId]), @@map("canal_leituras") }` → `generate` + `db push`. **`POST /api/canal/[id]/lido { mensagemId? }`** (`podeLer`; upsert com `now` ou o `createdAt` da mensagem). **`GET /api/canal?resumo=1`**: cada canal ganha `naoLidas` (count de `canalMensagem` com `createdAt > ultimaLidaEm` **e** `autorId != eu`, root e respostas; sem linha de leitura = conta desde `canal.createdAt`, teto `99`) e `ultimaMensagemEm`. `GET /api/canal/[id]` ganha `leitura: { ultimaLidaEm }` e `recursos.leitura = true`.
4. **UI:** `naoLidas :35` nasce do `?resumo=1` (não mais `{}`); `carregarDetalhe :86-96` chama `POST …/lido` ao abrir e **de novo** quando a aba volta a ficar visível (`:103`), com debounce 1s; **divisor "novo desde a última visita"** (linha fina de vidro + rótulo) no `indiceDoDivisor`; **scroll infinito para cima**: sentinela no topo da lista com `IntersectionObserver` → `GET …?antes=cursorAnterior` → **prepend preservando a âncora** (guardar `scrollHeight` antes, somar a diferença ao `scrollTop` depois); o autoscroll `:164` só dispara quando o usuário está no fim (`distânciaDoFim < 80px`) — hoje ele puxa sempre. Mesma coisa no `ThreadPanel`.
5. **Testes:** `historico.test.ts` (cursor ida-e-volta; empate de `createdAt` não pula nem repete; divisor); `[id]/route.test.ts` (2 páginas de 60 + resto sem repetição, com fixture de 150); `lido/route.test.ts` (IDOR; upsert idempotente); `canal/route.test.ts` (`resumo=1`: não conta as minhas, teto 99, sem leitura conta desde a criação).
**Gate S2:** fixture de **500 mensagens** pagina em 9 páginas sem salto nem repetição (teste de rota); **dois clientes** (dois `sessaoUsuario` mockados) veem a **mesma** contagem vinda do servidor; abrir o canal zera no servidor e no outro cliente após `?resumo=1`; o divisor aparece na 1ª mensagem nova. **Reporte:** `PASSO 2: verde/vermelho + nº de páginas e contagens`.

### PASSO 3 — PR-S7 · Lock distribuído (nasce C12)
Branch `escritorio/fatia2-s7-lock-redis`. Flag `CANAL_LOCK_REDIS` (+ `REDIS_URL`); `CANAL_LOCK_TTL_MS` (default 90000).
1. **`lib/canal/serial.ts`:** mantém `emSerie`/`emAndamento`; adiciona `OcupadoError`, a fila de espera com **teto 3 por chave** nos dois modos, e o modo Redis: `adquirir` (`SET key token PX ttl NX`, retry a cada 250ms até `CANAL_LOCK_ESPERA_MS` default 60000, contando na fila), `renovar` (`setInterval` ttl/3 → `PEXPIRE` só se o token ainda for o nosso — Lua `if redis.call("get",KEYS[1])==ARGV[1] then return redis.call("pexpire",KEYS[1],ARGV[2]) end`), `liberar` (Lua compare-and-del) em `finally` **e** `clearInterval`. Cliente = `getRedisConnection()` de `lib/queue/scholar.ts`, injetável por `__setRedisForTest`. Erro de Redis em runtime (não na config) → **cai para o `Map`** com `console.warn` 1× — nunca derruba o turno.
2. **Rota:** `mensagem/route.ts` — como o turno é disparado fire-and-forget (`dispararTurnos`), o `OcupadoError` chega **dentro** do job; o `queue.ts :56` captura e publica uma mensagem **efêmera** do agente com `messageForError("canal_ocupado")` (padrão já existente em `executarTurno`), para o humano saber por que o mentor não falou. `errors.ts` ganha `canal_ocupado`.
3. **`recursos.lock`** em `GET /api/canal/[id]`: `"redis"` quando o modo Redis está ativo, senão `"processo"`.
4. **Testes** (`serial.test.ts` ampliado + `serial-redis.test.ts` com `FakeRedis` em memória com semântica `NX`/`PX`/expiração por relógio injetado): (a) **dois "processos"** (duas instâncias do módulo via `vi.resetModules`, mesmo `FakeRedis`) disparando na mesma chave produzem execução **sequencial**; (b) matar o dono (promessa que nunca resolve + avançar o relógio além do TTL) libera por expiração e o próximo adquire; (c) renovação mantém o lock vivo numa `fn` de 3×TTL; (d) release só apaga se o token for o nosso; (e) 4º concorrente recebe `OcupadoError` imediatamente nos dois modos; (f) Redis lançando em runtime → `Map` assume. `queue.test.ts`: `OcupadoError` vira mensagem efêmera.
**Gate S7:** com `CANAL_LOCK_REDIS=1` + Redis local (`docker run redis:7-alpine` ou o do compose), **web + worker** (`CANAL_QUEUE=1`, `CANAL_WORKER=1`) disparando no mesmo canal produzem falas **sequenciais** (nunca intercaladas); `kill -9` no worker no meio de um turno → o lock expira pelo TTL e o próximo turno anda sozinho; 4 convocações simultâneas → 3 falam em ordem, a 4ª mostra "a sala está ocupada"; flag off → `serial.test.ts` antigo passa inalterado. **Reporte:** `PASSO 3: verde/vermelho + log das falas sequenciais`.

### PASSO 4 — Verificação final da fatia (não pule)
1. `tsc` limpo · `vitest` verde · CI `build-test` verde nos 3 PRs.
2. **Flags vazias** → sala idêntica: fio com 60, sem afordância de thread, lock por processo; a única mudança visível é a não-lida vindo do servidor (e sendo igual à de antes quando só há um aparelho).
3. **`docs/HANDOFF_FATIA2_RESULTADO.md`**: como ligar (`CANAL_THREADS=1`; `CANAL_LOCK_REDIS=1` exige `REDIS_URL` TCP no `.env` do VPS — o compose já tem `redis`), rollback (flag vazia; threads já gravadas continuam legíveis pela rota de thread), e as medidas do handoff §9 "escritório": **falas sobrepostas = 0** (grep no ledger de mensagens por agente/canal com `createdAt` a < 2s), tempo médio de espera no lock, nº de `canal_ocupado`.
**Gate:** os 3 itens, binários.

## 5. Decisões assumidas pelo Fable (valem até o Martinez vetar — leia antes do PASSO 1)

1. **Capacidades vêm do servidor (`recursos`)**, não de `NEXT_PUBLIC_*`: evita build-arg novo a cada feature do canal e deixa ligar/desligar sem rebuild. É o padrão para as fatias 3-8 também.
2. **S2 sem flag.** O handoff §7 não lista flag para histórico/leitura; paginação preserva a 1ª página e a leitura persistida é aditiva. Se o Martinez quiser flag, é um `if` em dois lugares (`?antes` e `POST lido`).
3. **Resposta em thread conta como não-lida do canal** (sem contador próprio por thread). Contador por thread fica para quando houver "seguir thread" (P5 usa).
4. **Composer extraído** (`components/office/Composer.tsx`) para o painel de thread **reusar** o autocomplete de `@` em vez de duplicar — é refactor sem mudança de comportamento, dentro do PR-S1.
5. **Lock: espera até 60s com retry de 250ms**, teto de 3 na fila, TTL 90s com renovação. Um turno elaborated do harness cabe em 60s (`BUDGET.elaborated.ms` = 60_000 em `trajectory.ts:81`); `research` (180s) só existe em tarefa (A4), que vai ter lease próprio.
6. **`OcupadoError` vira mensagem efêmera do agente**, não erro HTTP para o humano — o `POST` da mensagem humana já respondeu 201 quando o turno roda. O 429 da §3 fica reservado para quando (S3/A4) houver chamada síncrona que espere o lock.

## 6. Economia de execução (pedido do Martinez — leve a sério)

Agrupe edições por arquivo; não abra exploração (a §2 tem TODAS as âncoras, verificadas em `5d3971d`); não re-explique contratos — a §3 é o texto final; pare em cada gate e reporte em 1 linha (`PASSO N: verde/vermelho + evidência`); gate vermelho 2 vezes → **PARE e pergunte ao Martinez**. Um PR por passo, ≤ ~8 arquivos. Se o PASSO 1.4 (UI) passar de ~250 linhas novas, você está reescrevendo a sala — volte a reusar `Bolha` e o `Composer`. O valor está em cada gate verde, não em volume de código.
