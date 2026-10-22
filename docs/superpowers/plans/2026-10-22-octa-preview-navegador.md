# Octa: prévia ao vivo, captura de tela pro agente e apps rodando no navegador do aluno (Plano)

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA: superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans. Passos com checkbox (`- [ ]`).

**Objetivo:** o aluno vê o que o Octa está construindo enquanto ele constrói, e o agente "enxerga" a página que fez. Tudo **sem containers por aluno**:
- (1) prévia que se redesenha a cada arquivo gravado, mais uma captura de tela no servidor que o agente olha;
- (2) React rodando no navegador do aluno (Sandpack) e Python no navegador (Pyodide, que já existe), com os erros voltando pro agente.

**Pedido do dono (2026-10-22):** "1 e 2 agora. Vai." Containers por aluno ficam para depois.
- Escolhas tecnológicas ditas ao dono e aceitas: Sandpack (Apache-2.0) para React/Vite; Pyodide para Python; Chromium headless no servidor para a captura.
- Sem WebContainers, que exigem licença comercial.

**Arquitetura:**
- **Arquivos ao vivo:** o job do turno grava os arquivos do projeto a cada escrita, cercado pelo `runId`, e a IDE relê o projeto a cada evento `arquivo`.
- **Captura:** um módulo de captura (`puppeteer-core` + `chromium` do Debian no runtime da imagem) renderiza `index.html` com os arquivos do próprio projeto, com JS desligado e rede em allowlist, e devolve um JPEG.
- **Tool `octa_ver_pagina`:** põe essa imagem na conversa do modelo (Gemini, multimodal pelo gateway).
- **React:** a IDE detecta projeto React e troca a prévia por Sandpack. Os erros do console do Sandpack e a saída do Pyodide viram um pedido "Corrigir com o Octa".

**Stack:** Next.js 14, `@codesandbox/sandpack-react`, `puppeteer-core`, `chromium` (apt, bookworm), BullMQ (o job existente), Vitest.

**Base:** o fluxo landing já em produção.
- Plano anterior: `docs/superpowers/plans/2026-10-22-octa-landing-github.md`; spec: `docs/superpowers/specs/2026-10-22-octa-landing-github-design.md`.
- Código: `lib/queue/octa.ts`, `lib/octa/agente.ts`, `components/octa/OctaIDE.tsx`, `components/octa/useTurnoOcta.ts`, `app/agentic-modules/codelab/useCodeRunner.ts`.

## Restrições globais
- **Nenhum token ou segredo** chega à captura, à prévia, ao Sandpack ou aos eventos.
- **Captura** (o HTML é do aluno ou do modelo, portanto não confiável):
  - `setJavaScriptEnabled(false)`;
  - toda requisição de rede bloqueada, exceto os arquivos do próprio projeto (servidos pela interceptação), `fonts.googleapis.com`, `fonts.gstatic.com` e `images.unsplash.com`;
  - timeout de 15 s por captura, uma captura por vez por processo (semáforo);
  - viewport 1280×800 e uma segunda de 390×844 (celular);
  - JPEG com qualidade 70 e no máximo 1600 px de largura;
  - Chromium em processo próprio, fechado ao fim (ou reaproveitado com página nova e isolada a cada captura).
- **Imagem pro modelo:** só a captura que o servidor gerou (data URL `image/jpeg`), nunca uma URL vinda do modelo.
- **Sandpack:** roda num iframe de outra origem (o bundler do CodeSandbox). Os arquivos do aluno vão pra esse iframe, no navegador dele, e nada é guardado lá. Isso tem que estar dito na UI com uma linha discreta ("a prévia React roda no seu navegador").
- **Publicar continua só estático.** Projeto React (`.jsx`/`.tsx` e `package.json` com react) **não publica** no Pages nesta fase: o botão Publicar avisa "Publicação de apps React chega na próxima fase". O caminho landing fica intacto.
- **Fluxo antigo** (`/api/octa/agente`) e as regras do fluxo landing (anti-marca, permissões, R1–R15) não mudam.
- Textos da UI em português.

