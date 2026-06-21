# Zaeon ABNT Service

Microserviço Python para geração de documentos acadêmicos conforme **ABNT NBR 14724:2011**.

## Requisitos

- Python 3.10+
- LibreOffice (para conversão PDF): `brew install --cask libreoffice` ou `sudo apt install libreoffice`

## Setup

```bash
cd abnt-service
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Rodar

```bash
source .venv/bin/activate
# use SEMPRE `python -m uvicorn` (não `uvicorn` direto): garante que roda o uvicorn
# do venv ativo, evitando "No module named uvicorn/numpy" quando há um uvicorn global.
python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

Serviço disponível em: `http://localhost:8001`

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Status do serviço |
| POST | `/format` | Gera documento ABNT |

## Teste rápido

```bash
curl http://localhost:8001/health
```

## Estrutura

```
abnt-service/
├── main.py          ← FastAPI app
├── formatter.py     ← Geração Word (python-docx)
├── pdf_converter.py ← Conversão para PDF
├── abnt_rules.py    ← Constantes NBR 14724:2011
├── models.py        ← Tipos Pydantic
└── requirements.txt
```
