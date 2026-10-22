# Octa: landing page → repositório no GitHub do aluno + GitHub Pages (Plano de implementação)

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans pra implementar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`) pra acompanhamento.

**Objetivo:** o aluno descreve uma landing page no Octa e recebe um repositório público no próprio GitHub e uma URL no GitHub Pages. A página nasce de um DESIGN.md real e de seções testadas, e o agente trabalha passo a passo, visível como o Claude Code.

**Arquitetura:**
- **Biblioteca de design:** os DESIGN.md da VoltAgent viram um índice com tokens.
- **Biblioteca de seções:** portada do sitecrm para JSX puro com classes próprias e variáveis CSS. O servidor da Zaeon renderiza tudo em `index.html` + `styles.css` estáticos.
- **Agente:** o laço atual do Octa ganha três tools (escolher design, montar página, publicar) e roda como job BullMQ, gravando eventos que a IDE lê ao vivo.
- **Publicar:** usa o token do aluno que já fica cifrado em `User.githubUserToken`, via `lib/projects/github-user.ts`. Cria o repositório, faz o commit e liga o Pages pela API do GitHub.

**Stack:** Next.js 14 (App Router, runtime nodejs), TypeScript, Prisma/MongoDB, BullMQ/Redis, `octokit`, `react-dom/server` (`renderToStaticMarkup`), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-22-octa-landing-github-design.md` (§9 respostas do dono, §10 decisões do desenhista).

## Restrições globais

- Fase 1 = **estático**: o site do aluno é HTML + CSS (+ JS mínimo opcional), sem build, sem shell e sem CDN de Tailwind em runtime.
- **Repositório na conta do aluno**, **sempre público**. Antes da **primeira** publicação aparece o aviso: "seu código e sua página ficarão públicos no seu GitHub".
- **Token do aluno:**
  - Só no servidor.
  - Nunca em `NEXT_PUBLIC_*`, no prompt, no log, no ledger, na resposta da rota, num commit ou numa mensagem de erro.
  - Cifrado em repouso. **Desvio da spec §10, decidido no plano:** em vez de tornar o vault do Octa por aluno, reaproveitar `User.githubUserToken`/`githubRefreshToken` (já cifrados por `lib/projects/crypto.ts`, já por usuário).
  - Em produção, `TOKEN_ENC_KEY` é **obrigatória**: sem ela, publicar falha fechado (nada de fallback `NEXTAUTH_SECRET`/`zaeon-dev-fallback-secret` quando `NODE_ENV=production`).
- **Modelo:**
  - No fluxo landing (tools `octa_design_escolher` / `octa_pagina_montar` / `octa_publicar` disponíveis): **Google primeiro** (`vertex_ai/<GEMINI_MODEL>` = gemini-3.5-flash), Contabo (`zaeon-local-coder`) de reserva.
  - Fora desse fluxo, o roteamento de hoje (`lib/octa/modelo.ts`) não muda.
- **Limites por aluno por dia:** **10 publicações** e **3 repositórios novos**. Publicação que falha não conta.
- **Permissões:** 3 níveis por projeto, `"auto" | "antes_de_publicar" | "antes_de_escrever"`. Default `"auto"`. Ficam **por cima** do modo review/change e de `liberados`. `octa_apagar` sempre pede aprovação.
- **DESIGN.md:** coleção `VoltAgent/awesome-design-md` (MIT), vendorizada em `vendor/design-md/` com o `LICENSE` e crédito visível na galeria.
- **Anti-marca:** a página do aluno nunca contém o nome da marca de origem do estilo.
- **Seções:** só `site-builder/src/components/preview/**` do sitecrm. Não trazer imagens, scraper, Supabase, WhatsApp nem Python.
- **Um projeto ↔ um repositório:** republicar atualiza o mesmo repositório e o mesmo site. Nunca escrever num repositório que o Octa não criou.
- Texto de interface em **português**.

## Foco da revisão

