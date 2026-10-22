"""
ABNT NBR 14724:2011 — Motor de geração de documentos Word
Usa python-docx para controle preciso de toda a formatação.
"""
import base64
import io
import re
import urllib.request
from docx import Document
from docx.shared import Pt, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.opc.part import Part
from docx.opc.packuri import PackURI

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

    # ── Seção 1: CAPA (não contada, sem numeração) ──
    _add_cover_page(doc, payload, font)

    # ── Seção 2: PRÉ-TEXTUAIS (contadas a partir da folha de rosto = pág. 1) ──
    pretextual = _new_section(doc)
    _set_section_start_page(pretextual, 1)  # capa não conta; folha de rosto = 1

    _add_title_page(doc, payload, font)
    doc.add_page_break()

    _add_resumo(doc, payload.resumo, payload.palavras_chave, font)
    doc.add_page_break()

    if payload.abstract and payload.abstract.strip():
        _add_abstract(doc, payload.abstract, payload.keywords, font)
        doc.add_page_break()

    _add_table_of_contents(doc, payload.sections, bool(payload.references), font)
    doc.add_page_break()

    counters = {"figura": 0, "year": payload.cover.year if payload.cover else None}
    for i, section in enumerate(payload.sections, start=1):
        _add_body_section(doc, section, i, font, counters)

    doc.add_page_break()
    _add_references(doc, payload.references, font)

    # Pós-textuais, na ordem da NBR 14724: apêndice (do autor) antes de anexo (de terceiro).
    _add_appendices(doc, payload.apendices, "APÊNDICE", font, counters)
    _add_appendices(doc, payload.anexos, "ANEXO", font, counters)

    _add_page_numbers(doc)

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf.read()


# ── Configuração de página ─────────────────────────────────────

def _setup_section(section):
    section.page_width  = Cm(R.PAGE_WIDTH_CM)
    section.page_height = Cm(R.PAGE_HEIGHT_CM)
    section.left_margin   = Cm(R.MARGIN_LEFT_CM)
    section.right_margin  = Cm(R.MARGIN_RIGHT_CM)
    section.top_margin    = Cm(R.MARGIN_TOP_CM)
    section.bottom_margin = Cm(R.MARGIN_BOTTOM_CM)


def _new_section(doc: Document):
    """Quebra de seção (nova página) com a mesma configuração de página ABNT."""
    section = doc.add_section(WD_SECTION.NEW_PAGE)
    _setup_section(section)
    return section


def _set_section_start_page(section, start: int):
    sectPr = section._sectPr
    pgNumType = sectPr.find(qn('w:pgNumType'))
    if pgNumType is None:
        pgNumType = OxmlElement('w:pgNumType')
        sectPr.append(pgNumType)
    pgNumType.set(qn('w:start'), str(start))


def _set_section_continue(section):
    """Remove o 'start' herdado (add_section copia o sectPr anterior) para a
    numeração continuar em vez de reiniciar."""
    sectPr = section._sectPr
    pgNumType = sectPr.find(qn('w:pgNumType'))
    if pgNumType is not None:
        if qn('w:start') in pgNumType.attrib:
            del pgNumType.attrib[qn('w:start')]
        if not pgNumType.attrib:
            sectPr.remove(pgNumType)


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
    fmt.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY  # corpo justificado (NBR 14724)
    fmt.space_before = Pt(0)
    fmt.space_after  = Pt(0)


# ── Capa ───────────────────────────────────────────────────────

def _add_cover_page(doc: Document, payload: DocumentPayload, font: str):
    """Capa em 3 blocos (topo · meio · base) posicionados com space_before em Pt.

    Nada de empilhar parágrafos vazios: toda linha da capa tem entrelinha EXATA
    (R.COVER_LINE_PT), então a altura de cada bloco é conhecida e o espaço entre
    eles é calculado — trocar Times↔Arial ou mudar o tamanho do título não
    desloca a capa nem cria página em branco extra.
    """
    cover = payload.cover
    L = R.COVER_LINE_PT
    W = R.CHARS_PER_LINE

    top = [(cover.institution.upper(), True), (cover.course, False)]
    author = [(cover.author.upper(), False)]
    middle = [(payload.title.upper(), True)]
    nature = []
    if payload.work_type in ("TCC", "Relatório"):
        nature.append((f"{payload.work_type} apresentado como requisito parcial.", False))
        if cover.advisor:
            nature.append((f"Orientador: {cover.advisor}", False))
    bottom = [(cover.city.upper(), False), (cover.year, False)]

    h = lambda block, width=W: sum(_line_count(t, width, bold) for t, bold in block) * L
    H = _usable_height_pt()
    gap_author = R.COVER_GAP_AUTHOR_LINES * L
    gap_nature = R.COVER_GAP_NATURE_LINES * L

    cursor = h(top) + gap_author + h(author)
    title_before = max(L, H / 2 - h(middle, R.CHARS_PER_LINE_TITLE) / 2 - cursor)
    cursor += title_before + h(middle, R.CHARS_PER_LINE_TITLE) + (gap_nature + h(nature) if nature else 0)
    bottom_before = max(L, H - cursor - h(bottom) - R.COVER_BOTTOM_SAFETY_PT)

    for i, (t, bold) in enumerate(top):
        _cover_line(doc, t, font, bold)
    for i, (t, bold) in enumerate(author):
        _cover_line(doc, t, font, bold, space_before=gap_author if i == 0 else 0)
    for i, (t, bold) in enumerate(middle):
        _cover_line(doc, t, font, bold, space_before=title_before if i == 0 else 0)
    for i, (t, bold) in enumerate(nature):
        _cover_line(doc, t, font, bold, space_before=gap_nature if i == 0 else 0)
    for i, (t, bold) in enumerate(bottom):
        _cover_line(doc, t, font, bold, space_before=bottom_before if i == 0 else 0)


