# suggestion-forge/main.py
"""
Suggestion Forge Service — FastAPI
Porta: 8003

Terceiro engine FastAPI do monorepo, irmão de research-engine (8002) e
abnt-service (8001). Stateless: auth e persistência ficam no proxy Next.
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

import engine
from models import ForgeRequest, ForgeResponse

load_dotenv()

app = FastAPI(
    title="Zaeon Suggestion Forge",
    description="Forja propostas de trabalhos acadêmicos derivados a partir de referências verificadas. Subordinada ao Omega Scholar.",
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
    return {"status": "ok", "service": "zaeon-suggestion-forge", "version": "1.0.0"}


def _run(payload: ForgeRequest) -> ForgeResponse:
    try:
        return engine.generate_suggestions(payload)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Erro inesperado: {e}")


@app.post("/forge", response_model=ForgeResponse)
def forge(payload: ForgeRequest):
    """Gera N sugestões a partir das referências fornecidas."""
    return _run(payload)


@app.post("/reforge", response_model=ForgeResponse)
def reforge(payload: ForgeRequest):
    """Re-forja exigindo diversificação contra títulos já emitidos."""
    if not payload.exclude_titles:
        raise HTTPException(status_code=422, detail="reforge requires exclude_titles to be populated")
    return _run(payload)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8003, reload=True)
