# Projetos — IDE Agêntica: Plano de Implementação

> Companion do `docs/PROJECTS_AGENTIC_IDE_SPEC.md`. A spec descreve o **que** existe e
> o desenho. Este documento descreve **como saímos do estado atual (mock/contrato)
> até GitHub real + workspace = repositório clonado**, com fases verificáveis.
>
> Decisão de auth (2026-06-13): **GitHub App (installation token)**, server-to-server.
> Escopo desta leva: **GitHub real via Octokit + Workspace = repo clonado.**
> Anthropic e hardening ficam para fases posteriores (listadas, não detalhadas).

---

## 0. Estado no início desta leva

Confirmado lendo o repo (não a spec):

| Camada | Estado real |
|---|---|
| UI / sala / sidebar (`ProjectsContent.tsx`, `app/research-lab/page.tsx`) | ✅ Integrada |
| Execução no navegador (`useCodeRunner`, Pyodide/iframe) | ✅ Real |
| Agente Gemini (`/api/projects/agent` → `lib/ai/router.ts` → Vertex) | ✅ Real |
| Gate por curso (`lib/projects/access.ts`, 2 camadas) | ✅ Real |
| Roteamento Sonnet/Opus | ⚠️ Fallback p/ Gemini (sem SDK/chave) |
| GitHub (commits/PRs) | ⚠️ Catálogo + gates; `connected:false`, sem `executeAction()` |
| Workspace | ⚠️ Mock em memória (3 arquivos starter) |
| Auth | NextAuth com **Google + Credentials**; **sem** provider GitHub |
| Env | `.env.local` tem Google/Vertex/NextAuth/Upstash; **nenhum `GITHUB_*`** |

Conclusão objetiva: o "cérebro" (rota agente) e a "execução" (navegador) já estão
prontos. O que falta para o nível 2/3 ter valor real é **escrita no GitHub** e
**uma árvore de arquivos vinda de um repo de verdade**.

---

## 1. Por que GitHub App (e não OAuth App / PAT)

- **PAT** — um token só, mistura identidade (tudo aparece como você), não escala
  por aluno, e expõe escopos amplos. Bom só para um teste de 1 dia. Descartado.
- **OAuth App** — cada aluno autoriza com a própria conta; bom para identidade,
  mas o token carrega os escopos do usuário (privilégio amplo) e exige guardar
  refresh tokens por usuário. Mais superfície de risco para uma feature que
  escreve em repositório.
- **GitHub App (escolhido)** — identidade própria do app; **installation token de
  curta duração (~1h)**, com **permissões granulares** (Contents, Pull requests,
  Issues, Metadata) e **escopo por instalação** (só os repos onde o app foi
  instalado). Casa com o princípio de menor privilégio que a spec já adota no
  catálogo de ações. Per-aluno = cada um instala o app nos próprios repos e
  guardamos o `installationId` no perfil.

Trade-off assumido: o GitHub App exige um passo de "instalar o app" por
aluno/org (mais fricção que OAuth puro), em troca de tokens curtos e escopo
mínimo — a escolha certa quando a ação escreve código.

---

## 2. O que já foi implementado nesta leva (Fase 1 — entregue)

Tudo **build-green sem segredos**: o `octokit` é importado **dinamicamente** e a
rota só executa de verdade quando `GITHUB_APP_*` existir. Sem isso, mantém o
contrato antigo (`connected:false`, `wouldExecute`).

**Arquivos novos**

- `lib/projects/github-client.ts` — auth do GitHub App. `isGitHubConfigured()`,
  `getInstallationOctokit(installationId?)` com cache de instância e import lazy
  de `octokit`; `GitHubNotConfiguredError`. PEM com `\n`-escapado é tolerado.
