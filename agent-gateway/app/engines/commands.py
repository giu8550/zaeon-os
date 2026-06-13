"""Parser de comandos — o WhatsApp/app vira fonte de comandos, não só conversa.

Ex.: "enviar tarefa para o professor", "salvar isso na sala X", "buscar na internet".
Detecta a intenção e extrai argumentos. Pura: texto → Command. O gate de plano
(ex.: enviar-pro-professor é Plus) é aplicado pelo orquestrador, não aqui.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class Intent(str, Enum):
    CHAT = "chat"                       # default — conversa normal
    SEND_TO_PROFESSOR = "send_to_professor"
    SAVE_TO_ROOM = "save_to_room"
    WEB_SEARCH = "web_search"
    ACADEMIC_SEARCH = "academic_search"
    CONNECT_WHATSAPP = "connect_whatsapp"
    HELP = "help"


@dataclass
class Command:
    intent: Intent
    text: str                          # payload/conteúdo relevante
    args: dict = field(default_factory=dict)


# (intent, regex). Slash explícito OU linguagem natural.
_RULES: list[tuple[Intent, re.Pattern[str]]] = [
    (Intent.SEND_TO_PROFESSOR, re.compile(
        r"^/?(enviar|mandar|envia|manda)\b.{0,20}\b(professor|prof|orientador)\b", re.I)),
    (Intent.SAVE_TO_ROOM, re.compile(
        r"^/?(salvar|guardar|salva|guarda)\b.{0,20}\b(sala|biblioteca|pesquisa)\b", re.I)),
    (Intent.WEB_SEARCH, re.compile(
        r"^/?(buscar|pesquisar|procurar|busca|pesquisa)\b.{0,20}\b(internet|web|google|on-?line)\b", re.I)),
    (Intent.ACADEMIC_SEARCH, re.compile(
        r"^/?(buscar|pesquisar|busca|pesquisa)\b.{0,20}\b(artigo|paper|acad[êe]mic|cient[íi]fic)", re.I)),
    (Intent.CONNECT_WHATSAPP, re.compile(
        r"^/?(conectar|ligar|parear|conecta)\b.{0,15}\bwhats(app)?\b", re.I)),
    (Intent.HELP, re.compile(r"^/?(ajuda|help|comandos|o que voc[êe] faz)\b", re.I)),
]


def parse(text: str) -> Command:
    raw = (text or "").strip()
    for intent, pat in _RULES:
        if pat.search(raw):
            # remove o gatilho do começo p/ sobrar o conteúdo
            payload = pat.sub("", raw, count=1).strip(" :,-—") or raw
            return Command(intent, payload)
    return Command(Intent.CHAT, raw)
