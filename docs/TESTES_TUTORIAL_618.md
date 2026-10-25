# Tutorial — card #618 · botões cortados, contorno e dicas rápidas · testes e observações

> Documento de apoio à PR do **#618 — TUTORIAL · BOTÕES CORTADOS, CONTORNO E DICAS RÁPIDAS**
> (branch `618-tutorial-botoes-contorno-dicas`). Tudo aqui foi tirado do código da branch, de execuções reais dos testes
> e de uma página de prévia do cartão aberta no navegador nesta máquina, na medida da tela do notebook da equipe
> (1366×768 → área da página 1366×643). Onde algo **não foi verificado de verdade**, está marcado como `NÃO VERIFICADO`.

---

## 1. Resumo

| # | Item do card | O que foi feito |
|---|---|---|
| 1, 2, 5 | Botão de seguir fora da tela (Escritório passo 1; mapa no passo 5) | O cartão **não encolhe mais** (`posicaoDoBalao` ganhou `minW`; o cartão dos tours passa a largura dele). Sem vão largo do lado, ele vai pra um **canto por cima** do destaque. Por garantia: a linha dos botões **quebra** (`flex-wrap`) e a posição é presa nas bordas. O balão do Droid (tablet) continua como era. |
| 3 | Contorno no botão "Quero estudar sobre" | O passo 1 destaca o **campo de mensagem** (um caminho só). |
| 4, 6 | Contorno parado | Evento novo `zaeon:chat:texto` (o chat avisa quando o campo fica com texto ou vazio). Com texto, o contorno vai pro **➤ enviar** e o "Sua vez" vira **"Agora é só mandar ➤"**; apagou, volta pro campo. Vale nos dois passos de escrever (estudo e diagrama). O cartão continua sem cobrir o campo. |
| 7 | Exemplo confuso | "**Usar o exemplo:** “…”" e, embaixo, "Vai pro campo de mensagem, é só apertar ➤". |
| 8 | Cartão pulando entre as caixas | `posicaoEstavel` (`lib/onboarding/cartaoTour`): dentro do mesmo passo o cartão fica parado — em cima do destaque ele cresce pra cima (base fixa), senão pra baixo. Só muda se passaria da tela ou cobriria o destaque. |
| 9 | Minimizar invisível | Botão **"Minimizar"** escrito na linha dos botões e, no canto, uma **setinha com borda** no lugar do "–". |
| 10 | Dicas da Sala de Estudos | A Sala de Estudos hoje é o **blueprint** (`SalaBlueprint`), então as dicas falam dele: (1) cada conversa que vira estudo ganha um blueprint em cima, com a fase e os críticos; (2) as 4 fases, os críticos que destravam cada uma, a prova (link) e o mentor no fim. Só aparecem com um blueprint aberto. |
| 11 | Dicas do Perfil | (1) As habilidades se preenchem com o uso e **aparecem pra quem abre o perfil** (elas não são preenchidas pela pessoa — o texto do card foi ajustado pra bater com a tela); (2) "Editar" troca foto e curso, a skin fica embaixo do personagem. Só no **próprio** perfil. |
| 12 | Rever tutorial | O "Rever tutorial" também esquece as dicas (`zaeon.dica.*`). |

**Dicas rápidas** (`components/onboard/DicasRapidas`, `lib/onboarding/dicas`): um balão por vez, só na 1ª vez, com **"Entendi"**;
sem "Passo X de Y", sem minimizar, sem "Pular?" (o Esc fecha direto). Esperam um tour terminar. Só no computador (≥ 768 px).

**Arquivos de outras áreas tocados (mínimo):** `components/blueprint/SalaBlueprint.tsx` (2 marcações `data-tour` + as dicas),
`components/research/EditableProfile.tsx` (2 marcações + as dicas), `components/study/CoworkComposer.tsx` (marcação no ➤).

**Banco:** nada muda.

---

## 2. Como rodar