- `lib/projects/github-service.ts` — operações Octokit reais + leitura de repo:
  - leitura: `listRepos`, `readRepoTree` (blobs, recursivo), `readFile`
    (base64→utf-8 + sha), `mapPathToLang()` (extensão → `Language`/Monaco, casa
    com `FileNode` da UI).
  - escrita: `createBranch`, `commitFiles` (multi-arquivo via **git data API**:
    blobs → tree → commit → update ref), `openPR`, `commentPR`, `createIssue`,
    `editIssue`, `mergePR`, `deleteBranch`.
  - `executeAction(actionId, params, installationId?)` — dispatcher id → chamada.
    `read_diff` e `force_push` lançam erro explícito "Fase 2" (ainda não impl.).

**Arquivos editados**

- `app/api/projects/github/route.ts` — `connected = isGitHubConfigured()`; `POST`
  executa de verdade via `executeAction` **depois** dos gates (auth → curso →
  autonomia → aprovação). Guarda extra: `commit` em `main`/`master` é rejeitado
  com instrução de usar `push_default` (aprovado). `GitHubNotConfiguredError → 503`.
  Mantém o contrato `wouldExecute` quando o app não está configurado.
- `prisma/schema.prisma` — `User.githubInstallationId` e `User.githubDefaultRepo`
  (Mongo: campos opcionais não exigem migration; basta `prisma generate`).
- `.env.deploy.example` — bloco `GITHUB_APP_*` (+ bloco Anthropic comentado).
- `package.json` — `octokit` e `@octokit/auth-app` adicionados (dynamic-imported).

**Verificação feita:** transpile/syntax-check (TypeScript `transpileModule`) dos 3
arquivos TS → OK; confirmado que `octokit` só aparece em `import()` dinâmico.

### Para ligar de verdade (passos do operador — fora do código)
1. `npm install` (puxa `octokit` + `@octokit/auth-app`).
2. `npx prisma generate` (novos campos do `User`).
3. Criar o GitHub App em `github.com/settings/apps`. Permissões mínimas:
   **Contents: R/W · Pull requests: R/W · Issues: R/W · Metadata: R**.
4. Gerar a private key (PEM), pegar o `App ID`, instalar o app num repo de teste
   e copiar o `installation id` da URL de instalação.
5. Preencher `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_INSTALLATION_ID`
   no `.env.local`/`.env`. Reiniciar. `GET /api/projects/github` → `connected:true`.
6. Smoke test (abaixo).

---

## 3. Fase 2 — Workspace = repositório clonado (UI)

Objetivo: trocar o `STARTER_FILES` em memória por uma árvore real, mantendo o
contrato `FileNode { path, lang, monaco, body }` (a UI quase não muda).

Passos:
- **Seletor de repo** no Explorer: `POST {actionId:"list_repos"}` → dropdown.
  Default = `User.githubDefaultRepo` quando setado.
- **Carregar árvore:** ao escolher repo/branch → `POST {actionId:"read_tree",
  params:{repo, ref}}` → preencher o Explorer (paths + lang, **sem body**).
- **Lazy load de arquivo:** ao abrir um arquivo → `POST {actionId:"read_file",
  params:{repo, ref, path}}` → guardar `body` + `sha` no `FileNode`.
- **Branch de trabalho:** botão "Criar branch" → `create_branch` (auto-nome
  `zaeon/<timestamp>` a partir do default). Editar exige branch de trabalho ativo.
- **Salvar/commit:** "Commit" coleta os `FileNode` sujos → `POST
  {actionId:"commit", params:{repo, branch, message, files:[{path,content}]}}`.
  Atualiza `sha` retornado. (O guard impede commit em `main`.)
- **Estado de conexão:** se `GET .connected === false`, manter o banner "modo
  contrato" e desabilitar ações de escrita (já há `NOT_ELIGIBLE_COPY` como
  precedente de fallback).

Verificação: abrir um repo de teste, ler árvore, abrir arquivo, criar branch,
commitar 1 arquivo, confirmar o commit no GitHub.

---

## 4. Fase 3 — Loop de autonomia ligado ao GitHub

