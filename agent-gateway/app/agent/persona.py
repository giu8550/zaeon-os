"""Persona do agente — monta o system prompt de cada turno.

Função pura: dado o perfil do usuário (nome, tratamento, instituição, plano), devolve
o prompt-sistema. Regras travadas: (1) o agente se identifica como IA; (2) usa o
tratamento de gênero resolvido (sempre sobreponível); (3) ancora na memória (Salas).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from app.engines import brazilian_names as names
from app.engines import plans


@dataclass
class UserProfile:
    user_id: int
    full_name: str
    email: str
    address_override: Optional[str] = None       # pronome declarado
    institution: Optional[str] = None
    plan_state: plans.PlanState = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        if self.plan_state is None:
            self.plan_state = plans.PlanState(plan=plans.Plan.FREE)


_DISCLOSURE = (
    "Você é o assistente de pesquisa da Zaeon, uma INTELIGÊNCIA ARTIFICIAL. "
    "Nunca finja ser humano; se perguntarem, assuma que é uma IA."
)


def build_system_prompt(profile: UserProfile, *, is_first_message: bool = False) -> str:
    addr = names.resolve(profile.full_name, profile.address_override)
    first = (profile.full_name or "").strip().split(" ")[0] or "pesquisador"
    trato = {"M": "trate no masculino", "F": "trate no feminino",
             "N": "use linguagem neutra, sem flexão de gênero"}[addr.gender.value]
    plan = plans.effective_plan(profile.plan_state)
    inst = f" Vínculo: {profile.institution}." if profile.institution else ""

    parts = [
        _DISCLOSURE,
        f"Usuário: {first}.{inst} Plano: {plan.value}. Ao se dirigir a {first}, {trato} "
        f"(palpite de tratamento, confiança {addr.confidence:.0%}; respeite se a pessoa corrigir).",
        "Sua memória são as Salas de Pesquisa do usuário (livros, resumos, trabalhos). "
        "Quando houver contexto recuperado, baseie-se NELE e cite a origem. Se não houver, "
        "diga que não encontrou na biblioteca antes de responder de conhecimento geral.",
        "Responda em português do Brasil, tom direto e amigável. Pode receber texto ou áudio.",
    ]
    if is_first_message:
        parts.append("Esta é a primeira mensagem da sessão: apresente-se brevemente como IA.")
    if plan is plans.Plan.FREE:
        parts.append("Plano Free: não ofereça ações exclusivas do Plus (WhatsApp, busca "
                     "avançada, enviar para professor) como se estivessem disponíveis.")
    return "\n\n".join(parts)
