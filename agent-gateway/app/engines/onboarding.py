"""Onboarding — máquina de estados do primeiro contato do agente.

O agente conduz o usuário recém-logado: cumprimenta, confirma como quer ser tratado
(usando o palpite de gênero, sempre sobreponível), checa se o e-mail é acadêmico BR e,
se for, oferece o Plus de 30 dias; por fim conecta as Salas de Pesquisa (memória).

Lógica pura: cada passo recebe o contexto e devolve (próximo estado, mensagem do agente,
efeitos). Os "efeitos" são intenções que o orquestrador executa (conceder trial, abrir
conexão WhatsApp, etc.) — assim a engine não tem dependência de I/O e é testável.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

from app.engines import brazilian_names as names
from app.engines import edu_eligibility as edu
from app.engines import plans


class Step(str, Enum):
    GREET = "greet"
    CONFIRM_ADDRESS = "confirm_address"   # confirma tratamento (gênero/pronome)
    CHECK_EDU = "check_edu"
    OFFER_TRIAL = "offer_trial"
    CONNECT_ROOMS = "connect_rooms"
    DONE = "done"


@dataclass
class OnboardingContext:
    full_name: str
    email: str
    address_override: Optional[str] = None      # pronome declarado, se houver
    accepted_trial: bool = False
    plan_state: plans.PlanState = field(
        default_factory=lambda: plans.PlanState(plan=plans.Plan.FREE)
    )


@dataclass
class StepResult:
    next_step: Step
    message: str
    effects: list[str] = field(default_factory=list)  # ex.: ["grant_trial", "enable_whatsapp"]
    data: dict = field(default_factory=dict)


def _hi(ctx: OnboardingContext) -> names.Address:
    return names.resolve(ctx.full_name, ctx.address_override)


def step(current: Step, ctx: OnboardingContext) -> StepResult:
    """Avança um passo. Determinístico — sem I/O."""
    first = (ctx.full_name or "").strip().split(" ")[0] or "tudo bem"

    if current is Step.GREET:
        addr = _hi(ctx)
        # se o palpite é fraco, o agente já pergunta o tratamento em vez de errar
        if addr.confidence < names.ASSUME_THRESHOLD and not ctx.address_override:
            return StepResult(
                Step.CONFIRM_ADDRESS,
                f"Oi, {first}! Sou o assistente de pesquisa da Zaeon. "
                f"Antes de começar: como você prefere que eu te chame — "
                f"ele, ela ou prefiro neutro?",
            )
        saud = addr.adj("bem-vind")  # bem-vindo/bem-vinda/bem-vinde
        return StepResult(
            Step.CHECK_EDU,
            f"Oi, {first}, {saud} à Zaeon! Sou seu assistente de pesquisa. "
            f"Deixa eu já verificar uma coisa boa pra você...",
            data={"address": addr.gender.value},
        )

    if current is Step.CONFIRM_ADDRESS:
        # chega aqui depois do usuário responder; o override já entrou em ctx
        addr = _hi(ctx)
        saud = addr.adj("bem-vind")
        return StepResult(
            Step.CHECK_EDU,
            f"Combinado! {saud.capitalize()} à Zaeon. Vou checar seu e-mail agora...",
            data={"address": addr.gender.value},
        )

    if current is Step.CHECK_EDU:
        res = edu.check(ctx.email)
        if res.eligible and res.is_brazilian:
            inst = res.institution or "sua instituição"
            return StepResult(
                Step.OFFER_TRIAL,
                f"Identifiquei que você é de **{inst}** 🎓. "
                f"Estudante ganha **Plus grátis por {plans.STUDENT_TRIAL_DAYS} dias** — "
                f"inclui o assistente no **WhatsApp**, busca avançada e mais. Quer ativar?",
                data={"institution": inst, "kind": res.kind.value},
            )
        if res.eligible and not res.is_brazilian:
            return StepResult(
                Step.OFFER_TRIAL,
                "Vi que seu e-mail é acadêmico (internacional). Posso liberar o Plus "
                f"de estudante por {plans.STUDENT_TRIAL_DAYS} dias — quer ativar?",
            )
        return StepResult(
            Step.CONNECT_ROOMS,
            "Vamos montar seu espaço. Você começa no plano Free com as Salas de "
            "Pesquisa, busca acadêmica e voz. Bora conectar seu material?",
        )

    if current is Step.OFFER_TRIAL:
        if ctx.accepted_trial:
            new_state = plans.grant_student_trial(ctx.plan_state)
            effects = ["grant_trial"]
            if plans.can_use(new_state, plans.Feature.WHATSAPP):
                effects.append("enable_whatsapp")
            return StepResult(
                Step.CONNECT_ROOMS,
                f"Plus ativado! 🎉 Você tem {plans.STUDENT_TRIAL_DAYS} dias. "
                f"O WhatsApp já está liberado — depois te mostro como conectar. "
                f"Agora vamos à sua memória de pesquisa.",
                effects=effects,
                data={"plus_days": plans.STUDENT_TRIAL_DAYS},
            )
        return StepResult(
            Step.CONNECT_ROOMS,
            "Sem problema — dá pra ativar depois nas configurações. "
            "Vamos conectar suas Salas de Pesquisa?",
        )

    if current is Step.CONNECT_ROOMS:
        return StepResult(
            Step.DONE,
            "Pronto! Suas Salas viram minha memória: tudo que você guardar — livros, "
            "resumos, trabalhos — eu uso pra te responder. Pode me mandar texto ou áudio. "
            "Por onde quer começar?",
            effects=["index_rooms"],
        )

    return StepResult(Step.DONE, "Estamos prontos. Manda ver! 🚀")
