# Modelos da Contabo nos papéis do chat (lib/llm/papeis)

Os modelos da Contabo (CPU, sem GPU) fazem o trabalho em que **ninguém espera a resposta**. A resposta
que o aluno vê em streaming continua no Google (Vertex global + gemini-3.5-flash).

**Desde 2026-10-22 o único modelo local de texto é o LFM2-8B-A1B** (Liquid AI, MoE ~1,5B ativos, 5 GB). O dono
testou o Qwen3 30B no chat e achou lento e pesado; o LFM2 é ~3× mais rápido na CPU. Saíram da Contabo: qwen3 4B
(thinking e instruct), qwen3 30B, gpt-oss-20b, llama-guard (a moderação saiu do chat no #535). Ficam: LFM2, qwen3-coder
(Octa) e o TEI (embedding + rerank do RAG).

| papel | modelo local (gateway) | onde roda | fallback Google | flag (`0` desliga) |
|---|---|---|---|---|
| `curto` | `zaeon-local-lfm2` | gatekeeper do cérebro (zona cinzenta) e juiz da árvore (tentativas ≥ 6 palavras) — fire-and-forget | `GEMINI_MODEL` (flash) | `LOCAL_CURTO` (`LOCAL_CURTO_MODELO` troca o grupo) |
| `artefato` | `zaeon-local-lfm2` | artefatos da conversa em segundo plano (comando `/`) | flash | `LOCAL_ARTEFATO` (`LOCAL_ARTEFATO_MODELO`) |

**Comparativo 2026-10-22** (mapa mental em JSON a partir de uma conversa de ~400 tokens, `num_thread 8`, sem cache):

| modelo | lê | escreve | mapa pronto | JSON |
|---|---|---|---|---|
| **LFM2-8B-A1B** | 74 tok/s | 15 tok/s | ~32 s (+24 s de carga, 1×) | válido, fiel |
| Granite-4.0-H-Tiny | 53 tok/s | 11 tok/s | ~42 s | válido, mas `"título"` com acento (fora do formato) |
| Qwen3 30B-A3B | 31 tok/s | 5–8 tok/s | ~69 s (+122 s de carga) | válido |

LFM2 nos prompts do papel curto (pela VPS): 4–10 s; acerta explicação certa (0,95) e erro conceitual (0,3), mas deu
domínio total a uma pergunta curta e chamou "horário da biblioteca" de estudo — os filtros antes da chamada (zona
cinzenta do gatekeeper, ≥ 6 palavras no juiz) seguram esses casos. Laya (decisão, ModernBERT) testado e descartado:
intenção 7/8 em português, mas 0,8–7,6 s na nossa CPU e o juiz não distingue sem ajuste fino.

## Histórico (antes do LFM2)

## Medido pelo gateway da VPS (2026-10-21, de dentro do `zaeon_web`)

| modelo | frio (1ª) | quente (2ª) | obs. |
|---|---|---|---|
| llama-guard3 (`safe`, prompt 216 tok) | TTFT 51,7 s | **0,6–0,8 s total** | 2 tokens de saída |
| gpt-oss-20b, gatekeeper JSON, effort low | 120,8 s | **17,0 s** | 48 car. pensando + 41 tok; JSON certo |
| gpt-oss-20b, juiz JSON, effort low | — | **16,8–23,2 s** | 139 car. pensando + 80 tok; score 0,9 |
| gpt-oss-20b, texto livre (200 tok) | TTFT 112 s, 142 s | TTFT 0,9 s, 36 s | 5,2–5,7 tok/s |
| **qwen3:4b-instruct-2507** (2026-10-22), gatekeeper JSON | 27,3 s | **2,9 s** (pelo app: 4,2 s) | JSON certo, 0 raciocínio |
| **qwen3:4b-instruct-2507**, juiz JSON | 17,1 s | **12,5–17 s** | score 0,9–1 |
| **qwen3:30b-a3b-instruct-2507** (2026-10-22), gatekeeper / juiz / resumo | load ~19 GB | **2,4 s / 14,9 s / 7,4 tok/s** | JSON certo; português melhor que o 4B |
| qwen3:4b (thinking-2507) | TTFT 25 s | 10,6 s p/ 60 tok, **só pensamento** | 700 tok sem JSON em 133–175 s com think:false / reasoning_effort none / nada |

**qwen3 4B:** o `qwen3:4b` do Ollama é o build thinking-2507 (contexto 262k), que pensa sempre. Desde 2026-10-22 a
Contabo tem o `qwen3:4b-instruct-2507-q4_K_M` e o `qwen3-4b` do litellm-config aponta pra ele (backup do config
antigo em `/opt/zaeon-models/litellm-config.yaml.bak-20261022-pre-instruct`). O `.env` da VPS tem
`LOCAL_CURTO_MODELO=zaeon-local-mini` desde então (redundante depois deste PR; backup `.env.bak-20261022-pre-local-curto`).

**Memória da Contabo (2026-10-22):** Ollama 56 GB, 4 modelos, `KEEP_ALIVE=6h` (era 42 GB / 3 / 30 min — a moderação
quase sempre pegava o modelo frio). Gargalo real na CPU é LER o prompt (~20–26 tok/s), não gerar.

**Memória da Contabo (antes):** Ollama com `mem_limit 42g`, `MAX_LOADED_MODELS=3`, `KEEP_ALIVE=30m` (o 24h do gpt-oss saiu
no #498). coder do Octa (18 GB) + gpt-oss (13 GB) + guard (5,6 GB) cabem juntos nos 3 slots; o qwen3:4b fora do
uso libera o slot. Ocioso > 30 min = frio. Por isso os tetos (guard 90 s, curto 150 s) e `maxEmVoo` 2/1.

**Fora do caminho crítico de propósito:** `classify` (intenção, antes de cada turno, teto 8 s), `planQuery`
(12 s), plan/reason do harness (15 s). Mesmo o melhor quente do gpt-oss (17 s) não cabe; e com NUM_PARALLEL=1
um timeout deixa o request rodando no Ollama e enfileira o próximo. Consolidação de memória não existe como
chamada de LLM (é verbatim + embedding), então não há tarefa longa de bastidor no chat pra dar ao gpt-oss.

## Como funciona

- `gerarPapel(papel, req)` tenta o grupo `zaeon-local-*` no gateway da VPS com a key `GATEWAY_KEY_LOCAL`
  (ou `GATEWAY_MASTER_KEY`). Erro, timeout, resposta vazia/ilegível, flag desligada ou papel ocupado
  (`maxEmVoo` por processo) → o MESMO pedido no Vertex com um modelo de verdade.
- O envelope não cai mais no Vertex com o nome `zaeon-local-*` (ele não existe lá): relança e o papel escolhe.
- Ledger (TokenLedger): a tentativa local grava `alvo: "contabo"` (custo 0); o fallback grava `alvo: "vertex"`.
  `phase` = `guarda` | `gatekeeper` | `assess`.
- Desligar sem build: `LOCAL_GUARDA=0` / `LOCAL_CURTO=0` no `.env` da VPS + `docker compose up -d web`.

## Provar em produção

```
docker exec zaeon_web npx tsx scripts/provar-papeis-locais.ts --medir
docker exec zaeon_web npx tsx scripts/provar-papeis-locais.ts --papeis
docker exec zaeon_web npx tsx scripts/provar-papeis-locais.ts --papeis --forcar-falha
```

`--medir` dá TTFT / total / tok/s por modelo (2 chamadas, a 1ª pode ser fria); `--papeis` chama as funções
reais e relê as linhas do ledger; `--forcar-falha` troca a key local por uma inválida → todas em `alvo=vertex`.
