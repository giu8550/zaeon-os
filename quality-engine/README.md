# Zaeon Quality Engine (Termômetro Acadêmico)

Motor Python (FastAPI, porta **8003**) que classifica **título, seções e
parágrafos** de um trabalho acadêmico PT-BR (TCC/Artigo/Relatório) em 5 bandas
— **ruim · aceitável · bom · muito bom · excepcional** — com métricas
estabelecidas e **explicáveis**. Espelha o padrão de `research-engine/` e
`abnt-service/`.

## O que mede

| Eixo | Métrica | Base |
|------|---------|------|
| Legibilidade | Flesch adaptado ao PT (faixa-ótima, não-monotônico) | Martins et al. 1996 |
| Vocabulário | Diversidade lexical robusta a tamanho (MATTR) | McCarthy & Jarvis 2010 |
| Sintaxe | Comprimento de frase, subordinação, *burstiness* | L2SCA (Lu 2010) |
| Coesão | Densidade de conectivos + sobreposição lexical | Coh-Metrix-Port |
| Evidência | Densidade de citações ABNT `(AUTOR, ano)` | NBR 10520 |
| Estrutura | CARS de Swales (introdução), IMRaD, limitações | Swales 1990/2004 |

Bandas ancoradas na rubrica **AAC&U Written Communication VALUE (0–4)**.
Sinais de "revisar" (nominalização excessiva, léxico de IA, frases uniformes)
ficam num **canal separado** — nunca afetam a nota.

## Rodar

```bash
cd quality-engine
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --port 8003 --reload
```

O Next chama via `QUALITY_ENGINE_URL` (default `http://localhost:8003`). Se o
motor estiver offline, a UI esconde o termômetro graciosamente (HTTP 503).

## Endpoints

- `GET /health`
- `POST /score` — documento inteiro (`{title, work_type, academic_level, sections[]}`)
- `POST /score/paragraph` — parágrafo único (caminho rápido p/ a trilha ao vivo)

## NILC-Metrix (opcional, máxima precisão PT)

[NILC-Metrix](https://github.com/nilc-nlp/nilcmetrix) (NILC/USP) calcula ~200
métricas validadas para PT-BR. Roda como **serviço próprio** (PostgreSQL + ~2GB,
**AGPLv3**). Este motor **não embute** o NILC — fala com ele por HTTP, então o
nosso código não herda a AGPL. Para ligar:

```bash
export NILC_METRIX_URL=http://localhost:8080   # sua instância NILC-Metrix
```

Quando presente e saudável (`/health`), as métricas que o NILC cobre
(legibilidade/coesão/sintaxe) **sobrepõem** as nativas. Disponibilidade é
cacheada por 30s. Qualquer falha do NILC → degrada para o provider nativo, que
é sempre suficiente para o funcionamento.

## Testes

```bash
. .venv/bin/activate && pytest -q
```
