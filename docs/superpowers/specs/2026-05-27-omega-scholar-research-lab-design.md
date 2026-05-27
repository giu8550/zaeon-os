# Omega Scholar — Agente de Pesquisa na Sala de Estudos

**Data:** 2026-05-27
**Status:** Aprovado (design) — pronto para plano de implementação
**Branch:** `feat/research-news-profile-migration`

---

## 1. Objetivo

Na página `research-lab`, aba **Sala de Estudos**, substituir o título "SALA DE ESTUDOS / AULAS,
COMUNIDADE, PROVAS E PROJETOS DO SEU CURSO" + o card de cabeçalho da sala ("Lounge") por uma
**janela horizontal de prompt** (layout enxuto, ícone de beca preservado, estética do gradiente
violeta do lounge, posicionada no topo no lugar do título).

Essa janela é a porta de entrada de um **agente de pesquisa acadêmica (Omega Scholar)** que satisfaz
o prompt mestre `OMEGA_SCHOLAR.md`. O agente busca em **fontes acadêmicas reais**, sintetiza, e
entrega o resultado na sub-aba **Comunidade**, que passa a ser o **workspace do Omega Scholar**
(módulos de Referências, Insights & Síntese, Arquivos e Lacunas / Research Questions).

### Requisito vital (inegociável)
**Toda afirmação apresentada como fato deve ter uma citação verificada.** O agente deve provar que o
conteúdo existe de verdade em um paper real, num trecho determinado. A verificação é **determinística
no servidor** — não confiamos na palavra do LLM. Sem prova → não vira fato.

---

## 2. Decisões tomadas no brainstorming

| Tema | Decisão |
|------|---------|
| Layout da janela de prompt | **A — barra enxuta** (beca + label + campo + enviar, uma linha) |
| Integração na aba Comunidade | **C — substituir o feed/globo** pelo workspace do Omega Scholar (redesign completo, página bonita) |
| Prova de citação | PDF baixável + visualizador inline que **abre na página citada**; locator a nível de **página** (sem linha exata) |
| Fluxo ao enviar | Thread estilo **Claude Code** (progresso: pesquisando → indo mais fundo → encontrei), tom **leve, descontraído e amigável** (PT-BR) |
| Persistência | **Banco de dados (Prisma / MongoDB)** — por usuário, sobrevive a reload |
| Fontes acadêmicas | Semantic Scholar, OpenAlex, arXiv, CrossRef + **Unpaywall/CORE/Europe PMC** para full-text aberto |
| Sci-Hub | **Não integrado** (conteúdo pirateado). Substituído por Unpaywall/CORE (open-access legal) |
| Google Scholar | **Não é fonte core** (sem API oficial, scraping instável). Coberto por Semantic Scholar + OpenAlex |
| Módulos | Referências · Insights & Síntese · Arquivos · Lacunas / Research Questions (todos os 4) |
| Backend | **Approach 1** — rota única orquestradora com streaming NDJSON |
| Escopo | Todas as salas (cabeçalho compartilhado em `StudyRoomContent`); cada usuário vê a sua |

---

## 3. Arquitetura

```
research-lab/page.tsx  (aba "sala-de-estudos": esconde o <h1> do título)
  └── StudyRoomContent.tsx
        └── <OmegaScholarProvider>            ← contexto: sessão atual, stream, runQuery()
              ├── <OmegaScholarBar/>          ← topo (substitui o card de cabeçalho da sala)
              └── Tabs
                    └── tab "community":
                          <OmegaScholarWorkspace/>   ← thread + 4 módulos + histórico
                          (substitui o dynamic import da página do globo)

POST /api/ai/scholar           ← orquestrador streaming (NDJSON)
GET  /api/ai/scholar/sessions  ← lista/carrega histórico do usuário
GET  /api/ai/scholar/pdf       ← proxy de PDF OA (CORS + anti-SSRF; ver §7.5)
lib/prisma.ts                  ← singleton Prisma (novo; ver §8)
lib/scholar/*                  ← fontes, dedup, extração de PDF (pdfjs), verificação (servidor)
```

### Fluxo
1. Usuário digita na `OmegaScholarBar` e envia.
2. `runQuery()` no provider: cria sessão otimista, muda `activeTab → "community"`, abre stream `POST /api/ai/scholar`.
3. O servidor emite eventos NDJSON de progresso; o `OmegaScholarWorkspace` renderiza a thread amigável em tempo real.
4. Ao final, módulos são preenchidos com dados **verificados** e a sessão é persistida.

---

## 4. Backend — `POST /api/ai/scholar` (streaming NDJSON)

Reutiliza o padrão `VertexAI` / `gemini-2.0-flash-001` já usado em `app/api/ai/agent-search/route.ts`
(auth via `GOOGLE_CREDENTIALS`). Resposta é um `ReadableStream` de linhas JSON (`application/x-ndjson`).

