# Octa: o aluno pede uma landing page e sai com um repositório no GitHub e um site no ar

**Status:** desenho (2026-10-22). Fase 1 = sites estáticos. A Fase 2 (sandbox que roda comandos) fica fora deste documento.

## 1. Intenção, e por quê

O Octa Code (a IDE com agente no laboratório, card no Marketplace) só edita arquivos no navegador. O dono quer que ele **entregue software de verdade**. O primeiro caso é este:

> Um aluno pede uma landing page ("uma página pra minha confeitaria, escura e minimalista"). O Octa monta a página passo a passo, como o Claude Code, e no fim o aluno tem **um repositório no SEU GitHub** e **uma URL pública no GitHub Pages** (`aluno.github.io/projeto`).

O porquê: o aluno aprende construindo e sai com algo real e compartilhável, que fica dele e não da Zaeon. Isso casa com a promessa "Aprenda · Construa · Entregue".

## 2. Objetivos

1. **Do pedido ao ar sem sair do Octa:** o aluno descreve, o agente monta, o aluno revisa na IDE, um "Publicar" cria o repositório (ou atualiza o existente), faz o push e liga o GitHub Pages. O aluno recebe os dois links.
2. **Agente estilo Claude Code:** trabalha passo a passo e de forma visível (planeja, escreve e edita arquivos, confere, faz commit, push e publica). Cada passo aparece na janela do agente enquanto acontece.
3. **Página bonita, nunca genérica:** toda página nasce de um **DESIGN.md** real e de **seções testadas** (vindas do sitecrm), não de um HTML que o modelo inventa do zero.
4. **O token do aluno nunca vaza.**

## 3. Não-objetivos (Fase 1)

- Rodar comandos (`npm install`, build, testes, servidor de dev). Isso é a Fase 2, num sandbox isolado por aluno.
- Frameworks com etapa de build (React/Next/Vite no site do aluno). A saída é HTML + CSS (+ JS mínimo opcional), servida exatamente como foi escrita.
- Domínio próprio, subdomínio Zaeon, back end, formulários com servidor e banco de dados no site do aluno.
- Repositório numa organização da Zaeon: o repositório é **sempre** da conta do aluno.

## 4. Anti-objetivos (fracasso mesmo que "funcione")

- **Página feia ou genérica:** o "visual de IA" padrão (gradiente roxo, cards iguais, Inter em tudo, emoji de ícone).
- **Vazamento do token do aluno**, por qualquer caminho: no log, na resposta pro modelo, no bundle do navegador (`NEXT_PUBLIC_*`), em texto puro no banco, num commit ou numa mensagem de erro.
- **Fingir ser uma marca:** a página do aluno não pode usar logo, nome ou texto da marca que inspirou o DESIGN.md (ex.: "Stripe").

## 5. Decisões do dono (como ele decidiu)

| Tema | Decisão |
|---|---|
| Conta do repositório | **Do próprio aluno** (ele conecta o GitHub uma vez) |
| URL pública | **GitHub Pages** na conta do aluno |
| Jeito de trabalhar | **Como o Claude Code**: o agente edita e roda passo a passo, faz deploy, push etc. |
| Permissões | O agente pede autorização **só se o aluno configurou isso** |
| Escopo | **Estático primeiro**; sandbox na Fase 2 |
| Design | Seguir os **DESIGN.md** do GitHub ([VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md), MIT, 84 arquivos, atualizado em 14/10/2026) |
| Escolha do visual | **As duas formas**: galeria com prévias + o agente escolhe pela descrição |
| Base das páginas | **Opção A**: seções do **sitecrm** como ponto de partida, renderizadas pra HTML/CSS no servidor da Zaeon, e depois edição livre pelo agente |
| O que dá vergonha | Página feia/genérica; token do aluno vazando |

## 6. Como funciona (fluxo do aluno)

1. **Abre o Octa** (Marketplace → Octa Code) e pede: *"uma landing pra minha confeitaria, escura e minimalista"*.
2. **Visual:**
   - Se o aluno não escolheu na galeria, o agente escolhe o DESIGN.md mais próximo da descrição e **diz qual escolheu** ("usei o estilo *X* — troque na galeria quando quiser").
   - A **galeria** mostra cada estilo com sua prévia (`preview.html`/`preview-dark.html` do repositório da coleção). Escolher um estilo grava o `DESIGN.md` na raiz do projeto.
3. **Esqueleto:**
   - O agente monta a lista de seções da página (`[{type, props}]`, o formato do sitecrm), escolhendo variantes compatíveis com o estilo.
   - Preenche o conteúdo a partir do pedido do aluno.
   - O **servidor da Zaeon** renderiza as seções em `index.html` + `styles.css` (tokens do DESIGN.md em variáveis CSS) e grava tudo no workspace da IDE.
