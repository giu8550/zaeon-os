# Briefing do Fable — pesquisar fontes e CO-AUTORAR o prompt do Claude Code

> **Papel do Fable (você):** não implemente nada. Use sua capacidade de **pesquisa** para (1)
> aprofundar os repositórios-fonte que já estudamos e **descobrir novos** que ajudem a construir
> os **agentes perfeitos para produção de ciência**; (2) reconciliar os achados com a base que a
> Zaeon já tem construída; e (3) **escrever UM prompt de execução, preciso e auto-contido, para o
> Claude Code (Opus) IMPLEMENTAR** a camada agêntica da Aura. O Claude Code só executa — todo o
> raciocínio de projeto e a curadoria das fontes é seu.
>
> **Regra-mãe (do Martinez):** contratos ricos e comprovados = menos token do executor. Pesquise
> com eficiência, entregue um digest curto + o prompt do Claude Code. Não queime a semana em tokens.

---

## 1. Leia primeiro (a base — NÃO reinvente)
A Zaeon é Next.js + Prisma/**MongoDB** + **Gemini/Vertex (IA única)**. Já há uma camada agêntica
**escrita e transpilando**. Antes de qualquer pesquisa, leia estes 3 docs (são a fonte-da-verdade):
- `docs/AURA_AGENTIC_LAYER_PLAN.md` — plano faseado, **§8 contratos**, **§10.4 avaliações de repos**, **§11 spec de engenharia**, **§13 runbook de PRs**.
- `docs/MEMORY_AND_PERSISTENCE.md` — a **escada de memória L0→L3** (memória = STANDARD, Atlas Vector nativo).
- `docs/HANDOFF_EXECUTOR.md` — **§6** adaptador+wiring, **§7** estados de UX, **§8** taxonomia de erros, **§9** plano E2E. É a espinha do prompt que você vai co-autorar.

**Já construído (transpila — o Claude Code IMPORTA, não reescreve):** `lib/agent/{contracts,router,runtime,trajectory,examiner,errors,memory,transcript,transcriptClient}.ts`, `app/api/ai/transcript/route.ts`, models `Conversation`/`ChatMessage`, `lib/plans.ts`(planRank), e UI `components/study/{StudioGeneratingCard,ApprovalCard,StructuredAnswerView}.tsx` + botão ⏹.

**Decisões TRAVADAS (não reabrir; reconcilie os achados a elas):** Gemini único; memória avançada
STANDARD p/ todas as contas (gate de plano é só COMPUTE); harness **ligado por padrão** em TODAS as
salas (estudos/pesquisa/aula/**projetos**/lounge; `AURA_HARNESS="0"` = kill-switch); UI mantém o **⟁**
e o idioma **Apple liquid glass**; verificação por `transpileModule`/`vitest` (sem `next build`);
`prisma db push` (Mongo, sem migração).

---

## 2. Fontes já avaliadas (baseline — aprofunde, não re-resuma)
Detalhe em `AURA_AGENTIC_LAYER_PLAN.md §1` e `§10.4`. O que já pegamos de cada:
- **SakanaAI/AI-Scientist** — pipeline por estágios + crítico com reflexão/ensemble (formato, não LaTeX/GPU).
- **awesome-harness-engineering** — laço ReAct, middleware/guardrails, permissões deny-by-default.
- **MemPalace** — memória verbatim wing/room/drawer, recall por embedding barato.
- **K-Dense** (scientific-writer=ScholarEval; scientific-agents=503 AGENTS.md; scientific-agent-skills=138 skills; science-superpowers=pré-registro/red-team).
- **ai4s-research/open-science** — provenance ledger, grading de evidência, viewers de artefato.
- **ShinkaEvolve** — best-of-N com crítico como fitness (modo Max).
- **OpenClaudeScience/InternAgentS** — HITL p/ compute remoto (referência, DeepAgents/LangGraph).
- **NousResearch/hermes-agent** — busca de memória híbrida (texto+vetor), curadoria com nudge, skill auto-autorada, modelo de usuário (Honcho).

**Buraco que o Martinez apontou:** não confirmamos se esses repos trazem **tratamento de erro/
observabilidade embutido na execução de tools/processos/outputs**. Nós já criamos `lib/agent/errors.ts`
(taxonomia + mensagens). **Sua tarefa inclui checar o estado-da-arte disso** e propor reforços.

---

## 3. O que você (Fable) DEVE pesquisar

