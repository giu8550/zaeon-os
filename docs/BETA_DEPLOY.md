# Deploy da Beta — Zaeon OS (VPS Hostinger)

Guia objetivo pra subir a beta no VPS e ligar o CI/CD do GitHub.
O `web` é um **custom server** (Next 14 + Socket.IO em `server.js`), por isso vai
de **Docker no VPS** — não em Vercel.

## 0. Visão geral

- **CI** (`.github/workflows/ci.yml`): a cada push roda `npm ci` + `prisma generate`
  + lint (não-bloqueante) + `vitest` + `next build`. É a checagem de build real.
- **CD** (`.github/workflows/deploy.yml`): no push pra `main` (ou manual), faz SSH no
  VPS, `git reset --hard origin/main` e `docker compose up -d --build`. Só roda se os
  secrets do VPS existirem.
- **Stack** (`docker-compose.yml`): `web` + `redis` + agent-gateway (Python) +
  postgres/pgvector + observabilidade (Prometheus/Loki/Grafana).

> VPS é KVM2 (2 vCPU / 8 GB, sem GPU). A stack completa é pesada. Pra beta enxuta,
> dá pra subir só o essencial: `docker compose up -d --build web redis`.

## 1. Preparar o VPS (uma vez)

```bash
ssh -p 22022 root@187.77.226.64

# Docker + compose plugin
curl -fsSL https://get.docker.com | sh
docker compose version   # confirma o plugin

# Clonar o repo no caminho de deploy
mkdir -p /opt && cd /opt
git clone <URL_DO_REPO> zaeon-os
cd zaeon-os

# Criar o .env de produção a partir do template (preencher os segredos reais)
cp .env.example .env
nano .env
```

Mongo é **Atlas externo** — preencha `DATABASE_URL` e `MONGODB_URI` com a mesma string.

### Swap (importante no 8 GB)
A beta-com-voz usa ~6,3 GB de limites (web 1,5 + voz 3 + abnt 1,2 + redis + caddy).
Cabe em 8 GB, mas crie um **swap de 4 GB** como rede de segurança contra picos (build
do torch, geração de PDF, síntese simultânea):
```bash
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab   # persiste após reboot
free -h   # confere o swap ativo
```

> A 1ª build é pesada (torch CPU + LibreOffice + next build) — pode levar 10–20 min e
> baixar bastante. Builds seguintes usam cache. Os pesos do Kokoro baixam no 1º uso e
> ficam no volume `hf_cache` (não re-baixam a cada restart).

## 2. DNS + HTTPS (Caddy)

O `web` não publica a 3000 na internet — quem fica público é o **Caddy** (80/443),
que faz TLS automático (Let's Encrypt) e proxy pro `web:3000` (com WebSocket pro
Socket.IO de fábrica). Config em `Caddyfile`.

1. Aponte um **A record** do domínio pro VPS:
   `beta.zaeon.space  →  187.77.226.64`
2. No `.env` preencha `BETA_DOMAIN` e `ACME_EMAIL`.
3. Abra as portas no firewall do VPS: 80, 443 e 22022 (SSH).

> Sem domínio ainda? Para um smoke test em HTTP, descomente `auto_https off` no
> `Caddyfile` e use `BETA_DOMAIN=:80`.

## 3. Subir manual (primeira vez / smoke test)

A beta enxuta vive em `docker-compose.beta.yml` (só **web + redis + caddy**, com
limites de memória pro 2 vCPU/8 GB). A stack completa (postgres, agentes, Grafana…)
fica no `docker-compose.yml` pra depois.

```bash
cd /opt/zaeon-os
make up          # = docker compose -f docker-compose.beta.yml up -d --build
make ps
make logs        # web + caddy
make health      # checa /api/health de dentro do container

# health externo (após DNS+TLS):
curl -s https://beta.zaeon.space/healthz       # ok
curl -s https://beta.zaeon.space/api/health    # {"status":"ok",...}
```

Sem `make`, use direto:
```bash
docker compose -f docker-compose.beta.yml up -d --build
```

## 3. Ligar o CD (GitHub Actions)

Em **Settings → Secrets and variables → Actions**, criar:

| Secret        | Valor                                            |
|---------------|--------------------------------------------------|
| `VPS_HOST`    | `187.77.226.64`                                   |
| `VPS_PORT`    | `22022`                                          |
| `VPS_USER`    | `root`                                           |
| `VPS_SSH_KEY` | conteúdo da **chave privada** SSH com acesso     |
| `DEPLOY_PATH` | `/opt/zaeon-os`                                  |

Gere o par de chaves e autorize no VPS:

```bash
ssh-keygen -t ed25519 -C "github-deploy" -f deploy_key
# copie deploy_key.pub para o VPS:
ssh -p 22022 root@187.77.226.64 'cat >> ~/.ssh/authorized_keys' < deploy_key.pub
# cole o conteúdo de deploy_key (privada) no secret VPS_SSH_KEY
```

Pronto: push em `main` dispara o deploy. Sem os secrets, o job loga um aviso e pula
(não falha o pipeline).

## 4. Segurança

- `.env` está no `.gitignore` e no `.dockerignore` — segredos nunca vão pro git/imagem.
- Use `.env.example` como contrato das chaves (sem valores).
- Super admins: ver `lib/auth/roles.ts`.
