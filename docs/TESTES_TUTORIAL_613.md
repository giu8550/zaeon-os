# Tutorial — card #613 · correções e "Sua vez" · testes e observações

> Documento de apoio à PR do **#613 — TUTORIAL · CORREÇÕES E "SUA VEZ"** (branch `613-tutorial-correcoes-sua-vez`).
> Tudo aqui foi tirado do código da branch, de execuções reais dos testes e de uma página de prévia do cartão aberta
> no navegador nesta máquina (Windows). Onde algo **não foi verificado de verdade**, está marcado como `NÃO VERIFICADO`.
> A correção que o card pedia antes (a conversa excluída que voltava) já está no main (#614).

---

## 1. Resumo

| # | Item do card | O que foi feito |
|---|---|---|
| 1 | Passo do diagrama travava | Anda com **qualquer documento visual que abre em aba** (`KINDS_EM_ABA`: diagrama e aula). Um documento de outro tipo não conta. |
| 2 | A tarefa sumia da tela | Caixa **"Sua vez"** na última caixa da fala dos passos de ação: a tarefa em uma linha, até a pessoa fazer. |
| 3 | Esc pulava tudo, até digitando | Esc com o cursor num campo de texto (chat, busca, `contenteditable`) é ignorado pelo tutorial. Fora dele, o Esc **pergunta** antes. |
| 4 | Passo 1 pedia um botão que pode não existir | O "Sua vez" tem o exemplo **"Quero estudar sobre fotossíntese"**, que escreve no campo do chat. Funciona com conversa antiga (sem o botão "Quero estudar sobre…"). |
| 5 | Destaque na saudação | O destaque só acende na **última caixa** da fala (junto com o "Sua vez"). |
| 6 | Boca aberta pra sempre | Parada = `idle.sm.webp` (boca fechada). |
| 7 | "Sua vez" com exemplo | Clicar no exemplo **escreve** no campo (a pessoa revisa e manda; o passo só anda quando a mensagem é enviada). Evento novo `zaeon:chat:preencher`, ouvido em `StudyCoworkChat`. |
| 8 | Diagrama nunca trava | Item 1 + botão **"Já fiz ✓"** no passo do diagrama. "Mapa" não entrou na lista: o mapa do percurso já é o passo seguinte. |
| 9 | Percurso com aviso | O "Sua vez" acompanha o botão do percurso: **"Gerando o teu percurso… ⏳"** e depois **"Pronto! 🎉 Clica no ✦ de novo pra abrir o mapa"** (evento novo `zaeon:percurso:estado`, disparado pelo chat quando o estado muda). |
| 10 | "Passo X de Y" | Escrito ao lado dos losangos. |
| 11 | Pular com confirmação | "Pular" e Esc mostram **"Pular o tutorial?"** com **Sim, pular** / **Continuar tutorial** (o foco vai pro "Continuar tutorial"). |
| 12 | Minimizar | Botão **–** no canto do cartão: vira uma pílula no canto de baixo à direita ("Passo X de Y · abrir" + a tarefa), sem escurecer a tela. Minimizar **não** é pular. Fazendo a ação minimizado, o próximo passo volta aberto. |
| 13 | Rever sem console | Configurações → **Geral** → **Laboratório · Rever tutorial**: esquece os dois tours. O da Sala de Estudos recomeça na hora (se o laboratório está aberto); o do Escritório, na próxima vez que a aba dele abrir. O "Modo tutorial" do cyberespaço **não mudou**. Lugar do botão: **confirmar com o Martinez**. |
| 14 | Limpeza | Removidos os seletores `sala-estudos` e `diagrama`, que não existem mais na tela. |
| 15 | Contorno invisível com "reduzir movimento" | O contorno do destaque é fixo no CSS; a animação só faz ele "respirar". |

Também: quando o cartão cresce (o "Sua vez", a confirmação), ele **recalcula a altura** e continua sem cobrir o que destaca (na prévia, o cartão ficou 18 px acima do campo).

**Banco:** nada muda.

---

## 2. Como rodar

```bash
npx vitest run components/onboard lib/onboarding
```

Resultado nesta máquina: **5 arquivos, 74 testes, todos passando**.

Testes novos (em `components/onboard/TourSala.test.tsx` e `lib/onboarding/tourSala.test.ts`):

- Esc pergunta antes; confirmando, pula e marca como visto.
- Esc digitando num `textarea` não mexe no tutorial.
- Pular pede confirmação e dá pra voltar.
- Na saudação não tem "Sua vez" nem destaque; na última caixa tem os dois.
- O exemplo dispara `zaeon:chat:preencher` com o texto e o passo **não** anda sozinho.
- A IA respondeu com uma aula: o passo do diagrama anda. "Já fiz ✓" também.
- Percurso: "Clica no ✦" → "Gerando…" → "Pronto!".
- Minimizar e reabrir; fazer a ação minimizado reabre no próximo passo.
- "Rever tutorial" apaga as duas chaves e recomeça a sala do passo 1.
- Todo passo de ação tem a tarefa escrita.

Suíte completa: ver a seção 4.

---

## 3. O que foi verificado no navegador (prévia do cartão)

Página de prévia com o `OverlayTour` de verdade e um campo de texto no lugar do chat, a 1280×760:

- Saudação sem destaque; última caixa com "Sua vez" e destaque.
- Clicar no exemplo escreveu "Quero estudar sobre fotossíntese" no campo.
- Esc com o cursor no campo: nada. Esc fora: "Pular o tutorial?".
- Confirmação numa linha só (28 px de altura), foco em "Continuar tutorial".
- Minimizar: pílula no canto (16 px das bordas), sem escurecer; clicar reabre.

`NÃO VERIFICADO` no app de verdade (só em produção/local com login): o exemplo chegando no campo do chat real, o "gerando/pronto" com o percurso real, e o botão "Rever tutorial" dentro das Configurações.

---

## 4. Suíte completa

`npx vitest run` nesta máquina: **4594 passaram, 30 falharam, 10 pulados** (535 arquivos).

Nenhuma falha é desta branch. São as mesmas que já falhavam antes neste Windows:

- **Sem pacotes locais** (`pg`, sandpack): `rag/*`, `queue/rag`, `api/admin/rag`, `api/rag/minha-base`, `runChatTurn`, `videodoc/anexo`, `octa/PreviaReact`.
- **Windows/tempo:** `leitor/compose`, `octa/fortify`, `octa/genart`, `studio/storage`.
- **`avatars/estudio`:** falhou por tempo na suíte cheia e **passa sozinho** (4/4). Esta branch não mexe em avatares.

O CI (Linux) é quem confirma.

---

## 5. Como testar em produção (depois do deploy)

Usar uma conta onde o tour já foi visto: Configurações → Geral → **Rever tutorial**. Computador (tela ≥ 768 px).

1. **Rever tutorial** recomeça o tour da Sala de Estudos no passo 1, sem console.
2. Passo 1: a saudação **não** tem destaque. Na última caixa aparece **"Sua vez"** e o destaque no campo.
3. Clicar em **"Quero estudar sobre fotossíntese"**: a frase vai pro campo. O tour só anda depois de **mandar**.
4. Com uma **conversa antiga aberta** (sem o botão "Quero estudar sobre…"), o passo 1 funciona pelo exemplo.
5. Digitar no chat e apertar **Esc**: o tutorial continua. Clicar fora e apertar Esc: pergunta "Pular o tutorial?". **Continuar tutorial** volta.
6. Passo do diagrama: pedir o diagrama. Se a Aura responder com uma **aula**, o passo anda. Se responder só com texto, **"Já fiz ✓"** segue.
7. Passo do percurso: clicar no ✦ → aparece **"Gerando o teu percurso… ⏳"** → depois **"Pronto! … abrir o mapa"**.
8. **Minimizar** (–): o cartão vira uma pílula no canto; dá pra ler a resposta; clicar na pílula reabre.
9. **"Passo X de Y"** escrito; a Aura de **boca fechada** quando para de falar.
10. Escritório: com "reduzir movimento" ligado no Windows, o contorno do destaque aparece.
11. Abrir o Escritório depois do "Rever tutorial": o tour dele aparece de novo.
