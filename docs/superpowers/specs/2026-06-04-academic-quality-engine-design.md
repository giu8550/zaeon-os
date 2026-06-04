# Motor de Qualidade Acadêmica ("Termômetro Acadêmico") — Design

- **Data:** 2026-06-04
- **Status:** Aprovado nos 3 forks de arquitetura (runtime NILC+nativo, UI termômetro+trilha, entrega via PR). Pronto para plano de implementação.
- **Branch:** `claude/heuristic-almeida-a1066d`

---

## 1. Contexto e motivação

A demanda nasce da análise de uma afirmação sobre IA na produção acadêmica. Fact-check (fontes primárias):

- O estudo é real: **Gartenberg, Hasan, Murray & Pierce (2026), "More Versus Better", _Organization Science_ 37(3)** — um relatório da AI Task Force do periódico. Confirma **+42% de submissões desde nov/2022** e **queda de legibilidade: Flesch Reading Ease 1,28 desvio-padrão mais baixo** em jan/2026 vs jan/2021. Corroborado por **Alsudais (2025), _Journal of Informetrics_** (~2,4M abstracts do arXiv).
- Os números "473 de 4.715 (~10%)" estão **mal rotulados**: 4.715 é o pipeline editorial pós-ChatGPT; 473 é só o balde "70%+ escrito por IA". Corpus-título real: 6.957 submissões + 10.389 revisões.
- **Nuance que vira regra de design:** Flesch mais alto = mais fácil de ler. A IA _derrubou_ o Flesch (mais nominalização/jargão). Logo, "boa escrita acadêmica" **não é monotônica em legibilidade** — há uma **faixa ótima**: fácil demais soa raso; difícil demais soa obscuro.

**Objetivo do produto:** um "termômetro" embutido no editor de pesquisa que classifica, de forma **exigente e explicável**, (a) o trabalho como um todo a partir do **título** + estrutura, e (b) **cada parágrafo** em 5 bandas — **ruim · aceitável · bom · muito bom · excepcional** — para **elevar o nível acadêmico**. Deve distinguir um TCC simples de um trabalho com potencial de publicação/produto/descoberta.

## 2. Objetivos e não-objetivos

**Objetivos**
1. Motor Python que pontua título, seções e parágrafos de um documento ABNT (PT-BR) com métricas estabelecidas e citáveis.
2. Bandas explicáveis (cada nota traz os fatores que a sustentam/limitam), ancoradas na rubrica AAC&U VALUE (0–4).
3. "Leitura de nível/ambição" alinhada à taxonomia existente (grad/msc/phd/postdoc → Exploratória/Experimental/Pioneira/Ultra).
4. UI: painel **Termômetro Acadêmico** + **trilha por parágrafo** (modo revisão), sutil e sempre presente.
5. NILC-Metrix como provider autoritativo (PT-validado) + provider nativo Python (rápido, sempre disponível) atrás de uma interface única.
6. Suíte verde (pytest + vitest) antes do PR.

**Não-objetivos (YAGNI)**
- Não é detector de IA/plágio. Sinais de "fingerprint" de IA são **flags de revisão**, nunca determinantes da nota.
- Sem persistência de histórico de notas em v1 (cálculo sob demanda, com cache no cliente por hash de conteúdo).
- Sem treinar modelos próprios; usamos fórmulas/léxicos/parse + NILC quando disponível.
- Sem reescrever o editor (segue `<textarea>`); a trilha inline usa um **modo revisão** renderizado.

## 3. Arquitetura

```
research-lab (React)
  ├─ parseAbntMarkers(docContent)  →  sections[]   (lib/abntTemplate.ts, já existe)
  ├─ segmentParagraphs(section)    →  paragraphs[] (novo, client, espelha o Python)
  ├─ AcademicThermometer (painel + trilha/modo-revisão)
  └─ POST /api/quality  ───────────────►  app/api/quality/route.ts (proxy TS, auth por email)
                                              └─ fetch QUALITY_ENGINE_URL/score (default :8003)
                                                   │  (degrada para 503 "engine offline" → UI some)
                                                   ▼
                                          quality-engine (FastAPI :8003, Python)
                                              ├─ scorer.py      (orquestra, banding, pesos por seção, nível)
                                              ├─ segmentation.py(parágrafos/sentenças PT)
                                              ├─ metrics/native.py (Flesch-BR, MTLD, sintaxe, coesão, citações, flags)
                                              ├─ metrics/nilc.py   (cliente HTTP p/ NILC-Metrix, opcional)
                                              └─ providers.py   (escolhe NILC↔nativo por métrica)
                                                   │ (se NILC_METRIX_URL setado e /health ok)
                                                   ▼
                                          NILC-Metrix (container próprio, auto-hospedado)
```

