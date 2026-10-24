# Tutorial — card #605 · cartão novo da Aura · testes e observações

> Documento de apoio à PR do **#605 — TUTORIAL · CARTÃO NOVO DA AURA (VERSÃO 3)** (branch `605-tutorial-cartao-aura`).
> Tudo aqui foi tirado do código da branch, de execuções reais dos testes e de uma página de prévia aberta no
> navegador nesta máquina (Windows). Onde algo **não foi verificado de verdade**, está marcado como `NÃO VERIFICADO`.

---

## 1. Resumo

| # | Item do card | O que foi feito |
|---|---|---|
| 1 | Retrato da Aura num círculo | Retrato em `/avatars/aura/` (já existiam): **falando** (`talk.sm.webp`) enquanto o texto aparece, **sorrindo** (`smile.sm.webp`) quando para. Etiqueta "AURA" inclinada. |
| 2 | Holograma no retrato | Linhas finas de luz e uma faixa ciano passando pelo rosto a cada ~3,2 s (`transform`, sem mexer no layout). |
| 3 | Triângulo ⟁ | Pisca no fim da fala e gira de vez em quando no botão principal ("Continuar", "Bora", "Próximo"…). |
| 4 | Letra por letra | ~48 letras por segundo; clicar no cartão completa na hora. |
| 5 | Losangos | No lugar dos pontinhos de progresso. |
| 6 | Cores por lugar | Roxo na Sala de Estudos (`TourSala`), ciano no Escritório (`TourEscritorio`); o anel do destaque segue a cor. |
| 7 | Tamanho no computador | 420 px (com a sobra do retrato), retrato de 80 px; a conta de posição (`posicaoDoBalao`) continua garantindo que o cartão não cobre o botão destacado. |
| 8 | Celular | **Não se aplica:** os dois tours só aparecem com a tela ≥ 768 px (regra que já existia — no celular a barra lateral some). O cartão encolhe até a largura da tela − 24 px. |
| 9 | Uma ideia por fala | `lib/onboarding/cartaoTour` divide a fala do roteiro em caixas de até ~140 letras, nas pontas das frases (o texto do handoff **não muda**: as caixas juntas são a fala inteira). Botão "Continuar" entre as caixas. |
| 10 | Letras mais claras | "Pular" e o texto em tons mais claros sobre fundo sólido. |
| 11 | Reduzir movimento e leitor de tela | Com "reduzir movimento": sem animação e texto inteiro na hora. O leitor de tela recebe a **fala inteira de uma vez** (`aria-live`), não letra por letra nem caixa por caixa. Esc, foco no botão e o nome do cartão (a dica) continuam. |
| 12 | Desempenho | Só CSS (sem 3D); sem o desfoque de fundo do cartão antigo; o letra por letra e as animações param com a aba escondida. |

**Banco:** nada muda.

---

## 2. Como rodar

```bash
npx vitest run components/onboard lib/onboarding
npx tsc --noEmit
```

Resultado nesta máquina:
- **Tutoriais:** 55 testes passam (5 arquivos).
- **`tsc`:** não mostra erro nos arquivos do tutorial. Os erros que ele mostra nesta máquina são de modelos novos do banco no main (`blueprint`, `cofre`), com o cliente Prisma local desatualizado, e de pacotes que faltam aqui (`pg`, `sandpack-react`).
- **Suíte inteira:** 4529 passaram e 27 falharam. Nenhuma falha é do tutorial:
  - `leitor/compose`, `octa/fortify` e `octa/genart` já falham no Windows.
  - `rag`, `octa/PreviaReact` e **`agent/runChatTurn`** (18 testes) não carregam porque falta aqui o pacote `pg`, que o chat da Aura passou a importar no main ("Failed to load url pg").
  - O CI do GitHub instala tudo e é a prova final.

---

## 3. O que os testes automáticos garantem

