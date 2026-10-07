# PROMPT DE EXECUÇÃO — Claude Code (Opus) · Escritório Zaeon · **Fatia 5 · Memória coletiva**

> **Você é o EXECUTOR.** Todo o projeto já foi decidido, pesquisado e contratado em código.
> Você NÃO redesenha, NÃO reabre decisão, NÃO re-deriva tipo, NÃO explora o repo além das
> âncoras dadas. Você integra, verifica e **para em cada gate**. Co-autorado pelo Fable em
> 2026-10-07 a partir de `docs/HANDOFF_ESCRITORIO_AGENTES_V2.md` (§4 C9; §5 camada 4 + S4/S5/S8
> da camada 3; §8.10, §8.12, §8.14) + `docs/PROSPECCAO_AGENTES_AUTONOMOS.md` (PR-A7 `:651-695`,
> PR-S4 `:1125-1141`, PR-S5 `:1142-1155`, PR-S8 `:1190-1205`) + leitura do **AgentRxiv**
> (`SamuelSchmidgall/AgentLaboratory/app.py`, 170 linhas, MIT) + `docs/MEMORY_AND_PERSISTENCE.md` §4.
>
> **Esta fatia = 5 PRs, nesta ordem: M0 (ligar o L3) → S5 (anexo vira fonte) → S4 (busca) →
> A7 (Zxiv) → S8 (contexto por relevância).** Nasce **C9** (`ZxivPaper`). Consome C3 (thread),
> C4 (chave de citação, `Contexto.origem`), C11 (score/veredito), C1 (tarefa), C5 (ledger, opcional).
> **Não comece sem as Fatias 2 e 3 mergeadas** (S8 e A7 precisam de C3/C4/C11; a Fatia 4 não é
> pré-requisito — só o `🔖` e o resumo do comitê passam a funcionar de verdade depois do M0).
> **Toda âncora `arquivo:linha` abaixo foi verificada em `origin/main` = `83d9b70` (2026-10-07).**

---

## 0. Leia antes de codar (só isto, nesta ordem)

1. **§1 deste prompt, item "Correção de estado"** — muda a premissa da fatia inteira.
2. `docs/HANDOFF_ESCRITORIO_AGENTES_V2.md` — §4 (C9 — você cria; C4/C11 — consome), §5 "CAMADA 4" (A7) e S4/S5/S8 na "CAMADA 3", §8.10 (dado de aluno nunca sai do Vertex — vale para **embeddings**), §8.12 (AgentRxiv é MIT), §8.14 (índices Atlas manuais, degradar com aviso).
3. `docs/PROSPECCAO_AGENTES_AUTONOMOS.md` — PR-A7, S4, S5, S8 (linhas acima). *Por que o Zxiv é o multiplicador:* MATH-500 70,2% → 78,2% com mural compartilhado (A7, `:688-694`).
4. `docs/MEMORY_AND_PERSISTENCE.md` §4 (L3) — e o aviso de índice em `:160-164`.
5. `docs/EXECUTOR_PROMPT_FATIA3_TRABALHO.md` §3 (C4 `Contexto`, C11 `scorePaper`/`veredito`).
6. **O AgentRxiv está destilado na §3.A** — não precisa abrir o repo deles.

## 1. Guardrails invioláveis (violar = PR rejeitado)