### Pipeline (fases do OMEGA loop)
1. **PLAN (Gemini, temp baixa):** classifica intenção (search | review | gap | write | cite | analyze),
   detecta domínio (§6.3 do OMEGA), gera 2-4 queries de busca e seleciona até 5 bases prioritárias.
2. **RETRIEVE (paralelo, server-side):** consulta as fontes (§5). Para cada paper, guarda os metadados
   e o **texto realmente recuperado** (`retrievedText`): sempre o abstract; full-text por parágrafos
   quando open-access. **Dedup** por DOI; fallback por título normalizado (overlap > 0.85).
3. **SYNTHESIZE (Gemini):** system prompt derivado do `OMEGA_SCHOLAR.md`. Recebe SOMENTE o
   `retrievedText` dos papers e deve produzir **Evidence Records** — cada claim com `quote` **verbatim
   copiado do texto fornecido** + `paperId` + `locator`. Proibido citar paper fora da lista; proibido
   inventar números/venues/DOIs (§10.2 do OMEGA).
4. **VERIFY (determinístico, servidor):** ver §6. Marca cada record `verified: true|false`.
5. **PERSIST:** grava `ScholarSession`; emite evento final `done` com o payload completo.

### Contrato de eventos (NDJSON, um objeto por linha)
```jsonc
{ "type": "session",   "sessionId": "..." }
{ "type": "phase",     "phase": "planning", "message": "Beleza! Vou fuçar sobre \"...\"" }
{ "type": "phase",     "phase": "searching", "source": "arxiv",     "count": 23 }
{ "type": "phase",     "phase": "searching", "source": "openalex",  "count": 17 }
{ "type": "phase",     "phase": "dedup",      "unique": 31, "fulltext": 12 }
{ "type": "phase",     "phase": "synthesizing" }
{ "type": "phase",     "phase": "verifying",  "checked": 14, "verified": 12, "dropped": 2 }
{ "type": "answer",    "text": "Achei bastante coisa! ..." }          // resposta sintetizada (amigável)
{ "type": "done",      "session": { /* ScholarSession completa */ } }
{ "type": "error",     "message": "..." }                            // por fase; pipeline continua qdo possível
```
As mensagens de `phase` carregam texto amigável PT-BR para a thread (tom leve).

---

## 5. Fontes acadêmicas (`lib/scholar/sources/`)

Quase todas gratuitas e **sem chave**. Exceções: **CORE** exige uma chave gratuita (via env) — se não
configurada, é **pulada** na cadeia de fallback; **Unpaywall** exige apenas um email (via env). Cada
fonte expõe `search(query, opts)` → `Paper[]` normalizado
e, quando aplicável, `fetchFullText(doi|id)` → `{ paragraphs: string[] }`.

| Fonte | Uso | Endpoint base | Chave |
|-------|-----|---------------|-------|
| Semantic Scholar | busca + citações + abstract | `api.semanticscholar.org/graph/v1` | não |
| OpenAlex | busca multidisciplinar | `api.openalex.org` | não |
| arXiv | preprints + full-text (HTML/PDF→texto) | `export.arxiv.org/api` | não |
| CrossRef | metadados por DOI + **BibTeX** (`/transform/application/x-bibtex`) | `api.crossref.org` | não |
| Unpaywall | localizar PDF open-access por DOI | `api.unpaywall.org/v2` | email (env) |
| CORE | full-text open-access | `api.core.ac.uk/v3` | chave gratuita (env); pulada se ausente |
| Europe PMC | full-text biomédico (XML com seções/parágrafos) | `ebi.ac.uk/europepmc` | não |

**Política de full-text (prioriza o PDF real):** sempre que houver PDF open-access (arXiv tem PDF
direto; senão Unpaywall → CORE → Europe PMC), **baixamos o PDF** e extraímos o texto **por página**
com `pdfjs-dist` (já nas deps). Cada parágrafo recuperado fica atribuído ao **número da página**. Isso
permite a prova tangível pedida pelo usuário: o paper fica disponível para download e cada citação
aponta a **página exata** onde aparece. Se nenhum PDF abrir, cai para o full-text textual (XML do
Europe PMC / HTML do arXiv, com seção) e, em último caso, **abstract-only** (claims só ancorados no
resumo e marcados como tal). `pdfUrl` é persistido para download + visualização inline.

**Modelo `Paper` normalizado:** `{ id, title, authors[], year, venue, doi?, arxivId?, url?, pdfUrl?,
abstract?, citationCount?, openAccess: bool, sources: string[], retrievedText?: { kind:
"pdf"|"fulltext"|"abstract", paragraphs: { idx, page?, section?, text }[] } }`.

