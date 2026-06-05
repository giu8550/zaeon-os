"""Zaeon Quality Engine — FastAPI.

Porta: 8003. Espelha o padrão de research-engine/abnt-service.
Classifica título, seções e parágrafos de um TCC PT-BR em 5 bandas.
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from models import ScoreRequest, ScoreResponse, ParagraphRequest, ParagraphScore
from scorer import score_document, score_paragraph_text

load_dotenv()

app = FastAPI(
    title="Zaeon Quality Engine",
    description="Termômetro Acadêmico — qualidade de texto acadêmico em PT-BR "
                "(Flesch-BR, diversidade, coesão, citações, CARS) com NILC-Metrix opcional.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://zaeonos.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "zaeon-quality-engine", "version": "0.1.0"}


@app.post("/score", response_model=ScoreResponse)
def score(payload: ScoreRequest):
    """Pontua um documento inteiro (título + seções → parágrafos)."""
    try:
        return score_document(payload)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro inesperado: {str(e)}")


@app.post("/score/paragraph", response_model=ParagraphScore)
def score_paragraph(payload: ParagraphRequest):
    """Pontua um único parágrafo — caminho rápido para a trilha ao vivo."""
    try:
        return score_paragraph_text(payload.text, payload.section_type, payload.academic_level)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro inesperado: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8003, reload=True)