- **Correção de estado (verificada em `3df9242`):** a memória L3 (`lib/agent/memory.ts`, `createMongoMemory`) **existe mas NÃO está ligada**: `configureMemory()` (`lib/agent/memory-provider.ts:33`) **não tem nenhum chamador** no repo, e **não existe função de embedding** (grep por `gemini-embedding-001`/`embedContent` só acha comentários; `@google-cloud/vertexai` é só geração). Hoje `getMemory()` devolve `nullMemory` em produção: `memory_search`, `wakeUp`, o `🔖` da Fatia 4 e o resumo do comitê são **no-op silenciosos**. A prospecção manda "reusar a máquina da L3" para S4/A7/S8 — **antes é preciso ligá-la (PR-M0)**. Nenhum dos outros PRs desta fatia pode presumir embeddings sem o M0.
- **Embeddings só pelo Vertex** (`gemini-embedding-001` no endpoint `:predict` do Vertex, mesma credencial de `vertexCredentials()`), **nunca** pela API key do `@google/generative-ai` (free tier treina com o conteúdo — §8.10). Texto de aluno embeddado = dado de aluno.
- **Uma máquina de busca, não três.** `lib/busca/semantica.ts` (M0) extrai de `memory.ts` os pipelines `$vectorSearch`/`$search`/`$rankFusion` + RRF numa fábrica parametrizada (coleção, índices, filtro). `memory.ts` passa a usá-la **sem mudar comportamento** (seus testes continuam verdes); canal (S4) e Zxiv (A7) usam a mesma fábrica. Copiar o pipeline para outro arquivo = PR rejeitado.
- **Índices Atlas são manuais** (§8.14): `memory_drawers_vec`, `memory_drawers_text`, `canal_mensagens_vec`, `canal_mensagens_text`, `zxiv_papers_vec`, `zxiv_papers_text`. Sem índice: **degradar com aviso explícito** (resposta diz "busca semântica indisponível, usando texto"), **nunca** em silêncio, **nunca** derrubar rota. O runbook (`docs/RUNBOOK_INDICES_ATLAS.md`, M0) tem o JSON de cada índice.
- **Embedding fora do caminho crítico:** gerado em job (fila `embeddings`, molde `lib/canal/queue.ts`; fallback inline **após** responder) — nunca atrasa `POST mensagem`, nem o turno, nem o upload.
- **Flags off por padrão:** `MEMORIA_L3` (M0 — liga `configureMemory` no boot), `CANAL_ANEXOS` (S5), `CANAL_BUSCA` (S4), `ZXIV` (A7), `CANAL_CONTEXTO` (S8). Com tudo vazio: `getMemory()` segue `nullMemory`, sem upload, sem busca, sem mural, `N_CONTEXTO = 30` linear como hoje.
- **Zxiv é global** (um mural para todos os programas/canais — é isso que multiplica), **somente leitura para humanos**, **sem upvote/karma/hot** (§5 A7). Submissão só por agente (tarefa/programa), com gate de score + veredito + novidade. Rate limit por agente/dia → excedente vira `rev` de paper existente.
- **Anexo é dado do canal:** só `podeLer` baixa; 20 MB; nome sanitizado (`sanitizeId` de `lib/studio/storage.ts:20`); **nunca executar**; `Content-Disposition: attachment`; `img-src 'self'` (o render de markdown do agente **não** auto-carrega imagem remota — vetor de exfiltração, G6).
- **Anti-eco (S8):** fala de outro agente entra marcada e com peso menor; **só o que tem chave `zxc-` é evidência**; `Contexto.origem:"agente"` nunca vira chave (já é lei desde a Fatia 4). Ordem dos blocos **estável** (prefix cache do Vertex).
- **Não tocar:** `lib/agent/trajectory.ts`; o protocolo do cliente do chat; `lib/scholar/retrieve.ts`; `lib/plans.ts`.
- **Erros via `messageForError`**: adicione `busca_semantica_indisponivel`, `anexo_invalido`, `anexo_grande`, `zxiv_novidade`, `zxiv_veredito`, `zxiv_teto`, `embedding_indisponivel`.
- **Licença:** AgentRxiv (MIT) → linha em `docs/FONTES_BASE.md` ("Zxiv — AgentRxiv `app.py` (MIT) — REFERÊNCIA: mural + busca por similaridade; corrigido com linhagem, dedup por novidade e gate de qualidade").
- **Verificação:** `npx tsc --noEmit` limpo + `npx vitest run` verde por PR (CI `build-test`). `generate` só com schema novo; `db push`. **Nunca `next build` no loop.** Testes de busca com `FakeCollection` (padrão de `lib/agent/memory.test.ts:32-36`), nunca com Atlas.
- **1 PR por passo**, branch `escritorio/fatia5-<passo>-<slug>`, ≤ ~8 arquivos, descrição citando contrato e flag.

## 2. Importe, não reescreva (símbolo existente = import)

| O que | Onde (verificado) |
|---|---|
| Memória L3 (a máquina) | `lib/agent/memory.ts` — `EMBED_DIM = 1536 :23`, `DEFAULT_K :25`, `VECTOR_INDEX :27`, `Drawer :38`, `MemoryScope :58`, `RecallHit :65`, `MemoryAPI :69`, `DrawerCollection :81`, `EmbedFn :90`, `MemoryDeps :97`, `rrfFuse :131`, `reRank :159`, `TEXT_INDEX :186`, `projectStage :189` (não exportado), **`createMongoMemory :205`** (pipelines internos `vectorPipeline/textPipeline/rankFusionPipeline` ~`:216-235`, `recall :264-285`, `write :290-328`) |
| Provider (seam) | `lib/agent/memory-provider.ts` — `configureMemory :33` (**sem chamador**), `isMemoryConfigured :41`, `getMemory :44`, `writeTurnMemory :79`, `wakeUpContext :89`, **`mongoDrawerCollection :114`** (adapter Mongo driver) |
| Mongo driver | `src/lib/db.ts` — `clientPromise :13` (default export `connectToDatabase :62`) · `mongodb ^6.21` em `package.json:93` |
| Credencial Vertex | `lib/ai/vertex-credentials.ts` `vertexCredentials() :13` (`project`, `location`, `client_email`, `private_key`) · `google-auth-library` já vem **transitiva** de `@google-cloud/vertexai` (`package.json:58`) — adicione como dep direta |
| Boot node-only | `instrumentation-node.ts` — `iniciarWorkers :20` (molde de boot sob flag), `iniciarWorkerCanalOpcional :13` |
| Fila (molde) | `lib/canal/queue.ts` (`filaLigada`, `jobIdDe`, fallback inline, worker) |
| Storage de arquivos | `lib/studio/storage.ts` — `studioDir :15`, `sanitizeId :20`, `studioFilePath :28`, `writeStudioFile :32`, `readStudioFile :39`, `studioFileExists :43` · upload multipart molde: `app/api/aulas/audio/route.ts:28-38` (`formData`, `Blob`, `size`, `arrayBuffer`, `writeStudioFile`) · `prisma` `model StudioArtifact :689-703` (`kind`, `mime`, `storageRef`, `meta`) |
| PDF → texto | `lib/scholar/pdf.ts` — `extractPdfParagraphs :89`, `splitParagraphs :70`, `extractPdfStructured :51` (pdf-loader quando disponível) |
| Mensagem/canal | `prisma` `model CanalMensagem` (após S1/S3: `parentId`, `fixadoEm`, `taskId`), `model Canal :1061` · `app/api/canal/[id]/mensagem/route.ts` (`POST :17`, `create :34`) · `lib/canal/server.ts` (`paraWire`, `sessaoUsuario`, `isObjectId`) · `lib/canal/gate.ts` (`podeLer :16`) |
| Turno (o que S8 substitui) | `lib/canal/agent-turn.ts` — `N_CONTEXTO = 30 :19`, `findMany :38`, `montarHistorico :69`, `blocoCanal :90`, `executarTurno :145` · adaptador `lib/agent/aura-harness.ts` — `preambleBlock :124-136` (ordem: `systemContext` → histórico), `historicoNoOrcamento`, `ORCAMENTO_HISTORICO` |
| Cache de prefixo | `lib/ai/contextCache.ts` (`PDF_CACHE_*`, `isCacheableEstimate :36`) — só ajuda com **prefixo estável** |
| Citação (C4) | `lib/agent/citacao.ts` — `Contexto{origem: "academico"\|"web"\|"anexo"\|"memoria"}`, `contextosDe`, `chaveDe`, `passaporte` |
| Qualidade (C11) | `lib/agent/examiner.ts` — `scorePaper`, `veredito` · `lib/agent/contracts.ts` `ExaminerVerdict :149` |
| Tarefa (C1) | `lib/canal/tarefas.ts`, `lib/canal/tarefa-run.ts` (entrega = `ResearchWork`) |
| Seções | `lib/tcc/secoes.ts` `Secao :13` · `prisma` `model ResearchWork :527` (`secoes`, `rev`) |
| Tools (registry) | `lib/agent/runtime.ts` — `registerTool :123`, `permit :89`, `literatureSearchDef :239` (onde o anexo entra como fonte local), `memorySearchDef` |

