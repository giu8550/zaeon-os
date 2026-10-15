# HANDOFF — Code Mode: editor estilo Zed + gateway de IA (LiteLLM) + terminal real, no sidebar

**Para:** agente executor (Claude Code)
**O que é:** um **"Code Mode"** que vive como **artefato exclusivo do sidebar** (paleta/tema próprios, no espírito do Marketplace), com: (1) um **editor de código web com o visual/UX do Zed de hoje**, (2) um **gateway de IA open-source (LiteLLM)** que faz **chaves Anthropic (e outras) funcionarem pela nossa interface**, com controle de créditos por usuário, e (3) um **terminal embutido REAL** (pty de verdade, sandboxed) — inclusive renderizável como objeto dentro do metaverso da Zaeon, mas ligado a uma sessão real pra **testar os créditos da API**.

---

## ⚠️ Decisões de base (ler antes — mudam o desenho)

### 1. Zed: replicar o visual, NÃO embutir o código
- O Zed é **Rust + GPUI nativo** (não roda em web) e o **editor é GPL-3.0** (server AGPL-3.0, GPUI Apache-2.0). Embutir/portar o source do editor **contaminaria a Zaeon com GPL** e é tecnicamente inviável no nosso stack web.
- **O que fazer:** recriar a **aparência e o comportamento** do Zed (tema, tipografia, densidade, layout de painéis, atalhos) sobre um editor web de licença permissiva. **Isso é legal e é o que o dono realmente quer** ("algo próximo do que já uso").
- **Editor recomendado: CodeMirror 6 (MIT)** — leve, extensível, tema fácil de casar com o Zed. Alternativa: **Monaco (MIT)** se quiser IntelliSense pesado (mas é mais pesado e menos "Zed-like"). **Pilotar com CodeMirror 6.**
- **Fonte dos tokens de estilo:** derivar o tema dos arquivos de tema do próprio Zed (`crates/theme`, temas "One"/"Ayu" no repo `zed-industries/zed`) — são **dados de cor/tipografia**, não código GPL portado. Reimplementar como um tema CodeMirror. Tipografia alvo: a família monoespaçada que o Zed usa por padrão (Zed Plex Mono / IBM Plex Mono — fonte com licença própria permissiva; conferir e empacotar).
> Resumindo: **"template/visual do Zed" = tema + layout reconstruídos**, não o binário/source do Zed.

### 2. Gateway: LiteLLM (open-source, self-host) em vez de OpenRouter
- Objetivo do dono: **"fazer chaves Anthropic funcionarem pela nossa interface"** + **"testar os créditos"**. Isso é um **proxy de LLM com virtual keys e orçamento**.
- **LiteLLM (MIT, BerriAI):** self-host, expõe **uma API OpenAI-compatible** pra 100+ provedores (inclui Anthropic), com **virtual keys, budgets, spend tracking, rate limit, admin UI, persistência Postgres**. Porta padrão `4000`, protegido por um **master key**. É exatamente o que precisamos.
- **OpenRouter:** é SaaS hospedado e usa as chaves *deles* — serve como **fallback/rota opcional** dentro do LiteLLM (LiteLLM pode rotear pra OpenRouter também), não como a base.
- **Fluxo de chave:** a chave **real** da Anthropic (ou do dono) fica **só no servidor do LiteLLM** (env/secret). Cada usuário da Zaeon recebe uma **virtual key** do LiteLLM com **budget** — ele "testa os créditos" gastando contra a virtual key, **sem nunca ver a chave real**. Controle e corte de gasto por usuário saem de graça.

---

## Arquitetura (visão)

