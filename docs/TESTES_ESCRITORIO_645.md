# Escritório — card #645 · carregamento lento, resposta atrasada, ■ com 2 cliques e fórmula "por $…$" · testes

> Documento de apoio à PR do **#645** (branch `645-escritorio-lento-atrasada`). Tudo aqui foi tirado do código da
> branch e de execuções reais dos testes nesta máquina. Onde algo **não foi verificado de verdade**, está marcado como
> `NÃO VERIFICADO`. Área de infra (deploy) do Martinez no item 1 — mudança pequena, explicada abaixo.

---

## 1. Resumo

| # | Item do card | O que foi feito |
|---|---|---|
| 1 | Resposta atrasada ainda aparece | O código do #635 que descarta a resposta de quem saiu **está em produção** (`/api/health` → `commit 697d36ff`) e funciona nos testes. A causa provável: os turnos dos agentes rodam num **worker** (perfil `worker` do compose) que o deploy **nunca atualizava** — só recriava o `web`. Agora o `deploy.yml`, se o `zaeon_worker` estiver de pé, **reconstrói e recria o worker** junto. E o `/api/health` ganhou `escritorio: "fila" \| "inline"` (só o modo, nenhum segredo) — dá pra conferir sem entrar no servidor. |
| 2 | ■ Parar com 2 cliques | O turno avisava "escrevendo" a cada 20 s e a cada fase nova — depois do ■, o aviso trazia o balão e o ■ de volta. Agora: **no servidor**, o pulso confere se houve ■ (ou saída) e para de avisar; **na tela**, o aviso "escrevendo" de quem eu parei é ignorado até o turno acabar (`avisoDeQuemParou`) — vale até com o worker antigo. |
| 3 | "por $3,6$" saía cru | A regra do "R$" olhava a última letra antes do `$` **depois de tirar o espaço**: o "r" de "por"/"multiplicar" virava "R$". Agora só "R"/"US" soltos (`R $10`, `US $5`) são dinheiro. Vale pro chat da Aura também. |
| 4 | Foto repetida em cada mensagem | `GET /api/canal/[id]`: a foto guardada inteira (`data:…`) não vai mais em cada mensagem (`semFotoEmbutida`) — vai **uma vez por pessoa** em `pessoas`/`eu`, e a tela completa (`comFotos`). Foto por link (https) e avatar de agente ficam como estavam. Num canal com 30 mensagens de quem tem foto de 50 KB: de ~1,5 MB pra ~50 KB. |
| 5 | Baixava tudo de novo | Nos avisos ("Téo saiu…", "fulano entrou", resposta longa demais pro tempo real) a tela pede **só o que chegou** (`GET …?desde=<hora da última mensagem>`), com as pessoas só de quem escreveu isso, e junta (`juntarParcial`). Abrir o canal e reconectar continuam baixando tudo. |
| 6 | Abrir em duas etapas | O último canal aberto (guardado no navegador) começa a carregar **junto** com a lista de canais; se for ele mesmo o aberto, a tela usa essa resposta (sem buscar de novo). |
| 7 | Aviso de demora | `Carregando`: "Abrindo o escritório…/Abrindo o canal…"; passou de **4 s**, "Está demorando mais que o normal — pode ser a conexão. Aguarde um pouquinho…"; passou de **15 s**, **"Tentar de novo"**. |
| 8 | "carregando o blueprint…" no topo | Agora no **meio** da prancha (centro na altura e na largura). |

**Banco:** nada muda.

---

## 2. Como rodar

```bash
npx vitest run lib/chat/matematica.test.ts lib/canal components/office app/api/canal app/api/health
```

Novos testes:

- `lib/chat/matematica.test.ts`: "multiplicar por $3,6$" e "divida por $x$" são fórmula; "R $10"/"US $5" continuam dinheiro.
- `lib/canal/agent-turn.test.ts`: depois do ■, o pulso e as fases param de avisar "escrevendo".
- `lib/canal/parar.test.ts`: `avisoDeQuemParou` — o aviso atrasado é ignorado; o "ocioso" libera; o próximo turno aparece.
- `app/api/health/route.test.ts`: `escritorio` = "fila"/"inline", sem segredo no JSON.
- `app/api/canal/[id]/route.foto.test.ts`: a foto `data:` vai uma vez por pessoa, não por mensagem; `?desde=` traz só o novo; `?desde=` inválido = tudo.
- `lib/canal/aviso.test.ts`: `semFotoEmbutida`, `comFotos`, `juntarParcial`.
- `components/office/Carregando.test.tsx`: só o texto → aviso da conexão (4 s) → "Tentar de novo" (15 s).
- O trecho do `deploy.yml` foi validado (YAML).

