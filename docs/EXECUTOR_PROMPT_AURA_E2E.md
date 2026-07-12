# PROMPT DE EXECUÇÃO — Claude Code (Opus) · Aura Agêntica ponta-a-ponta

> **Você é o EXECUTOR.** Todo o projeto já foi decidido, pesquisado e contratado em código.
> Você NÃO redesenha, NÃO reabre decisão, NÃO re-deriva tipo, NÃO explora o repo além das
> âncoras dadas. Você integra, verifica e **para em cada gate**. Co-autorado pelo Fable em
> 2026-07-11 a partir do `HANDOFF_EXECUTOR.md` + rodada de pesquisa (`AURA_AGENTIC_LAYER_PLAN.md §10.5`).

---

## 0. Leia antes de codar (só isto, nesta ordem)

1. `docs/HANDOFF_EXECUTOR.md` — **INTEIRO**. É a espinha: §6 (tarefa central), §7 (estados de UX), §8 (erros), §9 (ordem E2E), Apêndice A (transpile), **Apêndice C (âncoras de integração — use-as, não garimpe)**.
2. `docs/MEMORY_AND_PERSISTENCE.md` §4 e §7 — o L3 e a ordem L0→L3.
3. `docs/AURA_AGENTIC_LAYER_PLAN.md` — só §8 (contratos), §9.5–9.11 (agente/skills/conectores/admin), §11 (spec), §13 (runbook), §10.5 (pesquisa que fundamenta os aditivos abaixo).
4. `docs/PLANO_SKILLS_PRS.md` — só ao chegar no PASSO 9 (rename Plugin→Skill).

## 1. Guardrails invioláveis (violar = PR rejeitado)

- **Harness LIGADO POR PADRÃO em TODAS as salas** (estudos, pesquisa, aula, projetos, lounge). `AURA_HARNESS==="0"` é kill-switch de emergência → fallback Fase 0. Chat de IA fora do `runTrajectory` = bug.
- **Gemini é a IA única.** Nada de OpenAI/Anthropic no runtime.
- **Memória = STANDARD** (todas as contas). Plano gateia só compute T0–T3, nunca memória nem gestão de conectores.
- **Erros via `messageForError`** (`lib/agent/errors.ts`). Nunca escreva string de erro à mão.
- **UI:** manter o **⟁** (U+27C1, nunca ícone lucide) + idioma Apple liquid glass; UI nova = aditiva/opt-in, nunca trocar tela inteira.
- **Verificação:** `ts.transpileModule` (Apêndice A do handoff) + `vitest` em lógica pura. **NUNCA** `next build`/`prisma generate` no loop. Prisma = `npx prisma db push` (Mongo, sem migração). O mac **não tem `python`** — runtime python valida só em CI/VPS.
- **Compatibilidade de saída:** o harness responde no MESMO formato que `StudyCoworkChat`/`ResearchChat` já consomem (texto datilografado + sentinelas `@@STUDIO_ACTION@@`/`@@RESEARCH_ACTION@@`). Não toque no protocolo do cliente.
- **Provenance em todo `ToolResult`.** Memória verbatim (nunca resumida por LLM na escrita).
- **1 PR por passo**, branch `aura/harness-prNN-slug`, ≤ ~6 arquivos, 1 linha de CHANGELOG citando o contrato (§8/§11) encarnado. Nada mergeia com gate vermelho.

## 2. Importe, não reescreva (tudo isto transpila; símbolo existente = import)

`lib/agent/{contracts,router,runtime,trajectory,examiner,errors,memory,transcript,transcriptClient,tools,context,actions}.ts` · `app/api/ai/transcript/route.ts` · models `Conversation`/`ChatMessage` · `lib/plans.ts` (`planRank`/`planAtLeast`) · UI: `components/study/{StudioGeneratingCard,ApprovalCard,StructuredAnswerView}.tsx` + botão ⏹ no `CoworkComposer`. Helpers Gemini: `geminiJson` (`lib/scholar/gemini.ts:59`), `GEMINI_MODEL_FLASH/PRO` (`lib/ai/model.ts`).

