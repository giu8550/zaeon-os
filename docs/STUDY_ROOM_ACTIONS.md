# Sala de Estudos — Mapa de Funções (para acionar via Zaeon)

> Catálogo de TODAS as ações da Sala de Estudos + como dispará-las programaticamente.
> Objetivo: o orquestrador Zaeon converter comandos em linguagem natural nessas ações
> (function-calling no /api/ai/chat → eventos globais / rotas). Data: 2026-06-15.

A sala vive em `app/research-lab/page.tsx` (shell com abas) + `StudyRoomContent.tsx`
(aba "sala-de-estudos") + `OmegaScholar*` (motor de pesquisa) + `MeusEstudosFeed.tsx` (caderno).

---

## 1. Navegação entre abas (research-lab)
Estado `activeTab` em `app/research-lab/page.tsx` (linha ~412). Valores:
`pesquisa | sala-de-estudos | projetos | pesquisas | lounge | news | profile`.
- Via URL: `/research-lab?tab=<id>` (page lê `tabParam` no mount).
- Submódulos da Sala de Estudos (StudyRoomContent `allTabs`): a aba default + ROOM_TABS
  (Meus Estudos, e as do motor). Trocadas por `setActiveTab` interno.
- **Ação Zaeon sugerida:** `goto_tab(tab)` → navegar/`?tab=`.

## 2. Pesquisa acadêmica (Omega Scholar) — `app/workstation/student/omega/`
- `runQuery(prompt, deep?)` no `OmegaScholarContext` → `POST /api/ai/scholar` (NDJSON stream).
  - `deep=true` só vale se a conta tem deep-thinking liberado (modo econômico; `/api/ai/capabilities`).
  - Estado persistido + resume ao voltar (localStorage `zaeon.omega.run`).
- Resultado popula abas do `OmegaScholarWorkspace`: Referências, Insights & Síntese, Base, Sugestões.
- Histórico: `GET /api/ai/scholar/sessions` (cache 30s, invalida ao iniciar nova).
- **Ação Zaeon:** `pesquisar(tema, profundo?)` → setDraft + runQuery.

## 3. Referências (ReferencesModule)
- Citações VERBATIM do trabalho (evidence verificada) — exibidas no topo de cada card.
- `Baixar PDF` (`/api/ai/scholar/pdf?url=`), `Salvar na biblioteca` (só com pdfUrl; useLibraryFiles),
  abrir trecho no viewer (`PdfViewerModal`).
- (Removido o bloco de referência ABNT-copiar.)
- **Ação Zaeon:** `salvar_referencia(paperId)`, `abrir_pdf(paperId, pagina)`.

## 4. Sugestão de pesquisa (ResearchSuggestionPanel)
- Termômetro de nível (grad|msc|phd|postdoc) press-and-hold → `level`.
- `POST /api/ai/research-suggest { topic, level, exclude_titles }` (Gemini).
- Botão premium morpha: Gerar → standby "Usar como título".
- **Confirmar título** dispara `window.dispatchEvent(new CustomEvent("zaeon:research:use-title", {detail:{title}}))`
  → page.tsx seta `docTitle` + vai pra aba `pesquisa`. (correlação entre páginas)
- **Ação Zaeon:** `sugerir_pesquisa(tema, nivel)`, `usar_titulo(titulo)` (= disparar o evento acima).

## 5. Meus Estudos (caderno) — `components/study/MeusEstudosFeed.tsx`
- Espaços (StudySpace): `GET/POST/PATCH/DELETE /api/study/spaces`. localStorage `zaeon.study.lastSpace`.
- Itens (StudyItem, placement library|feed): `GET/POST/PATCH/DELETE /api/study/items` (aceita payload/order).
- Caderno editável: blocos h1/h2/text (addBlock), arrastar da biblioteca p/ o feed (toFeed).
- Vídeo: colar link YouTube num bloco → player compacto.
- Resumir item: `POST /api/study/summarize` (Flash).
- **Zaeon generativa:** `POST /api/study/agent { command, spaceId }` (worker) → blocos (heading/subheading/
  text/link) inseridos ao vivo no feed. Comando "Zaeon, estude sobre…".
- Colar de outras abas: evento global `zaeon:study:add {type,title,payload}` (cai na biblioteca).
- **Ação Zaeon:** `estudar(comando)` (= /api/study/agent), `add_ao_caderno(type,title,payload)` (= evento),
  `novo_espaco(titulo)`, `resumir_item(id)`.

## 6. Eventos globais (canais já existentes)
- `zaeon:study:add` — adiciona item à biblioteca de Meus Estudos.
- `zaeon:research:use-title` — define o título do trabalho na aba Pesquisa.
- `zaeon:citationRemove` — remove citação do documento.
- `zaeon:pulse` — pisca o triângulo ⟁ (feedback de atividade de agente).

## 7. Rotas de IA da sala (todas Gemini Flash; Pro só no deepthink)
`/api/ai/scholar`(+`/sessions`,`/prereqs`,`/pdf`), `/api/ai/research-suggest`,
`/api/ai/summarize-lite`, `/api/ai/relate`, `/api/ai/suggestion-forge`(degrada vazio),
`/api/study/{agent,summarize,youtube,items,spaces}`. Todas com auth + guard (rate-limit) + cache best-effort.

---

## Próximo passo (wiring Zaeon)
Adicionar no `/api/ai/chat` um tool `study_action` (function-calling) com as ações acima
(goto_tab, pesquisar, sugerir_pesquisa, usar_titulo, estudar, salvar_referencia, add_ao_caderno…).
O backend devolve `{ action, args }`; o front (research-lab) executa via os eventos/rotas já listados.
Assim "Zaeon, estude sobre X e use como título" vira: estudar(X) + usar_titulo(...).