# ── Folha de rosto ─────────────────────────────────────────────

def _add_title_page(doc: Document, payload: DocumentPayload, font: str):
    """Folha de rosto: autor no topo, título no terço superior, nota de natureza
    recuada 8 cm no meio, cidade/ano na base — mesmo cálculo em Pt da capa."""
    cover = payload.cover
    L = R.COVER_LINE_PT
    H = _usable_height_pt()

    note = [
        f"{payload.work_type} apresentado ao Curso de {cover.course} "
        f"da {cover.institution}, como requisito parcial para conclusão."
    ]
    if cover.advisor:
        note.append(f"Orientador(a): {cover.advisor}")

    author_h = _line_count(cover.author.upper(), R.CHARS_PER_LINE) * L
    title_h = _line_count(payload.title.upper(), R.CHARS_PER_LINE_TITLE, True) * L
    note_h = sum(_line_count(t, R.CHARS_PER_LINE_NOTE) for t in note) * L
    bottom_h = 2 * L

    title_before = max(L, H * R.TITLE_PAGE_TITLE_AT - title_h / 2 - author_h)
    note_before = R.TITLE_PAGE_GAP_NOTE_LINES * L
    cursor = author_h + title_before + title_h + note_before + note_h
    bottom_before = max(L, H - cursor - bottom_h - R.COVER_BOTTOM_SAFETY_PT)

    _cover_line(doc, cover.author.upper(), font)
    _cover_line(doc, payload.title.upper(), font, bold=True, space_before=title_before)
    for i, t in enumerate(note):
        _cover_line(doc, t, font, space_before=note_before if i == 0 else 0,
                    align=WD_ALIGN_PARAGRAPH.JUSTIFY, left_indent_cm=R.TITLE_PAGE_NOTE_INDENT_CM)
    _cover_line(doc, cover.city.upper(), font, space_before=bottom_before)
    _cover_line(doc, cover.year, font)


def _cover_line(doc: Document, text: str, font: str, bold: bool = False, space_before: float = 0,
                align=WD_ALIGN_PARAGRAPH.CENTER, left_indent_cm: float = 0):
    """Uma linha de capa/folha de rosto: entrelinha EXATA, espaço só por space_before."""
    p = doc.add_paragraph()
    p.alignment = align
    fmt = p.paragraph_format
    fmt.first_line_indent = Cm(0)
    fmt.left_indent = Cm(left_indent_cm)
    fmt.line_spacing_rule = WD_LINE_SPACING.EXACTLY
    fmt.line_spacing = Pt(R.COVER_LINE_PT)
    fmt.space_before = Pt(round(space_before, 1))
    fmt.space_after = Pt(0)
    run = p.add_run(_one_line(text))
    run.font.name = font
    run.font.size = Pt(R.FONT_SIZE_BODY_PT)
    run.bold = bold
    return p


def _usable_height_pt() -> float:
    return (R.PAGE_HEIGHT_CM - R.MARGIN_TOP_CM - R.MARGIN_BOTTOM_CM) / 2.54 * 72


def _line_count(text: str, chars_per_line: int, bold: bool = False) -> int:
    """Linhas que o texto ocupa (estimativa conservadora; negrito ~8% mais largo)."""
    import math
    width = chars_per_line * (0.92 if bold else 1.0)
    return max(1, math.ceil(len(_one_line(text)) / width))


# ── Resumo ─────────────────────────────────────────────────────

def _add_resumo(doc: Document, resumo: str, palavras_chave: list, font: str):
    _section_title(doc, "RESUMO", font)

    p = doc.add_paragraph(_one_paragraph(resumo))
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY  # resumo justificado (NBR 14724)
    p.paragraph_format.first_line_indent = Cm(0)  # resumo sem recuo
    p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
    p.paragraph_format.line_spacing = R.LINE_SPACING_BODY
    for run in p.runs:
        run.font.name = font
        run.font.size = Pt(R.FONT_SIZE_BODY_PT)

    _keywords_line(doc, "Palavras-chave: ", palavras_chave, font)


# ── Abstract (resumo em língua estrangeira) ────────────────────

def _add_abstract(doc: Document, abstract: str, keywords: list, font: str):
    _section_title(doc, "ABSTRACT", font)

    p = doc.add_paragraph(_one_paragraph(abstract))
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.first_line_indent = Cm(0)
    p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
    p.paragraph_format.line_spacing = R.LINE_SPACING_BODY
    for run in p.runs:
        run.font.name = font
        run.font.size = Pt(R.FONT_SIZE_BODY_PT)

    _keywords_line(doc, "Keywords: ", keywords or [], font)