```bash
npx vitest run lib/onboarding components/onboard components/research components/blueprint
```

Resultado nesta máquina: **111 testes, todos passando**. Novos:

- `lib/onboarding/tutorialLab.test.ts`: cartão na largura cheia e dentro da tela em 6 tamanhos de tela, com o mapa/canal ocupando a tela e varrendo centenas de posições de destaque; o Droid continua podendo estreitar.
- `lib/onboarding/cartaoTour.test.ts`: o cartão fica parado (cresce pra cima / pra baixo) e só muda quando precisa.
- `components/onboard/TourSala.test.tsx`: contorno campo → ➤ → campo; "Agora é só mandar"; exemplo com legenda; botão "Minimizar".
- `lib/onboarding/tourSala.test.ts`: o passo 1 destaca o campo.
- `components/onboard/DicasRapidas.test.tsx`: uma dica por vez, "Entendi", uma vez só, Esc fecha, celular não, "Rever" traz de volta; dicas do blueprint.

---

## 3. Verificado no navegador (prévia, 1366×643)

Todos os passos da Sala e do Escritório, todas as caixas de cada fala:

| Caso | Antes | Depois |
|---|---|---|
| Sala, passo 5 (mapa) | cartão espremido (303 px), "Boa jornada" fora da tela | cartão 420 px no canto de cima, cobre ~1% do mapa, botões visíveis |
| Escritório, passo 1 (canal) | "Continuar"/"Próximo" fora da tela | igual ao de cima |
| Sala, passo 1 | cartão em 3 lugares diferentes nas 3 caixas | mesmo lugar nas 3 (cresce pra cima) |
| Todos | — | nenhum botão fora da tela, nada cobrindo o destaque |

Dica do Perfil: aparece ao lado do que aponta, uma caixa só, só com "Entendi".

`NÃO VERIFICADO` no app de verdade (só em produção, com login): o contorno indo pro ➤ no chat real, as dicas dentro do
blueprint e do perfil reais.

---

## 4. Suíte completa

`npx vitest run` nesta máquina: **4636 passaram, 29 falharam, 10 pulados** (538 arquivos).

Nenhuma falha é desta branch. São as mesmas que já falhavam neste Windows:

- **Sem pacotes locais** (`pg`, sandpack): `rag/*`, `queue/rag`, `api/admin/rag`, `api/rag/minha-base`, `runChatTurn`, `videodoc/anexo`, `octa/PreviaReact`.
- **Windows/tempo:** `leitor/compose`, `octa/fortify`, `octa/genart`, `studio/storage`.

O `tsc` local acusa `prisma.blueprint` nas rotas de blueprint: é o cliente Prisma desatualizado nesta máquina, não esta branch.
O CI (Linux) é quem confirma.

---

## 5. Como testar em produção (depois do deploy)

Na tela do notebook (1366×768). Começar por Configurações → Geral → **Rever tutorial**.

1. **Escritório:** abrir a aba. No 1º passo, o **"Continuar"** aparece e dá pra ir até o fim ("Bora trabalhar! 🚀").
2. **Sala, passo 1:** o contorno fica no **campo de mensagem**. Escrever algo → o contorno vai pro **➤** e aparece "Agora é só mandar ➤". Apagar → volta pro campo.
3. **Exemplo:** "Usar o exemplo: “Quero estudar sobre fotossíntese”" com a legenda embaixo.
4. **Continuar** entre as caixas do passo 1: o cartão **não muda de lugar**.
5. **Minimizar:** escrito na linha dos botões, e a setinha no canto.
6. **Passo 5 (mapa):** cartão no canto de cima, inteiro, com o **"Boa jornada! 🚀"** visível.
7. **Sala de Estudos (blueprint):** com um blueprint aberto, 2 dicas com "Entendi". Não voltam depois.
8. **Perfil (o seu):** 2 dicas com "Entendi". No perfil de outra pessoa, nenhuma.
9. **Rever tutorial** de novo: as dicas voltam.
