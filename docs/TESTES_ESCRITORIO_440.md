# Escritório — card #440 · testes e observações

> Documento de apoio à PR do **#440 — CORREÇÃO ESCRITÓRIO 5** (branch `440-correcao-escritorio-5-dispensa-foto-monitor`).
> Corrige o que o teste do #438 no site mostrou. Tudo aqui foi tirado do código da branch e de execuções reais dos
> testes nesta máquina (Windows). Onde algo **não foi verificado de verdade**, está marcado como `NÃO VERIFICADO`.

---

## 1. Resumo

| # | Item do card | Causa | O que foi feito | Commit |
|---|---|---|---|---|
| 3 | Foto do Google não atualizava | O login lia a foto em `picture`, mas o NextAuth entrega o perfil já convertido, com a foto em `image` | Lê `image` (e `picture` por garantia). O teste usa o **próprio provider do Google** pra converter o perfil | `223b4e6` |
| 4 | "IA trabalhando" falso no metaverso | O "digitando" não lia a resposta; ela chega sem tamanho (compressão) e o monitor do tablet esperava 15 min | O escritório lê a resposta; o monitor ignora os pedidos do escritório que não são IA; JSON não conta como IA escrevendo | `7ac26ec` |
| 1 | Despedidas que não saíam | "não precisamos mais de você" fora da lista; "pode sair" só no fim da frase | Novas frases; "pode ir/sair" vale com mais texto depois (exceto pedido); "para de responder em inglês" é instrução | `dde6c51` |
| 2 | Sair e voltar sem aparecer | A dispensada continuava em `canal.agentes`; voltar não gerava aviso | Ao sair, sai da barra; com @ depois de sair: "Zenita voltou para a conversa" e volta pra barra | `74fb935` |

Mais um commit só de teste (`476c5c4`): o teste das chores precisou da busca do histórico, que agora acontece sempre.

**Banco:** nada muda.

---

## 2. Como rodar

```bash
npx vitest run lib/canal lib/user lib/ui app/api/canal components/office
npx tsc --noEmit
```

---

## 3. O que os testes automáticos garantem

- **Foto do Google** (`lib/user/fotoNoLogin.test.ts`): o perfil cru do Google passa pelo `GoogleProvider` de verdade; a foto sai em `image` (e **não** em `picture`, o erro do #438); de ponta a ponta, a foto nova é salva.
- **Monitor do tablet** (`lib/ui/monitorIA.test.ts`): digitando, sino, convites, agenda, entrar e criar escritório **não contam**; a mensagem continua contando; JSON sem tamanho não é IA escrevendo, `text/plain` e `x-ndjson` são; o caso do Martinez (POST com JSON que ninguém lê) termina na hora.
- **Despedidas** (`lib/canal/dispensa.test.ts`): as frases da Giulia saem ("não precisamos mais de você tchau", "pode sair @zenita não precisamos mais de você", "pode sair, …"); não saem: "pode ir me explicando", "pode sair um mapa mental?", "pode ir pra próxima", "pode deixar mais curto?", "não precisa mais responder em inglês…", "para de responder assim tão longo".
- **Sair e voltar** (`lib/canal/alvo.test.ts`, `app/api/canal/[id]/mensagem/route.test.ts`): dispensada sai de `canal.agentes`; chamada com @ depois de sair gera "voltou", volta pra barra e responde; depois disso, sem @ ela continua a da vez; quem nunca saiu não ganha "voltou".

---

## 4. Teste manual no zaeon.com.br (depois do deploy)

Ctrl+F5 antes.

1. **Despedida:** fale com a Zenita e mande "pode sair @zenita não precisamos mais de você" → ela se despede, aparece "Zenita saiu da conversa" e ela **some do destaque da barra de agentes** embaixo.
2. **Sem @ depois:** mande qualquer coisa sem @ → ninguém responde.
3. **Volta:** mande "@zenita oi" → aparece "**Zenita voltou para a conversa**", ela volta pra barra e responde. (Se vier "Muita coisa ao mesmo tempo", é a cota da IA, não este card.)
4. **Metaverso:** abra o escritório pelo tablet, digite algo sem enviar, feche → a barra "IA trabalhando" **não** acende.
5. **Foto do Google:** numa conta **sem foto própria na Zaeon** (a "Bz", por exemplo), troque a foto no Gmail, saia e entre na Zaeon com o Google → a foto nova aparece. A giu dev não serve mais pra esse teste: ela tem foto própria (a Azula subida pela Zaeon), e o Google não sobrescreve. `NÃO VERIFICADO` em produção.

---

## 5. Observações

- **"Muita coisa ao mesmo tempo"** = limite/cota do provedor da IA (`lib/agent/errors.ts`). Fica com o Martinez (logs do servidor, card #232).
- **O monitor do tablet** continua contando a mensagem do escritório como IA: ela pode esperar o turno do agente (modo sem fila). Isso é certo; o falso era o "digitando".