## 3. Aditivos de pesquisa (obrigatórios; a justificativa de 1 linha de cada)

- **A1 · error-as-observation** (smolagents/OpenHands): `ToolResult{ok:false}` volta ao contexto do modelo como observação estruturada `{tool, code, error}` no próximo `reason`/`draft` — o modelo contorna; só fatal chega ao usuário. *Fecha o gap de erro-em-tool apontado pelo Martinez.*
- **A2 · retry numa camada só** (LangGraph): retry vive SÓ no adaptador (`runTool` wrapper) — 1 retry com backoff para `tool_timeout`/`network`/`rate_limited`; NUNCA para `tool_denied`/validação. Budget compartilhado desce a trajetória. *Mata retry-storm.*
- **A3 · degraded ≠ fatal** : gather com 0 findings ou output vazio emite `AgentStep` "degradado", não sucesso silencioso. *Falha silenciosa é o risco nº1 em produção.*
- **A4 · score no trace** (OTel GenAI/Langfuse): cada fase emite `AgentStep` com timing + `error.type` da taxonomia; `ExaminerVerdict.score` gravado no `provenance` do turno. *Crítica vira dado queryável, não prosa.*
- **A5 · evidence gate** (PaperQA2): em `criar_trabalho`, cada finding do gather é sumarizado *relativo à pergunta* e o draft só começa se houver evidência mínima (senão mais 1 gather). *Anti-blob.*
- **A6 · perspectivas no plan** (STORM): no `plan` de `criar_trabalho` (mode research), o prompt pede 2–3 perspectivas/personas de sub-perguntas antes de fechar os steps. *Cobertura sem custo de arquitetura.*
- **A7 · memória com curadoria ADD/SUPERSEDE/NOOP + invalidação** (mem0/Graphiti, verbatim-safe): detalhado no PASSO 5.
- **A8 · wakeUp = perfil pinado** (Letta core-block): detalhado no PASSO 5.
- **A9 · recall híbrido nativo** (`$rankFusion` Mongo 8.1+): detalhado no PASSO 5.
- **A10 · MCP: isolar o handshake** — a spec RC **2026-07-28** (finaliza em ~2 semanas) remove `initialize`/`Mcp-Session-Id`. Use o SDK oficial e nunca dependa de detalhes do handshake fora de 1 módulo. Detalhado no PASSO 7.

## 4. OS PASSOS (ordem executável; pare e reporte 1 linha em cada gate)

> Os passos 1–6 são o §9 do handoff, enriquecidos. Os passos 7–9 entregam os pilares
> Conectores/Admin e Skills. **Os 4 pilares têm peso igual — o PASSO 5 (memória) NÃO é
> opcional nem adiável: é entregável de 1ª classe, paralelizável após o PASSO 3.**

### PASSO 1 — `lib/agent/aura-harness.ts` (o adaptador `HarnessDeps`)
Esqueleto pronto no handoff §6 — siga-o. `plan`/`reason`/`draft` são as ÚNICAS chamadas de geração; `plan`+`critique` usam `GEMINI_MODEL_PRO` se `deepThinkEnabled`, senão Flash. `draft` PREENCHE os campos de `INTENTS[intent].required` (senão o `StructuredAnswerView` não tem o que separar). Aplique **A1** (observação de erro entra no contexto do próximo passo), **A2** (retry só aqui), **A5/A6** (nos prompts de gather/plan quando `intent==="criar_trabalho"`).
**Gate:** `transpileModule` ok em `aura-harness.ts`.

