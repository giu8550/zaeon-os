# Escritório = coworking colaborativo humano+agente (estilo Buzz) — handoff

> Aposenta o escritório 3D (R3F) e entrega um **escritório por CANAL** em tempo real: aluno +
> turma + um ou mais agentes no mesmo fio; `@agente` convoca o harness daquele agente, que
> responde com **nome e avatar próprios**. Admin (founder) cria/edita agentes, troca a foto e vê
> quem usa qual agente. Plugin Store vira "Mentores" com **Contratar mentor** e teto por papel.
> **Tudo atrás de flag, off por padrão** — o merge não muda nada até ligar.

## Flags (`.env.example`)
| Flag | Liga |
|---|---|
| `NEXT_PUBLIC_ESCRITORIO_COWORK=1` | aba "escritorio" renderiza `CoworkingCanal` (sem 3D) + rotas `/api/canal/*` (404 desligada) |
| `NEXT_PUBLIC_AGENTS_ADMIN=1` | aba **Agents** no admin + `/api/admin/agents*` (404 desligada; founder-only via `assertAdmin`) |
| `NEXT_PUBLIC_AGENT_AVATARS=1` | landing (`MentoresCarrossel`) e loja (`MentoresGrid`) leem `/api/agents/public` (lista vazia desligada) |
| `CANAL_QUEUE=1` (+`REDIS_URL`) | turnos de agente vão pro BullMQ `canal-turnos`; sem isso rodam **inline** no web (fire-and-forget, 1 por canal) |
| `CANAL_WORKER=1` | processo worker consome `canal-turnos` (`instrumentation.ts`) |

Sem flag nenhuma: a UI é idêntica a antes. As únicas mudanças sem flag são o **rebrand da loja**
("Plugar no chat" → "Contratar mentor", saldo `n/limite`) e o **teto** em `POST /api/mentors/plug`
(aluno 3 / professor 10 → 403 amigável) — pedidos explícitos do handoff. O incremento de
`AgentUsage` no `/api/ai/chat` é um write best-effort (nunca derruba o turno).

## Mapa Buzz → Zaeon (padrões extraídos, não portados literalmente)
| Buzz | Aqui |
|---|---|
| Relay WS + canais | Pusher (`lib/collab/realtime.ts`) · `canal-<id>` (`mensagem`, `agente-digitando`) · `presence-canal-<id>` (auth em `/api/canal/pusher-auth`) |
| Agente = identidade própria | `AgentProfile` (nome/avatar/bio/ativo/ordem) sobre o roster (`lib/agents/roster.ts` = personas + mentores) |
| `@mention` convoca | `lib/canal/mention.ts` (key **ou** nome: `@aura`, `@Osler`; `@desconhecido` ignorado) |
| ACP initialize/prompt | `lib/canal/agent-turn.ts` → `buildHarnessDeps` + `runTrajectory` com identidade do agente |
| Author gate | `Canal.acesso`: privado (dono) / turma (membros) / aberto (logado) — `lib/canal/gate.ts`, checado em TODA rota |
| Um turno por canal | `lib/canal/serial.ts` (fila de promessas por canal) + `lib/canal/queue.ts` (BullMQ opcional, jobId idempotente) |

## Dados (Prisma — `prisma generate` + `db push` já rodados)
`AgentProfile` (`agent_profiles`), `AgentUsage` (`agent_usage`, único por agentKey+userId),
`Canal` (`canais`), `CanalMensagem` (`canal_mensagens`). Mentores novos criados no admin também
nascem em `MentorTemplate` (curso + personaText obrigatórios).

## Arquivos
- **Libs puras (testadas):** `lib/agents/roster.ts`, `lib/canal/{mention,gate,usage,notificacoes,serial,flags,wire,vidro}.ts`, `lib/mentors/limite.ts`, `lib/admin/assertAdmin.ts`
- **Server:** `lib/canal/{agent-turn,queue,realtime,server}.ts`
- **Rotas:** `app/api/canal/{route,[id]/route,[id]/mensagem,[id]/entrar,pusher-auth,agentes}`, `app/api/agents/public`, `app/api/admin/agents/{route,[agentKey]}`; edições em `app/api/mentors/{plug,plugged}`, `app/api/ai/chat/route.ts` (só `registrarUso`), `instrumentation.ts` (worker)
- **UI:** `components/office/CoworkingCanal.tsx` + `useNotificacoesSO.ts`, `components/agents/AgentAvatar.tsx`, `app/workstation/admin/modules/AgentsModule.tsx`; edições em `app/research-lab/page.tsx` (render da aba), `admin/page.tsx` (aba), `components/main/MentoresCarrossel.tsx` (avatar), `components/mentors/MentoresGrid.tsx` (rebrand/teto/vidro)
- O 3D (`EscritorioRoom`/`OfficeScene`) continua no repo e só renderiza com a flag OFF.

