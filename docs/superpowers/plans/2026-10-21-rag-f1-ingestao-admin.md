# RAG F1 — Ingestão + Admin · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PDFs sobem pelo Admin pra uma turma, viram trechos buscáveis por palavra-chave na hora e por vetor logo depois, e uma busca híbrida devolve só trechos que a pessoa pode ver.

**Architecture:** `pdf-loader` (já na VPS) → corte por estrutura (puro) → `rag_documentos` + `rag_trechos` no Atlas → fila BullMQ `rag-index` gera vetores com `gemini-embedding-001` (Vertex direto, 1024) → `$rankFusion` (`$vectorSearch` + `$search`) com a permissão **dentro do filtro**. Tudo com dependências injetáveis (molde de `lib/chore/*` e `lib/agent/memory.ts`), testado sem Atlas.

**Tech Stack:** Next.js 14 (App Router, rotas `runtime = "nodejs"`), TypeScript, Prisma (MongoDB), BullMQ/ioredis, Vertex AI REST (`google-auth-library`), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-21-rag-turmas-design.md` (aprovado em 2026-10-21).

## Global Constraints

- Embedder **só** `gemini-embedding-001`, `outputDimensionality: 1024`, **Vertex direto** (`:predict`, location `geminiTextLocation()`); `task_type` `RETRIEVAL_DOCUMENT` na ingestão, `RETRIEVAL_QUERY` na pergunta. **Nunca** o gateway nem `zaeon-local-embed` (mesma dimensão, vetores incompatíveis).
- 25 MB por PDF; até **10 PDFs por envio**.
- O **PDF original não é guardado**; guarda-se o Markdown completo + trechos.
- **Tabela nunca é partida**; trecho fecha em título; cada trecho guarda página inicial/final e o caminho de títulos no começo do texto.
- Permissão: trecho visível sse `turmaIds ∩ turmasDaPessoa ≠ ∅` **ou** `donoIds ∋ pessoa` — aplicada **dentro** do `$vectorSearch.filter` e do `$search` (nunca filtrar depois).
- Dedupe por **SHA-256 do arquivo**: mesmo hash → não reprocessa, só acrescenta a permissão.
- Remover de uma turma tira **só aquela permissão**; o documento some quando não sobra nenhuma.
- Busca para quem não tem nada na base → **não chama o embedder** (retorna vazio na hora).
- Material de aluno nunca vai pro AI Studio grátis (`GEMINI_FREE_API_KEY`).
- IDs de permissão gravados como **string** (hex do ObjectId) nos trechos, pra os índices do Atlas filtrarem por `token`/`string`.

## Review Focus

1. **PDF sem texto (escaneado)** → documento `status: "erro"`, `erro: "sem_texto"`, zero trechos, nada na fila. *(teste na Task 4)*
2. **Mesmo PDF numa 2ª turma** → nenhuma nova chamada ao `pdf-loader` nem ao embedder; `turmaIds` dos trechos ganha a turma nova. *(teste na Task 4)*
3. **Tabela maior que o tamanho-alvo do trecho** → sai num trecho só, inteira. *(teste na Task 2)*
4. **Embedder falha no meio (429/5xx)** → documento fica `indexando`, trechos já gravados seguem buscáveis por palavra-chave; o job é re-tentado pela fila. *(teste na Task 5)*
5. **Remover de uma turma um documento que também está em outra** → continua visível na outra; some só quando a última permissão sai. *(teste na Task 3)*

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `prisma/schema.prisma` | modelos `RagDocumento` (`rag_documentos`) e `RagTrecho` (`rag_trechos`) |
| `lib/rag/permissao.ts` | **puro**: escopo da pessoa → filtros do Atlas; checagem de visibilidade |
| `lib/rag/corte.ts` | **puro**: `blocks[]` do pdf-loader → trechos por estrutura |
| `lib/rag/store.ts` | persistência com `db` injetável (documentos, trechos, permissões, status) |
| `lib/rag/embed.ts` | `gemini-embedding-001` no Vertex (lotes, tipo de tarefa, 1024) |
| `lib/rag/ingerir.ts` | orquestra: bytes → hash → dedupe/pdf-loader → corte → store → fila |
| `lib/rag/busca.ts` | pipeline `$rankFusion` com filtro de permissão; fallback só-texto |
| `lib/queue/rag.ts` | fila `rag-index` (BullMQ) + worker + fallback inline |
| `instrumentation.ts`, `instrumentation-node.ts` | sobe o worker com `RAG_WORKER=1` |
| `scripts/atlas-rag-indexes.mongo.js` | índices `rag_trechos_vec` e `rag_trechos_text` (o dono roda no Atlas) |
| `app/api/admin/rag/route.ts` | GET lista / POST upload (multipart) / DELETE permissão — `assertAdmin` |
| `app/api/admin/rag/busca/route.ts` | POST busca de teste (admin) |
| `app/workstation/admin/modules/BaseConhecimentoModule.tsx` + `page.tsx` | aba "Base de conhecimento" |
| `lib/rag/fakeDb.ts` | db em memória pros testes (molde de `lib/chore/fakeDb.ts`) |

---

### Task 1: Modelos + permissão (puro)

**Files:**
- Modify: `prisma/schema.prisma` (após `model MemoryDrawer`)
- Create: `lib/rag/permissao.ts`, `lib/rag/permissao.test.ts`

**Interfaces:**
- Produces:
  - `type EscopoRag = { userId: string; turmaIds: string[] }`
  - `function temBase(e: EscopoRag, contagem: { pessoais: number; deTurma: number }): boolean`
  - `function filtroVetorial(e: EscopoRag): Record<string, unknown>` → `{ $or: [{ turmaIds: { $in: [...] } }, { donoIds: { $eq: userId } }] }` (sem o ramo de turma quando `turmaIds` vazio)
  - `function filtroTextual(e: EscopoRag): unknown[]` → cláusulas `compound.filter`/`should` do `$search` usando o operador `in` em `turmaIds` e `equals` em `donoIds`, com `minimumShouldMatch: 1`
  - `function podeVer(trecho: { turmaIds: string[]; donoIds: string[] }, e: EscopoRag): boolean`
  - Prisma: `RagDocumento { id, hash @unique, titulo, nomeArquivo, paginas Int, markdown String, status String /* "indexando"|"pronto"|"erro" */, erro String?, turmaIds String[], donoIds String[], origem String /* "admin"|"chat"|"gerado" */, criadoPor String @db.ObjectId, totalTrechos Int @default(0), comVetor Int @default(0), createdAt, updatedAt }` `@@map("rag_documentos")`; `RagTrecho { id, documentoId String @db.ObjectId, ordem Int, texto String, caminho String, paginaIni Int, paginaFim Int, turmaIds String[], donoIds String[], embedding Float[], createdAt }` `@@index([documentoId, ordem])` `@@map("rag_trechos")`

- [ ] **Step 1: Testes que falham** (`permissao.test.ts`)
  - `filtroVetorial({userId:"u1", turmaIds:["t1","t2"]})` ⇒ `{ $or: [{ turmaIds: { $in: ["t1","t2"] } }, { donoIds: { $eq: "u1" } }] }`
  - `filtroVetorial({userId:"u1", turmaIds:[]})` ⇒ `{ donoIds: { $eq: "u1" } }`
  - `podeVer({turmaIds:["t9"], donoIds:["u2"]}, {userId:"u1", turmaIds:["t1"]})` ⇒ `false` (aluno A não vê turma alheia nem base de B)
  - `podeVer({turmaIds:["t1"], donoIds:[]}, {userId:"u1", turmaIds:["t1"]})` ⇒ `true`; `podeVer({turmaIds:[], donoIds:["u1"]}, {userId:"u1", turmaIds:[]})` ⇒ `true`
  - `temBase(e, {pessoais:0, deTurma:0})` ⇒ `false`; com qualquer > 0 ⇒ `true`
  - `filtroTextual(...)` contém `{ in: { path: "turmaIds", value: ["t1"] } }` e `{ equals: { path: "donoIds", value: "u1" } }`
- [ ] **Step 2:** `npx vitest run lib/rag/permissao.test.ts` → FAIL (módulo não existe)
- [ ] **Step 3:** Implementar `lib/rag/permissao.ts`; acrescentar os dois modelos no schema; `npx prisma generate`.
- [ ] **Step 4:** `npx vitest run lib/rag/permissao.test.ts` → PASS; `npx tsc --noEmit -p .` sem erros fora de `server/colyseus`.
- [ ] **Step 5:** Commit `feat(rag): modelos rag_documentos/rag_trechos + filtros de permissão (puro)`

### Task 2: Corte por estrutura (puro)

**Files:** Create `lib/rag/corte.ts`, `lib/rag/corte.test.ts`

**Interfaces:**
- Consumes: `Block` de `lib/scholar/types` (`{ type: "heading"|"paragraph"|"table"|"figure"; page?: number; text: string }`)
- Produces: `type TrechoCortado = { ordem: number; texto: string; caminho: string; paginaIni: number; paginaFim: number }`; `const ALVO_CHARS = 3000`; `function cortarEmTrechos(blocks: Block[], titulo: string): TrechoCortado[]`

O `pdf-loader` não informa nível de título: o caminho é `titulo › penúltimo título › último título` (os dois mais recentes). `texto` = `caminho + "\n\n" + conteúdo`. Fecha o trecho ao encontrar um título **ou** ao passar de `ALVO_CHARS` num limite de parágrafo; tabela entra inteira (se não couber, fecha o atual e a tabela vira trecho próprio). `figure` é ignorado. Blocos sem `page` herdam a última página vista (começa em 1).

- [ ] **Step 1: Testes que falham**
  - 2 títulos, cada um com 2 parágrafos curtos ⇒ 2 trechos; `trechos[1].caminho === "Apostila › Cap 1 › Cap 2"`; `trechos[1].texto.startsWith("Apostila › Cap 1 › Cap 2\n\n")`
  - parágrafos de 1.200 chars nas páginas 3,3,4 sob um título ⇒ 2 trechos; o 1º `paginaIni 3 / paginaFim 3`, o 2º termina na página 4
  - **tabela de 5.000 chars** entre parágrafos ⇒ um trecho cujo texto contém a tabela inteira (`includes(tabela)`), e nenhum outro trecho contém pedaço dela *(Review Focus 3)*
  - `blocks = []` ⇒ `[]`; só `figure` ⇒ `[]`
  - `ordem` é 0,1,2… sem buracos
- [ ] **Step 2:** `npx vitest run lib/rag/corte.test.ts` → FAIL
- [ ] **Step 3:** Implementar `cortarEmTrechos`.
- [ ] **Step 4:** → PASS
- [ ] **Step 5:** Commit `feat(rag): corte por estrutura (títulos, tabela inteira, páginas, caminho)`

### Task 3: Store (db injetável) + permissões

**Files:** Create `lib/rag/store.ts`, `lib/rag/fakeDb.ts`, `lib/rag/store.test.ts`

**Interfaces:**
- Consumes: `TrechoCortado` (Task 2), `EscopoRag` (Task 1)
- Produces (todas recebem `db: RagDb` primeiro):
  - `type RagDocumentoRow` = a linha `RagDocumento` do Prisma (`import type { RagDocumento } from "@prisma/client"`)
  - `type RagDb` (as operações Prisma usadas: `ragDocumento.{findUnique,create,update,findMany,delete,count}`, `ragTrecho.{createMany,updateMany,findMany,deleteMany,update}`) e `fakeDb(): RagDb`
  - `type Permissao = { turmaId?: string; donoId?: string }`
  - `buscarPorHash(db, hash): Promise<RagDocumentoRow | null>`
  - `criarDocumento(db, d: { hash; titulo; nomeArquivo; paginas; markdown; origem; criadoPor; permissao: Permissao }): Promise<RagDocumentoRow>` (status `"indexando"`)
  - `gravarTrechos(db, documentoId, trechos: TrechoCortado[], perm: { turmaIds: string[]; donoIds: string[] }): Promise<number>`
  - `acrescentarPermissao(db, documentoId, p: Permissao): Promise<void>` (documento **e** todos os trechos; idempotente)
  - `removerPermissao(db, documentoId, p: Permissao): Promise<"removida" | "documento_apagado">`
  - `marcarErro(db, documentoId, erro: string)`, `registrarVetores(db, documentoId, itens: { trechoId: string; embedding: number[] }[])` (atualiza `comVetor`; quando `comVetor === totalTrechos` ⇒ `status "pronto"`)
  - `trechosSemVetor(db, documentoId, limite: number): Promise<{ id: string; texto: string }[]>`
  - `listarDocumentos(db, f: { turmaId?: string; donoId?: string }): Promise<RagDocumentoRow[]>` (sem `markdown`)
  - `contarBase(db, e: EscopoRag): Promise<{ pessoais: number; deTurma: number }>`

- [ ] **Step 1: Testes que falham**
  - `acrescentarPermissao` 2× com a mesma turma ⇒ `turmaIds` sem duplicata, no documento e em todos os trechos
  - **doc em t1 e t2; `removerPermissao(t1)` ⇒ `"removida"`; trechos ainda `podeVer` pra escopo de t2 e não pra escopo só de t1** *(Review Focus 5)*
  - removendo a última permissão ⇒ `"documento_apagado"`; `ragTrecho.findMany({documentoId})` vazio
  - `registrarVetores` cobrindo todos ⇒ `status "pronto"`; cobrindo metade ⇒ continua `"indexando"`
  - `contarBase({userId:"u1", turmaIds:["t1"]})` conta separado pessoais/turma
- [ ] **Step 2:** `npx vitest run lib/rag/store.test.ts` → FAIL
- [ ] **Step 3:** Implementar store + fakeDb.
- [ ] **Step 4:** → PASS
- [ ] **Step 5:** Commit `feat(rag): store com permissões por turma/dono e status de indexação`

### Task 4: Embed (Vertex) + ingestão

**Files:** Create `lib/rag/embed.ts`, `lib/rag/embed.test.ts`, `lib/rag/ingerir.ts`, `lib/rag/ingerir.test.ts`

**Interfaces:**
- Consumes: `extractPdfStructured(data: Uint8Array): Promise<StructuredText | null>` (`lib/scholar/pdf.ts`), `vertexCredentials()`, `geminiTextLocation()`, `vertexHost()` (`lib/ai/vertex-credentials.ts`), `vertexAccessToken(client_email, private_key): Promise<string | null>` (hoje privado em `lib/ai/contextCache.ts:16` — **exportar** e reusar, sem duplicar), Tasks 2–3
- Produces:
  - `const RAG_EMBED_MODEL = "gemini-embedding-001"`, `const RAG_EMBED_DIM = 1024`, `const LOTE_EMBED = 16`
  - `type EmbedRag = (textos: string[], tipo: "documento" | "pergunta") => Promise<number[][]>`; `embedVertex: EmbedRag` (POST `https://${vertexHost(loc)}/v1/projects/${p}/locations/${loc}/publishers/google/models/gemini-embedding-001:predict`, `instances[{content, task_type}]`, `parameters.outputDimensionality: 1024`, lotes de `LOTE_EMBED`, erro HTTP lança `Error("embed_http_<status>")`)
  - `type IngerirDeps = { db: RagDb; extrair: typeof extractPdfStructured; enfileirar: (documentoId: string) => Promise<void> }`
  - `type IngerirEntrada = { bytes: Uint8Array; nomeArquivo: string; titulo?: string; origem: "admin" | "chat" | "gerado"; criadoPor: string; permissao: Permissao }`
  - `type IngerirResultado = { documentoId: string; status: "novo" | "reaproveitado" | "erro"; erro?: "grande_demais" | "sem_texto" | "leitura_falhou"; trechos: number; paginas: number }`
  - `const MAX_BYTES = 25 * 1024 * 1024`
  - `function ingerirPdf(deps: IngerirDeps, e: IngerirEntrada): Promise<IngerirResultado>`

