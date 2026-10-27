# Tutorial — card #629 · contorno, passo 3, dicas e "já vi" na conta · testes e observações

> Documento de apoio à PR do **#629 — TUTORIAL · CONTORNO, PASSO 3, DICAS E "JÁ VI" NA CONTA**
> (branch `629-tutorial-contorno-dicas-ja-vi`). Tudo aqui foi tirado do código da branch, de execuções reais dos
> testes e de uma página de prévia do cartão aberta no navegador nesta máquina. Onde algo **não foi verificado de
> verdade**, está marcado como `NÃO VERIFICADO`.

> ⚠️ **Deploy:** esta PR adiciona o campo `toursVistos Json?` no `User`. Precisa do `prisma db push` no deploy —
> combinar o dia do merge com o Martinez.

---

## 1. Resumo

| # | Item do card | O que foi feito |
|---|---|---|
| 1, 6 | Contorno pulava pro botão com uma letra | O chat avisa **a cada letra** (`useAvisoTextoDoChat`); o tour só leva o contorno pro ↑ depois de **1,5 s sem digitar** (cada letra recomeça a espera). O exemplo vai direto (não tem o que terminar). Texto: **"Quando terminar, aperta ↑ ou Enter"**. |
| 2, 7 | Passo 3 passava sozinho (desenho de brinde) | Antes do pedido no passo 3, **nenhum desenho conta** — nem "começou/pronto", nem o documento abrindo. Depois do pedido, igual ao #626. |
| 3, 8 | Dica do Perfil confusa | **Uma coisa por dica**, cada uma apontando o lugar dela: habilidades (já existia), **foto** ("Clica na tua foto pra trocar."), **Editar** ("Aqui você muda o nome e o curso.") e **Mudar skin** (não aparece pra fundador). Marcações novas: `perfil-editar`, `perfil-skin`. |
| 4, 9 | Dicas da Sala rasas | 5 dicas, cada uma apontando uma parte do blueprint: a **lista** em cima, as **4 barrinhas** de fase, a **prancha** (a máquina), um **crítico** e a **legenda** das cores. Marcações novas: `blueprint-fases`, `blueprint-critico`, `blueprint-legenda`. A dica cujo alvo não está na tela (um blueprint sem crítico) é **pulada**. |
| 9 | "2 de 5" e "Pular dicas" | Nas dicas (Perfil e Sala): **"N de M"** pequeno e **"Pular dicas"** (fecha todas, sem perguntar). |
| 5, 10 | "Já vi" só no navegador | Campo novo **`User.toursVistos`** + rota **`/api/onboard/vistos`** (GET / POST junta / DELETE limpa — só a própria conta, só itens conhecidos). Ao abrir o laboratório, a Zaeon lê a conta **uma vez**: o que a conta já viu vira visto no navegador; o que só o navegador sabia **sobe pra conta** (quem já tinha visto antes desta mudança não vê de novo noutro computador). Os tours **esperam** essa resposta (até 2 s; depois decidem pelo navegador). Terminar/pular salva nos dois; o **"Rever tutorial" limpa os dois**. Sem login ou sem rede, funciona só com o navegador, como antes. Não usa o `tourDone` (missão do tablet / boas-vindas). |

**Arquivos de outras áreas (mínimo):** `components/blueprint/SalaBlueprint.tsx` e `PranchaBlueprint.tsx` (3 marcações
`data-tour`), `components/research/EditableProfile.tsx` (2 marcações), `prisma/schema.prisma` (1 campo).

---

## 2. Como rodar

```bash
npx vitest run lib/onboarding app/api/onboard components/onboard components/blueprint components/research
```

Novos testes:

- `components/onboard/TourSala.test.tsx`: digitando "quer" o contorno **fica no campo**; cada letra recomeça a espera; parou de digitar → o ↑; o exemplo vai direto; o **desenho de brinde** (antes do pedido) não pula nem minimiza o passo 3.
- `lib/onboarding/tourSala.test.ts`: antes do pedido, desenho nenhum muda o estado.
- `components/onboard/DicasRapidas.test.tsx`: Perfil em 4 dicas (uma coisa por dica, sem skin pra fundador), Sala em 5, "N de M", "Pular dicas", dica sem alvo na tela é pulada.
- `lib/onboarding/vistosConta.test.tsx`: a conta marca o navegador; o navegador sobe pra conta; 401 não quebra; lê uma vez; salvar/limpar; **o tour da Sala não aparece num navegador limpo quando a conta já viu** (sem simular a espera).
- `app/api/onboard/vistos/route.test.ts`: 401 sem login; só itens conhecidos; POST junta; DELETE limpa.

---

## 3. Verificado no navegador (prévia)

- Dica da Sala nº 2: contorno nas barrinhas; rodapé numa linha ("2 de 5 · Pular dicas · Entendi").

`NÃO VERIFICADO` no app de verdade: a espera de 1,5 s digitando no chat real, o passo 3 com brinde real, as dicas no
perfil e no blueprint reais, e o "já vi" entre dois navegadores (depende do `db push` em produção).

---

## 4. Suíte completa

`npx vitest run` nesta máquina: **4685 passaram, 29 falharam, 10 pulados** (541 arquivos).

Nenhuma falha é desta branch. São as mesmas que já falhavam neste Windows:

- **Sem pacotes locais** (`pg`, sandpack): `rag/*`, `queue/rag`, `api/admin/rag`, `api/rag/minha-base`, `runChatTurn`, `videodoc/anexo`, `octa/PreviaReact`.
- **Windows/tempo:** `leitor/compose`, `octa/fortify`, `octa/genart`, `studio/storage`.

O CI (Linux) é quem confirma.

---

## 5. Como testar em produção (depois do deploy com `db push`)

1. Configurações → Geral → **Rever tutorial**.
2. **Passo 1:** digita devagar — o contorno fica no campo enquanto você escreve; parou → vai pro ↑ com "Quando terminar, aperta ↑ ou Enter". Pelo exemplo, vai direto.
3. **Passo 3:** se a resposta do passo 1 trouxe um desenho, o passo 3 **não pula** — só anda depois de você pedir o diagrama.
4. **Perfil:** 4 dicas, cada uma apontando o lugar certo (habilidades, foto, Editar, Mudar skin), com "1 de 4" e "Pular dicas".
5. **Sala de Estudos:** 5 dicas (lista, barrinhas, máquina, crítico, legenda). Sem crítico na tela, essa dica é pulada.
6. **"Já vi" na conta:** termina o tutorial num navegador, abre a mesma conta noutro (ou aba anônima) → **não aparece**. "Rever tutorial" → volta nos dois.
