# Octa → GitHub Pages: runbook de produção

Fluxo: o aluno conecta o GitHub (OAuth user-to-server do App "Zaeon Code"), o Octa monta a landing estática,
cria um repositório **público** na conta dele (`POST /user/repos`), commita via API de git data, liga o Pages
(`POST /repos/{owner}/{repo}/pages`, ou `GET` se já estava ligado) e devolve `pagesUrl`.
Token do aluno: `User.githubUserToken`/`githubRefreshToken`, cifrados por `lib/projects/crypto.ts`.

## 1. GitHub App (github.com)

Settings → Developer settings → GitHub Apps → o App já registrado.

- [ ] **Repository permissions:** Administration: **write**, Contents: **write**, Pages: **write**, Metadata: **read**.
- [ ] **Identifying and authorizing users:** marcar **Request user authorization (OAuth) during installation**.
- [ ] Marcar **Expire user authorization tokens** (o código renova com `refresh_token`, `lib/projects/github-user.ts`).
- [ ] **Callback URL:** `https://zaeon.com.br/api/projects/github/callback` (tem que ser idêntica a `GITHUB_APP_CALLBACK_URL`).
- [ ] Salvar. Mudar permissões **exige que cada usuário reautorize** (quem já conectou verá o pedido de aceitar as novas permissões; até lá a publicação pode falhar com 403 → `github_reconectar`/`falha_github`).

Instalação na conta do aluno: o código chama `POST /user/repos` com o **token do usuário** (user-to-server), sem
installation token, e nunca tenta escrever em repo que o Octa não criou. Se o GitHub exige o App instalado na conta
do aluno para esse token enxergar/criar o repo e ligar o Pages: **conferir na prova** (passo 4). Se exigir, o aluno de
teste instala o App na conta pessoal dele (All repositories ou só os criados).

## 2. Envs na VPS (`/root/zaeon-os/.env`)

- [ ] `GITHUB_APP_CALLBACK_URL=https://zaeon.com.br/api/projects/github/callback`
- [ ] `GITHUB_APP_CLIENT_ID` e `GITHUB_APP_CLIENT_SECRET` já preenchidos (sem eles `isUserOAuthConfigured()` é falso).
- [ ] `TOKEN_ENC_KEY`: gerar **na VPS**, direto no arquivo, sem imprimir. Só pula a geração se já houver um valor
  **válido** (64 caracteres hex); linha vazia (`TOKEN_ENC_KEY=""`) ou o placeholder do `.env.example` (`gerar-com…`)
  não contam:
  ```bash
  ENV=/root/zaeon-os/.env
  if grep -Eq '^TOKEN_ENC_KEY="?[0-9a-fA-F]{64}"?[[:space:]]*$' "$ENV"; then
    echo "TOKEN_ENC_KEY valida ja existe, nao sobrescreva"
  else
    # tira linha vazia/placeholder (se houver) e acrescenta uma nova; \n antes protege .env sem quebra de linha no fim
    sed -i '/^TOKEN_ENC_KEY=/d' "$ENV"
    printf '\nTOKEN_ENC_KEY=%s\n' "$(openssl rand -hex 32)" >> "$ENV"
    echo "TOKEN_ENC_KEY gerada"
  fi
  grep -c '^TOKEN_ENC_KEY=' "$ENV"   # → 1 (nunca imprima o valor)
  ```
  Obrigatória em produção: sem ela cifrar/decifrar lança `TokenKeyAusente` e a publicação falha fechado.
  **Atenção:** tokens salvos antes (cifrados com o fallback derivado de `NEXTAUTH_SECRET`) deixam de decifrar; esses
  alunos reconectam o GitHub uma vez. Não perca o valor depois de gerado: trocá-lo invalida todos os tokens.
- [ ] `OCTA_QUEUE=1` (usa `REDIS_URL`, que já tem de existir) e `OCTA_WORKER=1` (o worker sobe no `instrumentation.ts`).
  **Decisão R14:** o `.env` é compartilhado, então `OCTA_WORKER=1` faz o **próprio container `zaeon_web` consumir os
  turnos** — em produção só existe o `zaeon_web` (não há `zaeon_worker` rodando), então é ele o consumidor. Se um dia
  subir também o serviço `worker`, os dois consomem a fila: o claim por `runId` (`processarTurno`) garante que cada
  turno roda uma vez só. Custo: os turnos dividem CPU com o web.
- [ ] Opcional: `OCTA_WORKER_CONCURRENCY` (padrão 2).
- [ ] Modelo do fluxo landing: nada novo. Google primeiro (`GEMINI_MODEL`), reserva Contabo (`OCTA_MODELO_LOCAL=1`,
  `OCTA_MODELO_LOCAL_NOME`, `OCTA_LOCAL_TIMEOUT_MS`, `OCTA_LOCAL_ORCAMENTO_MS`, `OCTA_LOCAL_PAUSA_MS`, se quiser ajustar).