---

## 3. Suíte completa

`npx vitest run` nesta máquina: **4754 passaram, 29 falharam, 10 pulados** (556 arquivos).

As 29 são as de sempre deste Windows, nenhuma desta branch: sem pacotes locais (`pg`, sandpack — `rag/*`, `queue/rag`,
`api/admin/rag`, `api/rag/minha-base`, `runChatTurn`, `videodoc/anexo`, `octa/PreviaReact`) e Windows/tempo
(`leitor/compose`, `octa/fortify`, `octa/genart`, `studio/storage`). O CI (Linux) é quem confirma.

---

## 4. Como testar em produção (depois do deploy)

1. **`/api/health`** (qualquer um, sem login): `https://zaeon.com.br/api/health` → campo **`escritorio`**. Se for `"fila"`, o log do deploy deve mostrar **"→ Worker: atualizando junto com o web…"**.
2. **Resposta atrasada:** "@teo me explica detalhadamente a história da programação…" e, logo em seguida, "@teo sai" → a resposta longa **não aparece** depois do "Téo saiu".
3. **■ com 1 clique:** pergunta longa → ■ uma vez → o balão e o ■ **não voltam**.
4. **Fórmula:** "@teo um carro anda 60 m em 12 s; qual a velocidade em km/h? mostra a conta" → o "multiplicar por 3,6" sai **desenhado**.
5. **Carregamento:** abrir o Escritório (melhor com F12 → Rede → "Lento 3G"): abre mais rápido; depois de 4 s aparece o aviso da conexão; depois de 15 s, "Tentar de novo".
6. **Fotos:** as fotos das pessoas continuam aparecendo nas mensagens.
7. **Blueprint:** trocar de blueprint → "carregando o blueprint…" no **meio** da prancha (pisca rápido agora que o servidor está rápido).

`NÃO VERIFICADO`: se a causa da resposta atrasada é mesmo o worker (o item 1 do teste confirma); o tempo real de
abrir o Escritório com internet lenta (depende da conexão).

---

## 5. Depois do deploy — o que o teste em produção mostrou e a correção (2ª PR do #645)

**O worker não existe:** o log do deploy disse "→ Worker: não está rodando (turnos no web)" e o `/api/health` mostra
`"escritorio":"inline"`. A suspeita do item 1 estava errada — mas o teste em produção (29/10) mostrou que a resposta
de quem saiu **já não entra** (pedido longo + "@teo sai" + F5: nada) e a do ■ também não. O descarte funciona.

**O ■ ainda precisava de 2 cliques (item 2) — causa achada:** a rota do ■ manda um "ocioso" pra apagar o balão das
outras telas; a tela lia esse "ocioso" como "o turno acabou", soltava a agente e o próximo "redigindo" (o turno segue
por trás até o fim) trazia o balão e o ■ de volta. Agora o aviso do ■ leva a marca **`parou: true`**: a tela apaga o
balão **e** passa a ignorar o "escrevendo" atrasado dessa agente; só o "ocioso" do fim do turno solta. Vale também
pra quem viu o ■ de outra tela.

**Balão de quem saiu (item 9, novo):** depois do "Téo saiu da conversa", o balão "Téo está investigando…" ficava até o
turno acabar. A rota da mensagem agora manda o mesmo aviso com `parou: true` quando a agente sai — o balão some na hora.

Testes: `lib/canal/parar.test.ts` (a marca não solta a agente; vale sem ter clicado), `app/api/canal/[id]/parar` (o
aviso leva a marca), `app/api/canal/[id]/mensagem` (a saída manda o aviso com a marca). Achado pelo teste: a rota da
mensagem nem importava o `EV_DIGITANDO` — sem o teste, o "@teo sai" quebraria em produção.

**Testar depois do deploy:** Ctrl+Shift+R → pergunta longa → ■ **uma vez** → o balão e o ■ não voltam (esperar ~30 s).
E: pergunta longa → "@teo sai" → o balão "investigando…" some junto com o "Téo saiu".
