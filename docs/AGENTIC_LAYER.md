# CAMADA AGÊNTICA — Tutores de IA por domínio (fonte única)

> 2º doc canônico (par de `HARNESS_PLAN.md`). O harness é o **motor**; a camada agêntica são os
> **tutores**: agentes que se aprofundam num domínio muito além do chat stock (o genérico que todo
> usuário tem). Cada tutor tem comportamento específico da área + habilidade de **criar artefatos,
> planos de aula, etc.** Roda EM CIMA do harness, sem reescrevê-lo. Modo criativo, 2026-09 (Fable).
> Encarna o §9 do `AURA_AGENTIC_LAYER_PLAN.md` (StudentAgent/persona por curso) como **produto**.

---

## 0. Correção honesta da hipótese (você pediu)

> Sua frase: *"essa camada usará o harness mais do que tudo para armazenar contexto específico de
> cada usuário e cada tópico."*

**Parcialmente certo — memória é UM pilar, não o todo.** A memória (contexto por usuário + por tópico)
é o que dá **continuidade e profundidade ao longo do tempo** — essencial, sim. Mas a **especialização**
(o que faz o tutor ser mais fundo que o chat stock) vem de **quatro pilares combinados**, todos rodando
no mesmo `runTrajectory`:

1. **Persona / cérebro de domínio** — um perfil "pensa como especialista sênior" (padrão `AGENTS.md`)
   injetado no system prompt. É isto que muda o *comportamento*, não a memória. Chat stock = generalista;
   tutor = a voz e o rigor da área.
2. **Skills & fontes escopadas** — só as ferramentas/bancos daquela área (química→PubChem/3Dmol;
   história→timeline/fontes; CS→code/Mermaid). A "profundidade factual" mora aqui.
3. **Memória escopada** — L3 com `wing = domínio/usuário`, `room = tópico`. **Seu ponto** — o que
   personaliza e acumula por aluno e por assunto.
4. **Rigor + geração de artefatos/planos de aula** — o laço do harness produzindo entregáveis
   estruturados (aula, artefato, revisão) no padrão de qualidade (§8.7).

**Resumo:** memória é o motor de *continuidade*; a *profundidade* vem de persona + skills/fontes. O
harness é o motor que roda os quatro. A camada agêntica **parametriza** o harness (via `AgentContext`),
não cria um segundo motor.

---

## 1. Referências-base (a "lista de repositórios", em seu respectivo lugar)

Organizadas pelos seus três eixos. Todas permissivas. Detalhe estrutural em `HARNESS_PLAN.md §6`.

### 🧠 ESTRUTURAL — como o agente pensa, age e renderiza
| Repo | Papel |
|---|---|
| `awesome-harness-engineering` | laço ReAct, guardrails, reasoning-sandwich |
| `SakanaAI/AI-Scientist` (+v2) | pipeline por estágios + crítico/reflexão |
| `LangGraph` | estado tipado + checkpoint/retry |
| `vercel/ai` (AI SDK) · `tambo-ai/tambo` | **generative UI** — modelo emite → componente inline (base dos artefatos) |
| `smolagents` / `OpenHands` | error-as-observation |
| `3Dmol.js` · `Mermaid` · `Chart.js` · `KaTeX` | renderizadores dos artefatos (molécula/diagrama/gráfico/fórmula) |

### 📚 FACTUAL — de onde vêm fatos e citações reais (nunca inventar)
| Repo/API | Cobre |
|---|---|
| `openags/paper-search-mcp` | arXiv · PubMed · bioRxiv |
| `genomoncology/biomcp` | PubMed/PubTator · ClinicalTrials · variantes (med/bio) |
| `oksure/openalex-research-mcp` | OpenAlex (240M works, citações) |
| `pvliesdonk/scholar-mcp` | Semantic Scholar · OpenAlex · patentes |
| **PubChem PUG-REST** · **RCSB PDB** | estrutura de moléculas/proteínas (química/bio) |
| K-Dense `paper-lookup` / `database-lookup` | 100+ bancos científicos |
| open-science connectors | FRED (economia) · Open-Meteo (clima) · USGS · Materials Project · space-weather |

