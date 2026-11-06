# -*- coding: utf-8 -*-
"""把 Word 更新后的目录（标题 + 页码）回写到 docx 的 TOC 域缓存里。
用法：updatetoc.py docx toc_dump.txt
toc_dump.txt 为 Word 里 TablesOfContents(1).Range.Text 的原文，首行可带 PAGES=nn。
"""
import sys
from docx import Document
from docx.oxml.ns import qn

W_T = qn('w:t')


def load_dump(path):
    lines = open(path, encoding='utf-8-sig').read().splitlines()
    entries = []
    for line in lines:
        line = line.strip().strip('\x07')
        if not line or line.startswith('PAGES='):
            continue
        parts = line.split('\t')
        if len(parts) < 2:
            continue
        entries.append((parts[0].strip(), parts[-1].strip()))
    return entries


def toc_paras(doc):
    out = []
    for p in doc.element.body.iter(qn('w:p')):
        if 'PAGEREF' in ''.join(x.text or '' for x in p.iter(qn('w:instrText'))):
            out.append(p)
    return out


def split_par(p):
    """返回（标题区 w:t 列表，tab 之后的 w:t 列表）"""
    before, after, seen_tab = [], [], False
    for r in p.iter(qn('w:r')):
        for ch in r:
            if ch.tag == qn('w:tab'):
                seen_tab = True
            elif ch.tag == W_T:
                (after if seen_tab else before).append(ch)
    return before, after


def set_title(p, old, new):
    before, _ = split_par(p)
    cur = ''.join(t.text or '' for t in before)
    if cur.strip() != old:
        return False
    for i, t in enumerate(before):
        t.text = new if i == 0 else ''
        t.set(qn('xml:space'), 'preserve')
    return True


def set_page(p, num):
    """PAGEREF 域结果里的数字 run"""
    state = 0
    for r in p.iter(qn('w:r')):
        instr = r.find(qn('w:instrText'))
        if instr is not None and 'PAGEREF' in (instr.text or ''):
            state = 1
            continue
        fld = r.find(qn('w:fldChar'))
        if fld is not None and state == 1 and fld.get(qn('w:fldCharType')) == 'separate':
            state = 2
            continue
        if state == 2:
            t = r.find(W_T)
            if t is not None:
                t.text = num
                return True
            if fld is not None:
                return False
    return False


def main(path, dump):
    doc = Document(path)
    entries = load_dump(dump)
    paras = toc_paras(doc)
    if len(entries) != len(paras):
        print('WARN count mismatch', len(entries), len(paras))
    nt = np_ = 0
    for p, (title, page) in zip(paras, entries):
        before, after = split_par(p)
        cur = ''.join(t.text or '' for t in before).strip()
        curp = (after[-1].text or '').strip() if after else ''
        if cur != title and set_title(p, cur, title):
            nt += 1
        if curp != page and set_page(p, page):
            np_ += 1
    doc.save(path)
    print('titles', nt, 'pages', np_)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
