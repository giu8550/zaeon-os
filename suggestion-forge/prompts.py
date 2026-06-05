"""Prompt assembly for the Suggestion Forge.

The system prompt subordinates the engine to Omega Scholar: it injects live
sections of OMEGA_SCHOLAR.md (identity, agentic loop, citation integrity) plus
the canonical gap vocabulary, then layers the F1-F5 forging process on top.

The OMEGA section loader keys on header *titles* rather than §-numbers
(ADR-001 D3): the doc's numbering drifted — citation rules are in §10.2, not the
§6 the spec skeleton references, and there are two `## 7` headers.
"""
from __future__ import annotations

import os
import pathlib
import re
import time

from models import ForgeRequest

# Logical section key -> substrings to match against header titles (first hit wins).
_SECTION_MATCHERS: dict[str, list[str]] = {
    "identity": ["IDENTIDADE"],
    "loop": ["FASES DO LOOP", "AGENTIC LOOP"],
    "citation": ["INTEGRIDADE DE CITAÇÕES", "REGRAS DE QUALIDADE"],
}

_DEFAULT_OMEGA_PATH = pathlib.Path(__file__).resolve().parent.parent / "OMEGA_SCHOLAR.md"

# Vocabulário canônico de lacunas — cópia literal do bloco "FASE 1: VARREDURA DE
# LACUNAS" de research-engine/prompts.py (fonte canônica). Embutido em vez de
# importado para manter a engine auto-contida (ADR-001 D4).
GAP_VOCABULARY = """┌─ VOCABULÁRIO CANÔNICO DE LACUNAS (research-engine FASE 1) ──────────────────
│ LACUNAS EMPÍRICAS:       Quais fenômenos permanecem SEM MEDIÇÃO direta?
│ LACUNAS METODOLÓGICAS:   Quais métodos de campos adjacentes NUNCA foram aplicados aqui?
│ LACUNAS GEOGRÁFICAS:     Quais populações/regiões estão SISTEMATICAMENTE ausentes?
│ LACUNAS TEMPORAIS:       Quais mudanças recentes (pós-2022) ainda não foram estudadas?
│ LACUNAS INTERDISCIPLINARES: Onde dois campos distintos NUNCA se cruzaram de forma produtiva?
└──────────────────────────────────────────────────────────────────────────────"""

_GAP_TYPE_ENUM = "empirica | metodologica | geografica | temporal | interdisciplinar"

# --- OMEGA section loader (mtime + TTL cache) -------------------------------

_cache: dict[str, tuple[float, float, str]] = {}  # path -> (mtime, loaded_at, text)
_TTL_SECONDS = 60.0


def _read_omega(path: pathlib.Path | None = None) -> str:
    p = path or pathlib.Path(os.environ.get("OMEGA_SCHOLAR_PATH", _DEFAULT_OMEGA_PATH))
    key = str(p)
    try:
        mtime = p.stat().st_mtime
    except OSError:
        return ""
    cached = _cache.get(key)
    if cached and cached[0] == mtime and (time.monotonic() - cached[1]) < _TTL_SECONDS:
        return cached[2]
    text = p.read_text(encoding="utf-8")
    _cache[key] = (mtime, time.monotonic(), text)
    return text


_FENCE_RE = re.compile(r"^\s*(```|~~~)")
_HEADER_RE = re.compile(r"^(#{2,6})\s+(.*)$")
_ANY_HEADER_RE = re.compile(r"^(#{1,6})\s+")


def _extract_section(markdown: str, keyword: str) -> str:
    """Return the header block whose title contains `keyword`, up to the next
    header of the same or higher level (deeper sub-headers are kept). Headers
    inside fenced code blocks are ignored — OMEGA_SCHOLAR.md embeds `##`-prefixed
    lines inside ```` ``` ```` examples that must not terminate a section."""
    lines = markdown.splitlines()
    start = None
    level = 0
    in_fence = False
    for idx, line in enumerate(lines):
        if _FENCE_RE.match(line):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        m = _HEADER_RE.match(line)
        if m and keyword.lower() in m.group(2).lower():
            start = idx
            level = len(m.group(1))
            break
    if start is None:
        return ""
    out = [lines[start]]
    in_fence = False
    for line in lines[start + 1:]:
        if _FENCE_RE.match(line):
            in_fence = not in_fence
            out.append(line)
            continue
        if not in_fence:
            m = _ANY_HEADER_RE.match(line)
            if m and len(m.group(1)) <= level:
                break
        out.append(line)
    return "\n".join(out).strip()