## 3. Os contratos que esta fatia CRIA (texto final — copie, não reinterprete)

### M0 · Embedding + fábrica de busca (pré-requisito, não contrato do handoff — mas tudo depende dele)

```ts
// lib/ai/embed.ts — gemini-embedding-001 via Vertex :predict (NUNCA API key)
export const EMBED_MODEL = process.env.EMBED_MODEL || "gemini-embedding-001";
export const embedVertex: EmbedFn;   // (texts, dim = EMBED_DIM) → number[][]; lotes de 20; timeout 15s; erro → throw classificado (ledger C5 opcional: surface "embedding")
// lib/busca/semantica.ts — a máquina, parametrizada (extraída de memory.ts sem mudar comportamento)
export type BuscaConfig = { colecao: DrawerCollection; indiceVetor: string; indiceTexto: string; camposTexto: string[]; projecao: Record<string, unknown>; embed: EmbedFn; supportsRankFusion?: boolean };
export type Hit<T> = T & { score: number };
export function criarBusca<T>(cfg: BuscaConfig): {
  buscar(query: string, filtro: Record<string, unknown>, k?: number): Promise<{ hits: Hit<T>[]; modo: "hibrido" | "vetor" | "texto" | "indisponivel"; aviso?: string }>;
  vetorCru(query: string, filtro: Record<string, unknown>, k?: number): Promise<Hit<T>[]>;    // similaridade real (novidade do Zxiv, curadoria)
  embedar(textos: string[]): Promise<number[][]>;
};
```
`modo` é **sempre** devolvido: `"texto"`/`"indisponivel"` quando o índice vetorial falha (erro do Atlas com `index not found`/`$vectorSearch`) — e vem com `aviso` pronto para a UI/agente. `memory.ts` passa a chamar `criarBusca` com `{colecao: drawers, indiceVetor: VECTOR_INDEX, indiceTexto: TEXT_INDEX, camposTexto: ["text","room","wingLabel"], projecao: <a do projectStage>}`.

### S5 · Anexo

```prisma
// model CanalMensagem (aditivo)
  anexos Json?   // [{ id, kind: "pdf"|"imagem"|"csv"|"texto"|"outro", nome, mime, bytes, storageRef, artifactId, textoExtraido?: boolean }]
```
```ts
// lib/canal/anexos.ts (PURO + storage)
export const ANEXO_MAX_BYTES = 20 * 1024 * 1024;
export const MIMES = { "application/pdf": "pdf", "image/png": "imagem", "image/jpeg": "imagem", "image/webp": "imagem", "text/csv": "csv", "text/plain": "texto", "text/markdown": "texto" } as const;
export function validarAnexo(f: { size: number; type: string; name: string }): { ok: true; kind: Kind; nome: string } | { ok: false; code: "anexo_invalido" | "anexo_grande" };
export function contextosDeAnexo(anexo: Anexo, trechos: string[]): Contexto[];   // origem "anexo", fonte = nome, url = `/api/canal/<id>/anexo/<anexoId>`, chave via chaveDe
```
`StudioArtifact{ kind:"file", ownerId, title: nome, mime, storageRef: ext, meta: { canalId, msgId, bytes, texto?: string /* PDF/CSV/texto extraído, ≤ 200k chars */ } }`. O texto extraído alimenta (a) o `literature_search` como **fonte local** (chave própria) e (b) o embedding do anexo (M0) para a busca do canal.

### C9 · `ZxivPaper`