- [ ] Recriar o web para ler o `.env`, **sempre com o compose do deploy** (a pasta da VPS também tem um
  `docker-compose.yml` com outro `zaeon_web`; sem `-f` o compose errado é usado):
  `cd /root/zaeon-os && docker compose -f docker-compose.beta.yml up -d --force-recreate web`.

## 3. Banco (após o merge das Tarefas 1–7)

- [ ] Conferir deploy verde. O `deploy.yml` roda `prisma db push` por padrão (`DB_PUSH=true`); se foi desligado, rodar à mão
  no container web (`cd /root/zaeon-os && docker compose -f docker-compose.beta.yml exec web npx prisma db push`, ou `docker exec zaeon_web npx prisma db push`).
- [ ] Cria as coleções `octa_projetos` (OctaProjeto), `octa_publicacoes` (OctaPublicacao), `octa_turnos` (OctaTurno) e
  `octa_eventos` (OctaEvento, índice único `turnoId+seq`). Só adiciona; não apaga dados.

## 4. Prova em produção (conta GitHub de teste)

- [ ] Em zaeon.com.br, com um usuário de teste: abrir o Octa e **conectar o GitHub** com a conta de teste (a janelinha `/octa/github` fecha sozinha).
- [ ] Pedir a **landing da confeitaria**; acompanhar os passos ao vivo.
- [ ] Aceitar o **aviso público** ("seu código e sua página ficarão públicos no seu GitHub") e **publicar**.
- [ ] Conferir o repositório novo, público, na conta de teste; resposta com `pagesUrl`. Logo após ligar o Pages pode vir
  `status: "publicando"` ("no ar em ~1 min"): não é erro.
- [ ] Esperar ~1 min e abrir `pagesUrl`: a página abre e segue o DESIGN.md escolhido, sem o nome da marca de origem do estilo.
- [ ] **Republicar** (pedir uma mudança): o **mesmo repositório** ganha commit novo (conferir no histórico), mesma URL.
- [ ] Se o GitHub exigiu o App instalado na conta (item 1), anotar aqui.
- [ ] **Varredura do token** (sem nunca imprimir o valor). Dentro do container, decifrar e comparar por hash:
  Receita: um script temporário (fora do repo, apagado depois) no container que lê `User.githubUserToken` do usuário de teste, decifra, calcula `sha256` e
  procura o token (bytes) em cada fonte, imprimindo apenas `fonte: N ocorrências`. Fontes, todas com zero:
  - [ ] logs: `docker logs zaeon_web` (e `zaeon_worker`, se existir) entram no script como fonte (a busca pelo token
    decifrado acontece lá dentro);
  - [ ] coleção `TokenLedger`;
  - [ ] `OctaEvento.dados` e `OctaTurno` (`estado`, `pendente`, `resposta`);
  - [ ] histórico de commits do repositório de teste (mensagens e arquivos);
  - [ ] bundle (falha alto se o caminho não existir, em vez de dar um `0` falso):
    ```bash
    docker exec zaeon_web sh -c 'test -d .next/static || { echo "ERRO: .next/static nao existe"; exit 1; }; grep -rE "gh[ur]_" .next/static | wc -l'
    ```
    → `0`.
  - [ ] prefixos de token nos logs, só a contagem (nunca as linhas):
    `docker logs zaeon_web 2>&1 | grep -cE 'gh[ur]_[A-Za-z0-9]'` → `0` (idem `zaeon_worker`, se existir).
- [ ] Limites (opcional): 10 publicações e 3 repositórios novos por aluno/dia; falha não conta.
- [ ] Colar o resultado da prova na descrição do PR. Limpar o repositório de teste se o dono pedir.

## 5. Rollback

- [ ] Tirar o fluxo em job: remover (ou pôr `0`) `OCTA_QUEUE` e `OCTA_WORKER` no `.env` e recriar o web
  (`docker compose -f docker-compose.beta.yml up -d --force-recreate web`). Sem eles
  `filaLigada()` é falso e o turno roda **inline** no processo web (mesmo comportamento, sem Redis/worker).
- [ ] Esconder o Octa: `NEXT_PUBLIC_OCTA_CODE=0` é variável de **build** (Dockerfile ARG / `vars` do deploy.yml):
  mudar a variável do repositório e **redeploy** (recriar só o container não basta).
- [ ] Bloquear só a publicação: apagar `TOKEN_ENC_KEY` faz publicar falhar fechado (mas também impede conectar GitHub).
- [ ] O banco não precisa de rollback: as coleções novas ficam sem uso. Repositórios já criados continuam na conta dos alunos.
