# Escritório — card #635 · quem saiu não responde e botão de interromper · testes e observações

> Documento de apoio à PR do **#635 — ESCRITÓRIO · QUEM SAIU NÃO RESPONDE E BOTÃO DE INTERROMPER**
> (branch `635-escritorio-saiu-interromper`). Tudo aqui foi tirado do código da branch e de execuções reais dos
> testes nesta máquina. Onde algo **não foi verificado de verdade**, está marcado como `NÃO VERIFICADO`.

---

## 1. Resumo

| # | Item do card | O que foi feito |
|---|---|---|
| 1, 4 | Quem saiu continuava respondendo | A regra "quem saiu não responde" já existia (#438), e a ordem gravada estava certa (despedida → "saiu"). O furo: a resposta que o agente **já estava escrevendo** quando foi dispensado chegava **depois** da linha "saiu", e a regra lia isso como "ele voltou a falar". Agora (`lib/canal/alvo.ts`) só as linhas **"saiu"/"voltou"** decidem quem está fora — e o @ sempre grava a "voltou" (#440). E o turno do agente, antes de gravar, confere se ele saiu enquanto escrevia: se saiu, a resposta **não entra**. Sem agente na conversa, o campo mostra "Mensagem · @agente convoca" (já era assim quando a regra acertava). |
| 5 | Botão de interromper | Enquanto um agente escreve **e a caixa está vazia**, o ↑ vira **■** (vermelho, igual ao do chat da Aura). Clicou: entra a linha "Fulana interrompeu a resposta", o balão "escrevendo" some na hora pra todo mundo, e o turno de cada agente que estava escrevendo **não grava** a resposta (se forem vários, para todos). Rota nova: `POST /api/canal/[id]/parar`. Se a pessoa já está digitando outra mensagem, o botão continua ↑. |
| 2, 6 | Agente prometia o que não faz | Regra nova no que o agente do canal ouve (`HONESTIDADE` em `lib/canal/agent-turn.ts`): ele só conversa no canal — não cria/mexe em cards do kanban, não manda e-mail/WhatsApp, não mexe em agenda/arquivos/sistemas; nunca diz que vai fazer, e diz o que a pessoa pode fazer (com o texto pronto, se ajudar). |
| 3, 7 | Fórmula crua | O Escritório já usava o mesmo formatador do chat da Aura (que desenha fórmula). Não deu pra reproduzir o `$60\text{ s}$` cru com o texto do card — a causa mais provável é o modelo ter "escapado" os cifrões (`\$60\text{ s}\$`), que o formatador lia como cifrão de dinheiro. Agora `\$…\$` com um **comando LaTeX dentro** (`\text`, `\frac`…) vira fórmula; `\$5 e \$10` continua dinheiro. E o agente do canal ouve a regra `FORMULAS`: LaTeX entre `$ … $`, nunca dentro de crases. |
| 8 | "Chamar de volta" (#444) | A linha "Fulano saiu da conversa" ganha o botão **"Chamar de volta"** — só na **última** saída de cada agente que **ainda está fora**. Clicar manda "@teo pode voltar" (entra "Téo voltou para a conversa" e ele responde). |

**Banco:** nada muda (a linha do "■" é uma mensagem de sistema comum, `autorId: "parar"`).

---

## 2. Como rodar

```bash
npx vitest run lib/canal app/api/canal components/office lib/chat/matematica.test.ts
```

Novos testes:

- `lib/canal/alvo.test.ts`: a resposta **atrasada** de quem saiu não traz de volta (sem @, ninguém responde; com outra agente na conversa, a vez segue dela); só a linha "voltou" traz de volta; `linhasChamaveis` (só a última saída de quem ainda está fora).
- `lib/canal/parar.test.ts`: "■" depois da mensagem que convocou cancela (pra todas); um "■" antigo não; a saída da própria agente cancela, a de outra não; quando o ↑ vira ■.
- `app/api/canal/[id]/parar/route.test.ts`: grava a linha, apaga o balão de quem escrevia, ignora lixo, gate (401/403/404).
- `lib/canal/agent-turn.test.ts`: apertaram ■ enquanto escrevia → não grava (e o balão some); dispensada enquanto escrevia → não grava; um ■ antigo não atrapalha; o agente ouve `HONESTIDADE` e `FORMULAS`.
- `lib/canal/dispensa.test.ts`: "@teo pode voltar" não é despedida.
- `lib/chat/matematica.test.ts`: `\$60\text{ s}\$` vira fórmula; `\$5 e \$10` continua dinheiro.
- `components/office/Presenca.test.tsx`: a linha com o botão "Chamar de volta".

Dois testes antigos (`alvo.test.ts`, #438/#440) diziam que "falar depois do saiu = voltou" — era exatamente o defeito; foram atualizados pra regra nova.

---

## 3. Suíte completa

`npx vitest run` nesta máquina: **4737 passaram, 29 falharam, 10 pulados** (551 arquivos).

As 29 são as de sempre deste Windows, nenhuma desta branch: sem pacotes locais (`pg`, sandpack — `rag/*`, `queue/rag`,
`api/admin/rag`, `api/rag/minha-base`, `runChatTurn`, `videodoc/anexo`, `octa/PreviaReact`) e Windows/tempo
(`leitor/compose`, `octa/fortify`, `octa/genart`, `studio/storage`). O CI (Linux) é quem confirma.

---

## 4. Como testar em produção (depois do deploy)

1. **Ctrl+Shift+R** e abra o Escritório.
2. **Quem saiu não responde:** chame `@teo` com uma pergunta e, **enquanto ele escreve**, mande "@teo sai". Ele se despede, aparece "Téo saiu da conversa" e a resposta que ele estava escrevendo **não aparece**. Mande uma mensagem sem @: **ninguém responde**, e o campo diz "Mensagem · @agente convoca".
3. **Chamar de volta:** na linha "Téo saiu da conversa", clique em **Chamar de volta** → "@teo pode voltar", "Téo voltou para a conversa" e ele responde. O botão some da linha.
4. **■ Parar:** faça uma pergunta longa; enquanto o agente escreve (caixa vazia), o ↑ vira **■ vermelho**. Clique: "<seu nome> interrompeu a resposta" aparece, o balão some e a resposta **não chega**. Com dois agentes respondendo, para os dois.
5. **Agente honesto:** peça "@teo cria um card no board pra isso" → ele **não** promete criar; diz que você pode criar e entrega o texto.
6. **Fórmula:** peça "@teo quanto tempo leva a 1 m/s pra andar 60 m? mostra a fórmula" → a fórmula aparece **desenhada**.

`NÃO VERIFICADO` no app de verdade: a causa exata da fórmula crua (não reproduzida) e o comportamento do modelo com as regras novas (depende da IA).