```
┌───────────────────────── Zaeon (Next.js) ─────────────────────────┐
│ Sidebar ▸ Code Mode (artefato exclusivo, tema próprio)             │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────┐    │
│  │ File tree /  │  │ Editor web     │  │ Terminal (xterm.js)  │    │
│  │ tabs (Zed    │  │ CodeMirror 6   │  │ ligado a um PTY real │    │
│  │ look)        │  │ (tema Zed)     │  │ via WebSocket        │    │
│  └──────────────┘  └───────────────┘  └──────────┬───────────┘    │
│         │ chama IA                                 │ ws(pty)        │
└─────────┼──────────────────────────────────────────┼──────────────┘
          ▼                                            ▼
   /api/code/ai  ──►  LiteLLM proxy (:4000)      terminal-service
   (OpenAI-compat)    ├─ virtual keys + budget    (node-pty dentro de
                      ├─ Anthropic (chave real)    um CONTÊINER isolado
                      └─ OpenRouter (fallback)     por sessão)
                             │
                        Postgres (keys, spend)
```

- O **front** nunca fala com a Anthropic direto: fala com `/api/code/ai`, que repassa pro **LiteLLM** usando a **virtual key do usuário**.
- O **terminal** fala com um **serviço separado** (não o processo do Next) que abre um **pty dentro de um contêiner descartável por sessão**.

---

## Componentes e stack (tudo licença permissiva)
| Peça | Lib | Licença | Papel |
|---|---|---|---|
| Editor | **CodeMirror 6** | MIT | edição, syntax, tema Zed |
| Terminal (front) | **xterm.js** + addons (fit, web-links) | MIT | render do terminal |
| Terminal (back) | **node-pty** | MIT | pty real no contêiner |
| Transporte pty | WebSocket (`ws`) | MIT | stream stdin/stdout |
| Gateway IA | **LiteLLM** (`ghcr.io/berriai/litellm`) | MIT | proxy + virtual keys + budget |
| Persistência gateway | Postgres (+ Redis cache) | — | keys/spend |
| Sandbox terminal | Docker (MVP) → gVisor/Firecracker (prod) | — | isolamento |

---

## Layout de arquivos (proposto)
```
components/code/CodeMode.tsx          # shell do artefato (painéis + tema)
components/code/EditorZed.tsx         # CodeMirror 6 + tema Zed
components/code/zed-theme.ts          # tokens de cor/tipografia reconstruídos
components/code/FileTree.tsx          # árvore estilo Zed
components/code/Terminal.tsx          # xterm.js + ws client
lib/code/ai-client.ts                 # chamada OpenAI-compat -> /api/code/ai
app/api/code/ai/route.ts              # repassa ao LiteLLM com a virtual key do user
app/api/code/keys/route.ts            # cria/rotaciona virtual key + budget (LiteLLM admin API)
services/terminal/                    # micro-serviço node-pty (Dockerfile próprio)
infra/litellm/config.yaml             # modelos + provedores (Anthropic, OpenRouter)
infra/litellm/docker-compose.yaml     # litellm + postgres + redis
docs/CODE_MODE_RUNBOOK.md             # como subir/operar (gerar ao fim)
```

---

## Code Mode como artefato exclusivo do sidebar (UX)
- Entra no **sidebar como um modo próprio** (ícone dedicado), abrindo em tela cheia do painel — **paleta/tema próprios**, no mesmo espírito visual do **Marketplace** (cores exclusivas que diferenciam o modo). Reusar o padrão de artefato já existente (aba separada, não misturar com o chat).
- Layout **à la Zed:** barra lateral de arquivos à esquerda, editor central com tabs, **painel de terminal acoplado embaixo** (resizable, colapsável), command-palette (Cmd/Ctrl+Shift+P) e atalhos no estilo Zed. Densidade, cantos, divisórias e cores seguindo o tema reconstruído.
- **Acessibilidade:** foco de teclado, contraste AA, `aria` nos painéis; nada de estrobo.

---

