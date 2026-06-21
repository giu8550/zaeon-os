# Voz HD (SoTA) — roadmap pay-per-use (futuro)

> **MVP (agora):** o default é o **Kokoro `nova-f`** (pf_dora) rodando local no voice-engine —
> a voz mais natural que temos sem custo e em tempo real no VPS 8GB/2vCPU. Sem mudança de infra.
> Este doc é o plano pra quando quisermos a textura SoTA (Chatterbox) **sem hospedar o modelo**.

## Por que não rodar o SoTA no box atual
- Chatterbox 0.5B (ou Turbo 350M): textura SoTA pt-BR + clonagem, MAS **RAM mínima ~8GB** (o VPS
  tem 8GB e ~6.3GB já em uso) e em **2 vCPU sem GPU a síntese é lenta** (não tempo-real) e não
  aguenta concorrência. → rodar local = OOM/lentidão. Kokoro continua o motor real-time.

## Como plugar (pagando por uso, sem hospedar)
Aponta-se um **endpoint HTTP** do modelo; a síntese roda no provedor. Preços (jun/2026):
- **Replicate / Pixazo (Chatterbox):** ~$0,025 / 1.000 caracteres (pay-per-use puro, sem mensalidade).
- **Resemble Flex (donos do Chatterbox):** ~$0,0005 / segundo de áudio (~$1,80/h).
- **fal.ai:** F5/Orpheus ~$0,05/1k, Dia ~$0,04/1k, IndexTTS ~$0,002/seg.
- **chatterboxtts.com:** FREE 50k chars/mês (dá pra COMEÇAR sem pagar), Pro $19/mês por 10M chars.

Custo ancorado nos nossos limites: ler um estudo (~3k chars) ≈ $0,075; resposta de chat
(~300 chars) ≈ <$0,01. Aluno Plus lendo 10/dia ≈ ~$22/mês → **gated no premium + cota diária**.

## Implementação (quando ligar)
1. Voz `nova-hd` (premium) no catálogo (`voice-engine/engine.py → VOICES`).
2. Em `app/api/ai/voice/route.ts`: se `voice === "nova-hd"` E usuário é premium E dentro da cota →
   chama o endpoint hospedado (`CHATTERBOX_API_URL` + `CHATTERBOX_API_KEY`), devolve o áudio.
   Senão → Kokoro local (como hoje). **Fallback pro Kokoro** em erro/timeout/estouro de teto.
3. Gate por plano (Plus/Pro) + cota diária (mesma infra das cotas) pra controlar gasto.
4. Acompanhar o gasto no painel do provedor; teto mensal por env (`VOICE_HD_MONTHLY_CAP_USD`).

Env novas: `CHATTERBOX_API_URL`, `CHATTERBOX_API_KEY` (server, só no `.env` do VPS — nunca no git).

## Para começar GRÁTIS (quando quiser)
Criar conta no chatterboxtts.com (ou Replicate com créditos), pegar a key, setar as envs, e
testar só com a conta admin antes de liberar pro premium. Nada disso toca o VPS.