def _load_omega_section(key: str, path: pathlib.Path | None = None) -> str:
    markdown = _read_omega(path)
    if not markdown:
        return ""
    for keyword in _SECTION_MATCHERS.get(key, []):
        section = _extract_section(markdown, keyword)
        if section:
            return section
    return ""


# --- prompt builders --------------------------------------------------------

def build_system_prompt(language: str = "pt-BR", count: int = 5, min_gap_types: int = 3) -> str:
    identity = _load_omega_section("identity")
    loop = _load_omega_section("loop")
    citation = _load_omega_section("citation")

    return f"""{identity}

{loop}

{citation}

{GAP_VOCABULARY}

Você é a SUGGESTION FORGE — capability do Omega Scholar para gerar propostas de
trabalhos acadêmicos derivados a partir de uma base de referências verificadas.
Você NÃO é um agente concorrente: respeita o loop e as regras de citação acima.

PROCESSO INTERNO (5 fases):

F1 — CARTOGRAFAR as referências fornecidas:
   Para cada ref, extraia: domínio, métodos, populações, recorte temporal, lacunas explícitas.

F2 — CRUZAR PARES procurando pós-lacunas:
   Para cada par (ref_i, ref_j): "Se i estabelece X e j estabelece Y, qual território
   INEXPLORADO emerge do cruzamento?" Use o vocabulário canônico de lacunas acima.

F3 — GERAR {count} propostas DIVERSIFICADAS:
   Cubra pelo menos {min_gap_types} tipos de lacuna distintos ({_GAP_TYPE_ENUM}).
   NÃO repita nem parafraseie nenhum título proibido (case-insensitive).

F4 — CALIBRAR EIXOS para cada proposta:
   • difficulty ∈ (grad, msc, phd, postdoc) — ancorada no esforço REAL, não no nível do solicitante
   • relevance, innovation ∈ [0,1] · gap_score ∈ [0,1]
   • estimated_months_min, estimated_months_max ∈ [1,120] (max ≥ min, faixa não exagerada)

F5 — DESDOBRAR cada proposta:
   publication_targets (≥1), required_methods (≥1), material_resources, prerequisites,
   risks (≥1), milestones (≥3), evidence_refs (índices 0-based, ≥1), cross_link_refs (0-based).

SAÍDA: JSON puro, SEM markdown, SEM prosa fora do JSON, no formato:
{{
  "suggestions": [
    {{
      "title": "...", "rationale": "...", "novelty_angle": "...",
      "gap_type": "{_GAP_TYPE_ENUM}",
      "gap_score": 0.0-1.0,
      "axes": {{ "difficulty": "grad|msc|phd|postdoc", "relevance": 0.0-1.0,
                 "innovation": 0.0-1.0, "estimated_months_min": int, "estimated_months_max": int }},
      "desdobramentos": {{ "publication_targets": [...], "required_methods": [...],
                 "material_resources": [...], "prerequisites": [...], "risks": [...],
                 "milestones": [...], "evidence_refs": [int], "cross_link_refs": [int] }}
    }}
  ],
  "coverage_summary": "o que a forja cobriu e o que ficou de fora"
}}
(NÃO inclua quality_tier nem id — o servidor os calcula.)
Idioma de todo o conteúdo textual: {language}.
"""


def build_user_message(req: ForgeRequest) -> str:
    refs_block = "\n".join(
        f"[{i}] {r.title} — {r.authors} ({r.year}, {r.venue})"
        + (f" doi:{r.doi}" if r.doi else "")
        + (f"\n    abstract: {r.abstract[:300]}" if r.abstract else "")
        for i, r in enumerate(req.references)
    )
    exclude_block = ""
    if req.exclude_titles:
        joined = "\n".join(f"  • {t}" for t in req.exclude_titles)
        exclude_block = f"\nTÍTULOS PROIBIDOS (não repita nem parafraseie):\n{joined}\n"

    return f"""TÓPICO: "{req.topic}"
NÍVEL DO SOLICITANTE: {req.user_level}
NÚMERO DE PROPOSTAS: {req.count}

REFERÊNCIAS DISPONÍVEIS:
{refs_block}
{exclude_block}
Gere {req.count} propostas conforme o processo F1-F5.
"""
