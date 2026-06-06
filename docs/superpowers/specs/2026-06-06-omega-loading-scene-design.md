# Omega Scholar — Loading Scene (busca produtiva/viciante)

**Data:** 2026-06-06 · **Status:** Aprovado (design) · **Branch:** `feat/omega-loading-scene` (off main)

## Objetivo
Trocar a experiência de "loading" da pesquisa do Omega Scholar por uma cena **artística e produtiva**:
o termo buscado aparece **grande e destacado** (mantendo a lupa 🔎), com glitch estilo Matrix alternando
**latim ↔ chinês**, e a antiga linha "queimando tokens" vira uma **barra minimalista** que simula a
**liberação de agentes na rede** pesquisando tudo. Referência estética: `components/ui/MacSplash.tsx`
(barra glow + frases em mandarim + logs de daemon), porém focada em produtividade.

## Decisões (do brainstorming)
- Glitch: **alterna latim ↔ chinês** (CJK aleatório), legível entre os pulsos.
- Barra: **reflete o progresso REAL** do stream (fases + contadores que já vêm no `message`).
- Plataforma: **desktop-first**, mas responsivo no estilo Claude/apps de IA modernos (sem overflow,
  termo escala, logs empilham/clampam, touch-friendly).
- Branch/PR próprios (independente do PR #24, que não tocou Bar/Thread).

## Componentes (isolados, testáveis)

### `lib/scholar/glitch.ts` (puro — o "script")
- `mulberry32(seed)` → PRNG determinístico (testes); componentes podem passar `Math.random`.
- `randomCjk(len, rng)` → string de `len` glifos CJK (U+4E00–U+9FFF) + katakana p/ sabor Matrix.
- `scramble(from, to, progress, rng)` → morph char-a-char de `from`→`to`; em `progress` baixo domina
  ruído CJK, em `progress=1` retorna `to` exato. Comprimento = `max(len)`.

### `lib/scholar/loading-phases.ts` (puro)
- `progressFor(phases, status)` → alvo [0,1]: planning .12 · searching .28→.55 (ramp por nº de fontes)
  · dedup .64 · synthesizing .82 · verifying .93 · done 1.
- `agentNarrative({phase, message})` → `{ icon, text }` reaproveitando o `message` (que já traz números),
  ex.: `⟁ agente · arXiv: 23 papers`, `⊹ mesclando · 31 únicos`, `✓ citações confirmadas · 12`.

### `components/research/GlitchTerm.tsx`
Termo grande + 🔎. Ciclo: **latim (dwell ~2.4s) → morph .45s → 中文 (dwell ~1.6s) → morph .45s → loop**,
com flicker leve de 1–2 chars no dwell latino. Gradient violet→cyan; `Noto Sans SC` na face chinesa.
`aria-label` = query real. `status==="done"` ⇒ assenta no latim e para. rAF com cleanup.
**Responsivo:** `text-xl sm:text-2xl md:text-3xl lg:text-4xl`, `break-words`, `max-w-full`.

### `components/research/AgentSwarmLoader.tsx`
Props `{ phases, status }`. Barra glow minimalista (estilo MacSplash) cujo valor exibido **suaviza** até
`progressFor(...)` + creep por tempo (nunca trava, limitado abaixo do próximo marco). Headline
"⟁ liberando agentes na rede…" + logs monospace via `agentNarrative` (fade-in tipo daemon).
**Responsivo:** mobile mostra as últimas ~3 linhas (clamp), fonte menor, largura total.

## Integração (2 arquivos existentes)
- `ActivityThread.tsx` → cena de loading: `<GlitchTerm term={query} done={status==='done'} />` no lugar do
  `🔎 "{query}"` pequeno; `<AgentSwarmLoader phases status />` no lugar da lista de fases + "processando…".
  A resposta (`answer`) segue renderizando ao concluir.
- `OmegaScholarBar.tsx` → linha `queimando tokens`/🔥 vira faixa **compacta** (barrinha fina +
  última linha de agente + `Ns`), reutilizando `progressFor`/`agentNarrative`.

## Data flow
Tudo de `useOmegaScholar()` (`query`, `phases`, `status`). **Sem mudança de backend/contexto** — os
contadores já vivem em `phase.message`.

## A11y / performance
`prefers-reduced-motion` ⇒ barra estática + sem morph/creep (mostra só o termo latim). rAF cancelado no
unmount. `aria-live="polite"` nos logs; `aria-label` com a query real.

## Testes (vitest — suíte verde)
`glitch.test.ts` (randomCjk determinístico/within-range; scramble: progress 0 ruidoso, 1 = `to`) e
`loading-phases.test.ts` (progressFor monotônico por fase; agentNarrative por tipo). Componentes não têm
jsdom/testing-library no repo → unidade testável é a lógica pura.
