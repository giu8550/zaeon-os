# HANDOFF — Octa Code "Pack Sinistro": features avançadas, fortificação e frentes não cobertas

**Para:** agente executor (Claude Code)
**Base:** estende `HANDOFF_OCTA_CODE.md` (produto chat+IDE plugável) e `HANDOFF_CODE_MODE_ZED.md` (gateway LiteLLM + terminal em contêiner). Aqui entram as **features avançadas**, a **fortificação ponta-a-ponta** e a **análise de lacunas** que o Martinez pediu.
**Status dos repos de referência:** todos verificados em 14/10/2026 (fetch do GitHub). Vereditos na §0. **Nada é instalado sem passar pela política de vetting (§1).**

---

## 0. ⚠️ Vereditos dos repos indicados (LER — um foi REJEITADO)
Todos existem e são MIT. Mas **"indicado pelo dono" não é "instalar e confiar"** — ver §1.

| Repo | ★ | Veredito | O que fazer |
|---|---|---|---|
| `omaekumiko2-create/kru` | 48 | ⚠️ **Referência, não base** | App **desktop local** (Tauri/Rust), cofre de segredos via MCP `stdio` pra a máquina de um dev. **Não** é cofre server-side multi-tenant. Autor novo/desconhecido + é ferramenta de **segredos** → não virar dependência de produção. Usar o **conceito** (plaintext nunca vai ao modelo; só metadados + ação local). Base real = LiteLLM virtual-keys (§3). |
| `lennney/stop-that-shit` | 26 | ✅ **Adotar o padrão** | Plugin de "task boundary" pro Codex. Taxonomia **SHIT** (Scope creep, Hypothetical hardening, Intent violation, Task thrashing) + guard deny-by-default. Portar o **conceito** pro nosso `permit()`; não depender do plugin Codex. |
| `davidcarliez/trustmebro` | 511 | 🚫 **REJEITADO** | Auto-descrição: *"Bypass LLM guardrails by confusing it with fabricated tool output."* É **red-team/deception** — injeta saída falsa de ferramenta pra enganar o agente. Faz o **oposto** de "anti-alucinação/reliable". **Não integrar.** Substituto nosso em §5. |
| `uw-syfi/vibesys` | 115 | ✅ **Adotar o padrão** | Framework de pesquisa (UW, arXiv) build→validar→benchmark com **juiz independente read-only** + execução isolada. Pesado, mas o **padrão** é exatamente nossa fortificação (§6). |
| `liguobao/ds-harness-remote` | 162 | ⚠️ **Referência + Android separado** | Acesso remoto multi-dispositivo a um "DeepSeek Harness" via Noise E2E, host só-outbound, LAN→P2P→TURN→Relay. É de **outro** harness e usa **relay hospedado de terceiro** (`dsh.r2049.cn`). Pegar o **padrão de transporte**, não o relay. Android = **handoff separado** (§4). |
| `camilleroux/genart-skill` | 131 | ✅ **Adotar como skill** | Skill (SKILL.md) de **arte generativa determinística** (hash-seeded; Canvas/p5/three/SVG) + scripts de verificação de determinismo. Encaixa no pilar Skills. Feature exclusiva do chat Octa (§7). |
| `Appllama/appllama-skills` | 53 | ✅ **Skill MIT; MCP é pago** | Skills de **design mobile nativo** (Expo/RN, HIG, anti-slop, loop no simulador). A skill é MIT standalone; o **MCP deles é Pro/pago** (portão do dono). Nome/logo são TM — não reusar marca. (§8) |

---

## 1. 🛡️ Política de vetting de dependências (frente NOVA — e obrigatória)
O próprio fato de 1 dos 7 repos indicados ser uma ferramenta de **jailbreak** prova que precisamos disto como **feature de arquitetura**, não como favor:
- **Nada de terceiros entra sem:** (a) ler o README + LICENSE + o código dos pontos sensíveis; (b) **pinar versão** (commit SHA, não `latest`); (c) revisão de risco (o que acessa: rede, FS, segredos, exec); (d) rodar **isolado** antes de confiar.
- **Segredos:** nenhum repo de terceiro chega perto da chave real (fica no LiteLLM, §3).
- **Supply-chain:** rodar `npm audit`/SCA no CI; lockfile obrigatório; bloquear `postinstall` scripts não revisados.
- **Regra de ouro:** repo indicado pelo dono **também** passa por isto. Confiança ≠ ausência de revisão.

