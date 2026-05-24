"""
ABNT NBR 14724:2011 — Constantes de formatação
Norma: Trabalhos acadêmicos — Apresentação
"""
from docx.shared import Pt, Cm

# ── Página (A4) ────────────────────────────────────────────────
PAGE_WIDTH_CM  = 21.0
PAGE_HEIGHT_CM = 29.7

MARGIN_LEFT_CM   = 3.0   # encadernação
MARGIN_RIGHT_CM  = 2.0
MARGIN_TOP_CM    = 3.0
MARGIN_BOTTOM_CM = 2.0

# ── Fonte ──────────────────────────────────────────────────────
FONT_BODY           = "Times New Roman"   # ou Arial, escolha do usuário
FONT_SIZE_BODY_PT   = 12
FONT_SIZE_QUOTE_PT  = 10   # citações longas (> 3 linhas)
FONT_SIZE_NOTE_PT   = 10   # notas de rodapé
FONT_SIZE_SMALL_PT  = 10   # legendas, fontes de tabelas

# ── Espaçamento ────────────────────────────────────────────────
LINE_SPACING_BODY   = 1.5   # corpo do texto
LINE_SPACING_QUOTE  = 1.0   # citações longas, notas, legendas
LINE_SPACING_REF    = 1.0   # entre linhas de uma referência
SPACE_BETWEEN_REFS  = Pt(12)  # entre entradas de referência

SPACE_BEFORE_TITLE_PT = 12
SPACE_AFTER_TITLE_PT  = 12

# ── Recuos ─────────────────────────────────────────────────────
PARAGRAPH_INDENT_CM   = 1.25   # recuo de parágrafo (1ª linha)
LONG_QUOTE_INDENT_CM  = 4.0    # citações longas: recuo esquerdo
LONG_QUOTE_CHARS      = 250    # threshold para "citação longa"

# ── Numeração de páginas ───────────────────────────────────────
# Aparece no canto superior direito
# Contagem começa na capa; exibição começa na 1ª folha de texto
PAGE_NUMBER_FROM_PAGE = 1

# ── Elementos pré-textuais obrigatórios ───────────────────────
# Ordem: Capa → Folha de Rosto → Resumo → Sumário → Texto → Referências

# ── Referências (NBR 6023:2018) ────────────────────────────────
REFERENCES_TITLE = "REFERÊNCIAS"
# Alinhadas à esquerda, sem recuo, espaço simples, separadas por linha em branco
