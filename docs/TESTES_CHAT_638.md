# Chat da Aura — card #638 · botão do mapa depois do A−/A+ · testes e observações

> Documento de apoio à PR do **#638 — CHAT DA AURA · BOTÃO DO MAPA DEPOIS DO A−/A+**
> (branch `638-mapa-depois-das-letras`). Tudo aqui foi tirado do código da branch e de execuções reais dos testes
> nesta máquina. Onde algo **não foi verificado de verdade**, está marcado como `NÃO VERIFICADO`.

---

## 1. Resumo

| # | Item do card | O que foi feito |
|---|---|---|
| 1 | Botão do mapa depois das letras | `StudyCoworkChat` e `ResearchChat`: a ordem agora é **A− A+ [Ver mapa]** (só a ordem mudou; continua tudo à direita, como no #633). |
| 2 | O que é o número | O número do anel é a **% do percurso aprendido** (etapas marcadas como aprendidas ÷ todas as etapas — `lib/map/backbone.ts`). A dica do mouse (e o `aria-label`) agora diz **"Ver mapa · 38% aprendido"**. Os outros estados ("Traçar percurso", "Gerando o mapa…") seguem iguais. |
| 3 | O cartão do tutorial cobria o "Exportar" | O "Exportar" do diagrama mora **dentro** do diagrama (uma página embutida), então não dá pra marcar o botão. O `DocumentoArtefato` ganhou uma **faixa invisível** (`data-tour="doc-topo"`, sem pegar clique) por cima da barra de cima de qualquer documento aberto (diagrama, aula, livro). O passo do percurso pede pro cartão **não cobrir** essa faixa: ele desce pra baixo dela. Sem documento aberto, nada muda. |
| 4 | Contorno na posição nova | O contorno segue o próprio botão (`data-tour="gerar-percurso"`) — mudou de lugar, ele vai junto. |

**Banco / servidor:** nada muda no banco. No servidor, a correção abaixo.

### Junto: correção do #634 (a caixa de código não aparecia)

No teste de produção do #634, o código da Aura saiu como parágrafo: o `python` solto numa linha e o `# comentário`
virando título. A Aura **escreve** o ```` ```python ```` certo, mas a resposta dela vem como JSON e o leitor desse JSON
(`lib/llm/envelope.ts`, `parsearJsonRes` e `textoJsonValido`) apagava **todo** ```` ``` ```` do texto — a ideia era tirar só a
cerca ```` ```json ```` em volta, mas ia junto a de dentro das respostas.

Agora `semCercaJson` tira **só** a cerca de fora (no começo e no fim). Teste novo em `lib/llm/envelope.test.ts`: com e sem a
cerca em volta, o ```` ```python ```` de dentro da resposta fica. Área do Martinez (envelope) — mudança pequena, só a limpeza.

---

## 2. Como rodar

```bash
npx vitest run components/cerebro components/studio/DocumentoArtefato.test.tsx lib/onboarding components/onboard lib/llm/envelope.test.ts
```

Novos testes:

- `components/cerebro/BolinhaCerebro.test.tsx`: no estado "ver mapa", a dica diz **"Ver mapa · 38% aprendido"**; os outros estados seguem com o nome de sempre.
- `components/studio/DocumentoArtefato.test.tsx`: a faixa do topo existe, é invisível e não pega clique.
- `lib/onboarding/tourSala.test.ts`: o passo do percurso evita a faixa do topo do documento.

---

## 3. Suíte completa

`npx vitest run` nesta máquina: **4712 passaram, 30 falharam, 10 pulados** (548 arquivos).

29 são as de sempre deste Windows (`pg`, sandpack, `leitor/compose`, `octa/fortify`, `octa/genart`, `studio/storage`,
`runChatTurn`…). A 30ª, `lib/octa/p7.test.ts`, **passa sozinha** (8 de 8, aqui e no `main`) — foi lentidão com a suíte
inteira rodando ao mesmo tempo. O CI (Linux) é quem confirma.

---

## 4. Como testar em produção (depois do deploy)

1. **Ctrl+Shift+R**.
2. No chat da Aura: a ordem é **A− A+ [Ver mapa]** (o botão do mapa no cantinho da direita).
3. Passa o mouse no "Ver mapa": aparece **"Ver mapa · N% aprendido"**.
4. Configurações → Geral → **Rever tutorial** e vai até o passo do percurso **com um diagrama aberto**:
   - o contorno fica no botão, na posição nova;
   - o cartão da Aura fica **abaixo** da barra de cima do diagrama — o **"Exportar"** fica à mostra.
5. Clica pra gerar → "Gerando o mapa…" → "Pronto!" → abre o mapa (igual ao #633).
6. **Código (o #634 de novo):** pede *"me mostra um exemplo em Python de como somar uma lista"* → o código numa **caixa
   escura**, com **python** e **Copiar** em cima; o `# comentário` cinza (não título). Copiar → cola no bloco de notas.

`NÃO VERIFICADO`: a posição exata do cartão na tela real (depende do tamanho da janela) — o passo 4 confere.
