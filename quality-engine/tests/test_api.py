from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_score_endpoint():
    body = {
        "title": "Impacto da automação têxtil no custo: estudo de caso em MPEs",
        "work_type": "TCC",
        "academic_level": "grad",
        "sections": [
            {
                "type": "introducao",
                "title": "INTRODUÇÃO",
                "content": ("Há ampla literatura sobre automação industrial (SILVA, 2020). "
                            "No entanto, poucos estudos abordam micro e pequenas empresas. "
                            "O objetivo deste trabalho é medir o retorno financeiro nesse contexto."),
            },
            {
                "type": "conclusao",
                "title": "CONCLUSÃO",
                "content": ("Os resultados indicam retorno positivo em doze meses. "
                            "Como limitações, o estudo restringe-se a um setor."),
            },
        ],
    }
    r = client.post("/score", json=body)
    assert r.status_code == 200
    d = r.json()
    assert d["overall"]["band"] in ("ruim", "aceitavel", "bom", "muito_bom", "excepcional")
    assert d["overall"]["level_read"]
    assert d["title"]["band"]
    assert d["sections"][0]["paragraphs"]
    assert d["meta"]["engine_version"] == "0.1.0"


def test_score_paragraph_endpoint():
    body = {
        "text": "A automação reduz custos (SILVA, 2020). Portanto, o investimento se justifica.",
        "section_type": "desenvolvimento",
        "academic_level": "grad",
    }
    r = client.post("/score/paragraph", json=body)
    assert r.status_code == 200
    d = r.json()
    assert d["band"] in ("ruim", "aceitavel", "bom", "muito_bom", "excepcional")
    assert 0.0 <= d["score"] <= 100.0


def test_score_empty_sections_ok():
    r = client.post("/score", json={"title": "x", "sections": []})
    assert r.status_code == 200
    assert r.json()["overall"]["band"]
