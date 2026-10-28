# Sala de Estudos — card #631 · troca de blueprint lenta · testes e observações

> Documento de apoio à PR do **#631 — SALA DE ESTUDOS · TROCA DE BLUEPRINT LENTA** (branch `631-blueprint-troca-rapida`).
> Tudo aqui foi tirado do código da branch e de execuções reais dos testes nesta máquina. Onde algo **não foi
> verificado de verdade**, está marcado como `NÃO VERIFICADO`. Área do Martinez (Sala de Estudos / blueprint) — ele
> já sabia desta otimização.

---

## 1. Resumo

| # | Item do card | O que foi feito |
|---|---|---|
| 1, 4 | Nenhum sinal do clique | `useBlueprint` ganhou `selecionado` (muda **no clique**) e `carregando` (clicou e a prancha ainda é a de antes). O cartão da lista marca na hora (`aria-pressed`) e a prancha mostra **"carregando o blueprint…"** até a nova chegar. |
| 2, 5 | Toda troca buscava tudo de novo | O hook **guarda** os blueprints já abertos na visita: voltar num deles aparece **na hora** e a leitura do servidor confere por trás. A leitura que não mudou nada (mesmo `rev`, `updatedAt` e papel) **não troca o objeto** — a recarga de 20 s não redesenha a prancha à toa. |
| 3, 6 | A prancha redesenhava uma vez por card | `useAlturas`: as medidas dos cards do mesmo quadro entram **de uma vez** no quadro seguinte (`requestAnimationFrame`), e só se alguma mudou mais de 1 px. Abrir um blueprint com 10 cards = 1 redesenho (antes, 10). |
| 7 | Medir antes e depois | **Cronômetro desligado por padrão** (`components/blueprint/cronometro.ts`). Liga no console do navegador: `localStorage.setItem("zaeon.debug.blueprint", "1")`. Cada troca imprime: `[blueprint] xxxxxx · servidor 180 ms · na tela em 250 ms` (ou "guardado (sem esperar o servidor)"). Ninguém mais vê nada. |

**Servidor:** nada mudou (a rota `GET /api/blueprint/:id` já é só leitura no banco). Se o cronômetro mostrar o servidor como
a parte lenta, ver a consulta com o Martinez.

**Banco:** nada muda.

---

## 2. Como rodar

```bash
npx vitest run components/blueprint lib/blueprint
```

Resultado nesta máquina: **98 testes, todos passando**. Novos:

- `components/blueprint/useBlueprint.test.tsx` (servidor lento simulado): o clique marca **na hora** com `carregando`; a prancha de antes fica até a nova chegar; voltar num **já visto** é instantâneo; leitura sem mudança mantém o **mesmo objeto**; com `rev` novo, troca.
- `components/blueprint/useAlturas.test.tsx`: 10 medidas no mesmo quadro = **1** redesenho; trocar de blueprint zera; medida igual (±1 px) não muda nada.
- `components/blueprint/cronometro.test.tsx`: mede servidor e tela; **não imprime** se desligado.

---

## 3. Suíte completa

`npx vitest run` nesta máquina: **4694 passaram, 29 falharam, 10 pulados** (544 arquivos).

Nenhuma falha é desta branch. São as mesmas que já falhavam neste Windows:

- **Sem pacotes locais** (`pg`, sandpack): `rag/*`, `queue/rag`, `api/admin/rag`, `api/rag/minha-base`, `runChatTurn`, `videodoc/anexo`, `octa/PreviaReact`.
- **Windows/tempo:** `leitor/compose`, `octa/fortify`, `octa/genart`, `studio/storage`.

O CI (Linux) é quem confirma.

---

## 4. Como testar em produção (depois do deploy)

**Antes do deploy (pra comparar):** na Sala de Estudos, F12 → **Rede (Network)** → clica noutro blueprint → anota o **Tempo**
da linha `blueprint/…` e quanto a tela demora a mudar.

**Depois do deploy:**

1. F12 → **Console** → `localStorage.setItem("zaeon.debug.blueprint", "1")` e Enter (liga o cronômetro).
2. Clica noutro blueprint: o cartão **marca na hora** e aparece "carregando o blueprint…" até a prancha nova chegar.
3. No console aparece `[blueprint] … · servidor X ms · na tela em Y ms`.
4. Volta num blueprint que você **já abriu**: aparece **na hora** (no console: "guardado").
5. Fica 1 minuto parada: a prancha **não pisca/redesenha** sozinha a cada 20 s.
6. Pra desligar: `localStorage.removeItem("zaeon.debug.blueprint")`.

`NÃO VERIFICADO`: os tempos reais em produção (dependem da conta e da rede) — o cronômetro está aí pra isso.