4. **Edição livre, estilo Claude Code:** daí em diante o agente lê e edita os arquivos com as tools do Octa (`octa_ler`, `octa_escrever`, `octa_buscar`…), sempre relendo o `DESIGN.md`. O aluno vê cada passo e cada arquivo mudando, e pode pedir ajustes ("troca a foto", "adiciona uma seção de preços").
5. **Prévia:** a IDE mostra a página renderizada, porque o runner de HTML já existe.
6. **Publicar:**
   - Na primeira vez, o aluno **conecta o GitHub**.
   - O agente cria o repositório na conta dele, faz commit + push dos arquivos, liga o GitHub Pages e devolve **os dois links**.
   - Publicar de novo atualiza **o mesmo repositório e o mesmo site** (um projeto do Octa ↔ um repositório).
7. **Permissões:**
   - Configuração do aluno, com 3 níveis: **automático**, **pedir antes de publicar/push**, **pedir antes de qualquer escrita**.
   - Apagar arquivo continua pedindo aprovação, como hoje.

## 7. Peças e restrições

### 7.1 Biblioteca de design (DESIGN.md)
- Vendorizar a coleção `VoltAgent/awesome-design-md` no repositório (ex.: `vendor/design-md/`), com `LICENSE` (MIT) e crédito visível na galeria.
- Um script de sincronização pra trazer estilos novos.
- **Índice** por estilo: nome, descrição curta, palavras-chave/"clima" (escuro, minimalista, colorido…), tokens extraídos (cores, fontes, raio, espaçamento) e o caminho das prévias.
- A escolha pela descrição usa esse índice: palavras-chave + o modelo decidindo entre os 3–5 mais próximos.
- **Regra anti-marca:** ao aplicar um estilo, só tokens e princípios visuais. Nunca logo, nome ou texto da marca original na página do aluno. Isso vai nas instruções do agente e numa checagem antes de publicar.

### 7.2 Seções (portadas do sitecrm)
- Origem: `site-builder/src/components/preview/**` do `Zenith-Software-Development/sitecrm`. São 40 seções em 6 famílias:
  - hero (9)
  - features (10)
  - about (5)
  - reviews (5)
  - location (5)
  - cta (5)
- Também vêm o formato `{id, type, props}[]` e a ideia de "variantes permitidas por estilo" (`page_maker/config.py`).
- **Retrabalho necessário:**
  - **Tema:** trocar as cores fixas do Tailwind e o tema de 2 cores por **variáveis CSS alimentadas pelo DESIGN.md** (superfícies, texto, primária/acento, fontes, raio, espaçamento).
  - **Textos:** tirar os textos fixos em português (ex.: "Novidade") pra dentro das props.
  - **Links:** os botões viram links de verdade.
  - **Corrigir:** o `hero_gradient` sorteado mas não registrado.
- **Saída estática:** renderizar no servidor da Zaeon (ex.: `renderToStaticMarkup`) pra HTML puro, e gerar o CSS que essas seções usam como **arquivo estático** — sem build no projeto do aluno e sem CDN de Tailwind em runtime.
- **Não trazer:**
  - scraper, WhatsApp, Supabase, back end Python;
  - as imagens do `public/` (licença incerta);
  - os prompts de texto (são fracos e só em português; a geração de conteúdo é nova).
- **Licença:** o repositório sitecrm **não tem LICENSE**. O dono confirma que o código é da organização e pode entrar no zaeon.

### 7.3 Agente
- Reaproveita o laço atual do Octa (`lib/octa/agente.ts`, `/api/octa/agente`) e as tools de arquivo.
- **Tools novas:**
  - `octa_design_escolher`: escolhe ou troca o estilo e grava o `DESIGN.md`.
  - `octa_pagina_montar`: recebe a lista de seções + props → servidor renderiza → grava `index.html`/`styles.css`.
  - `octa_publicar`: commit + push + Pages, executado pelo servidor.
- **Passo a passo visível:** hoje a rota devolve o turno inteiro de uma vez. Para "estilo Claude Code", os passos (tool chamada, arquivo alterado, resultado) têm que chegar ao vivo na janela do agente (streaming dos eventos do laço).
- **Imagens:** placeholders bonitos e licenciados (padrões/gradientes do próprio DESIGN.md, a arte generativa SVG do `octa_arte` ou ilustrações de licença aberta). Nunca imagem de terceiro sem licença.
- **Modelo:** o Octa hoje usa o qwen3-coder (Contabo) com o Google de reserva. Num turno quente o qwen leva ~19–61 s por passo, e frio estoura e cai pro Google.

### 7.4 GitHub: conexão, token, push, Pages
- **Conectar:** o aluno autoriza a Zaeon no GitHub com o **mínimo de permissão** necessário pra criar repositório, fazer push e ligar o Pages nos repositórios que a Zaeon cria.
- **Token, regras duras:**
  - Só no **servidor**. Nunca em `NEXT_PUBLIC_*`, nunca no navegador, nunca no prompt do modelo.
  - **Cifrado em repouso.** O vault do Octa (`lib/octa/secrets.ts`, AES-256-GCM) já faz isso, mas hoje é **global**: o `OctaSecret.nome` é único, sem dono. Tem que virar **por aluno** (dono + nome).
  - O `OCTA_VAULT_KEY` **ainda não existe em produção**: gerar na VPS sem imprimir.
  - O modelo só vê o placeholder `{{secret:github}}`. A tool `octa_publicar` resolve o token no executor, com escopo restrito a publicar, e **redige** qualquer saída (`redact`).
  - Auditoria de cada uso (já existe: `OctaSecretAudit`), sem valor.
  - Desconectar apaga o token. Token vencido ou revogado → pede pra reconectar.
