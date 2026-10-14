# Colaboração em dupla — como trabalhamos juntos neste repositório

> Acordo de trabalho para **duas pessoas** (Martinez e Giulia) mexendo no mesmo projeto.
> Parte vem de práticas conhecidas (fontes no fim); parte é decisão deste projeto e está marcada
> como **[decisão]**. Nada aqui altera o deploy: é só combinado de trabalho.

---

## 1. O fluxo, em uma página

1. **Todo trabalho nasce de um card** (Projects → "Zaeon on Solana v1.00") e vira uma **branch curta**.
2. **Nada de commit direto na `main`.** Tudo entra por Pull Request.
3. **A outra pessoa revisa** e quem abriu a PR **não** faz o próprio merge **[decisão]**.
4. **O CI tem de estar verde** antes do merge.
5. **O merge na `main` faz o deploy sozinho** (`deploy.yml`). Por isso a `main` é sagrada.

```
card → branch curta → commits pequenos → PR → CI verde → revisão da outra pessoa → merge → deploy
```

## 2. Branches

- Formato: `tipo/numero-assunto-curto`. Exemplos: `fix/392-agente-sem-mencao`, `feat/401-historico-canal`, `docs/colaboracao`.
- Tipos: `fix`, `feat`, `docs`, `chore`, `refactor`, `test`.
- **Nome curto.** O nome gerado automaticamente pelo botão "Create a branch" do GitHub chega a ~170 caracteres,
  com acentos, e incomoda no Windows e no terminal. Ao criar pelo card, **apague e digite o nome curto**.
- Sem acento e sem espaço no nome da branch.
- Branch viva por **poucos dias**. Branch velha vira conflito: traga a `main` para dentro dela com frequência.

## 3. Commits e Pull Requests

- **PR pequena.** Uma PR resolve um assunto. PR grande demora a revisar e esconde bug.
- Mensagem de commit no padrão que o repositório já usa: `fix(canal): ...`, `feat(cyber): ...`, `docs(...)`.
- **Descrição da PR** (o template em `.github/pull_request_template.md` guia): o que mudou, por quê,
  como testar, o que **não** foi testado.
- Rode os testes **antes** de abrir a PR:

```bash
npx vitest run
npx tsc --noEmit
```

> `tsc` acusa erros hoje em `server/colyseus/*` porque aquele pacote tem as dependências separadas
> (o CI instala com `npm ci --prefix server/colyseus`). Os erros fora dessa pasta devem ser **zero**.

## 4. Revisão

- Pelo menos **1 aprovação** da outra pessoa. Com duas pessoas, exigir 2 trava tudo.
- Revisor: marque **"Request changes"** só para o que afeta correção, segurança ou manutenção;
  o resto é **"Comment"**.
- Quem revisa lê o **diff** e o **como testar**. Se não der para entender a PR, ela está grande demais.
- Bot de revisão (Sourcery) **não substitui** uma pessoa: o aviso dele é entrada, não decisão.
- Não é para ninguém aprovar a própria PR **[decisão]**. Se uma das duas estiver fora, a PR espera.

## 5. Proteção da `main` (configuração no GitHub, só o dono do repositório faz)

Em *Settings → Branches → Add branch ruleset* para `main`:

| Regra | Valor sugerido |
|---|---|
| Require a pull request before merging | ligado |
| Required approvals | **1** |
| Require status checks to pass | ligado, exigindo o job `build-test` do `ci.yml` |
| Block force pushes | ligado |
| Allow admins to bypass | **desligado**, ou ligado só enquanto a dupla se ajusta |

> Atenção: o `ci.yml` ignora PRs só de `.md`/`docs/` (`paths-ignore`). Se `build-test` for **obrigatório**,
> uma PR só de documentação fica "pendente" para sempre. Resolva uma das duas: tirar o `paths-ignore`
> ou não exigir o check.

## 6. Custo do GitHub Actions

Este repositório é **público** e todos os workflows usam `ubuntu-latest` (runner padrão):

- Runner **padrão** em repositório **público** é **gratuito**. Já o repositório **privado** consome uma
  cota mensal (GitHub Free: 2.000 min/mês). Runners **maiores** são cobrados sempre.
- Logo, se a cota do GitHub do Martinez está no limite, **o culpado provavelmente não é este repositório**:
  veja em *Settings → Billing → Usage* qual repositório e qual workflow estão gastando.
