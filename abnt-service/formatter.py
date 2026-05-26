"""
ABNT NBR 14724:2011 — Motor de geração de documentos Word
Usa python-docx para controle preciso de toda a formatação.
"""
import io
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

import abnt_rules as R
from models import DocumentPayload


def build_abnt_document(payload: DocumentPayload) -> bytes:
    """
    Constrói o documento Word completo conforme ABNT NBR 14724:2011.
    Retorna os bytes do .docx.
    """
    doc = Document()
    font = payload.font_choice or R.FONT_BODY

    _setup_page(doc)
    _setup_base_style(doc, font)

    _add_cover_page(doc, payload, font)
    doc.add_page_break()

    _add_title_page(doc, payload, font)
    doc.add_page_break()

    _add_resumo(doc, payload.resumo, payload.palavras_chave, font)
    doc.add_page_break()

    _add_toc_placeholder(doc, font)
    doc.add_page_break()

    for i, section in enumerate(payload.sections, start=1):
        _add_body_section(doc, section, i, font)

    doc.add_page_break()
    _add_references(doc, payload.references, font)

    _add_page_numbers(doc)

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf.read()


# ── Configuração de página ─────────────────────────────────────

def _setup_page(doc: Document):
    section = doc.sections[0]
    section.page_width  = Cm(R.PAGE_WIDTH_CM)
    section.page_height = Cm(R.PAGE_HEIGHT_CM)
    section.left_margin   = Cm(R.MARGIN_LEFT_CM)
    section.right_margin  = Cm(R.MARGIN_RIGHT_CM)
    section.top_margin    = Cm(R.MARGIN_TOP_CM)
    section.bottom_margin = Cm(R.MARGIN_BOTTOM_CM)


def _setup_base_style(doc: Document, font_name: str):
    style = doc.styles['Normal']
    style.font.name = font_name
    style.font.size = Pt(R.FONT_SIZE_BODY_PT)
    fmt = style.paragraph_format
    fmt.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
    fmt.line_spacing = R.LINE_SPACING_BODY
    fmt.first_line_indent = Cm(R.PARAGRAPH_INDENT_CM)
    fmt.space_before = Pt(0)
    fmt.space_after  = Pt(0)


# ── Capa ───────────────────────────────────────────────────────

def _add_cover_page(doc: Document, payload: DocumentPayload, font: str):
    cover = payload.cover

    def centered(text: str, size: int = R.FONT_SIZE_BODY_PT, bold: bool = False) -> None:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.first_line_indent = Cm(0)
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after  = Pt(0)
        run = p.add_run(text)
        run.font.name = font
        run.font.size = Pt(size)
        run.bold = bold

    # Instituição — topo centralizado
    centered(cover.institution.upper(), bold=True)
    centered(cover.course)

    # Espaço entre instituição e autor
    for _ in range(8):
        _blank_line(doc, font)

    centered(cover.author.upper())

    for _ in range(8):
        _blank_line(doc, font)

    # Título em maiúsculas, negrito
    centered(payload.title.upper(), bold=True)

    # Natureza do trabalho (se TCC ou Relatório)
    if payload.work_type in ("TCC", "Relatório"):
        for _ in range(4):
            _blank_line(doc, font)
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.first_line_indent = Cm(0)
        run = p.add_run(f"{payload.work_type} apresentado como requisito parcial.")
        run.font.name = font
        run.font.size = Pt(R.FONT_SIZE_BODY_PT)
        if cover.advisor:
            p2 = doc.add_paragraph()
            p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p2.paragraph_format.first_line_indent = Cm(0)
            run2 = p2.add_run(f"Orientador: {cover.advisor}")
            run2.font.name = font
            run2.font.size = Pt(R.FONT_SIZE_BODY_PT)

    # Cidade e ano — rodapé
    for _ in range(8):
        _blank_line(doc, font)

    centered(cover.city.upper())
    centered(cover.year)


# ── Folha de rosto ─────────────────────────────────────────────