### PASSO 2 — Registrar tools como `ToolDef`
`studio_generate`/`research_generate` (runtime `ts`, endpoints no Apêndice C.7) e `memory_search` (runtime `ts`, `minPlan:"free"` — stub até o PASSO 5, devolve `{ok:false, code:"memory_unavailable"}`).
**Gate:** `vitest` — `runTool` nunca lança (tool que estoura → `{ok:false,error}`); `permit` nega < `minPlan`.

### PASSO 3 — Wiring `/api/ai/chat` + cobertura de TODAS as salas
Âncora C.1 (após `:220`, antes dos branches `:334`/`:385`). Branch `process.env.AURA_HARNESS !== "0" && agentKey==="aura"`. Saída no formato atual (datilografia/sentinelas); erros via `messageForError`; **A3** (gather vazio = degradado). Cobertura §6.0: estudos/pesquisa/aula/lounge via `surface` correto; **Projetos** entra no mesmo laço (`surface:"projetos"`; execução de código = tool/handoff dentro da trajetória). Feche com o grep de aceite: nenhum chat de IA fora do `runTrajectory`.
**Gate:** por sala — 1 turno de texto responde igual-ou-melhor, 1 pedido de artefato dispara a sentinela, 1 erro (tool negada) mostra a msg certa; `AURA_HARNESS="0"` = fallback legado idêntico.

### PASSO 4 — Render estruturado no cliente
Msg de resposta usa `StructuredAnswerView` (núcleo/desenvolvimento/conceitos/fontes/próximos-passos); artefato assíncrono usa `studio-pending`→`StudioBlock` (já existe no `StudyCoworkChat`; replique o cartão na Sala de Pesquisa — item O do §7).
**Gate:** conceitos/fontes/próximos-passos aparecem quando o `draft` os preenche.

### PASSO 5 — PR-M3 · Memória L3 (PRIMEIRA CLASSE — mesmo cuidado do motor)
Base: handoff §6.1 + `MEMORY_AND_PERSISTENCE.md §4`. Entregas:
1. **Model `MemoryDrawer`** (bloco §4.3) **+ campos novos**: `importance Int?`, `lastAccessedAt DateTime?`, `accessCount Int @default(0)`, `invalidatedAt DateTime?`, `supersededBy String?`. `npx prisma db push`.
2. **Índices Atlas:** Vector Search `memory_drawers_vec` (dims 1536, `cosine`, filter `userId`) + índice de texto (Atlas `$search` se disponível; senão `$text`).
3. **`memory_search` híbrido (A9):** cluster ≥ 8.1 → `$rankFusion` com sub-pipelines `$vectorSearch`+`$search` (pesos ~0.7/0.3); senão → 2 queries + fusão RRF app-side (k=60). Re-rank final: `rrf × exp(-λ·horasDesde(lastAccessedAt)) × pesoImportance`; bump `lastAccessedAt`/`accessCount` nos hits. Recall **sem LLM**, sempre `invalidatedAt:null`, **sempre filtrando `userId`**.
4. **`persistMemory` com curadoria (A7):** no `finalize`, candidatos passam por `isMemorable()` + nudge — top-k similares existentes → o modelo decide **só a operação** `ADD | SUPERSEDE | NOOP` (nunca reescreve texto; storage verbatim). `SUPERSEDE` seta `invalidatedAt`+`supersededBy` no antigo. Deriva do L1 (`sourceRef=conversationId/messageId`), com `provenance`.
5. **`wakeUp` (A8):** recall relevante → `AgentContext` **+ 1 doc "perfil" pinado por usuário** (objetivos/nível/preferências, pequeno) injetado sempre; o perfil é reconstruído em **background após o finalize** (nunca no hot path).
6. **Escada de degradação:** `$rankFusion` falha → text-only → só perfil pinado → sem memória. Writes em try/catch (fila ou descarte) — **nunca bloqueiam a resposta**. Quando degradado, injete 1 linha no prompt ("memória de longo prazo indisponível") pra IA não alucinar lembrança; usuário não vê erro (`memory_unavailable` silencioso).
**Gate:** `search` filtra `userId` sempre; `write` persiste verbatim+embedding; recall sem LLM devolve o drawer certo; Atlas fora do ar → chat segue limpo, sem poluição.