1. **Nome de repositório que já existe na conta e não foi criado pelo Octa:** usar `<slug>-2`, `-3`… e nunca commitar no que já existia. Teste na Tarefa 4.
2. **Token vencido ou revogado no meio da publicação:** renova com o refresh. Se falhar, a resposta é `{ erro: "github_reconectar" }` sem o valor do token em lugar nenhum. Teste na Tarefa 4.
3. **Pages recém-ligado devolve 404 por um tempo:** a publicação volta `status: "publicando"` com a URL, e a IDE mostra "no ar em ~1 min". Não é erro. Teste na Tarefa 4.
4. **DESIGN.md sem algum token (sem fonte, sem raio):** cai nos defaults da biblioteca e a página continua válida. Teste na Tarefa 1.
5. **Texto do aluno com HTML/script nas props:** sai escapado no `index.html` (o `renderToStaticMarkup` escapa; só o agente escreve HTML cru, editando arquivo). Teste na Tarefa 2.

---

### Tarefa 1: Biblioteca de design (DESIGN.md → índice com tokens + escolha pela descrição)

**Arquivos:**
- Criar: `scripts/sync-design-md.mjs`
  - Baixa `VoltAgent/awesome-design-md` (tarball do GitHub) para `vendor/design-md/<estilo>/DESIGN.md` + `vendor/design-md/LICENSE`.
  - Gera `vendor/design-md/indice.json`.
- Criar: `vendor/design-md/**` (saída do script, commitada)
- Criar: `lib/octa/design/tokens.ts`, `lib/octa/design/indice.ts`
- Testes: `lib/octa/design/tokens.test.ts`, `lib/octa/design/indice.test.ts`

**Interfaces:**
- Produz:
  - `type TokensDesign = { cores: { fundo: string; superficie: string; texto: string; textoSuave: string; primaria: string; acento: string; borda: string }; fontes: { titulo: string; corpo: string }; raio: string; espaco: string; escuro: boolean }`
  - `extrairTokens(md: string): TokensDesign`, com defaults `TOKENS_PADRAO` para o que faltar.
  - `type EstiloDesign = { id: string; nome: string; marca: string; resumo: string; clima: string[]; tokens: TokensDesign }`
  - `carregarIndice(): EstiloDesign[]`, que lê `vendor/design-md/indice.json`.
  - `lerDesignMd(id: string): string`
  - `candidatosPorDescricao(descricao: string, indice: EstiloDesign[], n = 5): EstiloDesign[]`, um ranking puro por palavras de clima + nome.
  - `tokensComoCss(t: TokensDesign): string`, que devolve um bloco `:root{--z-fundo:…;--z-primaria:…;--z-fonte-titulo:…;--z-raio:…}`.

- [ ] **Passo 1: testes que falham**
  - `extrairTokens` num DESIGN.md real vendorizado (ex.: `vendor/design-md/linear/DESIGN.md`) devolve cores `#rrggbb` válidas e `escuro` coerente com a cor de fundo.
  - Um DESIGN.md sem fontes e sem raio devolve `fontes`/`raio` iguais a `TOKENS_PADRAO`.
  - `candidatosPorDescricao("escura e minimalista", indice)` só traz estilos com `escuro: true` entre os 3 primeiros.
  - `tokensComoCss` contém `--z-primaria:` com a cor extraída.
- [ ] **Passo 2:** rodar `npx vitest run lib/octa/design` → FALHA (módulos inexistentes).
- [ ] **Passo 3:** escrever o script (rodar uma vez, commitar `vendor/design-md`) e implementar os módulos.
  - `clima` vem de palavras do próprio DESIGN.md: dark/light, minimal, playful, bold, corporate… Mapear pra pt: escuro, claro, minimalista, divertido, ousado, corporativo.
  - `marca` = nome da pasta capitalizado, usado pela regra anti-marca.
- [ ] **Passo 4:** `npx vitest run lib/octa/design` → PASSA.
- [ ] **Passo 5:** commit `feat(octa): biblioteca DESIGN.md (VoltAgent, MIT) com tokens e escolha por descrição`.

### Tarefa 2: Seções portadas do sitecrm + render estático

**Arquivos:**
- Criar: `lib/octa/secoes/tipos.ts`, `lib/octa/secoes/registro.tsx`, `lib/octa/secoes/{hero,features,about,reviews,location,cta}/*.tsx`
  - Portar de `sitecrm/site-builder/src/components/preview/**`: os 39 registrados no `RenderEngine.tsx`. O `hero_gradient`, que nunca foi registrado, fica fora.
  - Trocar classes Tailwind por classes próprias `z-*` e cores fixas por `var(--z-*)`. Textos fixos viram props. Botões viram `<a href>`. Ícones lucide viram SVG inline.
