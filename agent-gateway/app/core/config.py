"""Settings do agent-gateway (Pydantic). Nunca ler env direto — sempre via `settings`.

Obrigatórios em runtime: SECRET_KEY, DATABASE_URL. Vertex/Evolution são opcionais
até o deploy (pontos de pausa: credencial GCP + instância Evolution na VPS).
"""
from __future__ import annotations

from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # núcleo
    SECRET_KEY: str = "dev-placeholder-change-me-min-16"
    DATABASE_URL: str = "postgresql+asyncpg://zaeon:zaeon@localhost/zaeon_agent"
    REDIS_URL: str = "redis://localhost:6379/0"

    # Vertex / Gemini (ponto de pausa: GOOGLE_APPLICATION_CREDENTIALS no deploy)
    VERTEX_PROJECT: Optional[str] = None
    VERTEX_LOCATION: str = "us-central1"
    GEMINI_MODEL_FAST: str = "gemini-2.5-flash"
    GEMINI_MODEL_PRO: str = "gemini-2.5-pro"
    EMBEDDING_MODEL: str = "gemini-embedding-001"
    EMBEDDING_DIM: int = 1536  # Matryoshka → cabe no índice HNSW do pgvector (<=2000)

    # Vertex AI Search / Agent Builder (onde o crédito GenAI App Builder se aplica)
    VERTEX_SEARCH_DATASTORE: Optional[str] = None
    ENABLE_GOOGLE_SEARCH_GROUNDING: bool = True

    # WhatsApp transport — PRIMÁRIO: whatsmeow adapter (ver ADR-001).
    WHATSMEOW_ADAPTER_URL: Optional[str] = None   # operator HTTP (lifecycle), :9091
    BRIDGE_REDIS_URL: str = "redis://localhost:6380/0"  # barramento wa:cmd / wa:evt
    BRIDGE_N_SHARDS: int = 1                       # = NUM_SHARDS de TODA a frota de adapters
    WA_INBOUND_STREAM: str = "wa:evt"              # de onde o worker consome inbound

    # proxy (só em escala — ver ADR-001 Decisão 3). Reusa o proxy_service do warmer.
    PROXY_ENABLED: bool = False
    PROXY_REGION: str = "BR"

    # API interna do app Zaeon (Next.js) — perfil/plano do usuário p/ o agente
    ZAEON_INTERNAL_URL: Optional[str] = None
    ZAEON_INTERNAL_TOKEN: Optional[str] = None

    # Evolution evogo — LEGADO/fallback (deprecado; ver ADR-001 Decisão 1)
    EVO_URL: Optional[str] = None
    EVO_API_KEY: Optional[str] = None

    # planos
    STUDENT_TRIAL_DAYS: int = 30

    # custo/escala
    OPENAI_RATE_PER_MINUTE: int = 60  # se usar fallback OpenAI; Vertex tem quota própria
    CONTEXT_CACHE_ENABLED: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
