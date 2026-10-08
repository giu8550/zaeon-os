# HANDOFF — Agente mensageiro: chip gerenciado pela ChipFlow, e-mail e card no admin

> **v3 · 2026-10-07** — revisado depois da decisão do Martinez: **os chips da ChipFlow podem servir
> a Zaeon**, e o objetivo é só ter um campo para conectar chip e proxy, como uma conta de WhatsApp
> gerenciada pela ChipFlow.
> Isso encurta o plano de 7 para **5 PRs** e elimina o maior risco técnico (parear número frio).
> Em troca, aparece um risco novo de **governança do chip** (§2), que é agora a parte mais
> importante do documento.
> Substitui o `PR-G7` do `docs/HANDOFF_ESCRITORIO_AGENTES_V2.md`. Contratos: **C1** (`AgentTask`),
> **C5** (ledger), **C6** (virtual key).

---

## Adendo · verificado contra o código em 2026-10-07

Conferido nos checkouts mais recentes: `zenith-warmer` (`oficial/main`, contém `9db2ad22`
feat/chip-directory), `whatsapp-adapter` (`feat/save-contacts-verificado`, 2026-09-03) e o
FlowShot = `axtral-store@main` (2026-09-08). Os números de linha deste documento vêm de outros
commits e podem não bater; o conteúdo bate. Quatro correções/precisões:

1. **Presença:** o adapter lê `payload.presence` (`internal/runtime/operations/operations.go`,
   `Payload: { "jid", "presence": "available"|"composing"|"paused" }`). O `bridge.py` do FlowShot
   manda `payload.state` — é um bug do FlowShot. **Não copiar.** O shim do warmer está certo.
2. **Envelope do Command:** `{command_id, instance_id:int64, operation, payload, requested_at,
   idempotency_key}` (não `op`). XADD com campos indexados `command_id`, `instance_id` (string
   decimal), `operation`, `idempotency_key` **e `v`** = JSON compacto do Command; o adapter lê **só o
   `v`**. Event: `status ∈ sent|failed|timeout|ignored_duplicate`, `error_class`, `error_detail`,
   `kind` (`""` = resposta a comando, `connection_state`, `call_state`, `message_inbound`,
   `message_receipt`), `result`.
3. **Inbound** chega em `wa:evt:{shard}` como `kind="message_inbound"`, sem `command_id`, com
   `instance_id` numérico e `result: {from, text, type, caption, mimetype, media_url, …}`. Não há
   stream separado de inbound. O `inbound_consumer.py` do FlowShot já consome assim.
4. **Redis do bridge:** no zaeon-os **não** cair no `REDIS_URL` — ele é o broker do BullMQ e não tem
   `wa:evt`; cair nele reproduz o bug silencioso do FlowShot (consumer lendo stream vazio a vida
   toda). Ordem única pra envio e inbound: `CHIPFLOW_BRIDGE_REDIS_URL` → `BRIDGE_REDIS_URL` → null
   (= provider não configurado, erro explícito).

`chip-directory` **existe** no `oficial/main` do warmer (56 linhas + 85 de teste) com o shape
descrito em §1.1. Pendência do dono: confirmar que a ChipFlow em produção roda esse `main`.

---

## 0. O que mudou da v2 para a v3

| v2 dizia | v3 |
|---|---|
| `PR-W2` cria instância, QR e código de 8 dígitos | **Sai do escopo.** O chip vem pronto da ChipFlow. QR/pairing fica como anexo (§7), para o dia em que a Zaeon precisar de um número próprio |
| `PR-W3` liga o model `Proxy` local ao Evolution | **Sai do escopo.** O proxy é do chip e fica sob gestão do warmer — e isso é o comportamento certo. O model `Proxy` do zaeon-os continua órfão, deliberadamente |
| 72h de idade mínima, warm-up por tier no outbox | **Continua**, mas por outro motivo: não é mais "aquecer o número", é **não estourar o chip de outra pessoa** |
| — | **Novo `PR-W3`: governança do chip compartilhado.** É o que impede a Zaeon de queimar um chip da frota |

---

