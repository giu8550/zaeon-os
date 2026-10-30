# Card #414 · PDFs que não aparecem ao arrastar (e os 2 erros 404 da página Sobre) · testes

> Documento de apoio à PR do **#414 — ALGUNS PDFS NÃO APARECEM PRA LEITURA NA SALA DE PESQUISA QUANDO ARRASTAMOS**
> (branch `414-pdfs-arrastar`). O card listava 3 erros do console. Tudo aqui foi tirado do código da branch e de
> execuções reais dos testes nesta máquina. Onde algo **não foi verificado de verdade**, está marcado como `NÃO VERIFICADO`.
> O card estava com a Andressa, que saiu do projeto.

---

## 1. Resumo

| Erro do card | Causa | O que foi feito |
|---|---|---|
| **502 (pdf)** — o PDF não aparece ao arrastar | O proxy `/api/ai/scholar/pdf` baixa o endereço salvo; quando vinha **HTML** (a página do artigo, o arXiv `/abs/`, o `doi.org` que redireciona pra editora) respondia 502. E ao **soltar da biblioteca na conversa**, a falha era **silenciosa**: não acontecia nada. | **Servidor:** arXiv `/abs/<id>` vai direto pro `/pdf/<id>`; página HTML → o PDF que ela anuncia na marcação padrão das revistas (`citation_pdf_url`, `<link rel="alternate" type="application/pdf">` — `lib/scholar/pdfDaPagina.ts`). O link achado passa pelo **mesmo guard anti-SSRF** (host privado é barrado). **Tela:** quando não dá mesmo (site recusa/fora do ar), a Aura diz na conversa o que houve e dá o link do **site original** (`avisoPdfNaoAbriu`). |
| **404 cofundadora.jpg** | A página Sobre pedia `/team/cofundadora.jpg`, que nunca existiu (a tela já mostrava as iniciais, mas o navegador registrava o 404 em toda visita). | `foto` ficou opcional em `lib/about/equipe.ts`: sem foto, o PDA mostra as iniciais **sem pedir** a imagem. Quando a foto chegar: pôr em `public/team/cofundadora.jpg` e voltar o campo. |
| **404 Google_for_Startups_logo.svg** | O logo vinha de um endereço da Wikimedia que não existe mais. | Virou **texto** com as cores do Google ("Google for Startups"), sem depender de site de fora — cinza normal, colorido no mouse, como antes. Verificado numa prévia (claro e escuro). |

**Banco:** nada muda.

---

## 2. Como rodar

```bash
npx vitest run lib/scholar/pdfDaPagina.test.ts app/api/ai/scholar/pdf components/chat/useAnexoChat.test.tsx components/about lib/about
```

Novos testes (não havia nenhum teste do proxy de PDF):

- `lib/scholar/pdfDaPagina.test.ts`: `citation_pdf_url` (relativo → absoluto, `&amp;`), aspas simples, `<link rel=alternate>`, página sem PDF, `javascript:` barrado; arXiv `/abs/` → `/pdf/`.
- `app/api/ai/scholar/pdf/route.test.ts`: PDF direto igual; página → PDF anunciado (antes 502); arXiv direto; **PDF anunciado em host privado não é buscado** (anti-SSRF); página sem PDF / site que recusa / fora do ar → 502.
- `components/chat/useAnexoChat.test.tsx`: a mensagem da Aura (com link pro site; upload local pede pra soltar de novo).

---

## 3. Suíte completa

`npx vitest run` nesta máquina: **4838 passaram, 29 falharam, 10 pulados** (565 arquivos).

As 29 são as de sempre deste Windows, nenhuma desta branch: sem pacotes locais (`pg`, sandpack — `rag/*`, `queue/rag`,
`api/admin/rag`, `api/rag/minha-base`, `runChatTurn`, `videodoc/anexo`, `octa/PreviaReact`) e Windows/tempo
(`leitor/compose`, `octa/fortify`, `octa/genart`, `studio/storage`). Verificação de tipos limpa (fora `pg`/sandpack).
O CI (Linux) é quem confirma.

---

## 4. Como testar em produção (depois do deploy)

1. **Ctrl+Shift+R**.
2. **Página Sobre nós** (F12 → Console): sem os erros 404 de `cofundadora.jpg` e `Google_for_Startups_logo.svg`. A cofundadora mostra as iniciais; "Google for Startups" aparece em texto (colorido no mouse).
3. **PDF de uma página de artigo:** na Sala de Pesquisa, salve na biblioteca um artigo do **arXiv** (ou de uma revista) e arraste pra conversa → o PDF **abre**.
4. **PDF que o site não deixa baixar:** arraste um PDF desses → a Aura responde "Não consegui abrir **…**: o site de origem não deixou baixar o PDF…" com o link do site (antes: nada acontecia).

`NÃO VERIFICADO`: quais revistas reais anunciam o `citation_pdf_url` sem pedir login (a maioria das abertas anuncia;
as pagas mandam pra página de login — aí cai no aviso do item 4).
