"""Orquestrador de turno — o coração do agente.

Recebe um input (texto OU áudio), de qualquer canal (app/WhatsApp), e produz a resposta.
Tudo por injeção de dependência (`AgentDeps`) → testável com providers fake, sem serviço.

Pipeline de um turno:
  STT (se áudio) → moderação de entrada → comando? → gate de plano → RAG (memória)
  → busca opcional → monta prompt (persona + contexto) → LLM → moderação de saída → resposta
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from app.agent.persona import UserProfile, build_system_prompt
from app.engines import commands, moderation, plans
from app.providers.interfaces import (
    LLMMessage, LLMProvider, RagBackend, SearchHit, SearchProvider, VoiceProvider,
)


@dataclass
class AgentDeps:
    llm: LLMProvider
    rag: RagBackend
    search: SearchProvider
    voice: VoiceProvider


@dataclass
class TurnInput:
    text: Optional[str] = None
    audio: Optional[bytes] = None
    audio_mime: str = "audio/ogg"
    channel: str = "app"            # "app" | "whatsapp"
    want_voice: bool = False        # responder em áudio?
    is_first_message: bool = False


@dataclass
class TurnOutput:
    text: str
    intent: str
    audio: Optional[bytes] = None
    blocked: bool = False
    used_context: int = 0
    effects: list[str] = field(default_factory=list)


_UPSELL_WHATSAPP = ("O canal WhatsApp é do plano Plus. Quer ativar? Estudante com e-mail "
                    "acadêmico ganha 30 dias grátis.")
_UPSELL_PROFESSOR = ("Enviar direto para o professor é um recurso Plus. Posso preparar o "
                     "rascunho aqui e você manda, ou ative o Plus pra eu enviar por você.")
_SUPPORT = ("Sinto que isso pode estar pesado pra você. Não estou aqui pra te julgar — e, se "
            "quiser, posso te ajudar a encontrar apoio agora. Você não está sozinho nisso.")


def _render_context(chunks, hits: list[SearchHit]) -> str:
    blocks = []
    if chunks:
        mem = "\n".join(f"- ({c.doc_id}) {c.text}" for c in chunks)
        blocks.append("Contexto da biblioteca do usuário:\n" + mem)
    if hits:
        web = "\n".join(f"- {h.title}: {h.snippet} [{h.url}]" for h in hits)
        blocks.append("Resultados de busca:\n" + web)
    return "\n\n".join(blocks)


async def process_turn(profile: UserProfile, deps: AgentDeps, inp: TurnInput) -> TurnOutput:
    # 1. resolve o texto (STT se veio áudio)
    user_text = inp.text
    if user_text is None and inp.audio is not None:
        user_text = await deps.voice.stt(inp.audio, mime=inp.audio_mime)
    user_text = (user_text or "").strip()
    if not user_text:
        return TurnOutput("Não entendi — pode repetir?", intent="empty")

    # 2. moderação de entrada
    mod_in = moderation.check_input(user_text)
    if mod_in.verdict is moderation.Verdict.BLOCK:
        return TurnOutput(moderation.SAFE_REFUSAL, intent="blocked", blocked=True)
    if mod_in.verdict is moderation.Verdict.FLAG and mod_in.category == "self_harm":
        return TurnOutput(_SUPPORT, intent="support")

    # 3. comando?
    cmd = commands.parse(user_text)

    # 4. gates de plano
    if inp.channel == "whatsapp" and not plans.can_use(profile.plan_state, plans.Feature.WHATSAPP):
        return TurnOutput(_UPSELL_WHATSAPP, intent="gated")
    if cmd.intent is commands.Intent.SEND_TO_PROFESSOR and not plans.can_use(
        profile.plan_state, plans.Feature.SEND_TO_PROFESSOR
    ):
        return TurnOutput(_UPSELL_PROFESSOR, intent=cmd.intent.value)

    # 5. RAG — a memória são as Salas de Pesquisa (sempre filtra por owner)
    q_emb = (await deps.llm.embed([user_text]))[0]
    chunks = await deps.rag.search(profile.user_id, q_emb, k=8, hybrid_text=user_text)

    # 6. busca externa por intenção
    hits: list[SearchHit] = []
    if cmd.intent is commands.Intent.WEB_SEARCH:
        hits = await deps.search.web_search(cmd.text)
    elif cmd.intent is commands.Intent.ACADEMIC_SEARCH:
        hits = await deps.search.academic_search(cmd.text)

    # 7. monta prompt
    system = build_system_prompt(profile, is_first_message=inp.is_first_message)
    ctx = _render_context(chunks, hits)
    user_block = (ctx + "\n\n" if ctx else "") + user_text
    messages = [LLMMessage("system", system), LLMMessage("user", user_block)]

    # 8. gera (context caching por usuário)
    answer = await deps.llm.generate(messages, cache_key=f"user:{profile.user_id}")

    # 9. moderação de saída
    if moderation.check_output(answer).verdict is moderation.Verdict.BLOCK:
        answer = moderation.SAFE_REFUSAL

    # 10. voz de saída se pedido (par do texto)
    audio = None
    if inp.want_voice:
        audio = await deps.voice.tts(answer)

    effects = []
    if cmd.intent is commands.Intent.SEND_TO_PROFESSOR:
        effects.append("send_to_professor")
    return TurnOutput(answer, intent=cmd.intent.value, audio=audio,
                      used_context=len(chunks), effects=effects)
