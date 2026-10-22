"""
scripts/scielo-para-jsonl.py — dataseek/ptbr-scielo (1 parquet de 2,8 GB) → JSONL leve pras bases por área.

Saída: uma linha por artigo {doc_id, year, titulo, resumo} — título = 1ª linha do texto, resumo = a partir de
"Resumo"/"Abstract" quando vem cedo, cortado em 2400 caracteres (mesma regra de lib/rag/areas.ts `tituloEResumo`).
Roda num container descartável (precisa de pyarrow e ~6 GB de RAM pro bloco único do parquet):
  docker run --rm -m 8g -v /tmp/scielo:/w python:3.11-slim sh -c "pip -q install pyarrow && python /w/scielo-para-jsonl.py /w/data_0.parquet /w/scielo.jsonl"
Com --cru no fim, copia todas as colunas sem mexer (os parquets de medicina, que a API de linhas do HF limita com 429).
"""
import json, re, sys, unicodedata
import pyarrow.parquet as pq

def norm(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").lower()

def titulo_e_resumo(texto, max_resumo=2400):
    t = (texto or "").replace("\r", "")
    q = t.find("\n")
    titulo = (t[:q] if q > 0 else t[:200]).strip()[:300]
    corpo = (t[q + 1:] if q > 0 else "").strip()
    m = re.search(r"\b(resumo|abstract)\b", norm(corpo))
    if m and m.start() < 1500:
        corpo = corpo[m.start():]
    return titulo, corpo[:max_resumo].strip()

entrada, saida = sys.argv[1], sys.argv[2]
pf = pq.ParquetFile(entrada)
n = 0
if "--cru" in sys.argv:
    with open(saida, "w", encoding="utf-8") as out:
        for lote in pf.iter_batches(batch_size=2000):
            for row in lote.to_pylist():
                out.write(json.dumps(row, ensure_ascii=False, default=str) + "\n")
                n += 1
    print(f"pronto: {n} linhas em {saida}")
    sys.exit(0)
with open(saida, "w", encoding="utf-8") as out:
    for lote in pf.iter_batches(batch_size=2000, columns=["doc_id", "year", "text"]):
        for doc_id, year, text in zip(lote.column("doc_id").to_pylist(), lote.column("year").to_pylist(), lote.column("text").to_pylist()):
            titulo, resumo = titulo_e_resumo(text)
            out.write(json.dumps({"doc_id": doc_id, "year": year, "titulo": titulo, "resumo": resumo}, ensure_ascii=False) + "\n")
            n += 1
        print(f"{n} artigos", flush=True)
print(f"pronto: {n} artigos em {saida}")
