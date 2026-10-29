# Site — card #641 · ~5 s de atraso em toda mensagem (Upstash) · testes e observações

> Documento de apoio à PR do **#641 — SITE · ~5 S DE ATRASO EM TODA MENSAGEM (UPSTASH NÃO RESPONDE)**
> (branch `641-upstash-rapido`). Tudo aqui foi tirado do código da branch e de execuções reais dos testes nesta
> máquina. Onde algo **não foi verificado de verdade**, está marcado como `NÃO VERIFICADO`. Área de infra do
> Martinez — ele pediu pra fazer a parte do código e já colocou os Secrets no GitHub.

---

## 1. Resumo

| # | Item do card | O que foi feito |
|---|---|---|
| 1, 2 | ~5 s a mais nas rotas com limite | Medido em produção (28/10, sem login): `/api/blueprint` 5,2 s e `/api/ai/chat/turns` 5,3 s contra 0,8 s de `/api/onboard/tour`. Causa: o banco do Upstash estava **desativado**; o cliente tentava 5 vezes com espera crescente antes de desistir, em toda mensagem. |
| 3 | Correção no código | `lib/redisDisjuntor.ts`: toda conversa do limitador (`guard`) e do cache (`cacheGet/Set/Del`) com o Redis tem **prazo de 0,5 s**; falhou → **pausa de 1 min** (nem tenta, libera na hora); passada a pausa, testa de novo. E o cliente (`src/lib/redis.ts`) tenta **1 vez** a mais (antes 5, ~5 s). Com o Upstash fora, a 1ª mensagem espera no máximo ~0,5 s e as seguintes, nada. Com o Upstash bom, nada muda (continua limitando com 429). |
| 4 | Credencial (Martinez) | O Martinez restaurou o banco e pôs os Secrets `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` no GitHub. Só que o deploy **não lia** esses Secrets — o site pegava do `.env` dentro do VPS. Agora o `deploy.yml` grava os dois no `.env.secrets` do VPS (que vence o `.env`), trocando as linhas antigas e mantendo o resto. Só com os dois preenchidos; vazios, vale o `.env` como antes. |

As outras rotas que usam o Redis direto (feed de posts, mensagens antigas do chat) ficam só com a parte das tentativas
(5 → 1) — PR pequena.

**Banco:** nada muda. **Segurança:** nenhuma credencial no código ou nos commits.

---

## 2. Como rodar

```bash
npx vitest run lib/redisDisjuntor.test.ts lib/ratelimitGuard.test.ts
```

- `lib/redisDisjuntor.test.ts`: responde → devolve; mudo → desiste no prazo e pausa; em pausa não toca no Redis; passada a pausa, tenta de novo.
- `lib/ratelimitGuard.test.ts`: `guard()` com o Upstash mudo libera em < 1,5 s (não 5) e a próxima nem tenta; com o Upstash bom, ainda devolve 429.
- O trecho do `deploy.yml` foi rodado de verdade num arquivo de teste: troca as linhas antigas do Upstash e mantém as outras; o YAML foi validado.

---

## 3. Suíte completa

`npx vitest run` nesta máquina: **4722 passaram, 29 falharam, 10 pulados** (551 arquivos).

As 29 são as de sempre deste Windows, nenhuma desta branch: sem pacotes locais (`pg`, sandpack — `rag/*`, `queue/rag`,
`api/admin/rag`, `api/rag/minha-base`, `runChatTurn`, `videodoc/anexo`, `octa/PreviaReact`) e Windows/tempo
(`leitor/compose`, `octa/fortify`, `octa/genart`, `studio/storage`). O CI (Linux) é quem confirma.

---

## 4. Depois do merge

1. O merge na `main` já dispara o deploy — e é **ele** que grava a credencial nova no servidor (não precisa de outro).
2. No log do deploy (Actions → Deploy (VPS)) deve aparecer **"→ Upstash: credencial dos Secrets gravada no .env.secrets"**.
3. Medir de novo (qualquer um pode, sem login):
   ```bash
   curl -s -o /dev/null -w "%{time_total}s\n" https://zaeon.com.br/api/blueprint
   ```
   Esperado: perto de **1 s** (antes 5,2 s).
4. No site: mandar uma mensagem no chat da Aura e trocar de blueprint — a resposta começa sem os ~5 s de espera.

`NÃO VERIFICADO`: o tempo em produção depois do deploy (o item 3 confere) e se os Secrets que o Martinez cadastrou
batem com o banco restaurado. Com esta correção o site fica rápido **mesmo com a credencial errada** — aí ele só fica
sem limite de uso, e o log do servidor mostra "[redis] fora". Se aparecer essa linha, conferir os Secrets.

> ⚠️ O TOKEN passou por mensagem de chat: vale o Martinez gerar um novo no painel do Upstash ("Reset token"),
> atualizar o Secret e redeployar.
