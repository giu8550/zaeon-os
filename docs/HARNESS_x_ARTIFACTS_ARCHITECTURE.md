# Harness × Geração de Artefatos Visuais — decisão de arquitetura

> Pergunta do Martinez: "café → identificar cientificamente → falar do tema E gerar a molécula 3D
> no meio da resposta. Fazemos o harness JUNTO ou SEPARADO dessa capacidade?"
> Repo-base achado nos stars dele: **tambo-ai/tambo** (Generative UI SDK for React) — o padrão
> "LLM emite → componente renderiza inline". Nenhum viewer de molécula nos stars → 3Dmol.js entra
> como renderizador (pesquisa em `RICH_ARTIFACTS_MOLECULE.md`). Escrito 2026-08 (Fable).

## Veredito curto
**Separados, acoplados por UM contrato.** O harness **DECIDE** (identifica a entidade científica e
resolve que um artefato enriquece a resposta); a **camada de artefatos RENDERIZA** (registry de viewers
plugáveis). O seam entre os dois é o campo `StructuredAnswer.artifacts[]` — que **já existe** no contrato.
Não soldar num monólito; conectar por interface. É literalmente a lição do tambo (registry tipado entre
modelo e UI) e a mesma postura que tomamos com o MemPalace (roubar o mecanismo, não o binário).

## Por que separados (análise)

São duas responsabilidades que mudam por razões diferentes:

| | Harness (decidir) | Camada de artefatos (renderizar) |
|---|---|---|
| Pergunta que responde | café → *é cafeína (C8H10N4O2); vale mostrar a estrutura?* | dado `{kind:"molecule", name:"caffeine"}` → desenhar 3D girável |
| Muda quando… | novas intenções, novo crítico, novo raciocínio | novo viewer (plot, genoma, diagrama), nova fonte de dado |
| Depende de | Gemini, contratos, memória | 3Dmol.js/PubChem, React, registry |
| Testável com | renderizador mockado | spec hardcoded (sem LLM) |

Se soldar, um viewer novo mexe no motor de raciocínio e vice-versa — ambos ficam frágeis. Separando,
cada lado evolui sozinho e o `artifacts[]` é o cabo que os liga. **A decisão é do harness; a renderização
é da camada. É essa a resposta "junto ou separado".**

## O que JÁ está encaixado (e o que não)
- ✅ Contrato `StructuredAnswer.artifacts?: StudioRef[]` existe (o seam já foi previsto).
- ✅ `studio_generate` já produz artefatos (imagem/podcast/mapa…) via tool-call do harness.
- ✅ `components/studio/StudioArtifactViews.tsx` já é um **registry de viewers** (um View por kind).
- ❌ **Kind `molecule` + viewer 3D** não existe (planejado em `RICH_ARTIFACTS_MOLECULE.md`).
- ❌ **Passo de identificação científica → intenção de artefato** não é explícito (café→cafeína).
- ❌ **Render inline do `artifacts[]`** não está ligado (mesmo gap do render — G1 do `HARNESS_PLAN.md`).

Ou seja: a arquitetura já foi *desenhada pra isso*; faltam 3 peças, e nenhuma exige reescrever o harness.

## As 3 peças (cada uma na sua camada)

**Camada de artefatos (separada, reutilizável) — "capacidade generativa de UI":**
1. **Registry + viewer de molécula** (padrão tambo, nativo): `ArtifactSpec = {kind, name?, data?, props?}`; `StudioArtifactViews` ganha `MoleculeView` (3Dmol.js via `next/script`, client-only); endpoint `/api/studio/molecule` resolve nome→SDF no PubChem (proxy server-side, cache Redis). Rende qualquer `artifacts[]` — agnóstico a quem decidiu.

**Harness (o seam — hook pequeno, não reescrita):**
2. **Passo "entidade científica → artefato"**: no `draft`/`plan`, quando o tema tem entidade científica (molécula, reação, estrutura anatômica, objeto matemático), o harness a nomeia cientificamente e preenche `artifacts[]` com o spec certo. Café → `{kind:"molecule", name:"caffeine"}`. É prompt+contrato, não motor novo. (O "sempre de maneira científica" mora AQUI.)

