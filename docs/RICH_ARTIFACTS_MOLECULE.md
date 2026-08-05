# Resultados ricos na Sala de Estudos — Molécula 3D (1º viewer da camada de enriquecimento)

> Visão (Martinez): o harness não devolve só texto — ele **enriquece o resultado com o artefato certo
> pro tema**. Ex.: perguntar sobre "café"/"cafeína" → uma **molécula 3D interativa** nasce no card da
> sala, girando, e o texto acompanha. Isto é o T1 do `AURA_AGENTIC_LAYER_PLAN.md §10.3` + fecha a
> lacuna #1 do §10.4 (registry de VIEWERS de artefato). Molécula = **viewer #1**; o padrão generaliza
> (depois: diagrama Mermaid, plot Chart.js, mapa, KaTeX…). Escrito 2026-08-05 (Fable).

## Repo/stack-base (pesquisado — tudo permissivo, browser-only, sem Python)

| Peça | Escolha | Licença | Por quê |
|---|---|---|---|
| Render 3D | **3Dmol.js** (`3dmol@2.5.x`, CDN) | **BSD-3** | drop-in single-file (~350KB gz), monta num `<div>` com 3 chamadas, rotate/zoom/spin de graça. Mais leve que Mol* (3–5MB, overkill p/ molécula pequena) e que NGL (proteína). Wrappers React (molecule-3d-for-react, react-ngl) estão abandonados → copiar o padrão ~15 linhas, não depender deles. |
| Estrutura por NOME | **PubChem PUG-REST** | pública, sem key | `compound/name/{nome}/SDF?record_type=3d` devolve o SDF 3D direto. Fallback: `…/cids/JSON` → `…/cid/{cid}/SDF?record_type=3d`; SMILES via `compound/smiles/{smiles}/SDF`. |
| Proteína/macromolécula | **RCSB PDB** (`files.rcsb.org/download/{id}.pdb`) | pública | quando o alvo é proteína; CORS-friendly. (Fase tardia — foco agora é molécula pequena.) |
| Nome→SMILES backstop | **NCI CACTUS / OPSIN** | pública/permissiva | nomes IUPAC esquisitos que o PubChem não acha. |

**CORS:** PubChem **não** manda `Access-Control-Allow-Origin` → **fetch do browser é bloqueado**. Solução (e é o padrão certo): o endpoint **server-side** `/api/studio/molecule` faz o fetch, cacheia no Redis (que já temos) e devolve o SDF. Também respeita o rate-limit do PubChem (≤5 req/s).

## Como pluga no harness atual (100% aditivo — nada reescrito)

O fluxo já existe: harness `gerar_artefato` → `studio_generate{kind,topic}` → sentinela `@@STUDIO_ACTION@@` → cliente gera e o `StudioBlock`/`StudioArtifactViews` renderiza. Adicionamos um **kind novo** e um **viewer novo**:

1. **`lib/studio/types.ts`** — somar `"molecule"` ao `StudioKind`/`STUDIO_KINDS`. **NÃO** é `BINARY_KIND` (o SDF é texto pequeno → vive no `meta`, como guide/faq).
2. **`app/api/studio/molecule/route.ts`** (novo) — body `{ topic (nome do composto), sourceIds?, spaceId? }` → resolve no PubChem (name→CID→SDF 3D), cache Redis, devolve `StudioArtifact{ kind:"molecule", status:"done", meta:{ name, cid, sdf, formula?, format:"sdf" } }`. Erro (composto não achado) → `status:"error"` + msg via `messageForError`.
3. **`components/studio/StudioArtifactViews.tsx`** — novo `MoleculeView({ meta })`: carrega 3Dmol.js via `next/script` (`afterInteractive`) OU dynamic import `ssr:false`, monta o SDF (`viewer.addModel(sdf,"sdf")`, `setStyle({},{stick:{},sphere:{scale:0.3}})`, `zoomTo()`, `spin(true)`). Skeleton "montando molécula…" enquanto carrega. `StudioBlock` despacha `kind==="molecule"` → `MoleculeView`.
4. **`lib/agent/tools.ts`** — somar `"molecule"` ao `StudioKind` do harness + aliases (`molecula/molécula/estrutura/composto/fórmula → molecule`). Atualizar a **descrição da `studioGenerateTool`**: "para kind `molecule`, `topic` = o NOME EM INGLÊS do composto relevante (ex.: pergunta sobre café → topic `caffeine`; sobre açúcar → `glucose`; sobre aspirina → `aspirin`)." ⇒ o modelo faz o pulo café→caffeine (conhecimento geral dele).
5. **`lib/agent/aura-harness.ts`** — `pickStudioKind`: `molecula/estrutura/composto/fórmula → "molecule"` (upgrade do atual, que mandava pra `image`). O caminho primário é model-driven (o modelo escolhe kind=molecule); o `pickStudioKind` é só o fallback heurístico.
6. **Persona/draft (opcional, alta alavanca):** uma linha no sys do `draft`/persona: "quando o tema for química/bioquímica e uma estrutura ajudar, gere a molécula (studio kind `molecule`) com o composto relevante — o texto explica enquanto a molécula aparece." Isso faz o "café → cafeína 3D" acontecer sem o usuário pedir explicitamente.

