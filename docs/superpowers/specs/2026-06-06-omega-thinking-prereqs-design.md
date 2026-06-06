# Omega Scholar — "IA pensando" + Conhecimentos Prévios + Typewriter

**Data:** 2026-06-06 · **Status:** Aprovado · **Branch:** `feat/omega-thinking-prereqs` (off main)

## Objetivo
1. Dar à geração da **sugestão de pesquisa** (`ResearchSuggestionPanel`) a sensação de a IA *pensando*
   (frases `interpolando dados → cruzando referências → …`), mantendo o dinamismo de "Trabalhos relacionados".
2. **Typewriter** no `InsightsModule.summary` (digita ao entrar na aba).
3. Trocar a aba **"Sugestão"** do workspace por **"Conhecimentos Prévios"** — um engine novo que, a partir da
   pesquisa, recomenda o que estudar antes ("estude X/Y pra entender Z").

## Componentes

### Puros (TDD)
- `lib/scholar/thinking-phrases.ts` — `THINKING_STEPS` + `thinkingState(elapsedMs)` → `{index, progress, step}`
  (progresso assintótico ≤ 0.95; índice monotônico). Fases **simuladas no tempo** (research-suggest é 1 POST).
- `lib/scholar/typewriter.ts` — `typedLength(len, elapsedMs, cps)` + `typedSlice(text, elapsedMs, cps)` (unicode-safe).
- `lib/scholar/prereqs.ts` — `buildPrereqsSystemPrompt()`, `buildPrereqsUserMessage({topic,references,insights})`,
  `sanitizePrereqs(raw)`, `generatePrereqs(...)` (Gemini 2.5-pro via `geminiJson`). Pure parts testadas; Gemini no route.

### Componentes
- `components/research/ThinkingStream.tsx` — barra glow + logs de daemon dirigidos por `thinkingState` (estética do `AgentSwarmLoader`).
- `components/research/Typewriter.tsx` — usa `typewriter.ts`; respeita `prefers-reduced-motion`; re-digita ao mudar `text`/`replayKey`.
- `app/workstation/student/omega/modules/PrereqsModule.tsx` — aba nova: "📘 Estude **X** — por quê: …" + `ThinkingStream` no loading.

### Rota + contexto
- `app/api/ai/scholar/prereqs/route.ts` — auth (lookup por email) + `generatePrereqs`. Não-stream.
- `OmegaScholarContext` += `prereqs / loadingPrereqs / fetchPrereqs` — gera **sob demanda ao abrir a aba**,
  **sem persistir** (evita `db push`, que está quebrado).

## Integração
- `ResearchSuggestionPanel`: skeleton → `ThinkingStream`; título assenta com micro-glitch (`glitch.ts`); refs com reveal escalonado.
- `InsightsModule`: `summary` → `Typewriter`.
- `OmegaScholarWorkspace`: aba `suggestions` → `prereqs` ("Conhecimentos Prévios"). `SuggestionForgeModule.tsx` permanece no repo.

## Decisões
- Conhecimentos Prévios: **sob demanda** (lazy ao abrir a aba), não persistido. Gemini **2.5-pro** (raciocínio).
- Reuso máximo do que veio no PR #25 (glitch, agent loader). `prefers-reduced-motion` em tudo.

## Testes (vitest)
`thinking-phrases.test.ts`, `typewriter.test.ts`, `prereqs.test.ts` (builders + sanitize). Componentes não têm jsdom → unidade testável é a lógica pura.
