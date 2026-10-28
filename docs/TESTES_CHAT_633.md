# Chat — card #633 · botão do cérebro ao lado do A−/A+ · testes

> Card do Martinez: **"CHAT: colocar o botão de visualizar o cérebro ao lado dos moduladores do tamanho das letras, ao
> lado direito do painel."** Branch `633-chat-cerebro-ao-lado-letras`.

## O que mudou

- **Chat da Sala de Estudos** (`components/study/StudyCoworkChat.tsx`): no chat único, o botão do mapa ("Gerar mapa" /
  "Traçar percurso" / "Ver mapa") ficava no canto **esquerdo** da linha de cima. Agora fica à **direita**, logo antes do
  **A− A+** — os controles da conversa juntos. Fora do chat único ele já ficava ali; agora é igual nos dois modos.
- **Chat da Pesquisa** (`components/research/ResearchChat.tsx`): a bolinha do cérebro também foi pra direita, do lado
  do A−/A+ (quando ela não está no topo da sala, que continua igual).
- O painel do mapa continua abrindo do mesmo jeito; o tutorial (passo do percurso) acha o botão pela marcação, não
  pela posição — continua funcionando.

**Banco:** nada muda.

## Como rodar

```bash
npx vitest run components/study components/research components/chat components/cerebro components/onboard lib/onboarding
```

Resultado nesta máquina: **172 testes, todos passando**.

`NÃO VERIFICADO` no app de verdade (precisa de login): a posição nova na tela.

## Como testar em produção

1. Sala de Estudos → uma conversa que já virou estudo: o botão do mapa aparece **à direita**, do lado do **A− A+**.
2. Clicar nele abre o mapa como antes.
3. Sala de Pesquisa: a bolinha do cérebro também fica à direita, do lado do A−/A+.
4. Tutorial (Configurações → Rever tutorial), passo do percurso: o contorno aponta o botão na posição nova.
