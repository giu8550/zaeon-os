-- Migração base do agent-gateway: extensão pgvector + memória RAG + tabelas do agente.
-- Embedding 1536 (gemini-embedding-001 truncado via output_dimensionality) → cabe no HNSW.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS research_chunks (
  id          bigserial PRIMARY KEY,
  owner_id    integer NOT NULL,
  doc_id      text NOT NULL,
  chunk_text  text NOT NULL,
  embedding   vector(1536) NOT NULL,
  tsv         tsvector,
  created_at  timestamptz DEFAULT now()
);

-- ANN por cosseno (HNSW). Filtro por owner_id antes do ANN = isolamento multi-tenant.
CREATE INDEX IF NOT EXISTS ix_chunks_embedding
  ON research_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS ix_chunks_tsv ON research_chunks USING gin (tsv);
CREATE INDEX IF NOT EXISTS ix_chunks_owner ON research_chunks (owner_id);

CREATE TABLE IF NOT EXISTS agent_instances (
  id              serial PRIMARY KEY,
  owner_id        integer NOT NULL,
  evo_instance_id text,
  evo_token       text,
  remote_jid      text,
  status          text DEFAULT 'idle',
  voice_enabled   boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  last_active_at  timestamptz
);
CREATE INDEX IF NOT EXISTS ix_agent_owner ON agent_instances (owner_id);

CREATE TABLE IF NOT EXISTS conversation_logs (
  id              bigserial PRIMARY KEY,
  owner_id        integer NOT NULL,
  direction       text NOT NULL,
  kind            text NOT NULL,
  content_preview text,
  tokens          integer DEFAULT 0,
  latency_ms      integer DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_convlog_owner_created ON conversation_logs (owner_id, created_at);
