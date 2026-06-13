"""LLMProvider concreto — Gemini no Vertex (SDK google-genai).

Roteia Flash/Pro, faz embeddings com truncamento Matryoshka (1536) e expõe o tool de
Grounding com Google Search. Context caching por `cache_key`.

PONTO DE PAUSA: precisa de credencial GCP (GOOGLE_APPLICATION_CREDENTIALS) e projeto.
Até lá este módulo COMPILA mas não executa chamadas vivas.
"""
from __future__ import annotations

from typing import AsyncIterator, Optional

from app.core.config import settings
from app.providers.interfaces import LLMMessage, LLMProvider


class VertexLLM(LLMProvider):
    def __init__(self) -> None:
        self._client = None  # lazy — só cria quando houver credencial

    def _client_or_init(self):
        if self._client is None:
            # import tardio p/ não exigir o SDK em ambiente de teste
            from google import genai  # type: ignore
            self._client = genai.Client(
                vertexai=True,
                project=settings.VERTEX_PROJECT,
                location=settings.VERTEX_LOCATION,
            )
        return self._client

    def _pick_model(self, override: Optional[str]) -> str:
        return override or settings.GEMINI_MODEL_FAST

    async def generate(self, messages, *, model=None, temperature=0.7,
                       tools=None, cache_key=None) -> str:
        from google.genai import types  # type: ignore
        client = self._client_or_init()
        system = "\n".join(m.content for m in messages if m.role == "system")
        contents = [m.content for m in messages if m.role != "system"]
        cfg_kwargs: dict = {"temperature": temperature, "system_instruction": system or None}
        if settings.ENABLE_GOOGLE_SEARCH_GROUNDING:
            cfg_kwargs["tools"] = [types.Tool(google_search=types.GoogleSearch())]
        # TODO(pausa): cached_content=cache_key quando context caching estiver provisionado
        resp = await client.aio.models.generate_content(
            model=self._pick_model(model),
            contents=contents,
            config=types.GenerateContentConfig(**cfg_kwargs),
        )
        return resp.text or ""

    async def stream(self, messages, *, model=None) -> AsyncIterator[str]:
        from google.genai import types  # type: ignore
        client = self._client_or_init()
        contents = [m.content for m in messages if m.role != "system"]
        async for ev in await client.aio.models.generate_content_stream(
            model=self._pick_model(model), contents=contents,
            config=types.GenerateContentConfig(),
        ):
            if ev.text:
                yield ev.text

    async def embed(self, texts, *, dim: int = 1536) -> list[list[float]]:
        from google.genai import types  # type: ignore
        client = self._client_or_init()
        out: list[list[float]] = []
        for t in texts:
            r = await client.aio.models.embed_content(
                model=settings.EMBEDDING_MODEL,
                contents=t,
                config=types.EmbedContentConfig(output_dimensionality=dim),
            )
            out.append(list(r.embeddings[0].values))
        return out