def _keywords_line(doc: Document, label: str, terms: list, font: str):
    kw = doc.add_paragraph()
    kw.alignment = WD_ALIGN_PARAGRAPH.LEFT  # palavras-chave alinhadas à esquerda
    kw.paragraph_format.first_line_indent = Cm(0)
    # a "linha em branco" entre resumo e palavras-chave é espaço do parágrafo, não um parágrafo vazio
    kw.paragraph_format.space_before = Pt(R.SPACE_BEFORE_KEYWORDS_PT)
    r_bold = kw.add_run(label)
    r_bold.bold = True
    r_bold.font.name = font
    r_bold.font.size = Pt(R.FONT_SIZE_BODY_PT)
    r_kw = kw.add_run("; ".join(terms) + ("." if terms else ""))
    r_kw.font.name = font
    r_kw.font.size = Pt(R.FONT_SIZE_BODY_PT)


# ── Sumário (campo TOC real, NBR 6027) ─────────────────────────

def _add_table_of_contents(doc: Document, sections: list, has_refs: bool, font: str):
    """Insere um campo de Sumário real (TOC) que Word/LibreOffice atualizam a
    partir dos níveis de tópico (outlineLvl) das seções, com numeração de página.

    O RESULTADO EM CACHE do campo já contém as entradas (nº + título) das seções,
    pois a conversão headless para PDF (LibreOffice/--convert-to e o fallback
    ReportLab) NÃO atualiza campos — então o cache é o que aparece no PDF.
    Ao abrir o .docx, o campo é recalculado e ganha os números de página."""
    _section_title(doc, "SUMÁRIO", font)

    entries = []  # (nível, texto)
    for i, sec in enumerate(sections, start=1):
        entries.append((0, f"{i} {sec.title.upper()}"))
        for j, sub in enumerate(getattr(sec, "subsections", []) or [], start=1):
            entries.append((1, f"{i}.{j} {sub.title.upper()}"))
    if has_refs:
        entries.append((0, R.REFERENCES_TITLE))

    _emit_toc_field(doc, entries, font)
    _enable_update_fields(doc)


def _emit_toc_field(doc: Document, entries: list, font: str):
    """Campo TOC cujo resultado em cache são parágrafos com as entradas.
    Estrutura: fldChar(begin) instrText fldChar(separate) <entradas> fldChar(end)."""
    instr = ' TOC \\o "1-3" \\h \\z \\u '

    if not entries:
        entries = [(0, "")]

    paras = []
    for level, _text in entries:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.first_line_indent = Cm(0)
        if level > 0:
            p.paragraph_format.left_indent = Cm(0.75 * level)
        paras.append(p)

    # abertura do campo no início do 1º parágrafo
    _field_char_run(paras[0], "begin", font)
    _instr_run(paras[0], instr, font)
    _field_char_run(paras[0], "separate", font)

    # resultado em cache: as entradas (uma por parágrafo)
    for (_level, text), p in zip(entries, paras):
        r = p.add_run(text)
        r.font.name = font
        r.font.size = Pt(R.FONT_SIZE_BODY_PT)

    # fechamento do campo no fim do último parágrafo
    _field_char_run(paras[-1], "end", font)


def _field_char_run(paragraph, char_type: str, font: str):
    r = paragraph.add_run()
    r.font.name = font
    r.font.size = Pt(R.FONT_SIZE_BODY_PT)
    fld = OxmlElement('w:fldChar')
    fld.set(qn('w:fldCharType'), char_type)
    r._r.append(fld)


def _instr_run(paragraph, text: str, font: str):
    r = paragraph.add_run()
    r.font.name = font
    r.font.size = Pt(R.FONT_SIZE_BODY_PT)
    instr = OxmlElement('w:instrText')
    instr.set(qn('xml:space'), 'preserve')
    instr.text = text
    r._r.append(instr)


def _enable_update_fields(doc: Document):
    """Marca os campos do documento para atualização ao abrir (popula o TOC com
    os números de página). Inserido na posição válida do CT_Settings."""
    settings = doc.settings.element
    el = settings.find(qn('w:updateFields'))
    if el is None:
        el = OxmlElement('w:updateFields')
        # w:updateFields precede compat/rsids/etc. no schema CT_Settings
        anchor = None
        for tag in ('w:compat', 'w:rsids', 'w:mathPr', 'w:themeFontLang'):
            found = settings.find(qn(tag))
            if found is not None:
                anchor = found
                break
        if anchor is not None:
            anchor.addprevious(el)
        else:
            settings.append(el)
    el.set(qn('w:val'), 'true')


def _set_outline_level(paragraph, level: int):
    """Define o nível de tópico do parágrafo (entra no sumário sem alterar o
    visual ABNT do título)."""
    pPr = paragraph._p.get_or_add_pPr()
    el = pPr.find(qn('w:outlineLvl'))
    if el is None:
        el = OxmlElement('w:outlineLvl')
        # outlineLvl precede rPr/sectPr/pPrChange no schema CT_PPr
        anchor = None
        for tag in ('w:rPr', 'w:sectPr', 'w:pPrChange'):
            found = pPr.find(qn(tag))
            if found is not None:
                anchor = found
                break
        if anchor is not None:
            anchor.addprevious(el)
        else:
            pPr.append(el)
    el.set(qn('w:val'), str(level))