`ingerirPdf`: `> MAX_BYTES` ⇒ `erro "grande_demais"` sem tocar no db · SHA-256 (`node:crypto`) · hash existente ⇒ `acrescentarPermissao` + `"reaproveitado"` · senão `extrair` → `null` ou 0 trechos ⇒ documento com `marcarErro("sem_texto")` · senão `criarDocumento` + `gravarTrechos` + `enfileirar(id)`. `paginas` = maior `page` dos blocos. `titulo` padrão = nome do arquivo sem `.pdf`.

- [ ] **Step 1: Testes que falham**
  - `embed.test.ts` (fetch mockado): 20 textos ⇒ 2 chamadas (16+4), corpo com `task_type: "RETRIEVAL_DOCUMENT"` e `outputDimensionality: 1024`; `tipo "pergunta"` ⇒ `RETRIEVAL_QUERY`; HTTP 429 ⇒ rejeita com `embed_http_429`; URL contém `gemini-embedding-001:predict` e nunca `zaeon-local`
  - `ingerir.test.ts`: PDF novo ⇒ `"novo"`, `trechos > 0`, `enfileirar` chamado 1× com o id
  - **mesmo bytes com outra turma ⇒ `"reaproveitado"`, `extrair` NÃO chamado de novo, `enfileirar` NÃO chamado, trechos têm as duas turmas** *(Review Focus 2)*
  - **`extrair` devolve `{paragraphs:[], blocks:[]}` ⇒ `"erro"`, `erro "sem_texto"`, 0 trechos, `enfileirar` não chamado** *(Review Focus 1)*
  - 26 MB ⇒ `"erro"`, `"grande_demais"`, db intocado
