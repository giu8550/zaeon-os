-- Roda SÓ no 1º boot do volume pgvector_data (docker-entrypoint-initdb.d).
-- RAG: extensão de vetores na DB principal (zaeon_rag).
CREATE EXTENSION IF NOT EXISTS vector;
-- LiteLLM: DB própria pras tabelas do prisma (virtual keys, spend), fora do RAG.
CREATE DATABASE litellm;