## Definition of Done
- "gera a molécula de cafeína" **e** "me explica o efeito do café" → card 3D girável da cafeína + texto acompanhando, na Sala de Estudos.
- Composto inexistente/ambíguo → card de erro suave (`messageForError`), texto segue.
- SDF cacheado no Redis (2ª chamada instantânea). 3Dmol carregado só no cliente (sem SSR/WebGL no server).
- Aditivo: os outros kinds e o legado intactos; `AURA_HARNESS="0"` não afeta (é camada de artefato).

## Generalização (o "contexto mais complexo" de verdade)
`StudioArtifactViews.tsx` é o **ArtifactViewer registry**. Depois de `molecule`, o mesmo padrão entrega, cada um como um kind+viewer: **diagrama (Mermaid)**, **plot/gráfico (Chart.js/Plotly)**, **fórmula (KaTeX)**, **mapa**, **linha DNA/proteína**. O harness passa a escolher o viewer certo por domínio — é a régua "resposta = estado de um processo rico", não texto.

---

## PROMPT PRO EXECUTOR (Claude Code) — 1 PR, atrás do fluxo existente

> Implemente o kind `molecule` de ponta a ponta. NÃO reescreva o Studio — some um kind + um viewer +
> um endpoint. Importe tipos existentes. Verifique com `transpileModule` + `vitest`. Gate binário no fim.

1. `lib/studio/types.ts`: add `"molecule"` a `StudioKind` + `STUDIO_KINDS` (NÃO em `BINARY_KINDS`).
2. `app/api/studio/molecule/route.ts`: `POST {topic, spaceId?}` → `studioUid()` guard → resolve PubChem
   `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{encode(topic)}/SDF?record_type=3d`
   (fallback via `/cids/JSON`→`/cid/{cid}/SDF?record_type=3d`); cache Redis por `topic` (helper `lib/ai/contextCache.ts`); persistir `StudioArtifact{kind:"molecule",status:"done",meta:{name,cid,sdf,format:"sdf"}}`. Falha → `status:"error"`. Contrato de resposta = igual aos outros kinds síncronos (§ Apêndice C.7 do HANDOFF).
3. `components/studio/StudioArtifactViews.tsx`: `MoleculeView({meta})` com 3Dmol.js via `next/script`
   `src="https://cdn.jsdelivr.net/npm/3dmol@2.5.5/build/3Dmol-min.js"` (client-only); `createViewer`→`addModel(meta.sdf,"sdf")`→`setStyle({},{stick:{},sphere:{scale:0.3}})`→`zoomTo()`→`render()`→`spin(true)`; skeleton no load; respeitar ⟁ + liquid glass. `StudioBlock` despacha `kind==="molecule"`.
4. `lib/agent/tools.ts`: `"molecule"` no `StudioKind` do harness + aliases; atualizar descrição da `studioGenerateTool` (topic = nome EN do composto; café→caffeine).
5. `lib/agent/aura-harness.ts`: `pickStudioKind` `molecula|estrutura|composto|fórmula → "molecule"`.
6. (opcional) 1 linha no sys do `draft` p/ auto-enriquecer temas de química.
**Gate:** `POST /api/studio/molecule {topic:"caffeine"}` devolve SDF cacheável; `MoleculeView` renderiza girando; "gera a molécula de cafeína" na Sala de Estudos cai no card 3D; transpila; composto inválido → erro suave. Licenças: 3Dmol.js BSD-3, PubChem público — registrar no CHANGELOG.