## 1. O contrato, extraído dos dois repos

### 1.1 Pegar a lista de chips — o lado provedor

```
GET {CHIPFLOW_API_URL}/admin/support-ops/chip-directory
Authorization: Bearer <JWT de usuário ADMIN>
params: owner_email?, min_messages=0
```
`app/api/routers/admin.py` no zenith-warmer. Auth por `require_admin` (`app/api/deps.py`): exige
`role == UserRole.ADMIN`.

Resposta — dict cru, sem `response_model`, um por chip:
`id` (int) · `evo_token` · `owner_email` · `pool` (`"operator"` se o dono é admin, senão
`"owner"`) · `tier` · `messages` · `status` · `api_version`.

Filtros da query: `is_active IS TRUE`, `deactivated_at IS NULL`, `status != BANNED`, ordenado por
`total_messages_sent desc`, **`limit(1000)` hardcoded, sem paginação**. A maturidade é filtrada em
Python depois: `messages = total_messages_sent + historical_messages_count`.

### 1.2 Enviar — o bridge Redis

Não há HTTP de envio. O padrão (portado de `backend/core/bridge.py` do FlowShot):

```
shard = chipflowId % NUM_SHARDS                    (prod usa NUM_SHARDS=1)
registra last_id do stream wa:evt:{shard}          ← ANTES do XADD
XADD wa:cmd:{shard}  { command_id, instance_id, operation, idempotency_key, v }
lê wa:evt:{shard} a partir do last_id, casando command_id
```

Redis: **`CHIPFLOW_BRIDGE_REDIS_URL`** quando `source == "chipflow"` (`bridge_url_for_source`);
fora disso cai em `BRIDGE_REDIS_URL` → `REDIS_URL`.
⚠️ **O inbound consumer do FlowShot usa ordem diferente** (`BRIDGE_REDIS_URL` →
`CHIPFLOW_BRIDGE_REDIS_URL` → `REDIS_URL`, `inbound_consumer.py`) — uma inconsistência que
**não** vamos reproduzir: no zaeon-os, uma função só resolve a URL, para envio e inbound.

`NUM_SHARDS` tem de bater em três lugares (zaeon-os, warmer `app/bridge/config.py`, e o adapter
Go). Em produção hoje é **1**, ou seja tudo no shard `"0"`.

### 1.3 Receber — inbound

`XREADGROUP` com consumer group **próprio**: `zaeon-inbound`. Nunca `flowshot-inbound`, senão os
dois produtos disputam as mesmas mensagens. O payload traz a instância → é por ela que se
descobre **qual agente** responde (hoje `brain.ts` resolve mentor por usuário; sem isso todos os
números respondem com o mesmo mentor).

### 1.4 O que o FlowShot grava ao bindar — e o que não grava

`crud/instance.py` (`bind_chipflow_sender`): idempotente por `(owner_id, linked_ref,
source="chipflow")`; grava `source="chipflow"`, `linked_ref=<id da ChipFlow>`,
`instance_id_numeric=int(chip["id"])`, `adapter_token=chip["evo_token"]`, `status="online"`,
`phone=""` — com o comentário honesto *"a ChipFlow é dona do número"*. **Não grava `proxy_url`, não
chama o adapter, não cria instância, não pede QR.** É exatamente o modelo que você descreveu: uma
conta gerenciada por fora.

---

## 2. Os cinco riscos do chip compartilhado (a parte que importa)

Nenhum destes é bug de código: são **lacunas de contrato** entre os dois produtos. Com a Zaeon
entrando como terceiro consumidor, elas deixam de ser teóricas.

**R1 · A ChipFlow não sabe que o chip foi pego.** Não existe `linked_to`, `reserved`,
`external_ref` nem `leased_to` em `app/db/models.py`. O vínculo é **unidirecional** — só o
consumidor guarda `linked_ref`. **Dois produtos podem bindar o mesmo chip**, cada um com seu teto
local, e nenhum dos dois sabe do outro. Dois × 150/dia no mesmo número é como queimar chip de
propósito.

