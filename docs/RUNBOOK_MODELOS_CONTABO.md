# RUNBOOK — Anexo de modelos da Zaeon na Contabo (executor: Claude Code)

**Host:** Contabo `95.111.241.175` (Ubuntu 24.04, 18 CPU / 94 GB / 439 GB livres).
**Inquilino a proteger:** projeto Docker `zenith-adapter` (adapter whatsmeow + adapter_db + bridge-redis) nos núcleos 0–3. **evogo foi descontinuado** nesta box.
**O que subir:** projeto `zaeon-models` (Ollama + TEI embeddings + TEI reranker + pgvector + LiteLLM), **preso nos núcleos 4–17**, modelos locais grátis (baixados do HF), servidos por **uma URL OpenAI-compatible (LiteLLM)** acessível só por rede privada.
**Arquivos:** `infra/zaeon-models/docker-compose.zaeon-models.yaml`, `litellm-config.yaml`, `.env.example`.

---

## ⚠️ REGRAS DE OURO (ler antes de qualquer comando)
1. **NUNCA** rodar comando Docker global nesta box (`docker stop $(docker ps -q)`, `docker system prune -a`, `docker kill`, `docker compose down` sem `-p`). Isso mataria o adapter da chipflow.
2. **SEMPRE** escopar no projeto: `docker compose -p zaeon-models -f infra/zaeon-models/docker-compose.zaeon-models.yaml <cmd>`.
3. **NÃO** tocar nos projetos `zenith-adapter` nem em nginx/WireGuard do host.
4. Trabalhar numa pasta própria (ex. `/opt/zaeon-models/`), com `.env` fora do git.
5. Observar o adapter antes/depois de cada passo (§6). Qualquer jitter nele → **parar**.

## 0. Pré-checagem (read-only, confirmar o terreno)
```bash
nproc; free -h; df -h /; uptime
docker ps --format 'table {{.Names}}\t{{.Status}}'      # ver o adapter rodando
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}'
```
Confirmar: adapter saudável, folga de CPU/RAM/disco como esperado.

## 1. Preparar arquivos + .env
```bash
mkdir -p /opt/zaeon-models && cd /opt/zaeon-models
# copiar infra/zaeon-models/ inteira pra cá (compose, litellm-config.yaml, .env.example, initdb/)
cp .env.example .env
# editar .env:
#   BIND_ADDR = IP do Tailscale desta box (`tailscale ip -4`). NUNCA 0.0.0.0, NUNCA 10.99.0.2.
#   LITELLM_MASTER_KEY = openssl rand -hex 24
#   LITELLM_SALT_KEY   = openssl rand -hex 24   (gerar 1x; trocar = perder as virtual keys)
#   ZAEON_PG_PASSWORD = openssl rand -hex 24
openssl rand -hex 24   # usar a saída nas chaves acima
```
> **Rede privada = Tailscale** (rede só da Zaeon). O WireGuard `10.99.0.0/24` é da chipflow e a Zaeon **não entra nele** (handoff §7). Instalar o tailscaled (`curl -fsSL https://tailscale.com/install.sh | sh`), `tailscale up` (o login é do dono, pelo link que ele imprime) e usar o IP `100.x` em BIND_ADDR. O `tailscale0` precisa estar UP antes do `up` do compose, senão o bind do LiteLLM falha. Quem chama o gateway (Vercel/VPS/CLIs) também precisa estar na tailnet.

## 2. Subir a infra (SEM os modelos ainda) — escopado
```bash
cd /opt/zaeon-models
docker compose -p zaeon-models -f docker-compose.zaeon-models.yaml up -d pgvector ollama litellm
docker compose -p zaeon-models -f docker-compose.zaeon-models.yaml ps
# initdb/01-zaeon.sql já criou a extensão vector (zaeon_rag) e a DB litellm no 1º boot. Conferir:
docker exec -i zaeon_pgvector psql -U zaeon -d zaeon_rag -c "\dx vector" -c "\l litellm"
```
Conferir que o adapter continua intacto (§6).

