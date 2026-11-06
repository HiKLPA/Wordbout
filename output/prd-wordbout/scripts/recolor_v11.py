# -*- coding: utf-8 -*-
"""把 PRD 的黑白灰统一成品牌三色：标题 #121212 / 正文 #2D2D2D / 强调 #BE4B3E。

- 标题：小标题（Heading 2）正文、表头行、封面主标题、目录条目 → #121212
- 正文：正文段落、表格数据行、注释、封面副标题与信息行、目录页码 → #2D2D2D
- 红色 #BE4B3E 原样保留；页眉页脚 #8A8A8A 不动
段落标记（pPr/rPr）同步上色，避免空的段落标记仍是旧黑色。
"""
import sys

from docx import Document
from docx.oxml.ns import qn

TITLE = '121212'
BODY = '2D2D2D'
RED = 'BE4B3E'

HEAD_STYLES = {'2', '3'}          # Heading 1 / Heading 2
TOC_STYLES = {'4', '5'}           # toc 1 / toc 2
COVER_TITLE_SIZE = 28             # pt，封面主标题 36pt

PPR_BEFORE_RPR = (
    'w:pStyle', 'w:keepNext', 'w:keepLines', 'w:pageBreakBefore', 'w:framePr',
    'w:widowControl', 'w:numPr', 'w:suppressLineNumbers', 'w:pBdr', 'w:shd',
    'w:tabs', 'w:suppressAutoHyphens', 'w:kinsoku', 'w:wordWrap',
    'w:overflowPunct', 'w:topLinePunct', 'w:autoSpaceDE', 'w:autoSpaceDN',
    'w:bidi', 'w:adjustRightInd', 'w:snapToGrid', 'w:spacing', 'w:ind',
    'w:contextualSpacing', 'w:mirrorIndents', 'w:suppressOverlap', 'w:jc',
    'w:textDirection', 'w:textAlignment', 'w:textboxTightWrap', 'w:outlineLvl',
    'w:divId', 'w:cnfStyle',
)


def set_color_in_rpr(rpr, val):
    c = rpr.find(qn('w:color'))
    if c is None:
        c = rpr.makeelement(qn('w:color'), {})
        anchor = None
        for tag in ('w:sz', 'w:szCs', 'w:highlight', 'w:u'):
            e = rpr.find(qn(tag))
            if e is not None:
                anchor = e
                break
        if anchor is not None:
            anchor.addprevious(c)
        else:
            rpr.append(c)
    c.set(qn('w:val'), val)
    for attr in ('w:themeColor', 'w:themeShade', 'w:themeTint'):
        if c.get(qn(attr)) is not None:
            del c.attrib[qn(attr)]


def set_run_color(run, val):
    rpr = run.find(qn('w:rPr'))
    if rpr is None:
        rpr = run.makeelement(qn('w:rPr'), {})
        run.insert(0, rpr)
    set_color_in_rpr(rpr, val)


def run_color(run):
    rpr = run.find(qn('w:rPr'))
    if rpr is None:
        return None
    c = rpr.find(qn('w:color'))
    return c.get(qn('w:val')) if c is not None else None


def set_mark_color(p, val):
    """段落标记颜色（pPr/rPr），没有就按 schema 顺序补一个。"""
    pPr = p.find(qn('w:pPr'))
    if pPr is None:
        return
    rpr = pPr.find(qn('w:rPr'))
    if rpr is None:
        rpr = pPr.makeelement(qn('w:rPr'), {})
        pos = 0
        for i, child in enumerate(pPr):
            tag = child.tag
            if tag == qn('w:sectPr'):
                break
            name = 'w:' + tag.split('}')[-1]
            if name in PPR_BEFORE_RPR:
                pos = i + 1
        pPr.insert(pos, rpr)
    set_color_in_rpr(rpr, val)


def run_text(r):
    return ''.join(t.text or '' for t in r.iter(qn('w:t')))


def anc(el, tag):
    p = el.getparent()
    while p is not None and p.tag != qn(tag):
        p = p.getparent()
    return p


def para_style(p):
    pPr = p.find(qn('w:pPr'))
    ps = pPr.find(qn('w:pStyle')) if pPr is not None else None
    return ps.get(qn('w:val')) if ps is not None else None


def max_size(p):
    sizes = []
    for z in p.iter(qn('w:sz')):
        try:
            sizes.append(int(z.get(qn('w:val'))) / 2)
        except (TypeError, ValueError):
            pass
    return max(sizes) if sizes else 0


def main(path):
    doc = Document(path)
    body = doc.element.body

    # 封面段落：文书开头到「目录」标题之前的全部段落（持有引用，保证代理不被回收）
    cover_end = None
    for p in body.iter(qn('w:p')):
        if ''.join(t.text or '' for t in p.iter(qn('w:t'))).strip() == '目录':
            cover_end = p
            break
    cover_paras = []
    if cover_end is not None:
        for blk in body:
            if blk is cover_end:
                break
            for p in blk.iter(qn('w:p')):
                cover_paras.append(p)
            if blk.tag == qn('w:p'):
                cover_paras.append(blk)

    stat = {'title': 0, 'body': 0, 'red': 0, 'mark': 0}

    for p in body.iter(qn('w:p')):
        # 段落层角色
        tc = anc(p, 'w:tc')
        if tc is not None:
            tr = anc(p, 'w:tr')
            trPr = tr.find(qn('w:trPr')) if tr is not None else None
            is_head = trPr is not None and trPr.find(qn('w:tblHeader')) is not None
            role = TITLE if is_head else BODY
        else:
            st = para_style(p)
            if st in HEAD_STYLES:
                role = TITLE
            elif st in TOC_STYLES:
                role = TITLE
            elif any(p is cp for cp in cover_paras):
                role = TITLE if max_size(p) >= COVER_TITLE_SIZE else BODY
            else:
                role = BODY

        set_mark_color(p, role)
        stat['mark'] += 1

        for r in p.iter(qn('w:r')):
            text = run_text(r)
            if not text.strip():
                continue
            if run_color(r) == RED:
                stat['red'] += 1
                continue
            target = role
            if role == TITLE and para_style(p) in TOC_STYLES and text.strip().isdigit():
                target = BODY          # 目录页码
            set_run_color(r, target)
            stat['title' if target == TITLE else 'body'] += 1

    doc.save(path)
    print('done', path, stat)


if __name__ == '__main__':
    main(sys.argv[1])
