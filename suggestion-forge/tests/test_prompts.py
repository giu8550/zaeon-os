"""Tests for prompt assembly + the resilient OMEGA_SCHOLAR.md section loader.

The loader keys on header *titles* (not §-numbers) because OMEGA_SCHOLAR.md has
numbering drift (citation rules live in §10.2, two `## 7` headers exist).
"""
from _factories import make_request

import prompts


SAMPLE_MD = """# Doc Title

## 1. IDENTIDADE E MISSÃO
identity body line one
identity body line two

## 2. OUTRO ASSUNTO
other body
### 2.1 subsecao
sub body
"""


# --- _extract_section (pure) ------------------------------------------------

def test_extract_section_returns_matching_block():
    out = prompts._extract_section(SAMPLE_MD, "IDENTIDADE")
    assert "identity body line one" in out
    assert "identity body line two" in out
    assert "OUTRO ASSUNTO" not in out  # stops at next same-level header


def test_extract_section_includes_deeper_subheaders():
    out = prompts._extract_section(SAMPLE_MD, "OUTRO ASSUNTO")
    assert "subsecao" in out  # ### 2.1 is deeper than ## 2, so included
    assert "other body" in out


def test_extract_section_missing_returns_empty():
    assert prompts._extract_section(SAMPLE_MD, "NAO EXISTE") == ""


# --- _load_omega_section against the real OMEGA_SCHOLAR.md -------------------

def test_load_omega_identity_is_nonempty_and_on_topic():
    identity = prompts._load_omega_section("identity")
    assert "Omega Scholar" in identity


def test_load_omega_loop_contains_execute_phase():
    loop = prompts._load_omega_section("loop")
    assert "EXECUTE" in loop


def test_load_omega_citation_contains_integrity_rules():
    citation = prompts._load_omega_section("citation")
    assert "Proibido" in citation


# --- build_system_prompt ----------------------------------------------------

def test_system_prompt_embeds_canonical_gap_vocabulary():
    sp = prompts.build_system_prompt(language="pt-BR", count=5, min_gap_types=3)
    for token in ("EMPÍRICAS", "METODOLÓGICAS", "GEOGRÁFICAS", "TEMPORAIS", "INTERDISCIPLIN"):
        assert token in sp


def test_system_prompt_reflects_count_and_language():
    sp = prompts.build_system_prompt(language="en", count=7, min_gap_types=4)
    assert "7" in sp
    assert "en" in sp


# --- build_user_message -----------------------------------------------------

def test_user_message_lists_references_with_zero_based_indices():
    msg = prompts.build_user_message(make_request())
    assert "[0]" in msg and "[1]" in msg and "[2]" in msg


def test_user_message_includes_excluded_titles_block():
    req = make_request(exclude_titles=["Um título já mostrado"])
    msg = prompts.build_user_message(req)
    assert "Um título já mostrado" in msg