- Criar: `lib/octa/secoes/secoes.css` (CSS estático escrito à mão pras classes `z-*`, só variáveis), `lib/octa/secoes/render.ts`
- Teste: `lib/octa/secoes/render.test.ts`

**Interfaces:**
- Consome: `TokensDesign`, `tokensComoCss` (Tarefa 1).
- Produz:
  - `type Secao = { id: string; type: TipoSecao; props: Record<string, unknown> }`
  - `TIPOS_SECAO: readonly TipoSecao[]`
  - `VARIANTES_POR_CLIMA: Record<string, TipoSecao[]>` (a ideia do `page_maker/config.py`)
  - `renderPagina(p: { titulo: string; descricao: string; secoes: Secao[]; tokens: TokensDesign; marcaProibida?: string }): { "index.html": string; "styles.css": string }`
  - `validarSecoes(s: unknown): Secao[]`: descarta tipo desconhecido e props não-string onde devia ser string.

- [ ] **Passo 1: testes que falham**
  - `renderPagina` com hero + features + cta devolve `index.html` com `<!doctype html>`, `<link rel="stylesheet" href="styles.css">`, `lang="pt-BR"`, `<title>` = titulo e meta description.
  - `styles.css` começa com o bloco de `tokensComoCss` seguido de `secoes.css`.
  - Prop `"<script>alert(1)</script>"` sai escapada (`&lt;script&gt;`).
  - Tipo desconhecido é descartado por `validarSecoes`.
  - Um teste por tipo: os 39 tipos renderizam sem lançar com as props mínimas de `tipos.ts`.
  - O HTML não contém `class="` com classes Tailwind (regex `\b(bg|text|px|py)-`).
- [ ] **Passo 2:** `npx vitest run lib/octa/secoes` → FALHA.
- [ ] **Passo 3:** portar as famílias e implementar `render.ts` com `renderToStaticMarkup` de `react-dom/server`.
- [ ] **Passo 4:** `npx vitest run lib/octa/secoes` → PASSA. `npx tsc --noEmit -p .` → 0 erros fora de `server/colyseus`.
- [ ] **Passo 5:** commit `feat(octa): 39 seções do sitecrm em HTML/CSS estático com tokens DESIGN.md`.

### Tarefa 3: Projeto do Octa no servidor

**Arquivos:**
- Modificar: `prisma/schema.prisma`, novo model `OctaProjeto`:
  - `id`, `userId`, `nome`, `slug`, `arquivos Json`, `designId String?`
  - `permissao String @default("auto")`, `avisoPublicoAceito Boolean @default(false)`
  - `repoFullName String?`, `repoCriadoPeloOcta Boolean @default(false)`, `pagesUrl String?`
  - `createdAt`, `updatedAt`; `@@index([userId])`; `@@map("octa_projetos")`
- Modificar: `prisma/schema.prisma`, novo model `OctaPublicacao` com `id`, `userId`, `projetoId`, `ok Boolean`, `repoNovo Boolean`, `em DateTime`, `@@index([userId, em])`.
- Criar: `lib/octa/projetos.ts`, `app/api/octa/projetos/route.ts` (GET lista, POST cria), `app/api/octa/projetos/[id]/route.ts` (GET, PATCH arquivos/designId/permissao/avisoPublicoAceito, DELETE)
- Testes: `lib/octa/projetos.test.ts`, `app/api/octa/projetos/route.test.ts`

**Interfaces:**
- Produz:
  - `slugProjeto(nome: string): string`, com `[a-z0-9-]`, máx. 60 e default `"meu-site"`.
  - `type PermissaoOcta = "auto" | "antes_de_publicar" | "antes_de_escrever"`
  - `type ProjetosDb` (dublê injetável)
  - `criarProjeto(db, userId, nome)`, `lerProjeto(db, userId, id)` (null se não for do dono), `salvarArquivos(db, userId, id, arquivos)`, `atualizarProjeto(db, userId, id, patch)`
  - `contarPublicacoesHoje(db, userId): Promise<{ publicacoes: number; reposNovos: number }>`, que conta só `ok: true` desde 00:00 em America/Fortaleza.

