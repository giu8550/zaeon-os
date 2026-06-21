"""Síntese de voz (TTS) da Zaeon — Kokoro (default) com fallback Piper.

Estratégia (Fase VPS — voz de alta textura):
  1) KOKORO (Apache-2.0, ~82M, natural e leve, roda em CPU em tempo real) — voz padrão.
  2) PIPER (rápido, offline) — fallback se o Kokoro não estiver instalado/ falhar.

Todos os imports pesados são LAZY (dentro das funções) para que os testes rodem com
a síntese mockada, sem baixar modelos — mesmo padrão do suggestion-forge/voice v1.

Seleção de voz: o front manda um `voice` lógico do catálogo (ver VOICES). Cada voz
mapeia para (engine, voz nativa do engine, idioma, gênero, tier). Assim trocamos de
engine/voz por configuração, sem o front saber os detalhes.

Env:
  PIPER_VOICE_DIR   diretório dos .onnx do Piper (fallback)         [./voices]
  PIPER_VOICE       voz Piper padrão                                [pt_BR-faber-medium]
  KOKORO_LANG       código de idioma do Kokoro ('p'=pt, 'a'=en-us)  [p]
  ZAEON_TTS_DEFAULT id de voz padrão do catálogo                    [aura-f]
"""
from __future__ import annotations

import base64
import io
import os
import wave
from functools import lru_cache

PIPER_VOICE_DIR = os.environ.get(
    "PIPER_VOICE_DIR", os.path.join(os.path.dirname(__file__), "voices")
)
PIPER_DEFAULT = os.environ.get("PIPER_VOICE", "pt_BR-faber-medium")
KOKORO_LANG = os.environ.get("KOKORO_LANG", "p")  # 'p' = português (br) no Kokoro
DEFAULT_VOICE = os.environ.get("ZAEON_TTS_DEFAULT", "nova-f")  # premium por padrão (nunca cair na voz do navegador por falta de escolha)
# Velocidade do Kokoro: < 1.0 deixa a fala mais lenta/suave (textura mais agradável).
try:
    KOKORO_SPEED = float(os.environ.get("ZAEON_TTS_SPEED", "0.92"))
except ValueError:
    KOKORO_SPEED = 0.92

# Catálogo lógico de vozes exposto ao app. tier: 'free' | 'premium'.
# 'engine' decide quem sintetiza; 'ref' é a voz nativa daquele engine.
VOICES: list[dict] = [
    {"id": "aura-f", "label": "Aura (feminina)", "gender": "f", "lang": "pt-BR", "tier": "free", "engine": "kokoro", "ref": "pf_dora"},
    {"id": "aura-m", "label": "Áureo (masculina)", "gender": "m", "lang": "pt-BR", "tier": "free", "engine": "kokoro", "ref": "pm_alex"},
    {"id": "nova-f", "label": "Nova (feminina, premium)", "gender": "f", "lang": "pt-BR", "tier": "premium", "engine": "kokoro", "ref": "pf_dora"},
    {"id": "piper-f", "label": "Piper (fallback)", "gender": "f", "lang": "pt-BR", "tier": "free", "engine": "piper", "ref": PIPER_DEFAULT},
]


def list_voices() -> list[dict]:
    """Catálogo público (sem expor refs internas)."""
    return [
        {"id": v["id"], "label": v["label"], "gender": v["gender"], "lang": v["lang"], "tier": v["tier"]}
        for v in VOICES
    ]


def _voice_entry(voice_id: str | None) -> dict:
    vid = voice_id or DEFAULT_VOICE
    for v in VOICES:
        if v["id"] == vid:
            return v
    for v in VOICES:  # voz desconhecida → cai na padrão
        if v["id"] == DEFAULT_VOICE:
            return v
    return VOICES[0]


# ── KOKORO ────────────────────────────────────────────────────────────────────
@lru_cache(maxsize=2)
def _kokoro_pipeline():
    """Carrega (e cacheia) o pipeline do Kokoro. Import pesado e lazy."""
    from kokoro import KPipeline  # type: ignore

    return KPipeline(lang_code=KOKORO_LANG)


def _synthesize_kokoro(text: str, ref: str) -> bytes:
    """Sintetiza com Kokoro e devolve WAV (24kHz, mono, 16-bit)."""
    import numpy as np  # type: ignore

    pipeline = _kokoro_pipeline()
    chunks: list = []
    for _, _, audio in pipeline(text, voice=ref, speed=KOKORO_SPEED):
        # Kokoro devolve tensores do PyTorch — converte p/ numpy float32.
        arr = audio.detach().cpu().numpy() if hasattr(audio, "detach") else np.asarray(audio)
        chunks.append(arr.astype("float32").reshape(-1))
    if not chunks:
        raise RuntimeError("Kokoro não gerou áudio.")
    audio = np.concatenate(chunks) if len(chunks) > 1 else chunks[0]
    pcm16 = (np.clip(audio, -1.0, 1.0) * 32767.0).astype("<i2").tobytes()
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(24000)
        wav.writeframes(pcm16)
    return buf.getvalue()


# ── PIPER (fallback) ───────────────────────────────────────────────────────────
@lru_cache(maxsize=4)
def _load_piper(voice_id: str):
    from piper.voice import PiperVoice  # import pesado e lazy

    onnx = os.path.join(PIPER_VOICE_DIR, f"{voice_id}.onnx")
    if not os.path.exists(onnx):
        raise FileNotFoundError(
            f"Modelo Piper não encontrado: {onnx}. Baixe uma voz Piper PT-BR."
        )
    return PiperVoice.load(onnx)


def _synthesize_piper(text: str, ref: str) -> bytes:
    voice = _load_piper(ref)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        voice.synthesize_wav(text, wav)
    return buf.getvalue()


# ── API do módulo ───────────────────────────────────────────────────────────────
def synthesize_wav(text: str, voice_id: str | None = None) -> tuple[bytes, str]:
    """Sintetiza `text`. Usa o engine da voz; cai no Piper se o Kokoro falhar.

    Retorna (wav_bytes, voice_id_efetivo).
    """
    entry = _voice_entry(voice_id)
    if entry["engine"] == "kokoro":
        try:
            return _synthesize_kokoro(text, entry["ref"]), entry["id"]
        except Exception as ke:
            # tenta o Piper; se ele também não estiver disponível, mostra o ERRO REAL do Kokoro
            try:
                piper = _voice_entry("piper-f")
                return _synthesize_piper(text, piper["ref"]), piper["id"]
            except Exception as pe:
                raise RuntimeError(f"Kokoro falhou: {ke!r}. Piper indisponível: {pe!r}")
    return _synthesize_piper(text, entry["ref"]), entry["id"]


def synthesize_base64(text: str, voice_id: str | None = None) -> dict:
    """Sintetiza e devolve o WAV em base64 (pronto pro browser tocar)."""
    wav, effective = synthesize_wav(text, voice_id)
    return {
        "audio_base64": base64.b64encode(wav).decode("ascii"),
        "mime": "audio/wav",
        "voice": effective,
    }
