# Setup do Docker na VPS — passo a passo (primeira vez)

Guia pra subir a beta da Zaeon do zero numa VPS Hostinger, explicando o **porquê**
de cada passo. Valores reais deste projeto:

| Item        | Valor               |
|-------------|---------------------|
| IP da VPS   | `187.77.226.64`     |
| Porta SSH   | `22022`             |
| Usuário     | `root`              |
| Pasta app   | `/opt/zaeon-os`     |
| Domínio     | `beta.zaeon.space`  |

> Mapa mental: **imagem** = a "caixa" com o app empacotado. **container** = a caixa
> rodando. **docker compose** = sobe várias caixas (web + redis + caddy) de uma vez,
> lendo o `docker-compose.beta.yml`. Você só instala Docker na VPS — nada de Node.

---

## 1. Conectar na VPS por SSH

No seu Mac, no terminal:

```bash
ssh -p 22022 root@187.77.226.64
```

- `-p 22022` é a porta SSH (a Hostinger não usa a 22 padrão aqui).
- Na primeira vez ele pergunta "are you sure…?" → digite `yes`.
- Senha: a que a Hostinger te deu (ou a sua chave SSH, se já configurou).

Se conectou, você está "dentro" da VPS. Tudo daqui pra frente roda **lá**, não no Mac.

### (Recomendado) Login por chave SSH em vez de senha

No **seu Mac** (uma vez):

```bash
ssh-keygen -t ed25519 -C "martinez-mac"      # Enter em tudo; cria ~/.ssh/id_ed25519
ssh-copy-id -p 22022 root@187.77.226.64       # copia a chave pública pra VPS
```

Depois você loga sem digitar senha. Mais seguro e necessário pro deploy automático.

---

## 2. Atualizar o sistema

Dentro da VPS:

```bash
apt update && apt upgrade -y
```