- [ ] **Passo 1: testes que falham**
  - `lerProjeto` de outro usuário → null.
  - `slugProjeto("Confeitaria da Ana!")` = `"confeitaria-da-ana"`.
  - `contarPublicacoesHoje` ignora `ok:false` e as de ontem.
  - As rotas devolvem 401 sem sessão e 404 para projeto de outro dono.
  - O PATCH rejeita `permissao` fora dos 3 valores.
  - O payload de `arquivos` acima de 1,5 MB devolve 413 (mesmo teto de `/api/octa/agente`).
- [ ] **Passo 2:** `npx vitest run lib/octa/projetos app/api/octa/projetos` → FALHA.
- [ ] **Passo 3:** implementar. O dono sempre vem da sessão (`getServerSession`), nunca do corpo.
- [ ] **Passo 4:** os testes PASSAM. `npx prisma validate` com `DATABASE_URL` de placeholder PASSA.
- [ ] **Passo 5:** commit `feat(octa): projetos no servidor (arquivos, design, permissão, repo do aluno)`.

### Tarefa 4: Publicar no GitHub do aluno (repositório + commit + Pages)

**Arquivos:**
- Modificar: `lib/projects/github-service.ts`
  - Nova função `habilitarPages(octokit, { repo, branch }): Promise<{ url: string; status: "publicando" | "no_ar" }>`, que faz `POST /repos/{o}/{r}/pages` com `source: { branch, path: "/" }`. O 409 (já ligado) vira `GET /repos/{o}/{r}/pages`.
  - Nova função `repoExiste(octokit, fullName): Promise<boolean>`.
  - O `createRepo` passa a aceitar `isPrivate: false`.
- Modificar: `lib/projects/github-user.ts`
  - `getUserOctokit(email)` renova o token com `githubRefreshToken` quando `githubTokenExpiresAt` já passou ou faltam <5 min, e regrava cifrado. Se a renovação falhar, devolve `null`.
- Modificar: `lib/projects/crypto.ts`, que em `NODE_ENV=production` sem `TOKEN_ENC_KEY` lança `TokenKeyAusente`, sem fallback.
- Criar: `lib/octa/publicar.ts`
- Teste: `lib/octa/publicar.test.ts`, mais testes novos em `lib/projects/github-user.test.ts` e `lib/projects/crypto.test.ts`

**Interfaces:**
- Consome: `lerProjeto`, `atualizarProjeto`, `contarPublicacoesHoje`, `OctaPublicacao` (Tarefa 3); `getUserOctokit`, `createRepo`, `commitFiles`, `habilitarPages`, `repoExiste`.
- Produz:
  - `LIMITES = { publicacoesDia: 10, reposNovosDia: 3 }`
  - `publicarProjeto(deps: { db; octokitDoAluno: (email: string) => Promise<AnyOctokit | null>; agora?: () => Date }, p: { userId: string; email: string; projetoId: string; mensagem?: string })`
    - Devolve `Promise<{ ok: true; repoUrl: string; pagesUrl: string; status: "publicando" | "no_ar" } | { ok: false; erro: "github_reconectar" | "limite_publicacoes" | "limite_repos" | "aviso_publico_pendente" | "falha_github" }>`.
    - O erro nunca carrega o valor do token.

- [ ] **Passo 1: testes que falham** (octokit dublê gravando as chamadas)
  - **Primeira publicação:** cria repo público `slug`, commita todos os arquivos do projeto em `main`, liga Pages, grava `repoFullName`/`repoCriadoPeloOcta:true`/`pagesUrl` e registra `OctaPublicacao{ok:true, repoNovo:true}`.
  - **Republicar:** não cria repositório; commita no `repoFullName` salvo.
  - **Nome ocupado por repositório que não é do Octa:** cria `slug-2` e não faz nenhuma chamada de escrita no repositório antigo.
  - **Pages 409:** usa a URL do `GET` e o status fica `"no_ar"` se `status === "built"`, senão `"publicando"`.
  - **Avisos e limites:**
    - Sem `avisoPublicoAceito` → `aviso_publico_pendente`, com zero chamadas ao GitHub.
    - 10 publicações ok hoje → `limite_publicacoes`.
    - 3 repositórios novos hoje e o projeto sem repositório → `limite_repos`.
  - **Token:**
    - `octokitDoAluno` → null dá `github_reconectar`.
    - Uma falha do GitHub cuja mensagem contém o token `"ghu_SEGREDO123"` dá `falha_github`, e o objeto de retorno serializado não contém `"ghu_SEGREDO123"`.
    - Publicação que falha registra `ok:false` e não conta no limite.
  - **Renovação e chave:**
    - `getUserOctokit` com token vencido chama o refresh e regrava cifrado.
    - Com o refresh falhando, devolve null.
    - `crypto` em produção sem `TOKEN_ENC_KEY` lança.
