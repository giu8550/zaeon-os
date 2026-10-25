# Escritório — card #562 · memória profunda · testes e observações

> Documento de apoio à PR do **#562 — MEMÓRIA PROFUNDA NO ESCRITÓRIO** (branch `562-memoria-profunda-escritorio`).
> Tudo aqui foi tirado do código da branch e de execuções reais dos testes nesta máquina (Windows).
> Onde algo **não foi verificado de verdade**, está marcado como `NÃO VERIFICADO`.

---

## 1. Resumo

| # | Item do card | O que foi feito | Commit |
|---|---|---|---|
| 1 | Conversa só da pessoa: lembra das coisas dela, igual ao chat | No começo da resposta, o turno relembra com `wakeUpContext` (a mesma função do chat). Na conversa só dela, relembra **tudo dela**, sem filtro de ala: escritório, chat e o resto. Com mentor, usa a ala do mentor (`<slug>/<userId>`), a mesma do chat. No fim, guarda o turno com `writeTurnMemory`, na ala "escritorio". | `d2b8852` |
| 2 | Conversa com outras pessoas: nunca a memória pessoal | O dono da lembrança é o **próprio escritório** (o id dele). Só relembra e guarda o que foi dito ali (ala "escritorio"). Nenhuma memória pessoal é lida nem gravada; nem a ala do mentor entra, porque ela carrega o id de alguém. | `22fd5ab`, `d2b8852` |
| 3 | A busca no meio da resposta (`memory_search`) segue a regra | O turno passa `memoriaDe` (a pessoa, ou o escritório) e a ferramenta usa ela no lugar do dono do turno. No chat nada muda: sem `memoriaDe`, continua o dono do turno. | `4f69c91` |
| 4 | Conversa de dois que vira grupo | A regra é recalculada a cada turno (`lib/canal/memoria.ts`). A partir da próxima mensagem, a memória já é a do escritório. | `22fd5ab` |

**"Conversa só da pessoa"**, exatamente: um humano só no escritório (o dono, sem membros e sem conversa de dois) **e** o escritório não é "aberto". O "aberto" qualquer pessoa pode ler, mesmo sem ser membro (`lib/canal/gate.ts`); por isso ele conta como grupo.

**Banco:** nada muda. As lembranças do escritório entram na mesma coleção `memory_drawers`, com `userId` = id do escritório.

**Mudança em código compartilhado (pequena e retrocompatível):**
- `lib/agent/memory-provider.ts`: `wakeUpContext` aceita `wingLabel: null` (= tudo do dono). Sem o campo, funciona como antes.
- `lib/agent/runtime.ts`: `memory_search` usa `ctx.memoriaDe ?? ctx.userId`. Sem `memoriaDe`, funciona como antes.

---

## 2. Como rodar

```bash
npx vitest run lib/canal app/api/canal lib/agent/runtime lib/agent/memory-provider
npx tsc --noEmit
```

Resultado nesta máquina:
- **Arquivos deste card:** 664 testes passam (37 arquivos). O `tsc` não mostra erro neles.
- **Suíte inteira:** 4592 passaram e 31 falharam. Nenhuma falha é deste card:
  - **Falta aqui o pacote `pg`** (o RAG, que o chat da Aura usa no main): `rag/*`, `agent/runChatTurn`, `videodoc/anexo` e `octa/PreviaReact`.
  - **Testes do Octa** (`octa/genart`, `octa/p7`, `octa/fortify`): instalam as skills novas do main (#609, #611, #612) e estouram o tempo no Windows. Esta branch não mexe no Octa.
  - **Os que já falham no Windows:** `leitor/compose` e `studio/storage`.
  - O CI do GitHub instala tudo e é a prova final.

---

## 3. O que os testes automáticos garantem

- **De quem é a memória** (`lib/canal/memoria.test.ts`):
  - Privado ou "turma" sem ninguém: é dela, sem filtro de ala.
  - Com mentor: é a ala do mentor.
  - Grupo com membro, conversa de dois e escritório aberto: é do **escritório**, e o resultado não contém o id da pessoa em lugar nenhum.
  - Conversa que vira grupo muda de regra.
- **O turno da agente** (`lib/canal/agent-turn.test.ts`, com uma memória de mentira que anota quem foi lido e gravado):
  - Na conversa só da pessoa: relembra e guarda com ela, e a lembrança chega no contexto do turno.
  - Com mentor: usa a ala do mentor.
  - Em grupo, conversa de dois e aberto: só o escritório é lido e gravado, e **o id da pessoa não aparece em nenhuma chamada**.
  - Memória fora do ar não derruba o turno.
- **A busca no meio da resposta** (`lib/agent/runtime.test.ts`): com `memoriaDe`, busca na memória do escritório; sem ele, na do dono do turno (o chat de sempre).
- **O relembrar** (`lib/agent/memory-provider.test.ts`): `wingLabel: null` não filtra ala; sem o campo, usa a da superfície, como antes.

---

## 4. Teste manual no zaeon.com.br (depois do deploy)

Só funciona se a memória profunda estiver ligada no servidor (`MEMORY_L3=1`, ligada pelo Martinez no #508). `NÃO VERIFICADO` daqui.

1. **Conversa só sua** (um escritório privado só seu):
   - Conte algo a uma agente, por exemplo: "@aura eu sou estudante de enfermagem e tenho prova de farmacologia sexta".
   - Em outra mensagem, mais tarde, pergunte: "@aura o que você lembra sobre mim?". Ela deve lembrar.
   - Ela também pode lembrar coisas que você falou no **chat da Aura**.
2. **Em grupo** (um escritório com a conta giu dev):
   - Pergunte "@aura o que você lembra sobre mim?". Ela **não** deve citar nada do seu chat pessoal nem do seu escritório particular.
   - Só o que foi dito naquele escritório.
3. **Conversa que vira grupo:** num escritório só seu, adicione a giu dev. A partir dali, a agente só lembra do que foi dito naquele escritório.

---

## 5. Observações

- **Base pessoal de arquivos (RAG, "Minha base") em grupo:** isto **não é memória**, mas tem o mesmo cuidado. Desde o #573 (📎 no Escritório), o turno consulta a **base pessoal inteira de quem mandou** (`baseParaTurno`, em `lib/canal/agent-turn.ts`), inclusive em grupo. Ficou **fora deste card**:
  - mexer nisso quebra a leitura de PDF anexado em grupo, que sobe pra "Minha base" de quem anexou;
  - quem desenhou foi o Martinez.

  Sugestão pra combinar com ele: em grupo, a busca usa só a base da turma e os arquivos **anexados naquele escritório**.
- **O que é guardado:** a mensagem de quem pediu e o texto da resposta (só se tiverem substância, ≥ 40 letras — regra `isMemorable`, a mesma do chat). Citações e artefatos do turno não entram, porque o Escritório só tem o texto final da resposta.
- **Nenhuma memória pessoal antiga é apagada ou movida:** só a leitura e a escrita do Escritório mudaram.
