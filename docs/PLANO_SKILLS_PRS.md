# Plano — Rollout da credencial (prod) + 2 PRs (ajustes finos • Sala de Plugins → Sala de Skills)

> Contexto: billing próprio pausado (jul/2026). Toda a IA do app passa por `vertexCredentials()`
> (`lib/ai/vertex-credentials.ts`) → Vertex AI. Trocamos `GOOGLE_CREDENTIALS` + `GOOGLE_PROJECT_ID`
> no `.env.local` para o projeto do amigo (crédito $300) e **testamos ao vivo (2026-07-05)**:
> texto flash/pro, voz 1-locutor, voz podcast 2-locutores e Imagen — **todos 200**.
> Dados (MongoDB Atlas/Redis) e login (OAuth) permanecem na conta do Martinez. Ferramentas de
> validação: `vertex-smoke.js` e `vertex-diag.js` (raiz, gitignored) → `node vertex-diag.js`.

---

## 0) Rollout da credencial em PRODUÇÃO — via GitHub Actions secret

**Regra de ouro:** a credencial é segredo. Nunca vai em commit/PR. Os `.env*` já estão no
`.gitignore` e `.dockerignore` (ver `docs/BETA_DEPLOY.md`). O deploy atual (`.github/workflows/deploy.yml`)
faz SSH no VPS → `git reset --hard origin/main` → `docker compose up -d --build`, e o compose lê
`env_file: [.env]` (arquivo que **vive no VPS**). Hoje o pipeline **não** injeta `GOOGLE_CREDENTIALS`
a partir de secrets — ele confia no `.env` do servidor.

Como o JSON da service account é multilinha/cheio de aspas, o jeito robusto é **base64**.

### Passos
1. Gerar o valor base64 da credencial (localmente, a partir da JSON de uma linha):
   ```bash
   # macOS
   node -e "process.stdout.write(Buffer.from(process.env.GOOGLE_CREDENTIALS||require('fs').readFileSync('.env.local','utf8').match(/GOOGLE_CREDENTIALS=\"(.*)\"/)[1]).toString('base64'))" | pbcopy
   ```
   (ou `base64 -i gcp-sa.json | tr -d '\n' | pbcopy`)
2. GitHub → repo → **Settings › Secrets and variables › Actions › New repository secret**:
   - `GOOGLE_CREDENTIALS_B64` = (o base64 do passo 1)
   - `GOOGLE_PROJECT_ID_VALUE` = `project-ca60c613-5b91-4378-bec`
3. Alterar `.github/workflows/deploy.yml` para passar os secrets ao passo SSH e materializar um
   `.env.secrets` **efêmero** no VPS (nunca commitado):
   ```yaml
   - name: Deploy via SSH
     uses: appleboy/ssh-action@v1.0.3
     with:
       host: ${{ secrets.VPS_HOST }}
       port: ${{ secrets.VPS_PORT }}
       username: ${{ secrets.VPS_USER }}
       key: ${{ secrets.VPS_SSH_KEY }}
       envs: GOOGLE_CREDENTIALS_B64,GOOGLE_PROJECT_ID_VALUE
       script: |
         cd "${{ secrets.DEPLOY_PATH }}"
         git reset --hard origin/main
         # materializa segredos de runtime fora do git:
         umask 177
         echo "GOOGLE_CREDENTIALS=$(echo "$GOOGLE_CREDENTIALS_B64" | base64 -d | tr -d '\n')" >  .env.secrets
         echo "GOOGLE_PROJECT_ID=$GOOGLE_PROJECT_ID_VALUE"                                    >> .env.secrets
         export COMPOSE_FILE="${{ vars.DEPLOY_COMPOSE || 'docker-compose.beta.yml' }}"
         docker compose up -d --build --remove-orphans --force-recreate web
         docker image prune -f
   ```
   E no `docker-compose.beta.yml`, no serviço `web`, encadear o novo arquivo (o último vence):
   ```yaml
   env_file: [.env, .env.secrets]
   ```
   Adicionar `.env.secrets` ao `.gitignore` e `.dockerignore`.
   > `GOOGLE_CREDENTIALS` é **runtime/server-only** (não é `NEXT_PUBLIC_*`), então **não precisa
   > rebuild** por causa dela — `--force-recreate web` já basta para o container pegar a env nova.
4. Push → o deploy roda, escreve `.env.secrets` e recria o `web` com a credencial do amigo.
5. **Verificar em prod:** abrir o chat (responde?), clicar **Ouvir** (voz sai?), gerar imagem no
   Studio. Conferir no **billing console do amigo** que o consumo aparece lá (e some do `zaeon-os`).

### Alternativa rápida (sem mexer no pipeline agora)
SSH manual no VPS, editar o `.env` de prod e recriar só o web:
```bash
ssh <vps>
cd <DEPLOY_PATH>
cp .env .env.bak-$(date +%F)          # backup
nano .env                              # trocar GOOGLE_CREDENTIALS + GOOGLE_PROJECT_ID
docker compose -f docker-compose.beta.yml up -d --force-recreate web
docker compose logs -f web             # olhar o boot
```
Use isso pra ficar **live já**; o mecanismo do §0 (secret) fica como a forma definitiva/repetível.

---

## PR #1 — Ajustes finos  `fix/ajustes-finos`

> **Aguardando a lista do Martinez.** Preencher os itens abaixo com o que você já tinha em mente.
> Candidatos que apareceram no diagnóstico de hoje (aceite/remova conforme quiser):

