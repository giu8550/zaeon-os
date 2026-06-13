"""Planos e gate de features.

Free vs Plus. O WhatsApp é exclusivo do Plus — isso dá prioridade a quem está na
faculdade (estudante .edu ganha Plus 30 dias e, com ele, o canal WhatsApp).

Tudo aqui é lógica pura: dado o estado do usuário + agora, decide o que pode.
A persistência (quando expira, qual plano) vive no banco; este módulo só calcula.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Optional


class Plan(str, Enum):
    FREE = "free"
    PLUS = "plus"


class Feature(str, Enum):
    RESEARCH_ROOMS = "research_rooms"        # memória/RAG — ambos
    WEB_SEARCH = "web_search"                # ambos (mas com cota menor no free)
    ACADEMIC_SEARCH = "academic_search"      # ambos
    VOICE_IO = "voice_io"                    # ambos (voz é par do texto)
    WHATSAPP = "whatsapp"                    # SÓ Plus
    ADVANCED_SEARCH = "advanced_search"      # SÓ Plus
    SEND_TO_PROFESSOR = "send_to_professor"  # SÓ Plus (comando via WhatsApp/app)


_PLAN_FEATURES: dict[Plan, frozenset[Feature]] = {
    Plan.FREE: frozenset({
        Feature.RESEARCH_ROOMS, Feature.WEB_SEARCH,
        Feature.ACADEMIC_SEARCH, Feature.VOICE_IO,
    }),
    Plan.PLUS: frozenset(Feature),  # tudo
}

STUDENT_TRIAL_DAYS = 30


@dataclass(frozen=True)
class PlanState:
    plan: Plan
    plus_until: Optional[datetime] = None   # expiração do Plus (trial ou pago)
    trial_granted: bool = False             # já usou o trial de estudante?


def _now(now: Optional[datetime]) -> datetime:
    return now or datetime.now(timezone.utc)


def effective_plan(state: PlanState, now: Optional[datetime] = None) -> Plan:
    """Plano efetivo considerando expiração do Plus."""
    if state.plan is Plan.PLUS and state.plus_until and _now(now) > state.plus_until:
        return Plan.FREE
    return state.plan


def can_use(state: PlanState, feature: Feature, now: Optional[datetime] = None) -> bool:
    return feature in _PLAN_FEATURES[effective_plan(state, now)]


def grant_student_trial(
    state: PlanState, now: Optional[datetime] = None, days: int = STUDENT_TRIAL_DAYS
) -> PlanState:
    """Concede o Plus de estudante. Idempotente: não concede duas vezes.

    Retorna um novo PlanState (imutável). O caller persiste.
    """
    if state.trial_granted:
        return state
    until = _now(now) + timedelta(days=days)
    # se já tem Plus pago com validade maior, não encurta
    if state.plus_until and state.plus_until > until:
        until = state.plus_until
    return PlanState(plan=Plan.PLUS, plus_until=until, trial_granted=True)


def days_left(state: PlanState, now: Optional[datetime] = None) -> Optional[int]:
    if not state.plus_until:
        return None
    delta = state.plus_until - _now(now)
    return max(0, delta.days)
