"""Providers fake — implementam as interfaces com saídas canônicas.

Servem aos testes de unidade do orquestrador (sem GCP/Postgres/Evolution) e como
referência viva do contrato. NÃO usar em produção.
"""
from __future__ import annotations

from typing import AsyncIterator, Optional

from app.providers.interfaces import (
    Chunk, LLMMessage, LLMProvider, MessagingTransport, PairResult, RagBackend,
    SearchHit, SearchProvider, VoiceProvider,
)


class FakeLLM(LLMProvider):
    def __init__(self, reply: str = "resposta de teste") -> None:
        self.reply = reply
        self.last_messages: list[LLMMessage] = []

    async def generate(self, messages, *, model=None, temperature=0.7,
                       tools=None, cache_key=None) -> str:
        self.last_messages = messages
        return self.reply

    async def stream(self, messages, *, model=None) -> AsyncIterator[str]:
        for tok in self.reply.split():
            yield tok + " "

    async def embed(self, texts, *, dim: int = 1536) -> list[list[float]]:
        return [[0.1] * dim for _ in texts]


class FakeRag(RagBackend):
    def __init__(self, chunks: Optional[list[Chunk]] = None) -> None:
        self.chunks = chunks or []

    async def upsert(self, owner_id, doc_id, chunks, embeddings) -> int:
        return len(chunks)

    async def search(self, owner_id, query_embedding, *, k=8, hybrid_text=None) -> list[Chunk]:
        # respeita o isolamento por owner
        return [c for c in self.chunks if c.owner_id == owner_id][:k]


class FakeSearch(SearchProvider):
    def __init__(self, hits: Optional[list[SearchHit]] = None) -> None:
        self.hits = hits or [SearchHit("Resultado", "https://x", "trecho", "web")]

    async def web_search(self, query, *, k=5) -> list[SearchHit]:
        return self.hits[:k]

    async def academic_search(self, query, *, k=5) -> list[SearchHit]:
        return self.hits[:k]


class FakeVoice(VoiceProvider):
    def __init__(self, transcript: str = "oi, tudo bem?") -> None:
        self.transcript = transcript

    async def stt(self, audio, *, mime="audio/ogg") -> str:
        return self.transcript

    async def tts(self, text, *, voice=None) -> bytes:
        return b"FAKE_AUDIO_OGG"


class FakeTransport(MessagingTransport):
    def __init__(self) -> None:
        self.sent: list[tuple[str, str]] = []

    async def pair(self, owner_id, phone=None) -> PairResult:
        return PairResult(instance_id=f"inst-{owner_id}", qr_code="QR")

    async def send_text(self, instance_id, jid, text) -> bool:
        self.sent.append((jid, text))
        return True

    async def send_audio(self, instance_id, jid, audio) -> bool:
        return True

    async def send_presence(self, instance_id, jid, state="composing") -> bool:
        return True

    async def revoke(self, instance_id) -> bool:
        return True