**R2 · Chip de owner pausado continua aparecendo como elegível.** O warmer tem
`WARMING_PAUSE_TTL_SECONDS = 604800` (7 dias, por owner, marker Redis `warming_paused:{owner_id}`,
`app/services/warming_pause.py`) — inclusive **pausa automática por saúde**. **A query do
`chip-directory` não consulta esse marker.** Ou seja: o warmer pausou o chip porque ele está
adoecendo, e o diretório ainda o oferece.

**R3 · O consumo externo não volta para a conta de maturidade.** `total_messages_sent` do warmer
**não** é incrementado pelos envios de fora. Então o tier que o diretório reporta fica defasado: o
warmer acha que o chip é `baby` quando ele já mandou o volume de um `young` — e calcula delays e
concorrência com base no número errado. Existe um caminho de telemetria de volta, mas é só
observabilidade: ZSET `flowshot:activity` via `ACTIVITY_REDIS_URL`.

**R4 · `evo_token` é rotacionável sem aviso.** Gerado como `uuid4()` e trocado em
`app/services/instance_session.py`. **Não há webhook nem notificação de rotação.** No caminho do
bridge o token não é usado (o roteamento é por `instance_id`), então R4 só afeta caminhos HTTP.

**R5 · A auth do diretório é JWT de usuário admin, não token de serviço.** A própria docstring da
rota admite: *"auth dedicada (hoje reusa require_admin)"*. Para a Zaeon consumir, alguém tem de
guardar credencial de **administrador da ChipFlow** num `.env` de outro produto.

### Como a v3 trata cada um

| Risco | No zaeon-os (`PR-W3`) | Melhoria sugerida na ChipFlow (§6) |
|---|---|---|
| R1 | declarar o uso: escrever `zaeon:activity` no `ACTIVITY_REDIS_URL` a cada envio, e **ler** `flowshot:activity` para somar o consumo do dia **de todos os consumidores** antes de enviar | campo de reserva/exclusividade no `WarmerInstance` |
| R2 | checar o marker de pausa antes de enviar (leitura direta do Redis do warmer, ou novo campo no diretório) | o `chip-directory` passar a excluir chip pausado |
| R3 | reportar contagem de envios por chip de volta, no formato que o warmer já lê | o warmer somar o consumo externo em `total_messages_sent` |
| R4 | tratar 401/403 como **token stale**: re-buscar o diretório, atualizar o token, repetir **uma** vez; se falhar, marcar o canal `erro` com motivo legível | webhook ou versão do token no diretório |
| R5 | token em cofre, nunca em `.env` versionado; escopo mínimo | criar token de serviço read-only para o seam |

**Nenhuma dessas melhorias é pré-requisito** — o `PR-W3` fecha o buraco do lado da Zaeon com o que
existe hoje. Mas o R1 e o R2 são os que, se ignorados, custam chip.

---

## 3. Os PRs

### PR-W1 · `AgentChannel` — o campo para conectar o chip

Model `agent_channels`:
`agentKey` (→ `AgentProfile.agentKey`) · `tipo` (`whatsapp|email`) ·
`origem` (`chipflow | proprio | log`) · **`chipflowId`** (int, o `id` do warmer — é ele que define o
shard) · `chipflowToken` (🔒 o `evo_token`; rotacionável, ver R4) · `tokenAtualizadoEm` ·
`numero?` (E.164, informativo — **a ChipFlow é dona do número**) · `ownerEmail?` · `pool?`
(`operator|owner`) · `tierReportado?` · `mensagensReportadas?` · `apiVersion?` ·
`proxyInfo Json?` (read-only, se um dia o diretório expuser) ·
`estado` (`nao_vinculado | vinculado | pausado_na_origem | restrito | erro`) ·
`limiteDia` · `enviadosHoje` · `ultimoEnvioEm?` · `ultimoErro?` · `sincronizadoEm?` ·
`email?` · `createdAt`/`updatedAt`.
`@@unique([agentKey, tipo])`, índices `[estado]`, `[chipflowId]`.

