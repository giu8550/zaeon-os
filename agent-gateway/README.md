# Zaeon Agent Gateway

Serviço Python (FastAPI + arq) que hospeda **um único agente reproduzível por sessão de
usuário** — o assistente de pesquisa da Zaeon. Espelha a arquitetura do `zenith-warmer`
(transporte WhatsApp via Evolution, observabilidade, worker) e pluga no cérebro Vertex/Gemini
+ RAG sobre as Salas de Pesquisa.

> Contexto e decisões: `../WHATSAPP_AGENT_PLAN.md` (§1–11) e `../SPRINT_VPS_PLAN.md`.

## O agente, em uma frase

Um agente **stateless no código, stateful nos dados**: cada sessão instancia o mesmo agente,
que carrega a memória do usuário (Salas de Pesquisa = RAG), o perfil (incl. tratamento de
gênero), o plano (Free/Plus) e os canais habilitados (WhatsApp só no Plus).

## Fluxo macro

```
Login (app)  ──▶  Onboarding engine  ──▶  Checa e-mail .edu  ──▶  Oferta Plus 30d (estudante)
                                                                      │
   Salas de Pesquisa (livros/resumos/trabalhos)  ── RAG (memória) ────┤
                                                                      ▼
        Frame de input (texto OU voz, sempre os dois)  ──▶  Agente (Gemini)
                                                                      │
                       ┌──────────────────────────────────────────────┤
                       ▼                  ▼                 ▼          ▼
                 Busca internet     Busca avançada    Engine acadêmica  WhatsApp (Plus)
                 (Grounding GSearch) (Vertex AI Search)  (já existe)    (comando: "enviar p/ professor")
```

## Estratégia de créditos (Trial credit for GenAI App Builder)

O crédito é **escopado por SKU** da família **Agent Builder / Vertex AI Search (Discovery
Engine)** — ele subsidia **busca/grounding**, não a geração crua do Gemini nem VMs do Vector
Search. Conferir a lista exata em **Console → Billing → Credits → "applies to"**.

Consequência arquitetural (por isso as engines são abstraídas):
- **Busca internet** → `SearchProvider.web_search` = Grounding with Google Search (coberto).
- **Busca avançada / acadêmica** → `SearchProvider.academic_search` = Vertex AI Search data
  store (coberto) + a engine acadêmica que já existe no Zaeon.
- **Geração** → `LLMProvider` (Gemini). Verificar se o SKU do crédito inclui Gemini; senão,
  manter geração enxuta (Flash + context caching) e reservar Pro pro que precisa.

## Estrutura

```
app/
  core/config.py          Settings (Vertex, Evolution, Postgres+pgvector, Redis, planos)
  engines/
    brazilian_names.py    Gênero provável por nome BR → pronomes/tratamento (sobreponível)
    edu_eligibility.py    E-mail acadêmico BR → elegível ao trial Plus
    plans.py              Free/Plus + gate de features (WhatsApp = Plus)
    onboarding.py         Máquina de estados do primeiro contato
  providers/interfaces.py LLM / RAG / Search / Voice / Messaging (contratos)
  agent/                  (próximo) orquestrador da sessão + persona
tests/                    Lógica pura testada sem serviços externos
```

## Princípios travados

1. **Tratamento de gênero é um palpite, nunca um veredito** — `brazilian_names` retorna
   confiança e é **sempre** sobreponível pelo usuário; fallback é neutro.
2. **Voz é par do texto** — todo ponto de entrada de texto tem entrada de voz (`VoiceProvider`).
3. **Consentimento + disclosure** no WhatsApp (ver plano §2/§7).
4. **Provider-agnóstico** — trocar Vertex↔outro, Evolution↔Cloud API, pgvector↔Vector Search
   sem tocar na lógica do agente.

## Rodar (depois da VPS)

Pontos de pausa (precisam de você): credencial GCP (service-account no serviço), instância
Evolution acessível, Postgres com pgvector. Até lá, as engines de lógica pura rodam e têm teste.
