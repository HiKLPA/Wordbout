# -*- coding: utf-8 -*-
"""修复 V1.7 用户版的两处丢失，并去掉正文首行缩进：
1) 页眉（左标题 + 右版本，小五 9pt 灰字）与页脚页码（居中，9pt 灰字）在另存后变成空部件，重建
2) 正文起始节页码从 1 重新计数（封面与目录不显示页码）
3) 全文段落与样式层的首行缩进清零
"""
import sys
from docx import Document
from docx.shared import Pt, Twips, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

SANS = '思源黑体'
GRAY = RGBColor(0x8A, 0x8A, 0x8A)
SIZE = Pt(9)
TAB_RIGHT = 8306          # 版心宽 11906-1800-1800
TITLE = 'Wordbout产品需求文档'
VERSION = 'PRD V1.7'


def page_field(par):
    fld = OxmlElement('w:fldSimple')
    fld.set(qn('w:instr'), ' PAGE ')
    r = OxmlElement('w:r')
    rPr = OxmlElement('w:rPr')
    rf = OxmlElement('w:rFonts')
    for a in ('w:ascii', 'w:hAnsi', 'w:cs'):
        rf.set(qn(a), SANS)
    rPr.append(rf)
    color = OxmlElement('w:color')
    color.set(qn('w:val'), '8A8A8A')
    rPr.append(color)
    for tag in ('w:sz', 'w:szCs'):
        el = OxmlElement(tag)
        el.set(qn('w:val'), '18')
        rPr.append(el)
    r.append(rPr)
    t = OxmlElement('w:t')
    t.text = '1'
    r.append(t)
    fld.append(r)
    par._p.append(fld)


def main(path):
    doc = Document(path)
    sec = doc.sections[2]

    # 页眉
    sec.header.is_linked_to_previous = False
    h = sec.header
    hp = h.paragraphs[0]
    for r in list(hp.runs):
        r._element.getparent().remove(r._element)
    hp.paragraph_format.tab_stops.add_tab_stop(Twips(TAB_RIGHT), WD_TAB_ALIGNMENT.RIGHT)
    r1 = hp.add_run(TITLE)
    hp.add_run('\t')
    r2 = hp.add_run(VERSION)
    for r in (r1, r2):
        r.font.size = SIZE
        r.font.name = SANS
        r.font.color.rgb = GRAY

    # 页脚页码
    sec.footer.is_linked_to_previous = False
    f = sec.footer
    fp = f.paragraphs[0]
    for r in list(fp.runs):
        r._element.getparent().remove(r._element)
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    page_field(fp)
    for r in fp.runs:
        r.font.size = SIZE
        r.font.name = SANS
        r.font.color.rgb = GRAY

    # 正文节页码从 1 起
    sectPr = sec._sectPr
    pn = sectPr.find(qn('w:pgNumType'))
    if pn is None:
        pn = OxmlElement('w:pgNumType')
        sectPr.append(pn)
    pn.set(qn('w:start'), '1')

    # 首行缩进清零
    n = 0
    for p in doc.element.body.iter(qn('w:p')):
        pPr = p.find(qn('w:pPr'))
        if pPr is None:
            continue
        ind = pPr.find(qn('w:ind'))
        if ind is None:
            continue
        if ind.get(qn('w:firstLineChars')) is not None:
            del ind.attrib[qn('w:firstLineChars')]
        if ind.get(qn('w:firstLine')) != '0':
            ind.set(qn('w:firstLine'), '0')
            n += 1
    for style in doc.styles.element.findall(qn('w:style')):
        pPr = style.find(qn('w:pPr'))
        if pPr is None:
            continue
        ind = pPr.find(qn('w:ind'))
        if ind is not None and ind.get(qn('w:firstLineChars')) is not None:
            del ind.attrib[qn('w:firstLineChars')]
            ind.set(qn('w:firstLine'), '0')

    doc.save(path)
    print('indent-cleared', n)


if __name__ == '__main__':
    main(sys.argv[1])