- O que já está bom aqui: `concurrency` com cancelamento no CI, `paths-ignore` para `.md`/`docs`,
  `timeout-minutes`, cache do npm. O CI só roda em PR (não em todo push).
- O CI **não roda em PR em rascunho (draft)**: abra como draft enquanto trabalha.

## 7. Fork e CI nos minutos de cada uma

- Cada pessoa pode ter o **seu fork** público. O CI do fork roda **na conta do fork**.
- O fork **não tem os secrets**: o `deploy.yml` detecta (job `guard`) e **pula o deploy**, sem falhar.
- Para rodar o CI no fork: abra uma PR **dentro do próprio fork** (`sua-branch` → `main` do fork).
  Uma PR do fork para o repositório original roda o CI **na conta do original**.
- **Deploy continua só no repositório original**, com os secrets do Martinez.

## 8. Secrets e credenciais (regra de ouro)

- **Nunca** commitar `.env`, chaves SSH, JSON do Google ou strings do Atlas. Só `*.env.example`.
- Secrets que o deploy exige (`deploy.yml`): `VPS_HOST`, `VPS_PORT`, `VPS_USER`, `VPS_SSH_KEY`,
  `DEPLOY_PATH`, `GOOGLE_CREDENTIALS_B64`, `GOOGLE_PROJECT_ID_VALUE`.
- Quem tem a credencial **entrega por canal seguro**, por vontade própria. Ninguém extrai da VPS.
- Use **chave SSH dedicada ao deploy** (par `ed25519` próprio), nunca a pessoal, para poder revogar sem susto.
- Se alguma chave aparecer em chat, log ou commit: **considere vazada e rotacione**.

## 9. Ambiente paralelo na mesma VPS (pendência, **não** está pronto)

Rodar um segundo ambiente (da Giulia) na mesma VPS **não** funciona só trocando variáveis. No estado atual:

| Ponto | Onde | Problema |
|---|---|---|
| `name: zaeon-beta` | `docker-compose.beta.yml:18` | nome do projeto fixo |
| `container_name: zaeon_web`, `zaeon_redis`, `zaeon_caddy`, `zaeon_colyseus`, … | várias linhas do mesmo arquivo | nomes de container fixos **colidem**; o `up` do segundo ambiente recria os do primeiro |
| `ports: ["80:80", "443:443"]` | Caddy, `docker-compose.beta.yml` | segunda stack não consegue publicar 80/443 |
| `.env` e `DATABASE_URL` | VPS, em `DEPLOY_PATH` | se apontar o **mesmo** Atlas, o ambiente novo grava e faz `prisma db push` nos **dados de produção** |
| clone inicial | `deploy.yml` faz `cd $DEPLOY_PATH` + `git reset --hard` | a pasta tem de existir como clone do repo certo |

Duas saídas, **a decidir juntos** antes de qualquer deploy:

- **Substituir:** só um ambiente deploya (mesmo compose, mesmos nomes). Simples.
- **Paralelo de verdade:** parametrizar `container_name` e volumes por variável, um único Caddy por domínio,
  e **banco separado**. Dá mais trabalho e muda o compose de produção, então precisa de PR própria e revisão.

## 10. Quando travar

- Bug do dia a dia: card em "Bugs para corrigir" com **como reproduzir** + **detalhe técnico**.
- Dúvida de decisão (produto/infra): anotar no card e conversar antes de codar.
- Algo urgente em produção: o deploy tem **health-gate**; se falhar, o container antigo segue servindo.
  Reverter = *Revert* na PR mergeada e novo deploy.

---

## Fontes

- [GitHub Pull Requests: 10 Tips to Know — Mergify](https://articles.mergify.com/github-pull-requests-10-tips-to-know/)
- [Best Practices for Branch Protection — DEV Community](https://dev.to/n3wt0n/best-practices-for-branch-protection-2pe3)
- [How to protect GitHub projects from non-reviewed code — Bornfight](https://bornfight.com/blog/how-to-protect-github-projects-from-non-reviewed-code-and-force-code-review-culture)
- [GitHub PR review guide — aicodereview.cc](https://aicodereview.cc/blog/github-pr-review-guide/)
- [About billing for GitHub Actions — docs.github.com](https://docs.github.com/en/actions/reference/usage-limits-billing-and-administration)
- [How use of GitHub Actions is measured — docs.github.com](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [Reducing GitHub Actions Costs — WarpBuild](https://warpbuild.com/blog/github-actions-cost-reduction)
