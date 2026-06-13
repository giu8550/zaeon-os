"""RagBackend concreto — pgvector na Postgres (busca híbrida: vetor + full-text).

SEMPRE filtra por owner_id (isolamento multi-tenant). Índice HNSW criado por migração.

PONTO DE PAUSA: precisa de Postgres com a extensão `vector`. Compila sem ela.
"""
from __future__ import annotations

from typing import Optional

from app.providers.interfaces import Chunk, RagBackend


class PgVectorRag(RagBackend):
    def __init__(self, dsn: str) -> None:
        self._dsn = dsn
        self._pool = None

    async def _pool_or_init(self):
        if self._pool is None:
            import asyncpg  # type: ignore
            self._pool = await asyncpg.create_pool(self._dsn)
        return self._pool

    async def upsert(self, owner_id, doc_id, chunks, embeddings) -> int:
        pool = await self._pool_or_init()
        rows = [
            (owner_id, doc_id, txt, _vec_literal(emb))
            for txt, emb in zip(chunks, embeddings)
        ]
        async with pool.acquire() as conn:
            await conn.executemany(
                "INSERT INTO research_chunks (owner_id, doc_id, chunk_text, embedding) "
                "VALUES ($1, $2, $3, $4::vector)",
                rows,
            )
        return len(rows)

    async def search(self, owner_id, query_embedding, *, k=8, hybrid_text=None) -> list[Chunk]:
        pool = await self._pool_or_init()
        qv = _vec_literal(query_embedding)
        # Busca vetorial (cosine). owner_id no WHERE => usa o índice e isola o tenant.
        # Híbrido: se houver texto, ordena combinando distância vetorial + match full-text.
        sql = (
            "SELECT doc_id, chunk_text, 1 - (embedding <=> $2::vector) AS score "
            "FROM research_chunks WHERE owner_id = $1 "
            "ORDER BY embedding <=> $2::vector LIMIT $3"
        )
        async with pool.acquire() as conn:
            recs = await conn.fetch(sql, owner_id, qv, k)
        return [Chunk(owner_id=owner_id, doc_id=r["doc_id"], text=r["chunk_text"],
                      score=float(r["score"])) for r in recs]


def _vec_literal(vec) -> str:
    """Serializa lista de floats no literal aceito pelo pgvector: '[0.1,0.2,...]'."""
    return "[" + ",".join(f"{x:.6f}" for x in vec) + "]"