### PASSO 6 — PR-M2 + PR06 + PR07 + UX restante
- **PR-M2:** salas alimentam `setAgentContext`/`pushAgentAction` nas transições (âncora C.3 — assinatura é `(kind:string, detail?:string)`).
- **PR06 (trace real):** `AuraThinking.phases` lê os `AgentStep` do `emit` (mapa fase→rótulo no §7-C; GOTCHA C.4: `StepKind` é união fechada — mapeie para `kind:"say"` ou estenda). Aplique **A4** (timing + `error.type` + score no provenance).
- **PR07 (execMode):** `permit()` considera `ctx.execMode`; `approvalGate(phase, st)` após `plan`, antes de tool `write`/cara, antes de `finalize` quando `guiado`; renderiza `ApprovalCard` como msg do chat. HITL = estado próprio "aguardando você" (nunca erro).
- **UX §7:** M (mensagens de stop específicas via `messageForError`), O (cartão de geração na pesquisa), Q (fiar `onFiles`→`fileData`).
**Gate:** cada item da matriz §7 marcado sai de ⚠️/❌ para ✅; em `guiado` o laço pausa e retoma.

### PASSO 7 — PILAR CONECTORES · Cliente MCP + registry + **Admin em Opções** (§9.11)
1. **`lib/agent/mcp.ts`** — use `@modelcontextprotocol/sdk` (≥1.29, MIT): `Client` + `StreamableHTTPClientTransport` (url) / `StdioClientTransport` (comando). **A10:** todo o connect/initialize num módulo único e fino; o resto do código só vê `{listTools, callTool, ping, close}`.
2. **Dois canais de erro:** resultado com `isError:true` = falha de execução da tool → vira `ToolResult{ok:false}` (segue A1, o modelo reage); erro JSON-RPC/transporte = saúde do conector → vira `status` do Connector + `messageForError`. Não misture.
3. **Annotations → risk:** `readOnlyHint`/`destructiveHint` são *hints não confiáveis* — mapeie, mas default conservador: sem hint = `write` (cai no `REQUIRE_APPROVAL` do `permit`).
4. **Model `Connector`** (campos do §9.11: transport/endpoint/authType/authRef/status/lastCheckedAt/lastError/discoveredTools/enabledForAgents) + `db push`. Credenciais: **só `authRef`** (segredo em env/cofre, nunca no Mongo).
5. **Fluxo:** adicionar → handshake (`initialize` + `notifications/initialized` + `tools/list`) → cada tool vira `ToolDef runtime:"mcp"` (schema vindo do MCP) passando pelo `permit()` → **Testar conexão** (round-trip real: initialize→initialized→`tools/list`→`ping`; 401/`WWW-Authenticate` → `precisa_autorizar`; timeout/JSON-RPC → `erro` com a msg real) → ativar. Estados: `desconectado · verificando · conectado · precisa_autorizar · erro` (+ `degradado` se uma tool sumiu vs `discoveredTools` em cache).
6. **Admin:** 3 telas aditivas em **Opções** (menu inicial): **Skills** (liga/desliga por agente, tools expostas, runtime, minPlan) · **Conectores** (catálogo 1-clique + Testar conexão + chip de estado) · **MCP** (endpoint por URL/stdio, handshake visível, tools descobertas). ⟁ + liquid glass; nada de reescrever a tela de Opções.
7. **Catálogo (corrigido pela pesquisa, §10.5):** 1º smoke **LOCAL** = `oksure/openalex-research-mcp` (TS/npm, roda via `npx` — o mac não tem python); **flagship E2E** = `openags/paper-search-mcp` (MIT, python/stdio — valida no VPS/CI); `genomoncology/biomcp` (MIT) nas salas med/bio; oficiais `fetch/filesystem/git`. **NÃO incluir** `synthetic-sciences/openscience` (não é servidor MCP). `scholar-mcp` = experimental.
**Gate:** conectar o openalex-research-mcp via npx → tools reais aparecem no handshake → Testar conexão acende **verde**; derrubar o servidor → **vermelho** com msg do `messageForError`; 1 tool MCP roda dentro da trajetória passando pelo `permit()`.

