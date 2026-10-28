# Chat da Aura — card #640 · abas cortadas e ajustes no diagrama · testes e observações

> Documento de apoio à PR do **#640 — CHAT DA AURA · ABAS CORTADAS E AJUSTES NO DIAGRAMA**
> (branch `640-abas-cortadas-diagrama`). Tudo aqui foi tirado do código da branch e de execuções reais dos testes
> nesta máquina. Onde algo **não foi verificado de verdade**, está marcado como `NÃO VERIFICADO`.

---

## 1. Resumo

| # | Item do card | O que foi feito |
|---|---|---|
| 1, 2 | Abas cortadas com documento, mapa, trabalho, blueprint ou árvore aberto | As 5 telas que abrem por cima da conversa começavam a **46 px fixos** do topo; com o botão "Ver mapa" a barra das abas ficou mais alta (~56 px) e elas cobriam a parte de baixo das abas. Agora a barra (`PastasEmpilhadas`) **mede a própria altura** (`aoMedirAltura`, com `ResizeObserver`) e o `StudyCoworkChat` põe essa medida numa variável CSS (`--topo-pastas`); as 5 telas usam `top: var(--topo-pastas, 46px)`. Se a barra mudar de tamanho de novo, elas acompanham. |
| 3 | ↗ grudado no título do diagrama | Na aba inteira (documento), os botões do diagrama (↗ abrir numa aba) vão pro **canto de baixo à esquerda** — o título do diagrama mora no canto de cima. Dentro da resposta do chat, continuam em cima. |
| 4 | Diagrama que não abre | O erro agora tem o botão **"Tentar de novo"**, que busca o diagrama de novo sem fechar a aba. |

A Sala de Pesquisa (`ResearchShell`) usa as mesmas abas, mas organiza as telas de outro jeito (sem altura fixa) — não cortava.

**Banco / servidor:** nada muda.

---

## 2. Como rodar

```bash
npx vitest run components/chat/PastasEmpilhadas.test.tsx components/studio components/study components/cerebro
```

Novos testes:

- `components/chat/PastasEmpilhadas.test.tsx`: a barra avisa a altura medida e avisa de novo quando ela muda.
- `components/studio/DiagramView.test.tsx`: erro → "Tentar de novo" → busca de novo e abre; na aba inteira o botão fica embaixo, na resposta fica em cima.

---

## 3. Suíte completa

`npx vitest run` nesta máquina: **4717 passaram, 29 falharam, 10 pulados** (549 arquivos).

As 29 são as de sempre deste Windows, nenhuma desta branch: sem pacotes locais (`pg`, sandpack — `rag/*`, `queue/rag`,
`api/admin/rag`, `api/rag/minha-base`, `runChatTurn`, `videodoc/anexo`, `octa/PreviaReact`) e Windows/tempo
(`leitor/compose`, `octa/fortify`, `octa/genart`, `studio/storage`). O CI (Linux) é quem confirma.

---

## 4. Como testar em produção (depois do deploy)

1. **Ctrl+Shift+R**.
2. No chat da Aura, abra um **diagrama** nas abas de cima: as abas de trás ("Conversa" e as outras) aparecem **inteiras**, como quando a "Conversa" está aberta.
3. Clique em **Ver mapa**: as abas continuam inteiras (inclusive a da frente).
4. Se tiver, abra também um trabalho (TCC) ou a árvore de habilidades: mesma coisa.
5. No diagrama aberto, o ↗ fica no **canto de baixo à esquerda**, longe do título.
6. "Tentar de novo": difícil de forçar em produção — coberto pelo teste.

`NÃO VERIFICADO` no app de verdade: a medida da barra no navegador (os testes simulam a medida).