### 🧬 CONTEXTUAL — o que personaliza e aprofunda (memória, persona, integridade)
| Repo | Papel |
|---|---|
| `MemPalace` | memória verbatim wing/room/drawer (a base do nosso L3) |
| K-Dense `scientific-agents` | 503 perfis `AGENTS.md` → personas de domínio dos tutores |
| K-Dense `science-superpowers` | pré-registro, red-team, verify-before-claiming (rigor) |
| `NousResearch/hermes-agent` | modelo de usuário + skill auto-autorada |
| `ai4s-research/open-science` | provenance + grading de evidência (auditável) |
| `mem0` · `Letta` · `Zep/Graphiti` | refinamentos de curadoria/recall da memória |

### 🎓 PEDAGÓGICO — COMO o tutor ensina e estrutura o aprendizado (adições do Martinez)
| Repo | Licença | Papel / mecanismo transferível |
|---|---|---|
| `24kchengYe/human-skill-tree` | **AGPL-3.0** (app) · skills MIT/AGPL | **A árvore de habilidades**: fases 0→6 (aprender-a-aprender → K-12 → universidade → pós/pesquisa → carreira), com eixos teoria/experimental/prático; **desbloqueio por maestria** (quiz → KP mastery → libera nós); guardrails de ciência do aprendizado (Socrático = dica, não resposta; repetição espaçada; recall ativo; Bloom). App usa React Flow p/ a árvore, Mermaid/KaTeX no whiteboard. **⚠️ ver alerta AGPL abaixo.** |
| `HKUDS/DeepTutor` | (checar — HKU) | tutoria **personalizada vitalícia** p/ assuntos complexos; conectável via MCP → referência de personalização/continuidade profunda |
| `princeton-nlp/LM-Science-Tutor` | MIT | **TutorEval** (como AVALIAR um tutor: nota vs "key points" de especialista por LLM-judge) + **TutorChat** (padrão de diálogo professor-aluno, grounding em capítulo). Referência de rigor pedagógico + eval; modelos são Llemma (não usar — somos Gemini) |

> **⚠️ ALERTA DE LICENÇA (AGPL-3.0 no `human-skill-tree`):** o **app** é AGPL — copiar o *código do app* obrigaria a abrir a Zaeon inteira sob AGPL. **NÃO** copiar código do app. As `skills/` são dual MIT/AGPL → utilizáveis, e o **padrão/ideias** (árvore, KP mastery, guardrails) são livres. Postura: roubar a **estrutura e a pedagogia**, implementar nativo (como MemPalace). Igual à nossa regra de sempre.

---

## 2. O que é um Tutor (modelo)

Um tutor = **configuração** sobre o harness. Estende o `StudentAgent` (§9.5 do plano):
```
Tutor = {
  id, name, emoji: "⟁",
  domain,                 // "quimica" | "historia" | ...
  personaId,             // perfil AGENTS.md-style do domínio (o "cérebro")
  forgedSubjects: [],    // os assuntos em que foi "forjado" (produção — §5)
  enabledSkills: [],     // fontes+artefatos da área (ex.: pubchem, molecule3d, timeline)
  memoryWing,            // escopo da memória L3 (domínio) — contexto por usuário+tópico
  academicMode,          // rigor da área (enforced em pesquisa; flexible em estudo)
  signatureArtifacts: [] // o que ele CRIA bem (molécula, aula, prova, mapa…)
}
```
No runtime: o `AgentContext` carrega esse conjunto; o `runTrajectory` roda com ele; o `IntentRegistry`
só libera as tools das `enabledSkills`; a memória filtra por `memoryWing`+`userId`. **Zero motor novo.**

---

## 3. Roster inicial — 15 tutores (≥13 pedidos), com assunto forjado

