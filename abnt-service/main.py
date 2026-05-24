"""
ABNT Document Service — FastAPI
Porta: 8001
"""
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware

from models import DocumentPayload
from formatter import build_abnt_document
from pdf_converter import docx_bytes_to_pdf

app = FastAPI(
    title="Zaeon ABNT Service",
    description="Geração de documentos acadêmicos conforme ABNT NBR 14724:2011",
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
    return {"status": "ok", "service": "zaeon-abnt", "version": "1.0.0"}


@app.post("/format")
def format_document(payload: DocumentPayload):
    """
    Recebe DocumentPayload e retorna o arquivo formatado (.docx ou .pdf).
    """
    try:
        docx_bytes = build_abnt_document(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar documento: {str(e)}")

    filename_safe = payload.title.replace(" ", "_").replace("/", "-")[:60]

    if payload.format == "pdf":
        try:
            pdf_bytes = docx_bytes_to_pdf(docx_bytes, font_choice=payload.font_choice or "Times New Roman")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Erro ao converter para PDF: {str(e)}")

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename_safe}_ABNT.pdf"',
                "Content-Length": str(len(pdf_bytes)),
            },
        )

    # Formato .docx
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": f'attachment; filename="{filename_safe}_ABNT.docx"',
            "Content-Length": str(len(docx_bytes)),
        },
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