Três coisas deliberadas:
- **`estado` tem `pausado_na_origem` e `restrito`.** `restrito` é o 463
  (`account_reachout_restricted`) do warmer: não é erro transitório nem ban, é o WhatsApp dizendo
  que aquele número está com alcance restrito. Insistir só piora.
- **`chipflowId` não é chave local.** No FlowShot, `instance_id_numeric` recebe o id da ChipFlow
  direto e **pode colidir** com um id `managed` local — a coluna é unique, e colisão vira
  IntegrityError 500 (bug documentado em `crud/instance.py`). Aqui o `chipflowId` é só
  referência externa; a chave é o `id` do próprio documento.
- `sender.ts` ganha `Provider = … | "bridge"`, lendo instância e token **do canal**, com fallback
  para a env — nada quebra sem canal.

**Gate:** canal vinculado a um chip real, envio por ele, caminho antigo intacto.

### PR-W2 · Bind: o campo no card + o transporte pelo bridge

**O fluxo que o Martinez pediu, em três cliques:**
1. No card do agente (admin), **[conectar chip]** → lista os chips do diretório com
   `tier`, `messages`, `pool`, `owner_email` e status.
2. Escolhe um → grava `chipflowId` + `chipflowToken` no `AgentChannel`, estado `vinculado`.
3. **Pronto.** Sem QR, sem código, sem proxy, sem criar instância.

Implementação:
- `lib/chipflow/diretorio.ts` — cliente do `chip-directory`. **Três correções sobre o
  `chip_directory.py` do FlowShot, que tem 51 linhas e três defeitos:**
  (a) o `try/except → return []` dele é **fail-soft silencioso**, indistinguível de "nenhum chip"
  → aqui, erro de rede/auth devolve **erro explícito** e a UI diz "não consegui falar com a ChipFlow";
  (b) ele manda `only_mature=true` e **o provedor ignora esse parâmetro** → filtrar maturidade **no
  consumidor**, não confiar no param;
  (c) **não há cache** (HTTP a cada request, timeout 15s) → cachear 60s em memória, já que o
  diretório tem `limit(1000)` e nenhuma paginação.
- `lib/chipflow/bridge.ts` — portado de `bridge.py`: `XADD wa:cmd:{shard}` + espera do evento
  terminal por `command_id`, **com o `last_id` registrado antes do XADD**. Uma função só resolve a
  URL do Redis (não repetir a divergência do §1.2). *(Na prática entrou no PR-W1 — ver spec.)*
- `lib/chipflow/inbound.ts` — `XREADGROUP` group `zaeon-inbound` sobre `wa:evt:{shard}`, filtrando
  `kind="message_inbound"`, resolvendo o agente pela instância e passando o `agentKey` ao
  `answerOnWhatsApp` (`brain.ts` hoje resolve por usuário).
- **Resultado de envio é objeto explícito e o código usa `.ok`** — nunca truthiness. No warmer,
  `EvoResult.__bool__` devolvendo `self.ok` fez um bug viver meses no `group_engine`.

**Gate:** lista de chips aparece no card; bind grava e o estado vira `vinculado`; envio chega pelo
bridge; inbound no chip X responde com o agente do canal X; ChipFlow fora do ar mostra erro, não
lista vazia.

### PR-W3 · Governança do chip compartilhado (o PR que protege a frota)

**Antes de cada envio, nesta ordem:**
1. **Pausa na origem** (R2): checar o marker `warming_paused:{owner_id}`. Se pausado → estado
   `pausado_na_origem`, não envia, e o card mostra o motivo.
2. **Consumo somado** (R1): ler a atividade de **todos** os consumidores no `ACTIVITY_REDIS_URL`
   (`flowshot:activity` + `zaeon:activity`) e somar os envios do dia **daquele chip**. O teto é
   sobre o total, não sobre o que a Zaeon mandou.
3. **Teto por maturidade** (portado de `core/warmup.py`, puro):
   `[(100, 20), (500, 50), (1000, 100)]`, efetivo `min(cap, limiteDia)`. Chip `critical` recebe 20
   mensagens por dia **somando todos os produtos**.