# ── Seções do corpo ────────────────────────────────────────────

def _add_body_section(doc: Document, section_data, number: int, font: str, counters: dict = None):
    title_text = f"{number} {section_data.title.upper()}"
    _section_title(doc, title_text, font, outline_level=0)

    for block in _normalize_blocks(section_data.content):
        _add_paragraph(doc, block, font, counters)

    for j, sub in enumerate(section_data.subsections, start=1):
        sub_title = f"{number}.{j} {sub.title.upper()}"
        _subsection_title(doc, sub_title, font)
        for block in _normalize_blocks(sub.content):
            _add_paragraph(doc, block, font, counters)


def _add_paragraph(doc: Document, text: str, font: str, counters: dict = None):
    if not text.strip():
        return
    if counters is not None and _is_table_block(text):
        _add_table_block(doc, text, font, counters)
        return
    if counters is not None and _is_figure(text):
        _add_figure(doc, text, font, counters)
        return
    text = _one_line(text)  # \n nunca entra num run
    if _is_long_quote(text):
        _add_long_quote(doc, text, font)
    else:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY  # corpo justificado (NBR 14724)
        p.paragraph_format.first_line_indent = Cm(R.PARAGRAPH_INDENT_CM)
        p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
        p.paragraph_format.line_spacing = R.LINE_SPACING_BODY
        _add_runs(p, text, font, R.FONT_SIZE_BODY_PT)


# Ênfase inline do editor (barra estilo Word do chat único): **negrito** e *itálico*. O marcador só vale
# colado no texto (`*x*`, nunca `* x *`), pra um asterisco solto ("p < 0,05*") continuar literal.
_EMPHASIS_RE = re.compile(r"\*\*(\S(?:.*?\S)?)\*\*|\*(\S(?:.*?\S)?)\*")


def _emphasis_spans(text: str):
    """[(trecho, negrito, itálico)] — o texto sem os marcadores, na ordem."""
    out, pos = [], 0
    for m in _EMPHASIS_RE.finditer(text):
        if m.start() > pos:
            out.append((text[pos:m.start()], False, False))
        out.append((m.group(1), True, False) if m.group(1) is not None else (m.group(2), False, True))
        pos = m.end()
    if pos < len(text):
        out.append((text[pos:], False, False))
    return out or [(text, False, False)]


def _add_runs(p, text: str, font: str, size_pt: float):
    for trecho, negrito, italico in _emphasis_spans(text):
        run = p.add_run(trecho)
        run.font.name = font
        run.font.size = Pt(size_pt)
        if negrito:
            run.bold = True
        if italico:
            run.italic = True


def _add_long_quote(doc: Document, text: str, font: str):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.first_line_indent = Cm(0)
    p.paragraph_format.left_indent = Cm(R.LONG_QUOTE_INDENT_CM)
    p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
    p.paragraph_format.space_before = Pt(R.SPACE_BEFORE_TITLE_PT)
    p.paragraph_format.space_after  = Pt(R.SPACE_AFTER_TITLE_PT)
    _add_runs(p, _strip_quotes(text), font, R.FONT_SIZE_QUOTE_PT)  # citação longa não leva aspas (NBR 10520)


_QUOTE_CHARS_OPEN  = ('"', '“', '‘', '«')
_QUOTE_CHARS_CLOSE = ('"', '”', '’', '»')


def _is_quotation(text: str) -> bool:
    return text.strip()[:1] in _QUOTE_CHARS_OPEN


def _strip_quotes(text: str) -> str:
    t = text.strip()
    if t[:1] in _QUOTE_CHARS_OPEN:
        t = t[1:]
    if t[-1:] in _QUOTE_CHARS_CLOSE:
        t = t[:-1]
    return t.strip()


def _estimate_lines(text: str) -> int:
    """Estima o número de linhas renderizadas (largura útil ≈ 90 chars/linha)."""
    import math
    total = 0
    for line in text.split("\n"):
        total += max(1, math.ceil(len(line) / R.CHARS_PER_LINE))
    return total


def _is_long_quote(text: str) -> bool:
    """Citação direta longa = é uma citação (marcada por aspas) E ultrapassa 3
    linhas (NBR 10520). O marcador de aspas evita que prosa comum longa seja
    tratada como bloco de citação."""
    return _is_quotation(text) and _estimate_lines(text.strip()) > R.LONG_QUOTE_MIN_LINES


# ── Normalização do conteúdo (a raiz do "espaçamento esquisito") ──
# O conteúdo chega do editor, do LLM ou colado de outro lugar: \r\n, \n soltos no meio
# da frase, 3+ quebras seguidas. Antes, só "\n\n" separava parágrafos e o resto do
# \n ia LITERAL pro run (o Word renderiza isso de forma inconsistente). Agora todo
# bloco sai limpo: um parágrafo por bloco, nenhum \n dentro de run, nada vazio.
_LIST_ITEM_RE = re.compile(r'^([-*•–]\s+|\d{1,3}[.)]\s+|[a-z][)]\s+)')
_TERMINAL_RE = re.compile(r'[.!?:;…"”»]$')
_ZERO_WIDTH_RE = re.compile('[\u200b-\u200d\ufeff]')


