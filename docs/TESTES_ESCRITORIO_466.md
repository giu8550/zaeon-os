# Escritório — card #466 · testes e observações

> Documento de apoio à PR do **#466 — CORREÇÃO ESCRITÓRIO 7** (branch `466-correcao-escritorio-7-agentes-conversa`).
> Tudo aqui foi tirado do código da branch e de execuções reais dos testes nesta máquina (Windows).
> Onde algo **não foi verificado de verdade**, está marcado como `NÃO VERIFICADO`.

---

## 1. Resumo

| # | Item do card | O que foi feito | Commit |
|---|---|---|---|
| 1 | "@aura @teo pode sair, aura continua comigo" tirava as duas | Pedaço que manda uma agente ficar ("continua", "fica", "segue", "pode continuar", "fica só a…") protege essa agente. | `7e6f0dd` |
| 3 | Despedidas que não tiravam a agente | "aqui", "por agora", "por favor/pfv" passam a valer na abertura/fecho da despedida. | `7e6f0dd` |
| 2 | Nome sem @ não chamava a agente | `lib/canal/chamada`: o nome usado **pra chamar** chama (vírgula, fim depois de vírgula, colado num pedido/saudação). Não conta "minha aura", "sobre aura", "a zaeon é…", nem nome de pessoa da conversa. | `436e832` |
| 4 | "Zenita responde" aparecia pra quem não ia ser respondido | A dica usa a mesma regra do servidor (`quemRespondeSemArroba`). | `752c594` |
| 5 | "Remover do escritório" regravava a lista inteira | Adicionar/remover pelo dono usam `entrarComoMembro`/`sairComoMembro` (como no #443). | `eea9759` |

**Banco:** nada muda.

---

## 2. Como rodar

```bash
npx vitest run lib/canal app/api/canal components/office
npx tsc --noEmit
```

---

## 3. O que os testes automáticos garantem

- **Despedidas** (`lib/canal/dispensa.test.ts`): saem "não precisamos mais de você aqui", "pode sair por agora", "pode ir embora por favor", "por favor pode sair", "pfv pode ir"; ficam "pode ir mais fundo nisso", "pode sair desse assunto e falar de outro", "por favor pode explicar de novo".
- **Continua comigo** (`dispensa.test.ts`): o caso do print (só o Téo sai) e mais 4 jeitos de dizer que uma fica; sem ninguém mandado ficar, as duas marcadas saem.
- **Nome sem @** (`lib/canal/chamada.test.ts`, `app/api/canal/[id]/mensagem/route.test.ts`): "sim continue aura pode ir em frente" chama a Aura (não a agente da vez); "aura, me explica", "oi aura", "Téo, responde em inglês" chamam; "minha aura está pesada", "qual é a cor da sua aura?", "a zaeon é muito legal", "aura e energia são a mesma coisa?" **não** chamam; "Caio, você viu?" não chama a agente Caio se houver uma pessoa Caio na conversa; o nome traz a agente de volta ("voltou"); a mensagem guarda só as @ de verdade.
- **Dica "responde"** (`lib/canal/alvo.test.ts`): numa conversa com outra pessoa, só quem estava falando com a agente vê "Osler responde"; a outra pessoa não vê; depois que a agente sai, ninguém.
- **Remover membro** (`lib/canal/atomico.test.ts`, `app/api/canal/[id]/route.test.ts`): o dono tira o Martinez no mesmo instante em que a Ana entra → a Ana fica; tirar quem já saiu não quebra.

---

## 4. Teste manual no zaeon.com.br (depois do deploy)

Ctrl+F5 antes.

1. **Continua comigo:** com Aura e Téo, mande "@aura @teo pode sair, aura continua comigo" → só o Téo sai; a Aura responde.
2. **Nome sem @:** com o Téo sendo a agente da vez, mande "sim continue aura pode ir em frente" → quem responde é a **Aura**.
3. **Não confunde:** mande "minha aura está pesada hoje" → responde a agente da vez (não chama a Aura).
4. **Despedidas:** "pode sair por agora" e "por favor pode sair" → a agente sai.
5. **Dica:** numa conversa com o Martinez, se ele estava falando com a Zenita, o seu campo **não** deve dizer "Zenita responde".
6. **Remover:** (dono) remover alguém pelo menu da foto continua funcionando. Duas coisas ao mesmo tempo: `NÃO VERIFICADO` em produção, coberto pelos testes.

---

## 5. Observações

- **"Muita coisa ao mesmo tempo":** o main já tem a correção do Martinez "Gemini no endpoint global… (fim dos 429 do us-central1)" (`658317a`), que deve resolver isso.
- **Card 8 (tempo real):** canal privado, online com foto, linhas do sistema notificando e "IA trabalhando" no metaverso ficaram pro próximo card.
- **Nome sem @:** a lista de palavras de pedido/saudação está em `lib/canal/chamada.ts` (`PEDIDO`). Se aparecer uma frase comum que chama sem querer (ou não chama quando devia), é só ajustar ali com um teste.