## Foco da revisão
1. **Turno cortado no meio:** os arquivos já gravados ficam no projeto, e o desfazer continua voltando ao estado de antes do turno. Teste na T1.
2. **HTML com `<script>`, `<meta http-equiv="refresh">`, `<iframe>` ou `file://`:** a captura não executa, não navega e não lê nada fora do projeto. Teste na T2.
3. **Captura falhando ou estourando o tempo:** a tool devolve um erro curto pro modelo e o turno continua. Teste na T3.
4. **Projeto que mistura `index.html` estático e `src/App.jsx`:** a regra de detecção é explícita e testada. Teste na T4.
5. **Saída de erro gigante (stack de 10 mil linhas):** o pedido de correção trunca em cerca de 4 mil caracteres. Teste na T5.

---

### Tarefa 1: Arquivos ao vivo durante o turno + prévia que se redesenha
**Arquivos:** modificar `lib/queue/octa.ts`, `components/octa/useTurnoOcta.ts`, `components/octa/OctaIDE.tsx`. Testes: `lib/queue/octa.test.ts`, `components/octa/OctaIDE.test.tsx`.
**Interfaces:**
- Produz: `processarTurno` chama `salvarArquivos` do projeto **a cada** evento `arquivo` (gravado/apagado), cercado pelo `runId` (se perdeu a posse, não grava).
- O evento `arquivo` continua só com `{path, acao}`, sem conteúdo.
- A IDE, ao receber um evento `arquivo`, relê `GET /api/octa/projetos/[id]` (debounce de 400 ms), aplica os arquivos sem quebrar a foto do desfazer e, se a aba ativa for "Código" e o arquivo for `.html`/`.css`, troca pra "Prévia" uma vez por turno.
- [ ] Testes que falham:
  - turno com 3 escritas → `salvarArquivos` chamado 3 vezes (mais o salvamento final);
  - execução que perdeu o `runId` não grava;
  - IDE: evento `arquivo` dispara um GET e a prévia mostra o HTML novo;
  - desfazer depois do turno volta pro estado de antes (não pro intermediário).
- [ ] Implementar; `npx vitest run lib/queue/octa components/octa` PASSA; commit `feat(octa): arquivos ao vivo durante o turno e prévia que se redesenha`.

### Tarefa 2: Módulo de captura de tela (Chromium headless) + imagem Docker
**Arquivos:**
- Criar: `lib/octa/captura.ts`, `lib/octa/captura.test.ts`.
- Modificar: `Dockerfile` (runtime: `apt-get install chromium fonts-liberation fonts-noto-core`; `ENV OCTA_CHROMIUM_PATH=/usr/bin/chromium`), `package.json`/`package-lock.json` (`puppeteer-core`).
- Para Docker, ver `.dockerignore`.
**Interfaces:**
- Produz `capturarPagina(arquivos: Record<string,string>, opts?: { largura?: number; altura?: number; timeoutMs?: number }): Promise<{ ok: true; jpegBase64: string; largura: number; altura: number } | { ok: false; erro: "sem_index" | "chromium_ausente" | "tempo_esgotado" | "falha_render" }>`.
  - Serve os arquivos do projeto por interceptação num host fictício (`http://projeto.octa.invalid/<path>`) e aplica as restrições globais.
  - `puppeteer-core` é carregado por import dinâmico escondido do bundler (padrão do bullmq/react-dom/server), nunca estático no grafo do Next.