---

## 6. Verificação de citação (o coração do sistema) — `lib/scholar/verify.ts`

Para cada Evidence Record produzido pelo LLM:
1. Localiza o `Paper` por `paperId`. Se não existir na coleção recuperada → **descarta** (claim órfão).
2. Procura a `quote` no `retrievedText` do paper:
   - **Exato** primeiro; depois **normalizado** (lowercase, colapsa espaços, remove hifenização de quebra
     de linha e pontuação não essencial).
   - Se ainda falhar, **fuzzy** (similaridade ≥ 0.92 sobre janela deslizante) para tolerar reticências/OCR.
3. Se encontrado: `verified = true`; preenche `locator`:
   - PDF → `{ kind: "pdf", page: n, paragraph?: idx }` (ex.: "Página 4") — **prova principal**.
   - full-text textual → `{ kind: "fulltext", section?, paragraph: idx }` (ex.: "Seção 3.2.2, parág. 1").
   - abstract → `{ kind: "abstract", sentence?: n }` (ex.: "Resumo, frase 2").
4. Se não encontrado: `verified = false` → **não é exibido como fato**. Vai para uma lista
   "não confirmadas" rebaixada/oculta (nunca apresentado como verdade).

**Prova tangível (pedido central do usuário):** para papers com PDF, a UI mostra o **paper para
download** e, ao clicar numa citação, **abre o PDF na página citada** (visualizador inline) com a
`quote` verbatim ao lado — o usuário vê a frase no documento real. Número de linha dentro da página
NÃO é exposto pelas APIs, então não o prometemos; a garantia é **página + quote verbatim + PDF em
mãos** (e checagem programática de que a frase existe). Papers abstract-only são rotulados como tal.

**Evidence Record (persistido):**
`{ paperId, claim, quote, locator, confidence: "high"|"medium"|"low", verified: bool, fullTextAvailable: bool }`
Mapeamento de confiança segue §10.1 do OMEGA (high = full-text lido/verificado; medium = abstract; etc.).

---

## 7. Frontend

### 7.1 `OmegaScholarBar` (novo) — `app/workstation/student/omega/OmegaScholarBar.tsx`
- Layout A: container gradiente violeta `rounded-[28px]` (clona estética do card de cabeçalho atual
  em `StudyRoomContent` linhas 267-282), glow blur, ícone de beca (`GraduationCap`) em quadrado
  fosco, label `OMEGA SCHOLAR · PESQUISA ACADÊMICA`, `input` + botão enviar (gradiente violeta).
- Estados: idle / running (campo desabilitado + spinner sutil). Enter ou clique → `ctx.runQuery(value)`.

### 7.2 `OmegaScholarWorkspace` (novo) — `.../omega/OmegaScholarWorkspace.tsx`
Renderizado na tab `community` dentro de `StudyRoomContent`, **substituindo inteiramente** o globo/feed
(removido desta superfície). É um **redesign completo e caprichado** da aba Comunidade — qualidade
frontend-design, coeso com a estética violeta do Omega Scholar — exibindo todo o output do agente.
- **Activity thread** (topo): linhas de progresso (amigáveis, com checks) + `answer` sintetizada.
- **Módulos** (grid):
  - **Referências:** card por paper (título, autores, ano, venue, DOI/arXiv, OA?, citações). Ações:
    **Download do PDF** + **"Copiar BibTeX"** (CrossRef). Expande para os Evidence Records: claim +
    `quote` (itálico, destacado) + locator + selo **✓ VERIFICADO** + confiança. Clicar numa citação
    com locator de PDF **abre o visualizador inline** (`@react-pdf-viewer/core`, já nas deps) **na
    página citada**, com a `quote` ao lado para conferência imediata. Sem PDF → mostra a frase + link
    ao DOI e o rótulo de seção/abstract.
  - **Insights & Síntese:** resumo executivo, tendências, contradições.
  - **Arquivos:** entregáveis gerados (`literature-review.md`, `references.bib`) com download.
  - **Lacunas / Research Questions:** gap analysis + RQ Cards (template §3.2 do OMEGA).
- **Histórico:** lista de `ScholarSession` anteriores (via `GET /api/ai/scholar/sessions`); clicar
  recarrega a sessão.

### 7.3 `OmegaScholarProvider` (novo) — `.../omega/OmegaScholarContext.tsx`
- Estado: `currentSession`, `phases[]`, `answer`, `status`, `error`.
- `runQuery(prompt)`: cria sessão otimista, sinaliza `onOpenCommunity` (o pai muda `activeTab`),
  faz `fetch` com leitura incremental do `ReadableStream` (parse NDJSON linha-a-linha), atualiza estado.
- Exposto via hook `useOmegaScholar()`.

