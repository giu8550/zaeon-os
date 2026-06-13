"""Worker arq — processa um turno por job e envia a resposta pelo canal.

Padrão do zenith-warmer: a task executa UM turno (não faz loop interno). Mostra
'digitando...' (presence), gera com o orquestrador e responde em texto ou áudio.

PONTO DE PAUSA: precisa de Redis, Postgres, Evolution e credencial Vertex.
"""
from __future__ import annotations

from typing import Any

from app.agent.persona import UserProfile
from app.agent.session import AgentDeps, TurnInput, process_turn
from app.core.config import settings


async def _build_deps() -> AgentDeps:
    from app.providers.llm.vertex import VertexLLM
    from app.providers.rag.pgvector import PgVectorRag
    from app.providers.search.vertex_search import VertexSearch
    from app.providers.voice.vertex_voice import VertexVoice
    return AgentDeps(
        llm=VertexLLM(),
        rag=PgVectorRag(settings.DATABASE_URL.replace("+asyncpg", "")),
        search=VertexSearch(),
        voice=VertexVoice(),
    )


async def _load_profile(owner_id: int) -> UserProfile:
    # TODO(pausa): carregar do banco (perfil + plano + override de tratamento)
    raise NotImplementedError


async def task_process_turn(ctx: dict, job: dict[str, Any]) -> None:
    transport = ctx["transport"]
    deps: AgentDeps = ctx["deps"]
    jid = job["jid"]
    instance = job["instance"]

    await transport.send_presence(instance, jid, "composing")

    owner_id = job.get("owner_id") or 0
    profile = await _load_profile(owner_id)
    text = _extract_text(job["raw"])
    audio = _extract_audio(job["raw"])

    out = await process_turn(
        profile, deps,
        TurnInput(text=text, audio=audio, channel="whatsapp",
                  want_voice=bool(audio)),
    )

    if out.audio:
        await transport.send_presence(instance, jid, "recording")
        await transport.send_audio(instance, jid, out.audio)
    else:
        await transport.send_text(instance, jid, out.text)


def _extract_text(raw: dict) -> str | None:
    m = raw.get("message", {})
    return m.get("conversation") or m.get("extendedTextMessage", {}).get("text")


def _extract_audio(raw: dict) -> bytes | None:
    # TODO(pausa): baixar a mídia do Evolution e devolver os bytes
    return None


async def _startup(ctx: dict) -> None:
    # PRIMÁRIO: whatsmeow adapter (ver ADR-001). EvolutionTransport é legado/fallback.
    from app.providers.transport.whatsmeow import WhatsmeowAdapterTransport
    ctx["deps"] = await _build_deps()
    ctx["transport"] = WhatsmeowAdapterTransport()
    # INBOUND (ver ADR-001 Decisão 2): o assistente OUVE consumindo wa:evt/wa:inbound do
    # adapter — NÃO por webhook HTTP. Isso exige o inbound publisher no adapter Go (net-novo).
    # TODO(pausa): subir um consumer de settings.WA_INBOUND_STREAM que enfileira task_process_turn.


class WorkerSettings:
    functions = [task_process_turn]
    on_startup = _startup
    # redis_settings derivado de settings.REDIS_URL no bootstrap real