Nomes = codinomes honorários (editáveis). Cada um casa com as trilhas existentes (cyber/med/bio/quantic/humanities) e amplia.

| # | Tutor | Domínio | Forjado em (assunto) | Artefatos que CRIA | Bases factuais |
|---|---|---|---|---|---|
| 1 | **Kekulé** | Química / Bioquímica | estrutura molecular, reações, orgânica | molécula 3D, mecanismo, mapa | PubChem, 3Dmol, RCSB |
| 2 | **Mendel** | Biologia / Genética | célula, genoma, evolução | diagrama celular, genome track, timeline | BioMCP, RCSB |
| 3 | **Dirac** | Física / Quântica | mecânica quântica, relatividade (trilha `quantic`) | plots, derivação KaTeX, circuito | arXiv, OpenAlex |
| 4 | **Noether** | Matemática | cálculo, álgebra, provas | prova passo-a-passo, gráfico de função (KaTeX) | arXiv math |
| 5 | **Turing** | Computação / Eng. Software (trilha `cyber`) | algoritmos, arquitetura, sistemas | código, diagrama Mermaid, curva de complexidade | harness-eng, Zaeon Code |
| 6 | **Osler** | Medicina / Saúde (trilha `med`) | fisiologia, evidência clínica* | anatomia, fluxograma clínico, timeline | BioMCP (PubMed/ClinicalTrials) |
| 7 | **Heródoto** | História | linhas do tempo, crítica de fonte | timeline interativa, mapa histórico | OpenAlex, web |
| 8 | **Montesquieu** | Direito (BR) | processo, jurisprudência, constitucional | fluxograma processual, mapa de artigos | bancos jurídicos/web |
| 9 | **Keynes** | Economia / Finanças | micro/macro, modelos | gráficos (Chart.js), modelos | FRED, OpenAlex |
| 10 | **Sócrates** | Filosofia | dialética, mapa de argumento | mapa argumentativo, red-team | STORM, science-superpowers |
| 11 | **Machado** | Redação / Linguística (ENEM/vestibular) | dissertação, ABNT, retórica | estrutura de redação, correção rubricada | ScholarEval, ABNT service |
| 12 | **Ada** | Ciência de Dados / IA | ML, estatística, notebooks | plots, pipeline Mermaid, código | PaperQA2, arXiv cs.LG |
| 13 | **Hubble** | Astronomia | sistema solar, cosmologia | mapa estelar, viewer FITS | space-weather, OpenAlex |
| 14 | **Humboldt** | Geografia / Ambiental | clima, relevo, sustentabilidade | mapas, gráficos climáticos | Open-Meteo, USGS |
| 15 | **Tesla** | Engenharias (geral) | cálculo aplicado, circuitos, mecânica | plots, diagramas, KaTeX | arXiv, Materials Project |

*Osler é **educacional**, nunca diagnóstico — herda o guardrail médico (rigor + "procure um profissional").

---

## 3.5 Skill Tree por tópico — a árvore visível e gamificada (visão do Martinez)

Cada tutor **compartilha uma árvore de habilidades com o usuário** sobre o assunto — cobrindo o campo
**teórico, experimental e prático** (nível acadêmico, qualquer área). A árvore fica **anexada a cada
tópico na Sala de Estudos** e é o mapa que o aluno escala.

**Estrutura de um nó (KP = knowledge point):**
```
SkillNode = {
  id, topic, title,
  branch: "teoria" | "experimental" | "pratica",   // os 3 campos
  level,                       // profundidade (Bloom: lembrar→criar)
  prereqs: [nodeId],          // o que precisa antes (árvore de RPG)
  mastery: 0..1,              // maestria do usuário NAQUELE nó (por usuário)
  status: "locked"|"available"|"in_progress"|"mastered",
  artifacts: [StudioRef]      // o que gerar aqui (molécula/exercício/simulação)
}
```

