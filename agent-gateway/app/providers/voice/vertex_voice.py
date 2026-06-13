"""VoiceProvider concreto.

STT: o Gemini multimodal entende áudio nativamente → na prática o orquestrador pode
mandar o áudio direto pro LLM. Este `stt` existe pro caso de querer transcrição pura.
TTS: Google Cloud Text-to-Speech → MP3, depois transcodificado p/ Ogg/Opus (nota de voz).

PONTO DE PAUSA: precisa de credencial GCP. `to_ogg_opus` precisa de ffmpeg (já no Dockerfile).
"""
from __future__ import annotations

from typing import Optional

from app.core.config import settings
from app.providers.interfaces import VoiceProvider


class VertexVoice(VoiceProvider):
    async def stt(self, audio, *, mime: str = "audio/ogg") -> str:
        from google import genai  # type: ignore
        from google.genai import types  # type: ignore
        client = genai.Client(vertexai=True, project=settings.VERTEX_PROJECT,
                              location=settings.VERTEX_LOCATION)
        resp = await client.aio.models.generate_content(
            model=settings.GEMINI_MODEL_FAST,
            contents=[
                types.Part.from_bytes(data=audio, mime_type=mime),
                "Transcreva este áudio em português, apenas o texto.",
            ],
        )
        return (resp.text or "").strip()

    async def tts(self, text, *, voice: Optional[str] = None) -> bytes:
        # TODO(pausa): Google Cloud TTS → MP3 → app.services.audio.to_ogg_opus (ffmpeg).
        # Mantém o mesmo pipeline de nota de voz do zenith-warmer.
        raise NotImplementedError("TTS requer credencial GCP + ffmpeg (ver Dockerfile)")