- [ ] **Step 2:** `npx vitest run lib/rag/embed.test.ts lib/rag/ingerir.test.ts` → FAIL
- [ ] **Step 3:** Implementar `embed.ts` e `ingerir.ts`.
- [ ] **Step 4:** → PASS
- [ ] **Step 5:** Commit `feat(rag): ingestão (hash/dedupe, pdf-loader, corte, store) + embed gemini-embedding-001 no Vertex`

### Task 5: Fila `rag-index` + worker

**Files:** Create `lib/queue/rag.ts`, `lib/queue/rag.test.ts`; Modify `instrumentation.ts`, `instrumentation-node.ts`, `.env.example`

**Interfaces:**
- Consumes: `getRedisConnection()` (`lib/queue/scholar.ts`), store + `EmbedRag`
- Produces:
  - `const RAG_QUEUE = "rag-index"`; `filaRagLigada(env): boolean` = `env.RAG_QUEUE === "1" && Boolean(env.REDIS_URL)`
  - `function indexarDocumento(deps: { db: RagDb; embed: EmbedRag }, documentoId: string): Promise<{ vetorizados: number; pronto: boolean }>` — laços de `trechosSemVetor(…, 64)` → `embed(textos, "documento")` → `registrarVetores`, até acabar
  - `function enfileirarIndexacao(documentoId: string): Promise<"fila" | "inline">` — sem fila: roda `indexarDocumento` em segundo plano (não aguarda; erro só loga) e devolve `"inline"`; com fila: `add("indexar", {documentoId}, { jobId: "rag_"+documentoId, attempts: 5, backoff: { type: "exponential", delay: 30_000 } })`
  - `function iniciarWorkerRag(env?): Promise<boolean>` (`RAG_WORKER === "1"` + fila ligada; concurrency 2; log `[rag-worker] ouvindo "rag-index"`)
  - `instrumentation.ts`: dentro do `if (NEXT_RUNTIME === "nodejs")`, bloco `if (process.env.RAG_WORKER === "1")` → `iniciarWorkerRagOpcional()` (molde do das chores)
  - `.env.example`: `RAG_QUEUE=""` e `RAG_WORKER=""` com comentário