```prisma
model ZxivPaper {
  id             String   @id @default(auto()) @map("_id") @db.ObjectId
  slug           String   @unique                 // "cafeina-enfermagem-2026-10-07-a1b2"
  titulo         String
  resumo         String                           // ≤ 1200 chars — é o que se embedda
  corpo          String                           // markdown
  secoes         Json                             // Secao[]
  autorAgentKey  String
  coautores      String[] @default([])
  programId      String?  @db.ObjectId
  cycleId        String?  @db.ObjectId
  taskId         String?  @db.ObjectId
  ownerId        String   @db.ObjectId            // humano responsável (Moltbook claim)
  parentPaperIds String[] @default([])            // linhagem/citação entre papers (o que o original não tem)
  fontes         Json                             // Material Passport (C4)
  metricas       Json?
  score          Json                             // ScorePaper (C11)
  veredito       String                           // VERIFIED | FAILED | UNVERIFIED | INCONCLUSIVE
  novidade       Float    @default(1)             // 1 − maior similaridade contra o corpus
  embedding      Float[]                          // EMBED_DIM
  status         String   @default("submetido")   // rascunho | submetido | aceito | rejeitado | superseded
  supersededBy   String?  @db.ObjectId
  rev            Int      @default(1)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([autorAgentKey, createdAt])
  @@index([programId, createdAt])
  @@index([status, createdAt])
  @@map("zxiv_papers")
}
```
```ts
// lib/zxiv/gate.ts (PURO) — o que o AgentRxiv não tem
export const LIMIAR_SCORE = 6, LIMIAR_NOVIDADE = 0.25, TETO_SUBMISSOES_DIA = 3;
export function gateDeSubmissao(p: { score: ScorePaper; veredito: Veredito; similares: { slug: string; score: number }[]; submissoesHoje: number }):
  | { ok: true; novidade: number; parentPaperIds: string[] }                                       // parentPaperIds = similares acima de 0.5 (cite-os)
  | { ok: false; motivo: "score" | "veredito" | "novidade" | "teto"; sugestao?: string; parentPaperIds?: string[] }; // "isto já existe em <slug>, cite e avance"
export function slugDe(titulo: string, at: Date, seed: string): string;
```
Rotas: `POST /api/zxiv` (só server-to-server: tarefa/programa — exige `Authorization: Bearer ${ZXIV_INTERNAL_KEY}` **ou** sessão de super admin; humano comum **não** submete), `GET /api/zxiv?programId=&autor=&cursor=` (feed), `GET /api/zxiv/search?q=&k=` (semântica via `criarBusca`), `GET /api/zxiv/[slug]`. Tool `zxiv_search` (registry; `risk:"read"`) para a fase `gather` ler o mural **antes** das bases externas (A9 vai exigir; aqui a tool nasce e o `plan` do harness a inclui quando `ZXIV=1`). Achados do Zxiv entram como `Finding{source:{title, url:"/zxiv/<slug>"}}` com `Contexto.origem:"memoria"`? **Não** — origem nova `"zxiv"` (aditivo ao C4) e chave `zxc-` normal: paper aceito **é** evidência citável, com linhagem.

### §3.A · O molde (AgentRxiv `app.py`, destilado) e o que corrigimos

**O original (170 linhas, Flask + SQLite + `all-MiniLM-L6-v2`):** `Paper{id, filename, text}`; `/upload` guarda o PDF e extrai o texto (PyPDF2); `/search` e `/api/search` embedam a query **e todos os papers a cada busca** (`model.encode(paper_texts)`) e ordenam por cosseno; `/uploads/<file>` serve o PDF; `/view/<id>`; `run_app` **apaga o banco ao subir**. Sem metadados, sem autor, sem citação entre papers, sem dedup, sem gate — e o pipeline do Agent Laboratory cita por `AgentRxiv:ID_n`.

**O que mantemos:** mural único e global, busca por similaridade da query contra o corpus, leitura obrigatória antes de escrever (A9), id legível para citar (`zxiv:<slug>` em vez de `AgentRxiv:ID_n`).
**O que corrigimos:** embedding persistido (`embedding` no documento + índice Atlas; nunca re-embeddar o corpus por busca), metadados + autor/coautores/programa/dono, **`parentPaperIds`** (linhagem), **novidade** (= 1 − maior similaridade; abaixo do limiar rejeita com "isto já existe em `<slug>`, cite e avance" e `parentPaperIds` pré-preenchido), **gate de qualidade** (score C11 ≥ limiar e veredito ≠ FAILED), **rate limit** por agente/dia (excedente vira `rev`), `status`/`supersededBy`, e **nenhum `drop` do banco no boot**.

## 4. OS PASSOS (ordem executável; pare e reporte 1 linha em cada gate)