4. **Intervalo mínimo**: piso rígido de **60s** entre envios do mesmo chip (`warmer_rules.py`),
   nunca mais de 10–15/min.
5. **Janela de silêncio**: 22h–08h BRT, e **reagenda** em vez de recusar (`core/time.py` do
   FlowShot; `policy.ts` do zaeon-os já tem 22h–7h).
6. **Declarar o uso** (R1/R3): escrever em `zaeon:activity` a cada envio, no mesmo formato do
   `flowshot:activity` — para que o admin da ChipFlow veja a Zaeon consumindo.

**Sobre proxy — e isto é uma decisão, não um esquecimento:** o proxy do chip vive em
`WarmerInstance.proxy_string` / `ur_proxy_id` e **não sai no diretório**. O FlowShot deixa
`proxy_url` NULL para chip `chipflow` e nunca chama `set_proxy`. Está correto: quem gerencia o
proxy é o warmer, que tem probe ativo a cada 10min (`cron_audit_proxy_health`), SLO de 2500ms e
detecção de transporte morto (4 falhas/1h → cooldown de 2h). **A Zaeon não toca em proxy.** O card
mostra, read-only, o que o diretório expuser — e hoje não expõe nada, então mostra "gerenciado pela
ChipFlow". O model `Proxy` local **continua órfão de propósito**; se um dia a Zaeon tiver número
próprio (§7), ele volta a fazer sentido.

**Token stale** (R4): 401/403 no envio → re-busca o diretório, atualiza `chipflowToken`,
repete **uma** vez. Falhando, estado `erro` com motivo legível.

**Gate:** chip pausado na origem não recebe envio; dois produtos somados respeitam o teto do tier;
envio registrado em `zaeon:activity`; token rotacionado é recuperado sozinho na primeira falha.

### PR-W4 · Outbox: o agente nunca chama o transporte

Model `outbox`: `agentKey` · `canalId` · `tipo` · `destino` · `assunto?` · `corpo` ·
`origem` (`tarefa|chore|programa|humano`) · `taskId?` (**C1**) ·
`estado` (`rascunho | aguardando_aprovacao | aprovado | enviado | recusado | falhou | expirado`) ·
`motivoRecusa?` · `aprovadoPor?`/`aprovadoEm?` · `tentativas` · `proximaTentativaEm?` ·
`providerMessageId?` · `idemKey @unique` · `createdAt`.

**`idemKey` semântica** (padrão do FlowShot, `worker.py`): `agent:{taskId}:{n}` para tarefa,
`reply:{canalId}:{inboundMsgId}` para resposta. É o que impede envio duplo quando o LLM repete a
tool call.

Barreiras, na ordem: **`ENVIO_EXTERNO`** (`off|dry-run|on`, default **`dry-run`**) → **opt-in**
(`WhatsAppLink.verified && optIn`, campos já existem) → **opt-out/blocklist** (portar
`core/optout.py`: PT+EN, palavra-chave só se for a 1ª palavra **ou** mensagem ≤4 palavras;
checado **até na resposta manual** → recusa) → **as barreiras do `PR-W3`** →
**cap por destinatário** (1/dia, 3/semana — mata loop de agente proativo) →
**"digitando"** (`send_presence` com `payload.presence="composing"` + `sleep(1.2–2.8s)`) →
**aprovação** por tipo → **log append-only** (prompt, URLs lidas, tool calls, destino, aprovador,
resposta) → **kill-switch** na fila, fora do prompt.

**Retry, portando o aprendizado:** 3 tentativas, backoff `0.5 × 2^(n-1)` **com jitter** — o
original não tem jitter (`evo_client.py`), o que sincroniza a rajada quando N canais falham
juntos. Retryable: 408, 429, 5xx, erro de transporte, `status=timeout` do bridge. **4xx não**
(bug do chamador, não abre o breaker). **Permanentes, que não tentam de novo e não contam para o
breaker** (`evo_result.py`): corpo com `"not registered"`, `"client disconnected"`,
`"no active session"`, **`463`** → canal vira `restrito` e **para**. Breaker: 5 falhas retryable
consecutivas, half-open em 60s, e quando aberto **nem toca a rede**. Falha de envio **não**
propaga exceção — grava `falhou` com motivo.