- [ ] **Step 1: Testes que falham**
  - 100 trechos sem vetor, embed ok ⇒ `{vetorizados:100, pronto:true}`, documento `"pronto"`
  - **embed lança `embed_http_429` no 2º lote ⇒ `indexarDocumento` rejeita, documento continua `"indexando"`, os 64 do 1º lote ficaram com vetor, e os trechos seguem no db** *(Review Focus 4)*
  - reexecutar depois da falha só manda os que faltam (embed recebe 36 textos)
  - `filaRagLigada({RAG_QUEUE:"1"})` sem REDIS_URL ⇒ `false`
- [ ] **Step 2:** `npx vitest run lib/queue/rag.test.ts` → FAIL
- [ ] **Step 3:** Implementar; ligar no instrumentation.
- [ ] **Step 4:** → PASS; `npx tsc --noEmit -p .` limpo fora de colyseus.
- [ ] **Step 5:** Commit `feat(rag): fila rag-index (BullMQ) com retry; fallback inline; worker no instrumentation`

### Task 6: Busca híbrida com permissão

**Files:** Create `lib/rag/busca.ts`, `lib/rag/busca.test.ts`, `scripts/atlas-rag-indexes.mongo.js`

**Interfaces:**
- Consumes: Tasks 1, 3, 4
- Produces:
  - `const VEC_INDEX = "rag_trechos_vec"`, `const TEXT_INDEX = "rag_trechos_text"`, `const K_PADRAO = 8`
  - `type TrechoAchado = { trechoId; documentoId; titulo: string; texto: string; paginaIni: number; paginaFim: number; score: number }`
  - `type BuscaDeps = { colecao: { aggregate(pipeline: unknown[]): Promise<any[]> }; embed: EmbedRag; contar: (e: EscopoRag) => Promise<{ pessoais: number; deTurma: number }>; prazoEmbedMs?: number }`
  - `function montarPipeline(e: EscopoRag, pergunta: string, vetor: number[] | null, k: number): unknown[]` — com vetor: `$rankFusion` com `vector: [$vectorSearch{index:VEC_INDEX, path:"embedding", queryVector, numCandidates: max(100,k*12), limit:k, filter: filtroVetorial(e)}]` e `texto: [$search{index:TEXT_INDEX, compound:{must:[text{query, path:"texto"}], filter/should: filtroTextual(e)}}, $limit k]`; sem vetor: só o ramo texto. Depois `$limit k`, `$lookup` do título em `rag_documentos`, `$project`.
  - `function buscar(deps: BuscaDeps, e: EscopoRag, pergunta: string, k?: number): Promise<TrechoAchado[]>` — `temBase` falso ⇒ `[]` **sem chamar embed**; embed com prazo `prazoEmbedMs ?? 3000` (estourou/falhou ⇒ vetor `null`); resultado passa por `podeVer` (cinto + suspensório)
  - Script: cria `rag_trechos_vec` (`type: "vector"`, `numDimensions: 1024`, `similarity: "cosine"`, campos `filter` `turmaIds` e `donoIds`) e `rag_trechos_text` (`texto` string `lucene.portuguese`; `turmaIds`/`donoIds` como `token`) — mesmo formato de `scripts/atlas-memory-indexes.mongo.js`