- [ ] **Passo 2:** `npx vitest run lib/octa/publicar lib/projects` → FALHA.
- [ ] **Passo 3:** implementar. Commit via `commitFiles`, com mensagem default `"Publicado pelo Octa (Zaeon)"`.
- [ ] **Passo 4:** os testes PASSAM.
- [ ] **Passo 5:** commit `feat(octa): publicar no GitHub do aluno (repo público + commit + Pages, limites, token sem vazar)`.

### Tarefa 5: Tools novas do agente + modelo Google-primeiro no fluxo landing

**Arquivos:**
- Modificar: `lib/octa/agente.ts`
  - Tools `octa_design_escolher` (risk `write`), `octa_pagina_montar` (risk `write`) e `octa_publicar` (risk `destructive`).
  - Instrução de sistema do fluxo landing:
    - ler `DESIGN.md` antes de editar;
    - nunca usar nome/logo/texto da marca de origem;
    - dizer qual estilo escolheu;
    - imagens só de licença aberta ou SVG próprio (`octa_arte`).
  - `MAX_PASSOS` vira parâmetro: `TurnoOcta.maxPassos?: number` (default 8; o fluxo landing usa 24).
- Modificar: `lib/octa/modelo.ts`, com `escolhaModeloOcta(env, fluxo?: "landing")`. Para `"landing"`, a primária é `vertex_ai/<GEMINI_MODEL>` e a reserva é `zaeon-local-coder`.
- Criar: `lib/octa/permissao.ts`
- Testes: `lib/octa/agente.test.ts` (casos novos), `lib/octa/modelo.test.ts` (caso novo), `lib/octa/permissao.test.ts`

**Interfaces:**
- Consome:
  - `candidatosPorDescricao`, `lerDesignMd`, `carregarIndice` (Tarefa 1)
  - `renderPagina`, `validarSecoes` (Tarefa 2)
  - `publicarProjeto` (Tarefa 4), injetado no `ToolContext` como `octaPublicar?: () => Promise<…>`, para a tool não ver token nem email
- Produz:
  - `precisaAprovacao(permissao: PermissaoOcta, tool: string): boolean`
    - `octa_apagar` → sempre true.
    - `antes_de_escrever` → true pra `octa_escrever`/`octa_pagina_montar`/`octa_design_escolher`/`octa_publicar`.
    - `antes_de_publicar` → true só pra `octa_publicar`.
    - `auto` → false.
  - O resultado do turno ganha `pendente?: { tool: string; args: unknown; toolCallId: string }` (laço parou pedindo aprovação) e `msgs: MsgModelo[]` (estado pra retomar).
  - `rodarAgenteOcta(t, chamar, opts & { permissao?: PermissaoOcta; retomar?: { msgs: MsgModelo[]; aprovado: boolean } })`

- [ ] **Passo 1: testes que falham** (modelo dublê com tool_calls roteirizados)
  - `octa_design_escolher({descricao:"escura e minimalista"})` grava `DESIGN.md` no workspace, e a resposta pro modelo traz o id e nome do estilo.
  - `octa_pagina_montar({secoes:"<json>", titulo})` grava `index.html` e `styles.css`.
  - Com `permissao:"antes_de_publicar"`, um `octa_publicar` pára o laço com `pendente.tool==="octa_publicar"` e não chama `octaPublicar`.
  - Retomar com `aprovado:true` chama `octaPublicar` uma vez e o laço continua.
  - Retomar com `aprovado:false` devolve ao modelo `"o aluno recusou"`.
  - O nome da marca do estilo escolhido aparecendo no `index.html` faz `octa_publicar` recusar com `marca_no_conteudo`, sem chamar `octaPublicar`.
  - `escolhaModeloOcta(env,"landing").local` = `vertex_ai/gemini-3.5-flash` com `GEMINI_MODEL=gemini-3.5-flash`.
  - `precisaAprovacao`: tabela completa dos 3 níveis × 5 tools.
