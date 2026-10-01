# TCC cross-sala (PR3) — Estudos cria/edita · Pesquisa lapida com rigor

> Um documento, dois chats, dois níveis de liberdade. O aluno pede "crie um TCC sobre X" no meio
> da Sala de Estudos e a Aura cria e vai escrevendo o TCC numa ABA que abre ali mesmo. O mesmo
> documento é lapidado pelo chat da Sala de Pesquisa — e lá tudo nasce como SUGESTÃO com fonte
> verificada. Empilhado sobre a PR2 (memória/cartolina): compartilha o harness e o `scopeId`.

## Decisões do dono (implementadas)
1. **Edição concorrente = última vence + histórico, por seção.** Toda operação grava `TccRevisao`
   (origem + antes/depois); desfazer = restaurar o `antes`.
2. **Pesquisa não sobrescreve em silêncio.** O chat da Pesquisa gera sugestões (`status:"sugerida"`)
   que o aluno aceita/rejeita. Estudos e edição manual aplicam direto.
3. **A aba TCC abre na própria Sala de Estudos** (drawer por cima da conversa; a sala não muda).

## Flags (todas OFF — o merge não muda nada)
| Var | Onde | Efeito |
|---|---|---|
| `TCC_CROSS` | servidor | `1` liga `/api/tcc*` (senão 404) e o "crie um TCC" no chat |
| `NEXT_PUBLIC_TCC_CROSS` | cliente (build) | `1` mostra a aba/botão TCC, as sugestões na Pesquisa e o modo "lapidar" do chat |
| `CARTOLINA_MEMORIA` | servidor | (da PR2) também liga o card "TCC — em construção" na cartolina |

**Banco:** rodar `npx prisma db push` antes de ligar (campos novos em `ResearchWork` + modelo `TccRevisao` + 2 índices).

## Modelo
```prisma
model ResearchWork { // + campos (todos opcionais: work antigo segue igual)
  scopeId   String?  // a conversa (aba do chat) da Sala de Estudos — o MESMO scopeId da cartolina
  secoes    Json?    // [{ id, titulo, corpo }] — tem seções = é TCC cross-sala
  rev       Int @default(0) // controle otimista
  tccStatus String?  // "gerando" | "pronto" | "erro"
}
model TccRevisao { workId, secaoId, titulo?, op, origem, antes?, depois, status, fontes?, nota?, autorId, createdAt }
```
`content` continua sendo o espelho em markdown (`# SEÇÃO`): é o que o editor da Pesquisa e o
export ABNT (`parseAbntMarkers`) leem. Toda escrita no TCC regrava os dois juntos.

## Mecânica
- **Motor puro** — `lib/tcc/secoes.ts`: `aplicarOp` (substituir/inserir/anexar/remover, nunca o
  arquivo todo), `opsDeWork` (work.sections do harness → ops), `diffSecoes` (editor → ops),
  `rebasearOps` (merge de 3 vias), `opDeDesfazer`, markdown ⇄ seções.
- **Banco** — `lib/tcc/store.ts`: `aplicarNoTcc` com `rev` otimista (5 tentativas → 409), igual
  ao `patchBoard` da cartolina. Seções diferentes nunca se apagam; mesma seção = última vence.
- **Estudos** — `lib/tcc/turno.ts`, chamado pelo `app/api/ai/chat/route.ts`:
  - `tccContextoParaTurno`: com TCC na conversa, a Aura recebe a lista de seções e a regra
    "devolva `work.sections` só com o que muda" (o MESMO campo do schema que ela já usa).
  - `tccDoTurno`: `criar_trabalho` + TCC → cria o work com o `scopeId` da aba; se o modelo já
    escreveu seções, nasce com elas; se não, esqueleto ABNT + geração em background. Nos turnos
    seguintes, `work.sections` vira op por seção (origem `estudos`). Devolve `answer.tcc`
    `{ workId, criado, … }` → o cliente abre a aba.
- **Pesquisa (rigor)** — `lib/tcc/rigor.ts` via `POST /api/tcc/:id/revisar`:
  1. busca papers reais (`lib/scholar/retrieve` — o mesmo motor da Sala de Pesquisa);
  2. o modelo propõe ops citando SÓ as fontes numeradas;
  3. **crítico determinístico** (`critic:"full"` do contrato `revisar`): derruba op sem fonte,
     com fonte inexistente, em seção inexistente ou que remove seção; garante a chamada
     autor-data (NBR 10520) no texto; anexa a referência NBR 6023 de cada fonte.
  Sem fonte verificada → não propõe nada (e nem chama o modelo). Ao **aceitar**, a referência
  vai para a seção REFERÊNCIAS (sem duplicar).
- **Edição manual** — o autosave do editor da Pesquisa manda o markdown inteiro; em TCC isso
  vira ops por seção (origem `aluno`) com **merge de 3 vias** (`tccBase` = versão de onde a
  folha saiu): só as seções que o aluno mexeu entram, então a folha desatualizada não reverte o
  que a Sala de Estudos escreveu noutra seção.

