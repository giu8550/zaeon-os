# Escritório — card #427 · testes e observações

> Documento de apoio à PR do **#427 — CORREÇÃO ESCRITÓRIO 3** (branch `427-correcao-escritorio-3-digitando-perfil`).
> Tudo aqui foi tirado do código da branch e de execuções reais dos testes nesta máquina (Windows).
> Onde algo **não foi verificado de verdade**, está marcado como `NÃO VERIFICADO`.

---

## 1. Resumo

| # | Item do card | O que foi feito | Commit |
|---|---|---|---|
| 1 | Balão de "digitando" não aparecia | O balão entrava embaixo da última mensagem, mas o chat só descia sozinho com mensagem nova ou agente digitando. Agora desce quando uma pessoa começa a digitar, **só se você já está no fim** da conversa. | `2cef79d` |
| 4 | Cérebros privados (servidor) | Rota nova `GET /api/perfil/[userId]`: só pra quem divide escritório com a pessoa. Não lê os cérebros, não manda o contador, tira do extrato as linhas dos cérebros e manda só o **número** de validações. | `64c3931` |
| 3 | "Ver perfil" abre a página de perfil | A mesma página do perfil, com os dados da outra pessoa, **só leitura**. Botão "Voltar ao escritório". | `6debd94` |
| 2 | Menu da foto com tudo junto | "Ver perfil", "Conversar" (ou "Convidar pra conversar") e "Remover do escritório" (só o dono) no mesmo menu. O cartãozinho do #425 saiu. | `b31ada5` |

---

## 2. O perfil de outra pessoa — o que aparece e o que não aparece

| Seção | Pra quem visita |
|---|---|
| Foto, nome, curso, nível | ✅ aparece (sem editar, sem trocar foto) |
| Habilidades e personagem 3D | ✅ aparece (sem "Mudar skin") |
| AURA: número, nível, "faltam X" | ✅ aparece |
| Contadores "habilidades validadas" e "atestados on-chain" | ✅ aparece |
| Títulos acadêmicos | ✅ só o título e o selo (sem o formulário, sem o diploma) |
| Parede de atestados | ✅ aparece |
| Extrato "Recentes" | ✅ aparece **sem as linhas que vêm dos cérebros** ("Aprendido: …", "cérebro completo", nós validados) |
| Convidado(a) por, Mural | ✅ aparece (o mural sem adicionar/apagar) |
| **Cérebros** (seção) | ❌ privado |
| **Contador "cérebros completos"** | ❌ privado |
| Validações de estudo | só o **número** ("Validações de estudo · 3"); a lista são passos dos cérebros de outros alunos |
| Fila de verificação | ❌ é a fila de trabalho dela, com documentos de outras pessoas |

**Quem pode ver:** só quem divide algum escritório com a pessoa (dono, membro ou a conversa de vocês). Qualquer outro id → "Não deu pra abrir esse perfil".

**Os cérebros não são só escondidos na tela:** o servidor nem lê os mapas pra esse perfil. Um teste dá erro se a rota tentar.

---

## 3. Como rodar

```bash
npx vitest run lib/canal lib/perfil app/api/canal app/api/perfil components/office components/profile components/research
npx tsc --noEmit
```

---

## 4. O que os testes automáticos garantem

- **Balão** (`lib/canal/presenca.test.ts`): no fim → desce; quase no fim (o balão acabou de entrar) → desce; lendo mensagens antigas → não puxa; conversa curta → está no fim.
- **Rota do perfil** (`app/api/perfil/[userId]/route.test.ts`):
  - quem divide escritório vê nome, curso, nível, AURA, títulos, atestados e o número de validações;
  - **nada dos cérebros sai**: sem `cerebros`, sem `completedBrains`, extrato só com "Título verificado", e a rota **não consulta** os mapas;
  - e-mail, papel e o documento do diploma não saem;
  - quem não divide escritório → 404; anônimo → 401; AURA ou mapa desligados → sem essas partes.
- **Regras** (`lib/perfil/visitante.test.ts`): as 4 origens de AURA dos cérebros; o extrato conta 10 **depois** de tirar as dos cérebros; quem pode ver.
- **Cartão da AURA visitante** (`components/profile/AuraCard.visitante.test.tsx`): não busca nada sozinho; sem seção nem contador de cérebros; sem formulário nem filas; validações só com o número.
- **Página de perfil visitante** (`components/research/EditableProfile.visitante.test.tsx`): busca o perfil DELA; sem Editar/foto/skin; mural dela; "Voltar ao escritório"; perfil proibido mostra aviso; sem visitante continua o seu perfil.
- **Menu da foto** (`components/office/MenuPessoa.test.tsx`): as 3 opções juntas, na ordem; Conversar × Convidar; convite não sai duas vezes; Remover só pro dono.
- **Convite pelo id** (`app/api/canal/convites/route.test.ts`): convida sem e-mail; id inexistente 404; a si mesma 400; já contatos → devolve a conversa.

---

## 5. Teste manual no zaeon.com.br (depois do deploy)

Duas contas no mesmo escritório (ex.: Giulia e Martinez). Ctrl+F5 antes.

1. **Balão:** as duas na mesma conversa, no fim dela. Uma digita sem enviar → a outra vê o balão com a foto e os três pontinhos **aparecer na tela** (o chat desce sozinho).
2. **Balão sem puxar:** suba a conversa pra ler mensagens antigas e peça pra outra pessoa digitar → **não** é puxada pra baixo.
3. **Menu:** clique na foto do Martinez na barra → aparecem juntos: **Ver perfil**, **Conversar** (ou **Convidar pra conversar**) e, se você for a dona, **Remover do escritório**.
4. **Ver perfil:** abre a página de perfil **dele** (aba Perfil): nome, curso, nível, AURA, títulos, atestados, mural. **Sem a seção Cérebros e sem o contador "cérebros completos".** Não tem "Editar" nem "Mudar skin".
5. **Voltar:** "Voltar ao escritório" volta pro escritório. Clicar em **Perfil** na barra lateral mostra o **seu** perfil de novo.
6. **Convidar pra conversar:** com alguém que ainda não é contato → "Convite enviado" e o convite aparece no sino da pessoa.

---

## 6. Observações

- **Atestados on-chain** ficam visíveis. Alguns podem ter o nome de uma habilidade validada (que nasceu de um cérebro), mas o atestado é público por natureza (está na Solana). `NÃO VERIFICADO` se o Martinez quer esconder esses também.
- **"Validado por"** dos atestados não aparece no perfil de outra pessoa (a rota não lê esse dado). Dá pra acrescentar se quiserem.
- **A rota antiga `/api/user/profile/[id]`** (fora do escritório) continua devolvendo nome, curso e foto de qualquer id sem login. Não foi mexida; vale um card separado.
- **O mural** usa a rota `/api/user/photos?userId=`, que já existia e também não confere se vocês dividem escritório. Fica pro mesmo card de cima.