- [ ] **Passo 2:** `npx vitest run lib/octa` → FALHA nos novos.
- [ ] **Passo 3:** implementar. As tools novas passam pelo `runOctaTool` como as outras: guard, trace, `redact`.
- [ ] **Passo 4:** `npx vitest run lib/octa` → PASSA, inclusive os 94 testes que já existiam.
- [ ] **Passo 5:** commit `feat(octa): tools de design/página/publicar, aprovação por nível e Google primeiro no fluxo landing`.

### Tarefa 6: Turno como job em segundo plano + eventos ao vivo

**Arquivos:**
- Modificar: `prisma/schema.prisma`
  - `OctaTurno`: `id`, `userId`, `projetoId`, `status` (`"rodando" | "aguardando_aprovacao" | "pronto" | "erro"`), `estado Json?` (msgs para retomar), `pendente Json?`, `resposta String?`, `createdAt`, `updatedAt`.
  - `OctaEvento`: `id`, `turnoId`, `seq Int`, `tipo` (`"pensando" | "tool" | "arquivo" | "resultado" | "aprovacao" | "fim" | "erro"`), `dados Json`, `em`, `@@index([turnoId, seq])`.
- Criar: `lib/queue/octa.ts`, com fila `"octa-turno"` no padrão de `lib/queue/chores.ts`: `filaLigada`, inline sem Redis e worker via `OCTA_WORKER=1` no `instrumentation-node.ts`.
- Criar: `app/api/octa/turnos/route.ts` (POST inicia), `app/api/octa/turnos/[id]/eventos/route.ts` (GET `?depois=<seq>`), `app/api/octa/turnos/[id]/aprovar/route.ts` (POST `{aprovado}`)
- Modificar: `lib/octa/agente.ts`, que ganha `opts.onEvento?: (e: { tipo; dados }) => Promise<void>`, chamado a cada passo.
- Testes: `lib/queue/octa.test.ts`, `app/api/octa/turnos/route.test.ts`

**Interfaces:**
- Consome: `rodarAgenteOcta` com `retomar`/`permissao`/`onEvento` (Tarefa 5); `lerProjeto`, `salvarArquivos` (Tarefa 3); `publicarProjeto` (Tarefa 4).
- Produz:
  - `iniciarTurno(deps, { userId, email, projetoId, pedido }): Promise<{ turnoId: string }>`
  - `processarTurno(deps, turnoId): Promise<void>`
    - Grava eventos em ordem e salva as `edicoes` no projeto ao fim.
    - Status `"aguardando_aprovacao"` guarda `estado` e `pendente`.
  - `aprovarTurno(deps, { userId, turnoId, aprovado }): Promise<void>`, que retoma o mesmo turno (reenfileira).

- [ ] **Passo 1: testes que falham**
  - `processarTurno` com modelo dublê grava eventos `seq` 1..n crescentes e termina em `"fim"`.
  - As edições vão para `OctaProjeto.arquivos`.
  - Um turno parado em aprovação → status `aguardando_aprovacao`; `aprovarTurno(aprovado:true)` termina em `pronto` e publica uma vez.
  - `GET eventos?depois=3` devolve só `seq>3`.
  - Turno de outro usuário → 404.
  - **Nenhum evento gravado contém o valor do token:** o octokit dublê lança erro com `"ghu_SEGREDO123"` e o teste varre `dados` de todos os eventos.
  - Sem Redis, `iniciarTurno` processa inline.
- [ ] **Passo 2:** `npx vitest run lib/queue/octa app/api/octa/turnos` → FALHA.
- [ ] **Passo 3:** implementar. `/api/octa/agente` (fluxo antigo) continua funcionando igual.
- [ ] **Passo 4:** os testes PASSAM. `npx tsc --noEmit -p .` → 0 erros fora de `server/colyseus`.
- [ ] **Passo 5:** commit `feat(octa): turno em job com eventos ao vivo e retomada após aprovação`.

### Tarefa 7: IDE — projetos, galeria, passos ao vivo, conectar e publicar

**Arquivos:**
- Modificar: `components/octa/OctaIDE.tsx`
  - **Lista de projetos:** novo/abrir via `/api/octa/projetos`. O localStorage vira cache.
  - **Janela do agente:** pedidos vão para `/api/octa/turnos`, com polling de 1 s em `eventos` mostrando cada passo e arquivo alterado.
  - **Aprovação e permissão:** cartão de aprovação quando chega o evento `"aprovacao"`, e seletor dos 3 níveis.
  - **GitHub e publicação:**
    - botão **Conectar GitHub** (`/api/projects/github/connect`, que já existe) mostrando o login conectado;
    - botão **Publicar**, com o aviso público na 1ª vez gravando `avisoPublicoAceito`;
    - os dois links ao fim, com "no ar em ~1 min" quando `status==="publicando"`.