Hoje `/api/projects/agent` já devolve `plan[]` com `needsApproval` re-carimbado do
catálogo. Falta o **executor do plano** no cliente:
- Cada passo com `githubAction` vira um `POST /api/projects/github`.
- `autonomyAllowed:false` (open_pr, merge_pr, push_default, delete_branch,
  edit_issue, force_push) **pausa** e pede clique humano (a rota já devolve `202
  needsApproval` / `409` para loop autônomo — o cliente só precisa respeitar).
- Loop: planejar → editar (Monaco) → rodar (`useCodeRunner`) → ler saída →
  próximo passo. Parar em erro e propor correção.
- **Auditoria:** logar cada ação proposta/aprovada/executada (ver Fase 5).

---

## 5. Fases posteriores (listadas, fora desta leva)

- **Tier Anthropic (Sonnet/Opus):** `npm i @anthropic-ai/sdk`, implementar
  `callAnthropic()` em `lib/ai/router.ts`, setar `ANTHROPIC_API_KEY` +
  `PROJECTS_ANTHROPIC=on`. O roteamento e o fallback já existem.
- **Hardening:** timeout de execução (ex. 10s/run) e teto de memória no Pyodide;
  rate-limit por usuário nas rotas (Upstash já está no projeto); **filtro de
  segredos** no `context` enviado ao modelo; **auditoria** (coleção de log de
  ações GitHub).
- **`read_diff` / `force_push`:** completar via git data API / endpoint de compare.
- **OAuth por usuário:** fluxo de "instalar o app" guiado na UI, gravando
  `User.githubInstallationId` automaticamente (hoje é manual/piloto).
- **CSP do iframe de preview:** revisar a flag `sandbox` em `useCodeRunner`
  (recomendado `allow-scripts`, sem `allow-same-origin` para código não confiável).

---

## 6. Contrato da rota (atualizado nesta leva)

```http
POST /api/projects/github
{
  "actionId": "commit",
  "approved": false,            // obrigatório p/ ações requiresApproval
  "autonomous": false,          // true = veio do loop; bloqueia autonomyAllowed:false
  "params": {                   // específico por ação (ver ExecuteParams)
    "repo": "owner/nome",
    "branch": "zaeon/feat-x",
    "message": "feat: ...",
    "files": [{ "path": "src/x.py", "content": "..." }]
  }
}
```

Respostas: `200 {executed:true,result}` · `202 {needsApproval:true,action}` ·
`409` (loop autônomo barrado / commit em branch padrão) · `403` (curso) ·
`503` (app não configurado) · `400` (ação/param inválido).

---

## 7. Riscos desta leva e mitigação

- **Token longo/escopo amplo** → installation token curto + permissões mínimas no
  App (não use `repo` clássico amplo). Garantido pela escolha de GitHub App.
- **Commit acidental em `main`** → guard na rota + catálogo separa `commit` de
  `push_default` (este sempre exige aprovação).
- **Build quebrar sem a dependência** → `octokit` só em `import()` dinâmico; rota
  degrada para "modo contrato".
- **Segredo no contexto do modelo** → ainda **não** mitigado (Fase 5, hardening).
  Até lá, evitar enviar arquivos sensíveis no `context` do agente.

---

## 8. Checklist de aceitação (Fase 1 → "GitHub ligado")

- [ ] `npm install` ok; `npx prisma generate` ok; `next build` verde.
- [ ] GitHub App criado, instalado em 1 repo de teste, env preenchido.
- [ ] `GET /api/projects/github` → `connected:true`.
- [ ] `list_repos` retorna o repo de teste.
- [ ] `read_tree` + `read_file` retornam árvore e conteúdo reais.
- [ ] `create_branch` cria branch; `commit` grava arquivo no branch (não em main).
- [ ] `commit` em `main` → 409; `open_pr`/`merge_pr` sem `approved` → 202.
- [ ] Usuário com curso fora de Computação → 403 em todas as rotas.