## 3. Baixar os modelos (grátis, do HF/Ollama) — ordem e `ionice`
Os LLMs vão pro Ollama; embeddings/reranker o TEI baixa sozinho no boot (passo 4).
```bash
# ⚠️ `ionice` no `docker exec` NÃO adianta: só rebaixa o cliente; quem escreve no disco é
# o servidor do Ollama dentro do container (root — sem sudo não dá pra rebaixar). O que
# protege é puxar UM por vez e vigiar o adapter entre eles. Medido no 1º deploy
# (2026-10-20): ~38 GB em 8 min, iowait 1–2%, adapter estável — ver pull-models.sh na box.
pull() { docker exec zaeon_ollama ollama pull "$1"; }

pull qwen3:4b            # ~3–4 GB  (rápido/tiny)  — confirmar tag em ollama.com/library
pull llama-guard3:8b     # ~5 GB    (moderação)
pull gpt-oss:20b         # ~16 GB   (workhorse)
pull qwen3-coder:30b     # ~18–20 GB (código)
# gpt-oss:120b → NÃO puxar agora (teste manual exclusivo; ~65 GB).
docker exec zaeon_ollama ollama list   # confere o que baixou
```
> Se algum **tag não existir** no Ollama, puxar o GGUF direto do HF: `ollama pull hf.co/<repo>:<quant>` (ex. uma var Q4_K_M). Registrar no fim qual tag/quant foi usado de fato.

## 4. Subir os serviços de embedding/reranker (TEI baixa do HF no boot)
```bash
docker compose -p zaeon-models -f docker-compose.zaeon-models.yaml up -d tei-embed tei-rerank
# 1º boot baixa Qwen3-Embedding-0.6B e bge-reranker-v2-m3 do HF (pode demorar). Acompanhar:
docker compose -p zaeon-models -f docker-compose.zaeon-models.yaml logs -f tei-embed
```

## 5. Testes de fumaça (provar que responde)
Pelo gateway (o que as interfaces vão usar) — usar a `LITELLM_MASTER_KEY`:
```bash
BASE="http://${BIND_ADDR:-127.0.0.1}:4000"; KEY="<LITELLM_MASTER_KEY>"

# 5.1 chat (workhorse)
curl -s $BASE/v1/chat/completions -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
 -d '{"model":"gpt-oss-20b","messages":[{"role":"user","content":"responda só: OK"}],"max_tokens":256}'
# (gpt-oss é modelo de raciocínio: com max_tokens baixo ele gasta tudo pensando e volta content vazio)

# 5.2 código
curl -s $BASE/v1/chat/completions -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
 -d '{"model":"qwen3-coder","messages":[{"role":"user","content":"Escreva uma função Python que soma dois números."}],"max_tokens":128}'

# 5.3 embedding (RAG)
curl -s $BASE/v1/embeddings -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
 -d '{"model":"qwen3-embed","input":"teste de embedding"}' | head -c 300

# 5.4 reranker (chamada DIRETA ao TEI, rede interna)
# (a imagem do LiteLLM não tem curl nem wget — vai de python, que ela tem)
docker exec zaeon_litellm python -c 'import json,urllib.request as u;r=u.Request("http://tei-rerank:80/rerank",json.dumps({"query":"capital do Brasil","texts":["Brasília é a capital","banana é uma fruta"]}).encode(),{"Content-Type":"application/json"});print(u.urlopen(r).read().decode())'
```
Esperado: 5.1 texto "OK"; 5.2 código; 5.3 vetor de floats; 5.4 ranking com a 1ª frase no topo.

## 6. 🩺 Vigiar o adapter (fazer antes/depois de CADA passo pesado)
```bash
docker stats --no-stream zenith_adapter zenith_adapter_db zenith_adapter_redis
uptime   # load avg: comparar com 18; se disparar durante um pull, pausar
```
Se o adapter subir de CPU/latência de forma anormal durante um passo da Zaeon → **parar o passo**, avaliar, e só seguir quando normalizar.

## 7. Medição de tok/s REAL (o veredito honesto da estante)
Medir direto no Ollama com `bench.py` (fica em `/opt/zaeon-models/`; mede `eval_count/eval_duration`):
```bash
docker cp /opt/zaeon-models/bench.py zaeon_litellm:/tmp/bench.py
docker exec zaeon_litellm python /tmp/bench.py gpt-oss:20b 8      # <modelo> <num_thread>
```
> ⚠️ **THREADS:** o Ollama conta os 18 núcleos do HOST, não o cpuset (14). Com 18 threads no cpuset 4-17 o llama.cpp se atropela na barreira: o 1º teste 5.1 levou **7 min pra 38 tokens (~0,1 tok/s)**. Por isso o `litellm-config.yaml` manda `num_thread: 8` em cada modelo (confere no log: `docker logs zaeon_ollama | grep "n_threads = "`).