- **Publicar:**
  - Via API do GitHub (criar repo / atualizar arquivos via commit / habilitar Pages).
  - Sem `git` em shell (não existe shell na Fase 1).
- **Nome do repositório:** a partir do nome do projeto (slug). Se já existir um repositório com esse nome na conta, **não sobrescrever** um repositório que não foi criado pelo Octa.

### 7.5 Segurança e limites
- Token: regras do 7.4.
- **Limite de publicações e de repositórios novos por aluno por dia**, contra abuso e spam na conta do GitHub.
- O conteúdo da página é do aluno; aplicam-se as regras de conteúdo da Zaeon (o llama-guard já modera as mensagens do chat).

## 8. Critérios de pronto (Fase 1)

1. Um aluno de teste pede uma landing e recebe um repositório na conta GitHub de teste dele e uma URL do GitHub Pages que abre a página.
2. A página segue o DESIGN.md escolhido (tokens aplicados) e usa seções da biblioteca. Uma revisão visual por amostragem não encontra o "visual de IA" padrão.
3. Publicar de novo atualiza o mesmo repositório/site.
4. Busca pelo valor do token em logs, ledger, respostas do modelo, bundle do navegador, banco (fora da cifra) e commits → **zero** ocorrências (teste automatizado + prova em produção).
5. Os 3 níveis de permissão funcionam como configurados.
6. Galeria com prévias + escolha automática pela descrição.

## 9. Respostas do dono após a revisão (2026-10-22)

1. **Modelo:** no fluxo "montar landing", usar o **Google primeiro** (gemini-3.5-flash), com a Contabo de reserva. O qwen3-coder segue nas demais tarefas do Octa (revisar e explicar código). Motivo: o qwen faz 19–61 s por passo, o que daria uns 10 min por página.
2. **GitHub:** **reaproveitar o GitHub App já registrado** (`GITHUB_APP_ID`, `lib/projects/github-client.ts`), com login do aluno pelo próprio App (tokens user-to-server, que expiram e são renovados).
   - Permissões mínimas: criar repositório, conteúdo e Pages.
   - **O dono configura** no GitHub (permissões, callback, instalação que cubra os repositórios criados depois) e coloca as envs na VPS, seguindo um checklist entregue pelo construtor.
3. **Repositórios públicos** (o Pages grátis exige). Antes da **primeira** publicação, um aviso claro: "seu código e sua página ficarão públicos no seu GitHub".

## 10. Decisões tomadas por quem desenhou (o dono pode revisar)

- **Projeto no servidor:** um registro por projeto (dono, id do repositório, nome, URL do Pages, estilo) **e os arquivos salvos no servidor**, pra trocar de aparelho não perder o vínculo com o repositório. Cada aluno pode ter vários projetos, com uma lista simples de projetos na IDE. O localStorage vira cache.
- **Turnos longos:** o fluxo roda como **job em segundo plano** (há BullMQ/Redis no app) e a janela do agente mostra os passos ao vivo (stream de eventos), com um orçamento de passos maior que o `MAX_PASSOS=8` atual.
- **"Pedir antes":** o agente **para e pergunta no chat**. Quando o aluno responde, o job retoma do ponto salvo. Os 3 níveis ficam **por cima** das regras atuais (modos review/change e `liberados`), que continuam valendo.
- **Token do aluno (revisto ao planejar):** em vez de tornar o vault do Octa por aluno, reaproveitar `User.githubUserToken`/`githubRefreshToken`, que já são por usuário e cifrados (`lib/projects/crypto.ts`), junto com o connect/callback que já existem. Em produção, `TOKEN_ENC_KEY` passa a ser obrigatória (sem fallback).
- **(substituído pelo item acima) Vault por aluno:** chave única (dono + nome) e **começar do zero**. Não há segredo em produção, porque o `OCTA_VAULT_KEY` nunca existiu lá. O `OCTA_VAULT_KEY` é gerado na VPS sem ser impresso.
- **Limites:** 10 publicações e 3 repositórios novos por aluno por dia. Publicação que falha não conta.
- **Galeria:** a prévia de cada estilo é gerada com **as nossas seções + os tokens do estilo**, e não com o `preview.html` da coleção, que traz nome e logo da marca original. Crédito à coleção na galeria.

## 11. Fica com quem constrói

A divisão em PRs, a forma do streaming, o formato do índice de estilos, a estrutura de arquivos da biblioteca de seções, o mecanismo exato da API do GitHub, como a prévia é exibida, os textos da interface e os testes.
