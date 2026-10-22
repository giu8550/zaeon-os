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
- [ ] `TOKEN_ENC_KEY`: gerar **na VPS**, direto no arquivo, sem imprimir:
  ```bash
  grep -q '^TOKEN_ENC_KEY=' /root/zaeon-os/.env \
    && echo "ja existe, nao sobrescreva" \
    || echo "TOKEN_ENC_KEY=$(openssl rand -hex 32)" >> /root/zaeon-os/.env
  ```
  Obrigatória em produção: sem ela cifrar/decifrar lança `TokenKeyAusente` e a publicação falha fechado.
  **Atenção:** tokens salvos antes (cifrados com o fallback derivado de `NEXTAUTH_SECRET`) deixam de decifrar; esses
  alunos reconectam o GitHub uma vez. Não perca o valor depois de gerado: trocá-lo invalida todos os tokens.
- [ ] `OCTA_QUEUE=1` (usa `REDIS_URL`, que já tem de existir) e `OCTA_WORKER=1` (o worker sobe no `instrumentation.ts`).
- [ ] Opcional: `OCTA_WORKER_CONCURRENCY` (padrão 2).
- [ ] Modelo do fluxo landing: nada novo. Google primeiro (`GEMINI_MODEL`), reserva Contabo (`OCTA_MODELO_LOCAL=1`,
  `OCTA_MODELO_LOCAL_NOME`, `OCTA_LOCAL_TIMEOUT_MS`, `OCTA_LOCAL_ORCAMENTO_MS`, `OCTA_LOCAL_PAUSA_MS`, se quiser ajustar).
- [ ] Recriar o web para ler o `.env`: `docker compose up -d --force-recreate web` (o compose em uso na VPS).

## 3. Banco (após o merge das Tarefas 1–7)

- [ ] Conferir deploy verde. O `deploy.yml` roda `prisma db push` por padrão (`DB_PUSH=true`); se foi desligado, rodar à mão
  no container web: `docker exec zaeon_web npx prisma db push`.
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
  - [ ] `docker logs zaeon_web` e `docker logs zaeon_worker` (se existir worker separado);
  - [ ] coleção `TokenLedger`;
  - [ ] `OctaEvento.dados` e `OctaTurno` (`estado`, `pendente`, `resposta`);
  - [ ] histórico de commits do repositório de teste (mensagens e arquivos);
  - [ ] bundle: `docker exec zaeon_web sh -c 'grep -r "ghu_" .next/static | wc -l'` → `0`.
  Também `grep -r "ghu_\|ghr_" ` nos logs com `wc -l`, nunca mostrando as linhas.
- [ ] Limites (opcional): 10 publicações e 3 repositórios novos por aluno/dia; falha não conta.
- [ ] Colar o resultado da prova na descrição do PR. Limpar o repositório de teste se o dono pedir.

## 5. Rollback

- [ ] Tirar o fluxo em job: remover (ou pôr `0`) `OCTA_QUEUE` e `OCTA_WORKER` no `.env` e recriar o web. Sem eles
  `filaLigada()` é falso e o turno roda **inline** no processo web (mesmo comportamento, sem Redis/worker).
- [ ] Esconder o Octa: `NEXT_PUBLIC_OCTA_CODE=0` é variável de **build** (Dockerfile ARG / `vars` do deploy.yml):
  mudar a variável do repositório e **redeploy** (recriar só o container não basta).
- [ ] Bloquear só a publicação: apagar `TOKEN_ENC_KEY` faz publicar falhar fechado (mas também impede conectar GitHub).
- [ ] O banco não precisa de rollback: as coleções novas ficam sem uso. Repositórios já criados continuam na conta dos alunos.