### PASSO 1 — PR-M0 · Ligar a memória L3 + fábrica de busca
Branch `escritorio/fatia5-m0-ligar-l3`. Flag `MEMORIA_L3` (boot), `ATLAS_RANK_FUSION` (`"1"` quando o cluster ≥ 8.1), `EMBED_MODEL`.
1. **`lib/ai/embed.ts`** (`embedVertex`): `google-auth-library` `GoogleAuth({ credentials: {client_email, private_key}, scopes: ["https://www.googleapis.com/auth/cloud-platform"] })` de `vertexCredentials()`; `POST https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${EMBED_MODEL}:predict` com `{ instances: texts.map(t => ({ content: t, task_type: "RETRIEVAL_DOCUMENT" })), parameters: { outputDimensionality: dim } }` (query usa `RETRIEVAL_QUERY` — parâmetro `tipo` no `EmbedFn`? **Não altere o tipo `EmbedFn`**: exporte `embedVertex` (documentos) e `embedConsulta` (queries) e passe as duas pela `BuscaConfig` como `embed`/`embedQuery?` — `embedQuery` opcional, default = `embed`); lotes de 20; timeout 15s; `C5` opcional (`gerar` não se aplica — grave direto no ledger com `model: EMBED_MODEL`, `surface: ctx.surface`, tokens de `metadata.billableCharacterCount` quando vier). Adicione `google-auth-library` como dependência direta.
2. **`lib/busca/semantica.ts`** (`criarBusca`, §3): mova para cá `vectorPipeline`/`textPipeline`/`rankFusionPipeline`/`projectStage` de `memory.ts:189-235` parametrizados; `buscar` = o `recall` atual **sem** `reRank`/`bump` (que são da memória) e **com** detecção de índice ausente → `modo:"texto"` (só `$search`) → `modo:"indisponivel"` (regex no `texto` via `colecao.aggregate([{ $match: { ...filtro, [campo]: { $regex } } }])`) — sempre com `aviso`. **`memory.ts`** passa a usar `criarBusca` (mesmos índices/filtros; `reRank`+`bump` ficam nela) — **`lib/agent/memory.test.ts` continua verde sem edição**.
3. **Boot:** `instrumentation-node.ts` ganha `iniciarMemoriaL3()` (chamada em `instrumentation.ts` sob `MEMORIA_L3=1`, molde do canal-worker): `const db = (await clientPromise).db(); configureMemory({ drawers: mongoDrawerCollection(db.collection("memory_drawers"), ObjectId), embed: embedVertex, supportsRankFusion: process.env.ATLAS_RANK_FUSION === "1" })`. Rodar no **web e no worker**. `/api/health` ganha `memoriaL3: "on" | "off"` (= `isMemoryConfigured()`).
4. **`docs/RUNBOOK_INDICES_ATLAS.md`**: JSON de cada índice (vetor: `{"fields":[{"type":"vector","path":"embedding","numDimensions":1536,"similarity":"cosine"},{"type":"filter","path":"userId"}]}` para `memory_drawers_vec`; `canal_mensagens_vec` com filter `canalId`; `zxiv_papers_vec` com filter `status`) + índices de texto (`$search` dynamic nos campos) + como verificar (`db.collection.aggregate([{$listSearchIndexes:{}}])`) + o aviso que a UI mostra quando falta. `.env.example`: `MEMORIA_L3=""`, `ATLAS_RANK_FUSION=""`, `EMBED_MODEL=""`.
5. **Testes:** `embed.test.ts` (`fetch` mockado: lotes de 20, `outputDimensionality`, `task_type` por função, erro vira throw classificado — **sem rede**); `semantica.test.ts` com `FakeCollection` (`aggregate` que simula: índice ok → hits; erro `index not found` → cai para texto com `aviso`; texto também falha → regex; `modo` correto em cada degrau; `rrfFuse` ainda aplicado no híbrido); `memory.test.ts` **intacto e verde**; `health` devolve `memoriaL3`.
**Gate M0:** com `MEMORIA_L3=1` em dev (Atlas com os dois índices de `memory_drawers` criados pelo runbook), `memory_search` devolve um drawer gravado no turno anterior e `/api/health` diz `memoriaL3:"on"`; sem índice, `memory_search` devolve `modo:"texto"` com aviso no log e o chat **não quebra**; flag off → `nullMemory` como hoje; `vitest` antigo verde. **Reporte:** `PASSO 1: verde/vermelho + saída do $listSearchIndexes e 1 hit real`.

### PASSO 2 — PR-S5 · Upload no canal vira fonte
Branch `escritorio/fatia5-s5-anexos`. Flag `CANAL_ANEXOS`; `recursos.anexos`.
1. **Schema** `anexos Json?` → `generate` + `db push`. **`lib/canal/anexos.ts`** (§3). **Rotas:** `POST /api/canal/[id]/anexo` (multipart, molde `aulas/audio:28-38`; `podeEscrever`; `validarAnexo`; `writeStudioFile(id, ext)`; `StudioArtifact{kind:"file"}`; **extração de texto** para PDF (`extractPdfParagraphs :89`, ou `extractPdfStructured` se o pdf-loader estiver de pé), CSV e texto (≤ 200k chars) gravada em `meta.texto`; devolve `{anexo}` para o cliente anexar ao `POST mensagem` — **o upload não cria a mensagem**; a mensagem cita `anexos: [{id…}]`); `GET /api/canal/[id]/anexo/[anexoId]` (`podeLer`; `readStudioFile`; `Content-Disposition: attachment; filename="<nome sanitizado>"`; `X-Content-Type-Options: nosniff`; PDF/imagem podem ser `inline` quando `?inline=1` e o mime é da allowlist). `POST mensagem` aceita `anexos: string[]` (ids de artifacts do **mesmo usuário e canal**) e grava o `Json`.
2. **Fonte local (C4):** `literatureSearchDef.run` (`runtime.ts:239`) com `CANAL_ANEXOS=1` e `ctx.canalId`: antes das bases externas, lê os anexos do canal com `meta.texto`, faz match léxico simples (termos da query nos parágrafos, top 5 por anexo) e devolve `Finding{claim: trecho, source:{title: nome, url: "/api/canal/<id>/anexo/<anexoId>"}, confidence:"alta"}` com `provenance.origem:"anexo"` → `contextosDe` gera chave `zxc-` com `origem:"anexo"`. Resposta cita o anexo, não a internet. Embedding dos parágrafos do anexo → fila `embeddings` (M0) em `canal_mensagens`? **Não**: o anexo vira **drawers na memória do canal** (`wing:{kind:"agente", label:"canal/<id>"}`, `kind:"artefato"`, `sourceRef: anexoId`, `text` = parágrafo verbatim) via `getMemory().write` quando `isMemoryConfigured()` — é assim que a busca semântica do canal (S4) e o `memory_search` o acham sem índice novo.
3. **UI:** botão 📎 no `Composer` (≥44px), chip do anexo na `Bolha` (nome, tamanho, ícone por `kind`, abre a rota `inline` para PDF/imagem), progresso de upload; imagem **do anexo** pode renderizar inline (é `self`); markdown de agente **não** carrega `<img>` remoto (sanitizador: allowlist `src` começando com `/api/canal/`).
4. **Erros:** `anexo_invalido` ("Só PDF, imagem, CSV ou texto."), `anexo_grande` ("Até 20 MB.").
5. **Testes:** `anexos.test.ts` (validação por mime/tamanho; nome sanitizado; `contextosDeAnexo` gera chaves com `origem:"anexo"`); rota upload (IDOR A/B/C; 413; mime proibido 400; PDF → `meta.texto` preenchido com `extractPdfParagraphs` mockado); rota download (`attachment` por default; `inline` só na allowlist; C fora → 403); `runtime.test.ts` (`literature_search` com anexo relevante devolve o trecho do anexo **antes** de chamar `retrievePapers`).
**Gate S5:** jogar um PDF na sala e perguntar `@mentor o que esse anexo diz sobre X` responde **citando o anexo** (chave `zxc-` com `origem:"anexo"`, link para `/api/canal/…/anexo/…`), não a internet; download por quem não `podeLer` → 403; 25 MB → 413; flag off → sem 📎 e rotas 404. **Reporte:** `PASSO 2: verde/vermelho + a citação do anexo`.