### 3.0 OS QUATRO PILARES — dê PESO IGUAL (nenhum é afterthought)
O produto são agentes de ciência que **pensam, lembram, usam habilidades e se conectam**. Pesquise
e faça o prompt do Claude Code cobrir os QUATRO com a mesma profundidade — **memória tem a MESMA
prioridade que os demais**, não é "fase tardia":
1. **Harness** — o laço (motor/trajetória/crítico/erros). Já bem coberto na base; aprofunde só o que falta (observabilidade/erro).
2. **Memória** (fonte-da-verdade `MEMORY_AND_PERSISTENCE.md`) — a escada L0→L3, **STANDARD p/ toda conta**. L0/L1 já construídos; o L3 (semântica nativa Atlas Vector, recall **híbrido** vetor+`$text`, curadoria com nudge, `wakeUp`/`write` derivando do L1) é **entregável de 1ª classe, NÃO opcional**. Trate com o mesmo cuidado do harness. Pesquise memória de longo prazo p/ agentes (mem0/Letta/Zep/Graphiti/cognee) só pra afinar o mecanismo — sem trocar a decisão (nativo Mongo).
3. **Skills** — habilidades plugáveis no **padrão agentskills.io** (SKILL.md): a **Sala de Skills como marketplace** real (evolução do rename Plugin→Skill em `PLANO_SKILLS_PRS.md`), runtime de skill (`ts`|`python`|`mcp`), catálogo K-Dense (paper-lookup, scholar-evaluation, citation, hypothesis…), gating por plano, `defaultOn` por curso, e **skill auto-autorada** a partir de trajetória aprovada (lição Hermes). Pesquise o ecossistema agentskills.io e como skills reais são empacotadas/versionadas/descobertas.
3. **Conectores (MCP)** — a Aura **conecta em serviços externos** via **Model Context Protocol**: bancos científicos (PubMed/arXiv/OpenAlex/Crossref/Semantic Scholar), dados do aluno, ferramentas de terceiros. Nosso `runtime.ts` já prevê `runtime:"mcp"` no `ToolDef` — falta o **cliente MCP + registry de conectores** (descoberta, permissão, credenciais). Pesquise: servidores MCP OSS úteis pra ciência/educação, o registry/spec do MCP, padrões de cliente MCP em TS, e como plugar conectores com o nosso `permit()`/gating. **ADMINISTRAÇÃO PLUGÁVEL DE VERDADE (decisão do Martinez, `AURA_AGENTIC_LAYER_PLAN.md §9.11`):** os três — **Skills, Conectores, MCP** — vivem em **três espaços de admin dentro de Opções (menu inicial)**, cada capacidade com estado real e um botão **Testar conexão** que faz round-trip (`initialize`+`tools/list`+chamada seca) → chip verde/vermelho via `messageForError`. **NADA de "acha que está plugado"** — paridade com os conectores dos agentes atuais (Claude). Pesquise a **UX de configuração/verificação de conectores** (Claude connectors, health-check, estados desconectado/conectado/erro/precisa-autorizar) pra espelhar o padrão.

### 3.1 Aprofundar as fontes acima
Pegue o que passou batido — com foco em: **tratamento de erro/ret/ fallback/observabilidade em
tools e no laço**; **avaliação científica** (rubricas, LLM-as-judge, verificação de citação);
**reprodutibilidade/provenance**; **papéis de agente** (escritor/revisor/crítico); **memória de
longo prazo** e continuidade.

### 3.2 DESCOBRIR novos repositórios (vetores de busca)
Priorize **licença permissiva (MIT/Apache)**, **reproduzível**, e **transferível pra nossa stack**
(rouba-se o MECANISMO, não o stack Python/desktop). Vetores sugeridos (não exaustivo):
- **Agentes de ciência:** Biomni, ChemCrow, Coscientist, PaperQA2, STORM (Stanford), SciAgents, The AI Scientist v2, FutureHouse (Robin/Aviary/LAB-Bench), lab automation.
- **Harness / tool-use:** DeepAgents, LangGraph, smolagents, AutoGen, CrewAI, OpenHands, DSPy.
- **Memória:** mem0, Letta/MemGPT, Zep/Graphiti, cognee, LlamaIndex memory.
- **Avaliadores:** ScholarEval e sucessores, paper-review agents, RAGAS, LLM-as-judge frameworks.
- **Skills (pilar 2):** agentskills.io e o ecossistema (empacotamento SKILL.md, descoberta, versionamento); Claude Code Agent Skills / plugins; K-Dense scientific-agent-skills; skill auto-autorada.
- **Conectores / MCP (pilar 3):** o registry e a spec do Model Context Protocol; servidores MCP OSS úteis (bancos científicos, buscadores, dados); clientes MCP em TypeScript; padrões de auth/permissão de conector.
Para CADA achado relevante entregue: (a) **mecanismo transferível** em 1-2 linhas; (b) **em qual
camada nossa encaixa** (motor / tools / memória / examiner / UX / erros); (c) **licença**; (d) se
**contradiz** alguma decisão travada (sinalize) ou é **aditivo**.