**Mecânica de desbloqueio (do `human-skill-tree`, comprovada por ciência):**
- Um nó **desbloqueia** quando os `prereqs` atingem maestria (quiz/recall ativo → `mastery`↑ → libera o próximo). É o "avançar na árvore pra desbloquear novas habilidades" que você descreveu.
- **Guardrail pedagógico (crítico — PNAS 2025):** o tutor dá **dica, não resposta** (Socrático); usa **repetição espaçada** e **recall ativo**. IA sem esse guardrail *piora* o aprendizado — então é regra do comportamento do tutor, não opcional.
- O tutor **sabe onde o aluno está na árvore** (via memória L3: `mastery` por KP e por usuário) e conduz pro próximo nó. É aqui que a memória é decisiva — ela guarda a posição/maestria por usuário e por tópico.

**Onde renderiza:** um painel de árvore (**React Flow**, como o repo faz) anexado ao tópico na Sala de Estudos, em liquid-glass; nós desbloqueados acendem no gradiente violeta→ciano, os travados ficam foscos. Cada nó abre a conversa scopada + o artefato daquele KP.

**Conexão com o que já existe:** o schema da Zaeon **já tem** `User.skills Json // motor do RPG acadêmico (Ranks F-SS)` — a árvore por tópico é a materialização disso por assunto. Reusa, não inventa.

## 3.6 Princípio: capacidades AMPLAS, escopadas ao domínio (reforço do Martinez)
Cada tutor tem capacidade **ampla** dentro da sua área e **fechada** fora dela. Concretamente: o
`IntentRegistry` só libera as `enabledSkills` do domínio; a memória filtra pelo `memoryWing` do domínio;
a persona é a do especialista. Fora da área, o tutor **redireciona** ("isso é com o tutor de X") em vez
de responder raso. Profundidade máxima no campo; sem virar generalista.

## 3.7 Camada Mestra (probatória) — nível doutorado, para quem LECIONA

> Visão do Martinez: uma **camada probatória** de especialização **nível doutorado**, para
> **professores** (não só estudantes). Um **plugin de professor** que passa pelo funil das 3 camadas e
> é uma **feature desbloqueável na Plugin Store**, como os agentes.

**A simetria do sistema:** o aluno **sobe** a skill tree (aprende → desbloqueia); o professor **prova**
maestria e é **certificado** (examina → certifica). Mesma pedagogia, direções opostas.

**O funil (3 camadas):**
```
  entrada do professor
        │
   ① Camada Harness   → o motor (raciocínio tipado, crítico, provenance)
        │
   ② Camada Agêntica  → escopo de domínio (persona sênior + skills + memória + skill tree)
        │
   ③ Camada Mestra    → RIGOR DOUTORADO + EXAME PROBATÓRIO (TutorEval) → certificação
        │
   agente especialista certificado → publicável/desbloqueável na Plugin Store
```

**A camada probatória = motor TutorEval** (`princeton-nlp/LM-Science-Tutor`, MIT): dado um domínio, roda
um **exame** — perguntas de especialista + um **LLM-juiz** que nota a resposta contra *key points* de
referência (open-book/closed-book). É o `examiner`/ScholarEval que já temos, **elevado ao nível doutorado**
(`academicLevel: "doutorado"`, rubrica cheia, limiar alto). Passar no exame = **certificação**.

**O que é certificado (e a honestidade sobre "o modelo do próprio usuário"):**
- **Viável hoje:** o **agente especialista do professor** — um `MasterAgent` (extensão do `StudentAgent`
  §9.5) com persona doutorado + domínio + memória + rigor. Ele passa pela camada probatória; se atinge o
  limiar TutorEval, é **certificado** e fica **desbloqueável na Plugin Store** pros alunos usarem. O
  "modelo do próprio usuário" = **o agente que o professor forja e afina**, não um LLM re-treinado.
