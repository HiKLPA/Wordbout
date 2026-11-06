# -*- coding: utf-8 -*-
"""中标题（19 号字以下的一级标题）与「目录」二字、以及目录里的一级条目改为主题红 #BE4B3E。"""
import re
import sys
from docx import Document
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

RED = 'BE4B3E'
W_T = qn('w:t')


def rpr_of(r):
    rPr = r.find(qn('w:rPr'))
    if rPr is None:
        rPr = OxmlElement('w:rPr')
        r.insert(0, rPr)
    return rPr


AFTER = ('w:spacing', 'w:w', 'w:kern', 'w:position', 'w:sz', 'w:szCs', 'w:highlight',
         'w:u', 'w:effect', 'w:bdr', 'w:shd', 'w:fitText', 'w:vertAlign', 'w:rtl',
         'w:cs', 'w:em', 'w:lang', 'w:eastAsianLayout', 'w:specVanish', 'w:oMath')


def set_color(run, val=RED):
    rPr = rpr_of(run)
    c = rPr.find(qn('w:color'))
    if c is None:
        c = OxmlElement('w:color')
        anchor = None
        for tag in AFTER:
            anchor = rPr.find(qn(tag))
            if anchor is not None:
                break
        if anchor is not None:
            anchor.addprevious(c)
        else:
            rPr.append(c)
    c.set(qn('w:val'), val)


def color_all(p):
    n = 0
    for r in p.iter(qn('w:r')):
        set_color(r)
        n += 1
    pPr = p.find(qn('w:pPr'))
    if pPr is not None:
        mk = pPr.find(qn('w:rPr'))
        if mk is not None:
            set_color(mk)
    return n


def color_title_part(p):
    """目录项：只染 tab 之前的标题文字"""
    n = 0
    for r in p.iter(qn('w:r')):
        tabs = r.findall(qn('w:tab'))
        if tabs:
            break
        if r.find(W_T) is not None:
            set_color(r)
            n += 1
    return n


def main(path):
    doc = Document(path)
    nh = nt = nc = 0
    for p in doc.paragraphs:
        st = p.style
        name = st.name if st is not None else ''
        text = p.text.strip()
        if name == 'Heading 1':
            nh += 1
            color_all(p._p)
        elif text == '目录':
            nc += 1
            color_all(p._p)
        elif name == 'toc 1':
            # 附录 A–D 在正文里是小标题（Heading 2），目录保持其本色，避免与正文不一致
            if re.match(r'^[A-Z] ', text):
                continue
            nt += 1
            color_title_part(p._p)
    doc.save(path)
    print('h1', nh, 'toc-title', nc, 'toc1', nt)


if __name__ == '__main__':
    main(sys.argv[1])
