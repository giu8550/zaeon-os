"""Elegibilidade acadêmica a partir do e-mail — destrava o Plus grátis 30 dias.

Regra de negócio: estudante com e-mail de instituição de ensino brasileira ganha
30 dias de Plus. Precisa reconhecer universidades/faculdades/institutos do Brasil
pelo domínio do e-mail.

Estratégia (em camadas, da mais forte pra mais fraca):
1. Domínio `.edu.br`            → acadêmico BR (alta confiança).
2. Domínio em lista curada      → instituição conhecida, com nome e tipo.
3. Padrões federais/institutos  → `uf**.br`, `if**.br`, `cefet**.br` (heurística).
4. `.edu` (internacional)       → acadêmico, marcado como não-BR (decisão à parte).
5. Caso contrário               → não elegível.

A lista curada é representativa (as maiores), não exaustiva — o `.edu.br` + padrões
pegam a cauda longa. Domínios pessoais (gmail/hotmail/...) caem fora explicitamente.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class InstitutionKind(str, Enum):
    FEDERAL = "federal"
    ESTADUAL = "estadual"
    PRIVADA = "privada"
    INSTITUTO_FEDERAL = "instituto_federal"
    INTERNACIONAL_EDU = "internacional_edu"
    DESCONHECIDA = "desconhecida"


@dataclass(frozen=True)
class EduResult:
    eligible: bool
    is_brazilian: bool
    institution: Optional[str]
    kind: InstitutionKind
    confidence: float
    domain: str


# Provedores pessoais — nunca elegíveis (corta falso-positivo cedo).
_PERSONAL = {
    "gmail.com", "hotmail.com", "outlook.com", "live.com", "yahoo.com", "yahoo.com.br",
    "icloud.com", "proton.me", "protonmail.com", "bol.com.br", "uol.com.br", "terra.com.br",
}

# Lista curada (representativa) domínio -> (nome, tipo). Expandir conforme necessário.
_KNOWN: dict[str, tuple[str, InstitutionKind]] = {
    "usp.br": ("Universidade de São Paulo", InstitutionKind.ESTADUAL),
    "unicamp.br": ("Universidade Estadual de Campinas", InstitutionKind.ESTADUAL),
    "unesp.br": ("Universidade Estadual Paulista", InstitutionKind.ESTADUAL),
    "ufrj.br": ("Universidade Federal do Rio de Janeiro", InstitutionKind.FEDERAL),
    "ufmg.br": ("Universidade Federal de Minas Gerais", InstitutionKind.FEDERAL),
    "ufrgs.br": ("Universidade Federal do Rio Grande do Sul", InstitutionKind.FEDERAL),
    "ufsc.br": ("Universidade Federal de Santa Catarina", InstitutionKind.FEDERAL),
    "ufpr.br": ("Universidade Federal do Paraná", InstitutionKind.FEDERAL),
    "ufba.br": ("Universidade Federal da Bahia", InstitutionKind.FEDERAL),
    "ufpe.br": ("Universidade Federal de Pernambuco", InstitutionKind.FEDERAL),
    "ufc.br": ("Universidade Federal do Ceará", InstitutionKind.FEDERAL),
    "unb.br": ("Universidade de Brasília", InstitutionKind.FEDERAL),
    "ufscar.br": ("Universidade Federal de São Carlos", InstitutionKind.FEDERAL),
    "uff.br": ("Universidade Federal Fluminense", InstitutionKind.FEDERAL),
    "puc-rio.br": ("PUC-Rio", InstitutionKind.PRIVADA),
    "pucsp.br": ("PUC-SP", InstitutionKind.PRIVADA),
    "pucrs.br": ("PUC-RS", InstitutionKind.PRIVADA),
    "pucminas.br": ("PUC Minas", InstitutionKind.PRIVADA),
    "mackenzie.br": ("Universidade Presbiteriana Mackenzie", InstitutionKind.PRIVADA),
    "fgv.br": ("Fundação Getulio Vargas", InstitutionKind.PRIVADA),
    "insper.edu.br": ("Insper", InstitutionKind.PRIVADA),
    "estacio.br": ("Universidade Estácio de Sá", InstitutionKind.PRIVADA),
    "anhembi.br": ("Anhembi Morumbi", InstitutionKind.PRIVADA),
}

# Padrões heurísticos para a cauda longa (federais, estaduais, institutos).
_PATTERNS: list[tuple[re.Pattern[str], InstitutionKind, float]] = [
    (re.compile(r"^if[a-z]{1,3}\.edu\.br$"), InstitutionKind.INSTITUTO_FEDERAL, 0.9),
    (re.compile(r"^if[a-z]{1,3}\.br$"), InstitutionKind.INSTITUTO_FEDERAL, 0.85),
    (re.compile(r"^cefet[a-z-]*\.br$"), InstitutionKind.INSTITUTO_FEDERAL, 0.85),
    (re.compile(r"^uf[a-z]{1,4}\.br$"), InstitutionKind.FEDERAL, 0.85),
    (re.compile(r"^u[a-z]{2,4}\.br$"), InstitutionKind.ESTADUAL, 0.6),
    (re.compile(r"^fac[a-z-]*\.(edu\.)?br$"), InstitutionKind.PRIVADA, 0.6),
]


def _domain(email: str) -> str:
    email = (email or "").strip().lower()
    if "@" not in email:
        return ""
    return email.rsplit("@", 1)[1].strip()


def check(email: str) -> EduResult:
    d = _domain(email)
    if not d or d in _PERSONAL:
        return EduResult(False, False, None, InstitutionKind.DESCONHECIDA, 0.0, d)

    # 2. lista curada (match exato ou subdomínio, ex.: aluno.usp.br)
    for known, (name, kind) in _KNOWN.items():
        if d == known or d.endswith("." + known):
            return EduResult(True, True, name, kind, 0.98, d)

    # 1. .edu.br genérico
    if d.endswith(".edu.br") or d == "edu.br":
        return EduResult(True, True, None, InstitutionKind.PRIVADA, 0.9, d)

    # 3. padrões federais/institutos
    for pat, kind, conf in _PATTERNS:
        if pat.match(d):
            return EduResult(True, True, None, kind, conf, d)

    # qualquer .br acadêmico-aparente com 'edu'
    if ".edu." in d and d.endswith(".br"):
        return EduResult(True, True, None, InstitutionKind.PRIVADA, 0.8, d)

    # 4. .edu internacional
    if d.endswith(".edu"):
        return EduResult(True, False, None, InstitutionKind.INTERNACIONAL_EDU, 0.7, d)

    return EduResult(False, False, None, InstitutionKind.DESCONHECIDA, 0.0, d)