### PASSO 8 — PILAR SKILLS (runtime) · PR10 microserviço Python
Molde `voice-engine`/`abnt-service`. Expor `paper-lookup`, `scholar-evaluation`, `statistical-analysis` como `ToolDef runtime:"python"` (HTTP, contrato `ToolResult`, `minPlan` do §9.10). Nota da pesquisa: skills K-Dense "references-only" (ex.: `paper-lookup` = SKILL.md + references, **sem scripts**) podem rodar como prompt-skill no runtime `ts` sem esperar o microserviço — aproveite onde couber.
**Gate (CI/VPS, não no mac):** endpoint responde o contrato `ToolResult`; cliente TS transpila.

### PASSO 9 — PILAR SKILLS (marketplace) · PR11 Sala de Skills
Casa com o `PLANO_SKILLS_PRS.md` (rename Plugin→Skill, `@@map`, sem migração). Fiel ao spec agentskills.io (§10.5 #13):
- **Model `Skill`:** `name` (unique, regex `^[a-z0-9]+(-[a-z0-9]+)*$`, ≤64), `description` (≤1024), `license`, `compatibility`, `metadata Json` (**version em `metadata.version`**), `allowedTools String[]` + envelope Zaeon (`runtime`/`risk`/`minPlan`/`tier`/`courseTags`/`defaultOn`/`sourceRepo`/`sourceSha`/`autoAuthored Boolean @default(false)`). Campos zaeon extras exportáveis vão em `metadata.zaeon-*` (skill exportada continua spec-válida).
- **Validação na instalação (lenient/strict):** rejeita só description vazia, YAML quebrado, name inválido, path traversal; avisa (aceita) name≠dir e body grande.
- **Progressive disclosure:** só name+description das skills instaladas entram no system prompt; uma tool `activate_skill(name: enum)` devolve o body sob demanda.
- **Catálogo:** endpoint com a forma `marketplace.json` (name/source/version/category/tags) — a Sala pode importar repo GitHub de skills.
- **Auto-autoria (só o contrato agora, F4):** flag `autoAuthored` + hook pós-trajetória-aprovada que oferece destilar SKILL.md draft. Não implementar a destilação ainda.
**Gate:** instalar 1 skill K-Dense (URL/zip) → valida → aparece no runtime respeitando `minPlan`; skill inválida é rejeitada com msg clara.

### PASSO 10 — Verificação final (não pule)
1. Grep de cobertura (§6.0): nenhum chat de IA fora do `runTrajectory`.
2. `transpileModule` em TODO arquivo tocado; `npx vitest run` verde.
3. Checklist dos 4 pilares: laço com crítico ✓ · memória L3 com wakeUp/write/search híbrido ✓ · skills instaláveis + runtime ✓ · conector MCP com Testar conexão verde/vermelho real ✓.
4. `AURA_HARNESS="0"` ainda devolve o comportamento legado em todas as salas.
**Gate:** os 4 itens acima, binários.

## 5. Economia de execução (pedido do Martinez — leve a sério)

Agrupe edições por arquivo; não abra exploração (Apêndice C tem TODAS as âncoras); não re-explique contratos — importe; pare em cada gate e reporte em 1 linha (`PASSO N: verde/vermelho + evidência`); se um gate ficar vermelho 2 tentativas, PARE e pergunte ao Martinez em vez de iterar às cegas. Um PR por passo. O valor está em cada gate verde, não em volume de código.