def _one_line(text: str) -> str:
    """Colapsa qualquer quebra/espaço repetido num espaço único."""
    return re.sub(r'\s+', ' ', _ZERO_WIDTH_RE.sub('', text or '')).strip()


def _one_paragraph(text: str) -> str:
    """Resumo/abstract: parágrafo único (NBR 6028), venha como vier."""
    return " ".join(_normalize_blocks(text))


def _normalize_blocks(content: str) -> list:
    """Divide o conteúdo em parágrafos limpos.

    - Linha(s) em branco SEMPRE separam blocos (3+ quebras = 1 separação).
    - Dentro de um bloco, \n simples: se a linha anterior termina em pontuação final,
      começa parágrafo novo; senão é quebra "mole" (texto colado/LLM) e vira espaço.
      Item de lista e marcador de figura sempre ficam em parágrafo próprio; citação
      aberta com aspas só fecha quando as aspas fecham.
    - Bloco de %%tabela/%%quadro mantém as linhas (são as linhas da tabela).
    """
    text = (content or "").replace("\r\n", "\n").replace("\r", "\n").replace("\t", " ")
    text = _ZERO_WIDTH_RE.sub("", text)
    raw_blocks = re.split(r'\n[ \u00a0]*\n', text)
    out = []
    for raw in raw_blocks:
        lines = [ln.strip() for ln in raw.split("\n") if ln.strip()]
        if not lines:
            continue
        if _is_table_block(lines[0]):
            out.append("\n".join(lines))
            continue
        cur = []
        for ln in lines:
            starts_new = (
                not cur
                or _LIST_ITEM_RE.match(ln)
                or _is_figure(ln)
                or _is_figure(" ".join(cur))
                or _is_table_block(ln)
            )
            if not starts_new:
                joined = " ".join(cur)
                in_open_quote = _is_quotation(joined) and joined[-1:] not in _QUOTE_CHARS_CLOSE
                starts_new = bool(_TERMINAL_RE.search(joined)) and not in_open_quote
            if starts_new and cur:
                out.append(_one_line(" ".join(cur)))
                cur = []
            cur.append(ln)
        if cur:
            out.append(_one_line(" ".join(cur)))
    return [b for b in out if b]


# ── Figuras / Ilustrações (NBR 14724:2024) ─────────────────────
# Marcador (markdown estendido):  ![Título|Fonte](url)
#   - "Fonte" é opcional; "própria"/"autor" → "elaborado pelo próprio autor".
_FIGURE_RE = re.compile(r'^!\[(?P<alt>.*?)\]\((?P<url>\S+?)\)$', re.DOTALL)
_OWN_WORK_TOKENS = {
    "própria", "propria", "autor", "autoral", "own",
    "elaboração própria", "elaboracao propria", "elaborado pelo autor",
    "elaborado pelo próprio autor", "elaborado pelo proprio autor",
}


def _is_figure(text: str) -> bool:
    return bool(_FIGURE_RE.match(text.strip()))


def _add_figure(doc: Document, text: str, font: str, counters: dict):
    m = _FIGURE_RE.match(text.strip())
    alt, url = m.group("alt"), m.group("url")
    title, _, fonte_raw = alt.partition("|")
    counters["figura"] = counters.get("figura", 0) + 1
    number = counters["figura"]

    # Legenda no TOPO: "Figura N – Título" (travessão, sem ponto final), 10pt, centralizada
    cap = doc.add_paragraph()
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap.paragraph_format.first_line_indent = Cm(0)
    cap.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
    cap.paragraph_format.space_before = Pt(R.SPACE_BEFORE_TITLE_PT)
    r = cap.add_run(f"{R.FIGURE_LABEL} {number}{R.FIGURE_CAPTION_DELIM}{title.strip()}")
    r.font.name = font
    r.font.size = Pt(R.FONT_SIZE_SMALL_PT)

    # Imagem centralizada (degrada para um aviso se o download/decodificação falhar)
    img = doc.add_paragraph()
    img.alignment = WD_ALIGN_PARAGRAPH.CENTER
    img.paragraph_format.first_line_indent = Cm(0)
    run = img.add_run()
    try:
        stream = _load_image(url)
        shape = run.add_picture(stream)
        max_w = Cm(R.IMAGE_MAX_WIDTH_CM)
        if shape.width and shape.width > max_w:
            ratio = max_w / shape.width
            shape.width = int(shape.width * ratio)
            shape.height = int(shape.height * ratio)
    except Exception:
        run.text = "[imagem indisponível]"
        run.font.name = font
        run.font.size = Pt(R.FONT_SIZE_SMALL_PT)

    # Fonte na PARTE INFERIOR: "Fonte: ...", 10pt, centralizada
    src = doc.add_paragraph()
    src.alignment = WD_ALIGN_PARAGRAPH.CENTER
    src.paragraph_format.first_line_indent = Cm(0)
    src.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
    src.paragraph_format.space_after = Pt(R.SPACE_AFTER_TITLE_PT)
    rs = src.add_run(_figure_source(fonte_raw, counters.get("year")))
    rs.font.name = font
    rs.font.size = Pt(R.FONT_SIZE_SMALL_PT)


