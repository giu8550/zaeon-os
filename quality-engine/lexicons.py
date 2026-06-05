"""Léxicos PT-BR para as métricas nativas.

Listas propositalmente conservadoras: ampliar com cautela, pois o canal de
flags (fingerprint de IA) tem baixa precisão e decai com o tempo.
"""

# Conectivos por categoria (subconjunto funcional).
CONNECTIVES = {
    "aditivo": {"além disso", "também", "ademais", "outrossim", "bem como", "e ainda"},
    "adversativo": {"no entanto", "porém", "contudo", "todavia", "entretanto", "apesar de"},
    "causal": {"porque", "pois", "visto que", "uma vez que", "dado que", "já que", "devido a"},
    "conclusivo": {"portanto", "logo", "assim", "dessa forma", "por conseguinte", "consequentemente"},
    "temporal": {"em seguida", "posteriormente", "anteriormente", "finalmente", "por fim"},
    "explicativo": {"isto é", "ou seja", "por exemplo", "a saber", "em outras palavras"},
}
ALL_CONNECTIVES = frozenset().union(*CONNECTIVES.values())

# Pistas do modelo CARS de Swales para a introdução.
CARS_GAP = {
    "no entanto", "poucos estudos", "pouca atenção", "lacuna", "carece", "ainda não",
    "não foi", "escassez", "limitações", "falta de", "raros são", "pouco se sabe",
}
CARS_PURPOSE = {
    "o objetivo deste", "este trabalho visa", "objetiva-se", "propõe-se", "este estudo",
    "a presente pesquisa", "tem como objetivo", "busca-se", "este artigo", "neste trabalho",
}
CONCLUSION_LIMITS = {
    "limitaç", "trabalhos futuros", "pesquisas futuras", "estudos futuros", "como limitaç",
    "trabalhos posteriores",
}

# Léxico-fingerprint de IA (PT) — FLAG fraca, nunca entra na nota.
AI_FINGERPRINT = frozenset({
    "ressaltar", "aprofundar", "intricado", "robusto", "abrangente", "crucial",
    "multifacetado", "primordial", "elucidar", "vasto leque", "navegar", "alavancar",
    "vale ressaltar", "é importante notar", "em suma", "tapeçaria", "panorama",
})

# Sufixos de nominalização (densidade alta = texto mais difícil; sinal do estudo).
NOMINALIZATION_SUFFIXES = (
    "ção", "ções", "mento", "mentos", "idade", "idades", "ância", "ância",
    "ência", "ências", "ismo", "ismos", "agem",
)

# Stopwords PT (subconjunto suficiente para overlap de conteúdo).
STOPWORDS = frozenset(
    """a o e é de do da das dos em no na nos nas um uma uns umas para por com sem sob sobre
    entre que se ao aos à às como mas ou nem já não sim quando onde qual quais seu sua seus
    suas este esta isto esse essa isso aquele aquela aquilo lhe lhes me te nos vos ser estar
    ter haver foi são era as os ele ela eles elas eu tu você vocês meu minha num numa pelo
    pela pelos pelas dele dela deles delas seja foram havia""".split()
)

# Marcadores de método/contexto para especificidade de título.
TITLE_METHOD_CUES = {
    "análise", "estudo de caso", "impacto", "avaliação", "comparação", "modelo", "proposta",
    "desenvolvimento", "revisão sistemática", "investigação", "aplicação", "efeito",
    "influência", "predição", "otimização", "validação",
}
TITLE_VAGUE = {"um estudo sobre", "estudo sobre", "um estudo", "coisas", "geral", "diversos temas"}
