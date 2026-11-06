# -*- coding: utf-8 -*-
"""去掉正文首行缩进：段落层与样式层的 w:firstLine / w:firstLineChars 一律清零。"""
import sys
from docx import Document
from docx.oxml.ns import qn


def clean(ind):
    hit = False
    if ind.get(qn('w:firstLineChars')) is not None:
        del ind.attrib[qn('w:firstLineChars')]
        hit = True
    if ind.get(qn('w:firstLine')) != '0':
        ind.set(qn('w:firstLine'), '0')
        hit = True
    return hit


def main(path):
    doc = Document(path)
    n = 0
    for p in doc.element.body.iter(qn('w:p')):
        pPr = p.find(qn('w:pPr'))
        if pPr is None:
            continue
        ind = pPr.find(qn('w:ind'))
        if ind is None:
            continue
        if clean(ind):
            n += 1
        if len(ind.attrib) == 0 and len(ind) == 0:
            pPr.remove(ind)

    ns = 0
    for style in doc.styles.element.findall(qn('w:style')):
        pPr = style.find(qn('w:pPr'))
        if pPr is None:
            continue
        ind = pPr.find(qn('w:ind'))
        if ind is not None and clean(ind):
            ns += 1
        if ind is not None and len(ind.attrib) == 0 and len(ind) == 0:
            pPr.remove(ind)

    doc.save(path)
    print('paras', n, 'styles', ns)


if __name__ == '__main__':
    main(sys.argv[1])
