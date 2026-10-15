# HANDOFF — Octa Code: agente chat+IDE plugável, comprável no Marketplace

**Para:** agente executor (Claude Code)
**Supersede/estende:** `HANDOFF_CODE_MODE_ZED.md` (reusa dali o **gateway LiteLLM**, o **terminal real em contêiner** e o **tema estilo Zed**). Este doc redefine o produto como **"Octa Code"**: um **plugável de marketplace** que se comporta como **chat E IDE**, trocável com os personagens dentro do próprio chat.
**Base real no repo (do scan):** Monaco já ligado (`app/agentic-modules/codelab/*`), Octokit andaimado (`lib/projects/github-*.ts`), MCP + skills-marketplace no harness (`lib/agent/{mcp,skills,runtime}.ts`), cérebro Vertex/Gemini + rota Anthropic (`lib/ai/router.ts`). **Nada disso parte do zero.**

> **Nome:** o produto se chama **Octa Code** (nunca "Zaeon Code"). Ícone próprio, destacado.

---

## 1. O que é (produto)
**Octa Code** é um **agente de código** que o usuário **compra no Marketplace** e passa a ter **dentro do chat**. Uma vez comprado:
- Ele **se comporta como os dois ao mesmo tempo**: um **chat** (conversa sobre o código) e uma **IDE** (abre o projeto, edita, roda, usa terminal). Na prática, **é como se o Octa estivesse usando a própria IDE** — o usuário vê o agente operando o editor/terminal.
- O usuário **escolhe no chat** se quer **conversar** com ele ou **abrir a IDE** que contém o projeto — pelo mesmo ícone.
- Capacidades mira **1:1 com Claude Code / Zed / opencode** (file tree, multi-arquivo, terminal real, rodar código, git/GitHub, loop agêntico plan→edit→run→observe, MCP, skills) — **mesmo que mais lento** — com a **interface visual do Zed**.

## 2. Marketplace: novo lugar e o item Octa Code
- **Mover o Marketplace para o FIM da sidebar, logo ACIMA de "Perfil"**, mantendo seu **ícone destacado** (realce visual atual preservado).
- **Octa Code é um item comprável** nesse Marketplace. Reusar o conceito de marketplace que já existe no pilar Skills (`lib/agent/skills.ts` já lê/valida `marketplace.json`): o Octa Code entra como um **módulo/plugin vendável**.
- **Comprar = ganhar entitlement.** A compra grava um **entitlement** no usuário (reusar `lib/plans.ts` + o gating `permit()` `minPlan`/entitlement em `lib/agent/runtime.ts`). Sem entitlement, o plug no chat aparece **bloqueado com CTA "obter no Marketplace"**; com entitlement, **destrava**. (Pagamento real = portão do dono; no MVP, entitlement por plano/flag.)

## 3. O plug dentro do chat (gatilho)
- **No lugar do botão de "gerar mindmap"**, colocar o **ícone do Octa Code**. (O mindmap sai desse slot; se ainda for necessário, realocar — confirmar com o dono.)
- Clicar no ícone **pluga o Octa Code na conversa**: abre a **superfície IDE** (aba/painel separado do chat, estilo artefato — não mistura com a conversa) **ou** continua no modo chat. Alternável a qualquer momento pelo mesmo ícone.
- O plug é **embutido no chat**: a sessão do agente, o projeto e o histórico ficam atados àquela conversa.

## 4. Troca de agentes (personagens) — começar com 2
- **O ícone do personagem no chat reflete quem está sendo usado.** Clicar nele **troca o agente ativo** — e o **ícone muda** pro do agente selecionado. A troca pode acontecer **a qualquer hora**, alternando entre os chats/threads de cada um.
- **Começar com apenas 2 agentes** (ex.: dois perfis de Octa Code — um "rápido", um "profundo", ou dois personas distintos). Cada agente tem **sua própria thread** e **seu próprio contexto/sessão**.
- **Concorrência mantida e otimizada ao máximo:**
  - Cada agente roda em **sua própria sessão isolada** (contêiner próprio pro terminal/execução — ver `HANDOFF_CODE_MODE_ZED.md`), em **paralelo**, sem um bloquear o outro.
  - **Modelo compartilhado via LiteLLM** (uma fila/gateway só) com **streaming** e **cancelamento** por thread; **pool de contêineres** reutilizável; **debounce/coalescing** de chamadas; limites de concorrência por usuário pra não estourar custo.
  - Estado por agente **isolado** (nada vaza de uma thread pra outra); trocar de ícone **nunca** mata a tarefa do outro — ela continua rodando em background e o usuário volta e encontra pronto.

