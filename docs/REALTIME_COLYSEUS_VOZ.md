# Realtime do cyberespaço: Colyseus (posição/presença) + voz WebRTC (tecla G)

> Tudo atrás de flag. **Padrão = Pusher, sem mudança nenhuma.** Rollback = trocar a flag e redeployar.

## O que tem

| Peça | Onde | O que faz |
|---|---|---|
| Servidor Colyseus | `server/colyseus/` (imagem própria, serviço `colyseus` no compose) | `LoungeRoom`: 1 room por sala do app (`filterBy(["salaId"])`), **teto 5** (o 6º recebe "cheia"), estado sincronizado a 20 Hz, regalias de fundador validadas, relay do signaling da voz, `GET /health` |
| Token de entrada | `POST /api/lounge3d/[id]/rt-token` | sessão (NextAuth) + membro da sala → token HMAC (2 min) com userId/nome/cor/regalias **decididos no servidor**. O Colyseus só confere a assinatura |
| Cliente | `components/lounge/salaColyseus.ts` | preenche o mesmo `remotos` que o engine lê; netcode: **interpolação 100 ms no passado + dead reckoning** (`lib/lounge3d/netcode.ts`); reentra sozinho se cair |
| Voz | `components/cyber/Voz.ts` | malha WebRTC (≤ 4 conexões), "perfect negotiation", **segurar G** (ou o botão 🎤 no celular), voz sai pelo avatar de quem fala (posicional, some aos ~28 m), 🎙 no rótulo de quem fala |
| ICE | `lib/lounge3d/ice.ts` | STUN público sempre; TURN (coturn) com credencial temporária quando configurado |
| Proxy | `Caddyfile` | `wss://<domínio>/colyseus/*` → `colyseus:2567` (`handle_path` tira o prefixo) |

Chat, conteúdo (notas) e recado do QG **continuam no Pusher** nos dois modos (são eventos raros do servidor; quase não gastam cota). O que pesa — posição a 9–15 Hz por pessoa — sai do Pusher quando a flag vira.

## Variáveis

| Variável | Onde | Valor |
|---|---|---|
| `REALTIME_SECRET` | `.env` do VPS (lido pelo **web** e pelo **colyseus**) | segredo longo e aleatório (ex.: `openssl rand -hex 32`). Sem ele o web responde 503 no `/rt-token` e o Colyseus recusa toda entrada |
| `NEXT_PUBLIC_REALTIME` | Variable do repo (build) | `pusher` (padrão) \| `colyseus` |
| `NEXT_PUBLIC_VOZ` | Variable do repo (build) | `off` (padrão) \| `on` (só funciona com `colyseus`) |
| `NEXT_PUBLIC_COLYSEUS_URL` | opcional (build) | padrão: `wss://<mesmo host>/colyseus`. Só mude se o Colyseus ficar em outro host |
| `TURN_URLS`, `TURN_SECRET` | `.env` do VPS (web) | ver coturn abaixo. Sem eles: só STUN |

## Como ligar (ordem)

1. **`.env` do VPS:** adicionar `REALTIME_SECRET=...` (o mesmo valor serve pro web e pro colyseus, os dois leem o `.env`).
2. **Merge** desta PR → o deploy sobe o serviço `colyseus` (já está na lista do deploy enxuto: `redis caddy web colyseus`). Com a flag em `pusher`, nada muda pro usuário.
3. Conferir: `curl https://<domínio>/colyseus/health` → `ok`.
4. **Virar a chave:** Variable `NEXT_PUBLIC_REALTIME=colyseus` no repo → redeploy (é flag de build).
5. Teste real com 2 pessoas no mesmo convite: as duas se veem ao entrar e o movimento é fluido.
6. **Voz:** depois do coturn (abaixo), Variable `NEXT_PUBLIC_VOZ=on` → redeploy. Segurar **G** pra falar.

**Rollback:** `NEXT_PUBLIC_REALTIME=pusher` (e/ou `NEXT_PUBLIC_VOZ=off`) → redeploy. O caminho do Pusher está intacto.

## coturn (TURN) — o passo de infra que precisa do dono

Sem TURN, ~10–20% das pessoas (NAT/firewall estrito, rede de celular, rede corporativa) **não ouvem nem são ouvidas**. O STUN resolve o resto.

1. Instalar na VPS: `apt install coturn` (ou o container `coturn/coturn`).
2. `/etc/turnserver.conf` (mínimo):
   ```
   listening-port=3478
   tls-listening-port=5349
   fingerprint
   use-auth-secret
   static-auth-secret=<TURN_SECRET — o mesmo do .env do web>
   realm=zaeon.com.br
   total-quota=100
   no-cli
   min-port=49160
   max-port=49200
   # TLS (opcional, recomendado): cert/key do domínio do TURN
   # cert=/etc/letsencrypt/live/turn.zaeon.com.br/fullchain.pem
   # pkey=/etc/letsencrypt/live/turn.zaeon.com.br/privkey.pem
   ```
3. Abrir as portas no firewall da VPS: `3478/udp`, `3478/tcp`, `5349/tcp` e o range `49160–49200/udp`.
4. DNS (se usar subdomínio): `turn.zaeon.com.br` → IP da VPS.
5. `.env` do VPS (web): `TURN_URLS=turn:turn.zaeon.com.br:3478?transport=udp,turn:turn.zaeon.com.br:3478?transport=tcp,turns:turn.zaeon.com.br:5349` e `TURN_SECRET=<o mesmo static-auth-secret>`.

As credenciais que o navegador recebe são **temporárias** (12 h, padrão REST do coturn: `username = <expira>:<userId>`, `credential = base64(HMAC-SHA1(TURN_SECRET, username))`) — o segredo nunca sai do servidor.

## O que saiu do Pusher

Nada ainda (de propósito: o Pusher é o rollback). Quando o `colyseus` estiver validado em produção, dá pra remover:
`client-pos`/`EV_POS`, a rota `app/api/lounge3d/[id]/pos`, o handshake `client-hello` e o seed de presença do `useSala3D`.
O canal de presença do Pusher (`pusher-auth`) continua enquanto chat/conteúdo/recado usarem o Pusher.

## Testes

- `server/colyseus`: `npm test` — token HMAC, regras da pose, e a sala com **servidor de verdade + clientes do SDK** (dois se veem ao entrar, pose propaga, regalia de não-fundador ignorada, relay da voz, mesma pessoa em 2 abas = 1 avatar, teto 5, outra sala = outra room, sair remove).
- raiz: `lib/lounge3d/salaColyseus.int.test.ts` — servidor + **2 clientes do módulo do navegador** (interpolação suave, voz, saída); `netcode.test.ts`; rota `/rt-token`; `lib/cyber/voz.test.ts`.
- CI instala `server/colyseus` e roda o typecheck + testes dele (bloqueante).