- **"Se fosse possível" (fine-tuning real por usuário):** treinar um modelo Gemini dedicado por professor
  **não** é viável na stack atual (Gemini único, sem infra de tuning). O caminho realista de
  "personalização do modelo" é: persona + memória + exemplos aprovados (few-shot) + a skill auto-autorada
  (lição Hermes). Tuning de verdade fica como item de pesquisa/infra futura (Vertex tuning) — sinalizado,
  não prometido.

**Onde encaixa no que já existe:**
- **Área do professor / Sala de Aula** já existe (models/rotas — ver docs de teacher area). A camada
  mestra é o "estúdio de forja + certificação" dentro dela.
- **Gating:** feature desbloqueável na Plugin Store, **gated por role professor** (reusa roles/founder
  já existentes) + plano. Como os agentes da camada agêntica.
- **Entregável do professor:** além do agente certificado, ele gera **provas/planos de aula/rubricas**
  nível doutorado (o `criar_trabalho` kind `aula` + as review skills, com rigor `enforced`).

**Contrato (esboço):**
```
MasterAgent = StudentAgent & {
  tier: "master",
  academicLevel: "doutorado",
  certification?: { domain, tutorEvalScore, decision:"aprovado"|"revisar", at, examinerVersion },
  publishable: boolean            // vira card na Plugin Store quando certificado
}
```
Regra: **nada é publicado sem passar na camada probatória** (score ≥ limiar doutorado). Anti-"professor
IA raso". A certificação carrega `provenance` (auditável, open-science) — dá pra ver *como* foi certificado.

**Loop fechado (a memória é o combustível):** o professor **ensina o agente** nas interações (aulas,
correções, materiais) → vira **memória L3** do agente → o exame **lê a memória mas NOTA a resposta**
(TutorEval: output vs key points de especialista) → passa/não passa. É aqui que a memória é central de
verdade (a intuição original do Martinez se realiza na camada mestra).
**Anti-trapaça:** exame usa perguntas **held-out / closed-book** (não as que o professor "treinou") →
certifica **generalização**, não decoreba. **Evolutivo:** memória cresce a cada aula → o agente re-faz o
exame e sobe de nível (ou a certificação re-valida periodicamente) — o espelho da skill tree, do lado do agente.

## 3.8 Roster de LANÇAMENTO — 12 Tutores (cursos + comuns das públicas BR)

Grounded em dados de procura/matrícula (Direito, Medicina, Psicologia, Pedagogia, Enfermagem,
Administração, TI lideram) + a força das públicas em saúde/licenciaturas/engenharias. Nomes = codinomes
honorários, **editáveis**. Cada tutor reusa uma persona de domínio (§3 / K-Dense `AGENTS.md`).

| # | Curso | Tutor | Forjado em | Artefatos que cria | Fontes-base |
|---|---|---|---|---|---|
| 1 | **Medicina** | Osler | fisiologia, semiologia, farmacologia, evidência clínica* | anatomia, fluxograma clínico, caso | BioMCP (PubMed/ClinicalTrials), RCSB |
| 2 | **Enfermagem** | Nightingale | cuidado, procedimentos, farmacologia, saúde pública | checklist de cuidado, cálculo de dosagem, fluxo | BioMCP, PubMed |
| 3 | **Odontologia** | Fauchard | anatomia dental, patologia oral, materiais | diagrama, caso clínico | PubMed |
| 4 | **Farmácia** | Kekulé | farmacologia, química medicinal, mecanismo de ação | **molécula 3D**, mecanismo, mapa | PubChem, 3Dmol, BioMCP |
| 5 | **Direito** | Montesquieu | constitucional, civil, penal, processo (BR) | fluxograma processual, mapa de artigos, peça | bases jurídicas/web |
| 6 | **Psicologia** | James | teorias, psicopatologia, métodos | mapa conceitual, caso | OpenAlex, PubMed |
| 7 | **Pedagogia** | Paulo Freire | didática, currículo, avaliação, aprendizagem | **plano de aula**, rubrica, mapa | learning-science (skill tree) |
| 8 | **Administração** | Drucker | gestão, finanças, marketing, estratégia | modelo, gráfico, case | FRED, OpenAlex |
| 9 | **Ciências Contábeis** | Pacioli | contabilidade, custos, tributário | planilha, demonstrativo, exercício | dados |
| 10 | **Engenharia Civil** | Eiffel | estruturas, cálculo, materiais, hidráulica | diagrama, plot, derivação KaTeX | arXiv, Materials Project |
| 11 | **Ciência da Computação** | Turing | algoritmos, estruturas de dados, sistemas, IA | **código**, Mermaid, curva de complexidade | harness-eng, Zaeon Code |
| 12 | **Nutrição** | Lavoisier | bioquímica nutricional, dietética, saúde pública | tabela nutricional, via metabólica, molécula | PubChem, PubMed |