- **Caixas** (`lib/onboarding/cartaoTour.test.ts`):
  - Para **todas** as falas dos dois tours, as caixas juntas dão exatamente a fala do roteiro.
  - Nenhuma caixa passa do limite, a não ser uma frase sozinha.
  - O emoji fica com a frase que ele fecha.
  - Não corta dentro de aspas nem em "ex.:".
- **Letra por letra** (`cartaoTour.test.ts`): aparece aos poucos, para no fim e nunca corta um emoji ao meio.
- **Cartão** (`components/onboard/TourSala.test.tsx`):
  - Os dois tours andam do começo ao fim como antes, passando pelas caixas com "Continuar".
  - Só a 1ª caixa aparece primeiro.
  - Clicar no cartão completa o texto.
  - O leitor de tela recebe a fala inteira.
  - Com "reduzir movimento", o texto vem inteiro na hora.
  - Tem o retrato e a etiqueta AURA.
  - O Escritório é ciano.
  - Nada de dourado.

---

## 4. Verificado no navegador (página de prévia, sem login)

Uma página de prévia (fora do projeto) montou o cartão de verdade (`OverlayTour`) ao lado de um botão de exemplo.

- **Visual:** roxo (Sala de Estudos, 1º passo) e ciano (Escritório, 2º passo), com retrato, etiqueta, losangos e "Continuar ⟁". O anel do destaque fica em volta do botão, na cor do cartão.
- **"Reduzir movimento":** o navegador da prévia estava com essa opção **ligada**. O cartão desligou as animações e mostrou o texto inteiro, como planejado. Forçando as regras de animação só naquela página, o anel brilha, a faixa do holograma anda (por `transform`) e o triângulo gira.
- **Desempenho:** atraso da linha principal da página (a mesma do chat), amostrado a cada 20 ms:
  - parado: mediana 0 ms, pior 4 ms;
  - com o texto aparecendo letra por letra: mediana 0 ms, pior 8 ms.

  Travada perceptível começa em ~50 ms. A medição de quadros por segundo **não** foi feita: o painel do navegador estava escondido, e página escondida pausa as animações. `NÃO VERIFICADO`: fps com o chat respondendo ao mesmo tempo, logado.

---

## 5. Teste manual no zaeon.com.br (depois do deploy)

Os tours aparecem **uma vez por navegador**. Para ver de novo, abra o console (F12) e rode:

```js
localStorage.removeItem("zaeon.tour.sala.v2"); localStorage.removeItem("zaeon.tour.escritorio.v1");
```

Depois dê Ctrl+F5 com o laboratório aberto, numa tela de computador.

1. **Sala de Estudos:**
   - O cartão roxo aparece com a Aura.
   - O texto vem letra por letra, e o retrato "fala".
   - "Continuar ⟁" passa as caixas.
   - Pedindo um estudo, o tour anda sozinho como antes.
2. **Clicar no cartão** no meio do texto completa na hora.
3. **Escritório:** abra a aba Escritório e confira que o cartão é **ciano**.
4. **Não cobre:** em cada passo, o botão destacado fica visível e clicável.
5. **Esc** pula o tour.
6. **"Reduzir movimento"** (Windows: Configurações → Acessibilidade → Efeitos visuais → Efeitos de animação desligado): sem animação e texto inteiro.

---

## 6. Observações

- **Uma caixa longa:** no passo "Sala de Estudos", a 2ª caixa é uma frase só de 181 letras ("Pensa nela como um caderno vivo…"). A regra não corta frase no meio. Se quiserem mais curta, é ajustar o texto do roteiro (`lib/onboarding/tourSala.ts`, falas do handoff), com o ok do Martinez.
- **O símbolo ⟁** usa a fonte do sistema quando a fonte do site não tem esse caractere; aparece como um triângulo pequeno, igual ao resto do laboratório.
- **Fora deste card:** o tutorial do tablet (1ª missão, `BalaoDroid`) e o do metaverso não mudaram.