- Produz `capturaDisponivel(): boolean` (o caminho do Chromium existe).
- [ ] **Testes que falham:**
  - Com Chromium: os testes rodam se `OCTA_CHROMIUM_PATH` ou o Chrome local existirem, e senão ficam `skip` com motivo.
    - página simples → JPEG válido (cabeçalho `/9j/`) e mais de 1 KB;
    - `<script>document.body.innerHTML='X'</script>` não executa (o pixel/DOM mostra o original);
    - `<img src="https://evil.example/x.png">` é bloqueada (a requisição vista é abortada);
    - `<meta http-equiv=refresh content="0;url=https://evil.example">` não navega;
    - `file:///etc/passwd` é bloqueado;
    - página pesada estourando 15 s → `tempo_esgotado`.
  - Sempre:
    - sem `index.html` → `sem_index`;
    - sem binário → `chromium_ausente`.
- [ ] Implementar; testes PASSAM localmente (com Chrome) e no CI (skip limpo se não houver Chromium no runner do CI, a menos que o CI instale: preferir instalar `chromium` no job de CI se for barato).
- [ ] `docker build` local opcional; o deploy prova.
- [ ] Commit `feat(octa): captura de tela da página no servidor (chromium headless, JS desligado, rede em allowlist)`.

### Tarefa 3: Tool `octa_ver_pagina`: o agente olha o que construiu
**Arquivos:** modificar `lib/octa/agente.ts` (tool nova, só no fluxo landing; `MsgModelo` aceita `content` com partes `[{type:"text"},{type:"image_url",image_url:{url}}]` numa mensagem `user`), `lib/queue/octa.ts` (o `estado.msgs` persistido **não** guarda a imagem: troca a parte imagem por `"[captura de tela omitida]"` antes de gravar), `lib/octa/modelo.ts` se o gateway precisar de ajuste. Testes: `lib/octa/agente.test.ts`, `lib/queue/octa.test.ts`.
**Interfaces:**
- Consome `capturarPagina` (T2).
- Tool `octa_ver_pagina({ tela?: "desktop"|"celular" })`, risco `read`:
  - captura os arquivos atuais do workspace do turno;
  - a resposta da tool pro modelo é texto curto ("captura anexada: desktop 1280×800");
  - em seguida o laço injeta uma mensagem `user` com a imagem e a instrução "Avalie o layout contra o DESIGN.md: contraste, alinhamento, espaçamento, hierarquia; corrija o que estiver ruim."
- No máximo 3 capturas por turno; depois disso a tool devolve "limite de capturas neste turno".
- Evento `resultado` sem a imagem, e evento novo `captura` com a captura em **miniatura** (JPEG ≤ 60 KB, largura 480) pra IDE mostrar no passo.
- Prompt do fluxo landing: "depois de montar ou editar a página, use octa_ver_pagina pelo menos uma vez antes de terminar".
- [ ] **Testes que falham:**
  - com o modelo dublê pedindo `octa_ver_pagina`, a próxima chamada ao modelo recebe uma mensagem com parte `image_url` (`data:image/jpeg;base64,`);
  - o `estado.msgs` gravado não contém base64;
  - 4ª captura → limite;
  - falha de captura → texto de erro pro modelo e o turno segue;
  - o evento `captura` vem com miniatura ≤ 60 KB.
- [ ] Implementar; `npx vitest run lib/octa lib/queue/octa` PASSA; commit `feat(octa): octa_ver_pagina — o agente vê a captura e corrige o layout`.

### Tarefa 4: React no navegador do aluno (Sandpack) + agente sabe montar app React
**Arquivos:**
- Modificar: `package.json` (`@codesandbox/sandpack-react`), `components/octa/OctaIDE.tsx`, `lib/octa/agente.ts` (prompt), `lib/octa/publicar.ts` ou a rota de publicar (aviso pra projeto React).
- Criar: `components/octa/PreviaReact.tsx`, `lib/octa/tipoProjeto.ts`.
- Testes: `lib/octa/tipoProjeto.test.ts`, `components/octa/PreviaReact.test.tsx`.
**Interfaces:**
- `tipoProjeto(arquivos): "estatico" | "react" | "python"`, com regra explícita:
  - **react** se houver `package.json` com `react` em dependencies, OU `src/App.jsx`/`src/App.tsx`;
  - senão **python** se houver `.py` e nenhum `index.html`;
  - senão **estatico**.