## Gateway LiteLLM — passo a passo (plug & play)
1. **Subir o proxy** (contêiner): `infra/litellm/docker-compose.yaml` com `litellm` + `postgres` + `redis`; definir `LITELLM_MASTER_KEY`, `DATABASE_URL`, `ANTHROPIC_API_KEY` (a chave real, **só aqui**). Opcional `OPENROUTER_API_KEY` pra rota de fallback.
2. **`infra/litellm/config.yaml`:** declarar `model_list` com os modelos Anthropic (ex. claude Sonnet/Opus) apontando pro provider `anthropic`, e uma rota OpenRouter como fallback.
3. **Virtual keys por usuário:** `app/api/code/keys/route.ts` chama a **admin API do LiteLLM** (`/key/generate`) criando uma key com **`max_budget`** (ex. créditos de teste) e `user_id` da Zaeon. Guardar o id da key no usuário (não a chave real).
4. **Chamada de IA:** `app/api/code/ai/route.ts` recebe o prompt do Code Mode, injeta a **virtual key do usuário** como `Authorization: Bearer <vkey>` e chama o LiteLLM (`/v1/chat/completions` ou o endpoint Anthropic-compat). Streaming repassado ao editor.
5. **Testar créditos:** no terminal real (abaixo), o usuário roda um `curl` contra o LiteLLM com a própria virtual key e **vê o gasto descontar** (spend tracking do LiteLLM). É o "testar os créditos" pedido — de verdade, sem tocar na chave real.
6. **Budget/corte:** quando a virtual key estoura o budget, o LiteLLM recusa — a UI mostra "créditos de teste esgotados". Zero risco de gasto descontrolado.

> **Segredos:** a chave real da Anthropic **nunca** vai pro front nem pro repo. Vive no ambiente do LiteLLM (secret do servidor). As virtual keys é que circulam. (Ver §Portões.)

---

## Terminal REAL embutido (e dentro do metaverso)
Dois requisitos do dono: **(a)** terminal real embutido no Code Mode; **(b)** um terminal "virtual no metaverso" que **também é real** pra testar créditos. Mesma backend, duas superfícies de render.

- **Backend:** micro-serviço `services/terminal/` com **node-pty**; cada sessão abre um shell **dentro de um contêiner descartável** (Docker no MVP). Stream via WebSocket.
- **Front (Code Mode):** `components/code/Terminal.tsx` com **xterm.js** conectado ao ws.
- **Front (metaverso):** o mesmo stream renderizado como **superfície/objeto no mundo 3D** (um "monitor" na cena) — visual de metaverso, **sessão real** por trás (mesmo ws/pty). É "virtual na forma, real no backend".
- **Pra testar créditos:** o contêiner já vem com `curl`/`httpie` e a **virtual key do usuário** injetada como env **só naquela sessão** → o usuário roda a chamada e vê o resultado + o gasto.

### 🔒 Segurança do terminal (NÃO negociável)
- **Nunca** rodar o pty no host nem no processo do Next. **Sempre** num **contêiner isolado por sessão**, descartável, sem acesso à rede interna além do endpoint do LiteLLM.
- **Limites:** CPU/memória/tempo de vida por sessão; FS efêmero; usuário não-root; **sem montar segredos do host**. A única credencial presente é a **virtual key** daquela sessão (budget limitado), nunca a chave real.
- **Egress mínimo:** liberar só o necessário (LiteLLM + registries de pacote se o usuário for instalar algo). Bloquear o resto.
- **Prod:** migrar de Docker simples pra **gVisor/Firecracker** (isolamento mais forte). Documentar no runbook.
- **Auditoria:** logar comandos por sessão (sem vazar segredos) pra investigar abuso.

---

## Fases (cada uma com teste; commit por fase; flag `NEXT_PUBLIC_CODE_MODE=off`)
- **Fase 0 — Esqueleto & flag.** Artefato Code Mode no sidebar (tema/paleta própria), painéis vazios. *Teste:* render sem erro; flag liga/desliga.
- **Fase 1 — Editor Zed-like.** CodeMirror 6 + `zed-theme.ts` (tokens reconstruídos) + file tree + tabs + command palette. *Teste:* snapshot visual; abrir/editar/salvar arquivo do workspace.
- **Fase 2 — Gateway LiteLLM.** Subir proxy + config + virtual keys + `/api/code/ai`. *Teste:* unit do route (injeta vkey, faz streaming); integração: prompt → resposta via LiteLLM; budget estoura → 402/erro tratado.
- **Fase 3 — Terminal real (Code Mode).** node-pty em contêiner + xterm.js + ws. *Teste:* abrir sessão, rodar `echo`, `curl` no LiteLLM com a vkey e ver o spend subir; sessão morre e limpa.
- **Fase 4 — Terminal no metaverso.** Render do mesmo stream como objeto 3D. *Teste:* o objeto reflete a mesma sessão; input funciona.
- **Fase 5 — Polish & segurança.** Limites de contêiner, egress, auditoria, acessibilidade, i18n EN. *Teste:* tentativa de acesso indevido falha; limites aplicados; e2e do fluxo inteiro atrás da flag.