### PASSO 3 — PR-S4 · Busca no canal (texto + semântica) + tool `canal_search`
Branch `escritorio/fatia5-s4-busca`. Flag `CANAL_BUSCA`; `recursos.busca: "hibrido" | "texto"`.
1. **Embedding das mensagens** (fora do caminho crítico): fila `embeddings` (`lib/queue/embeddings.ts`, molde `lib/canal/queue.ts`, `jobId = "msg:" + msgId`), disparada pelo `POST mensagem` **depois** de responder; o worker (`EMBEDDINGS_WORKER=1`) grava `CanalMensagem.embedding Float[]` (campo novo, `generate` + `db push`) com `embedVertex`; sem Redis → inline após o `return` (`void`). Mensagens de agente também embeddam. **Índice Atlas `canal_mensagens_vec`** (filter `canalId`) + `canal_mensagens_text` — runbook do M0.
2. **`lib/canal/busca.ts`:** `buscarNoCanal(db, { canalId, q, filtros: { autorId?, agentKey?, soThreads?, de?, ate?, soComFonte? }, k })` via `criarBusca({ colecao: canal_mensagens, indiceVetor: "canal_mensagens_vec", indiceTexto: "canal_mensagens_text", camposTexto: ["texto"], … })` com `filtro: { canalId, excluidoEm: null, …filtros }`; `soComFonte` = `mencoes`/`provenance` com chave `zxc-` (mensagem de agente com `provenance.sources[].key`). Devolve `{ hits, modo, aviso }`.
3. **Rotas:** `GET /api/canal/[id]/busca?q=&…` (`podeLer`) e `GET /api/canal/busca?q=` (global: só canais onde `podeLer`, `take` por canal, união ordenada por score). Resposta sempre com `modo` e `aviso` ("busca semântica indisponível, usando texto").
4. **Tool `canal_search`** (registry, `risk:"read"`): `{ query, k? }`, exige `ctx.canalId`; devolve `Finding[]` **sem chave** (mensagem de humano/agente não é evidência — `confidence:"baixa"`, `provenance.origem:"canal"`); serve para o agente **não repetir pergunta já discutida** e para o S8. Entra no `INTENTS[*].tools`? **Não** (contrato alheio): o `plan` do harness recebe a tool por `hctx.toolsExtra` (aditivo no adaptador) quando `CANAL_BUSCA=1` e há `canalId`.
5. **UI:** campo de busca no topo do canal (≥44px), resultados como lista de `Bolha` compacta com "ir para" (scroll + highlight; abre a thread se `parentId`), chips de filtro, faixa com o `aviso` quando `modo !== "hibrido"`.
6. **Testes:** `busca.test.ts` (`FakeCollection`: filtro sempre inclui `canalId` e `excluidoEm:null`; `soComFonte`; degraus `hibrido → texto → indisponivel` com aviso); rotas (IDOR; global não vaza canal de C; `q` vazio 400); `queue/embeddings.test.ts` (jobId idempotente; inline sem Redis não bloqueia a resposta — a rota devolve antes); `runtime.test.ts` (`canal_search` sem `canalId` → `bad_args`; findings sem chave).
**Gate S4:** buscar por **sinônimo** acha a mensagem (com índice vetorial em dev); sem índice, a resposta diz "busca semântica indisponível, usando texto" e ainda acha por termo exato; busca global nunca devolve canal que o usuário não lê; o agente, perguntado algo já discutido, responde "isso já foi discutido aqui: …" via `canal_search` (teste do harness com tool mockada). **Reporte:** `PASSO 3: verde/vermelho + modo/aviso nos 3 degraus`.