**Fluxo de dados:** o cliente segmenta e envia `{title, work_type, academic_level, sections[]}`. O proxy autentica (sessão→email→user, pois `session.user.id` não existe — quirk conhecido) e repassa ao motor. O motor devolve notas por parágrafo/seção/documento + metadados do provider.

**Dois níveis de latência:** trilha "ao vivo" (debounce ~700ms) usa **nativo** (rápido); a análise "profunda" da seção/documento e do export pode consultar **NILC** quando configurado. O nativo garante funcionamento mesmo sem o container de 2GB e mantém a suíte verde.

## 4. Metodologia de métricas e banding

Cada métrica tem **fonte**, **direção** (monotônica ↑ / faixa-ótima) e **viabilidade PT**. `textstat` **não suporta PT** → usamos coeficientes BR.

### 4.1 Por parágrafo (canal de NOTA)
| Métrica | Fonte | Mapa de qualidade | Viab. PT |
|---|---|---|---|
| **Flesch-BR (ILF)** = `248.835 − 1.015·(palavras/frase) − 84.6·(sílabas/palavra)` | Martins et al. 1996 (ICMC-USP); sílabas via `pyphen` pt_BR | **Faixa-ótima** (reward gaussiano; alvo acadêmico ~25–50, ajustado por seção/nível). NILC sobrepõe quando disponível. | EASY |
| **MTLD** (diversidade lexical robusta a tamanho) | McCarthy & Jarvis 2010; lib `lexical-diversity` | ↑ melhor, com teto | EASY |
| **Complexidade sintática** (compr. médio de frase, orações/frase, *burstiness* = CV do compr. de frase) | Lu 2010 (L2SCA, índices reproduzidos) | Faixa-ótima (nem picotado, nem arrastado) | MEDIUM |
| **Coesão local** (densidade de conectivos PT + sobreposição lexical de conteúdo entre frases adjacentes) | Coh-Metrix-Port; Halliday & Hasan | ↑ melhor, com teto | MEDIUM |
| **Densidade de citações** (regex ABNT `(SOBRENOME, ano)`, `SOBRENOME (ano)`, `et al.`, numérica) | convenção ABNT NBR 10520 | Dependente de seção: referencial/discussão exigem; conclusão não | EASY |

### 4.2 Canal de FLAGS (não entra na nota — só sinaliza "revisar")
- **Léxico-fingerprint de IA em PT** (ressaltar, aprofundar, robusto, abrangente, crucial, multifacetado, intricado, …) — Kobak 2025 / Geng & Trotta 2024. Precisão baixa; lista decai com o tempo.
- **Nominalização excessiva** (sufixos -ção/-mento/-idade/-ância/-ência) — sinal direto do estudo Gartenberg 2026.
- **Uniformidade de frases** (burstiness muito baixo) — monótono/possível IA.

### 4.3 Por seção (consciente da estrutura)
- Presença/saúde **IMRaD/ABNT** (introdução, referencial, metodologia, resultados, conclusão, referências).
- **Introdução — modelo CARS de Swales:** detecção de pistas de **Move 2 (lacuna)** ("no entanto", "poucos estudos", "lacuna", "carece", "ainda não") e **Move 3 (objetivo)** ("o objetivo deste", "este trabalho visa", "propõe-se"). Ausência de lacuna/objetivo derruba a banda da introdução.
- **Conclusão:** retoma objetivo? aponta limitações/trabalhos futuros?
- **Pesos por tipo de seção** (ex.: metodologia pondera especificidade/estrutura; referencial pondera citação+coesão; introdução pondera clareza+CARS).

### 4.4 Documento e título
- **Título:** especificidade/pesquisabilidade (construto + contexto + pista de método). Título vago rebaixa o teto; específico eleva.
- **Leitura de nível/ambição** (o "exigente"): combina rigor metodológico, pistas de novidade/contribuição, amplitude/atualidade de citações, completude estrutural e especificidade do título → rótulo alinhado a **Exploratória (TCC) → Experimental → Pioneira → Ultra (Q1/produto)**.

