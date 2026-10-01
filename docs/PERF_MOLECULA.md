# Performance da geração de molécula (BioSim3D) — diagnóstico + otimizações

> Queixa: gerar a molécula demora demais. Investigado e otimizado em 2026-09-25.

## Diagnóstico (a cadeia que estava lenta)
Um pedido de molécula percorria, **tudo em série**:
1. Cliente → `POST /api/agentic/biosim` (FormData).
2. Servidor → **Gemini classifica o intent** (`gemini-2.5-flash`, JSON, maxOutputTokens 8192) — **1-4s**, o maior custo isolado. Rodava até pra "cafeína" (nome óbvio).
3. Servidor → chamava a **própria API por HTTP** (`${baseUrl}/api/agentic/biosim/pubchem`) — hop de rede + invocação de rota extra.
4. Rota PubChem → **3 fetches em série** com `cache:'no-store'`: nome→CID, CID→conformer 3D, CID→propriedades. Cada um 300ms-2s.
5. Voxelização + retorno.

Total realista: **5-10s**. Sem nenhum cache → repetir a mesma molécula pagava tudo de novo.

## O que foi feito (aplicado neste PR)
1. **Fast-path que pula o Gemini** (`app/api/agentic/biosim/route.ts`): se não há imagem, a sala
   permite `molecule` e o prompt **parece um nome de composto** (`looksLikeMoleculeName` — lista de
   comuns + fórmula química + 1-2 palavras sem verbo/pergunta), vai **direto ao PubChem**. Corta 1-4s
   no caso mais comum. Se o PubChem não achar, cai no fluxo normal do classificador (sem regressão).
2. **Sem hop HTTP interno**: `fetchPubChem` agora chama a lib **diretamente** (`resolvePubChem`), não
   `fetch` na própria URL. Remove um round-trip completo + cold-start de rota.
3. **Fetches paralelos** (`lib/biosim/pubchem.ts`): depois do CID, o **conformer 3D e as propriedades**
   são buscados com `Promise.all` (eram sequenciais) → -1 round-trip de latência.
4. **Cache em memória** por nome normalizado (o container web é longevo → persiste entre requests).
   Estruturas são imutáveis, então nunca expira (cap de 500). **Segunda vez = instantâneo** — ótimo
   pra demo/pitch e pra moléculas repetidas.
5. **Timeout por fetch** (8s) com `AbortController`: se o PubChem travar, degrada rápido em vez de
   pendurar a UX.
6. **Anel de loading com estágios** (`BioSim3DModule.tsx` → `GeneratingRing`): substitui o spinner
   simples por um anel de progresso que avança por etapas ("Interpretando… → Consultando PubChem… →
   Baixando estrutura 3D… → Montando átomos… → Renderizando"). Reduz a **ansiedade da espera**
   (perceived performance) mesmo quando a rede é o gargalo. Respeita a cor da sala.

### Impacto esperado
- Molécula comum (ex.: "cafeína", "mescalina", "aspirina"), 1ª vez: **~5-8s → ~1-3s** (sem Gemini, sem hop, fetches paralelos).
- Mesma molécula de novo: **quase instantâneo** (cache).
- Prompt ambíguo / com imagem: mantém o Gemini (correto), mas agora com PubChem direto + paralelo + cache.

## Arquivos tocados
- `lib/biosim/pubchem.ts` — **novo**: resolver com cache + paralelo + timeout + heurística de nome.
- `app/api/agentic/biosim/pubchem/route.ts` — wrapper fino sobre a lib.
- `app/api/agentic/biosim/route.ts` — fast-path (pula Gemini) + chamada direta (sem hop).
- `app/agentic-modules/biosim3d/BioSim3DModule.tsx` — `GeneratingRing` (anel com estágios).

## Alternativas / próximos passos (se ainda faltar velocidade)
- **Precomputar as N moléculas mais pedidas** como JSON estático em `public/` (voxels já prontos) →
  0 rede pra elas. Popular a partir do cache/telemetria.
- **Cache no Redis** (já temos infra) em vez de só memória → sobrevive a restart/deploy e é
  compartilhado entre instâncias.
- **Render client-side direto de SDF** com 3Dmol.js (o PR `RICH_ARTIFACTS_MOLECULE.md`), ou
  **RDKit.js (WASM)** pra gerar/renderizar estrutura no browser sem depender do conformer 3D do
  PubChem (que às vezes nem existe pro composto).
- **Endpoint 2D primeiro**: mostrar o PNG 2D do PubChem (instantâneo) enquanto o 3D carrega — o
  módulo já busca esse PNG; dá pra exibi-lo dentro do anel como preview.
- **Streaming de voxels**: enviar os átomos em chunks e ir desenhando (percepção de progresso real).
