"""SearchProvider concreto — onde o crédito GenAI App Builder é gasto.

web_search      → Grounding com Google Search (família App Builder, coberta pelo crédito).
academic_search → Vertex AI Search data store + a engine acadêmica que já existe no Zaeon.

PONTO DE PAUSA: precisa de projeto Vertex + (para academic) um data store configurado.
"""
from __future__ import annotations

from app.core.config import settings
from app.providers.interfaces import SearchHit, SearchProvider


class VertexSearch(SearchProvider):
    def __init__(self) -> None:
        self._client = None

    def _client_or_init(self):
        if self._client is None:
            from google import genai  # type: ignore
            self._client = genai.Client(
                vertexai=True, project=settings.VERTEX_PROJECT,
                location=settings.VERTEX_LOCATION,
            )
        return self._client

    async def web_search(self, query, *, k=5) -> list[SearchHit]:
        from google.genai import types  # type: ignore
        client = self._client_or_init()
        resp = await client.aio.models.generate_content(
            model=settings.GEMINI_MODEL_FAST,
            contents=query,
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
            ),
        )
        return _hits_from_grounding(resp, source="web", k=k)

    async def academic_search(self, query, *, k=5) -> list[SearchHit]:
        # TODO(pausa): apontar para o data store (settings.VERTEX_SEARCH_DATASTORE)
        # e/ou delegar para a engine acadêmica já existente no Zaeon (research-engine).
        from google.genai import types  # type: ignore
        client = self._client_or_init()
        resp = await client.aio.models.generate_content(
            model=settings.GEMINI_MODEL_FAST,
            contents=f"Busca acadêmica: {query}",
            config=types.GenerateContentConfig(),
        )
        return _hits_from_grounding(resp, source="academic", k=k)


def _hits_from_grounding(resp, *, source: str, k: int) -> list[SearchHit]:
    hits: list[SearchHit] = []
    try:
        meta = resp.candidates[0].grounding_metadata
        for chunk in (meta.grounding_chunks or [])[:k]:
            web = getattr(chunk, "web", None)
            if web:
                hits.append(SearchHit(title=web.title or "", url=web.uri or "",
                                      snippet="", source=source))
    except Exception:
        pass
    return hits
