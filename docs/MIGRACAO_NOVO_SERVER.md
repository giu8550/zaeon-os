# MIGRAÇÃO — Zaeon pro servidor novo (Hostinger caiu → VPS própria)

> Contexto: a beta (Hostinger) ficou **fora do ar** (`/api/health` = timeout). **Dados NÃO se perderam**
> — o Mongo é **Atlas externo**; usuários/estudos/conversas/memória estão salvos. Perdemos só o *host da
> aplicação*. Migramos pra **VPS própria `75.119.140.97` (24 GB / 300 GB)**, mantendo o **mesmo domínio**
> (`beta.zaeon.space`) → só repontar DNS (OAuth não muda). De brinde, sobe as 3 PRs (mentores + harness).
> Escrito 2026 (Fable). 🔒 = passo humano/credencial (executor/Martinez).

## 0. O que você precisa ter em mãos (🔒)
- **SSH** na `75.119.140.97` (root ou sudo).
- **Connection string do Atlas** (a MESMA de antes — é o que preserva os dados) → `DATABASE_URL`/`MONGODB_URI`.
- **Credencial Vertex** (`GOOGLE_CREDENTIALS` JSON + `GOOGLE_PROJECT_ID`) — a IA inteira depende disto.
- **Acesso ao DNS** do `zaeon.space` (pra repontar o registro A).
- **Acesso aos secrets do GitHub** (pra o deploy futuro mirar a box nova).
- **CI verde** nas PRs #117/#118/#119 (mergear em `main` em ordem schema→harness→UI antes ou junto).

## 1. 🔒 Provisionar a box
```bash
ssh root@75.119.140.97
apt update && apt install -y docker.io docker-compose-plugin git
# firewall: liberar 22, 80, 443
git clone https://github.com/web3-engineer/zaeon-os && cd zaeon-os
git checkout main    # já com as 3 PRs mergeadas
```

## 2. 🔒 `.env` (com o MESMO Atlas — preserva os dados)
Criar `/…/zaeon-os/.env` a partir do `.env.example`. Essenciais:
```
DATABASE_URL="mongodb+srv://…@cluster…/zaeon?…"     # o MESMO cluster/DB de prod (dados intactos)
MONGODB_URI="idem"
NEXTAUTH_URL="https://beta.zaeon.space"              # MESMO domínio → OAuth NÃO muda
NEXTAUTH_SECRET="<o mesmo de antes, se tiver; senão openssl rand -base64 32 e re-login geral>"
GOOGLE_PROJECT_ID="…"; GOOGLE_LOCATION="…"
GEMINI_MODEL=…; GEMINI_MODEL_FLASH=…; GEMINI_MODEL_PRO=…
AURA_HARNESS=1                                        # tudo ativado no deploy (decisão do Martinez)
GOOGLE_CLIENT_ID=…; GOOGLE_CLIENT_SECRET=…            # OAuth (o mesmo app Google)
```
Segredo multiline (`GOOGLE_CREDENTIALS`) → base64 num `.env.secrets` (padrão do `PLANO_SKILLS_PRS §0`), ou colar direto com aspas. `.env`/`.env.secrets` **nunca** commitados.
> Se você tinha o `.env` antigo salvo, é só reusar (troca só o que for específico de host). O `NEXTAUTH_SECRET` **igual** ao antigo mantém as sessões; diferente = todo mundo re-loga (não perde dado, só desloga).

## 3. Migrar dados? **Não precisa** — o Atlas é o mesmo
Nada de dump/restore: apontando pro mesmo `DATABASE_URL`, os dados já estão lá. O que **não** vem: cache Redis (efêmero, ok) e os artefatos do Studio no volume `studio_data` da Hostinger (podcasts/imagens antigos — **regeneráveis**, perda aceitável).

## 4. Subir a stack + tabelas novas
```bash
export COMPOSE_FILE=docker-compose.beta.yml
docker compose -f docker-compose.beta.yml up -d --build
# tabelas dos mentores (aditivas, no mesmo Atlas):
docker compose -f docker-compose.beta.yml exec -T web npx prisma db push
docker compose -f docker-compose.beta.yml logs -f web caddy
```

## 5. 🔒 Repontar o DNS (o cutover)
No painel de DNS do `zaeon.space`: registro **A** de `beta` → **`75.119.140.97`** (era o IP da Hostinger).
- Baixe o **TTL** antes (300s) pra propagar rápido. Confirme: `dig +short beta.zaeon.space` → `75.119.140.97`.
- O **Caddy** reemite o HTTPS de `beta.zaeon.space` sozinho na box nova (Let's Encrypt).
- Como o domínio é o mesmo, o **redirect do OAuth Google não muda** — nada a reconfigurar.

## 6. 🔒 Atualizar os secrets do GitHub (deploy futuro)
Settings → Secrets → Actions: `VPS_HOST=75.119.140.97`, `VPS_SSH_KEY=<chave da box nova>`, `VPS_USER`, `VPS_PORT`, `DEPLOY_PATH=<caminho do clone>`. A partir daí, push em `main` deploya aqui automaticamente.

## 7. Smoke (pós-cutover)
1. `curl -s https://beta.zaeon.space/api/health` → 200 (e com a PR de health, `{commit, harness}`).
2. Login (OAuth funciona — mesmo domínio). Uma conversa na Sala de Estudos → **resposta estruturada** (render live).
3. Plugin Store → **Mentores** → Plugar **Kekulé** → seletor ⟁ → "me explica a cafeína" → voz de farmácia + imagem inline.
4. 2ª conta não vê o mentor/memória da 1ª.
5. Logs do `web` limpos.

## 8. Rollback / rede de segurança
- Harness torto → `AURA_HARNESS=0` + `--force-recreate web` (app segue no ar, sem o harness).
- Box nova com problema grave → repontar o DNS de volta pra Hostinger **se** ela voltar; senão, corrigir na box nova (temos SSH).
- Dados nunca em risco (Atlas externo).

## 9. Ordem executável
1. CI verde nas 3 PRs → merge em `main` (schema→harness→UI). 2. Provisionar box + `.env` (Atlas mesmo). 3. `up --build` + `prisma db push`. 4. Repontar DNS. 5. Atualizar secrets do GitHub. 6. Smoke. 7. Watch.

## 10. Fronteira
Fable escreveu o runbook; o executor/Martinez roda os passos 🔒 (SSH/DNS/secrets/creds). Assim que a box responder em `beta.zaeon.space`, a Zaeon volta — **já com os Mentores e o harness no ar**.