- [ ] **(a lista vem aqui — me manda)**
- [ ] _(candidato)_ **Imagen 200 sem bytes:** o diag recebeu `200` mas sem `bytesBase64Encoded`.
      Confirmar o id do modelo no Model Garden do projeto e o shape da resposta em
      `lib/studio/imagen-request.ts` / `lib/studio/imagen.ts`; logar `predictions[0]` cru quando vier vazio.
- [ ] _(candidato)_ **Robustez do `vertexCredentials`:** cobrir o caso da private key com `\r\n`
      (Windows) e validar campos mínimos com erro claro em vez de 500 genérico.
- [ ] _(candidato)_ **Infra do §0:** commitar a mudança do `deploy.yml` + `.env.secrets` no compose
      + entradas no `.gitignore`/`.dockerignore` (a **credencial não**, só o mecanismo).
- [ ] _(candidato)_ **Diag oficial:** promover `vertex-diag.js` a um script versionado
      (`scripts/vertex-diag.mjs`) e/ou expor melhor o `GET /api/studio/diag`.

**Critério de pronto:** `npm run test` verde, `node scripts/vertex-diag.mjs` all-green, sem segredo no diff.

---

## PR #2 — Sala de Plugins → **Sala de Skills** (overhaul)  `feat/sala-de-skills`

**Estratégia:** renomear tudo para o domínio "Skill", com **redirect** da rota antiga e
**zero migração de dados** (o modelo novo aponta para a mesma coleção Mongo via `@@map`).

### Mapa de arquivos afetados (tudo que fala "plugin" hoje)
| Área | Arquivo | Ação |
|---|---|---|
| Schema | `prisma/schema.prisma` (`model Plugin`, L253) | Renomear p/ `model Skill { ... @@map("Plugin") }` → mantém a coleção `Plugin` no Atlas (sem migração). `prisma generate`. |
| API | `app/api/plugins/route.ts` | Criar `app/api/skills/route.ts` (usa `prisma.skill`). Manter `/api/plugins` como **shim** que reexporta os handlers (back-compat de clientes antigos). |
| Página | `app/plugin-store/page.tsx` (390 ln) | Mover p/ `app/skills-store/page.tsx`; trocar `Plugin`→`Skill`, `PuzzlePieceIcon`→algo tipo `SparklesIcon`/`BoltIcon`, copy "Plugin Store"→"Sala de Skills". Fetch `/api/skills`. |
| Redirect | `app/plugin-store/page.tsx` | Substituir conteúdo por `redirect("/skills-store")` (Next `redirect`) — não quebra links/bookmarks. |
| Admin | `app/workstation/admin/modules/PluginsModule.tsx` | Renomear → `SkillsModule.tsx`; labels "Modules"→"Skills". |
| Admin host | `app/workstation/admin/page.tsx` (L20 import, L162 `activeTab==='plugins'`) | Import + tab id `plugins`→`skills` (manter alias se o tab estiver linkado em algum lugar). |
| Navbar | `components/main/navbar.tsx` (L200) | `href="/skills-store"`, label "Skills". |
| Radial UI | `components/sub/ClassesView.tsx` (L895, L954) | Nó/label "Plugins"→"Skills" (e o comentário dos "fios de energia"). |
| Prompt IA | `app/api/ai/chat/route.ts` (L133) | Atualizar a descrição das salas: "Plugin Store (/plugin-store)"→"Sala de Skills (/skills-store)". |
| i18n | `public/locales/{de,en,es,fr,ko,pt,zh}/*` | `grep -ri plugin public/locales` e trocar as strings visíveis. |
| Card fixo | `app/skills-store/page.tsx` (const `ZAEON_CODE`) | Mantém — Zaeon Code segue em destaque; revisar copy p/ o novo enquadramento "skills". |

### Decisões de domínio (revisar no PR)
- **Categorias:** hoje `Essencial | Agentes | Mentorias | Blockchain`. Faz sentido para "skills"?
  Sugestão: manter e adicionar (ex.: `Voz`, `Pesquisa`). Campo é `String`, sem enum → barato.
- **Nomenclatura visível:** "Sala de Skills" / "Skill Store". Definir a copy PT canônica.
- **Gating:** o fluxo `/api/projects/access` (Zaeon Code) continua igual — só herda o novo nome.

### Migração de dados
Nenhuma. `@@map("Plugin")` faz o modelo `Skill` ler/gravar a coleção `Plugin` existente.
Se um dia quiser renomear a coleção de fato: script único `renameCollection('Plugin','Skill')` no
Atlas + remover o `@@map`. **Não** fazer nisso agora (evita downtime).

### Testes & verificação
- Unit/route: GET/POST/DELETE de `/api/skills` (upsert por ObjectId de 24 chars).
- E2E manual: navbar → Sala de Skills carrega; admin cria/edita/deleta skill; `/plugin-store`
  redireciona; card do Zaeon Code aparece com gating correto.
- `grep -ri "plugin" app components lib prisma --include=*.ts --include=*.tsx` → só sobra o
  `@@map("Plugin")` e o shim de compat.

### Rollback
Reverter o merge. Como não há migração de dados, o schema volta sem perda. O redirect e o shim
`/api/plugins` garantem que nada quebre durante a transição.

---

## Sequência sugerida
1. **§0 (alternativa rápida)** — deixa prod usando o crédito do amigo **hoje**.
2. **PR #1** — ajustes finos (inclui o mecanismo de secret do §0 como forma definitiva).
3. **PR #2** — Sala de Skills, depois que a #1 mergear (evita conflito nos mesmos arquivos de nav/admin).

## Branches & commits
- `fix/ajustes-finos` → PR #1
- `feat/sala-de-skills` → PR #2
- Commits pequenos e temáticos; PR #2 com checklist do mapa de arquivos acima.
