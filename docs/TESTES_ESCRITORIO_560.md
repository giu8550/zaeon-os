# Escritório — card #560 · testes e observações

> Documento de apoio à PR do **#560 — CORREÇÃO ESCRITÓRIO 10** (branch `560-correcao-escritorio-10-frases-reconexao`).
> Tudo aqui foi tirado do código da branch e de execuções reais dos testes nesta máquina (Windows).
> Onde algo **não foi verificado de verdade**, está marcado como `NÃO VERIFICADO`.

---

## 1. Resumo

| # | Item do card | O que foi feito | Commit |
|---|---|---|---|
| 1 | "vocês duas podem sair" tirou três agentes | Com número ("duas", "dois", "ambas", "três"), saem só as N agentes que **falaram por último**. Sem número ("vocês", "todas"), saem todas, como antes. Quem nunca falou fica por último na conta. | `04f795b` |
| 2 | "teo me explicou mal" chamava o Téo | Nome + "me/te/nos/lhe" + verbo que conta algo dele ("explicou", "disse", "foi"…) é falar SOBRE a agente. | `d7a03de` |
| 3 | "explica você" depois de criticar a agente da vez | Sem @ e sem chamar ninguém, se a mensagem cita a agente da vez e fala com "você/vc/tu", responde a **outra** agente da conversa (a última que falou). Sem outra, a da vez responde. | `04f795b` |
| 4 | "pode finalizar" tirava a agente | "pode finalizar" saiu da lista de despedidas (erro do #551). | `d7a03de` |
| 5 | "valeu aura, agora teo me ajuda" chamava as duas | O obrigado não chama a agente quando outra é chamada na mesma mensagem. "valeu aura" sozinho continua falando com ela; "valeu aura, me explica…" chama. | `d7a03de` |
| 6 | Despedidas que faltavam | "valeu, era isso", "sai fora aura", "tchau pra vocês", "aura cala a boca", "obg aura, até". | `d7a03de` |
| 7 | Mensagens perdidas quando a internet oscila | Quando o Pusher reconecta (não na primeira conexão), a tela relê a conversa aberta. | `cf3f432` |
| 8 | Remover alguém não deixava aviso | Fica a linha do sistema "fulano não está mais no escritório", uma vez só, antes de a tela da pessoa sair. | `5c7d28a` |
| 9 | Aviso de "digitando" no servidor só crescia | **Não precisou mudar:** o código já apaga os antigos quando passa de 5.000 (`permitirDigitando`, em `lib/canal/presenca.ts`). Eu tinha errado na análise. | — |

**Banco:** nada muda.

---

## 2. Como rodar

```bash
npx vitest run lib/canal app/api/canal components/office lib/ui
npx tsc --noEmit
```

Resultado nesta máquina: **escritório: 769 testes passam (52 arquivos).** A suíte inteira está na seção 5.

---

## 3. O que os testes automáticos garantem

- **"vocês duas"** (`lib/canal/dispensa.test.ts`, rota de mensagem):
  - O caso do print: Zaeon, Aura e Zenita na conversa, as duas últimas a falar foram Zenita e Aura → saem só elas.
  - "vocês três" e "vocês podem ir" tiram todas.
  - Quem nunca falou fica por último na conta.
- **Ordem de quem falou** (`lib/canal/alvo.test.ts`): da última pra trás; "voltou" conta; quem nunca falou fica de fora.
- **"me explicou"** (`lib/canal/chamada.test.ts`):
  - Não chamam: "teo me explicou mal…", "teo me disse que…", "aura te respondeu?".
  - Continuam chamando: "teo me ajuda", "teo me explica isso".
- **Obrigado** (`chamada.test.ts`):
  - Só o Téo: "valeu aura, agora teo me ajuda" e "obrigada zenita! teo, sua vez".
  - A Aura: "valeu aura" e "valeu aura, me explica a parte 2".
- **"explica você"** (`chamada.test.ts`, rota de mensagem):
  - Com o Osler da vez e a Aura na conversa, "osler me explicou mal, explica você" faz a **Aura** responder.
  - Sem outra agente, o Osler responde.
- **Despedidas** (`dispensa.test.ts`):
  - Saem: as 5 frases novas (e "tchau pra vocês" tira as duas).
  - Ficam: "pode finalizar", "pode finalizar o trabalho?", "era isso que eu queria saber, continua", "isso", "até que ponto isso vale?", "saia fora do modo resumo" e "brigada! e a parte 2?".
- **Reconexão** (`lib/canal/presenca.test.ts`): a primeira conexão não relê; cada volta depois de cair relê.
- **Removido** (`app/api/canal/[id]/route.test.ts`, `presenca.test.ts`):
  - Uma linha "fulano não está mais no escritório", mesmo com clique duplo.
  - A linha vai antes do aviso que tira a tela da pessoa.

Além dos testes, repeti nas regras novas as **43 frases** da segunda análise e as **61 frases** da primeira.
- **Na segunda análise:** só mudaram as 7 que estavam erradas, e todas ficaram certas.
- **Na primeira:** continuam todas certas.

---

## 4. Teste manual no zaeon.com.br (depois do deploy)

Ctrl+F5 antes.

1. **"vocês duas":** com três agentes na conversa (por exemplo Zaeon, Aura e Zenita), mande "vocês duas podem sair". Saem **só as duas que falaram por último**.
2. **"me explicou":** com a Aura e o Téo na conversa e o **Téo** sendo o da vez, mande "teo me explicou mal, explica você". Responde a **Aura**, e o Téo fica quieto.
3. **Obrigado:** com a Aura respondendo, mande "valeu aura, agora teo me ajuda". Só o **Téo** responde.
4. **"pode finalizar":** a agente **não** sai.
5. **Despedidas:** "valeu, era isso", "sai fora aura" e "tchau pra vocês" tiram a(s) agente(s).
6. **Reconexão:** com o escritório aberto, desligue o Wi-Fi por uns 10 s. Peça para a outra conta mandar uma mensagem nesse tempo e religue o Wi-Fi. A mensagem aparece sozinha, sem F5. `NÃO VERIFICADO` em produção (coberto por teste).
7. **Removido:** remova a conta giu dev. No seu chat aparece "giu dev não está mais no escritório".

---

## 5. Observações

- **Suíte inteira nesta máquina:** 4345 testes passaram e 9 falharam; 14 arquivos falharam. Nenhuma falha é do escritório:
  - `leitor/compose`, `octa/fortify`, `octa/genart` e `studio/storage` já falham no Windows;
  - os arquivos de `rag`, `videodoc/anexo` e `octa/PreviaReact` não carregam porque faltam aqui pacotes que o main recebeu (`pg`, `@codesandbox/sandpack-react`).

  O CI do GitHub instala tudo e é a prova final.
- **"explica você":** a regra vale quando a mensagem **cita a agente da vez** e fala com "você". Por isso "o teo disse X, você concorda?" também vai pra outra agente; faz sentido, porque o Téo foi citado na terceira pessoa. Com @, a regra não se aplica: o @ manda.
- **Reconexão:** relê só a conversa **aberta**. As outras continuam recebendo pelo Pusher normalmente. O contador de não-lidas de uma conversa fechada não recupera mensagens perdidas durante a queda.
- **Fora deste card (combinado):**
  - o gráfico que aparece como código (não mexer por enquanto);
  - a reserva do Hugging Face no escritório e a fonte lixo na busca (são do Martinez);
  - a memória profunda no escritório (card próprio).