### PASSO 4 — PR-A7 · Zaeon Rxiv (nasce C9)
Branch `escritorio/fatia5-a7-zxiv`. Flag `ZXIV`; `ZXIV_INTERNAL_KEY` (🔒); `ZXIV_TETO_DIA` (3), `ZXIV_LIMIAR_SCORE` (6), `ZXIV_LIMIAR_NOVIDADE` (0.25).
1. **Schema** `ZxivPaper` (§3) → `generate` + `db push`; índices Atlas `zxiv_papers_vec` (filter `status`) + `zxiv_papers_text` (runbook). **`lib/zxiv/gate.ts`** (§3, puro) + **`lib/zxiv/store.ts`** (`submeter(db, busca, input)`: embedda `resumo` → `vetorCru` top-5 em `status:"aceito"` → `gateDeSubmissao` → cria `aceito` (ou devolve rejeição com sugestão) → `rev`: se `submissoesHoje ≥ teto` **e** existe paper aceito do mesmo autor com similaridade ≥ 0.8 → atualiza esse (`rev+1`, `supersededBy` no anterior) em vez de criar; `buscar(busca, q, k)`; `feed`; `porSlug`).
2. **Rotas** (§3): `POST /api/zxiv` (server-to-server ou super admin), `GET /api/zxiv`, `GET /api/zxiv/search`, `GET /api/zxiv/[slug]`. Resposta de busca sempre com `modo`/`aviso`.
3. **Quem submete hoje:** `tarefa-run` (Fatia 3), ao concluir uma tarefa `kind:"dossie"` com `veredito ∈ {VERIFIED, INCONCLUSIVE}` e `score.overall ≥ limiar`, chama `submeter` com `autorAgentKey`, `ownerId = requesterId`, `fontes = passaporte`, `score`/`veredito` do `critique`; rejeição por novidade vira **uma linha** na entrega ("já existe no Zxiv: `<slug>` — citei e avancei") e `parentPaperIds` entram no dossiê. A9 (Fatia 6) passa a submeter por ciclo.
4. **Tool `zxiv_search`** (registry, `risk:"read"`): `Finding{claim: resumo, source:{title, url:"/zxiv/<slug>"}, confidence: veredito==="VERIFIED" ? "alta" : "média"}` com `provenance.origem:"zxiv"`; `contextosDe` aceita `"zxiv"` como origem citável (aditivo ao C4). O `plan` do harness coloca `zxiv_search` **antes** de `literature_search` quando `ZXIV=1` (via `hctx.toolsExtra` + ordem no adaptador — sem tocar `INTENTS`).
5. **Mural `/zxiv`** (`app/zxiv/page.tsx`, somente leitura, vidro claro===escuro): lista por recência com autor (avatar do roster), programa, veredito (selo), score, `novidade`; página do paper com seções, Material Passport e **linhagem** (`parentPaperIds` como lista de links; grafo simples CSS). Sem upvote/karma/hot. Link "abrir na Sala de Pesquisa" quando houver `ResearchWork` associado (`taskId`).
6. **Erros:** `zxiv_novidade` ("Isto já existe no Zxiv em `<slug>` — cite e avance."), `zxiv_veredito`, `zxiv_teto`.
7. **Testes:** `gate.test.ts` (score abaixo → `score`; FAILED → `veredito`; similaridade 0.8 → `novidade` com sugestão e `parentPaperIds`; teto 3 → `teto`; `slugDe` estável e único); `store.test.ts` (`FakeCollection`: submissão aceita grava `embedding` e `novidade`; teto → `rev` do existente com `supersededBy`; busca com índice ausente → `modo:"texto"` + aviso); rotas (`POST` sem key/admin → 401; humano logado → 403; `GET` públicos para logados); `tarefa-run.test.ts` (dossiê VERIFIED submete; FAILED não; rejeição por novidade vira linha na entrega e `parentPaperIds` no dossiê); `citacao.test.ts` (`origem:"zxiv"` gera chave).
**Gate A7:** dois canais distintos: a tarefa do canal A (dossiê 2) **cita** (`parentPaperIds` + chave `zxc-` com `origem:"zxiv"`) um paper submetido pela tarefa do canal B; uma submissão quase idêntica é **rejeitada por novidade** com "já existe em `<slug>`"; `GET /api/zxiv/search` devolve resultado com o índice criado e **degrada com aviso** sem ele; `/zxiv` mostra a linhagem; flag off → rotas 404, tool ausente, mural inexistente. **Reporte:** `PASSO 4: verde/vermelho + o slug citado entre canais`.

### PASSO 5 — PR-S8 · Contexto por thread e relevância (aposenta `N_CONTEXTO = 30`)
Branch `escritorio/fatia5-s8-contexto`. Flag `CANAL_CONTEXTO`.
1. **`lib/canal/contexto.ts`** (PURO na montagem; a busca vem injetada): `montarContexto({ canal, agente, root?, thread, fio, fixadas, relevantes, resumosReunioes, orcamento }) → { blocos: Bloco[]; historico: GerarArgs["history"]; systemContextExtra: string }` com **cinco blocos rotulados em ordem FIXA**: `(a) === FIXADAS ===` (até 10) · `(b) === THREAD ===` (root + respostas, teto `CTX_THREAD = 40`) · `(c) === FIO (recentes) ===` (últimas `CTX_FIO = 12` do fio **excluindo** a thread) · `(d) === RELEVANTES (busca) ===` (top `CTX_RELEVANTES = 8` por `buscarNoCanal(objective)` com `soComFonte` primeiro; cada item com `score`, `createdAt`, autor) · `(e) === RESUMOS DE REUNIÕES ===` (últimas 3 notas `comite/<canalId>` da memória, quando configurada). Orçamento por bloco em chars (`ORCAMENTO_CTX = { fixadas: 2000, thread: 8000, fio: 4000, relevantes: 4000, resumos: 2000 }`); corte sempre pelo **mais antigo** dentro do bloco. **Anti-eco:** mensagem de **outro agente** entra prefixada `[agente @key — opinião, não evidência]` e **não** é duplicada em (c) se já está em (b); mensagem com `provenance.sources[].key` entra com `[com fonte]`. **Ordem estável + blocos antes do histórico** → o prefixo do prompt muda só na cauda (prefix cache do Vertex).
2. **`agent-turn.ts`:** com `CANAL_CONTEXTO=1`, `executarTurno` troca `findMany(take: N_CONTEXTO)` + `montarHistorico` por `montarContexto(…)` (histórico = (b)+(c) como `history`; (a)+(d)+(e) como `systemContext` **antes** de `blocoCanal`); sem flag, caminho atual intacto. `N_CONTEXTO` fica como default do caminho legado.
3. **Testes:** `contexto.test.ts` (ordem fixa dos blocos; orçamentos cortam pelo mais antigo; thread não duplica no fio; outro agente vem marcado e não duplicado; `[com fonte]` só com chave; sem busca configurada → bloco (d) ausente **e a ordem dos demais não muda**); `agent-turn.test.ts` (flag on: resposta ao assunto da thread com fixture de 200 mensagens e 3 agentes — o `gerar` fake recebe a thread e **não** recebe 190 mensagens de ruído; **teste de eco:** dois agentes concordando sem fonte não aparecem como `Finding` nem como `Contexto`; tokens de prompt medidos (chars) **caem** vs. o caminho `N_CONTEXTO`); snapshot do prefixo (blocos a+d+e) estável entre dois turnos com o mesmo objetivo.
**Gate S8:** canal com 200 mensagens e 3 agentes: o mentor responde ao assunto da thread; chars de prompt caem ≥ 30% vs. o linear (número no reporte); eco não produz conclusão; flag off = `N_CONTEXTO` como antes. **Reporte:** `PASSO 5: verde/vermelho + chars antes/depois`.

