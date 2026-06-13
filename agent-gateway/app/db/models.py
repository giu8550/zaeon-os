"""Modelos de dados do agent-gateway (SQLAlchemy + pgvector).

`research_chunks` é a memória (RAG) — isolada por owner_id. As demais tabelas guardam
a instância de WhatsApp por usuário e o log de conversa (para métricas e auditoria).
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import (
    BigInteger, Boolean, Column, DateTime, Enum, ForeignKey, Index, Integer,
    String, Text,
)
from sqlalchemy.orm import DeclarativeBase

try:
    # extensão pgvector — só disponível com o pacote instalado + extensão no banco
    from pgvector.sqlalchemy import Vector
except Exception:  # pragma: no cover - ambiente sem pgvector
    Vector = lambda dim: Text  # type: ignore[assignment]  # fallback p/ compilar


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class AgentInstanceStatus(str, PyEnum):
    IDLE = "idle"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    PAUSED = "paused"
    REVOKED = "revoked"


class AgentInstance(Base):
    """Instância de WhatsApp de UM usuário (espelha WarmerInstance do zenith-warmer)."""
    __tablename__ = "agent_instances"

    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, nullable=False, index=True)       # FK users (app Zaeon)
    evo_instance_id = Column(String, nullable=True, index=True)  # UUID do Evolution
    evo_token = Column(String, nullable=True)                    # auth por instância
    remote_jid = Column(String, nullable=True)
    status = Column(Enum(AgentInstanceStatus), default=AgentInstanceStatus.IDLE)
    voice_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_utcnow)
    last_active_at = Column(DateTime, nullable=True)


class ConversationLog(Base):
    __tablename__ = "conversation_logs"

    id = Column(BigInteger, primary_key=True)
    owner_id = Column(Integer, nullable=False)
    direction = Column(String, nullable=False)   # "in" | "out"
    kind = Column(String, nullable=False)        # "text" | "audio" | "media"
    content_preview = Column(Text, nullable=True)
    tokens = Column(Integer, default=0)
    latency_ms = Column(Integer, default=0)
    created_at = Column(DateTime, default=_utcnow)

    __table_args__ = (
        Index("ix_convlog_owner_created", "owner_id", "created_at"),
    )


class ResearchChunk(Base):
    """Memória do agente: pedaços da biblioteca de pesquisa, vetorizados.

    embedding = gemini-embedding-001 truncado p/ 1536 (cabe no índice HNSW do pgvector).
    O índice HNSW + GIN(tsv) é criado via migração SQL (ver alembic), não aqui.
    """
    __tablename__ = "research_chunks"

    id = Column(BigInteger, primary_key=True)
    owner_id = Column(Integer, nullable=False, index=True)   # isolamento multi-tenant
    doc_id = Column(String, nullable=False)
    chunk_text = Column(Text, nullable=False)
    embedding = Column(Vector(1536), nullable=False)         # type: ignore[arg-type]
    created_at = Column(DateTime, default=_utcnow)
