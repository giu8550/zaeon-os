# research-engine/main.py
"""
Research Engine Service — FastAPI
Porta: 8002
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from models import SuggestRequest, SuggestResponse
from engine import generate_suggestion

load_dotenv()

app = FastAPI(
    title="Zaeon Research Engine",
    description="Sugestões de pesquisa baseadas em análise de lacunas com Gemini 2.0 Flash",
    version="1.0.0",
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
    return {"status": "ok", "service": "zaeon-research-engine", "version": "1.0.0"}


@app.post("/suggest", response_model=SuggestResponse)
def suggest(payload: SuggestRequest):
    """
    Recebe um tópico + nível acadêmico e retorna 1 sugestão de pesquisa + referências.
    """
    try:
        return generate_suggestion(payload)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro inesperado: {str(e)}")


@app.post("/refresh", response_model=SuggestResponse)
def refresh(payload: SuggestRequest):
    """
    Mesmo contrato de /suggest, mas o cliente deve incluir o título anterior
    em exclude_titles para garantir variação.
    """
    try:
        return generate_suggestion(payload)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro inesperado: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8002, reload=True)
