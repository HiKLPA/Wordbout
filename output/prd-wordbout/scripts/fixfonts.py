# -*- coding: utf-8 -*-
import re, sys, copy
from docx import Document
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

DIG = re.compile(r'\d+(?:[.,:/\-\u2013\u2014]\d+)*%?')
SERIF = '思源宋体'
SERIF_M = '思源宋体 Medium'
SERIF_B = '思源宋体 Bold'

def rpr_of(r):
    rPr = r.find(qn('w:rPr'))
    if rPr is None:
        rPr = OxmlElement('w:rPr')
        r.insert(0, rPr)
    return rPr

def set_font(r, name):
    rPr = rpr_of(r)
    rf = rPr.find(qn('w:rFonts'))
    if rf is None:
        rf = OxmlElement('w:rFonts')
        rPr.insert(0, rf)
    for a in ('w:ascii', 'w:hAnsi', 'w:cs'):
        rf.set(qn(a), name)

def drop_bold(r):
    rPr = r.find(qn('w:rPr'))
    if rPr is None:
        return
    for tag in ('w:b', 'w:bCs'):
        e = rPr.find(qn(tag))
        if e is not None:
            rPr.remove(e)

def has_bold(r):
    rPr = r.find(qn('w:rPr'))
    if rPr is None:
        return False
    e = rPr.find(qn('w:b'))
    if e is None:
        return False
    return e.get(qn('w:val')) not in ('0', 'false')

def run_text(r):
    return ''.join(t.text or '' for t in r.findall(qn('w:t')))

def set_text(r, txt):
    ts = r.findall(qn('w:t'))
    for t in ts[1:]:
        r.remove(t)
    if ts:
        t = ts[0]
    else:
        t = OxmlElement('w:t')
        r.append(t)
    t.text = txt
    t.set(qn('xml:space'), 'preserve')

def split_digits(r, para_mode):
    """para_mode: 'heading' | 'body'"""
    txt = run_text(r)
    if not txt:
        return 0
    kids = [k.tag for k in r if k.tag != qn('w:rPr')]
    if any(k != qn('w:t') for k in kids):
        return 0
    segs = []
    last = 0
    for m in DIG.finditer(txt):
        if m.start() > last:
            segs.append((txt[last:m.start()], False))
        segs.append((m.group(0), True))
        last = m.end()
    if last < len(txt):
        segs.append((txt[last:], False))
    if not segs:
        return 0
    bold = has_bold(r)
    if para_mode == 'heading':
        dfont = SERIF_M
    elif bold:
        dfont = SERIF_B
    else:
        dfont = SERIF
    made = 0
    for text, isdig in segs:
        new = copy.deepcopy(r)
        set_text(new, text)
        if para_mode == 'heading':
            drop_bold(new)
        if isdig:
            set_font(new, dfont)
            if bold and para_mode != 'heading':
                drop_bold(new)
        r.addprevious(new)
        made += 1
    r.getparent().remove(r)
    return made

def style_id(p):
    pPr = p._p.find(qn('w:pPr'))
    if pPr is None:
        return None
    ps = pPr.find(qn('w:pStyle'))
    return ps.get(qn('w:val')) if ps is not None else None

def max_sz(p):
    v = 0
    for r in p._p.findall(qn('w:r')):
        rPr = r.find(qn('w:rPr'))
        if rPr is None:
            continue
        sz = rPr.find(qn('w:sz'))
        if sz is not None:
            try:
                v = max(v, int(sz.get(qn('w:val'))))
            except Exception:
                pass
    return v

def iter_paras(doc):
    for p in doc.paragraphs:
        yield p
    for t in doc.tables:
        for row in t.rows:
            for cell in row.cells:
                for p in cell.paragraphs:
                    yield p
                for t2 in cell.tables:
                    for row2 in t2.rows:
                        for c2 in row2.cells:
                            for p in c2.paragraphs:
                                yield p

def main(path):
    doc = Document(path)
    heads = {'000006', '000007', '000008'}
    n_head = n_split = n_para = 0
    for p in iter_paras(doc):
        sid = style_id(p)
        mode = 'heading' if sid in heads else 'body'
        cover = (sid is None and max_sz(p) >= 44 and 'COVER' not in '')
        if cover:
            mode = 'heading'
        if mode == 'heading':
            n_head += 1
        for r in list(p._p.findall(qn('w:r'))):
            if r.findall(qn('w:fldChar')) or r.findall(qn('w:instrText')):
                continue
            n = split_digits(r, mode)
            if n:
                n_para += 1
                n_split += max(0, n - 1)
    # 页眉页脚
    for s in doc.sections:
        for part in (s.header, s.footer):
            for p in part.paragraphs:
                for r in list(p._p.findall(qn('w:r'))):
                    if r.findall(qn('w:fldChar')) or r.findall(qn('w:instrText')):
                        continue
                    split_digits(r, 'body')
    doc.save(path)
    print('headings', n_head, 'runs split', n_split, 'paras touched', n_para)

if __name__ == '__main__':
    main(sys.argv[1])
