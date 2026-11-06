# -*- coding: utf-8 -*-
"""PRD 交付前统一排版：
1) 全文去加粗
2) 全文单倍行距（w:line=240）
3) 除封面外：中标题(h1)四号 14pt，小标题(h2/h3)与正文五号 10.5pt
4) 数字 → 思源宋体
5) 目录：左对齐、右制表位落在版心右边界（不越出版心），二级不再缩进
"""
import sys, copy, re
from docx import Document
from docx.shared import Pt, Twips
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.text.paragraph import Paragraph
from docx.text.run import Run
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT, WD_TAB_LEADER

SANS = '思源黑体'
SANS_M = '思源黑体 Medium'
SERIF = '思源宋体'
DIG = re.compile(r'\d+(?:[.,:/–—]\d+)*%?')
PAGE_W, M_L, M_R = 11906, 1800, 1800
CONTENT = PAGE_W - M_L - M_R - 26     # 版心右边界内收 26twips，避免压线
SZ_H1, SZ_BODY = 28, 21               # 四号 / 五号（半磅）
AFTER_TAGS = ('w:highlight', 'w:u', 'w:effect', 'w:bdr', 'w:shd', 'w:fitText',
              'w:vertAlign', 'w:rtl', 'w:cs', 'w:em', 'w:lang',
              'w:eastAsianLayout', 'w:specVanish', 'w:oMath')


def rpr_of(r):
    rPr = r.find(qn('w:rPr'))
    if rPr is None:
        rPr = OxmlElement('w:rPr')
        r.insert(0, rPr)
    return rPr


def set_rpr_sz(rPr, half):
    for tag in ('w:sz', 'w:szCs'):
        el = rPr.find(qn(tag))
        if el is None:
            el = OxmlElement(tag)
            anchor = None
            for t in AFTER_TAGS:
                anchor = rPr.find(qn(t))
                if anchor is not None:
                    break
            if anchor is not None:
                anchor.addprevious(el)
            else:
                rPr.append(el)
        el.set(qn('w:val'), str(half))


def set_rpr_font(rPr, name):
    rf = rPr.find(qn('w:rFonts'))
    if rf is None:
        rf = OxmlElement('w:rFonts')
        rPr.insert(0, rf)
    for a in ('w:ascii', 'w:hAnsi', 'w:cs'):
        rf.set(qn(a), name)


def set_style_font(style_el, name):
    rPr = style_el.find(qn('w:rPr'))
    if rPr is None:
        rPr = OxmlElement('w:rPr')
        style_el.append(rPr)
    rf = rPr.find(qn('w:rFonts'))
    if rf is None:
        rf = OxmlElement('w:rFonts')
        rPr.insert(0, rf)
    for a in ('w:asciiTheme', 'w:hAnsiTheme', 'w:eastAsiaTheme', 'w:cstheme'):
        if rf.get(qn(a)) is not None:
            del rf.attrib[qn(a)]
    for a in ('w:ascii', 'w:hAnsi', 'w:eastAsia', 'w:cs'):
        rf.set(qn(a), name)


def strip_bold(rPr):
    for tag in ('w:b', 'w:bCs'):
        el = rPr.find(qn(tag))
        if el is not None:
            rPr.remove(el)


def split_digits(p):
    for r in list(p.iter(qn('w:r'))):
        kids = [k.tag for k in r if k.tag != qn('w:rPr')]
        if any(k != qn('w:t') for k in kids):
            continue
        txt = ''.join(x.text or '' for x in r.findall(qn('w:t')))
        if not txt or not DIG.search(txt):
            continue
        segs, last = [], 0
        for m in DIG.finditer(txt):
            if m.start() > last:
                segs.append((txt[last:m.start()], False))
            segs.append((m.group(0), True))
            last = m.end()
        if last < len(txt):
            segs.append((txt[last:], False))
        for text, isdig in segs:
            nr = copy.deepcopy(r)
            for x in nr.findall(qn('w:t')):
                nr.remove(x)
            t = OxmlElement('w:t')
            t.text = text
            t.set(qn('xml:space'), 'preserve')
            nr.append(t)
            if isdig:
                set_rpr_font(rpr_of(nr), SERIF)
            r.addprevious(nr)
        r.getparent().remove(r)


def style_id(p):
    pPr = p.find(qn('w:pPr'))
    if pPr is None:
        return None
    ps = pPr.find(qn('w:pStyle'))
    return ps.get(qn('w:val')) if ps is not None else None


def fix_toc(para):
    pf = para.paragraph_format
    pf.tab_stops.clear_all()
    pf.tab_stops.add_tab_stop(Twips(CONTENT), WD_TAB_ALIGNMENT.RIGHT, WD_TAB_LEADER.DOTS)
    pf.left_indent = Twips(0)
    pf.right_indent = Twips(0)
    pf.first_line_indent = Twips(0)
    pf.alignment = WD_ALIGN_PARAGRAPH.LEFT