## 5. Paridade de capacidades (1:1 com Claude Code/Zed/opencode) — honesto
O alvo é a **mesma caixa de ferramentas**, rodando **server-side num contêiner** (por isso "mesmo que demorado"):
- **Editor/UX = Zed** (tema/tipografia/layout/atalhos) sobre **Monaco** (já no repo) ou CodeMirror 6 — **sem portar código GPL do Zed** (ver flag abaixo).
- **Ferramentas do agente:** ler/escrever múltiplos arquivos, **terminal real** (node-pty em contêiner), **rodar código** (Pyodide no cliente p/ preview rápido + contêiner p/ execução real), **git/GitHub** (Octokit, com o catálogo de risco+aprovação que já existe em `lib/projects/github-actions.ts`), **MCP** (conectar ferramentas externas), **skills** (agentskills.io).
- **Loop agêntico:** planejar → editar → rodar → ler saída → corrigir, com checkpoints de aprovação nas ações irreversíveis (o catálogo de risco já cobre isso).
> ⚠️ **Honestidade:** **não** dá pra "rodar o Zed" (é Rust/GPUI nativo, editor **GPL-3.0**). "1:1 com Zed" = **replicar a interface** do Zed + **igualar as capacidades** de um agente de código (Claude Code/opencode), **não** embarcar o binário/source do Zed. É o que é viável e legal. Paridade total de velocidade/contexto depende de infra (contêineres, budget de modelo) — por isso "mesmo que demorado".

## 6. Conectar os agentes ao Escritório do Perfil (CopilotKit / AG-UI / OpenDots)
Requisito central: os agentes se **conectam ao nosso próprio escritório do perfil**, e **a conexão nasce dentro de uma sala do escritório com o nome do projeto**.
- **Protocolo de ligação: AG-UI (CopilotKit).** É o protocolo aberto que faz o **agente conversar com a nossa app com estado compartilhado + human-in-the-loop** — exatamente a ponte agente↔interface. Usar AG-UI como o "barramento" entre o Octa Code e o front (chat/IDE/escritório). (CopilotKit/CoAgents, MIT.)
- **Padrão OpenDots (referência, não cópia):** cada agente tem **seu próprio workspace/"computador" que PERSISTE** entre sessões. Mapeia direto no nosso caso: **projeto → sala do escritório (com o nome do projeto) → sessão do agente + contêiner/workspace persistente**. Finalizados vão pra uma "Space"/biblioteca (no nosso caso, os artefatos/arquivos do projeto no perfil).
- **A sala do escritório:** ao plugar o Octa Code num projeto, **criar uma sala no escritório do perfil nomeada com o projeto**; é ali que a conexão agente↔projeto vive (sessão, histórico, arquivos, credenciais da sessão). Reusar a estrutura de "escritório"/perfil existente (`app/.../perfil` / `lib/user`) — se não houver, criar o conceito de sala-de-projeto.
- **Estado compartilhado:** o que o agente faz na IDE reflete na sala do escritório e vice-versa (via AG-UI shared state), pra o usuário ver o progresso "ao vivo".

## 7. Grounding no repo (o que reusar, não reinventar)
- **Editor:** `app/agentic-modules/codelab/CodeLabModule.tsx` + `useCodeRunner.ts` (Monaco + Pyodide + iframe sandbox) — **evoluir** pra IDE multi-arquivo com tema Zed.
- **GitHub:** `lib/projects/github-service.ts` + `github-actions.ts` (catálogo de risco) — **instalar `octokit` + OAuth app** p/ sair do andaime.
- **Harness/tools:** `lib/agent/runtime.ts` (permit deny-by-default, risco×plano), `mcp.ts` (conectores), `skills.ts` (marketplace). O Octa Code é **um consumidor desse runtime** + um item no marketplace de skills.
- **Modelo:** `lib/ai/router.ts` (Vertex/Gemini ligado; Anthropic andaimado) + **gateway LiteLLM** do outro handoff (virtual keys/budget por usuário).
- **Terminal:** micro-serviço node-pty em contêiner (do `HANDOFF_CODE_MODE_ZED.md`).

## 8. Entregáveis finais (o que "pronto" significa)
1. **Marketplace no fim da sidebar, acima de Perfil**, ícone destacado, com **Octa Code comprável** (entitlement).
2. **Plug no chat** no slot do antigo botão de mindmap (ícone do Octa Code), destravado por entitlement.
3. **Octa Code dual-mode:** alterna **chat ⇄ IDE** pelo mesmo ícone; a IDE abre o projeto e o agente a **opera** (edita/roda/terminal/git).
4. **2 agentes** com troca por ícone (o ícone muda pro agente ativo), **threads isoladas**, **concorrência paralela otimizada** (tarefa do outro continua em background).
5. **Interface Zed** (tema/UX) sobre Monaco/CodeMirror; **capacidades estilo Claude Code/opencode**.
6. **Conexão ao escritório via AG-UI**, criando **sala com o nome do projeto**; workspace persistente (padrão OpenDots).
7. Testes + `lint`/`build` verdes; atrás de flag `NEXT_PUBLIC_OCTA_CODE`.

