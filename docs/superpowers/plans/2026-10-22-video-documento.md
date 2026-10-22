# Vídeo do documento (Zaeon holograma) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** cada documento-base de um blueprint (e o documento pedido no chat) ganha um vídeo que toca no navegador: slides do documento + a Zaeon holograma falando com a voz dela.

**Architecture:** o blueprint passa a guardar `documentos` (coletados da resposta da Aura a cada turno; a Zaeon marca até 3 como base). Um documento-base dispara a geração de um `StudioArtifact` `kind: "video-doc"` (roteiro JSON + um WAV com a narração; tempos por frase no `meta`), numa fila com teto (2 simultâneos, 6/pessoa/dia), compartilhado quando o documento é público (chave DOI/URL). O player (`components/videodoc/*`) toca o WAV e sincroniza slide/frase/destaque pelos tempos; o `HoloZaeon` mexe a boca pelo volume (AnalyserNode).

**Tech Stack:** Next 14, TS, Prisma/Mongo, vitest, Gemini (geminiJson flash) + Gemini TTS (Leda), three.js.

**Spec:** `docs/superpowers/specs/2026-10-22-video-documento-design.md`

## Global Constraints
- Flags: `NEXT_PUBLIC_VIDEO_DOC` (build-arg, UI) + `VIDEO_DOC` (servidor), mesmos lugares das flags do blueprint (Dockerfile, compose, deploy.yml, .env.example). Sem db push (StudioArtifact já existe; `kind` é string).
- Só modelos Google; nada de dependência nova.
- O roteiro só afirma o que está no texto do documento; sem texto acessível = sem vídeo (motivo no card).
- No máximo 3 vídeos automáticos por estudo; card de documento com vídeo nunca some.

## Review Focus
- Documento sem texto (paywall) → card "sem texto aberto", nenhuma geração. (Task 3)
- Roteiro malformado do modelo → artefato `error` com motivo, card mostra; não trava a fila. (Task 2/3)
- Dois estudos citando o mesmo DOI → um vídeo só. (Task 3)
- Pessoa sem papel no blueprint/artefato privado de outro → 404 no vídeo e no áudio. (Task 4)
- Teto diário estourado → "na fila"/"limite de hoje", sem gerar. (Task 3)

---

## FATIA V1 — Documentos no blueprint + vídeo no card (PR sobre #544)

### Task 1: documentos no blueprint (puro)
- `lib/blueprint/tipos.ts`: `Documento = { id; titulo; tipo: "artigo"|"livro"|"base"|"trabalho"; url?; ref?; base: boolean; videoId?: string }`, `DocBlueprint.documentos: Documento[]` (máx 20; saneado; `videoId` só id ObjectId).
- `lib/videodoc/documentos.ts`: `documentosDaResposta(answer): Documento[]` (sources, evidencia[].source, fontesBase → tipo base/ref documentoId, livros com pdfUrl, tcc → trabalho/ref workId), `chaveDocumento(d): string` (doi:… | url normalizada | base:<id> | trabalho:<id>), `juntarDocumentos(atual, novos)` (dedup pela chave, preserva `base`/`videoId`).
- `compor.ts`: o prompt lista os documentos (id + título) e o plano devolve `documentosBase: string[]` (até 3); `mesclarComposicao` liga `base` neles e mantém `base` em quem já tem `videoId`.
- Tests: coleta das 4 origens; dedup DOI/URL; base estável com vídeo; máx 3 base.

### Task 2: roteiro e narração (puro + servidor)
- `lib/videodoc/roteiro.ts`: `ROTEIRO_SYSTEM`, `promptRoteiro({titulo, texto})` (texto cortado ~30k), `lerRoteiro(raw): Roteiro | null` (5–8 slides; slide = { titulo, topicos:[{id,texto}], frases:[{fala, legenda, alvo?}] }; `alvo` = id de tópico do slide ou "titulo"), `CHECAGEM_SYSTEM` + `promptChecagem(roteiro, texto)` → roteiro corrigido (mesmo formato).
- `lib/videodoc/gerar-server.ts`: `gerarVideoDoc(artId, {titulo, texto}, deps)` → roteiro → checagem → TTS por frase (Leda; até 4 em paralelo) → `concatWav` → `writeStudioFile(artId,"wav")` → `meta = { roteiro, tempos: number[] (início de cada frase, s), duracao }`, status done; erro → status error + `error`.
- Tests: `lerRoteiro` poda/limita; tempos a partir dos tamanhos PCM; erro do modelo → error.

### Task 3: texto do documento, fila e disparo
- `lib/videodoc/texto-server.ts`: `textoDoDocumento(d, userId)` → artigo/livro (url/doi → `resolveFullText`), base (`buscarPorId(ragPg(), ref).markdown`, só se a pessoa tem permissão), trabalho (`ResearchWork.content` do dono). `null` = sem texto aberto.
- `lib/videodoc/fila.ts`: semáforo (2) + `podeGerarHoje(userId)` (conta artefatos video-doc do dia ≤ 6).
- `lib/videodoc/server.ts`: `garantirVideo({ userId, documento, blueprintId })` → reaproveita artefato existente (público: qualquer dono com mesma `meta.chave`; privado: do dono) ou cria `queued` e enfileira; devolve `{ videoId } | { motivo }`.
- `lib/blueprint/server.ts`: `blueprintDoTurno` recebe `answer` e junta documentos; depois de compor, pra cada base sem vídeo (≤3 com vídeo no estudo) chama `garantirVideo` e grava `videoId`.
- Tests com deps falsas: reaproveita DOI; privado não vaza; teto do dia; sem texto → motivo.

### Task 4: rotas do vídeo
- `GET /api/videodoc/[id]` → `{ status, titulo, roteiro?, tempos?, duracao?, erro? }`; `GET /api/videodoc/[id]/audio` → WAV. Acesso: dono do artefato, ou `meta.publico`, ou papel em algum blueprint do `meta.blueprints` (lista de ids). Flag `VIDEO_DOC`.
- Test da regra de acesso (pura: `podeVerVideo`).

### Task 5: card + player
- `lib/blueprint/layout.ts`: módulos `video:<docId>` (lado direito, depois de repositórios) pros documentos com `videoId` ou base.
- `components/videodoc/PlayerVideoDoc.tsx` (overlay): slides à esquerda (estética blueprint; tópicos aparecem por frase; destaque no `alvo`; legenda), `HoloZaeonCena` à direita (three.js: `criarHoloZaeon`, `aparecer`, `boca(nivel)` do AnalyserNode), controles play/pausa/anterior/próximo, progresso.
- `components/blueprint/Modulos.tsx`: card `VÍDEO · V-0N` (status: gerando/na fila/sem texto/▶ duração).
- Prévia local + screenshot.

## FATIA V2 — Pedido no chat (PR sobre V1)
- O chat ("faz um vídeo desse artigo/PDF"): intenção detectada no turno (heurística), documento resolvido entre os da conversa (ou o PDF anexado, que sobe pra Minha base via `/api/rag/minha-base` e vira `base`), `garantirVideo` e um embed do player na resposta.