*Osler é **educacional**, nunca diagnóstico (guardrail médico: rigor + "procure um profissional").
**Banco de reserva (trocáveis):** Fisioterapia, Arquitetura e Urbanismo, Agronomia, Veterinária, Economia, Biomedicina, Ciências Biológicas.

## 3.9 O entregável: agente PLUGÁVEL por conta + a experiência de plugar no chat

> Requisito do Martinez: o entregável final são **agentes plugáveis (por conta)** que **qualquer usuário**
> pode usar — mas passando pela **experiência de plugar** o agente no chat (como conectar um conector).

**A experiência (o "plug"):**
1. Usuário abre **Plugins → categoria Tutores** → grade de cards (liquid glass) dos 12.
2. Clica **"Plugar no chat"** num tutor → micro-fluxo de conexão (confirma; mostra o que ele faz/gera; estado "plugando… → plugado ✓") — deliberado, não auto-on. É o mesmo ritual de conectar um conector.
3. O tutor entra no **roster DAQUELA conta** e passa a aparecer no **seletor ⟁** do chat (a pill "⟁ Aura" vira "⟁ Aura ▾" com os tutores plugados).
4. No chat, selecionar o tutor **ativa** persona + skills escopadas + wing de memória **daquele usuário**. Trocar de tutor = trocar o `AgentContext` (mesmo `runTrajectory`).

**Por conta (multi-tenant):** cada usuário pluga os seus; a **memória é escopada por usuário** (`wing = curso/userId`) — o tutor de um aluno lembra do aluno, não vaza entre contas. Desplugar remove do seletor (memória fica, inerte).

**Modelo de dados (estende `StudentAgent` §9.5):**
```prisma
// catálogo (os 12 templates, global):
model TutorTemplate { id String @id; slug String @unique; course String; name String; personaId String;
  enabledSkills String[]; signatureArtifacts String[]; sources String[]; emoji String @default("⟁") }
// instância plugada POR CONTA:
model PluggedTutor { id String @id @default(auto()) @map("_id") @db.ObjectId; userId String @db.ObjectId;
  templateId String; pluggedAt DateTime @default(now()); enabled Boolean @default(true)
  @@unique([userId, templateId]) @@index([userId]) }
// User: activeTutorId String?  (qual está ativo no chat)
```
No runtime: plugar cria um `PluggedTutor`; o seletor ⟁ lista os `enabled` do usuário; ativar seta `activeTutorId` → o `AgentContext` carrega `{persona, enabledSkills, memoryWing}` do template. Reusa 100% o harness.

**Gate do entregável:** qualquer usuário abre Plugins → Tutores, **pluga** um dos 12 (vê o ritual de conexão), ele aparece no seletor ⟁ do chat, e ao conversar responde com a voz+skills do domínio, com memória só daquela conta. Desplugar tira do seletor.

## 4. A seção "Tutores" na navbar (entregável navegável)

**Onde:** dentro de **Plugins** (a atual Sala de Skills/Plugins), uma **categoria nova "Tutores"** —
de forma simples, aditiva, sem trocar nada existente (política: UI nova = opt-in, mantém o ⟁).