### 4.5 Normalização → bandas
1. Normaliza cada feature: blend de **z-score intra-documento** (reduz viés de tema) + **limiares absolutos ancorados na literatura** (impede inflar um doc uniformemente mediano).
2. **Shaping não-monotônico** (Flesch/complexidade/nominalização): recompensa gaussiana na faixa-ótima.
3. **Soma ponderada** (pesos por tipo de seção) → score 0–100 → **5 bandas** mapeadas aos níveis VALUE 0–4 (AAC&U Written Communication):

| Banda | VALUE | Significado |
|---|---|---|
| ruim | 0–1 | incoerente, sem suporte, com erros |
| aceitável | ~2 | adequado mas plano; lacunas de coesão/evidência |
| bom | ~3 | claro, coeso, bem-apoiado |
| muito bom | 3–4 | sofisticado, bem-argumentado |
| excepcional | 4 | controle magistral de conteúdo/estrutura/fontes/estilo |

Cada banda carrega **rationale** (1 linha) + **top fatores** (força/limite). Flags vivem num **canal ortogonal** ("⚠ revisar").

> Defensibilidade: só Flesch-BR (Martins) e NILC-Metrix têm validação específica para PT. MTLD, L2SCA, CARS, VALUE são consolidados mas validados sobretudo em inglês — portados como **adaptação** (declarado). Flags de IA são o sinal mais fraco e explicitamente decaem com o tempo. Pesos calibrados contra um pequeno conjunto de parágrafos-âncora (fixtures) antes de confiar nas bandas.

## 5. Contratos de API

```python
# Pydantic v2 (quality-engine/models.py)
WorkType = Literal["Artigo", "Relatório", "TCC"]
AcademicLevel = Literal["grad", "msc", "phd", "postdoc"]
Band = Literal["ruim", "aceitavel", "bom", "muito_bom", "excepcional"]

class SubsectionIn(BaseModel): title: str; content: str
class SectionIn(BaseModel):
    type: str            # introducao|desenvolvimento|conclusao|referencias|custom
    title: str
    content: str
    subsections: list[SubsectionIn] = []

class ScoreRequest(BaseModel):
    title: str
    work_type: WorkType = "TCC"
    academic_level: AcademicLevel = "grad"
    sections: list[SectionIn]

class ParagraphScore(BaseModel):
    idx: int; section_type: str; band: Band; score: float           # 0–100
    rationale: str; strengths: list[str]; gaps: list[str]
    flags: list[str]; metrics: dict[str, float]

class SectionScore(BaseModel):
    type: str; title: str; band: Band; score: float
    structure_flags: list[str]; rationale: str
    paragraphs: list[ParagraphScore]

class TitleScore(BaseModel): band: Band; specificity: float; notes: list[str]

class ScoreResponse(BaseModel):
    overall: dict           # {band, score, level_read, rationale, strengths[], gaps[]}
    title: TitleScore
    sections: list[SectionScore]
    meta: dict              # {provider: "nilc"|"native", engine_version, computed_ms}
```

Endpoints FastAPI (espelha `research-engine`): `GET /health`, `POST /score`, `POST /score/paragraph` (rápido, p/ trilha ao vivo). Erros: 422 (ValueError) / 503 (RuntimeError/NILC down) / 500.

Proxy TS `app/api/quality/route.ts`: `getServerSession` → email→user (quirk), `fetch(QUALITY_ENGINE_URL/score, AbortSignal.timeout(25s))`, 503 "Quality engine offline" → UI esconde o termômetro graciosamente.

## 6. UI — Termômetro + trilha (restrição do `<textarea>`)

Componente novo `components/research/AcademicThermometer.tsx` (client), integrado na **FOLHA A4** ([app/research-lab/page.tsx](app/research-lab/page.tsx) ~1342) sem reescrever o editor:

- **Barra colapsável** no topo da folha (mesmo padrão visual da "ABNT HINT BAR", linha 1344): medalhão de **banda geral** (cor + rótulo + score), **leitura de nível** (Exploratória→Ultra), chips por seção, top forças/lacunas. Sempre presente, discreto.
- **Trilha por parágrafo via "Modo Revisão":** toggle que troca o textarea por uma renderização read-only dos parágrafos, cada um com **borda-esquerda colorida** pela banda + ponto; hover mostra o rationale. Editar volta ao textarea.
- **Debounce ~700ms** ao digitar → `/api/quality` (nativo/rápido). Cache no cliente por hash de conteúdo (evita recomputar).
- Paleta por banda (alinhada ao tema cyan/teal existente): ruim `rose` · aceitável `amber` · bom `sky` · muito bom `teal` · excepcional `cyan` (glow sutil).
- Acessibilidade: cor + rótulo textual (nunca só cor); `title`/aria nos pontos.

