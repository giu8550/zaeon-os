# Aprender interativo no chat geral — archify · REA leve · auditoria do vídeo

> Handoff "Aprender interativo (archify + Papermorph + REA)", PR 1 de 2. O **Papermorph** (kind `aula`) vai em PR própria, como o dono pediu.
> Vale para o chat das DUAS salas (Estudos e Pesquisa): mesmos motores, rigor diferente (Pesquisa com fonte; Estudos objetivo).

## 1. Onde encaixa

O seam já existia (`docs/HARNESS_x_ARTIFACTS_ARCHITECTURE.md`): o **harness decide** e preenche `StructuredAnswer.artifacts[]`; a **camada de artefatos renderiza** pelo registry do Studio (`components/studio/StudioBlock.tsx` → views). Cada capacidade nova = um `kind` + uma regra de disparo.

**"Ligar o render inline de `artifacts[]`" (gap G1):** a Sala de Estudos já materializava `artifacts[]` na bolha (`runStudioAction`); a **Sala de Pesquisa ignorava** — agora `ResearchChat.materializarArtefatos` gera cada artefato e o coloca na MESMA bolha da resposta (com `sala: "pesquisa"`). As duas salas aceitam mais de um artefato por resposta (ex.: molécula + diagrama).

## 2. Tabela de disparo (código: `lib/agent/aprender.ts`)

| O aluno pede… | Motor | kind | Onde decide |
|---|---|---|---|
| "me explica / como funciona / quero aprender X" | **archify** | `diagram` | `artefatoDeAprender` em `resolveHarnessOutput` (intent `explicar_conceito`, ou `duvida_rapida` com frase de aprender) |
| "mapa mental / mapa de estudo / mapa conceitual de X" | **archify** (formato `mapa`) | `mindmap` → desenhado como diagrama | `pickStudioKind`; o cliente (`studioClient`) chama o archify e só cai no mapa estático antigo se falhar |
| "diagrama / esquema / fluxograma de X" | **archify** | `diagram` | `pickStudioKind` (antes caía em `image`) |
| "faz engenharia reversa de X" | **REA — modo leve** | `diagram` + diretriz no draft | `pedeEngenhariaReversa` (router → `explicar_conceito`; `DIRETRIZ_ENGENHARIA_REVERSA` no prompt) |
| "me dá uma aula sobre X" | **Papermorph** | `aula` | **PR seguinte** |
| "faz um vídeo sobre X" | `video-pipeline` (ver §5) → Papermorph quando chegar | `video` | igual a hoje |
| "podcast / quiz / molécula" | os que já existem | `podcast` / `quiz` / `molecule` | igual a hoje |
| "desenha a peça / CAD" | text-to-cad (outro handoff) | `cad` | fora deste PR |

Regras: no máximo **um** diagrama por resposta (não duplica se o modelo/pedido já trouxe mapa ou diagrama); o diagrama "de brinde" é **silencioso** se falhar (ninguém pediu); conversa, trabalho, fontes e revisão não ganham diagrama.

## 3. archify — como foi integrado

- **Motor vendorizado sem modificação** em `vendor/archify/` (MIT, commit fixado — `vendor/archify/ZAEON.md`, `NOTICE`). Zero dependência de runtime; roda como **processo Node separado** (`execFile(process.execPath, [archify.mjs, …])`) — isola o motor do servidor do Next e cabe no Docker atual (a imagem copia `/app` inteiro).
- **Pipeline** (`lib/studio/diagram.ts`):
  1. Gemini escreve o **JSON-IR** escolhendo um dos 5 tipos (workflow, sequence, architecture, lifecycle, dataflow), guiado por um exemplo **didático em PT** por tipo (`diagram-exemplos.ts`) e pelos **papéis didáticos** do `type` de cada nó (ponto de partida, etapa, reserva, regra, transformação, meio, agente externo).
  2. `normalizarIR` faz o mecânico **pelo schema do archify**: versão, saída, `locale: "pt-BR"` + catálogo de tradução da interface (`archify-pt.ts`, 278/438 chaves — o resto cai no inglês, chave a chave), ids seguros, poda de propriedades que o schema não conhece, colunas no intervalo, ligações órfãs fora, `y` das mensagens da sequência, larguras de nó estimadas pelo rótulo, grade larga no mapa.
  3. `render` + **autoReparo determinístico**: o archify reprova com sugestão exata ("rótulo maior que o nó", "set labelDy 25") e o código aplica sozinho, sem gastar modelo.
  4. `validate` mede a composição (cruzamentos, corredores). Reprovou → o **Gemini repara com os diagnósticos** (até 2×). Se ainda assim só a composição incomoda, entrega o primeiro desenho que renderizou — erro de schema nunca chega ao aluno.