def main(path):
    doc = Document(path)
    body = doc.element.body

    paras = [Paragraph(p, doc) for p in body.iter(qn('w:p'))]
    in_cover = True
    n_head = n_body = n_toc = 0

    for p in paras:
        text = p.text.strip()
        if in_cover and text == '目录':
            in_cover = False
        sid = style_id(p._p)

        # 行距统一单倍
        p.paragraph_format.line_spacing = 1.0

        # 字号
        if not in_cover:
            size = SZ_H1 if sid == '000006' else SZ_BODY
            for r in p._p.iter(qn('w:r')):
                set_rpr_sz(rpr_of(r), size)
            pPr = p._p.find(qn('w:pPr'))
            if pPr is not None:
                mark = pPr.find(qn('w:rPr'))
                if mark is not None:
                    set_rpr_sz(mark, size)

        # 去掉自动段前段后，标题给定固定段距
        pPr0 = p._p.find(qn('w:pPr'))
        if pPr0 is not None and not in_cover:
            sp = pPr0.find(qn('w:spacing'))
            if sp is not None:
                for a in ('w:beforeAutospacing', 'w:afterAutospacing'):
                    if sp.get(qn(a)) is not None:
                        del sp.attrib[qn(a)]
                if sid == '000006':
                    sp.set(qn('w:before'), '360')
                    sp.set(qn('w:after'), '120')
                elif sid in ('000007', '000008'):
                    sp.set(qn('w:before'), '240')
                    sp.set(qn('w:after'), '80')

        # 标题不要左右缩进
        if sid in ('000006', '000007', '000008'):
            pf = p.paragraph_format
            pf.left_indent = Twips(0)
            pf.right_indent = Twips(0)
            n_head += 1
        elif not in_cover and p.paragraph_format.first_line_indent:
            # 正文不缩进（与其他段落左对齐）
            p.paragraph_format.first_line_indent = Twips(0)
            n_body += 1

        # 目录
        if sid in ('000004', '000005') or ('PAGEREF' in p._p.xml):
            fix_toc(p)
            n_toc += 1

        # 数字换宋体
        split_digits(p._p)

    # 去加粗（正文 + 页眉页脚）
    for rPr in body.iter(qn('w:rPr')):
        strip_bold(rPr)
    for sec in doc.sections:
        for part in (sec.header, sec.footer):
            for rPr in part._element.iter(qn('w:rPr')):
                strip_bold(rPr)

    # 样式层：去加粗、改字号、目录制表位
    for style in doc.styles:
        el = style.element
        rPr = el.find(qn('w:rPr'))
        if rPr is not None:
            strip_bold(rPr)
        sid = style.style_id
        if sid in ('000006', '000007', '000008', '000004', '000005') and rPr is not None:
            set_rpr_sz(rPr, SZ_H1 if sid == '000006' else SZ_BODY)
        pPr = el.find(qn('w:pPr'))
        if pPr is not None and sid in ('000004', '000005', '000006', '000007', '000008'):
            sp = pPr.find(qn('w:spacing'))
            if sp is None:
                sp = OxmlElement('w:spacing')
                pPr.append(sp)
            sp.set(qn('w:line'), '240')
            if sp.get(qn('w:lineRule')) is not None:
                del sp.attrib[qn('w:lineRule')]
        if pPr is not None and sid in ('000004', '000005'):
            tabs = pPr.find(qn('w:tabs'))
            if tabs is not None:
                for tab in tabs.findall(qn('w:tab')):
                    tab.set(qn('w:pos'), str(CONTENT))
            ind = pPr.find(qn('w:ind'))
            if ind is None:
                ind = OxmlElement('w:ind')
                pPr.append(ind)
            ind.set(qn('w:left'), '0')
            ind.set(qn('w:firstLine'), '0')

    # 字体兜底：默认字体与目录样式（转换器默认写 SimSun / 主题字体）
    st = doc.styles.element
    dd = st.find(qn('w:docDefaults'))
    if dd is not None:
        for rf in dd.iter(qn('w:rFonts')):
            for a in ('w:asciiTheme', 'w:hAnsiTheme', 'w:eastAsiaTheme', 'w:cstheme'):
                if rf.get(qn(a)) is not None:
                    del rf.attrib[qn(a)]
            for a in ('w:ascii', 'w:hAnsi', 'w:eastAsia', 'w:cs'):
                rf.set(qn(a), SANS)
    for style in doc.styles:
        sid = style.style_id
        name = style.name or ''
        if sid in ('000004', '000006', '000007', '000008'):
            set_style_font(style.element, SANS_M)
        elif sid == '000005' or name in ('Normal', 'Body Text'):
            set_style_font(style.element, SANS)

    doc.save(path)
    print('headings', n_head, 'body-indent', n_body, 'toc', n_toc)


if __name__ == '__main__':
    main(sys.argv[1])