- `apt` é o gerenciador de pacotes do Ubuntu/Debian.
- `update` baixa a lista de versões; `upgrade -y` instala as atualizações (`-y` = "sim
  pra tudo"). Mantém a máquina sã e fechando brechas de segurança.

---

## 3. Instalar o Docker

```bash
curl -fsSL https://get.docker.com | sh
```

- Baixa o script oficial da Docker e executa. Ele detecta o Ubuntu e instala o
  **Docker Engine** + o plugin **compose** juntos.
- Confirme:

```bash
docker --version            # ex.: Docker version 27.x
docker compose version      # ex.: Docker Compose version v2.x
```

> Note: é `docker compose` (com espaço), não `docker-compose` (com hífen, antigo).

Teste rápido que o Docker funciona:

```bash
docker run --rm hello-world
```

Se aparecer "Hello from Docker!", tá tudo certo. (`--rm` apaga o container de teste
no fim.)

---

## 4. Firewall (UFW) — abrir só o necessário

O firewall bloqueia tudo por padrão e a gente abre só as portas que usamos. **Atenção:
abra o SSH ANTES de ligar o firewall**, senão você se tranca pra fora.

```bash
apt install -y ufw
ufw allow 22022/tcp     # SSH (a NOSSA porta, não a 22!)
ufw allow 80/tcp        # HTTP  (Caddy redireciona pra HTTPS)
ufw allow 443/tcp       # HTTPS (o site de fato)
ufw enable              # liga o firewall (confirme com 'y')
ufw status              # confere o que está aberto
```

- A 3000 (do Next) **não** é aberta: quem fala com a internet é o Caddy (80/443),
  que repassa internamente pro `web:3000`.

---

## 5. Apontar o domínio pra VPS (DNS)

No painel onde você gerencia o domínio `zaeon.space` (Hostinger/registrar), crie um
registro:

```
Tipo: A    Nome: beta    Valor: 187.77.226.64
```

Isso faz `beta.zaeon.space` apontar pra VPS. Pode levar de minutos a algumas horas pra
propagar. Confira com:

```bash
dig +short beta.zaeon.space      # deve devolver 187.77.226.64
```

O Caddy **só consegue emitir o certificado HTTPS depois** que o DNS estiver apontando
certo. Então faça esse passo antes do `make up`.

---

## 6. Instalar o git e clonar o projeto

```bash
apt install -y git
mkdir -p /opt && cd /opt
git clone <URL_DO_SEU_REPO> zaeon-os
cd zaeon-os
```

- Se o repo for privado, use HTTPS com um Personal Access Token, ou configure uma
  deploy key SSH. (Posso te ajudar com isso quando chegar a hora.)

---

## 7. Configurar os segredos (.env)

O app precisa de chaves (banco, IA, etc.). Elas **nunca** vão pro git — ficam só no
`.env` da VPS. Use o template:

```bash
cp .env.example .env
nano .env        # editor de texto no terminal
```

No `nano`: edite, salve com **Ctrl+O** (Enter), saia com **Ctrl+X**.

Mínimo pra beta funcionar:

- `DATABASE_URL` e `MONGODB_URI` → mesma string do MongoDB Atlas.
- `NEXTAUTH_URL=https://beta.zaeon.space` e `NEXTAUTH_SECRET` (gere com
  `openssl rand -base64 32`).
- `BETA_DOMAIN=beta.zaeon.space` e `ACME_EMAIL=seu-email` (pro certificado).
- As chaves de IA (Gemini/Vertex) e o resto conforme o `.env.example`.

---

## 8. Subir a beta 🚀

```bash
cd /opt/zaeon-os
make up
```

O que acontece:
1. Docker **builda** a imagem do `web` (instala deps, roda `next build`) — a 1ª vez
   demora alguns minutos.
2. Sobe 3 containers: `web`, `redis`, `caddy`.
3. O Caddy pede o certificado HTTPS pro Let's Encrypt automaticamente.

Acompanhe:

```bash
make ps          # status dos containers (procure "healthy" no web)
make logs        # logs ao vivo do web + caddy (Ctrl+C pra sair)
make health      # testa /api/health por dentro do container
```

Teste de fora (depois do DNS+TLS):

```bash
curl -s https://beta.zaeon.space/healthz       # ok
curl -s https://beta.zaeon.space/api/health    # {"status":"ok",...}
```

Agora abra `https://beta.zaeon.space` no navegador. 🎉

---

## 9. Comandos do dia a dia

```bash
make logs        # ver o que está acontecendo
make restart     # recriar containers (após mudar .env)
make deploy      # git pull + rebuild + sobe (deploy manual)
make down        # parar tudo (sem apagar dados)
make ps          # status
docker stats     # uso de CPU/RAM por container (q pra sair)
```

Quando ligar o **deploy automático** (secrets do GitHub no `docs/BETA_DEPLOY.md`),
todo push na `main` roda o `make deploy` sozinho via SSH.

---

## 10. Problemas comuns

- **`make: command not found`** → `apt install -y make`, ou use o comando cru:
  `docker compose -f docker-compose.beta.yml up -d --build`.
- **Caddy não pega HTTPS / erro de certificado** → o DNS ainda não apontou. Cheque
  `dig +short beta.zaeon.space` e veja `docker compose -f docker-compose.beta.yml logs caddy`.
- **web fica "unhealthy" / reiniciando** → quase sempre `.env` faltando algo. Veja
  `make logs`. Erro de Mongo? Confira `DATABASE_URL`/`MONGODB_URI` e libere o IP da VPS
  no **Network Access** do Atlas (ou `0.0.0.0/0` pra teste).
- **Porta 80/443 ocupada** → tem Apache/Nginx rodando na VPS:
  `systemctl stop apache2 nginx` e `systemctl disable apache2 nginx`.
- **Build estourou memória** → suba só o essencial (a beta já é enxuta) e cheque
  `docker stats`. Se precisar, dá pra adicionar swap.
- **"Cannot connect to the Docker daemon"** → `systemctl start docker` e
  `systemctl enable docker` (liga no boot).

---

## 11. Segurança mínima (faça em algum momento)

- Trocar login por senha → **chave SSH** (passo 1) e depois desabilitar senha.
- Criar um usuário não-root pra operar (opcional na beta, recomendado depois).
- Manter `ufw` ligado e o sistema atualizado (`apt upgrade`).
- `.env` com permissão restrita: `chmod 600 .env`.
- Nunca commitar `.env` (já está no `.gitignore`).
```
