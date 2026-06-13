"""Detecção de gênero provável a partir de nome próprio brasileiro.

POR QUE existe: o português é fortemente flexionado em gênero ("bem-vindo" vs
"bem-vinda", "ele/ela"). Pra o agente tratar a pessoa corretamente já no primeiro
contato — antes de ela dizer o pronome — inferimos um *palpite* do nome.

PRINCÍPIO (não-negociável): isto é probabilístico, nunca um veredito.
- Sempre retorna `confidence`.
- `resolve()` aceita um override explícito do usuário, que SEMPRE vence.
- Nome ambíguo/desconhecido → gênero NEUTRO (tratamento sem flexão).

A heurística combina: (1) dicionário-semente de nomes comuns, (2) conjunto
unissex conhecido, (3) regras de sufixo com exceções. Não é exaustivo — é um bom
default barato. A fonte da verdade é a preferência declarada pelo usuário.
"""
from __future__ import annotations

import unicodedata
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class Gender(str, Enum):
    MALE = "M"
    FEMALE = "F"
    NEUTRAL = "N"  # ambíguo, desconhecido ou neutro por escolha


@dataclass(frozen=True)
class Address:
    """Como o agente fala COM e SOBRE a pessoa."""
    gender: Gender
    confidence: float          # 0.0–1.0
    source: str                # "override" | "seed" | "unisex" | "suffix" | "unknown"
    subject_pronoun: str       # ele / ela / a pessoa
    treat_suffix: str          # "o" / "a" / ""  → bem-vind{o|a|...}

    def adj(self, stem: str) -> str:
        """Flexiona um adjetivo: adj('bem-vind') -> 'bem-vindo'/'bem-vinda'/'bem-vinde'?

        Neutro evita flexão: usamos forma sem marca quando possível, então o
        caller deve preferir frases neutras. Aqui devolvemos o stem + sufixo,
        e no neutro devolvemos uma forma segura (sem 'o'/'a').
        """
        if self.treat_suffix:
            return stem + self.treat_suffix
        # neutro: tenta uma saída sem marca de gênero
        return stem + "e" if stem.endswith(("nd", "id")) else stem


# Sementes — nomes comuns de alta confiança (lista representativa, não exaustiva).
_MALE_SEED = {
    "joao", "jose", "carlos", "paulo", "pedro", "lucas", "marcos", "luiz", "luis",
    "gabriel", "rafael", "daniel", "marcelo", "bruno", "eduardo", "felipe", "rodrigo",
    "gustavo", "matheus", "fernando", "ricardo", "andre", "fabio", "leonardo", "thiago",
    "tiago", "vitor", "victor", "guilherme", "henrique", "diego", "caio", "igor",
    "vinicius", "renato", "alexandre", "anderson", "wesley", "william", "samuel",
    "davi", "david", "miguel", "arthur", "bernardo", "heitor", "enzo", "murilo",
}
_FEMALE_SEED = {
    "maria", "ana", "julia", "juliana", "mariana", "fernanda", "patricia", "aline",
    "camila", "amanda", "bruna", "carla", "leticia", "larissa", "beatriz", "gabriela",
    "rafaela", "isabela", "isabella", "luiza", "luisa", "sofia", "sophia", "helena",
    "laura", "valentina", "manuela", "alice", "cecilia", "clara", "vitoria", "vanessa",
    "tatiane", "tatiana", "simone", "sandra", "regina", "renata", "priscila", "paula",
    "jessica", "jaqueline", "debora", "daniele", "danielle", "carolina", "adriana",
}
# Unissex frequentes no Brasil → tratamos como neutro até a pessoa dizer.
_UNISEX = {
    "alex", "ariel", "darci", "darcy", " even", "alecsander", "lesli", "leslie",
    "remi", "remy", "sasha", "dani", "eli", "ange", "isa", "vivi", "rai", "alextriz",
}


def _normalize(name: str) -> str:
    """minúsculo, sem acento, primeiro token alfabético."""
    if not name:
        return ""
    first = name.strip().split()[0] if name.strip().split() else ""
    nfkd = unicodedata.normalize("NFKD", first)
    ascii_ = "".join(c for c in nfkd if not unicodedata.combining(c))
    return "".join(c for c in ascii_.lower() if c.isalpha())


def _by_suffix(n: str) -> tuple[Gender, float]:
    """Regras de sufixo com exceções. Retorna (gênero, confiança)."""
    # exceções clássicas: nomes masculinos terminados em 'a'
    male_a_exceptions = {
        "luca", "noa", "neca", "jonatha", "joshua", "yan", "ezequiela",
        "nicola", "andrea",  # 'andrea' é masc em it/ambíguo no BR → baixa conf
    }
    female_o_exceptions = {"socorro", "rosario", "consuelo"}

    if n in male_a_exceptions:
        return Gender.MALE, 0.55
    if n in female_o_exceptions:
        return Gender.FEMALE, 0.6

    if n.endswith(("a", "ia", "na", "isa", "ana", "ele", "elle", "ane", "ine")):
        # maioria feminina, mas 'a' tem exceções → confiança média-alta
        return Gender.FEMALE, 0.72
    if n.endswith(("o", "or", "el", "son", "ton", "ilson", "aldo", "ardo", "inho")):
        return Gender.MALE, 0.72
    if n.endswith(("e", "i", "y", "im", "ir", "is", "as", "os", "us")):
        # terminação fraca → palpite leve masculino, baixa confiança
        return Gender.MALE, 0.5
    return Gender.NEUTRAL, 0.0


def guess(name: str) -> Address:
    """Palpite de tratamento a partir do nome. NÃO usa override (ver `resolve`)."""
    n = _normalize(name)
    if not n:
        return _address(Gender.NEUTRAL, 0.0, "unknown")

    if n in _UNISEX:
        return _address(Gender.NEUTRAL, 0.3, "unisex")
    if n in _MALE_SEED:
        return _address(Gender.MALE, 0.95, "seed")
    if n in _FEMALE_SEED:
        return _address(Gender.FEMALE, 0.95, "seed")

    g, conf = _by_suffix(n)
    return _address(g, conf, "suffix" if conf else "unknown")


def resolve(name: str, user_override: Optional[str] = None) -> Address:
    """Resolve o tratamento final. `user_override` ('M'/'F'/'N' ou pronome) SEMPRE vence.

    Use isto no agente. O override vem da preferência salva no perfil do usuário.
    """
    if user_override:
        ov = user_override.strip().lower()
        if ov in ("m", "masc", "masculino", "ele", "ele/dele"):
            return _address(Gender.MALE, 1.0, "override")
        if ov in ("f", "fem", "feminino", "ela", "ela/dela"):
            return _address(Gender.FEMALE, 1.0, "override")
        if ov in ("n", "neutro", "elu", "ile", "neutre", "they"):
            return _address(Gender.NEUTRAL, 1.0, "override")
    return guess(name)


def _address(g: Gender, conf: float, source: str) -> Address:
    if g is Gender.MALE:
        return Address(g, conf, source, "ele", "o")
    if g is Gender.FEMALE:
        return Address(g, conf, source, "ela", "a")
    return Address(g, conf, source, "você", "")


# Limiar abaixo do qual o agente NÃO assume gênero e pergunta/usa neutro.
ASSUME_THRESHOLD = 0.7
