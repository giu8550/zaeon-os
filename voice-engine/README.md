# Zaeon Voice Engine v2 (TTS · Kokoro + Piper)

Voz da Zaeon. **Kokoro** (Apache-2.0, natural, leve, roda em CPU em tempo real) é o
engine padrão; **Piper** é o fallback offline. **Não roda na Vercel** — é um engine
local/host (padrão `abnt-service` 8001, `suggestion-forge` 8003). O Next consome via
`POST /api/ai/voice` (`VOICE_ENGINE_URL`).

## Setup

> ⚠️ **Python 3.10–3.12** (o Kokoro NÃO suporta 3.13). No macOS: `brew install python@3.12 espeak-ng`.

```bash
cd voice-engine
python3.12 -m venv .venv && source .venv/bin/activate
pip install -U pip
pip install -r requirements.txt

# Kokoro baixa os pesos no primeiro uso (HuggingFace). Para PT-BR use KOKORO_LANG=p.
# Fallback Piper: baixe uma voz PT-BR para ./voices (ou aponte PIPER_VOICE_DIR):
#   https://huggingface.co/rhasspy/piper-voices → pt_BR-faber-medium.onnx (+ .onnx.json)
mkdir -p voices

uvicorn main:app --port 8004
```

No app, aponte o proxy:
```
VOICE_ENGINE_URL=http://localhost:8004   # ou o host da VPS
```

## Endpoints
- `GET /health` → `{status, voice}`
- `GET /voices` → `{voices:[{id,label,gender,lang,tier}], default}`
- `POST /synthesize` → `{audio_base64, mime, voice}`  (body: `{text, voice?}`)

## Vozes (catálogo lógico em engine.py → VOICES)
- `aura-f` (feminina, free, Kokoro) · `aura-m` (masculina, free, Kokoro)
- `nova-f` (feminina, premium) · `piper-f` (fallback)

Se o Kokoro falhar / não estiver instalado, a síntese cai automaticamente no Piper.
Se nenhum modelo existir, o engine devolve 503 e o app degrada para a voz do navegador.

## Env
- `KOKORO_LANG` (default `p` = PT-BR), `ZAEON_TTS_DEFAULT` (default `aura-f`)
- `PIPER_VOICE_DIR`, `PIPER_VOICE` (fallback)

## Testes
```bash
.venv/bin/python -m pytest        # síntese mockada (não baixa modelos)
```

## Roadmap (ver docs/VPS_VOICE_AUTONOMY_IMPLEMENTATION_PROMPT.md)
- `/stream` (chunks, baixa latência) · Chatterbox (premium, requer GPU) · stt-engine (faster-whisper).