def _figure_source(fonte_raw: str, year: str = None) -> str:
    return _source_line(fonte_raw, year, R.SOURCE_OWN_WORK)


def _source_line(fonte_raw: str, year: str, own_phrase: str) -> str:
    f = (fonte_raw or "").strip()
    if not f or f.lower() in _OWN_WORK_TOKENS:
        suffix = f" ({year})" if year else ""
        return f"Fonte: {own_phrase}{suffix}."
    if not f.lower().startswith("fonte"):
        f = "Fonte: " + f
    if not f.endswith("."):
        f += "."
    return f


def _load_image(url: str) -> io.BytesIO:
    url = url.strip()
    if url.startswith("data:"):
        _, _, b64 = url.partition(",")
        return io.BytesIO(base64.b64decode(b64))
    if url.startswith("http://") or url.startswith("https://"):
        req = urllib.request.Request(url, headers={"User-Agent": "ZaeonABNT/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:  # noqa: S310 (esquema validado acima)
            data = resp.read(R.IMAGE_MAX_BYTES + 1)
        if len(data) > R.IMAGE_MAX_BYTES:
            raise ValueError("imagem excede o tamanho máximo")
        return io.BytesIO(data)
    raise ValueError("esquema de URL de imagem não suportado")


# ── Tabelas (IBGE) e Quadros (NBR 14724:2024) ──────────────────
# Marcador no texto:
#   %%tabela Título da tabela
#   %%fonte dados da pesquisa (2026)        (opcional; "própria" → autor)
#   | Cabeçalho A | Cabeçalho B |
#   | --- | --- |                            (linha separadora opcional, ignorada)
#   | dado | dado |
#   (use %%quadro para um quadro fechado, dado qualitativo)
_TABLE_DIRECTIVE_RE = re.compile(r'^%%(tabela|quadro)\b', re.I)


def _is_table_block(text: str) -> bool:
    return bool(_TABLE_DIRECTIVE_RE.match(text.strip()))


def _parse_table_block(text: str):
    lines = text.strip().split("\n")
    m = re.match(r'^%%(tabela|quadro)\s*(.*)$', lines[0].strip(), re.I)
    kind = m.group(1).lower()
    title = m.group(2).strip()
    rest = lines[1:]

    fonte_raw = None
    if rest and re.match(r'^%%fonte\b', rest[0].strip(), re.I):
        fonte_raw = re.sub(r'^%%fonte\s*', '', rest[0].strip(), flags=re.I).strip()
        rest = rest[1:]

    rows = []
    for line in rest:
        s = line.strip()
        if '|' not in s:
            continue
        cells = [c.strip() for c in s.strip().strip('|').split('|')]
        non_empty = [c for c in cells if c]
        # ignora linha separadora markdown (ex.: | --- | :--: |)
        if non_empty and all(re.fullmatch(r':?-{2,}:?', c) for c in non_empty):
            continue
        rows.append(cells)
    return kind, title, fonte_raw, rows


def _add_table_block(doc: Document, text: str, font: str, counters: dict):
    kind, title, fonte_raw, rows = _parse_table_block(text)
    if not rows:
        return

    label = R.TABLE_LABEL if kind == "tabela" else R.QUADRO_LABEL
    counters[kind] = counters.get(kind, 0) + 1
    number = counters[kind]

    # Legenda no topo (acompanha a margem esquerda da tabela), 10pt
    cap = doc.add_paragraph()
    cap.alignment = WD_ALIGN_PARAGRAPH.LEFT
    cap.paragraph_format.first_line_indent = Cm(0)
    cap.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
    cap.paragraph_format.space_before = Pt(R.SPACE_BEFORE_TITLE_PT)
    rc = cap.add_run(f"{label} {number}{R.FIGURE_CAPTION_DELIM}{title}")
    rc.font.name = font
    rc.font.size = Pt(R.FONT_SIZE_SMALL_PT)

    ncols = max(len(r) for r in rows)
    table = doc.add_table(rows=len(rows), cols=ncols)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    if kind == "quadro":
        table.style = "Table Grid"  # caixa fechada (todas as bordas)

    for i, r in enumerate(rows):
        for j in range(ncols):
            value = r[j] if j < len(r) else ""
            _fill_cell(table.cell(i, j), value, font, bold=(i == 0))

    if kind == "tabela":
        _apply_ibge_borders(table)  # só traços horizontais (topo/cabeçalho/base)

    # Fonte no rodapé, 10pt
    own = R.SOURCE_OWN_WORK_F if kind == "tabela" else R.SOURCE_OWN_WORK
    src = doc.add_paragraph()
    src.alignment = WD_ALIGN_PARAGRAPH.LEFT
    src.paragraph_format.first_line_indent = Cm(0)
    src.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
    src.paragraph_format.space_after = Pt(R.SPACE_AFTER_TITLE_PT)
    rs = src.add_run(_source_line(fonte_raw, counters.get("year"), own))
    rs.font.name = font
    rs.font.size = Pt(R.FONT_SIZE_SMALL_PT)


def _fill_cell(cell, value: str, font: str, bold: bool = False):
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.first_line_indent = Cm(0)
    run = p.add_run(value)
    run.font.name = font
    run.font.size = Pt(R.FONT_SIZE_TABLE_PT)
    run.bold = bold


def _apply_ibge_borders(table):
    """Tabela IBGE: somente três traços horizontais (topo, sob o cabeçalho,
    base); nenhuma borda vertical/lateral."""
    for cell in table.rows[0].cells:
        _set_cell_borders(cell, top=True, bottom=True)   # topo + sob cabeçalho
    for cell in table.rows[-1].cells:
        _set_cell_borders(cell, bottom=True)             # base


def _set_cell_borders(cell, top: bool = False, bottom: bool = False):
    tcPr = cell._tc.get_or_add_tcPr()
    tcBorders = tcPr.find(qn('w:tcBorders'))
    if tcBorders is None:
        tcBorders = OxmlElement('w:tcBorders')
        tcPr.append(tcBorders)
    for edge, on in (('top', top), ('bottom', bottom)):
        if not on:
            continue
        existing = tcBorders.find(qn(f'w:{edge}'))
        if existing is not None:
            tcBorders.remove(existing)
        el = OxmlElement(f'w:{edge}')
        el.set(qn('w:val'), 'single')
        el.set(qn('w:sz'), '4')
        el.set(qn('w:space'), '0')
        el.set(qn('w:color'), '000000')
        tcBorders.append(el)


# ── Referências ────────────────────────────────────────────────

def _add_appendices(doc: Document, itens: list, rotulo: str, font: str, counters: dict = None):
    """
    Elementos pós-textuais (NBR 14724 §4.2.10 e §4.2.11).

    APÊNDICE é material elaborado pelo próprio autor; ANEXO é material de terceiro. A
    norma trata os dois igual na forma: cada um começa em página nova, é identificado por
    letra maiúscula consecutiva, travessão e o título — "APÊNDICE A — Questionário
    aplicado" — e o identificador é centralizado, em maiúsculas e negrito, como os títulos
    sem indicativo numérico.

    Travessão (—), não hífen: é a mesma regra que as legendas de figura já seguem aqui.

    Não entram no sumário por indicativo numérico, mas entram no sumário como itens sem
    número — por isso `outline_level=0` no parágrafo de identificação.

    Lista vazia não gera página em branco: o `if not itens` é o que garante isso, e é o
    caso normal, porque a maioria dos trabalhos não tem apêndice.
    """
    if not itens:
        return

    for i, item in enumerate(itens):
        doc.add_page_break()
        letra = _letra_do_indice(i)
        titulo = (getattr(item, "title", "") or "").strip()
        identificacao = f"{rotulo} {letra}" + (f" — {titulo}" if titulo else "")

        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.first_line_indent = Cm(0)
        p.paragraph_format.space_before = Pt(R.SPACE_BEFORE_TITLE_PT)
        p.paragraph_format.space_after = Pt(R.SPACE_AFTER_TITLE_PT)
        run = p.add_run(identificacao.upper())
        run.bold = True
        run.font.name = font
        run.font.size = Pt(R.FONT_SIZE_BODY_PT)
        _set_outline_level(p, 0)

        for bloco in _normalize_blocks(getattr(item, "content", "") or ""):
            _add_paragraph(doc, bloco, font, counters)


def _letra_do_indice(i: int) -> str:
    """
    0 -> A, 25 -> Z, 26 -> AA. A norma não prevê mais que 26, mas um trabalho com 27
    apêndices não pode derrubar a exportação — e "AA" é mais honesto que estourar o
    alfabeto e repetir "A".
    """
    letra = ""
    i += 1
    while i > 0:
        i, resto = divmod(i - 1, 26)
        letra = chr(ord("A") + resto) + letra
    return letra


def _add_references(doc: Document, references: list, font: str):
    _section_title(doc, R.REFERENCES_TITLE, font, outline_level=0)

    access_date = _today_abnt()
    ordered = sorted(references, key=_ref_sort_key)  # ordenação alfabética (NBR 6023)
    for ref in ordered:
        if getattr(ref, "title", None) or getattr(ref, "authors", None):
            _emit_structured_reference(doc, ref, font, access_date)
        else:
            _emit_text_reference(doc, ref.text, font)


def _new_reference_paragraph(doc: Document):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT  # referências à esquerda (NBR 6023)
    p.paragraph_format.first_line_indent = Cm(0)
    p.paragraph_format.left_indent = Cm(0)
    p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE  # espaço simples interno
    p.paragraph_format.space_after = R.SPACE_BETWEEN_REFS          # espaço entre entradas
    return p


def _emit_text_reference(doc: Document, text: str, font: str):
    p = _new_reference_paragraph(doc)
    run = p.add_run(text or "")
    run.font.name = font
    run.font.size = Pt(R.FONT_SIZE_BODY_PT)


def _emit_structured_reference(doc: Document, ref, font: str, access_date: str):
    """Formata uma referência conforme NBR 6023:2018 a partir de campos
    estruturados, com o DESTAQUE (negrito) no elemento correto: título da obra
    em monografias; título do periódico em artigos."""
    p = _new_reference_paragraph(doc)

    def run(text: str, bold: bool = False):
        r = p.add_run(text)
        r.font.name = font
        r.font.size = Pt(R.FONT_SIZE_BODY_PT)
        r.bold = bold

    authors = _abnt_authors(getattr(ref, "authors", []) or [])
    year = str(ref.year) if getattr(ref, "year", None) else "[s. d.]"
    title = (ref.title or "").strip().rstrip(".")
    venue = (ref.venue or "").strip().rstrip(".") if getattr(ref, "venue", None) else ""

    if authors:
        run(authors + (" " if authors.endswith(".") else ". "))  # evita "et al.."

    if venue:  # artigo de periódico: periódico em negrito, título do artigo normal
        if title:
            run(title + ". ")
        run(venue, bold=True)
        run(f", {year}.")
    else:      # monografia (livro/web/relatório): título em negrito
        if title:
            run(title, bold=True)
            run(". ")
        run(f"{year}.")

    if getattr(ref, "doi", None):
        run(f" DOI: {ref.doi.strip().rstrip('.')}.")
    elif getattr(ref, "url", None):
        ad = ref.access_date or access_date
        run(f" Disponível em: {ref.url.strip().rstrip('.')}. Acesso em: {ad}.")


# ── Formatação ABNT de autores (NBR 6023) ──────────────────────

def _abnt_author(name: str) -> str:
    """'João Silva' → 'SILVA, João'; 'Doudna J' → 'DOUDNA, J'."""
    tokens = name.strip().split()
    if not tokens:
        return ""
    if len(tokens) == 1:
        return tokens[0].upper()
    last = tokens[-1]
    stripped = last.replace(".", "")
    is_initials = (
        re.fullmatch(r"[A-Z]{1,3}", stripped) is not None
        and re.fullmatch(r"[A-Z.]{1,4}", last) is not None
        and len(tokens[0]) > 1
    )
    if is_initials:  # estilo "Sobrenome Iniciais" (PubMed)
        return f"{tokens[0].upper()}, {' '.join(tokens[1:])}"
    return f"{last.upper()}, {' '.join(tokens[:-1])}"


def _abnt_authors(authors: list) -> str:
    cleaned = [a.strip() for a in authors if a and a.strip()]
    if not cleaned:
        return ""
    if len(cleaned) > 3:  # 4+ autores → primeiro + et al.
        return f"{_abnt_author(cleaned[0])} et al."
    return "; ".join(_abnt_author(a) for a in cleaned)


def _ref_sort_key(ref) -> str:
    authors = getattr(ref, "authors", None)
    if authors:
        return _abnt_authors(authors).lower()
    if getattr(ref, "title", None):
        return ref.title.lower()
    return (getattr(ref, "text", "") or "").lower()


def _today_abnt() -> str:
    import datetime
    months = ["jan.", "fev.", "mar.", "abr.", "maio", "jun.",
              "jul.", "ago.", "set.", "out.", "nov.", "dez."]
    d = datetime.date.today()
    return f"{d.day} {months[d.month - 1]} {d.year}"


# ── Títulos ────────────────────────────────────────────────────

def _section_title(doc: Document, title: str, font: str, outline_level: int = None):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.first_line_indent = Cm(0)
    p.paragraph_format.space_before = Pt(R.SPACE_BEFORE_TITLE_PT)
    p.paragraph_format.space_after  = Pt(R.SPACE_AFTER_TITLE_PT)
    run = p.add_run(title.upper())
    run.bold = True
    run.font.name = font
    run.font.size = Pt(R.FONT_SIZE_BODY_PT)
    if outline_level is not None:  # entra no sumário (somente seções do texto)
        _set_outline_level(p, outline_level)


def _subsection_title(doc: Document, title: str, font: str, outline_level: int = 1):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.first_line_indent = Cm(0)
    p.paragraph_format.space_before = Pt(R.SPACE_BEFORE_TITLE_PT)
    p.paragraph_format.space_after  = Pt(R.SPACE_AFTER_TITLE_PT)
    run = p.add_run(title.upper())
    run.bold = False   # subtítulos: sem negrito (NBR 14724)
    run.font.name = font
    run.font.size = Pt(R.FONT_SIZE_BODY_PT)
    if outline_level is not None:
        _set_outline_level(p, outline_level)


# ── Numeração de páginas ───────────────────────────────────────

def _add_page_numbers(doc: Document):
    """Numeração no canto superior direito, visível SOMENTE na parte textual
    (última seção). Capa e pré-textuais ficam sem número (NBR 14724)."""
    last = len(doc.sections) - 1
    for i, section in enumerate(doc.sections):
        header = section.header
        header.is_linked_to_previous = False
        for para in header.paragraphs:
            para.clear()
        p = header.paragraphs[0] if header.paragraphs else header.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        p.paragraph_format.first_line_indent = Cm(0)

        if i != last:
            continue  # capa e pré-textuais: header vazio (sem número)

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
