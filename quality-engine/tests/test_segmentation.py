from segmentation import (
    split_paragraphs,
    split_sentences,
    tokenize,
    content_tokens,
    count_syllables,
    syllables_in_word,
)


def test_split_paragraphs_blank_lines():
    txt = "Par um.\nLinha mesmo par.\n\nPar dois."
    assert split_paragraphs(txt) == ["Par um.\nLinha mesmo par.", "Par dois."]


def test_split_paragraphs_strips_markers():
    txt = "# INTRODUÇÃO\nPrimeiro parágrafo.\n\n## Sub\nSegundo parágrafo."
    assert split_paragraphs(txt) == ["Primeiro parágrafo.", "Segundo parágrafo."]


def test_split_sentences_basic():
    assert split_sentences("Olá mundo. Tudo bem? Sim!") == ["Olá mundo.", "Tudo bem?", "Sim!"]


def test_split_sentences_ignores_abbrev():
    s = split_sentences("Segundo o Dr. Silva, a amostra cresceu. Fim.")
    assert s == ["Segundo o Dr. Silva, a amostra cresceu.", "Fim."]


def test_split_sentences_no_terminal_punct():
    assert split_sentences("um texto sem ponto final") == ["um texto sem ponto final"]


def test_tokenize_words_only():
    assert tokenize("A casa, bonita! 123") == ["a", "casa", "bonita"]


def test_content_tokens_drops_stopwords():
    assert "casa" in content_tokens("A casa é bonita")
    assert "é" not in content_tokens("A casa é bonita")


def test_syllables_pt():
    assert syllables_in_word("casa") == 2
    assert syllables_in_word("metodologia") == 5
    assert count_syllables("a casa") >= 3
