"""Moderação pré-resposta — exigida pelo escopo "assistente geral".

Um agente que fala de tudo precisa de um gate antes de responder. Esta engine é a
PRIMEIRA linha (barata, determinística): pega o óbvio e decide se deixa passar,
sinaliza, ou bloqueia. A SEGUNDA linha é o safety filter nativo do Gemini/Vertex,
que roda no LLM (ver plano §11). As duas se somam — esta não substitui aquela.

Pura: entra texto, sai Decisão. Sem I/O.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum


class Verdict(str, Enum):
    ALLOW = "allow"
    FLAG = "flag"      # responde, mas loga p/ revisão
    BLOCK = "block"    # recusa educada + sugere caminho seguro


@dataclass(frozen=True)
class Decision:
    verdict: Verdict
    category: str
    reason: str


# Categorias bloqueadas de saída (1ª linha — heurística de palavra/contexto).
# Mantido enxuto e defensivo de propósito; o Vertex safety pega o resto.
_BLOCK_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("weapons_explosives", re.compile(
        r"\b(fabricar|montar|sintetizar|receita d[eo])\b.{0,40}\b(bomba|explosivo|"
        r"arma de fogo|veneno letal|napalm)\b", re.I)),
    ("self_harm", re.compile(
        r"\b(como)\b.{0,30}\b(me matar|suic[ií]d|me cortar|tirar minha vida)\b", re.I)),
    ("csam", re.compile(r"\b(crian[çc]a|menor|infantil)\b.{0,30}\b(sexual|nud[ez])\b", re.I)),
    ("malware", re.compile(
        r"\b(escrev[ae]|gerar?|c[óo]digo d[eo])\b.{0,30}\b(ransomware|keylogger|"
        r"v[íi]rus|exploit|backdoor)\b", re.I)),
]


def check_output(text: str) -> Decision:
    """Roda na RESPOSTA candidata do agente antes de enviar."""
    t = text or ""
    for cat, pat in _BLOCK_PATTERNS:
        if pat.search(t):
            return Decision(Verdict.BLOCK, cat, f"padrão bloqueado: {cat}")
    return Decision(Verdict.ALLOW, "none", "ok")


def check_input(text: str) -> Decision:
    """Roda no PEDIDO do usuário. Bloqueio aqui evita gastar token e gerar conteúdo ruim.

    Para angústia emocional (self_harm), não bloqueamos friamente: sinalizamos para o
    orquestrador responder com acolhimento + recursos (não com instruções).
    """
    t = text or ""
    for cat, pat in _BLOCK_PATTERNS:
        if pat.search(t):
            if cat == "self_harm":
                return Decision(Verdict.FLAG, cat, "encaminhar para acolhimento/recursos")
            return Decision(Verdict.BLOCK, cat, f"pedido bloqueado: {cat}")
    return Decision(Verdict.ALLOW, "none", "ok")


SAFE_REFUSAL = (
    "Sobre isso eu não consigo ajudar. Mas se você estiver pesquisando o tema de forma "
    "acadêmica, posso indicar fontes e enquadrar a discussão de um jeito seguro. Quer?"
)