## Como o turno do agente fala com a voz certa
O harness foi escrito "em Aura" (prompts de `plan/reason/draft` dizem "Você é a Aura"). Sem tocar
no harness, `agent-turn.ts` injeta um `genJson` que troca "Você é a Aura" pelo nome do agente e
anexa `IDENTIDADE DESTE TURNO`; o `systemContext` leva `buildPersona(agentKey)` (persona) ou
`resolveMentor(slug).context` (mentor) + bloco do canal (título, pessoas, outros agentes por
`@chave`, formato de conversa). Histórico: eu = `assistant`, humanos/outros agentes = `user`
rotulados. Memória L3: mentores usam `wing = slug/userId` como no chat.

## Notificações fora da tela
`lib/canal/notificacoes.ts` decide (prioridade: minha mensagem = nenhuma; resposta do MEU agente
ou `@eu` = alta; resto normal; dispara só com aba escondida OU canal fechado; agrupa 4s por
canal, alta fura). `useNotificacoesSO` faz o DOM: permissão pedida **1x no primeiro envio**
(gesto), badge `(n)` no `document.title`, `Notification` com `tag` por canal, clique foca o canal.
Não-lidas por canal no seletor e zeram ao abrir/focar.

## Cartolina embutida (seam)
`Canal.cartolinaId` + botão "▦ cartolina" quando preenchido → dispara
`window` event `zaeon:cartolina:abrir { id, canalId }` + `zaeon:set-tab "lounge"` (onde a
`LoungeCartolina` do PR #152, já no `main`, renderiza). Ligar o `id` ao board da `LoungeCartolina`
(que hoje resolve por surface/scopeId) é o próximo passo quando a PR de cowork (#154) entrar.
O dono preenche o id no ⚙︎.

## Verificado no navegador (dev, flags ligadas, login por e-mail de teste)
- Aba "escritorio" abre o canal; 1º canal auto-criado ("Meu escritório"); presença via
  `presence-canal-<id>` (auth 200); `@aura …` → mensagem no fio → "Aura está escrevendo…" por
  Pusher → resposta da Aura com nome/avatar (em dev, a resposta é a frase degradada do harness
  porque o Gemini não tem credencial local — mesmo comportamento do chat).
- Autocomplete de `@`; claro e escuro (vidro sky / navy, textos legíveis); viewport 375px.
- Loja: "Contratar mentor", saldo `0/3 → 3/3`, no teto os outros 10 botões desabilitam com a
  mensagem amigável; o servidor devolve 403 (teste) e é fail-safe sob corrida (recontagem).
- Dados de teste (usuário `cowork-teste@zaeon.test`, 2 canais, 2 mensagens, 3 contratos, 1 uso) apagados ao final.

## O que NÃO foi verificado (dizer antes de ligar em prod)
- **Resposta real do Gemini** no turno do canal (dev dá 404 de credencial Vertex, como o chat) —
  validar em prod a voz de cada agente e o avatar na bolha.
- **Notification API do SO** (precisa de permissão em aba real) e **admin Agents** no navegador
  (founder entra só pelo Google) — ambos cobertos por testes unitários/rota.
- **Dois humanos no mesmo canal** ao vivo (presença de 2+ pessoas, não-lidas de outro canal).
- **Worker BullMQ** (`CANAL_QUEUE=1`): código segue o padrão do scholar; não rodado com Redis.
- `instrumentation.ts` já tinha erros de `tsc` por `bullmq` ausente no node_modules deste worktree (pré-existentes).

## Testes
`npx vitest run` → 115 arquivos / 895 testes verdes (36 novos em `lib/canal`, 8 `roster`, 4
`assertAdmin`, 2 `limite`, 13 IDOR da rota de mensagem, 5 admin agents, 4 teto do plug).