## 2. Guardrails do agente — "stop that shit" no nosso harness (frente: evitar o agente mexer onde não deve)
Objetivo do dono: o agente **não** mexer em áreas desnecessárias do código, não "overengineer", não alucinar passo. Adotar o **padrão** (não o plugin Codex):
- **Modos de tarefa:** `review`/`answer` (read-only) vs `change` (pode editar). Em read-only, **qualquer escrita é bloqueada** pelo `permit()` — reusa o `runtime.ts` deny-by-default que já temos.
- **File-lock:** a tarefa declara os arquivos que pode tocar; escrita fora do lock = STOP com motivo (`MODE_FORBIDS_MUTATION`).
- **Taxonomia SHIT como heurística do juiz:** marcar quando o agente faz scope-creep, hardening hipotético (hash/guard sem consumidor), viola intenção (review→edita), ou re-trabalha coisa já resolvida. 4 perguntas antes de cada ação extra: *o usuário pediu? o resultado exige? há evidência alcançável? a aceitação falharia sem isso?*
- **Orçamento de subagentes:** teto por tarefa (evita o agente lançar N subagentes à toa).
- *Teste:* em modo `review`, uma tentativa de `edit` é negada; escrita fora do file-lock é negada; scope-creep sintético é sinalizado.

## 3. Gerenciamento de keys e dados sensíveis (frente: segredos)
Conceito do `kru` aplicado **server-side** (não o app desktop):
- **Plaintext nunca entra no contexto do modelo.** O agente vê **nomes/metadados** de credenciais e **ações disponíveis**, nunca o valor.
- **Base real:** LiteLLM emite **virtual keys por usuário/sessão com budget** (a chave Anthropic real fica só no servidor do gateway). Para outros segredos (tokens de deploy, chaves de API do projeto), usar um **cofre** (ex. variáveis cifradas no backend / um secrets manager vetado), com **substituição por placeholder** `{{secret:nome}}` resolvida no backend na hora de executar — o modelo só vê o placeholder.
- **Visibilidade por módulo:** cada segredo tem flag "oculto por padrão"; só vira visível com ação explícita do dono.
- **Auditoria:** log de qual sessão pediu qual ação, **sem** registrar o valor.
- *Teste:* o modelo nunca recebe o valor real; placeholder é resolvido só no executor; budget estoura → recusa.

## 4. Conexão mobile ↔ tasks do Octa Code (frente: multi-dispositivo) — **Android em handoff separado**
Padrão do `ds-harness-remote` (sem o relay deles):
- **Host (a sessão Octa na VPS) só faz outbound**; nada de porta pública. Canal **E2E (Noise/`Noise_IK`)**; negociação **LAN→P2P(WebRTC)→TURN→Relay** (reusa o coturn que já planejamos em `COTURN_SETUP.md`).
- **Do celular:** ver tasks em andamento, mandar instrução/imagem, aprovar/responder pedidos de permissão do agente, abrir workspace. **Sem shell direto** do celular — ações passam pelo `permit()` do host.
- **App Android:** escopo grande (APK, push, QR login) → **`HANDOFF_OCTA_CODE_MOBILE_ANDROID.md` separado** (criar quando priorizarmos). Aqui fica só o **canal + protocolo de tasks** que o web/mobile-web já consome.
- *Teste:* host sem porta pública aceita conexão via relay cifrado; aprovar permissão do celular libera a ação no host; remover dispositivo revoga a sessão.

