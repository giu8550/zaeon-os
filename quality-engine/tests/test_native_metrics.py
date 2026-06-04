from metrics.native import (
    flesch_br, lexical_diversity_score, mean_sentence_length, sentence_length_cv,
    clauses_per_sentence, connective_density, lexical_overlap, citation_density,
    nominalization_rate, ai_fingerprint_rate, paragraph_flags, all_metrics,
)

EASY = "O gato dorme. A casa é bela. O sol brilha hoje."
HARD = ("A operacionalização epistemológica das contingências paradigmáticas pressupõe a "
        "ressignificação ontológica das estruturas socioculturais subjacentes às práxis discursivas.")


def test_flesch_br_easy_higher_than_hard():
    assert flesch_br(EASY) > flesch_br(HARD)


def test_flesch_br_reasonable_range():
    assert -80 <= flesch_br(EASY) <= 120


def test_flesch_br_empty_is_zero():
    assert flesch_br("") == 0.0


def test_diversity_varied_gt_repetitive():
    rep = "casa casa casa casa casa casa casa casa casa casa"
    var = "casa prédio rua avenida ponte viaduto praça jardim mercado escola"
    assert lexical_diversity_score(var) > lexical_diversity_score(rep)


def test_diversity_robust_on_short_text():
    # Parágrafo curto, porém variado, não deve zerar (regressão do MTLD puro).
    assert lexical_diversity_score("a teoria proposta explica o fenômeno observado") > 50


def test_mean_sentence_length():
    assert 2.5 <= mean_sentence_length(EASY) <= 4.5  # 3 frases curtas


def test_clauses_per_sentence_subordination():
    simple = "O dado subiu."
    complex_ = "O dado subiu, porque a demanda cresceu, embora o custo também tenha aumentado."
    assert clauses_per_sentence(complex_) > clauses_per_sentence(simple)


def test_connective_density_counts():
    assert connective_density("No entanto, o dado subiu. Portanto, aceitamos a hipótese.") > 0


def test_lexical_overlap_repeated_terms():
    cohesive = "A automação reduz custos. A automação também acelera processos."
    disjoint = "O gato dorme. A bolsa subiu na sexta."
    assert lexical_overlap(cohesive) > lexical_overlap(disjoint)


def test_citation_density_detects_abnt():
    assert citation_density("A teoria se confirma (SILVA, 2020) e em Souza (2019).") > 0
    assert citation_density("Texto sem nenhuma citação aqui.") == 0


def test_nominalization_rate_positive():
    assert nominalization_rate("A operacionalização e a ressignificação da informação.") > 0.2


def test_ai_fingerprint_detects():
    assert ai_fingerprint_rate("É crucial ressaltar o robusto e abrangente resultado.") > 0
    assert ai_fingerprint_rate("O cachorro correu no parque.") == 0


def test_flags_uniform_sentences():
    uniform = "O dado subiu hoje cedo. O dado caiu hoje cedo. O dado subiu hoje cedo."
    assert "uniformidade" in paragraph_flags(uniform)


def test_all_metrics_keys():
    m = all_metrics(EASY)
    for k in ("flesch", "diversity", "msl", "cv", "clauses", "connective", "overlap",
              "citation", "nominalization", "ai_fingerprint"):
        assert k in m