### PASSO 6 — Verificação final da fatia (não pule)
1. `tsc` limpo · `vitest` verde (incl. `memory.test.ts` intacto) · CI `build-test` verde nos 5 PRs.
2. **Flags vazias** → `nullMemory`, sem 📎, sem busca, sem `/zxiv`, `N_CONTEXTO` linear: byte a byte como a Fatia 4.
3. **`docs/HANDOFF_FATIA5_RESULTADO.md`**: ordem de ligar (**índices Atlas primeiro** pelo runbook → `MEMORIA_L3=1` → `CANAL_ANEXOS` → `CANAL_BUSCA` + `EMBEDDINGS_WORKER` → `ZXIV` + `ZXIV_INTERNAL_KEY` → `CANAL_CONTEXTO`), rollback (flag vazia; anexos/papers já gravados seguem legíveis), e medidas do handoff §9 "conhecimento": papers aceitos vs rejeitados por novidade, citações órfãs = 0, % de buscas em `modo:"texto"` (índice faltando = alarme), chars de prompt por turno antes/depois do S8.
**Gate:** os 3 itens, binários.

## 5. Decisões assumidas pelo Fable (valem até o Martinez vetar — leia antes do PASSO 1)

1. **PR-M0 existe porque a L3 não está ligada** (correção de estado da §1). Sem ele, "reusar a máquina da L3" seria reusar um no-op. É o menor PR da fatia e desbloqueia também o `🔖` e o resumo do comitê da Fatia 4.
2. **Embeddings pelo Vertex `:predict` com `google-auth-library`**, não pelo `@google/generative-ai` (que está no `package.json` mas é API key = free tier = treina com dado de aluno, §8.10). Se o modelo `gemini-embedding-001` não estiver habilitado no projeto Vertex, `EMBED_MODEL=text-embedding-005` com `outputDimensionality` 1536 — mesma chamada.
3. **Fábrica única `criarBusca`** extraída de `memory.ts`, com `memory.test.ts` intacto como prova de "sem mudança de comportamento". Três cópias do pipeline = PR rejeitado.
4. **Ordem M0 → S5 → S4 → A7 → S8**: S5 não precisa de embeddings (match léxico + memória quando houver); S4 precisa do M0; A7 precisa do S4 (fábrica) e do C11; S8 precisa do S4 (busca) — e é o último porque muda o que o agente lê.
5. **Anexo vira drawers na memória do canal** (`wing agente/canal/<id>`) em vez de índice próprio: zero índice novo, e o `memory_search` já o acha. A busca semântica das **mensagens** (S4) é que ganha índice próprio (`canal_mensagens_vec`), porque mensagens não são "memória" curada.
6. **`canal_search` não produz evidência** (`origem:"canal"`, sem chave): humano e agente conversando não são fonte. O Zxiv **produz** (`origem:"zxiv"`, chave normal): paper aceito passou por gate C11 + novidade.
7. **Zxiv: humano não submete** (só tarefa/programa via key interna, ou super admin para moderar); humano lê. É o que mantém o mural como produto dos agentes, não um fórum.
8. **Rate limit = 3/dia por agente, excedente vira `rev`** só quando há paper aceito do mesmo autor com similaridade ≥ 0.8; senão o excedente é rejeitado por `teto` (não vira paper novo nem `rev` de paper alheio).
9. **S8 em cinco blocos com ordem fixa e orçamento em chars** (não tokens): determinístico, testável sem tokenizer; o C5 mede os tokens reais depois.
10. **`CANAL_CONTEXTO` é flag própria** (o handoff §7 não define uma para S8): mudar o que o agente lê é a mudança de maior risco da fatia e precisa de rollback independente.

## 6. Economia de execução (pedido do Martinez — leve a sério)

Agrupe edições por arquivo; não abra exploração (a §2 tem TODAS as âncoras, verificadas em `83d9b70`; a §3.A tem o AgentRxiv destilado); não re-explique contratos — a §3 é o texto final; pare em cada gate e reporte em 1 linha; gate vermelho 2 vezes → **PARE e pergunte ao Martinez**. Se o M0 quiser "só uma funçãozinha de embedding ali no memory.ts", pare: a fábrica é o PR. Se o A7 começar a ganhar upvote, hot ou karma, está fora do handoff. Se o S8 passar a escolher blocos "por relevância" em vez de ordem fixa, você matou o prefix cache. O valor está em cada gate verde, não em volume de código.
