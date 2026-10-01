# Zaeon v2 — Backlog de correções (páginas + harness)

> Levantado com o Martinez em 2026-09-15, com diagnóstico feito lendo o código.
> ⚠️ Auditoria feita na branch `aura/base-coworking-harness` (16b25a4); **prod é `main`
> (c8a0ee7)** — confirmar contra a main antes de mexer no que for sensível.
> Tags de esforço: [rápido] · [médio] · [PR] (mudança maior).

## A. Correções globais

### A1. Enter envia mensagem — padronizar [rápido/médio]
Hoje o comportamento é **inconsistente**: vários inputs usam só `if (e.key === "Enter")`
(OmegaScholarBar, AgenticAreaContent, QuantumLab, CodeLab) — sem `preventDefault` nem
tratar `Shift+Enter` (quebra de linha). Outros já fazem certo (`!e.shiftKey && preventDefault`
em biosim3d e no chat de Projetos). **Fix:** um util compartilhado `onEnterSubmit` (Enter =
envia, Shift+Enter = nova linha) aplicado em todos os inputs de chat — principalmente o do
Aura (chat principal). Achar/garantir que o input do chat principal use o util.

### A2. Prender o tutorial atrás do login [médio]
Partes do tour vazam em páginas sem login. O tour é disparado por eventos
(`zaeon:tour:prefill`), atributos `data-tour=...` e pelo `?tour=true` (NetworkMural).
**Fix:** só montar o provider/coachmarks do tour quando houver sessão (guard de auth no
layout onde o tour monta); em rotas públicas, não renderizar nada de tour. Verificar o
layout raiz e componentes com `data-tour`.

## B. Harness / Aura (chat)

### B1. Molécula inline na resposta ("mescalina") — AINDA NÃO existe [PR]
**Veredito honesto:** o que o Martinez descreve (perguntar "o que se sabe sobre a mescalina?"
e a Aura cunhar a molécula 3D **dentro da resposta**, tipo pop-up/card azul) **não está
implementado em prod.** O código de molécula real (PubChem + 3D) vive no **módulo BioSim3D**
(uma sala à parte), não inline no chat. O chat tem as sentinelas `@@STUDIO_ACTION@@` /
`@@RESEARCH_ACTION@@` (os cards azuis de ação existem), mas o **viewer de molécula inline**
é justamente o PR planejado em `docs/RICH_ARTIFACTS_MOLECULE.md` — nunca foi mergeado.
Então: harness parcialmente ativo (rota/decisões/cards de ação ✓), molécula inline = a
construir. **Fix = executar o PR RICH_ARTIFACTS_MOLECULE** (3Dmol.js + PubChem como 1º viewer
inline, plugado no seam do StudioBlock). [PR]

### B2. Fluidez do streaming de texto [médio]
Hoje as letras aparecem "abruptas" (renderiza cada chunk do stream cru, sem suavizar). As
ferramentas de referência (Claude/ChatGPT) fazem cadência suave. **Fix:** bufferizar os
tokens que chegam do `reader.read()` e emitir com cadência (rAF / ~char-by-char com easing),
+ cursor piscando. Aplicar no renderer da resposta do chat principal (o research usa
`TextDecoder` em OmegaScholarContext — o chat principal precisa do mesmo tratamento + camada
de suavização). Combina com o objetivo de "outputs inspirados/criativos".

### B3. Clicar numa opção da IA deve SELECIONAR, não jogar no input [médio/bug]
Quando o agente oferece opções/decisões, o clique hoje despeja o texto no campo de input em
vez de **selecionar/acionar** a opção. **Fix:** o `onClick` do chip de opção deve disparar a
ação (enviar a escolha ao harness / marcar selecionado), não `setInput(text)`. Localizar o
renderer dos chips de opção no componente de mensagem do chat.

### B4. APIs de saúde (clinicaltrials.gov, etc.) [PR]
**Não existe conector** no código — o grep só achou `pubmed`/`europepmc`/`semanticscholar`
na Sala de Pesquisa (related research), nada de ClinicalTrials nem wiring de MCP de saúde.
Então não é "conexão quebrada": é **feature a construir** — um conector no passo `gather` do
harness (ClinicalTrials API + talvez PubMed/OpenFDA), com citação de fonte. [PR]

### B5. Decisões/opções do agente — FUNCIONANDO ✓
O Martinez confirmou que o harness escolhendo/decidindo em situações está bem funcional.
Manter; é a base sobre a qual B3 (o clique) precisa casar.

## C. Sala de Projetos (vibe coding)

### C1. Criar projeto não inicia a base + nome some [PR]
Ao criar um projeto, vai pra sala mas **o nome não aparece nas sugestões** e **a base não
inicia**. O `ProjectsContent` já tem `runProject`, `scaffold` e memória de projeto (stack,
decisões), mas falta o **kickoff**: o correto é a IA, ao entrar, já **sugerir a stack
recomendada** (ou aguardar input) e ir criando os **comandos básicos do git / arquivos base**
pra começar a codar. **Fix:** (1) persistir/listar o projeto criado (nome nas sugestões);
(2) auto-kickoff no harness da sala (sugere stack → gera scaffold + `git init`/estrutura →
pronto pra editar). Ligar a memória de projeto ao harness. [PR]

## Ordem sugerida
Rápidos primeiro (impacto alto, risco baixo): **A1, A2, B3**. Depois **B2** (fluidez).
Depois os PRs: **B1** (molécula inline — é o "uau" que ele quer ver), **C1** (Projetos),
**B4** (conector de saúde). Tudo entra pelo CI/CD (push → deploy), sem SSH.
