# CI/CD autônomo da Zaeon — `git push` → deploy sozinho (estilo coexist-prod)

> Depois deste setup (uma vez só), todo `push`/merge na `main` sobe a Zaeon na VPS
> automaticamente, **sem ninguém dar SSH na mão** — e sem derrubar outras stacks no
> mesmo servidor (ChipFlow/disparos). O pipeline é o `.github/workflows/deploy.yml`.
> Escrito 2026-09-14. 🔒 = passo que só você faz (tem segredo/servidor).

## Como funciona (resumo)
`push na main` (ou botão **Run workflow**) → GitHub Actions conecta por SSH no VPS →
`git reset --hard origin/main` → escreve `.env.secrets` a partir do secret base64
(credencial Vertex sempre em UMA linha) → `docker compose up -d --build` (só web+redis+caddy
por padrão) → `prisma db push` → **health-gate** (falha e mostra log se `/api/health` não
responder) → limpa imagens órfãs. Isolado por projeto (`name: zaeon-beta`), então **não
mexe na ChipFlow**.

## 🔒 Passo 1 — Chave SSH dedicada de deploy (no teu Mac)
```bash
ssh-keygen -t ed25519 -f ~/.ssh/zaeon_deploy -N ""          # gera par (sem passphrase)
ssh-copy-id -i ~/.ssh/zaeon_deploy.pub root@75.119.140.97   # autoriza a PÚBLICA na box
# (ou cole o conteúdo de ~/.ssh/zaeon_deploy.pub em /root/.ssh/authorized_keys do server)
cat ~/.ssh/zaeon_deploy                                      # <- conteúdo da PRIVADA (vai pro secret)
```

## 🔒 Passo 2 — Base64 da credencial Vertex (no teu Mac)
Pega o JSON do service account (o mesmo que está no `.env`/`.env.secrets`) e gera a linha base64:
```bash
base64 -i /caminho/para/service-account.json | tr -d '\n' | pbcopy   # copiado pro clipboard
```
> Não tem o arquivo .json solto? Dá pra extrair do `.env` do server, mas o mais limpo é
> baixar de novo o JSON no console do Google Cloud (IAM → Service Accounts → Keys).

## 🔒 Passo 3 — Cadastrar os secrets (GitHub → Settings → Secrets and variables → Actions)
Aba **Secrets** → New repository secret, um por um:

| Secret | Valor |
|---|---|
| `VPS_HOST` | `75.119.140.97` |
| `VPS_PORT` | `22` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | conteúdo da **privada** `~/.ssh/zaeon_deploy` (do Passo 1) |
| `DEPLOY_PATH` | `/root/zaeon-os` |
| `GOOGLE_CREDENTIALS_B64` | a linha base64 (do Passo 2) |
| `GOOGLE_PROJECT_ID_VALUE` | o project id do Google |

Aba **Variables** (opcional):

| Var | Quando usar |
|---|---|
| `DEPLOY_COMPOSE` | trocar o compose (default `docker-compose.beta.yml`) |
| `DEPLOY_WITH_VOICE` | `true` pra subir voice-engine/abnt junto (come RAM) |

## Passo 4 — Disparar
- **Automático:** todo `push`/merge na `main` (menos mudanças só de `.md`/`docs/`).
- **Manual:** aba **Actions** → *Deploy (VPS)* → **Run workflow**. Opções: `rebuild`,
  `with_voice`, `db_push`. É esse botão que eu (ou o Claude Code na tua máquina via
  `gh workflow run "Deploy (VPS)"`) posso mandar acionar.

## Rollback / segurança
- App subiu torto → o health-gate **falha o deploy e imprime `docker compose logs web`**;
  o container antigo continua servindo até um deploy verde.
- Voz comendo RAM → deixe `DEPLOY_WITH_VOICE` desligada (padrão). Ligue só quando for testar.
- Dados nunca em risco: Mongo é Atlas externo; `prisma db push` só cria/ajusta coleções.
- Coexist: nada de `--remove-orphans`; a ChipFlow no mesmo server fica intocada.

## Por que isso me "adapta" a operar o deploy
Eu não tenho SSH a partir do meu ambiente, mas tenho o repositório. Com este pipeline,
**editar código + push** já é o deploy — e o `workflow_dispatch` dá um botão que pode ser
acionado por você, por mim (via um agente com acesso ao `gh`/GitHub) ou pelo Claude Code
rodando na tua máquina. O servidor deixa de ser um gargalo manual.

## Fase 2 (opcional, recomendável nessa box pequena)
Buildar as imagens **no GitHub Actions** e publicar no GHCR; o VPS só faz `pull` (sem
tempestade de build/RAM na box — que foi o que travou no dia 14/09). Trocar `build:` por
`image:` no compose + login no GHCR. Peça quando quiser que eu escreva.