## 9. Fases (commit por fase; cada uma com teste)
- **F0** — Mover Marketplace (fim da sidebar, acima de Perfil) + item Octa Code + entitlement. *Teste:* item aparece; compra destrava flag; sem entitlement = bloqueado.
- **F1** — Plug no chat (ícone no slot do mindmap) + abrir superfície IDE (aba separada). *Teste:* clicar pluga; alterna chat⇄IDE.
- **F2** — IDE estilo Zed sobre Monaco (multi-arquivo, tema, terminal real do outro handoff). *Teste:* abrir projeto, editar, rodar, terminal.
- **F3** — Loop agêntico + ferramentas (Octokit ligado, MCP, skills) com aprovação nas ações irreversíveis. *Teste:* agente edita multi-arquivo + commit com checkpoint; ação irreversível pede aprovação.
- **F4** — 2 agentes + troca por ícone + concorrência (threads isoladas, background, cancelamento). *Teste:* rodar tarefa no agente A, trocar pro B, A termina em background; estados não vazam.
- **F5** — Escritório via AG-UI + sala com nome do projeto + workspace persistente. *Teste:* plugar cria a sala; reabrir recupera sessão/arquivos.
- **F6** — Polish/segurança/i18n EN + e2e do fluxo inteiro. *Teste:* comprar→plugar→IDE→agente edita/roda→vê na sala do escritório.

## 🛑 Portões do dono
1. **Pagamento real do Marketplace** (se for cobrar de fato) — hoje entitlement por flag/plano; cobrança = decisão + credenciais do dono.
2. **Chaves de modelo** (Anthropic/Vertex) no LiteLLM — só o dono coloca.
3. **Infra dos contêineres** (onde roda o terminal/execução; limites/custo) + política de sandbox prod (gVisor/Firecracker).
4. **OAuth app do GitHub** (client id/secret) p/ ligar o Octokit.
5. **O que acontece com o botão de mindmap** (realocar ou remover) — confirmar.
6. **Quais 2 agentes** entram primeiro (quais personas/perfis) — definição do dono.
7. **Merge/deploy + ligar a flag.**

## ✅ Revisão do plano — o que mais precisamos (você pediu pra eu indicar)
1. **Definir os 2 agentes iniciais** — nomes, personas, e em que diferem (ex. rápido vs. profundo, ou dois domínios). Sem isso a F4 fica no abstrato.
2. **Modelo de "compra"** — é dinheiro real, crédito interno, ou destrava por nível acadêmico/credencial Solana? Isso muda a F0 (e conversa com o `MODELO_DE_NEGOCIOS.md`).
3. **Persistência do workspace** — onde os arquivos do projeto do agente moram entre sessões? (volume do contêiner? storage do perfil? Git como fonte da verdade?) Decisão de arquitetura antes da F5.
4. **Limite de concorrência por usuário** — quantos agentes/contêineres simultâneos por conta (custo!). Número do dono.
5. **Escopo da paridade "1:1"** — confirmar a lista de ferramentas do MVP (edit multi-arquivo + terminal + git + rodar) vs. o que fica pro roadmap (ex. debugging, LSP/autocomplete pesado, múltiplos repos). "1:1 total" é grande demais pra um MVP — recomendo travar um **core** e marcar o resto como roadmap.
6. **AG-UI no nosso stack** — validar que o AG-UI/CopilotKit casa com o harness próprio (não substituir o runtime; usar AG-UI só como transporte agente↔UI). Precisa de um spike curto.
7. **"Sala do escritório"** — confirmar se o "escritório do perfil" já existe como superfície ou se é greenfield (muda o tamanho da F5).
8. **Segurança do plug comprável** — garantir que o entitlement é checado **no servidor** (não só esconder o botão), senão qualquer um chama a API do agente.

## Resumo
**Octa Code** = agente de código **comprável no Marketplace** (que passa pro **fim da sidebar, acima de Perfil**, ícone destacado), que vive **dentro do chat** no **slot do antigo botão de mindmap** e funciona como **chat E IDE** — o usuário alterna pelo mesmo ícone e vê o Octa **operando a IDE** do projeto. Começa com **2 agentes** trocáveis pelo ícone (que muda pro agente ativo), com **threads isoladas e concorrência paralela otimizada** (tarefa do outro segue em background). Interface **Zed**, capacidades mirando **Claude Code/opencode** (edit multi-arquivo, terminal real, git/Octokit, MCP, skills, loop agêntico), tudo reusando o que já existe no repo (Monaco, harness, LiteLLM, terminal em contêiner). A ligação ao **escritório do perfil** usa **AG-UI (CopilotKit)** e o padrão **OpenDots** (workspace persistente), criando **uma sala com o nome do projeto**. Honestidade: não se embarca o Zed (GPL/nativo) — replica-se a UI e iguala-se a capacidade; "1:1 total" deve virar um **core travado + roadmap**. As 8 lacunas acima precisam de decisão sua antes de o agente ir longe.

---
### Fontes
- CopilotKit / CoAgents + protocolo **AG-UI** (framework open-source MIT p/ agentes full-stack com estado compartilhado e human-in-the-loop) — docs.copilotkit.ai.
- **CopilotKit/OpenDots** (template MIT, alpha, de "AI coworkers" persistentes com workspace próprio sobre AG-UI) — github.com/CopilotKit/OpenDots — usado aqui como **referência de arquitetura** (workspace persistente por agente), não como base copiada.
- Zed (editor GPL-3.0, Rust/GPUI nativo) — por isso replicamos a UI, não embarcamos o source.
