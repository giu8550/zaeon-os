# Chips de WhatsApp da Zaeon

A estrutura da ChipFlow dentro da Zaeon: chips conectados por QR, com perfil próprio, mandando e recebendo pelo **whatsapp-adapter (whatsmeow) da ChipFlow**, que roda **na VPS da Zaeon**. Não é Evolution.

```
Meu perfil (CEO) ──HTTP──▶ /api/whatsapp/chips/* ──operador HTTP──▶ wa-adapter (:9091, rede interna)
                                                                          │ whatsmeow ⇄ WhatsApp
mensagem que sai:   envio-chip → rodízio → send_presence + send_text ──▶ redis db5  wa:cmd:0 ──▶ wa-adapter
mensagem que chega: wa-adapter ──▶ wa:evt:0 (message_inbound / connection_state)
                    └─▶ server.js chama /api/whatsapp/chips/eventos a cada 3 s → handleInbound (resposta pelo MESMO chip)
```

## Peças

| Onde | O quê |
|---|---|
| `wa-adapter`, `wa-db` (docker-compose.beta.yml, perfil `chips`) | O adapter da ChipFlow e o Postgres das sessões whatsmeow |
| `lib/chipflow/operador.ts` | Cliente do operador: create, QR (PNG), status, logout, delete, **perfil** |
| `lib/chipflow/bridge.ts` | `wa:cmd`/`wa:evt` (`executarNoBridge`, `sendTextViaBridge`, `presencaViaBridge`) |
| `lib/whatsapp/chips.ts` | `WaChip`: criar, conectar (QR → conectado), editar perfil, rodízio, contadores |
| `lib/whatsapp/envio-chip.ts` | Uma mensagem por chip, na lógica do FlowShot: rodízio → "digitando…" → 1,2–2,8 s → envio → conta |
| `lib/whatsapp/eventos-chip.ts` | Ouvido dos chips: grupo `zaeon-inbound` em `wa:evt`, dedupe por `message_id`, ACK sempre |
| `components/whatsapp/ChipsCeoCard.tsx` | Card no **Meu perfil**, só para admin: conectar por QR, perfil, rodízio, teste, desconectar, apagar |

Os **papéis** de um chip:
- `zaeon`: entra no rodízio das mensagens da Zaeon e é o número que o aluno chama para se conectar.
- `agente`: fala só por aquele agente (`agentKey`). Sem chip próprio apto, o agente cai nos chips da Zaeon.
- `pessoal`: o número do admin. Não entra no rodízio da Zaeon.

**Rodízio** (FlowShot `get_eligible_instances`): um chip é elegível se estiver ativo, conectado e abaixo do `limiteDia`. Manda primeiro o que enviou há mais tempo. O contador vira à meia-noite de Brasília.

**Perfil** (nome até 25, recado até 139, foto JPEG) vai para o WhatsApp na hora se o chip estiver conectado. Senão, é aplicado quando conectar. Precisa do PR [#73 do adapter](https://github.com/Zenith-Software-Development/whatsapp-adapter/pull/73) (`POST /instance/{id}/profile`).

## Subir em prod (uma vez)

1. **Imagem do adapter.** O GHCR dele é privado, então a imagem é construída na VPS a partir do repo, sem precisar de credencial lá:
   ```bash
   cd whatsapp-adapter && git archive --format=tar.gz -o /tmp/wa.tgz <branch-ou-sha>
   scp /tmp/wa.tgz root@VPS:/tmp/
   ssh root@VPS 'rm -rf /root/wa-adapter-src && mkdir -p /root/wa-adapter-src && tar xzf /tmp/wa.tgz -C /root/wa-adapter-src && cd /root/wa-adapter-src && docker build -t zaeon-wa-adapter:local .'
   ```
2. **`.env` da VPS** (`/root/zaeon-os/.env`):
   ```
   WHATSAPP_CHIPS=1
   WA_DB_PASSWORD=<aleatório>
   WA_OPERATOR_TOKEN=<aleatório>
   WA_OPERATOR_URL=http://wa-adapter:9091
   CHIPFLOW_BRIDGE_REDIS_URL=redis://redis:6379/5
   NUM_SHARDS=1
   WHATSAPP_PROVIDER=chips
   WHATSAPP_INTERNAL_TOKEN=<aleatório>
   WHATSAPP_WEBHOOK_SECRET=<aleatório>
   ```
3. Rode de novo o último deploy: `gh run rerun <id do deploy.yml>`. **Nunca** suba o web à mão: o compose pega `APP_URL`/`GIT_SHA`/flags da shell do deploy (ver docs/CHAT_DESEMPENHO.md).
4. No **Meu perfil** → *Chips de WhatsApp · CEO* → **Conectar chip** → escaneie o QR (WhatsApp → Aparelhos conectados → Conectar um aparelho).

## Testar

- No card: **Testar**, informando um número, manda uma mensagem por aquele chip.
- O aluno conecta o número dele pelo card "Mentor no WhatsApp": QR `wa.me` para o número do chip da Zaeon com `CONECTAR-XXXXXX`. A resposta sai pelo mesmo chip.
- Logs do web: `[chips] lidos=… respondidos=… estados=…`.
