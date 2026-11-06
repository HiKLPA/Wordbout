# -*- coding: utf-8 -*-
"""把正文文字统一成思源黑体 Medium。

覆盖范围：Normal 样式的正文段落、表格单元格、封面信息行。
不动：中标题（Heading 1）、小标题（Heading 2）、目录条目、页眉页脚。
做法：run 级 rFonts 的 ascii / hAnsi / eastAsia / cs 全部指向 思源黑体 Medium，
段落标记 rPr 与 Normal 样式同步，避免空行、段落尾部继承回旧字体。
"""
import sys

from docx import Document
from docx.oxml.ns import qn

FONT = '思源黑体 Medium'
HEAD_STYLES = {'2', '3'}      # Heading 1 / Heading 2
TOC_STYLES = {'4', '5'}       # toc 1 / toc 2


def set_fonts(rpr):
    rf = rpr.find(qn('w:rFonts'))
    if rf is None:
        rf = rpr.makeelement(qn('w:rFonts'), {})
        rpr.insert(0, rf)
    rf.set(qn('w:ascii'), FONT)
    rf.set(qn('w:hAnsi'), FONT)
    rf.set(qn('w:eastAsia'), FONT)
    rf.set(qn('w:cs'), FONT)
    rf.set(qn('w:hint'), 'eastAsia')


def para_style(p):
    pPr = p.find(qn('w:pPr'))
    ps = pPr.find(qn('w:pStyle')) if pPr is not None else None
    return ps.get(qn('w:val')) if ps is not None else None


def run_text(r):
    return ''.join(t.text or '' for t in r.iter(qn('w:t')))


def main(path):
    doc = Document(path)
    body = doc.element.body
    touched = {'run': 0, 'mark': 0}

    for p in body.iter(qn('w:p')):
        if para_style(p) in HEAD_STYLES or para_style(p) in TOC_STYLES:
            continue
        for r in p.iter(qn('w:r')):
            if not run_text(r).strip():
                continue
            rpr = r.find(qn('w:rPr'))
            if rpr is None:
                rpr = r.makeelement(qn('w:rPr'), {})
                r.insert(0, rpr)
            set_fonts(rpr)
            touched['run'] += 1
        # 段落标记
        pPr = p.find(qn('w:pPr'))
        if pPr is not None:
            rpr = pPr.find(qn('w:rPr'))
            if rpr is not None:
                set_fonts(rpr)
                touched['mark'] += 1

    # Normal 样式兜底
    for s in doc.styles.element.findall(qn('w:style')):
        name = s.find(qn('w:name'))
        if name is None or name.get(qn('w:val')) not in ('Normal',):
            continue
        rPr = s.find(qn('w:rPr'))
        if rPr is not None:
            set_fonts(rPr)

    doc.save(path)
    print('done', path, touched)


if __name__ == '__main__':
    main(sys.argv[1])