### 3.3 Critério de "agente perfeito para produção de ciência" (a régua)
Rigor acadêmico **adaptativo por sala** (§8.8); **citações reais + provenance** (nunca inventar);
**examiner ScholarEval** com grading de evidência; **memória que dá continuidade**; **papéis**
(Aura/Revisor/Escritor); **skills plugáveis** (marketplace agentskills.io + auto-autoria);
**conectores MCP** (bancos científicos e ferramentas externas, com permissão); **pré-registro/
reprodutibilidade**; **UX que reflete o processo** (fases/erros/aprovação); **erros que degradam com
elegância**. Um agente que só "pensa" mas não tem **skills** nem **conectores** não é o alvo.

---

## 4. O que você ENTREGA (dois artefatos)

### 4.1 Digest de pesquisa (curto)
Uma tabela: repo · licença · mecanismo · camada Zaeon · aditivo/contradiz. Máx. ~15 entradas
priorizadas. Sem colar READMEs inteiros. Registre no próprio doc do plano (§10.4) as novidades.

### 4.2 O PROMPT do Claude Code (Opus) — o produto principal
Um prompt **único, ordenado, auto-contido**, que o Claude Code só executa. Deve:
- **Basear-se no `HANDOFF_EXECUTOR.md §6/§8/§9`** (não duplicar — referenciar e enriquecer com os achados da pesquisa).
- Listar **o que importar** (os `lib/agent/*.ts` prontos) e **proibir re-derivar tipos**.
- Dar a **ordem dos 6 passos E2E** (§9) com **gate binário** em cada, arquivos-alvo exatos e âncoras do **Apêndice C** (para não haver exploração ampla).
- **Cobrir os 4 pilares explicitamente** (peso igual, memória inclusa): **memória** — o L3 nativo (model `MemoryDrawer` + Atlas Vector + `memory_search` + recall híbrido + `persistMemory`) como passo de 1ª classe, não último/opcional; **skills** — registrar skills como `ToolDef`, o runtime `python` (microserviço molde `voice-engine`/`abnt-service`, PR10) e a Sala de Skills marketplace (PR11, casa com `PLANO_SKILLS_PRS.md`); **conectores** — o cliente MCP + registry como `runtime:"mcp"` no `ToolDef`, passando pelo `permit()`. **Catálogo de arranque já semeado em `§9.11`** (paper-search-mcp, BioMCP, openscience, arxiv, scholar, openalex, servers oficiais) — o Claude Code valida o **paper-search-mcp** ponta a ponta primeiro.
- **Admin plugável em Opções (`§9.11`)** — um passo próprio pro Claude Code: as três telas (Skills/Conectores/MCP) no menu inicial, o model `Connector` (transport/endpoint/authRef/status/lastCheckedAt/discoveredTools), o fluxo adicionar→handshake→registrar→**Testar conexão (round-trip real)**→ativar, os estados de conexão, e credenciais no cofre (só `authRef`). Gate: dá pra conectar um MCP de exemplo, ver as tools reais no handshake, e o **Testar conexão** acende verde/vermelho de verdade.
- Embutir os **guardrails**: flag default-on em todas as salas (incl. Projetos), Gemini único, memória standard/Atlas, `messageForError` (não inventar erro), ⟁ + liquid glass, `transpileModule`/`vitest` (sem `next build`), `prisma db push`, 1 PR por passo.
- Incorporar quaisquer **padrões novos** que a pesquisa aprovar — mas só como **aditivos** compatíveis com as decisões travadas, cada um com justificativa de 1 linha.
- Ser **econômico**: instruir o Claude Code a agrupar edições por arquivo, não abrir exploração, e parar em cada gate.

---

## 5. Restrições de orçamento (Fable)
Pesquise por **README/docs primeiro**, deduplique, teto de repos, **não clone nem rode** nada.
Se uma fonte não agrega mecanismo novo, descarte em 1 linha. O valor está no **prompt final enxuto**,
não no volume de pesquisa. Nada de reabrir decisões travadas. Se algo grande contradizer a base,
**pergunte ao Martinez** antes de escrever o prompt — não decida sozinho mudanças estruturais.
