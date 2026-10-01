# Executor — Correções v2 (páginas + harness)

> Prompt para um agente (Claude Code) implementar as correções levantadas em 2026-09-15.
> Diagnóstico e caminhos foram pré-mapeados lendo o repo. **Confirme cada trecho na `main`
> antes de editar** (a auditoria foi na branch `aura/base-coworking-harness`).
> Fonte da lista: `docs/V2_CORRECOES_BACKLOG.md`. Deploy é automático via CI/CD
> (`docs/CICD_AUTONOMO.md`) — você NÃO mexe no servidor; só abre PR pra `main`.

## 0. Setup e regras da casa (obrigatório)
- Instalar/validar: `npm ci` → `npx prisma generate` → dev: `npm run dev`. Antes de abrir PR:
  `npm run lint` (não-bloqueante), `npm test` (vitest), `npx next build` **tem que passar**.
- **Não** commitar segredos; `.env*` é gitignored. Mongo é Atlas externo — não tocar em dados.
- **UI nova = opt-in** (toggle), **mantenha o ⟁ da casa** (não trocar por ícones lucide random),
  **não troque tela/aba inteira de uma vez**. Textos de UI em **pt-BR**.
- Trabalhe em branch `fix/v2-lote-1` a partir de `main`. PRs pequenos e revisáveis (um por item,
  ou agrupar só os "rápidos"). Título/descrição claros; cada PR cita o item (A1, B3…) e o DoD.
- Ordem recomendada: A1 → A2 → B3 → B2 → (PRs) B1 → C1 → B4.

---

## A1. Enter envia mensagem — padronizar [rápido]
**Problema:** comportamento inconsistente entre inputs. Vários usam só `if (e.key==="Enter")`
sem `preventDefault`/`Shift+Enter`.
**Fazer:**
1. Criar util `src/lib/ui/onEnterSubmit.ts` (ou `components/ui/…`): retorna um handler
   `onKeyDown` que envia no **Enter**, permite quebra de linha no **Shift+Enter**, chama
   `e.preventDefault()` no envio, e ignora se estiver com IME/composição ativa
   (`e.nativeEvent.isComposing`).
2. Aplicar nos inputs de chat, priorizando o chat principal e os que estão "errados":
   `components/study/StudyCoworkChat.tsx`, `components/study/MeusEstudosFeed.tsx` (input
   "Zaeon, estude sobre…"), `components/sub/ClassesView.tsx:926` (Enter sem shift),
   `app/workstation/page.tsx:177` e `app/workstation/[id]/page.tsx:183`,
   `app/workstation/teacher/AgenticAreaContent.tsx:132`, `app/agentic-modules/*` (CodeLab,
   QuantumLab). Onde for `<input>` de uma linha, manter Enter=envia (sem shift).
**DoD:** em todos os chats, Enter envia, Shift+Enter quebra linha (nos textarea), nada de
enviar duas vezes; build verde.

## A2. Prender o tutorial atrás do login [médio]
**Problema:** partes do tour vazam em páginas sem sessão (eventos `zaeon:tour:*`, atributos
`data-tour`, `?tour=true`).
**Alvos:** `app/providers.tsx`, `app/layout.tsx`, `components/onboard/OnboardingGuide.tsx`,
`components/onboard/ResearchRoomTour.tsx`, `components/research/MiniTourToast.tsx`,
`app/workstation/profiles/NetworkMural.tsx` (gatilho `?tour=true`).
**Fazer:** montar qualquer componente de tour/coachmark **apenas quando houver sessão**
(checar `useSession()`/estado de auth). Em rotas públicas (landing/login/criação de conta),
não renderizar nada de tour nem reagir a `?tour=true`. Um único guard central de preferência.
**DoD:** deslogado, navegando por páginas públicas, **nenhum** fragmento de tour aparece;
logado, o tour funciona igual a antes.

## B3. Clicar numa opção da IA deve SELECIONAR, não jogar no input [médio]
**Problema:** clicar num chip de opção/decisão despeja o texto no input em vez de acionar a escolha.
**Alvos:** `components/study/StructuredAnswerView.tsx` e `components/study/StudyCoworkChat.tsx`
(renderer das opções/decisões do harness). Procure o `onClick` que faz `setInput(...)`/
`setDraft(...)` no chip.
**Fazer:** o clique deve **enviar a escolha ao harness** (mesmo caminho de submit da mensagem,
com a opção escolhida) e/ou marcar o chip como selecionado — **não** preencher o campo de input.
Manter acessível (role="button", teclado).
**DoD:** clicar numa opção dispara a ação/again do harness direto; o input não é populado; o
estado "selecionado" fica visível.

