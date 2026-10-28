# Chat — card #634 · código destacado no que o agente escreve · testes e observações

> Documento de apoio à PR do **#634 — CHAT: DOCUMENTO CRIADO PELO AGENTE DEVE CONTER CÓDIGO DE MANEIRA MAIS DESTACADA**
> (branch `634-chat-codigo-destacado`). Tudo aqui foi tirado do código da branch, de execuções reais dos testes e de
> uma página de prévia aberta no navegador nesta máquina. Onde algo **não foi verificado de verdade**, está marcado
> como `NÃO VERIFICADO`.

---

## 1. O problema

O card veio só com o título. O que estava acontecendo: o formatador das respostas (`ChatMarkdown`) **não conhecia
bloco de código** (```` ```python … ``` ````). O código saía como parágrafo comum:

- as crases (```` ``` ````) apareciam na tela;
- o `# comentário` do Python virava **título**;
- `*` virava itálico e `$…$` virava fórmula **dentro do código**;
- a indentação sumia no meio do texto.

## 2. O que mudou

| Onde | O quê |
|---|---|
| `lib/chat/matematica.ts` | `segmentarBlocos` reconhece ```` ```lang … ``` ```` como bloco `codigo` (o ```` ```grafico ```` continua gráfico). O de dentro fica **cru**. Durante o streaming, o bloco ainda sem fecho já é código (o `#` não pisca como título). `$` dentro do código não conta como matemática. Novo `temBlocoDeCodigo`. |
| `components/chat/BlocoCodigo.tsx` | A caixa: **escura nos dois temas**, a linguagem em cima, botão **Copiar** (vira "Copiado"), rolagem pro lado (código não quebra linha) e tamanho que segue o A−/A+. |
| `lib/chat/codigo.ts` | Cores leves sem biblioteca: comentário, texto entre aspas, número e palavra-chave comum. O comentário depende da linguagem (`#` Python/shell, `--` SQL, `//` e `/* */` no resto). `text`/`output` ficam sem cores. |
| `ChatMarkdown.tsx` | Usa a caixa. O `código` inline (numa linha) ganhou borda e cor, pra também destacar. |
| `RichText.tsx` (Sala de Pesquisa) | Texto com bloco de código vai pro `ChatMarkdown` (antes saía com as crases). |
| `MagazineAnswerView.tsx` | Resposta com bloco de código **não vira revista** (o canvas desenharia o código como prosa). |
| `lib/tcc/latexTexto.ts` | O texto sem LaTeX do TCC mantém o bloco de código como estava. |

Vale pra todo lugar que usa o `ChatMarkdown`: Sala de Estudos, Sala de Pesquisa, celular e o Escritório.

**Banco / servidor:** nada muda.

---

## 3. Como rodar

```bash
npx vitest run lib/chat lib/tcc components/study/ChatMarkdown.test.tsx components/study/MagazineAnswerView.codigo.test.tsx components/research/RichText.test.tsx
```

Novos testes:

- `lib/chat/matematica.test.ts`: ```` ```python ```` vira código com a linguagem e o de dentro cru; sem linguagem vale; ```` ```grafico ```` segue gráfico; sem fecho (streaming) vai até o fim; `$$` dentro do código não é fórmula.
- `lib/chat/codigo.test.ts`: comentário/string/número/palavra-chave sem perder nenhum caractere; comentário certo por linguagem; `#` sem linguagem só no começo da linha; `text` sem cores.
- `components/study/ChatMarkdown.test.tsx`: a caixa aparece com a linguagem e "Copiar", sem crases, sem título falso; **Copiar** põe o código na área de transferência.
- `components/research/RichText.test.tsx`: bloco de código vira a caixa.
- `components/study/MagazineAnswerView.codigo.test.tsx`: resposta longa com código não vira revista.

---

## 4. Verificado no navegador (prévia)

Uma resposta com Python e JavaScript, no tema claro e escuro: caixa escura, linguagem em cima, Copiar, comentário em
cinza itálico, texto entre aspas em verde, números em amarelo, palavras-chave em azul. O `R$ 0` do texto continua texto.

`NÃO VERIFICADO` no app de verdade: uma resposta real do agente com código (depende do que o modelo escreve).

---

## 5. Suíte completa

`npx vitest run` nesta máquina: **4709 passaram, 29 falharam, 10 pulados** (546 arquivos).

As 29 falhas são as mesmas que já falhavam neste Windows antes desta branch (mesmo número do #631):

- **Sem pacotes locais** (`pg`, sandpack): `rag/*`, `queue/rag`, `api/admin/rag`, `api/rag/minha-base`, `runChatTurn`, `videodoc/anexo`, `octa/PreviaReact`.
- **Windows/tempo:** `leitor/compose`, `octa/fortify`, `octa/genart`, `studio/storage`.

O CI (Linux) é quem confirma.

---

## 6. Como testar em produção (depois do deploy)

1. **Ctrl+Shift+R**.
2. Na Sala de Estudos, peça: *"me mostra um exemplo em Python de como somar uma lista"*.
3. O código aparece numa **caixa escura**, com **python** em cima e **Copiar** à direita; nada de ```` ``` ```` na tela.
4. O `# comentário` fica cinza, **não** vira título.
5. Clica em **Copiar** → vira "Copiado"; cola num bloco de notas: o código vem inteiro, com a indentação.
6. Linha de código comprida: a caixa rola pro lado (a página não).
7. Testa no tema claro e no escuro, e com A−/A+ (o código acompanha o tamanho).
8. Na Sala de Pesquisa, o mesmo pedido: a mesma caixa.