def _add_title_page(doc: Document, payload: DocumentPayload, font: str):
    cover = payload.cover

    def centered(text: str, bold: bool = False) -> None:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.first_line_indent = Cm(0)
        run = p.add_run(text)
        run.font.name = font
        run.font.size = Pt(R.FONT_SIZE_BODY_PT)
        run.bold = bold

    centered(cover.author.upper())

    for _ in range(8):
        _blank_line(doc, font)

    centered(payload.title.upper(), bold=True)

    for _ in range(6):
        _blank_line(doc, font)

    # Nota explicativa (alinhada à direita, metade da largura)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.first_line_indent = Cm(0)
    p.paragraph_format.left_indent = Cm(8)
    run = p.add_run(
        f"{payload.work_type} apresentado ao Curso de {cover.course} "
        f"da {cover.institution}, como requisito parcial para conclusão."
    )
    run.font.name = font
    run.font.size = Pt(R.FONT_SIZE_BODY_PT)

    if cover.advisor:
        p2 = doc.add_paragraph()
        p2.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        p2.paragraph_format.first_line_indent = Cm(0)
        p2.paragraph_format.left_indent = Cm(8)
        run2 = p2.add_run(f"Orientador(a): {cover.advisor}")
        run2.font.name = font
        run2.font.size = Pt(R.FONT_SIZE_BODY_PT)

    for _ in range(8):
        _blank_line(doc, font)

    centered(cover.city.upper())
    centered(cover.year)


# ── Resumo ─────────────────────────────────────────────────────

def _add_resumo(doc: Document, resumo: str, palavras_chave: list, font: str):
    _section_title(doc, "RESUMO", font)

    p = doc.add_paragraph(resumo)
    p.paragraph_format.first_line_indent = Cm(0)  # resumo sem recuo
    p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
    p.paragraph_format.line_spacing = R.LINE_SPACING_BODY
    for run in p.runs:
        run.font.name = font
        run.font.size = Pt(R.FONT_SIZE_BODY_PT)

    _blank_line(doc, font)

    kw = doc.add_paragraph()
    kw.paragraph_format.first_line_indent = Cm(0)
    r_bold = kw.add_run("Palavras-chave: ")
    r_bold.bold = True
    r_bold.font.name = font
    r_bold.font.size = Pt(R.FONT_SIZE_BODY_PT)
    r_kw = kw.add_run("; ".join(palavras_chave) + ".")
    r_kw.font.name = font
    r_kw.font.size = Pt(R.FONT_SIZE_BODY_PT)


# ── Sumário (placeholder) ──────────────────────────────────────

def _add_toc_placeholder(doc: Document, font: str):
    _section_title(doc, "SUMÁRIO", font)
    p = doc.add_paragraph()
    p.paragraph_format.first_line_indent = Cm(0)
    run = p.add_run("[Sumário automático — atualize no Word: Referências > Atualizar Sumário]")
    run.font.name = font
    run.font.size = Pt(R.FONT_SIZE_BODY_PT)
    run.italic = True
    run.font.color.rgb = RGBColor(0x88, 0x88, 0x88)


# ── Seções do corpo ────────────────────────────────────────────

def _add_body_section(doc: Document, section_data, number: int, font: str):
    title_text = f"{number} {section_data.title.upper()}"
    _section_title(doc, title_text, font)

    for block in _split_paragraphs(section_data.content):
        _add_paragraph(doc, block, font)

    for j, sub in enumerate(section_data.subsections, start=1):
        sub_title = f"{number}.{j} {sub.title.upper()}"
        _subsection_title(doc, sub_title, font)
        for block in _split_paragraphs(sub.content):
            _add_paragraph(doc, block, font)


def _add_paragraph(doc: Document, text: str, font: str):
    if not text.strip():
        return
    if _is_long_quote(text):
        _add_long_quote(doc, text, font)
    else:
        p = doc.add_paragraph()
        p.paragraph_format.first_line_indent = Cm(R.PARAGRAPH_INDENT_CM)
        p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
        p.paragraph_format.line_spacing = R.LINE_SPACING_BODY
        run = p.add_run(text)
        run.font.name = font
        run.font.size = Pt(R.FONT_SIZE_BODY_PT)


