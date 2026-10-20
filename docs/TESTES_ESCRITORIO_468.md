# Escritório — card #468 · testes e observações

> Documento de apoio à PR do **#468 — CORREÇÃO ESCRITÓRIO 8** (branch `468-correcao-escritorio-8-tempo-real-agentes`).
> Tudo aqui foi tirado do código da branch e de execuções reais dos testes nesta máquina (Windows).
> Onde algo **não foi verificado de verdade**, está marcado como `NÃO VERIFICADO`.

---

## 1. Resumo

| # | Item do card | O que foi feito | Commit |
|---|---|---|---|
| 1 | Mensagens iam por canal **público** do Pusher | O canal das mensagens vira `private-canal-<id>`; `/api/canal/pusher-auth` só autoriza quem pode ler o escritório. Quem é removido recebe `membro-removido` e a tela para de ouvir na hora. | `bfdcff8` |
| 2 | Quem tem foto própria não aparecia "online" | A presença leva só o **nome**; a foto vem da lista de pessoas que a tela já tem. | `bfdcff8` |
| 3 | Linhas do sistema (entrou/saiu/voltou) contavam como não-lidas e notificavam | `prioridadeDe` devolve "nenhuma" para toda linha do sistema. | `81377e2` |
| 4 | Metaverso: "IA trabalhando" virava "livre" em 3 s com a agente ainda respondendo | Enquanto uma agente que **você** chamou escreve, o escritório avisa o monitor do tablet (`zaeon:ia-trabalho`). | `ae0a240` |
| 5 | "Aura está redigindo…" ficava preso | O servidor repete o estado a cada 20 s enquanto a agente trabalha; a tela apaga quem ficou 1 min sem aviso. | `ae0a240` |
| 6 | Nome próprio no meio da frase não chamava | Nomes próprios (Téo, Zenita, Nina…) chamam em qualquer posição; "aura"/"zaeon" continuam só em posição de chamado; nunca depois de "a/minha/sobre" nem de "rei/são". | `b0aecaa` |
| 7 | "sai @aura", "saia agora", "sai da conversa", "pode sair também" não tiravam | Verbo direto ("sai/saia/vaza") e "também/daqui/da conversa" passam a valer. | `da6e734` |
| 8 | "@aura@teo" (colados) só reconhecia a Aura | As menções coladas são separadas antes de ler. | `e0fdd0f` |
| 9 | Agente que saiu voltava quando outra agente a marcava | A corrente de agentes pula quem saiu, e o prompt avisa "Saíram da conversa (NÃO marque com @…)". | `680a368` |

**Banco:** nada muda.

---

## 2. Como rodar

```bash
npx vitest run lib/canal lib/ui app/api/canal components/office
npx tsc --noEmit
```

---

## 3. O que os testes automáticos garantem

- **Canal privado** (`app/api/canal/pusher-auth/route.test.ts`, novo): quem é membro assina `private-canal-<id>`. Quem não é do escritório privado leva 403. Sem login, 401. O nome antigo `canal-<id>` e nomes estranhos levam 400.
- **Online sem foto** (mesmo arquivo): com uma foto de 50 KB no perfil, a presença sai só com `{ nome }`, menos de 500 bytes.
- **Removido para de ouvir** (`app/api/canal/[id]/route.test.ts`): remover publica `membro-removido` uma única vez, mesmo com clique duplo.
- **Linhas do sistema** (`lib/canal/notificacoes.test.ts`): "entrou", "saiu da conversa" e "voltou" não notificam e não contam como não-lidas, de quem for.
- **Redigindo com prazo** (`lib/canal/estadoAgente.test.ts`, `lib/canal/agent-turn.test.ts`):
  - O servidor repete o estado enquanto o agente demora e para no fim.
  - Quem ficou sem aviso no prazo sai da lista.
  - O prazo cobre mais de um pulso.
- **Tablet** (`lib/ui/monitorIA.test.ts`):
  - A mensagem volta na hora, mas o monitor segue ocupado enquanto a agente escreve.
  - O pulso repetido não conta duas vezes.
  - "Fim" sem começo não mexe no contador.
- **Itens 6–9** (`chamada.test.ts`, `dispensa.test.ts`, `mention.test.ts`, `agent-turn.test.ts`):
  - **Chamar pelo nome:** "pode seguir em frente teo com a explicação" chama o Téo. "acho que zenita sabe…" e "rei davi" não chamam.
  - **Tirar da conversa:** "sai @zenita", "saia agora", "pode sair também" e "sai daqui" tiram. "sai um resumo disso?", "saiu o resultado" e "saia do modo resumo e explica" não tiram.
  - **Menções coladas:** "@aura@teo" vira duas menções, e e-mails ficam intactos.
  - **Corrente:** a corrente não chama quem saiu, mas volta a chamar depois de "voltou".

---

## 4. Teste manual no zaeon.com.br (depois do deploy)

Ctrl+F5 antes (o nome do canal mudou: uma aba antiga aberta não recebe mensagens até recarregar).

1. **Tempo real:** com o Martinez no mesmo escritório, um manda mensagem e a do outro aparece sem F5.
2. **Online com foto:** quem pôs foto própria aparece no "X on" do topo.
3. **Linhas do sistema:** com a aba em outra janela, dispense uma agente ("@aura pode sair"). Não deve surgir "(1)" no título nem notificação por causa do "Aura saiu da conversa".
4. **Redigindo:** se o "está redigindo…" aparecer e a resposta não vier, ele some sozinho em cerca de 1 min.
5. **Metaverso:** chame uma agente no escritório e vá pro metaverso. A barra "IA trabalhando" fica acesa até a resposta chegar (não vira "livre" em 3 s).
6. **Nome no meio:** "pode seguir em frente teo com a explicação" faz o Téo responder.
7. **Sair:** "sai @aura" e "@aura pode sair também" tiram a Aura.
8. **Colados:** "@aura@teo oi" traz as duas.
9. **Corrente:** dispense o Téo e peça pra Aura "chama o Téo". Ele **não** volta sozinho; só volta se você chamar.
10. **Remover:** (dono) remova alguém pelo menu da foto. O escritório some da lista dessa pessoa sem F5. `NÃO VERIFICADO` em produção.

---

## 5. Observações

- **Canal privado e removidos:** o Pusher não tem como "expulsar" quem já assinou. A tela da pessoa removida para de ouvir porque recebe o aviso `membro-removido`, e a partir daí a autorização do canal privado recusa novas assinaturas dela.
- **Tablet:** só as agentes que **você** chamou contam como "IA trabalhando". A agente chamada por outra pessoa no mesmo escritório não acende a sua barra.
- **@core_active / Davi:** ficou fora deste card (a Giulia avisa o Martinez).