- `PreviaReact({ arquivos, onErros(erros: string[]) })`: Sandpack com template `vite-react` (ou `react` se faltar `vite.config`); os arquivos do projeto são mapeados com `/` na frente; erros de compilação e console `error` vão pra `onErros`.
- Na IDE, a aba "Prévia" usa `PreviaReact` quando o tipo é `react`; a linha "a prévia React roda no seu navegador" fica visível; o tipo `estatico` fica como hoje.
- Prompt do agente: pedido de app React → estrutura Vite (`index.html`, `package.json` com react/react-dom/vite, `src/main.jsx`, `src/App.jsx`, CSS), sem backend; pedido Python → arquivos `.py`, e o aluno clica Rodar.
- Publicar com tipo `react` → código `tipo_nao_publicavel` com a mensagem da restrição global; nada chama o GitHub.
- [ ] **Testes que falham:**
  - tabela do `tipoProjeto` (inclui o caso misto do Foco 4: `index.html` + `src/App.jsx` → react);
  - `PreviaReact` monta com os arquivos (mock do Sandpack) e repassa erros;
  - publicar projeto react → `tipo_nao_publicavel` sem chamada ao GitHub;
  - o prompt contém a estrutura React.
- [ ] Implementar; `npx vitest run lib/octa components/octa app/api/octa` PASSA; `npx next build` PASSA (o Sandpack é client-only: `dynamic(..., { ssr: false })`).
- [ ] Commit `feat(octa): apps React rodando no navegador do aluno (Sandpack)`.

### Tarefa 5: Erros do navegador voltam pro agente
**Arquivos:** modificar `components/octa/OctaIDE.tsx` (e criar um componente pequeno se crescer); teste `components/octa/OctaIDE.test.tsx`; criar `lib/octa/pedidoCorrecao.ts` + teste.
**Interfaces:**
- `pedidoCorrecao({ origem: "python"|"react"|"pagina", arquivo?: string, saida: string }): string` monta o pedido em português: "Rodei X e deu este erro: … Corrija." A saída é truncada em 4000 caracteres, mantendo início e fim e marcando "[… N linhas omitidas …]".
- Botão **"Corrigir com o Octa"**, que aparece quando:
  - a saída do runner Python termina em erro (`RunOutput` com tipo erro);
  - ou o `PreviaReact` reportou erros.
  - O clique envia esse pedido como turno novo pelo fluxo atual (`iniciar`).
- Sem envio automático: o aluno clica.
- [ ] **Testes que falham:**
  - truncamento com 10 mil linhas;
  - o botão aparece só com erro;
  - o clique chama `POST /api/octa/turnos` com o pedido montado.
- [ ] Implementar; testes PASSAM; commit `feat(octa): "Corrigir com o Octa" leva o erro do navegador pro agente`.

### Tarefa 6: Produção
- [ ] PR → CI → merge → deploy.
  - O deploy reconstrói a imagem com Chromium. Conferir o tamanho da imagem e a memória do `zaeon_web` em repouso: o Chromium só sobe sob demanda.
- [ ] **Prova em produção** (aluno fictício, sem GitHub, permissão `antes_de_publicar`, como na prova anterior):
  - pedido de landing → nos eventos aparece `captura` e depois do `octa_ver_pagina` o agente fez ajuste;
  - `capturarPagina` com `<script>` e URL externa fora da allowlist → bloqueados.
  - Limpar tudo.
- [ ] Conferir no navegador (pane):
  - a prévia se redesenhando durante um turno;
  - um projeto React de exemplo rodando no Sandpack;
  - um erro Python → "Corrigir com o Octa".
