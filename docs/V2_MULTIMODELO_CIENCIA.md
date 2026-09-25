# Zaeon v2 — "Todas as IAs, feito pra ciência" (brief de posicionamento + implementação)

> Redesenho de vitrine, NÃO de motor. Nada é removido: harness, mentores, árvore de
> habilidade, artefatos ricos, memória L3, export ABNT, credenciais — tudo fica. A v2
> troca a *forma de se apresentar*: de "plataforma agêntica" (só quem é da área entende)
> para **"uma assinatura, todos os modelos de IA, num sistema gamificado feito pra ciência".**
> Escrito 2026-09-15. Referência de familiaridade: adapta.org (mural de modelos conhecidos).

## 1. A tese
- **Anzol (público amplo):** acesso a todos os modelos que a pessoa já conhece (GPT, Claude,
  Gemini, Grok…) num lugar só — familiaridade, custo único, zero fricção de escolher provider.
- **Motivo de ficar (retenção + disposição a pagar):** a **camada científica** que nenhum
  agregador tem — mentores, trilhas, artefatos, memória, credenciais, export acadêmico.
- **Não competimos com os labs:** a gente *hospeda* os modelos deles dentro do nosso sistema.
  A IA da casa (Gemini) deixa de ser o epicentro e vira mais um item do pacote. Isso atrai
  quem já tem uma IA favorita, em vez de pedir que ele troque.
- **O diferencial que vira método (não commodity):** num agregador comum, ter N modelos é
  conveniência. Numa plataforma científica, ter N modelos é **triangulação** — rodar a mesma
  hipótese em GPT + Claude + Grok e comparar concordância/divergência reduz alucinação de
  modelo único e é boa prática de método. *"Não confie em uma IA. Faça ciência com várias."*

## 2. Header / hero (3 direções)
**A — Familiaridade (perto da adapta) — recomendada como headline principal**
> **Todas as IAs. Um lugar só. Feito pra ciência.**
> GPT, Claude, Gemini, Grok e mais — num sistema interativo onde você não só conversa, você produz conhecimento.
> [Começar grátis] · [Ver os modelos]

**B — Triangulação (segunda dobra da home)**
> **Não confie em uma IA. Faça ciência com várias.**
> Reúna GPT, Claude, Gemini e Grok no mesmo estudo, compare onde concordam e divergem, e transforme isso em produção científica.

**C — Híbrida (se BYOK entrar cedo)**
> **Sua IA favorita, agora com método.**
> Traga o modelo que você já usa — ou use todos. A Zaeon adiciona a camada que falta: mentores, trilhas e conhecimento que se conquista, não se prompta.

**Abaixo do hero:** mural de logos dos modelos (igual adapta) → familiaridade visual em 0,5s.
Regra da casa (ver preferências): UI nova = **opt-in/toggle**, manter o ⟁ da casa, não trocar
tela inteira de uma vez.

## 3. Arquitetura (o que muda no código)
Já estamos perto: `lib/ai/model.ts` centraliza o modelo, o `AgentContext` já carrega `model`
no world-state, e a escolha do **Vercel AI SDK** já estava no FONTES_BASE.
- **Camada de provider (AI SDK):** trocar a chamada única de Gemini por um roteador de
  provider (OpenAI / Anthropic / xAI / Google) — o AI SDK fala todos nativo.
- **Model registry (capabilities):** um mapa por modelo (temperatura, reasoning, tools,
  system-prompt, streaming) — é isso que "respeita o padrão de cada empresa".
- **Harness inalterado:** o `route→plan→…→finalize` continua igual; só o "executor de
  inferência" passa a ser provider-aware. Mentores, memória, artefatos: sem mudança.
- **Seletor de modelo no chat:** dropdown com os modelos habilitados (Gemini default).

## 4. Economia (a pergunta dura — decidir cedo)
Revender token de fronteira em assinatura fixa sangra margem. Modelo proposto:
- **Gemini = incluso** no plano (custo ~zero pra nós enquanto durar o crédito GenAI de $300).
- **Premium (GPT/Claude/Grok) = metrado por créditos** OU **BYOK** (aluno pluga a própria
  chave) → protege margem e ainda soa premium ("traga sua chave ou use nossos créditos").
- Telemetria de custo por modelo desde o dia 1 (senão a conta aparece no mês 2).

## 5. Rollout faseado (sem quebrar nada)
- **Fase 0 — Vitrine:** novo header/hero + mural de modelos. Só UI, opt-in. Deploy sozinho pelo CI/CD.
- **Fase 1 — Provider layer:** AI SDK + seletor de modelo no chat. Gemini default; 1-2
  providers extras atrás de flag/BYOK. Model registry mínimo.
- **Fase 2 — Economia:** créditos/metering + BYOK completo; capability registry por modelo.
- **Fase 3 — Triangulação:** rodar a mesma pergunta em N modelos e comparar (consenso/divergência)
  como feature científica de assinatura — o "uau" que só a Zaeon entrega.

## 6. Fronteira / próximos passos
- Fase 0 é a que dá o impacto visual e não toca no motor → bom primeiro PR pós-CI/CD.
- 🔒 Martinez: chaves de API dos providers extras (OpenAI/Anthropic/xAI) quando for a Fase 1;
  decisão de precificação (créditos vs BYOK) pra Fase 2.
- Relacionado: harness/mentores já em prod (2026-09), CI/CD autônomo (docs/CICD_AUTONOMO.md).