## Rotas (sessão + `guard()`; userId nunca do cliente; sem acesso = 404)
| Rota | O quê |
|---|---|
| `GET /api/tcc?scopeId=` | o TCC da conversa (`{ id, titulo, status } \| null`) |
| `POST /api/tcc { topic, scopeId }` | cria e escreve em background → `202 { workId }` (já existe → devolve) |
| `GET /api/tcc/:id` | doc + seções + sugestões pendentes |
| `POST /api/tcc/:id/edit { secaoId, op, corpo, titulo?, aposId?, origem }` | estudos/aluno aplicam; `pesquisa` vira sugestão |
| `POST /api/tcc/:id/suggestion/:revId { aceitar }` | aplica (vira `aplicada`) ou rejeita |
| `GET /api/tcc/:id/history` · `POST … { revId }` | timeline · desfazer (restaura o `antes`) |
| `POST /api/tcc/:id/revisar { pedido, secaoId? }` | rigor da Pesquisa → sugestões com fonte |

**Membros:** quem é editor/leitor da cartolina daquela conversa (`CartolinaMembro`, PR1) é
editor/leitor do TCC dela. Leitor lê (GET), não edita/sugere/decide/desfaz (403).

## UI
- **Sala de Estudos** (`StudyCoworkChat`): botão "TCC" ao lado de "Cartolina" quando a aba tem
  TCC; abre `components/tcc/TccPanel.tsx` por cima do chat — Documento (crescendo ao vivo,
  edição por seção, realce do que mudou), Sugestões (aceitar/rejeitar), Histórico (voltar
  qualquer revisão), exportar ABNT (`/api/documents/abnt-export`, .docx) e atalho pra Pesquisa.
  Poll: 2,5 s gerando, 6 s depois. O card `tcc:<id>` da cartolina abre a aba.
- **Sala de Pesquisa**: `/research-lab?work=<id>` abre o TCC na folha; barra de sugestões
  acima do editor; o chat (`ResearchChat`) entra em "Lapidando o TCC" (alternável pra "só
  conversa"); a folha sincroniza com o servidor quando está limpa.

## Desvios do handoff (e por quê)
- **Background sem BullMQ.** A geração pelo tópico usa o padrão do Studio (cria "gerando",
  dispara solto, cliente faz poll) — é o que "como o Studio" faz hoje. O `revisar` é síncrono
  (é a resposta do chat; ~30–60 s, `maxDuration` 120). Pôr na fila só faz sentido junto da
  migração do chat inteiro pro worker.
- **Campos a mais:** `ResearchWork.rev` (sem ele duas salas em seções diferentes se apagariam)
  e `tccStatus` (poll da geração); `TccRevisao.titulo/op/fontes/nota` (timeline, restaurar
  seção removida, fonte verificada da sugestão). Status transitório `aplicando` impede aceite duplo.
- **Fonte da Pesquisa = Scholar, não `literature_search`.** A tool do harness ainda é stub
  (`skill_offline`); o rigor usa o `retrievePapers`, que só devolve papers que existem.
- **`/edit` com `origem:"pesquisa"`** vira sugestão mas não exige fonte (é a rota manual). A
  exigência de fonte verificada vale no caminho da IA (`/revisar`), que é o chat da Pesquisa.
- **`scopeId` = a aba do chat** (o mesmo da cartolina na PR2), não o id do StudySpace.

## Testes
`vitest` 1004/1004 (120 novos: `lib/tcc/*.test.ts` — inclui `entrelace.test.ts`, a jornada inteira
com o laço real do harness —, `app/api/tcc/tcc-routes.test.ts`, `app/api/research-works/research-works-tcc.test.ts`). Cobertura dos arquivos novos
(`lib/tcc/**` + `app/api/tcc/**`): **98,8 % linhas · 92 % branches**. `next build` ok com as flags ligadas.

## Não verificado / limitações
- **Não rodou contra Vertex nem MongoDB reais**, e a UI não foi exercitada num navegador (o chat
  dá 404 em dev sem credencial Vertex). Testar em prod/beta com as flags.
- Se o processo cair no meio de um aceite, a sugestão fica em `aplicando` (não volta sozinha pra fila).
- Trocar o tipo de trabalho (TCC/Artigo/Relatório) na Pesquisa SOLTA o TCC da folha (pra o
  autosave não gravar outro template por cima).
- Duas seções NOVAS seguidas digitadas no editor caem no fim do documento (a 2ª não sabe o id da 1ª).
- `/research-lab?work=<id>` usa o GET de `/api/research-works`, que é só do DONO: um membro
  editor da conversa lapida pela aba TCC da Sala de Estudos, não pela folha da Pesquisa (o
  compartilhamento da cartolina ainda é a PR de coworking).