**Entregável navegável (visualmente fiel ao `liquid-glass-style-reference`):**
- **Grade de cards de tutor** — cada card em vidro líquido: fundo `rgba(22,22,34,0.55)`, `backdrop-filter: blur(40px) saturate(180%)`, borda `1px rgba(255,255,255,0.12)`, raio `22px`, sombra `0 40px 100px -30px rgba(0,0,0,0.85)` + highlight `inset 0 1px 0 rgba(255,255,255,0.10)`.
- **Card:** ⟁ + nome, chip do domínio (gradiente `#8b5cf6→#22d3ee`), 1 linha "forjado em…", 2-3 chips de artefatos que cria, CTA **"Conversar"** (botão primário: `linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06))` + glow violeta).
- **Conversar** → abre a Sala com aquele tutor ativo (persona + skills + wing de memória) — é o `runTrajectory` parametrizado. A pill "⟁ Aura" da barra vira seletor do tutor ativo.
- **Estado:** cada card mostra se o tutor está **pronto** (persona+skills carregados) — nada de "acha que está plugado" (paridade §9.11).

**Fase 1 (este entregável): navegável e fiel — os 15 cards renderizam, "Conversar" abre a sala scopada.**
A profundidade factual completa (todas as fontes MCP vivas) entra por trás, incremental.

---

## 5. Produção — como cada assunto é "forjado" num agente

"Forjar" um tutor = 4 arquivos/config por agente, não código novo:
1. **Persona (`personaId.md`)** — perfil AGENTS.md-style do domínio (derivado dos 503 da K-Dense, em PT-BR de graduação, adaptado ao `academicLevel`). É o cérebro.
2. **Skills default** — a lista `enabledSkills` da área (fontes factuais + artefatos assinatura da tabela §3).
3. **Fontes contextuais curadas** — os bancos/MCP daquela área (ex.: Kekulé→PubChem/RCSB; Osler→BioMCP).
4. **Rigor** — `academicMode` + guardrails específicos (ex.: Osler não diagnostica; Machado segue ABNT).

Decisão de produção pendente (com você): **congelar a lista dos 15 assuntos** acima (ou ajustar) e a
ordem de "forja". Sugiro forjar primeiro os que casam com trilhas existentes e têm artefato "uau"
pronto: **Kekulé (molécula 3D), Turing (código/Mermaid), Noether (KaTeX), Heródoto (timeline)**.

---

## 6. Como roda no harness (o seam, uma tela)
```
usuário abre Tutor Kekulé → AgentContext = {persona:quimica, skills:[pubchem,molecule3d,mapa],
  wing:"quimica/<userId>", academicMode:flexible} → runTrajectory (mesmo motor) →
  gather usa SÓ as skills de química → draft preenche StructuredAnswer + artifacts:[{kind:"molecule3d",name:"caffeine"}]
  → memória grava no wing "quimica" (contexto por usuário+tópico) → render inline (Fatia A do harness)
```
Nada aqui é motor novo: é `AgentContext` + `enabledSkills` + `memoryWing` + persona.

## 7. Entregável / DoD (2 .mds + a seção)
- [ ] `HARNESS_PLAN.md` (motor) e `AGENTIC_LAYER.md` (este) = os 2 docs canônicos. ✅
- [ ] Categoria **Tutores** em Plugins, liquid-glass, ≥13 cards navegáveis.
- [ ] Cada card abre a Sala com o tutor scopado (persona+skills+wing) via `runTrajectory`.
- [ ] Lista dos 15 assuntos congelada com o Martinez (produção).
- [ ] Ordem de forja definida (sugestão: Kekulé, Turing, Noether, Heródoto primeiro).
- [ ] Depende de: Fatia A do harness (render `artifacts[]` inline) — sem ela, o "uau" do tutor não aparece.

## 8. O que NÃO é (evitar escopo errado)
Não é um motor separado do harness. Não é só memória. Não é 15 chatbots com prompt diferente — é o
harness parametrizado por domínio (persona+skills+memória+rigor), com artefatos reais e planos de aula.