- [ ] **Step 1: Testes que falham**
  - escopo sem base ⇒ `[]` e `embed` **não** chamado
  - `montarPipeline` com vetor contém `$rankFusion`, o `$vectorSearch.filter` é igual a `filtroVetorial(e)` e o `$search` carrega `filtroTextual(e)`
  - embed rejeita ⇒ pipeline sem `$vectorSearch` (só texto) e `buscar` não lança
  - `colecao.aggregate` devolvendo um trecho de turma alheia ⇒ ele é descartado pelo `podeVer`
- [ ] **Step 2:** `npx vitest run lib/rag/busca.test.ts` → FAIL
- [ ] **Step 3:** Implementar `busca.ts` (a coleção real usa `prisma.$runCommandRaw({ aggregate: "rag_trechos", pipeline, cursor: {} })`, molde de `lib/agent/memory.ts`) e o script.
- [ ] **Step 4:** → PASS
- [ ] **Step 5:** Commit `feat(rag): busca híbrida \$rankFusion com permissão no filtro + script dos índices do Atlas`

### Task 7: Rotas do Admin + aba "Base de conhecimento"

**Files:** Create `app/api/admin/rag/route.ts`, `app/api/admin/rag/busca/route.ts`, `app/api/admin/rag/route.test.ts`, `app/workstation/admin/modules/BaseConhecimentoModule.tsx`; Modify `app/workstation/admin/page.tsx`