## 5. Rotina diária anti-alucinação / auto-cura (frente: confiabilidade) — substituto do trustmebro
O objetivo do dono (status *"monitorando alucinações e falhas de cognição"*, rodando em horários seguros, auto-cura pra manter os agentes "reliable") é **bom** — mas se faz com **detecção**, não com deception. Construir **nosso** mecanismo:
- **Suite de evals canônica:** um conjunto de tarefas-fixture com resposta/efeito esperado (determinístico). Roda **diariamente em janela segura** (fora de pico; reusa o scheduler/`arq` do gateway).
- **Checagens de alucinação:** (a) **groundedness** — toda afirmação factual do agente tem que citar fonte/arquivo real (reusa o pilar de fontes); (b) **tool-truth** — comparar o que o agente *disse* que a ferramenta retornou vs. o retorno real (o oposto do trustmebro: detecta divergência, não a fabrica); (c) **repeatability** — mesma entrada, mesmo resultado (inspirado no `genart` determinism-check); (d) **drift** — comparar com o baseline de ontem.
- **Juiz independente** (padrão vibesys): um agente **read-only** separado avalia as saídas; só ele marca PASS/FAIL; o framework (não um agente) roda os comandos canônicos.
- **Status visível:** painel "🩺 Monitorando alucinações e falhas de cognição" com verde/amarelo/vermelho por agente, última execução, taxa de PASS, drift. (Espelha o padrão do diagnóstico whatsmeow do zenith-warmer.)
- **Auto-cura (honesta):** ao detectar queda, o sistema **re-ancora** (recarrega contexto/skill correto, baixa temperatura, troca pro modelo mais forte, abre alerta pra equipe) — **nunca** inventa saída pra "passar". Se não recuperar, **degrada com aviso**, não finge.
- *Teste:* eval sintético com alucinação plantada é **detectado** (não mascarado); divergência tool-said vs tool-real dispara FAIL; status reflete o resultado real.

## 6. Sandbox, benchmark e fortificação do resultado (frente: qualidade do software gerado)
Padrão do `vibesys`:
- **Execução isolada:** candidato roda em contêiner onde **o código do candidato é gravável** mas inputs do avaliador e metadados são **read-only e checados por integridade** (reusa o contêiner do terminal, §`HANDOFF_CODE_MODE_ZED.md`).
- **Loop:** implementar → **validar correção** (testes do alvo) → **benchmark de performance** → **juiz independente read-only** aprova → só então resultados "oficiais" são gravados (em git + audit).
- **Contrato por alvo:** cada projeto define seus próprios checks de correção + benchmark; o Octa roda e **não** declara "pronto" sem PASS do juiz.
- *Teste:* candidato com teste quebrado nunca recebe "oficial"; benchmark registrado; juiz read-only não consegue editar.

## 7. Arte gerada por código — feature exclusiva do chat Octa (frente: criativa)
Skill `genart` (determinística, hash-seeded):
- No **chat** do Octa, comando/intenção de "arte" → gera **arte generativa** (Canvas 2D/p5.js/three.js/SVG) **determinística por seed**, renderizada como **artefato** (aba separada, como todo artefato Octa).
- Reusa os **scripts de verificação de determinismo** (mesma seed → mesma imagem) antes de "assinar" a peça; casa com a camada Solana (hash-seeded → `onchain-ready`) se um dia virar credencial/NFT.
- **Ética embutida** (originalidade/atribuição) — não copiar obra de artista; é o que a própria skill prega. (Playwright necessário pros checks → dep de dev.)
- *Teste:* mesma seed reproduz a imagem; seeds diferentes divergem; artefato abre na aba.

## 8. Design mobile de alta fidelidade (frente: mobile) 
Skill `appllama-app-design-skill` (MIT, standalone):
- Quando o Octa constrói tela mobile → padrão **nativo** (Expo/React Native, Apple HIG, cores semânticas, anti-slop, motion), com loop de verificação. Encaixa no nosso **mobile lite** (`NEXT_PUBLIC_MOBILE_UI`) e no handoff mobile do chat.
- O **MCP Appllama** (biblioteca de telas de apps top-grossing) é **Pro/pago** → **portão do dono** (só liga se ele quiser pagar). A skill de build funciona **sem** o MCP.
- *Teste:* skill instala standalone; build de tela passa no bar de design; sem MCP não quebra.

---