def _add_long_quote(doc: Document, text: str, font: str):
    p = doc.add_paragraph()
    p.paragraph_format.first_line_indent = Cm(0)
    p.paragraph_format.left_indent = Cm(R.LONG_QUOTE_INDENT_CM)
    p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
    run = p.add_run(text)
    run.font.name = font
    run.font.size = Pt(R.FONT_SIZE_QUOTE_PT)


def _is_long_quote(text: str) -> bool:
    has_quotes = text.startswith('"') or text.startswith('“') or text.startswith('‘')
    return len(text) > R.LONG_QUOTE_CHARS and has_quotes


def _split_paragraphs(content: str) -> list:
    return [b.strip() for b in content.split("\n\n") if b.strip()]


# ── Referências ────────────────────────────────────────────────

def _add_references(doc: Document, references: list, font: str):
    _section_title(doc, R.REFERENCES_TITLE, font)

    for ref in references:
        p = doc.add_paragraph()
        p.paragraph_format.first_line_indent = Cm(0)
        p.paragraph_format.left_indent = Cm(0)
        p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
        p.paragraph_format.space_after = R.SPACE_BETWEEN_REFS
        run = p.add_run(ref.text)
        run.font.name = font
        run.font.size = Pt(R.FONT_SIZE_BODY_PT)


# ── Títulos ────────────────────────────────────────────────────

def _section_title(doc: Document, title: str, font: str):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.first_line_indent = Cm(0)
    p.paragraph_format.space_before = Pt(R.SPACE_BEFORE_TITLE_PT)
    p.paragraph_format.space_after  = Pt(R.SPACE_AFTER_TITLE_PT)
    run = p.add_run(title.upper())
    run.bold = True
    run.font.name = font
    run.font.size = Pt(R.FONT_SIZE_BODY_PT)


def _subsection_title(doc: Document, title: str, font: str):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.first_line_indent = Cm(0)
    p.paragraph_format.space_before = Pt(R.SPACE_BEFORE_TITLE_PT)
    p.paragraph_format.space_after  = Pt(R.SPACE_AFTER_TITLE_PT)
    run = p.add_run(title.upper())
    run.bold = False   # subtítulos: sem negrito (NBR 14724)
    run.font.name = font
    run.font.size = Pt(R.FONT_SIZE_BODY_PT)


def _blank_line(doc: Document, font: str):
    p = doc.add_paragraph()
    p.paragraph_format.first_line_indent = Cm(0)
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after  = Pt(0)
    run = p.add_run("")
    run.font.name = font
    run.font.size = Pt(R.FONT_SIZE_BODY_PT)


# ── Numeração de páginas ───────────────────────────────────────

def _add_page_numbers(doc: Document):
    """
    Adiciona numeração de páginas no canto superior direito (header).
    Começa a exibir a partir da 1ª página (capa).
    """
    for section in doc.sections:
        header = section.header
        header.is_linked_to_previous = False

        # Limpa conteúdo anterior do header
        for para in header.paragraphs:
            para.clear()

        if header.paragraphs:
            p = header.paragraphs[0]
        else:
            p = header.add_paragraph()

        p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        p.paragraph_format.first_line_indent = Cm(0)

        run = p.add_run()
        fldChar1 = OxmlElement('w:fldChar')
        fldChar1.set(qn('w:fldCharType'), 'begin')

        instrText = OxmlElement('w:instrText')
        instrText.set(qn('xml:space'), 'preserve')
        instrText.text = 'PAGE'

        fldChar2 = OxmlElement('w:fldChar')
        fldChar2.set(qn('w:fldCharType'), 'end')

        run._r.append(fldChar1)
        run._r.append(instrText)
        run._r.append(fldChar2)
