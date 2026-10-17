# Escritório — card #425 · testes e observações

> Documento de apoio à PR do **#425 — CORREÇÃO ESCRITÓRIO 2** (branch `425-correcao-escritorio-2-sino-perfil-convite`).
> Tudo aqui foi tirado do código da branch e de execuções reais dos testes nesta máquina (Windows).
> Onde algo **não foi verificado de verdade**, está marcado como `NÃO VERIFICADO`.

---

## 1. Resumo

| # | Item do card | O que foi feito | Commit |
|---|---|---|---|
| 1 | "Digitando" em balão | Balão igual ao dos agentes: foto da pessoa + três pontinhos pulando, sem texto (o nome vai só pro leitor de tela). Até 3 balões. | `0a2c64f` |
| 2 | Sino com data/hora | "agora", "há 5 min", "há 3 h", "ontem", "16/10", "25/12/25" — no fuso de quem olha | `230068f` |
| 4 | "Limpar" e "visto" no banco | Coleção nova `canal_sino` (um registro por pessoa: `vistoEm`, `limpoAte`). Troca o `localStorage` do #423. Limpar só tira os já respondidos. | `230068f` |
| 3 | Convite aceito abre a conversa | O aviso aceito vira botão: abre a conversa e fecha o sino | `2910885` |
| 6 | Menu da foto | "Ver perfil" (nome, foto, curso, nível, instituição, bio — **sem cérebros**) e, só pro dono, "Remover do escritório" com confirmação | `fbb949e` |
| 5 | Tirar a engrenagem | Saiu da barra. Convidar está no +, remover no menu da foto, tipo escolhido no seletor ao criar | `285b678` |
| 7 | + chama pra conversa | O + do **dono** convida pra conversa aberta; quem aceita entra nela. Conversa de dois vira grupo privado. | `1795cda` |

---

## 2. Banco de dados (o deploy aplica sozinho)

Só **acrescenta**, nada é apagado nem renomeado. O `prisma db push` do deploy cria:

- **coleção `canal_sino`** (modelo `CanalSino`): `userId` (único), `vistoEm`, `limpoAte`, `updatedAt`;
- **campo opcional `canalId`** em `canal_convites`: convites antigos não têm o campo e continuam funcionando como convite de contato.

Efeito único depois do deploy: o "visto" do sino estava no navegador e agora está no banco. Na primeira vez, a bolinha pode contar de novo uma resposta já vista. Abrindo o sino uma vez, fica certo.

---

## 3. Como rodar

```bash
npx vitest run lib/canal app/api/canal components/office
npx tsc --noEmit
```

---

## 4. O que os testes automáticos garantem

**Item 1 — balão** (`components/office/Presenca.test.tsx`, `lib/canal/presenca.test.ts`)
- um balão por pessoa, com os três pontinhos (com atrasos 0/150/300 ms), e **nenhum texto "digitando" na tela**;
- foto vem das pessoas do canal; sem foto, cai nas iniciais; no máximo 3 balões.

**Itens 2 e 4 — sino** (`lib/canal/sino.test.ts`, `components/office/SinoConvites.test.tsx`, `app/api/canal/sino/route.test.ts`, `app/api/canal/convites/route.test.ts`)
- todas as faixas de data/hora, inclusive logo depois da meia-noite ("há 20 min", não "ontem") e relógio adiantado ("agora");
- "Limpar" só aparece com algo respondido; pendente **nunca** some;
- o registro é **por pessoa**: o limpar de uma não mexe no da outra;
- limpar não apaga contatos (a conversa continua);
- ação inválida 400, anônimo 401.

**Item 3** — clicar no aceito chama a abertura com o id da conversa; recusado não abre nada.

**Item 6 — perfil** (`lib/canal/perfil.test.ts`, `app/api/canal/[id]/pessoa/[userId]/route.test.ts`, `components/office/MenuPessoa.test.tsx`)
- a rota **nem pede** cérebros, e-mail ou aura ao banco, e mesmo que o banco mande, a resposta não tem;
- só quem lê o canal vê (403); só perfil de quem é do escritório (404 pra qualquer outro id);
- "Remover" só pro dono, só em membro, nunca na própria foto, na do dono ou numa conversa de dois.

**Item 7 — convite pra conversa** (`app/api/canal/convites/route.test.ts`, `lib/canal/convite.test.ts`)
- o caso real: conversa Giulia + Martinez, Giulia chama a Ana → Ana aceita → **nenhuma conversa nova**, os três na mesma, `dmCom` sai, continua "privado";
- as três leem; quem é de fora continua barrado;
- não-dono recebe 403; repetido ou quem já está → 409; conversa apagada antes do aceite → 410 e o convite fica pendente;
- convite sem `canalId` continua o convite de contato de sempre.

---

## 5. Teste manual no zaeon.com.br (depois do deploy)

Precisa de **3 contas** (ex.: Giulia, Martinez e uma terceira).

1. **Balão:** Giulia e Martinez na mesma conversa. Martinez digita sem enviar → Giulia vê o balão com a foto dele e os três pontinhos, sem texto. Some uns segundos depois que ele para.
2. **Data/hora:** abrir o sino → cada aviso tem "há X min" / "ontem" / data embaixo.
3. **Visto no banco:** abrir o sino no computador → abrir o escritório no celular → a bolinha não acende de novo pelo que já foi visto.
4. **Limpar:** com convites aceitos/recusados no sino, clicar **Limpar** → somem; recarregar a página → continuam sumidos; os pendentes ficam.
5. **Clicar no aceito:** no sino, clicar em "Martinez aceitou seu convite" → abre a conversa e o sino fecha.
6. **Engrenagem:** não aparece mais na barra.
7. **Ver perfil:** clicar na foto do Martinez na barra → "Ver perfil" → cartão com nome, curso, nível… e **nenhum cérebro**.
8. **Remover:** sendo dono de um escritório com membro, clicar na foto do membro → "Remover do escritório" → confirmação → a pessoa sai. Na própria foto e na do dono, a opção **não** aparece. Para quem não é dono, só aparece "Ver perfil".
9. **O bug do card:** Giulia (dona da conversa com o Martinez) clica no **+** → o campo diz "e-mail de quem chamar pra cá" → convida a terceira pessoa → ela aceita no sino → aparece "fulano entrou na conversa" **na conversa de vocês**, e **não** nasce outra conversa. As três conversam juntas.
10. **Não-dono:** na mesma conversa, o Martinez clica no + → é o convite de contato normal (não chama pra conversa).

---

## 6. Observações e pontos em aberto

- **Quem é o dono da conversa de dois:** é quem mandou o convite original. Se foi o Martinez que convidou a Giulia, só ele chama gente pra ela.
- **Depois que a conversa de dois vira grupo,** o "Conversar" do perfil (que usa o contato) leva pra esse grupo, porque era a conversa de vocês. Se quiserem uma conversa só a dois de novo, é outro convite de contato. `NÃO VERIFICADO` em produção.
- **A barra de quem já estava na conversa** recarrega quando chega o "fulano entrou" (tempo real). Se o Pusher cair, só aparece no próximo F5.
- **A rota antiga `/api/user/profile/[id]`** (fora do escritório) devolve nome/curso/foto de qualquer id **sem login**. Não foi mexida nesta PR; vale um card separado.
- Fora deste card: **arquivos no escritório** (coluna de documentos + enviar arquivo no chat) vai no próximo card.