- **Rota** `POST /api/studio/diagram` (background + polling, como texto/podcast), cache de 24 h por (assunto + explicação + sala + formato). O HTML vai pra `.studio/<id>.html`.
- **Segurança:** o HTML tem JS próprio. Roda em `iframe sandbox="allow-scripts …"` (sem `allow-same-origin` → origem opaca) e o `/api/studio/[id]/file` manda **CSP `sandbox`** para HTML — mesmo aberto direto numa aba, não toca cookie nem API do site.
- **Viewer** `components/studio/DiagramView.tsx`: iframe 440 px (botão pra aumentar), abrir em tela cheia, baixar o `.html` (abre offline). Dentro dele, as ferramentas do archify em PT: buscar nó, seguir um caminho, lente, tema, exportar PNG/SVG.
- **Mapa mental:** o `mindmap-layout.ts` estático fica só como **reserva** (cliente cai nele se o diagrama falhar). Aposentar depois de validar o archify em produção.

**Verificado:** 5 exemplos renderizam com o archify real (`lib/studio/diagram.test.ts`); com o **Gemini real (Vertex)** 3/3 assuntos geraram (DNS → sequence, "mapa da Revolução Francesa" → architecture, Ciclo de Krebs → workflow), ~22 s cada, 1–2 tentativas.

## 4. REA — modo leve (o que entrou e o que não)

REA exige desktop de análise (Ghidra + JDK 21 ou Hopper), CLI/MCP local — não cabe numa plataforma web educacional e tem implicação legal. Entrou só a **intenção** ("entenda e reproduza"): pedido de engenharia reversa → `explicar_conceito` + diretriz no draft (comportamento observável → mecanismo, separando fato de hipótese → recriação mínima no stack do aluno → como verificar), sem analisar binário nem contornar proteção, + o diagrama do mecanismo. **REA real (binário, via MCP, fora do web, atrás de flag)** fica como fase futura.

## 5. Auditoria do `video-pipeline` (2026-10-07)

Rodado ponta a ponta com as credenciais do `.env` local (projeto Vertex de dev):

| Etapa | Resultado |
|---|---|
| Roteiro (Gemini) | ✅ 3 cenas em ~7 s |
| Narração (Gemini-TTS) | ✅ wav de ~890 KB em ~16 s |
| Montagem (ffmpeg, args do `lib/studio/video.ts`) | ✅ mp4 h264/aac 1280×720 de 38 s (testado com ffmpeg 6; o Dockerfile instala ffmpeg) |
| Imagem por cena (Imagen) | ❌ **404 em todos os modelos** (`imagen-4.0-generate-001`, `-fast-`, `imagen-3.0-*`) — o projeto não tem acesso ao Imagen. Sem imagem a cena é pulada → "Nenhuma cena pôde ser gerada". |
| Pedido **pelo chat** | ❌ **nunca funcionou**: a rota exigia material no estudo, mas o chat cria um estudo VAZIO pelo tópico → 400 → o cliente engole calado. O podcast tinha o mesmo defeito. |

**Consertado aqui (barato):** podcast e vídeo aceitam o **tópico da conversa** quando o estudo está vazio (mesma regra do `text-pipeline`, marcado `doTopico`), e o cliente passa a mandar o tópico. → **Podcast pelo chat passa a funcionar.**

**Veredito do vídeo:** não investir no slideshow. Depende de habilitar o Imagen no projeto de produção (ação do dono: Model Garden do Vertex, ou setar `IMAGEN_MODEL` pra um modelo liberado) — e mesmo funcionando é um slideshow. O substituto é a **aula (Papermorph)**; quando ela entrar, "faz um vídeo sobre X" passa a abrir a aula. O kind `image` usa o mesmo Imagen e está igualmente afetado no projeto de dev.

## 6. Pendências / não verificado

- Não testado logado no app com Mongo real (a rota grava `StudioArtifact`); o pipeline foi testado direto com o Gemini real.
- `/m` (mobile) não materializa `artifacts[]` — fora deste PR.
- Custo: cada explicação dispara 1–3 chamadas Flash extras (IR + reparos) — cache de 24 h por assunto mitiga; se pesar, restringir o disparo a `explicar_conceito` com modo `elaborated`.
- Imagen no projeto de produção: confirmar acesso (vídeo e `image` dependem dele).
