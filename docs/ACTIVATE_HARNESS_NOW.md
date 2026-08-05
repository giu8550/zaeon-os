# ATIVAR O HARNESS AGORA — comandos copy-paste (Parte 1 do plano-mestre)

> Executa os 3 passos 🔒 que estavam travando + os 2 patches de código. Ordem exata.
> Nomes vêm do código real (`lib/agent/memory.ts`): `VECTOR_INDEX="memory_drawers_vec"`,
> `TEXT_INDEX="memory_drawers_text"`, `EMBED_DIM=1536`, coleção `memory_drawers`, path `embedding`, filter `userId`.

## 1 · Aplicar os 2 patches de código (branch do main)
```bash
git fetch origin && git checkout -b aura/activate origin/main
git apply docs/aura-visual-fix.patch      # gera-molécula → imagem + trava anti-refusal
git apply docs/aura-health-gitsha.patch   # /api/health passa a devolver commit + harness on/off
npx vitest run lib/agent/__tests__/router.test.ts   # gate do router
git commit -am "feat(aura): ativa visual→image + health expõe GIT_SHA/harness"
git push origin aura/activate   # abrir PR → merge em main
```

## 2 · 🔒 Injetar GIT_SHA no deploy (uma linha no deploy.yml)
No `.github/workflows/deploy.yml`, no bloco `script:` do SSH, **depois** do `git reset --hard origin/main`, adicionar à materialização do `.env.secrets`:
```bash
echo "GIT_SHA=$(git rev-parse --short HEAD)" >> .env.secrets
```
(O compose já lê `env_file: [.env, .env.secrets]`; `GIT_SHA` é runtime/server-only → não precisa rebuild, `--force-recreate web` basta.) A partir daqui, `curl https://beta.zaeon.space/api/health` responde `{commit, harness}` — fim do mistério "o que está em prod".

## 3 · 🔒 Confirmar o deploy pegou
```bash
# dispara sozinho no push do PR mergeado; se precisar manual:
ssh <vps> 'cd <DEPLOY_PATH> && git rev-parse --short HEAD'   # tem que == origin/main
curl -s https://beta.zaeon.space/api/health                  # depois do deploy: {"commit":"<sha>","harness":"on",...}
```

## 4 · 🔒 Criar os índices Atlas (o gate que mata a memória em silêncio)
`prisma db push` primeiro se as coleções não existem:
```bash
ssh <vps> 'cd <DEPLOY_PATH> && docker compose -f docker-compose.beta.yml exec -T web npx prisma db push'
```
Depois, no **mongosh** conectado ao cluster de prod (ou Atlas UI → Search → Create Index → JSON Editor):

**Índice vetorial** (`memory_drawers_vec`):
```javascript
db.memory_drawers.createSearchIndex("memory_drawers_vec", "vectorSearch", {
  fields: [
    { type: "vector", path: "embedding", numDimensions: 1536, similarity: "cosine" },
    { type: "filter", path: "userId" }
  ]
})
```
**Índice de texto** (`memory_drawers_text`, para o ramo `$search`/`$rankFusion` do recall híbrido):
```javascript
db.memory_drawers.createSearchIndex("memory_drawers_text", {
  mappings: { dynamic: false, fields: { text: { type: "string" }, userId: { type: "token" } } }
})
```
> Confirme que os campos batem com o agregado em `memory.ts` (`$rankFusion` usa sub-pipelines `vector`+`text`). Ambos ficam `Active` em ~1-2 min.
```javascript
db.memory_drawers.getSearchIndexes()   // status: queryable=true
```

## 5 · 🔒 Flag + smoke
```bash
ssh <vps> 'cd <DEPLOY_PATH> && grep -q "^AURA_HARNESS=" .env && sed -i "s/^AURA_HARNESS=.*/AURA_HARNESS=1/" .env || echo "AURA_HARNESS=1" >> .env; docker compose -f docker-compose.beta.yml up -d --force-recreate web'
curl -s https://beta.zaeon.space/api/health   # harness:"on"
```
Smoke logado na Sala de Estudos:
1. 1 turno de texto → responde (streaming).
2. "gera a imagem da molécula de serotonina" → cartão do Studio (patch visual).
3. pergunta que puxe memória de um turno anterior → recall sem erro.
4. `AURA_HARNESS=0` + recreate por 30s → volta ao legado (kill-switch), depois religa.

## Rollback
`AURA_HARNESS=0` + `--force-recreate web` → legado em segundos, sem redeploy. Índices Atlas ficam inertes (não atrapalham). Se o problema for o merge: `git revert` do PR + push.

## Depois disto = harness VIVO. Segue a Parte 2 (pilares) em `MASTER_HARNESS_ACTIVATION.md`.
```bash
# checagem final de que está tudo no ar:
curl -s https://beta.zaeon.space/api/health | grep -o '"harness":"on"' && echo "HARNESS ATIVO"
```