**Transporte/render (o cabo):**
3. **Emitir e renderizar `artifacts[]` inline**: a rota manda o `StructuredAnswer` (incl. `artifacts[]`) via sentinela; o cliente renderiza texto (`StructuredAnswerView`) + os viewers na ordem. É a Fatia A do `HARNESS_PLAN.md` estendida pra `artifacts[]`.

## Qual a BASE dessa geração? (pesquisa 2026-09 do ecossistema)

Comparei as bases OSS de "generative UI" com o filtro que importa pra nós: **Gemini/Vertex** (nossa única IA) e **App Router**, sem backend extra.

| Base | ⭐ | Licença | Gemini/Vertex? | Backend próprio exigido? | Veredito |
|---|---|---|---|---|---|
| **Vercel AI SDK** (`vercel/ai`) | 26.5k | Apache-2.0 | **Sim, 1ª classe** (`@ai-sdk/google-vertex`) | Não | **Melhor base-lib** — só a camada UI (não a RSC/`streamUI`, que é legada) |
| **assistant-ui** | 12k | MIT | Sim (via runtime que embrulha a AI SDK) | Não | Bom se quisermos a UI de chat pronta; mais opinativo |
| **tambo-ai/tambo** (star do Martinez) | 11.2k | MIT | Sim (BYO key, inclui Gemini) | **SIM — Tambo Cloud ou Docker self-host** | Rápido pra demo, mas **roda o loop do LLM por você** → dependência de backend que a gente NÃO quer (já temos `/api/ai/chat`) |
| **CopilotKit** | 37.2k | MIT | Sim | Runtime/agente | Pesado demais pra "1 artefato inline"; só se formos full-agentic |
| **thesys / C1** | — | proprietário (SaaS) | via API paga | — | Fora — não é base OSS |
| **llm-ui** | 1.7k | MIT | agnóstico (regex no texto) | Não | Parado (2025) + regex, não tool-call tipado — descartar |

**Recomendação (a base):** **Vercel AI SDK — camada UI + provider Vertex Gemini** *se* formos adotar uma lib. Motivo: é a única com **Vertex Gemini de 1ª classe** E sem backend próprio, Apache-2.0, e encaixa no nosso `StudioArtifactViews`. **NÃO o tambo** (apesar do teu star) — ele exige subir um backend/loop dele, o que conflita com a nossa rota `/api/ai/chat` e com Gemini único. Tambo/CopilotKit ficam como referência de API de registry.

**Porém — a verdade técnica:** a gente já está a **~80%**. Já temos (a) o registry (`StudioArtifactViews`), (b) a rota que streama, e (c) **function-calling do Gemini** (já usado no `studio_generate`). O que falta — "o modelo DECIDIR emitir um componente tipado" — **é exatamente function-calling**, que já temos. Então há duas rotas de base:
- **Nativo (mínima mudança, 0 dependência):** trocar as sentinelas por function-calling do Gemini → mapear `tool name → kind` do registry. Consistente com "nativo/Gemini único". **Recomendado.**
- **Adotar a AI SDK UI** como camada fina e trocável (Apache-2.0): ganha o plumbing de stream/tool-parts pronto em vez do nosso parser de sentinela. Vale se quisermos robustez de streaming sem manter parser à mão. Não é plataforma, não trava.

Em ambas, a base do **render de molécula** é a mesma: **3Dmol.js + PubChem** (nenhum viewer de molécula está nos stars → esse a gente traz).

## Ordem de execução (cada peça = PR próprio, contra `HARNESS_PLAN.md`)
1. **Fatia A (render `artifacts[]` inline)** — pré-requisito; sem isso nada aparece.
2. **Camada de artefatos** — kind `molecule` + `MoleculeView` + `/api/studio/molecule` (independe do harness; testável com spec fixo).
3. **Hook científico no harness** — café→cafeína preenchendo `artifacts[]`.
Assim: a camada de artefatos nasce como **capacidade separada e reutilizável**; o harness ganha só um hook; o contrato `artifacts[]` costura os dois. Nenhum passo reescreve o outro.

## Regra de ouro
O harness nunca renderiza; a camada de artefatos nunca raciocina. Quem os une é o `artifacts[]`.
Novo viewer? só na camada. Nova decisão científica? só no harness.
