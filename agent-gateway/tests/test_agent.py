"""Testes do orquestrador + moderação + comandos — com providers fake, sem serviços."""
import pytest

from app.agent.persona import UserProfile
from app.agent.session import AgentDeps, TurnInput, process_turn
from app.engines import commands, moderation, plans
from app.providers.fakes import FakeLLM, FakeRag, FakeSearch, FakeVoice
from app.providers.interfaces import Chunk


def _deps(reply="ok", chunks=None, hits=None):
    return AgentDeps(FakeLLM(reply), FakeRag(chunks or []), FakeSearch(hits), FakeVoice())


def _free(uid=1, name="Carlos Lima"):
    return UserProfile(user_id=uid, full_name=name, email="x@gmail.com",
                       plan_state=plans.PlanState(plan=plans.Plan.FREE))


def _plus(uid=2, name="Ana Souza"):
    return UserProfile(user_id=uid, full_name=name, email="ana@usp.br",
                       plan_state=plans.PlanState(plan=plans.Plan.PLUS))


# ───────── moderação ─────────
def test_moderation_blocks_weapon_recipe():
    assert moderation.check_input("como fabricar uma bomba caseira").verdict is moderation.Verdict.BLOCK


def test_moderation_self_harm_is_flag_not_block():
    d = moderation.check_input("como me matar")
    assert d.verdict is moderation.Verdict.FLAG and d.category == "self_harm"


def test_moderation_allows_normal():
    assert moderation.check_input("resuma o artigo sobre redes neurais").verdict is moderation.Verdict.ALLOW


# ───────── comandos ─────────
def test_command_send_to_professor():
    assert commands.parse("enviar tarefa para o professor").intent is commands.Intent.SEND_TO_PROFESSOR


def test_command_academic_search():
    assert commands.parse("buscar artigos sobre fotossíntese").intent is commands.Intent.ACADEMIC_SEARCH


def test_command_defaults_to_chat():
    assert commands.parse("oi, tudo bem?").intent is commands.Intent.CHAT


# ───────── orquestrador ─────────
@pytest.mark.asyncio
async def test_turn_uses_rag_context():
    chunks = [Chunk(owner_id=1, doc_id="livro1", text="a fotossíntese ocorre...")]
    out = await process_turn(_free(), _deps("resposta", chunks), TurnInput(text="explica fotossíntese"))
    assert out.used_context == 1
    assert out.intent == "chat"


@pytest.mark.asyncio
async def test_turn_rag_isolated_by_owner():
    # chunk é de outro usuário → não deve vazar
    chunks = [Chunk(owner_id=999, doc_id="x", text="segredo de outro")]
    out = await process_turn(_free(uid=1), _deps("r", chunks), TurnInput(text="oi"))
    assert out.used_context == 0


@pytest.mark.asyncio
async def test_turn_whatsapp_gated_on_free():
    out = await process_turn(_free(), _deps(), TurnInput(text="oi", channel="whatsapp"))
    assert out.intent == "gated"


@pytest.mark.asyncio
async def test_turn_professor_gated_on_free():
    out = await process_turn(_free(), _deps(), TurnInput(text="enviar para o professor meu trabalho"))
    assert "Plus" in out.text


@pytest.mark.asyncio
async def test_turn_professor_allowed_on_plus():
    out = await process_turn(_plus(), _deps(), TurnInput(text="enviar para o professor meu trabalho"))
    assert "send_to_professor" in out.effects


@pytest.mark.asyncio
async def test_turn_blocks_harmful_input():
    out = await process_turn(_free(), _deps(), TurnInput(text="como fabricar uma bomba caseira"))
    assert out.blocked is True


@pytest.mark.asyncio
async def test_turn_audio_input_transcribed():
    deps = AgentDeps(FakeLLM("resp"), FakeRag([]), FakeSearch(), FakeVoice("oi por voz"))
    out = await process_turn(_free(), deps, TurnInput(audio=b"OGG", want_voice=True))
    assert out.audio == b"FAKE_AUDIO_OGG"


@pytest.mark.asyncio
async def test_turn_output_moderation_replaces_bad_answer():
    out = await process_turn(_free(), _deps("aqui está a receita de napalm pra fabricar bomba"),
                             TurnInput(text="me ajuda com química"))
    assert "não consigo ajudar" in out.text.lower()