Fila BullMQ `outbox`, molde de `lib/canal/queue.ts`, reenfileirando por `reenfileiravel()` de
`lib/llm/usage.ts`.

**Gate:** 48h em `dry-run` com outbox cheio e zero envio; promover um tipo e ver o log; 2ª mensagem
ao mesmo destino no dia recusada; "para" entra na blocklist; 463 marca `restrito` e para.

### PR-W5 · E-mail + o card

**E-mail** (`lib/email.ts` hoje é `console.log`): **Resend** para começar, interface abstraída
(`Provider = "resend" | "ses" | "log"`). **Domínio separado `msg.zaeon.com.br`** — nunca a raiz;
subdomínio queimado não derruba o login. `From` = `<agentKey>@msg.zaeon.com.br`, `Reply-To`
humano. **SPF + DKIM + DMARC** (implantar em `p=none` com `rua=`, subir para `quarantine`, depois
`reject`). **Webhooks + supressão automática**: `email.bounced`, `email.complained`,
`email.delivery_delayed`, `email.failed`, `email.suppressed`, `suppression.added/removed` — hard
bounce e complaint nunca são reenviados. Warm-up de 2–4 semanas. `List-Unsubscribe` no que não é
transacional. **Passa pelo mesmo outbox do `PR-W4`.**

**Card** (`PR-W6` da v2, fundido aqui): extrair o `Cartao` de
`components/main/MentoresCarrossel.tsx` para `components/agents/CardAgente.tsx` com
`variante: "vitrine" | "admin"` — mesma identidade visual (tokens de `lib/canal/vidro.ts`). A
variante `admin` acrescenta: **uso e gasto** (painel de tokens do `PR-A3`, contrato C5) e
**canais** — por canal, bolinha de estado, chip vinculado (`chipflowId`, `tier`, `pool`,
`owner_email`), número mascarado, **proxy: "gerenciado pela ChipFlow"**, consumo do dia
(`34/80, somado com os outros produtos`), e os botões **[conectar chip] [trocar chip]
[desvincular]**. `pausado_na_origem`, `restrito` e `erro` aparecem **com motivo legível** — canal
mudo sem explicação viola a lei 5 do escritório.

Atrás de `NEXT_PUBLIC_AGENT_CANAIS`; o `AgentsModule` atual não é substituído, ganha a seção.

**Gate:** e-mail chega no Gmail com `Authentication-Results` passando; hard bounce entra na
supressão; card do admin e da vitrine são o mesmo componente; com a flag off nada muda.

---

## 4. Ordem de merge

```
PR-W1 (AgentChannel) ──► PR-W2 (bind + bridge) ──► PR-W3 (governança) ──► PR-W4 (outbox)
                                                                              └─► PR-W5 (e-mail + card)
```
`PR-W3` **antes** do `PR-W4` desta vez: não faz sentido montar a fila de saída antes de saber
quanto aquele chip pode receber. E `PR-W4` verde é pré-requisito de qualquer `ENVIO_EXTERNO=on`.

Nada aqui depende de Postgres novo, de container de Evolution, nem da licença do Evolution. Usa o
Redis que você já tem e o bridge que já está em produção.

## 5. Flags

```
ENVIO_EXTERNO="dry-run"              # off | dry-run | on
WHATSAPP_PROVIDER="log"              # log | bridge | evolution(legado) | disparos(ver §8)
CHIPFLOW_API_URL=""                  # base do warmer
CHIPFLOW_ADMIN_TOKEN=""              # 🔒 JWT admin — em cofre, nunca em .env versionado (R5)
CHIPFLOW_BRIDGE_REDIS_URL=""         # 🔒 streams wa:cmd / wa:evt dos chips da frota
ACTIVITY_REDIS_URL=""                # 🔒 onde escrever zaeon:activity e ler flowshot:activity
NUM_SHARDS="1"                       # tem de bater com warmer e adapter
BRIDGE_INBOUND_GROUP="zaeon-inbound" # NUNCA "flowshot-inbound"
CANAL_INTERVALO_MIN_S="60"           # piso rígido
RESEND_API_KEY="" / EMAIL_FROM_DOMAIN="msg.zaeon.com.br"
OUTBOX_QUEUE="" / OUTBOX_WORKER=""
NEXT_PUBLIC_AGENT_CANAIS=""
```
**Lembrete:** flag `NEXT_PUBLIC_*` precisa de build-arg cabeado no Dockerfile **e** no compose.

