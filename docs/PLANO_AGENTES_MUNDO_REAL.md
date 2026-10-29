# PLANO — Agentes da Zaeon no mundo real (WhatsApp · Instagram · X · LinkedIn)

> **Objetivo.** Do dashboard admin, dar aos agentes da Zaeon presença nas redes: publicar, responder
> menção/comentário e conversar por DM — com governança, aprovação humana e kill-switch por canal.
>
> **Princípio reitor: não é motor novo.** O cérebro (harness + persona/mentor + memória L3) e o laço de
> ação autônoma (`lib/chore`) já existem e já foram provados. Isto é uma **camada de canal** por cima,
> no mesmo padrão do WhatsApp — que já está em produção e serve de referência.
>
> 🔒 = decisão do dono (Martinez). Escrito 2026-10-29.

---

## 1. O que JÁ existe (auditado, não presumido)

| Peça | Onde | Estado |
|---|---|---|
| **WhatsApp completo** | `lib/whatsapp/` (brain, inbound, sender, dispatch, chips, policy, phone, voice, format) + `/api/whatsapp/*` + containers `zaeon_wa_adapter`/`zaeon_wa_db` | **em produção** |
| **Cérebro reusável por canal** | `lib/whatsapp/brain.ts` → `resolveMentor` + `buildHarnessDeps` + `runTrajectoryTraced` + memória L3 (`wing = <slug>/<userId>`) + transcript L1 (`surface:"whatsapp"`) | provado |
| **Model de canal** | `AgentChannel`: `agentKey`, `tipo`, `origem`, `estado` (6 estados), `limiteDia`/`enviadosHoje`/`diaContagem`, `ultimoErro`, `@@unique([agentKey,tipo])` | **já é o model certo** |
| **Laço de ação autônoma** | `lib/chore/`: 9 tipos com **sequência FIXA de tools** (o modelo não escolhe), `permit` deny-by-default, 1 post por chore, teto `CHORE_POSTS_DIA`, `jobId` idempotente por dia, cursor anti-repetição, expiração 24h, triagem | **em produção** |
| **Governança de envio** | `lib/whatsapp/policy.ts`: opt-in, quiet hours (22h→7h BRT), gate de plano | pronto pra generalizar |
| **Segredo por referência** | `Connector.authRef` guarda o **nome** da env, nunca o valor | padrão a seguir |
| **Trava de segredo** | `lib/octa/noPii.ts` (PR #625) | base pro no-PII externo |
| **Vitrine de redes** | `AgentProfile.redes = {whatsapp, instagram, facebook}` no `AgentsModule` | **só texto no crachá — não conecta nada** |

**Não existe:** Instagram, X, LinkedIn (zero código), painel admin de canais reais (`FrotaModule` é a frota de NPCs do cyberespaço, não isto), fila de aprovação de post, e qualquer ação de chore que saia pra fora (`agir` só tem `post_internal`).

---

## 2. 🔒 A decisão que vem ANTES do código: quantas contas?

O pedido diz "para todos eles". Hoje são **13 mentores + ~10 personas** (`lib/ai/personas.ts`). × 4 redes = **até 92 contas**.
Isso não é um detalhe de implementação — é o eixo do projeto, e tem consequência de ToS:

- **Opção A — 1 conta institucional por rede, agentes como VOZES** (recomendada). `@zaeon` no X/IG/LinkedIn; cada post assina o agente ("— Kekulé, mentor de Farmácia"). 4 contas, 4 app reviews, 1 reputação pra cuidar. Escala pra qualquer número de agentes sem pedir nada novo às plataformas.
- **Opção B — 1 conta por agente.** Dá presença individual, mas: 92 contas, 92 revisões/credenciais, e **criação em massa de contas é exatamente o padrão que Meta/X/LinkedIn classificam como inautêntico** — risco real de banir tudo, inclusive a conta institucional.
- **Opção C — híbrido:** institucional por rede + conta própria só pros 2–3 agentes "rosto" (ex.: Aura, Zaeon).

**Recomendo A, com C como evolução.** O resto do plano funciona nos três, mas a UI e o custo mudam bastante. **Preciso da sua escolha pra fechar a F1.**

---

## 3. A assimetria que manda na arquitetura

Os 4 canais **não fazem as mesmas coisas**. Interface uniforme aqui seria mentira:

| Canal | Publicar | Responder menção/comentário | DM | Realidade da API |
|---|---|---|---|---|
| **WhatsApp** | — (não é feed) | — | ✅ **já funciona** | Evolution/ChipFlow; risco de ban por volume |
| **LinkedIn** | ✅ | ✅ | ❌ (praticamente fechado à API) | UGC Posts; app review; público certo pra Zaeon |
| **X** | ✅ | ✅ | ✅ | tier **pago**, limites duros |
| **Instagram** | ✅ | ✅ | ✅ (janela 24 h) | Graph API: conta **Business** + app review |

→ **Capacidades declaradas por canal**, não interface única. O adapter publica o que sabe fazer e a UI do admin só mostra isso. Pedir `dm` ao LinkedIn tem que ser erro de contrato, não de runtime.

---

## 4. Arquitetura

```
dashboard admin  ──►  CanaisModule (matriz agentes × redes, aprovação, kill-switch)
                            │
                      /api/admin/canais/*          ← estado, conectar, testar, pausar
                            │
                   lib/canais/  ◄── a camada nova
                   ├ tipos.ts        ChannelAdapter, Capacidade, Publicacao, ClasseErroCanal  (PURO)
                   ├ registro.ts     tipo → adapter, com capability gating
                   ├ politica.ts     quiet hours, teto/dia, cooldown pós-erro, opt-in   (PURO)
                   ├ noPiiExterno.ts proíbe PII de aluno em conteúdo público            (PURO)
                   └ adapters/
                     ├ whatsapp.ts   WRAPPER sobre lib/whatsapp (não reescreve)
                     ├ linkedin.ts   fetch injetável → testável sem rede
                     ├ x.ts
                     └ instagram.ts
                            │
        ┌───────────────────┴───────────────────┐
   AgentPost (fila)                      lib/chore  (laço autônomo já existente)
   rascunho→aguardando→aprovado→publicado   + tipo `publicar_externo`
                                            + tool `post_external` (risk write, exige aprovação)
```

**O que isso ganha de graça** por entrar no `lib/chore`: idempotência por dia (`jobId`), teto diário, cursor anti-repost, expiração, `permit` deny-by-default e **sequência fixa de tools** (o modelo nunca escolhe publicar — ele escreve, o executor publica).

### 4.1 `AgentChannel` estendido (aditivo, `prisma db push`)
`tipo` passa a aceitar `whatsapp|email|instagram|x|linkedin`. Campos novos:
`capacidades String[]` · `escopos String[]` · `tokenRef String?` (**nome** da env/secret, nunca o valor — padrão `Connector.authRef`) · `tokenExpiraEm DateTime?` · `contaExterna String?` (id/handle) · `pausadoAte DateTime?`.
O `@@unique([agentKey,tipo])` já garante um canal por rede por agente.

### 4.2 `AgentPost` (novo) — a fila de aprovação
`agentKey, canal, rascunho Json, origem (chore|admin|resposta), estado, aprovadoPor, aprovadoEm, publicadoEm, idExterno, erro, jobId @unique`.
**Default: nada sai sem aprovação humana.** `CANAIS_AUTO_PUBLICAR=0`; auto-publicar é opt-in **por canal**, nunca global.

### 4.3 Separar vitrine de conexão
Hoje `AgentProfile.redes` é texto no crachá. Vou manter — mas a UI tem que deixar claro: **preencher o handle não conecta nada**. Conexão é `AgentChannel` com credencial e estado. Confundir os dois é o jeito mais fácil de alguém achar que ligou e não ligou.

---

## 5. Os dois riscos que podem custar caro

1. **Vazar PII de aluno num post público.** Os agentes têm acesso à memória L3 (conversas, estudos, nome, telefone). Um post gerado com esse contexto pode vazar dado de menor de idade. → `noPiiExterno.ts` com **hard-block**: conteúdo público nunca inclui nome/e-mail/telefone/trecho de conversa de usuário. Deny-by-default, não heurística de confiança. É pré-requisito da F2, igual a trava do Octa foi pré-requisito do HF.
2. **Banimento por automação.** Cada rede tem regra sobre conteúdo automatizado e criação de contas. Perder a conta institucional da Zaeon é dano de marca, não bug. → Opção A do §2, rótulo de automação onde a plataforma exige, teto diário conservador, e aprovação humana ligada.

---

## 6. Fases (1 PR cada, flag + rollback)

| Fase | Entrega | Risco | Depende de |
|---|---|---|---|
| **F0** | `lib/canais/{tipos,politica,noPiiExterno}.ts` puros + testados; `AgentChannel` estendido. **Nenhuma rede ligada.** | zero | — |
| **F1** | `CanaisModule` **read-only**: matriz agentes × redes lendo `AgentChannel` (o WhatsApp já aparece de verdade). Nada publica. | zero | 🔒 §2 |
| **F2** | `AgentPost` + aprovação no admin + `post_external` com **adapter `log`** (`AgentChannel.origem` já prevê `"log"`): prova o laço ponta-a-ponta **sem tocar rede externa**. | zero | F0, F1 |
| **F3** | **LinkedIn** — só `publicar`. Primeiro de propósito: API mais previsível, menor risco de ban, público institucional/acadêmico que é o da Zaeon. | baixo | 🔒 app review |
| **F4** | **X** — publicar + responder menção. | médio | 🔒 tier pago |
| **F5** | **Instagram** — publicar + comentários. | médio | 🔒 Business + review |
| **F6** | Inbound unificado: webhook por canal → envelope único → `brain` generalizado (o do WhatsApp sobe de nível). LinkedIn vira polling (não tem webhook útil). | médio | F3–F5 |
| **F7** | DM onde a API permite (IG janela 24 h, X). LinkedIn fica fora. | alto | F6 |

**Rollback em qualquer fase:** `estado="pausado"` no canal (kill-switch por rede, por agente), `CANAIS_AUTO_PUBLICAR=0`, ou flag global `CANAIS_EXTERNOS=0` → volta a ser só WhatsApp, como hoje.

---

## 7. 🔒 Portões do dono

1. **Contas** (§2): A (institucional, recomendada), B (uma por agente) ou C (híbrido)?
2. **Aprovação:** sempre humana, ou auto-publicar liberado por canal depois de N posts aprovados?
3. **Orçamento:** X tem tier pago — qual teto? Meta/LinkedIn exigem app review (semanas) — quem conduz?
4. **PII:** confirmo o hard-block (nenhum dado de aluno em post público)? Há exceção desejada (ex.: depoimento com consentimento explícito)?
5. **Ordem:** topo LinkedIn → X → Instagram (minha recomendação por risco), ou você quer outra?

---

## 8. Fronteira

Este documento é arquitetura. Nada foi implementado. A F0 é inteiramente código puro e testável e pode
começar assim que o §2 estiver decidido — as outras fases dependem de credencial e revisão de app, que
são passos humanos.
