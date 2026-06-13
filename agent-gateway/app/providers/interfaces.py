"""Contratos de provider — o coração do design provider-agnóstico.

A lógica do agente fala SÓ com estas interfaces. Implementações concretas (Vertex,
Evolution, pgvector, Vertex AI Search) plugam por baixo. Isso permite:
- trocar Gemini↔outro LLM,
- trocar Evolution↔WhatsApp Cloud API,
- trocar pgvector↔Vertex Vector Search,
sem tocar no orquestrador. Ver WHATSAPP_AGENT_PLAN.md §7 e §11.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncIterator, Optional


# ─────────────────────────── LLM ───────────────────────────
@dataclass
class LLMMessage:
    role: str          # "system" | "user" | "assistant"
    content: str


class LLMProvider(ABC):
    """Geração. Impl padrão: Gemini no Vertex (Flash/Pro roteado por complexidade)."""

    @abstractmethod
    async def generate(
        self, messages: list[LLMMessage], *, model: Optional[str] = None,
        temperature: float = 0.7, tools: Optional[list[dict]] = None,
        cache_key: Optional[str] = None,   # context caching (10% do input)
    ) -> str: ...

    @abstractmethod
    async def stream(
        self, messages: list[LLMMessage], *, model: Optional[str] = None,
    ) -> AsyncIterator[str]: ...

    @abstractmethod
    async def embed(self, texts: list[str], *, dim: int = 1536) -> list[list[float]]:
        """Embeddings. Vertex: gemini-embedding-001 com output_dimensionality=dim."""
        ...


# ─────────────────────────── RAG ───────────────────────────
@dataclass
class Chunk:
    owner_id: int          # isolamento multi-tenant — SEMPRE filtrar por isto
    doc_id: str
    text: str
    score: float = 0.0
    metadata: dict = field(default_factory=dict)


class RagBackend(ABC):
    """Memória do agente = Salas de Pesquisa. Impl Fase 1: pgvector."""

    @abstractmethod
    async def upsert(self, owner_id: int, doc_id: str, chunks: list[str],
                     embeddings: list[list[float]]) -> int: ...

    @abstractmethod
    async def search(self, owner_id: int, query_embedding: list[float],
                     *, k: int = 8, hybrid_text: Optional[str] = None) -> list[Chunk]:
        """Busca ANN (opcionalmente híbrida com full-text). FILTRA por owner_id."""
        ...


# ───────────────────────── Search ──────────────────────────
@dataclass
class SearchHit:
    title: str
    url: str
    snippet: str
    source: str            # "web" | "academic" | "vertex_search"


class SearchProvider(ABC):
    """Os critérios do produto: internet + avançada + acadêmica.

    Mapeia no crédito GenAI App Builder: web_search=Grounding c/ Google Search,
    academic_search=Vertex AI Search data store (+ engine acadêmica já existente).
    """

    @abstractmethod
    async def web_search(self, query: str, *, k: int = 5) -> list[SearchHit]: ...

    @abstractmethod
    async def academic_search(self, query: str, *, k: int = 5) -> list[SearchHit]: ...


# ───────────────────────── Voice ───────────────────────────
class VoiceProvider(ABC):
    """Voz é par do texto: todo input de texto tem input de voz, e vice-versa."""

    @abstractmethod
    async def stt(self, audio: bytes, *, mime: str = "audio/ogg") -> str:
        """Fala→texto. Com Gemini multimodal, pode ir direto ao LLM (ver plano §11)."""
        ...

    @abstractmethod
    async def tts(self, text: str, *, voice: Optional[str] = None) -> bytes:
        """Texto→fala (bytes de áudio; transcodificar p/ Ogg/Opus no WhatsApp)."""
        ...


# ──────────────────────── Messaging ────────────────────────
@dataclass
class PairResult:
    instance_id: str
    qr_code: Optional[str] = None
    pairing_code: Optional[str] = None


class MessagingTransport(ABC):
    """Canal externo (WhatsApp). Impl Fase 1: Evolution (fork do zenith-warmer);
    Fase 2: WhatsApp Cloud API. Pareamento é SEMPRE consentido pelo dono do número."""

    @abstractmethod
    async def pair(self, owner_id: int, phone: Optional[str] = None) -> PairResult: ...

    @abstractmethod
    async def send_text(self, instance_id: str, jid: str, text: str) -> bool: ...

    @abstractmethod
    async def send_audio(self, instance_id: str, jid: str, audio: bytes) -> bool: ...

    @abstractmethod
    async def send_presence(self, instance_id: str, jid: str,
                            state: str = "composing") -> bool:
        """'composing' = 'digitando...'; 'recording' = 'gravando áudio...'."""
        ...

    @abstractmethod
    async def revoke(self, instance_id: str) -> bool:
        """Kill switch — desconecta e revoga a sessão na hora."""
        ...

    async def set_proxy(self, instance_id: str, proxy_url: str) -> bool:
        """Configura proxy SOCKS5 na instância (geo-BR em escala — ver ADR-001).
        Default: sem suporte a proxy (transportes que não precisam ignoram)."""
        return False