## 6. Melhorias sugeridas no lado ChipFlow (opcionais, mas baratas)

Nenhuma bloqueia a Zaeon. As duas primeiras valem para o FlowShot também, que hoje sofre dos mesmos
problemas em silêncio:

1. **Excluir chip pausado do `chip-directory`** — a query ganha a checagem do marker de pausa. É a
   correção de maior valor por linha: hoje o diretório oferece chip que o próprio warmer pausou
   por saúde.
2. **Somar o consumo externo em `total_messages_sent`** (ou um campo `external_messages_sent`) — sem
   isso o `tier` reportado é otimista e todos os consumidores calculam ritmo com número errado.
3. **Honrar `only_mature`** — o param é enviado por dois consumidores e ignorado. Implementar ou
   remover da interface; o pior estado é o atual, em que parece funcionar.
4. **Token de serviço read-only** para o seam, em vez de JWT de admin (a própria docstring pede).
5. **Expor o estado do proxy no diretório** (sem credencial — só `proxy_health` e
   `proxy_country_code`, que já são propriedades do model), para o card do agente mostrar
   verde/vermelho sem a Zaeon precisar de acesso a proxy.
6. **Reserva/exclusividade opcional** — um campo que diga "este chip está vinculado a N
   consumidores". Resolve o R1 na origem.

## 7. Anexo: número próprio (fora do escopo, guardado)

Se um dia a Zaeon precisar de um número que não é da frota, o caminho é o Evolution legado que já
está no compose (`atendai/evolution-api:v1.8.2`, perfil opcional). O mecanismo, confirmado no código
deles: `POST /instance/create` com `{instanceName, integration:"WHATSAPP-BAILEYS", qrcode:true,
token}` devolve `base64` (QR) e `code`; **passando `number`** (no create ou em
`GET /instance/connect/{instance}?number=…`) ele chama `requestPairingCode` e devolve
**`pairingCode`** — o código de 8 dígitos. Webhook em `POST /webhook/set/{instance}`, body
aninhado, eventos em UPPER_SNAKE. Proxy por instância em `POST /proxy/set/{instance}`, e o
protocolo aceita só `http|socks|socks5` — **`https` lança erro**. Aí sim o model `Proxy` local, o
probe ativo e as 72h de aquecimento voltam a ser necessários.

## 8. Decisão pendente: o provider `"disparos"`

`.env.example` tem `DISPAROS_SEND_PATH="/api/send"` e `sender.ts` chama esse caminho. **Essa rota
não existe** no zenith-disparos — o prefixo é `/api/v1` e o envio unitário é
`POST /api/v1/conversations/{lead_id}/reply` (JWT Bearer, exige `Lead` pré-existente, o que não
serve a um agente que tem telefone). Com o bridge no lugar, o provider `"disparos"` fica sem
função. *Recomendação: remover do `sender.ts` e das envs no `PR-W2`, deixando `log | bridge |
evolution`.*

## 9. Atribuição

`zenith-warmer`, `zenith-disparos` e `axtral-store` (FlowShot) são repos do próprio Martinez — reuso
interno, sem questão de licença. Registrar em `docs/FONTES_BASE.md` a origem de cada número portado
(tiers, teto por maturidade, piso de 60s, backoff, 463, bridge, optout) **com o motivo**: os valores
de aquecimento custaram 73 chips em 25/08/2026 (`app/services/warm_speed.py` — perfil de 1–7
mensagens e menos de 72h de vida; o chip 7482 morreu 32 minutos depois de entrar num grupo público).
Quem "otimizar" esses números depois precisa saber o que está apostando.