**Interfaces:**
- Consumes: `assertAdmin()` (`{ok:true,email}|{ok:false,status}`), `ingerirPdf`, `enfileirarIndexacao`, `listarDocumentos`, `removerPermissao`, `buscar`
- Produces:
  - `GET /api/admin/rag?turmaId=` ⇒ `{ turmas: {id,name}[], documentos: {id,titulo,nomeArquivo,paginas,status,erro,totalTrechos,comVetor,createdAt}[] }`
  - `POST /api/admin/rag` (multipart: `turmaId`, `arquivos[]`) ⇒ `{ resultados: IngerirResultado & { nomeArquivo } [] }`; > 10 arquivos ⇒ 400 `{error:"max_10_arquivos"}`; não-PDF ⇒ resultado com `erro: "nao_pdf"`
  - `DELETE /api/admin/rag?documentoId=&turmaId=` ⇒ `{ resultado: "removida" | "documento_apagado" }`
  - `POST /api/admin/rag/busca` `{ turmaId, pergunta }` ⇒ `{ trechos: TrechoAchado[], ms }` (escopo `{ userId: <admin>, turmaIds: [turmaId] }`)
  - Aba `"rag"` no `activeTab` do `page.tsx`, rótulo **"Base de conhecimento"**; o módulo: seletor de turma, upload múltiplo (`accept="application/pdf"`, até 10), lista com status ("indexando 12/40", "pronto", erro legível), remover, e um campo "testar busca" mostrando trechos com título + páginas.