### 7.4 Integrações em arquivos existentes
- **`app/research-lab/page.tsx`** (~linha 1158-1167): quando `activeTab === "sala-de-estudos"`, **não
  renderizar** o bloco `<h1>{tabMeta.title}</h1>` + subtítulo (a barra de prompt assume o topo).
- **`app/workstation/student/StudyRoomContent.tsx`:**
  - Envolver o conteúdo no `<OmegaScholarProvider>`.
  - Substituir o card "ROOM HEADER" (linhas 267-282) pelo `<OmegaScholarBar/>`.
  - Para `activeTab === "community"`, renderizar `<OmegaScholarWorkspace/>` em vez do
    `DYNAMIC_COMPONENTS[room].community`. Demais tabs inalteradas.
  - `runQuery` deve setar `activeTab = "community"`.

> As páginas standalone `app/study-rooms/*/community/page.tsx` (globo) **não são alteradas nem
> removidas** — continuam servindo suas rotas próprias. Só muda o que a tab Comunidade do
> `StudyRoomContent` renderiza.

### 7.5 `GET /api/ai/scholar/pdf` (novo, proxy de PDF)
Visualizar/baixar PDFs OA de outros domínios direto no browser esbarra em CORS. Esta rota faz proxy
do PDF e o stream-a com headers adequados, permitindo o visualizador inline e o download.
**Anti-SSRF:** só aceita URLs que **já estão persistidas** em alguma `ScholarSession` do usuário
(valida contra o banco); recusa esquemas não-http(s) e hosts/IPs privados. Sem isso, não proxia.

---

## 8. Dados (Prisma / MongoDB) — `prisma/schema.prisma`

Novo model (dados de módulo como JSON, coerente com o uso de `Json?` no schema atual):
```prisma
model ScholarSession {
  id         String   @id @default(auto()) @map("_id") @db.ObjectId
  userId     String   @db.ObjectId
  room       String?
  query      String
  domain     String?
  status     String   @default("running") // running | done | error
  thread     Json?    // fases de progresso + answer
  references Json?    // Paper[] (normalizado, ver §5)
  evidence   Json?    // EvidenceRecord[] (ver §6) — só os verified viram fato na UI
  insights   Json?    // { summary, trends[], contradictions[] }
  gaps       Json?    // { description, rqCards[] }
  files      Json?    // [{ name, kind, content }]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

**Melhoria pontual:** criar `lib/prisma.ts` como singleton (global em dev) e usá-lo nas rotas novas,
em vez de `new PrismaClient()` por rota (padrão atual em `agent-search`, propenso a esgotar conexões).
Não refatorar rotas existentes neste escopo.

---

## 9. Tratamento de erros (segue §12 do OMEGA)

| Situação | Ação |
|----------|------|
| Fonte indisponível / rate-limit | continua com as outras; emite `phase` informando; retry leve (até 3x, backoff) |
| Full-text inacessível | cadeia de fallback; marca paper `abstract-only` |
| Quote não verificada | record `verified: false`; **não exibido como fato** |
| < 10 papers | expande keywords / janela temporal; informa o usuário na thread |
| DOI inválido para BibTeX | tenta título+autores no CrossRef; marca `[unverified]` |
| Stream interrompido | sessão fica `error`; UI mostra estado e permite reenviar |

---

## 10. Testes

- **`lib/scholar/verify.ts`:** unit tests — exato/normalizado/fuzzy; rejeita quote inexistente; locator
  correto para PDF (página) vs full-text (seção) vs abstract; hifenização de quebra de linha.
- **`lib/scholar/pdf.ts`:** extração por página com `pdfjs-dist` sobre um PDF fixture — confere que cada
  parágrafo recebe o `page` certo (base da prova "página exata").
- **`/api/ai/scholar/pdf`:** recusa URL não persistida (anti-SSRF) e host privado; proxia URL válida.
- **`lib/scholar/dedup.ts`:** dedup por DOI e por título normalizado (overlap > 0.85).
- **Fontes:** parsers testados com fixtures de resposta real (sem rede nos testes).
- **Rota `/api/ai/scholar`:** teste de integração com Gemini e fetch mockados — asserta a ordem de
  eventos NDJSON e que nenhum record `verified:false` aparece no payload `done` como fato.
- **Anti-alucinação:** dado um paper cujo texto NÃO contém a frase, o record deve ser descartado.

---

## 11. Fora de escopo (YAGNI)

- Loop agêntico com tool-calling autônomo (Approach 2) — upgrade futuro.
- Google Scholar / Sci-Hub scraping.
- Integração Zotero (§13 do OMEGA).
- Modos exhaustive/meta-análise — começamos com quick/standard.
- Edição/anotação manual dos módulos pelo usuário — v2.
```
