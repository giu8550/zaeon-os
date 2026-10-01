# BRING-UP — Zaeon na VPS nova (75.119.140.97) + deploy autônomo

> Objetivo: pôr a Zaeon de pé na VPS `75.119.140.97` (24GB/300GB) e deixar o deploy **autônomo**
> (push na `main` → deploy sozinho). Depois disto, o único trabalho braçal é repontar o DNS.
> **Dados intactos:** apontamos pro MESMO Mongo Atlas. Escrito 2026 (Fable). 🔒 = você executa (SSH/DNS/secrets).

---

## PARTE A — Bring-up manual (colar no SSH da box, 1×)

**A0. Chave de acesso (1×).** No teu Mac: `ssh-keygen -t ed25519 -f zaeon_vps` → copie a **pública** pra box (`ssh-copy-id` ou cole em `~/.ssh/authorized_keys` do root). Guarde a **privada** pro passo C (CI/CD).

**A1. Provisionar + subir** — `ssh root@75.119.140.97` e cole:
```bash
apt update && apt install -y docker.io docker-compose-plugin git
systemctl enable --now docker
# repo (privado): use um deploy key/PAT — ex. com gh, ou clone via SSH com a chave da box no GitHub
git clone https://github.com/web3-engineer/zaeon-os && cd zaeon-os
git checkout main

# .env — MESMO Atlas (preserva dados) + Vertex + harness ligado
cat > .env <<'EOF'
DATABASE_URL="<A_MESMA_CONNECTION_STRING_DO_ATLAS>"
MONGODB_URI="<IDEM>"
NEXTAUTH_URL="https://beta.zaeon.space"
NEXTAUTH_SECRET="<O_MESMO_DE_ANTES__senao_todos_relogam>"
GOOGLE_PROJECT_ID="<...>"
GOOGLE_LOCATION="us-central1"
GEMINI_MODEL="<...>"; GEMINI_MODEL_FLASH="<...>"; GEMINI_MODEL_PRO="<...>"
GOOGLE_CLIENT_ID="<...>"; GOOGLE_CLIENT_SECRET="<...>"
AURA_HARNESS=1
EOF

# GOOGLE_CREDENTIALS (JSON multilinha) → base64 num .env.secrets (nunca commitado)
# no teu Mac:  base64 -i gcp-sa.json | tr -d '\n'   → cole abaixo como <B64>
echo "GOOGLE_CREDENTIALS=$(echo '<B64>' | base64 -d | tr -d '\n')" > .env.secrets

export COMPOSE_FILE=docker-compose.beta.yml
docker compose -f docker-compose.beta.yml up -d --build
docker compose -f docker-compose.beta.yml exec -T web npx prisma db push   # cria coleções novas no Atlas
```

**A2. Verificar (no teu Mac):** `curl -k https://75.119.140.97/api/health` → **200**. (Ou `curl http://75.119.140.97:3000/api/health` se o Caddy ainda não pegou cert por IP — normal; o HTTPS válido vem com o domínio no passo B.)

---

## PARTE B — 🔒 Repontar o DNS (o site volta)
No painel de DNS do `zaeon.space`:
- Baixe o **TTL** de `beta` pra 300s (propaga rápido).
- Registro **A** de `beta`: **`187.77.226.64` → `75.119.140.97`**.
- Confirme: `dig +short beta.zaeon.space` → `75.119.140.97`. O **Caddy** emite o HTTPS de `beta.zaeon.space` sozinho.
- Como o domínio é o mesmo, **OAuth do Google não muda**.
**Verificar:** `curl https://beta.zaeon.space/api/health` → 200. **A Zaeon voltou — na nossa VPS.**

---

## PARTE C — Deploy AUTÔNOMO (push → deploy, pra sempre)
O `deploy.yml` já faz SSH+`git reset --hard origin/main`+`docker compose up` e lê secrets. Só **apontar os secrets pra box nova** (GitHub → Settings → Secrets and variables → Actions):
```
VPS_HOST                = 75.119.140.97
VPS_USER                = root
VPS_PORT                = 22
VPS_SSH_KEY             = <conteúdo da chave PRIVADA zaeon_vps (do A0)>
DEPLOY_PATH             = /root/zaeon-os        (o caminho do clone do A1)
GOOGLE_CREDENTIALS_B64  = <B64 do gcp-sa.json>  (o mesmo do A1)
GOOGLE_PROJECT_ID_VALUE = <project id>
```
Confirme no `deploy.yml` que o passo SSH usa `secrets.VPS_HOST/VPS_SSH_KEY/DEPLOY_PATH` (usa). A partir daqui: **`git push origin main` → deploy automático na VPS**. Sem SSH na mão.

---

## PARTE D — Rollback / segurança
- App torto → `ssh ... 'cd /root/zaeon-os && sed -i "s/^AURA_HARNESS=.*/AURA_HARNESS=0/" .env && docker compose -f docker-compose.beta.yml up -d --force-recreate web'` (harness off, app segue).
- Deploy quebrou → o container antigo continua até o novo subir; `docker compose logs -f web` mostra o erro.
- Dados nunca em risco (Atlas externo). Studio antigo (volume da Hostinger) não vem — regenerável.

---

## O que é MEU vs SEU (honesto)
Fable escreveu este script e os specs — **não tenho SSH/DNS/secrets**, então não executo. **Você (ou o Claude Code com a chave)** roda A1, seta os secrets (C) e reponta o DNS (B). Depois de C, todo deploy futuro é **autônomo** (push → sobe). Placeholders `<...>` = teus segredos (Atlas/Vertex/OAuth) — nunca os coloque em commit; ficam só no `.env`/`.env.secrets` da box e nos secrets do GitHub.
```
Ordem: A0 chave → A1 subir → A2 curl no IP = 200 → B repontar DNS → C secrets (deploy autônomo).
```
