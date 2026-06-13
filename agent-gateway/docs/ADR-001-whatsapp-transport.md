# ADR-001 — Transporte WhatsApp do Zaeon Agent (whatsmeow, não evogo)

> Status: **Aceito** · Data: 2026-06-11 · Contexto: travar a arquitetura ANTES da VPS.
> Fonte: leitura do `zenith-warmer` (`app/bridge/`, `WHATSMEOW_MIGRATION_PLAN.md`,
> `proxy_service.py`, `whatsmeow_operator.py`, `EVOGO_MIG.md`).

## Decisão 1 — Alvo do transporte: whatsmeow adapter, não evogo

O zenith-warmer está migrando de **evogo 0.7.0** (binário Go de terceiros, HTTP REST)
para o **`zenith-wa-bridge`** — serviço Go próprio com whatsmeow nativo. O contrato é:

- **Ciclo de vida** → **operator HTTP** (`adapter:9091`): `create`, `qr`, `pair`,
  `set_proxy` (`POST /instance/proxy/:id`, SOCKS5), `delete`, `logout`.
- **Mensagens** → **barramento Redis** sharded: publica `Command` em `wa:cmd:{shard}`,
  consome `Event` de `wa:evt:{shard}`. `shard = instance_id % NUM_SHARDS`.
- Estado live (JID resolvido) → operator HTTP (`/instance/all`), porque o whatsmeow
  resolve JID depois do `Connected` sem emitir novo evento.

**Consequência:** o `EvolutionTransport` (evogo HTTP) vira **legado/fallback**. O primário
é `WhatsmeowAdapterTransport`: operator HTTP (lifecycle) + publish `wa:cmd` (mensagens).
A interface `MessagingTransport` não muda — só a implementação.

## Decisão 2 — Inbound é NET-NOVO no adapter (dependência dura)

O `app/bridge/dispatch.py` só trata `kind=connection_state` e resultado de comando.
**Não existe evento de mensagem recebida** — warming é outbound-only e nunca consumiu inbound.

Pro assistente, o adapter Go **precisa** de um *inbound publisher*: registrar o handler
de `events.Message` do whatsmeow e publicar em um stream (ex.: `wa:inbound:{shard}` ou
um `kind="message"` em `wa:evt`). O agent-gateway consome esse stream no worker arq →
de-dup → turno → resposta.

> **Isto bloqueia o assistente.** É a primeira coisa a destravar no lado Go. Sem inbound,
> o agente não escuta. Não é webhook HTTP (isso era o desenho evogo); é stream Redis.

Correção no código: o `app/api/main.py /webhook/wa` fica como caminho **Cloud API futuro**;
no caminho whatsmeow o inbound entra pelo consumer de `wa:evt`/`wa:inbound` no worker.

## Decisão 3 — Proxies: faseado (geo-BR + cap por IP)

Por que warming usa proxy: muitos chips de um IP de datacenter + comportamento de bot = ban.
`proxy_service.py`: SOCKS5 (URNetwork), `MAX_INSTANCES_PER_PROXY = 5`, least-loaded,
health-check com geo-verificação, rotação.

No assistente o risco **comportamental** cai (conversa legítima do dono do número), mas
sobram dois sinais porque a sessão roda do **datacenter**, não do celular:
1. **Clustering de IP** — muitas contas não-relacionadas linkando do mesmo IP.
2. **Inconsistência geográfica** — celular no BR, dispositivo linkado saindo de IP gringo.

Plano:
- **Beta/interno (poucos números):** sem proxy. Tolerado.
- **Escala (assistente pra todo aluno):** reusar `proxy_service` — SOCKS5 **geo-BR**
  (idealmente residencial), **cap por IP**, health-check. `set_proxy` no pareamento,
  egress estável e geo-coerente por usuário. whatsmeow: `SetProxyAddress` nativo.

## Decisão 4 — Isolamento de deploy

O plano whatsmeow recomenda DB separado (`zenith_bridge`) pras tabelas de sessão whatsmeow.
Pro Zaeon: **adapter dedicado + Redis próprio + DB de sessão próprio**, isolado da frota de
warming. Mesmo binário Go, deploy separado. Razão: um bug do Zaeon não pode banir chip de
warming, e vice-versa.

## O que isto exige (checklist pré-VPS)

| Item | Lado | Bloqueia assistente? |
|---|---|---|
| Inbound publisher (`events.Message` → stream) | **Go (adapter)** | **Sim** |
| `WhatsmeowAdapterTransport` (operator HTTP + wa:cmd) | Python (feito neste commit) | — |
| Consumer de inbound no worker (wa:evt/wa:inbound) | Python | Sim |
| Adapter dedicado + Redis + DB de sessão p/ Zaeon | infra/deploy | Sim |
| Proxy geo-BR (só em escala) | infra + `proxy_service` reuso | Não (beta) |

## Alternativa considerada e rejeitada

**Ficar no evogo** pro assistente: rejeitado — é o caminho que o warmer está abandonando
(desconexão silenciosa, sem push de eventos, sem reconnect nativo). Herdaríamos dívida
que o time já decidiu pagar.
