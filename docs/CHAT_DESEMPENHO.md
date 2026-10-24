# Desempenho do chat da Aura: como medir, mudar e entregar

O par do `docs/LOD_CYBERESPACO.md` pro chat. A regra é a mesma: **medir em prod antes e depois de mexer**. O que não foi medido não entra como ganho.

## O caminho de um turno (out/2026)

```
pergunta → embedding (1 por turno, compartilhado) ─┬─ cache de respostas (pgvector, 2 travas) → achou? resposta em ~0,9 s
                                                    └─ roteador kNN (exemplos rotulados) → confiante? sem chamar modelo
                                                                                      └─ dúvida → classify por modelo (pensar minimal)
quick:     rascunho em stream (pensar minimal)
completo:  coleta em paralelo (memória · busca acadêmica · web) → raciocínio → rascunho em stream (pensar low) → crítica
```

## As ferramentas

| O quê | Comando | Pra quê |
|---|---|---|
| Benchmark por fase | `docker exec -w /app zaeon_web npx tsx scripts/eval-chat/fases.ts` | Tempo de embedding, cache, kNN, classify, coleta e rascunho. Não grava nada. |
| Eval de qualidade × velocidade | `docker exec -w /app zaeon_web npx tsx scripts/eval-chat/rascunho.ts` (`EVAL_N=4` pra rodar menos) | Variantes do raciocínio/rascunho com a mesma evidência real; juiz cego por pares. Sai com erro se alguma chamada falhar. |
| Entregar um PR | `scripts/entregar-pr.sh <nº>` | Espera o CI. Se só o flaky conhecido falhar, roda de novo uma vez. Verde: merge. Depois espera o `/api/health` mostrar um commit que **contém** o merge. |
| Ledger de 7 dias | `TokenLedger` (campos `phase`, `provedor`, `ok`, `erro`, `ms`, `cachedTokens`) | p50/p90/falha por fase e provedor, acerto do cache do Gemini. |
| Tempo no cliente | `localStorage.setItem("zaeon.tempos.ver","1")` | Selo de tempo em cada resposta; `window.__tempos()` traz as últimas 20. |

Local: o `tsx` **não lê o `.env`** (use `--env-file=.env`), e o Vertex local cai em outra região/cota (429). Rode evals em prod.

## Medido em prod (24/out/2026)

| Fase | Tempo |
|---|---|
| embedding da pergunta | 0,88 s |
| consulta ao cache | 8 ms |
| voto do kNN | < 2 ms (índice: ~100 s no 1º turno de cada processo, em segundo plano) |
| classify por modelo (minimal) | 1,0 s |
| busca acadêmica | ~6,4 s → < 1 s depois do #598 (o Semantic Scholar sem chave dava 429 em toda busca) |
| busca web | ~1 s |
| rascunho: 1ª palavra | minimal 0,86 s · low 4,1 s |

## Os botões (env, sem deploy de código)

- **Cache e roteador:** `CACHE_RESPOSTAS=1`, `CACHE_LIMIAR` (0.9), `CACHE_SO_APROVADAS`. Roteador: `ROTEADOR_KNN=off|sombra|on`, `ROTEADOR_KNN_CONFIANCA` (0.65), `ROTEADOR_KNN_MARGEM` (0.25).
- **Pensar por fase:** `PENSAR_ROUTE`, `PENSAR_REASON`, `PENSAR_DRAFT`, `PENSAR_DRAFT_RAPIDO`, `PENSAR_PLAN` (`minimal|low|medium|high|padrao`).
- **Reserva rápida:** `PRAZO_1A_PALAVRA_RAPIDO_MS` (5 s), `PRAZO_1A_PALAVRA_MS` (12 s), `PRAZO_1A_PALAVRA_TRABALHO_MS` (20 s), `VERTEX_DISJUNTOR_FALHAS` (3), `VERTEX_DISJUNTOR_JANELA_MS` (60 s), `VERTEX_DISJUNTOR_PAUSA_MS` (30 s).
- **Busca acadêmica:** `LITERATURA_PRAZO_FONTE_MS` (2,5 s no chat), `SCHOLAR_PAUSA_429_MS` (10 min), `SEMANTIC_SCHOLAR_API_KEY`.

## Regras de prod

- **Nunca recriar o `zaeon_web` à mão.** O compose pega `APP_URL` (o `NEXTAUTH_URL` do login Google), `GIT_SHA` e ~25 flags da **shell do deploy**, não do `.env`. Mudou o `.env` da VPS? Rode `gh run rerun <último run do deploy.yml>`. Depois confira `printenv NEXTAUTH_URL GIT_SHA` e o `redirect_uri` de `/api/auth/signin/google`.
- Scripts de medição em prod: `docker cp` pra `/app/scripts/zz-*.ts`, rodar, apagar. Sempre com `registrar` no-op e nunca escrevendo no cache real.
