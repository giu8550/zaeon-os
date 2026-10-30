# Escritório — card #657 · aviso de conexão mais esperto · testes e observações

> Documento de apoio à PR do **#657 — ESCRITÓRIO · AVISO DE CONEXÃO MAIS ESPERTO (SEM INTERNET, FALHA NA HORA E VOLTAR
> SOZINHO)** (branch `657-aviso-conexao`). Nasceu do teste do #645 com "Sem conexão de rede" no F12. Tudo aqui foi
> tirado do código da branch, de execuções reais dos testes e de uma prévia das telas novas nesta máquina. Onde algo
> **não foi verificado de verdade**, está marcado como `NÃO VERIFICADO`.

---

## 1. Resumo

| # | Item do card | O que foi feito |
|---|---|---|
| 1 | Falhou, avisa na hora | A busca da lista e a do canal pegam o erro de rede (`ehErroDeRede`): em vez de "Abrindo o canal…" esperando 4 s/15 s à toa, aparece **na hora** "Não deu pra abrir o Escritório — A conexão falhou no meio do caminho." + **Tentar de novo**. |
| 2 | Sem internet ≠ lenta | O navegador avisa quando está offline (`navigator.onLine` + eventos `online`/`offline`): "Você está sem internet — Assim que a conexão voltar, o Escritório abre sozinho." Lento continua o aviso do #645. |
| 3 | Volta sozinho | Internet voltou e o Escritório ainda não abriu → tenta de novo sozinho. |
| 4 | Tentar de novo só o Escritório | `tentarDeNovo`: sem lista → busca a lista; com lista → só o canal aberto. Não recarrega mais a página inteira. |
| 5 | Mostrar que não travou | Pontinho girando junto do "Abrindo…"; o aviso de demora ficou mais visível (mais contraste). |
| 6 | Erro de rede em português | `mensagemDeErro`: no envio, apagar canal, convite e lista, o "NetworkError when attempting to fetch resource." / "Failed to fetch" virou "Sem conexão — sua mensagem não foi enviada. Tente de novo." (erros das rotas continuam como estão — já são em português). |
| 7 | Mensagem aparece na hora | Ao apertar ↑, a mensagem entra **na hora**, meio apagada, com "enviando…" no lugar da hora; a caixa esvazia. Chegou → fica normal (sem duplicar, mesmo se o ao vivo trouxer antes: `confirmarEnviada`/`chegouAoVivo`). Falhou → sai da conversa e o texto **volta pra caixa**. |
| 8 | "Reconectando…" | A conexão ao vivo (Pusher) caiu depois de ter conectado → aviso âmbar no topo "Reconectando…" (sem internet: "Sem internet — as mensagens chegam quando voltar"). Some ao reconectar (`vigiaAoVivo`). |
| 9 | Reconectar baixa só o que chegou | Ao voltar a conexão ao vivo: `atualizarDesde` (o `?desde=` do #645) em vez de baixar as 60 mensagens. |

**Banco / servidor:** nada muda (só a tela).

---

## 2. Como rodar

```bash
npx vitest run lib/canal/conexao.test.ts components/office
```

Novos testes:

- `lib/canal/conexao.test.ts`: erro de rede de cada navegador (Chrome "Failed to fetch", Firefox "NetworkError…", Safari "Load failed", Node "fetch failed"); a frase em português; "Reconectando…" só depois de ter conectado; a "enviando…" trocada pela real sem duplicar (resposta do envio e chegada ao vivo).
- `components/office/Carregando.test.tsx`: falhou → avisa na hora com "Tentar de novo" (sem esperar); sem internet → "abre sozinho"; carregando → o pontinho girando.

---

## 3. Verificado numa prévia

As telas novas renderizadas de verdade (tema escuro): "Abrindo o canal…" com o pontinho girando; "Não deu pra abrir o
Escritório" + Tentar de novo; "Você está sem internet"; o aviso "Reconectando…"; a mensagem "enviando…" meio apagada.

`NÃO VERIFICADO` no app de verdade: o fluxo todo com o Escritório real (depende do login e do Pusher) — o roteiro abaixo
confere.

---

## 4. Suíte completa

`npx vitest run` nesta máquina: **4852 passaram, 29 falharam, 11 pulados** (567 arquivos).

As 29 são as de sempre deste Windows, nenhuma desta branch: sem pacotes locais (`pg`, sandpack — `rag/*`, `queue/rag`,
`api/admin/rag`, `api/rag/minha-base`, `runChatTurn`, `videodoc/anexo`, `octa/PreviaReact`) e Windows/tempo
(`leitor/compose`, `octa/fortify`, `octa/genart`, `studio/storage`). O `lib/lounge3d/salaColyseus.int.test.ts` (teste
de integração do ciberespaço, de 05/10) falhou junto com a suíte e **passa sozinho** — lentidão de rodar tudo de uma vez.
Verificação de tipos limpa (fora `pg`/sandpack). O CI (Linux) é quem confirma.

---

## 5. Como testar em produção (depois do deploy)

Use o F12 → **Rede** → o botão "Sem limitação" (o mesmo do teste do #645).

1. **Falhou na hora:** vá pra outra sala, troque pra **"Sem conexão de rede"** (Offline) e clique no Escritório → aparece
   **na hora** "Você está sem internet…" (sem esperar 4 s/15 s).
2. **Volta sozinho:** troque pra **"Sem limitação"** → o Escritório abre sozinho, sem clicar em nada.
3. **Tentar de novo só o Escritório:** com Offline, clique em "Tentar de novo" → a página **não** recarrega (continua a tela do Escritório).
4. **"Enviando…":** troque pra **"GPRS"**, mande uma mensagem → ela aparece **na hora**, meio apagada, "enviando…"; depois fica normal.
5. **Erro em português:** com Offline, mande uma mensagem → some da conversa, o texto volta pra caixa e aparece
   "Sem conexão — sua mensagem não foi enviada. Tente de novo."
6. **"Reconectando…":** com o Escritório aberto, troque pra Offline → no topo aparece o aviso âmbar; volte pra
   "Sem limitação" → o aviso some e as mensagens que chegaram aparecem.
7. **No final, volte pra "Sem limitação".**