- [ ] **Step 1: Testes que falham** (`route.test.ts`, `assertAdmin` e libs mockadas)
  - sem admin ⇒ GET/POST/DELETE devolvem o `status` do `assertAdmin` (401/403) e **nada** é ingerido
  - POST com 11 arquivos ⇒ 400 `max_10_arquivos`
  - POST com 2 PDFs ⇒ `ingerirPdf` chamado 2× com `permissao: { turmaId }`, `origem: "admin"`
- [ ] **Step 2:** `npx vitest run app/api/admin/rag` → FAIL
- [ ] **Step 3:** Implementar rotas (`runtime = "nodejs"`, `dynamic = "force-dynamic"`) e o módulo (padrão visual de `PoolPainel.tsx`, `glassPanel` por prop).
- [ ] **Step 4:** → PASS; `npx tsc --noEmit -p .` limpo; `npx vitest run lib/rag lib/queue app/api/admin/rag` verde.
- [ ] **Step 5:** Commit `feat(rag): aba Base de conhecimento no Admin (upload por turma, status, remover, testar busca)`

### Task 8: Ligar em produção e provar

**Files:** nenhum código novo — PR, deploy e verificação.

- [ ] **Step 1:** Abrir o PR com o resumo das Tasks 1–7; CI (`build-test`) verde.
- [ ] **Step 2:** Merge → deploy. `prisma db push` pelo deploy manual (`db_push=true`) pra criar as coleções/índices do Prisma.
- [ ] **Step 3:** O dono roda `scripts/atlas-rag-indexes.mongo.js` no Atlas (mongosh ou Atlas UI → JSON Editor). Conferir `$listSearchIndexes` em `rag_trechos` ⇒ os 2 índices `READY`.
- [ ] **Step 4:** `.env` da VPS: `RAG_QUEUE=1`, `RAG_WORKER=1` → recriar `web`. Log: `[rag-worker] ouvindo "rag-index"`.
- [ ] **Step 5:** Admin → Base de conhecimento → subir 2 PDFs reais numa turma de teste. Esperado: status vai a "pronto"; "testar busca" acha trecho com título + página certos; o mesmo PDF numa 2ª turma aparece na hora (reaproveitado); remover da 1ª mantém na 2ª.
- [ ] **Step 6:** Ledger/custo: conferir as chamadas `gemini-embedding-001` (tokens) e registrar o custo por PDF no PR.