- Criar: `components/octa/GaleriaDesign.tsx`
  - Grade de estilos de `carregarIndice()`, servida por `app/api/octa/design/route.ts`.
  - A prévia de cada estilo vem de `renderPagina` com seções de exemplo fixas, em `<iframe srcDoc sandbox="">`.
  - Escolher chama `octa_design_escolher` via PATCH do projeto (`designId`) e grava `DESIGN.md`.
  - Crédito "Estilos: VoltAgent/awesome-design-md (MIT)".
- Criar: `app/api/octa/design/route.ts` (GET índice resumido) e `app/api/octa/design/[id]/previa/route.ts` (GET HTML da prévia)
- Testes: `components/octa/GaleriaDesign.test.tsx`, `app/api/octa/design/route.test.ts`

**Interfaces:**
- Consome: as rotas das Tarefas 3, 6 e 1/2, e `/api/projects/github/connect|disconnect` e `GET /api/projects/github` (estado da conexão), que já existem.
- Produz: só interface.

- [ ] **Passo 1: testes que falham**
  - A galeria renderiza um cartão por estilo do índice e mostra o crédito.
  - Clicar em um cartão chama `PATCH /api/octa/projetos/<id>` com `designId`.
  - A prévia vem num iframe com `sandbox` e `srcDoc` sem a palavra da marca.
  - `GET /api/octa/design` devolve `[{id,nome,resumo,clima,escuro}]` sem o texto do DESIGN.md.
- [ ] **Passo 2:** `npx vitest run components/octa app/api/octa/design` → FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** os testes PASSAM. Na prévia local (`npm run dev`), abrir o Octa, criar um projeto, pedir "uma landing pra minha confeitaria, escura e minimalista" e ver os passos ao vivo, o estilo escolhido e a página na prévia da IDE.
- [ ] **Passo 5:** commit `feat(octa): IDE com projetos, galeria de estilos, passos ao vivo e publicar no GitHub`.

### Tarefa 8: Produção — configuração e prova ponta a ponta

**Arquivos:**
- Criar: `docs/OCTA_GITHUB_PAGES_RUNBOOK.md`, o checklist do dono:
  - **GitHub App** (o já registrado):
    - permissões de repositório *Administration: write*, *Contents: write*, *Pages: write*, *Metadata: read*;
    - "Request user authorization (OAuth) during installation";
    - "Expire user authorization tokens" ligado;
    - Callback URL `https://zaeon.com.br/api/projects/github/callback`.
  - **Envs da VPS:** `GITHUB_APP_CALLBACK_URL`, `TOKEN_ENC_KEY` (gerada na VPS sem imprimir), `OCTA_WORKER=1`, `OCTA_QUEUE=1`.
  - **Conta de teste do GitHub** para a prova.
- Modificar: `.env.example` (novas envs comentadas).

- [ ] **Passo 1:** mergear as Tarefas 1–7 e conferir que o deploy está verde. `npx prisma db push` em produção (models novos).
- [ ] **Passo 2:** o dono aplica o checklist do runbook. O executor gera o `TOKEN_ENC_KEY` na VPS por pipe e recria o web.
- [ ] **Passo 3: prova, com a conta GitHub de teste do dono**
  - conectar;
  - pedir a landing da confeitaria;
  - aceitar o aviso público e publicar;
  - abrir `pagesUrl` (esperar ~1 min) e conferir que a página abre e segue o DESIGN.md;
  - republicar e conferir que o mesmo repositório ganhou commit novo.
- [ ] **Passo 4: varredura do token**
  - `docker logs zaeon_web`, `TokenLedger`, `OctaEvento`, `OctaTurno` e o histórico de commits do repositório de teste → zero ocorrências do token (pegar o token decifrando só dentro de um script no container e comparar por hash, sem imprimir).
  - Bundle do navegador: `grep -r` em `.next/static` por `ghu_` → zero.
- [ ] **Passo 5:** commit do runbook e do resultado da prova na descrição do PR. Limpar o repositório de teste se o dono pedir.
