# Tutorial — card #626 · ajustes do cartão e do passo do diagrama · testes e observações

> Documento de apoio à PR do **#626 — TUTORIAL · AJUSTES DO CARTÃO E DO PASSO DO DIAGRAMA**
> (branch `626-tutorial-ajustes-cartao-diagrama`). Tudo aqui foi tirado do código da branch, de execuções reais dos
> testes e de uma página de prévia do cartão aberta no navegador nesta máquina (1366×643, a área da página no notebook
> da equipe). Onde algo **não foi verificado de verdade**, está marcado como `NÃO VERIFICADO`.

---

## 1. Resumo

| # | Item do card | O que foi feito |
|---|---|---|
| 1, 6 | Passo 3 não reconhecia o pedido | O chat avisa 3 momentos novos: **desenho começou / terminou / falhou** (`zaeon:chat:desenho`) e **a resposta acabou** (`zaeon:chat:turno-fim`). No passo do diagrama: mandou o pedido → o cartão **minimiza sozinho** com "✓ Pedido enviado! A Aura está respondendo…"; o desenho começou → "Desenhando o teu diagrama… ⏳"; ficou pronto (diagrama, aula ou mapa mental) → o passo anda. A resposta acabou sem desenho (espera 1,5 s, porque o desenho pode começar logo depois) ou o desenho falhou → o cartão **volta** com "Dessa vez não saiu o desenho. Pede de novo, ou clica em “Já fiz” pra seguir" e o **"Já fiz" vira botão**. O passo anda **um** de cada vez (dois avisos juntos pulavam o passo 4). |
| 2, 7 | Fala do passo 1 | "Bora começar: me diz aqui no chat um tema que você quer estudar…" (sem o "clica em Quero estudar sobre…"). |
| 8 | 👇 e fala do passo 2 | Sem o 👇; a Sala de Estudos é apresentada como os **blueprints** (fases, o que estudar, o que construir). |
| 9 | "Minimizar" escrito | Saiu; fica a setinha do canto. Os botões voltam pra **uma linha** (medido: 28 px). |
| 10 | Exemplo × enviar | O exemplo vira um **link discreto** ("ou usa o exemplo: …"). Com texto no campo, o exemplo **some**, o "Sua vez" diz **"Agora é só apertar ↑ ou Enter"** (o mesmo símbolo do botão), o contorno do ↑ fica **forte** e ganha a etiqueta **"Enviar"** em cima. |
| 4, 12 | Percurso | O último estado do botão do mapa fica guardado (`avisarEstadoPercurso`) — o tour que começa depois do chat não perde o "Ver mapa". Os textos usam o que está escrito no botão: “Gerar mapa”, “Traçar percurso”, "Gerando o mapa… ⏳", “Ver mapa”. Saiu o "✦", que não existia na tela. |
| 5, 13 | Rever numa conversa que já é estudo | O "Rever tutorial" pede uma **conversa nova e vazia** (`pedirConversa`) antes de recomeçar — vale também se o laboratório ainda não estiver aberto. |
| 3, 11 | "Já vi" do servidor | **NÃO FEITO nesta PR — depende de decisão.** O único campo do banco, `tourDone`, é compartilhado pela missão do tablet e pelo tour da Sala (e o menu usa pra boas-vindas). Usar ele esconderia o tour da Sala de quem só fez a missão do tablet. O certo é um campo novo no `User` (ex.: `toursVistos Json?`) — mudança de banco, área do Martinez. |

**Banco:** nada muda.

---

## 2. Como rodar

```bash
npx vitest run lib/onboarding components/onboard
```

Resultado nesta máquina: **104 testes, todos passando**. Novos:

- `lib/onboarding/tourSala.test.ts`: as transições do pedido (enviado → desenhando → semDesenho…); os textos do percurso com os nomes do botão e sem "✦"; o estado do percurso guardado; as falas sem 👇 e sem "Quero estudar sobre…".
- `components/onboard/TourSala.test.tsx`: Enter → pílula "Pedido enviado" → "Desenhando" → pronto anda **um** passo (com os dois avisos juntos); sem desenho → o cartão volta e o "Já fiz" segue; desenho falhou → volta; percurso já pronto antes do tour → "Ver mapa"; sem o "Minimizar" escrito; etiqueta "Enviar" e exemplo escondido com texto no campo.
- `components/onboard/DicasRapidas.test.tsx`: "Rever tutorial" pede conversa nova (evento + bilhete).

---

## 3. Verificado no navegador (prévia, 1366×643)

- Passo 2: fala nova, sem 👇; linha de botões em **uma linha** ("Passo 2 de 5 · Pular · Bora").
- Passo 1 com texto no campo: "Sua vez" só com "Agora é só apertar ↑ ou Enter", **etiqueta "Enviar"** em cima do botão e o contorno forte.

`NÃO VERIFICADO` no app de verdade: o fluxo do pedido do diagrama com a Aura real (minimizar, desenhando, pronto/sem
desenho), o "Ver mapa" num estudo que já tem mapa e a conversa nova do "Rever tutorial".

---

## 4. Suíte completa

`npx vitest run` nesta máquina: **4649 passaram, 29 falharam, 10 pulados** (538 arquivos).

Nenhuma falha é desta branch. São as mesmas que já falhavam neste Windows:

- **Sem pacotes locais** (`pg`, sandpack): `rag/*`, `queue/rag`, `api/admin/rag`, `api/rag/minha-base`, `runChatTurn`, `videodoc/anexo`, `octa/PreviaReact`.
- **Windows/tempo:** `leitor/compose`, `octa/fortify`, `octa/genart`, `studio/storage`.

O CI (Linux) é quem confirma.

---

## 5. Como testar em produção (depois do deploy)

No notebook (1366×768). Configurações → Geral → **Rever tutorial**.

1. Abre uma **conversa nova e vazia** e o tutorial começa no passo 1.
2. Passo 1: a fala pede o tema **no chat**. Usa o link "ou usa o exemplo…" → o exemplo some, aparece "Agora é só apertar ↑ ou Enter" e a etiqueta **"Enviar"** em cima do botão.
3. Botões numa linha só, sem "Minimizar" escrito; a setinha do canto minimiza.
4. Passo 2: sem 👇, falando dos blueprints.
5. Passo 3: manda "Faz um diagrama interativo disso" com **Enter** → o cartão vira a pílula "✓ Pedido enviado!" → "Desenhando o teu diagrama… ⏳" → o diagrama abre e o tutorial vai pro passo 4.
6. Se a Aura responder **só com texto**: o cartão volta com "Dessa vez não saiu o desenho…" e o botão **Já fiz** segue.
7. Passo 4 num estudo que **já tem mapa**: diz "Pronto! Clica em “Ver mapa”"; num estudo sem mapa, "Clica em “Gerar mapa”" → "Gerando o mapa… ⏳" → "Ver mapa".