## Testes (padrão do repo)
- Unit: route de IA (injeção de vkey, streaming, erro de budget), criação de virtual key, tema (tokens válidos).
- Integração: prompt → LiteLLM → resposta; `curl` no terminal desconta budget; sessão de terminal isola e expira.
- e2e: abrir Code Mode → editar → pedir IA → abrir terminal → testar crédito → ver gasto. `lint` + `build` verdes antes de cada commit.

---

## 🛑 Portões do dono — PARAR e chamar o Martinez
1. **Chave real da Anthropic** (e, se usar, `OPENROUTER_API_KEY`) pro ambiente do LiteLLM — **só o dono coloca**, nunca no repo.
2. **Onde o LiteLLM e o terminal-service vão rodar** (mesma VPS de 24GB? outro host?) + domínio/porta/secrets — decisão + credenciais de infra do dono.
3. **Budget padrão das virtual keys** (quantos créditos de teste por usuário) — número do dono.
4. **Política de sandbox em prod** (Docker vs gVisor/Firecracker) e limites de recurso — ok do dono (impacta custo/infra).
5. **Fonte/licença exata da fonte monoespaçada** a empacotar (IBM Plex Mono vs outra) — confirmar.
6. **Merge/deploy e ligar a flag** — decisão do dono.
Fora isso (editor, tema, UI, terminal, integração, testes): **seguir sem perguntar.**

## Critérios de aceite
- [ ] Code Mode é **artefato exclusivo do sidebar**, tema/paleta próprios (espírito Marketplace), em aba separada do chat.
- [ ] Editor **com o visual/UX do Zed** (tema/tipografia/layout/atalhos) sobre CodeMirror 6 — **sem** código GPL portado.
- [ ] **LiteLLM** no ar; **chave Anthropic funciona pela interface** via **virtual key por usuário** com **budget**; chave real só no servidor.
- [ ] **Terminal real** embutido (pty em contêiner isolado) + o mesmo render como objeto no **metaverso**; dá pra **testar créditos** e ver o gasto descontar.
- [ ] Segurança do terminal aplicada (isolamento, limites, egress, sem segredos do host); `lint`/`build`/testes verdes.
- [ ] Runbook (`docs/CODE_MODE_RUNBOOK.md`) de como subir/operar.

## Resumo
Um **Code Mode** no sidebar (artefato exclusivo, tema próprio tipo Marketplace) com **editor web no visual do Zed** (CodeMirror 6 + tema reconstruído dos temas do Zed — nada de GPL portado), um **gateway LiteLLM self-host (MIT)** que faz **chaves Anthropic funcionarem pela nossa interface** via **virtual keys com budget por usuário** (a chave real nunca sai do servidor; o usuário "testa os créditos" de verdade e vê o gasto), e um **terminal real** (node-pty em **contêiner isolado por sessão**) embutido e também renderizado como objeto **dentro do metaverso** — virtual na forma, real no backend. Entregar em fases, atrás de flag, com testes, parando só nos Portões do dono (chaves, infra, budget, política de sandbox, fonte, merge).

---
### Fontes consultadas
- Licenças do Zed (editor GPL-3.0 / server AGPL-3.0 / GPUI Apache-2.0) — DevClass e guias 2026; conferir os arquivos `LICENSE-*` em github.com/zed-industries/zed antes de tocar em qualquer coisa do repo.
- LiteLLM (MIT, self-host, OpenAI-compatible, virtual keys + budget + spend, porta 4000, master key, imagem `ghcr.io/berriai/litellm`) — docs.litellm.ai.