**Medido no 1º deploy (2026-10-20, 8 threads, quente):**

| modelo | geração | prompt | load a frio | RAM |
|---|---|---|---|---|
| gpt-oss-20b | 6,2–6,5 tok/s | ~150 tok/s | ~41 s | 13 GB |
| qwen3-coder:30b | **8,6 tok/s** | ~125 tok/s | ~98 s | 18 GB |
| qwen3:4b | 7,3–7,8 tok/s | ~223 tok/s | 15 s | 3,2 GB |
| llama-guard3:8b | classifica em ~1 s | ~476 tok/s | 30 s | 5,6 GB |

Threads × gpt-oss-20b: 12 = 4,0 · 10 = 5,1 · 8 = 6,2 · 6 = 6,5 tok/s. Geração em CPU é limitada por **banda de memória**, não por núcleo — 8 fica no platô com load ~7 (folga pro adapter). Pico da Zaeon ~30 GB (3 LLMs + TEI×2); o Ollama evictou o LRU ao pedir o 4º, como esperado.

**Veredito:** ~6–9 tok/s serve **trabalho de fundo** (embeddings do RAG, rerank, moderação, lotes do Octa, CLIs), **não o chat ao vivo** — uma resposta de 1.000 tokens leva 2–3 min. `AI_FORCE_LOCAL=on` no app inteiro faria quase tudo estourar o `LOCAL_LLM_TIMEOUT_MS` e cair pro Gemini. Usar `generateViaLocal()` onde latência não importa.

## 8. Ligar na Zaeon (interfaces/CLIs)
No app/CLIs, setar (via `.env` de cada um):
```
LOCAL_LLM_URL=http://<BIND_ADDR>:4000/v1/chat/completions
LOCAL_LLM_KEY=<master key OU uma virtual key do LiteLLM>
LOCAL_LLM_MODEL=gpt-oss-20b
# opcional, pra rotear TUDO pro local: AI_FORCE_LOCAL=on  (cai pro Gemini se falhar)
```
O `lib/ai/router.ts` já tem o provider `local` (`generateViaLocal()` + o switch `AI_FORCE_LOCAL`). Pra cada interface nova, criar uma **virtual key** no LiteLLM (com a DB ligada) → rastreio/budget por interface.

## 9. Operação
- **Reiniciar só a Zaeon:** `docker compose -p zaeon-models ... restart` — **não** toca o adapter.
- **Derrubar só a Zaeon:** `docker compose -p zaeon-models ... down` — idem (nunca sem `-p`).
- **Liberar RAM na mão:** `docker exec zaeon_ollama ollama stop <modelo>`.
- **Backup:** volumes `ollama_models` (pesos — recupera com re-pull), `pgvector_data` (RAG — backup de verdade).

## ✅ Definição de pronto
- `zaeon-models` no ar nos núcleos 4–17, adapter intocado (0–3 livre, saudável).
- 5.1–5.4 passam; tok/s medidos e registrados.
- Gateway acessível **só pela rede privada** (BIND_ADDR), com chave.
- `lib/ai/router.ts` fala com o gateway (provider `local`), com fallback pro Gemini.
- RAM comprovadamente sob teto (Ollama evicta; `docker stats` nunca estoura).

## Resumo
Sobe `zaeon-models` (Ollama + TEI×2 + pgvector + LiteLLM) **isolado em cpuset 4–17**, com `mem_limit`/`oom_score_adj` protegendo o adapter da chipflow (0–3). Modelos baixados do HF/Ollama **de graça**; servidos por **uma URL OpenAI-compatible (LiteLLM)** só na rede privada. Testar (chat/código/embedding/rerank), **medir tok/s real**, e ligar na Zaeon via o provider `local` do router. Regra inquebrável: **nunca comando Docker global; sempre `-p zaeon-models`; vigiar o adapter a cada passo.**