## B2. Fluidez do streaming de texto [médio]
**Problema:** as letras aparecem abruptas (renderiza o chunk cru do stream). Referência de
suavidade: Claude/ChatGPT.
**Alvos:** o consumidor de stream do chat principal (`components/study/StudyCoworkChat.tsx`;
padrão de leitura em `app/workstation/student/omega/OmegaScholarContext.tsx` usa
`reader.read()`+`TextDecoder`).
**Fazer:** bufferizar os tokens recebidos e renderizar com cadência suave (fila de caracteres
consumida via `requestAnimationFrame` com velocidade adaptativa — acelera se o buffer cresce),
cursor piscando durante o stream, sem "saltos". Não quebrar markdown/StudioBlock parcial
(renderizar bloco só quando fechado). Respeitar `prefers-reduced-motion` (sem animação).
**DoD:** resposta "digita" suave como as ferramentas de referência; markdown e cards não
piscam/quebram; reduced-motion desliga o efeito.

## B1. Molécula (e artefatos ricos) inline na resposta [PR]
**Contexto:** hoje NÃO existe molécula 3D dentro da resposta do chat; molécula real
(PubChem/3D) vive no módulo à parte `app/agentic-modules/biosim3d/`. O plano inline está em
`docs/RICH_ARTIFACTS_MOLECULE.md`.
**Fazer:** implementar o PR daquele doc — viewer de molécula 3D **inline** (3Dmol.js + PubChem
por nome/fórmula) como primeiro tipo de artefato rico, plugado no seam do `StudioBlock`
(`components/studio/StudioBlock.tsx` + registry `StudioArtifactViews`) e emitido pelo harness
via sentinela de estrutura (estender `@@STUDIO_ACTION@@` ou o `@@STRUCTURED@@` proposto no
route `app/api/ai/chat/route.ts`). O router deve mapear nome de substância → busca PubChem
(ex.: "mescalina" → CID → SDF → render). Degrada gracioso se PubChem falhar (mostra texto).
**DoD:** perguntar "o que se sabe sobre a mescalina?" faz aparecer, **dentro da resposta**, um
card/viewer 3D da molécula (como os cards azuis), sem quebrar o texto; funciona pra ao menos
5 substâncias comuns; build verde.

## C1. Sala de Projetos — kickoff + listagem [PR]
**Problema:** ao criar projeto, vai pra sala mas o nome não aparece nas sugestões e a base não
inicia.
**Alvos:** `app/research-lab/projects/ProjectsContent.tsx` (`runProject`, `createNewFile`,
`applyEdits`, memória de projeto — stack/decisões ~linha 162/930; classificador de intenção
~1049).
**Fazer:** (1) **persistir e listar** o projeto recém-criado (nome aparece nas sugestões ao
voltar). (2) **Auto-kickoff** ao entrar num projeto novo: o harness da sala já **sugere a stack
recomendada** (ou pergunta e aguarda input) e, ao confirmar, **gera o scaffold + estrutura base
+ `git init`/arquivos .git essenciais** pra começar a codar — ligando a memória de projeto
(stack/decisões) ao contexto do harness. Sem executor remoto? Mantém o aviso atual, mas cria a
base local (arquivos viram tabs).
**DoD:** criar projeto → nome listado; ao abrir, a IA propõe stack (ou aguarda) e gera a base;
começar a editar é imediato; a stack escolhida entra na memória do projeto.

## B4. Conector de saúde (ClinicalTrials, etc.) [PR]
**Contexto:** não existe conector de saúde no código (só pubmed/europepmc/semanticscholar na
Sala de Pesquisa). É feature nova no passo `gather` do harness.
**Fazer:** adicionar um conector **ClinicalTrials.gov API v2** (e opcional PubMed/OpenFDA)
como ferramenta do harness, com **citação de fonte** no resultado. Cache + rate-limit (já há
helpers `cache.ts`/`ratelimit.ts`). Exponha via o mesmo mecanismo de tools/gather do harness.
**DoD:** uma pergunta clínica (ex.: "ensaios clínicos sobre mescalina") retorna itens reais do
ClinicalTrials com link/fonte; falha de rede degrada sem quebrar a resposta; build verde.

---

## Entrega
- Abrir PR(s) pra `main` com os itens acima; cada PR com descrição + DoD marcado + como testar.
- Ao mergear na `main`, o CI/CD (`.github/workflows/deploy.yml`) sobe pra VPS sozinho
  (depois dos secrets configurados). **Não** faça deploy manual/SSH.
- Se algo do diagnóstico não bater com a `main`, ajuste o caminho e anote no PR.
