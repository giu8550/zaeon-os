# Escritório — card #443 · testes e observações

> Documento de apoio à PR do **#443 — CORREÇÃO ESCRITÓRIO 6** (branch `443-correcao-escritorio-6-dispensa-concorrencia`).
> Tudo aqui foi tirado do código da branch e de execuções reais dos testes nesta máquina (Windows).
> Onde algo **não foi verificado de verdade**, está marcado como `NÃO VERIFICADO`.

---

## 1. Resumo

| # | Item do card | O que foi feito | Commit |
|---|---|---|---|
| 1, 2 | Agente saía sem ser dispensada / instrução virava dispensa | A regra deixou de ser uma lista de exceções. A frase é lida em **pedaços**, e um pedaço só é despedida quando é **só** despedida (abertura e fecho curtos e fixos). Pergunta nunca é despedida. | `7b038b5` |
| 3 | Dispensar uma tirava todas | `quemFoiDispensada`: o nome escrito no pedaço da despedida manda, depois o @ no pedaço; sem dizer quem e com várias agentes, ninguém sai. | `f97bcd2` |
| 4 | Faltava "voltou" em pedido de tarefa | A linha "voltou para a conversa" é gravada antes do caminho da tarefa (chore). | `a063f02` |
| 5 | Entradas ao mesmo tempo perdiam membro | `lib/canal/atomico`: entrar é um comando só no banco ("põe, se ainda não estiver"); trocas de lista gravam só se a lista ainda for a lida, senão tentam de novo. | `b42bcf1` |
| 6 | Convite ficava aceito se a entrada falhasse | Se falhar depois do "aceito", o convite volta a pendente (500) e dá pra aceitar de novo. | `b42bcf1` |
| — | Teste da barra de agentes | A barra virou o componente `BarraAgentes`, com teste de sair e voltar. | `14ae875` |

**Banco:** nada muda.

---

## 2. Como a despedida é lida agora (itens 1–3)

1. A mensagem é cortada em pedaços: vírgula, ponto, `?`, `!`, `;`, " e ", " mas " (sem cortar no "é só").
2. Um pedaço é despedida só se for: `[abertura] DESPEDIDA [fecho]`.
   - **Abertura:** a, o, você, ok, valeu, obrigado(a), então, agora, já, ei, oi, o nome da agente.
   - **Despedida:** pode ir/sair/parar/descansar, (pode) ir embora, vai embora, para de responder/falar, não precisa (mais) responder, não preciso/precisamos mais de você, pode deixar, (é) só isso, está dispensada, por hoje é só.
   - **Fecho:** embora, agora, já, valeu, vlw, obrigado(a), tchau, beijo, falou, ok, por hoje, o nome da agente.
3. Qualquer outra palavra no pedaço ("em frente", "direto ao ponto", "do modo resumo", "em inglês", "de usar emoji") → **não** é despedida.
4. Pergunta (`?`) → nunca é despedida.
5. "Tchau", "até mais", "falou" (fracas): numa conversa com outras pessoas, só valem com o nome ou o @ da agente.
6. **Pra quem:** nome escrito no pedaço → só ela; senão o @ no pedaço; senão a agente da vez (se for uma só); verbo no plural ("podem ir") → todas; várias agentes e nada que diga qual → ninguém sai.

---

## 3. Como rodar

```bash
npx vitest run lib/canal app/api/canal components/office
npx tsc --noEmit
```

---

## 4. O que os testes automáticos garantem

- **Itens 1–2** (`lib/canal/dispensa.test.ts`): todas as frases do card **não** tiram a agente ("pode ir em frente", "pode ir direto ao ponto", "pode sair do modo resumo e explicar melhor", "o professor falou que a prova é amanhã", "vou estudar isso até amanhã", "só isso? achei curto", "pode parar de responder em inglês", "pode parar de usar emoji"), mais "pode ir mais devagar", "falou muito bem, continua", "tchau é como se diz adeus?". As despedidas de verdade continuam valendo (inclusive todas as do #438 e #440).
- **Item 3** (`dispensa.test.ts`, `app/api/canal/[id]/mensagem/route.test.ts`): o caso do card só tira a Zenita; plural tira as duas; "pode ir" com duas agentes e sem dizer quem não tira ninguém; na rota, a Aura responde e fica na barra.
- **Item 4** (`route.chore.test.ts`): dispensada + "@aura resume <link>" → chore criada e a linha "Aura voltou para a conversa".
- **Item 5** (`lib/canal/atomico.test.ts`, `entrar/route.test.ts`, `convites/route.test.ts`): duas entradas no mesmo instante → as duas ficam; clique duplo → membro uma vez e "entrou" uma vez; duas mensagens mudando a barra → as duas mudanças ficam; dois aceitando convite pra mesma conversa → vira grupo com todos. O banco de mentira faz as duas leituras antes de qualquer gravação, que é a situação que perdia gente.
- **Item 6** (`convites/route.test.ts`): a criação da conversa falha → 500, convite volta a pendente, e aceitar de novo funciona.
- **Barra** (`components/office/BarraAgentes.test.tsx`): presentes primeiro e destacados; dispensada sai do destaque e volta com @.

---

## 5. Teste manual no zaeon.com.br (depois do deploy)

Ctrl+F5 antes.

1. **Não sai à toa:** conversando com a Zenita, mande "pode ir em frente", "pode parar de responder em inglês", "só isso? achei curto" → ela **fica** e responde.
2. **Sai quando é pra sair:** "pode sair @zenita, valeu" → ela se despede e sai.
3. **Só a certa:** com Aura e Zenita, "@aura @zenita a zenita pode sair, aura continua comigo" → só a Zenita sai; a Aura responde.
4. **Volta com tarefa:** com a Zenita fora, "@zenita resume <um link>" → aparece "Zenita voltou para a conversa".
5. **Entradas juntas:** `NÃO VERIFICADO` em produção (precisa de duas pessoas clicando no mesmo instante). Coberto pelos testes.

---

## 6. Observações

- **"Muita coisa ao mesmo tempo"** continua sendo a cota da IA (Martinez, card #232), fora deste card.
- **A rota PATCH do escritório** (adicionar/remover membro pelo dono) ainda grava a lista inteira. É ação só do dono, bem menos sujeita a duas ao mesmo tempo; ficou fora do card.