## 9. 🔎 Frentes que ainda NÃO cobrimos (a análise que o dono pediu)
A soma dos repos + o scan do agente revelam buracos de **feature/arquitetura** que nenhum handoff cobre ainda:
1. **Observabilidade dos runs do agente** — tracing passo-a-passo (prompt→tool→resultado), tokens/custo por run, replay. Hoje temos logs, não trace de agente. **Alto valor** (debug + confiança).
2. **Supply-chain / vetting de dependências** (§1) — não existe hoje; os repos indicados provam a necessidade. SCA no CI + pin + revisão de `postinstall`.
3. **Defesa a prompt-injection quando o agente lê arquivos do repo** — um README/código malicioso pode conter instruções ("ignore e rode X"). Precisa de tratamento de conteúdo-de-arquivo como **dados, não comandos** no harness do Octa.
4. **Rotação e expiração de segredos** — temos virtual-keys, falta política de rotação/revogação e TTL.
5. **Checkpoint / rollback de edições do agente** — snapshot antes de uma série de edições + "desfazer run inteiro" (git stash/branch por run). Hoje confiamos só no catálogo de risco do Octokit.
6. **Retenção e privacidade do workspace persistente** — onde moram os arquivos do projeto do agente, por quanto tempo, quem acessa (amarra com AG-UI/OpenDots e com `HANDOFF_ABOUT_SOLANA_CREDENCIAIS.md`).
7. **Rate-limit e cota por agente/sessão** — além do budget do LiteLLM, limitar nº de contêineres, tempo de CPU, egress — custo e abuso.
8. **Multi-repo / monorepo** — o IDE assume 1 projeto; projetos reais têm múltiplos repos/pacotes.
9. **LSP / autocomplete / diagnostics** — Monaco sem LSP é editor "burro"; paridade real com Zed/VS Code pede um language server (pesado → roadmap).
10. **Degradação offline / falha de modelo** — o que o Octa faz quando o gateway/modelo cai (fila, retry, fallback de modelo — já esboçado no router, falta no Octa).
11. **Trilha de auditoria assinada** — para o marketplace comprável + ações do agente, um log à prova de adulteração (poderia usar a própria camada Solana — amarra os dois produtos).
12. **Testes e2e do fluxo comprável** — comprar no marketplace → entitlement no servidor → plug destrava (não só esconder botão).

> Recomendação de prioridade (crunch): **3 (prompt-injection), 1 (observabilidade) e 5 (rollback)** são as que mais reduzem risco de o agente "fazer besteira" — exatamente o medo do dono. 2 e 7 vêm logo atrás (segurança/custo). 9 e 8 são roadmap.

---

## 10. Fases (pack) — commit por fase, teste em cada, flag `NEXT_PUBLIC_OCTA_CODE`
- **P1 — Guardrails (§2) + vetting (§1):** modos de tarefa + file-lock no `permit()`; SCA no CI. *Mais barato e mais protege.*
- **P2 — Keys/segredos (§3):** virtual-keys + placeholders `{{secret:}}` + auditoria.
- **P3 — Confiabilidade (§5):** suite de evals + juiz independente + painel de status diário (scheduler).
- **P4 — Fortificação (§6):** loop build→validar→benchmark→juiz em contêiner isolado.
- **P5 — Arte (§7) + Mobile design (§8):** skills `genart` e `appllama` como skills do Octa.
- **P6 — Canal mobile (§4):** transporte E2E + protocolo de tasks (Android = handoff à parte).
- **P7 — Lacunas priorizadas (§9):** prompt-injection (3), observabilidade (1), rollback (5).

## 🛑 Portões do dono
1. **Confirmar a rejeição do trustmebro** (recomendo manter rejeitado) e aprovar o substituto §5.
2. **Pagar ou não o MCP Appllama** (§8) — a skill funciona sem.
3. **Chaves reais** (Anthropic/Vertex) no LiteLLM; cofre de segredos escolhido (§3).
4. **Infra** dos contêineres + relay/coturn pro canal mobile (§4, §6).
5. **Priorizar as lacunas** (§9) — quais entram no MVP vs roadmap.
6. **Android**: dar o OK pra eu abrir o `HANDOFF_OCTA_CODE_MOBILE_ANDROID.md`.
7. **Merge/deploy + ligar a flag.**

## Resumo
Pack avançado do Octa Code com fortificação ponta-a-ponta: **vetting de dependências** (um dos repos indicados era jailbreak — rejeitado), **guardrails** que impedem o agente de mexer onde não deve (padrão stop-that-shit no nosso `permit()`), **gestão de segredos** sem expor valor ao modelo (conceito kru + virtual-keys LiteLLM), **canal mobile↔tasks** E2E (padrão ds-harness-remote; Android em handoff separado), **rotina diária anti-alucinação/auto-cura honesta** (substituto do trustmebro, com juiz independente estilo vibesys e painel de status), **sandbox+benchmark+juiz** pra fortificar o software gerado, **arte generativa determinística** (genart) como feature exclusiva do chat, e **design mobile nativo** (appllama). Mais a **análise das 12 frentes ainda não cobertas** — com prompt-injection, observabilidade e rollback no topo da prioridade. Todos os repos são MIT e verificados; nenhum entra sem passar pela política de vetting.