Util novo `lib/quality/segment.ts` (segmentação de parágrafos no cliente, espelhando o Python) e `lib/quality/types.ts` (tipos compartilhados).

## 7. Provider NILC-Metrix + nativo

- `metrics/nilc.py`: cliente HTTP para uma instância NILC-Metrix (`NILC_METRIX_URL`), com `/health` check e timeout. Mapeia a saída (200 métricas) → feature-set normalizado (flesch, coesão/LSA, sintaxe, lexical).
- `providers.py`: por métrica, **prefere NILC** quando disponível; **nativo** preenche o que falta (citações ABNT, flags) e serve de fallback total.
- **Licença/infra:** NILC-Metrix é **AGPLv3** e roda como serviço separado (PostgreSQL + ~2GB). Nosso código **não** o embute (chama por HTTP), então nosso código não vira AGPL; o usuário sobe o container (documentado no README + `docker-compose` opcional). Consistente com `abnt-service`/`research-engine` rodando localmente.
- Testes do cliente NILC usam **mock httpx** (não exigem o container).

## 8. Estratégia de testes

**Python (pytest, espelha `research-engine/`):** `conftest.py` (sys.path), `tests/`:
- `test_segmentation.py`: parágrafos/sentenças PT (abreviações, quebras).
- `test_native_metrics.py`: Flesch-BR em textos-âncora de legibilidade conhecida; MTLD; regex de citação ABNT; contagem de sílabas pyphen; flags.
- `test_scorer.py`: **fixtures de parágrafos-âncora** rotulados (ruim/aceitável/bom/muito bom/excepcional) — afirma que as bandas saem na ordem correta (monotonicidade do ranking), que introdução sem CARS perde banda, que faixa-ótima de Flesch penaliza extremos.
- `test_providers.py`: NILC mockado vs nativo; fallback quando NILC_METRIX_URL ausente/erro.
- `test_models.py`: validação Pydantic.
- `test_api.py`: FastAPI `TestClient` em `/health` e `/score`.

**TS (vitest):** `app/api/quality/route.test.ts` (mock fetch upstream: ok, 503 offline, 401 sem sessão) e `lib/quality/segment.test.ts` (paridade de segmentação com o Python). Suíte `npm test` deve ficar verde.

## 9. Entrega / deploy

- Implementação no branch; **vitest + pytest verdes**; depois **PR para `main`** (fluxo do usuário; `main` → deploy em www.zaeon.space). Sem merge direto.
- Novos env: `QUALITY_ENGINE_URL` (default `http://localhost:8003`), `NILC_METRIX_URL` (opcional). Adicionar a `.env.example` do serviço + documentar.
- `quality-engine/README.md`: como rodar (`uvicorn main:app --port 8003`), como subir NILC opcional, contrato.
- `package.json`: nada obrigatório; (opcional) script `dev:quality`.

## 10. Riscos e mitigação
| Risco | Mitigação |
|---|---|
| NILC-Metrix pesado/indisponível em prod | Provider nativo sempre disponível; NILC é "melhoria", não dependência dura. |
| `<textarea>` não decora inline | Trilha via "Modo Revisão" renderizado + painel; declarado. |
| Bandas calibradas demais/de menos | Fixtures-âncora travam a **ordem** das bandas; limiares versionados e ajustáveis; canal de flags isolado. |
| Falsos positivos de IA | Flags nunca entram na nota; rótulo "⚠ revisar" + texto explicativo. |
| Latência ao vivo | Nativo rápido + debounce + cache por hash; NILC só no "profundo". |
| Português: libs validadas em inglês | Flesch-BR (Martins) + NILC para o núcleo PT; resto declarado como adaptação. |

## 11. Referências
- Gartenberg et al. 2026, _Organization Science_ — DOI 10.1287/orsc.2026.ed.v37.n3.
- Alsudais 2025, _Journal of Informetrics_ 19(3):101679 (arXiv 2506.21825).
- Kobak et al. 2025, _Science Advances_ (arXiv 2406.07016); Geng & Trotta 2024 (arXiv 2404.08627).
- Martins et al. 1996 — Flesch para PT (ICMC-USP). NILC-Metrix: Leal et al. 2023, _LREV_ (github.com/nilc-nlp/nilcmetrix). Coh-Metrix-Port (NILC/USP).
- McCarthy & Jarvis 2010 (MTLD). Lu 2010 (L2SCA). Swales 1990/2004 (CARS). Hyland 2005 (metadiscurso). AAC&U Written Communication VALUE Rubric.
