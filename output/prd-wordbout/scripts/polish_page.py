# -*- coding: utf-8 -*-
"""PRD 排版收尾（页面级）：
1) 页眉字号小五 9pt
2) 封面：标题 36pt、副标题 14pt、信息五号 10.5pt
3) 中文与英文之间不留空格（数字已在前序处理）
"""
import re
import sys
from docx import Document
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.text.paragraph import Paragraph

CJK = r'\u4e00-\u9fff'
SP_AFTER_CJK = re.compile(r'(?<=[' + CJK + r']) +(?=[A-Za-z])')
SP_BEFORE_CJK = re.compile(r'(?<=[A-Za-z]) +(?=[' + CJK + r'])')
HEAD_NUM = re.compile(r'^(\x00*)([A-Z]?\d+(?:\.\d+)*|[A-Z]) ')

SIZE_HEADER = 18          # 小五 9pt
SIZE_TITLE = 72           # 36pt
SIZE_SUB = 28             # 14pt
SIZE_META = 21            # 五号 10.5pt

W_T = qn('w:t')
W_R = qn('w:r')
W_TAB = qn('w:tab')
W_BR = qn('w:br')


def set_sz(rPr, half):
    for tag in ('w:sz', 'w:szCs'):
        el = rPr.find(qn(tag))
        if el is None:
            el = OxmlElement(tag)
            rPr.append(el)
        el.set(qn('w:val'), str(half))


def para_text_elements(p):
    """返回 [(w:t 元素, 起始偏移, 结束偏移)] 与拼接文本（非文本子元素用 \\x00 隔断）"""
    segs, buf, pos = [], [], 0
    for child in p.iter():
        if child.tag == W_T:
            txt = child.text or ''
            segs.append((child, pos, pos + len(txt)))
            buf.append(txt)
            pos += len(txt)
        elif child.tag in (W_TAB, W_BR):
            buf.append('\x00')
            pos += 1
    return segs, ''.join(buf)


def rewrite(p, keep_prefix=True):
    """删除中英文之间的空格，返回删除个数"""
    pPr = p.find(qn('w:pPr'))
    sid = None
    if pPr is not None:
        st = pPr.find(qn('w:pStyle'))
        sid = st.get(qn('w:val')) if st is not None else None

    segs, text = para_text_elements(p)
    if not text:
        return 0
    src = text
    if keep_prefix:
        m = HEAD_NUM.match(src)
        if m:
            src = m.group(1) + m.group(2) + '\x01' + src[m.end():]
    new = SP_AFTER_CJK.sub('', src)
    new = SP_BEFORE_CJK.sub('', new)
    new = new.replace('\x01', ' ')
    if len(new) == len(text):
        return 0

    # 计算被删除位置（text 视角）
    drop, i = set(), 0
    for ch in new:
        while i < len(text) and text[i] != ch:
            drop.add(i)
            i += 1
        i += 1
    while i < len(text):
        drop.add(i)
        i += 1

    for el, start, end in segs:
        if not any(start <= d < end for d in drop):
            continue
        piece = ''.join(ch for k, ch in enumerate(text[start:end], start) if k not in drop)
        el.text = piece
        el.set(qn('xml:space'), 'preserve')
    return len(drop)


def main(path):
    doc = Document(path)
    body = doc.element.body

    # 1) 页眉
    n_head = 0
    for sec in doc.sections:
        for part in (sec.header, sec.footer):
            if part.is_linked_to_previous:
                continue
            for r in part._element.iter(W_R):
                rPr = r.find(qn('w:rPr'))
                if rPr is None:
                    rPr = OxmlElement('w:rPr')
                    r.insert(0, rPr)
                set_sz(rPr, SIZE_HEADER)
                n_head += 1

    # 2) 封面三档字号 + 3) 去空格
    cover = []
    for p in body.iter(qn('w:p')):
        if Paragraph(p, doc).text.strip() == '目录':
            break
        cover.append(p)

    n_cover = 0
    for idx, p in enumerate(cover):
        if idx == 1:
            size = SIZE_TITLE
        elif idx == 2:
            size = SIZE_SUB
        elif idx >= 3:
            size = SIZE_META
        else:
            continue
        for r in p.iter(W_R):
            rPr = r.find(qn('w:rPr'))
            if rPr is None:
                rPr = OxmlElement('w:rPr')
                r.insert(0, rPr)
            set_sz(rPr, size)
        pPr = p.find(qn('w:pPr'))
        if pPr is not None:
            mk = pPr.find(qn('w:rPr'))
            if mk is not None:
                set_sz(mk, size)
        n_cover += 1

    # 段落（含表格内）去中英空格
    n = 0
    for p in body.iter(qn('w:p')):
        n += rewrite(p)
    for sec in doc.sections:
        for part in (sec.header, sec.footer):
            if part.is_linked_to_previous:
                continue
            for p in part._element.iter(qn('w:p')):
                n += rewrite(p, keep_prefix=False)

    # 目录项补全与正文标题一致
    for p in body.iter(qn('w:p')):
        txt = ''.join(t.text or '' for t in p.iter(W_T))
        if txt.startswith('7.5 订阅转化链路') and '（M3）' not in txt:
            for el in p.iter(W_T):
                if el.text and '订阅转化链路' in el.text:
                    el.text = el.text.replace('订阅转化链路', '订阅转化链路（M3）')
                    break

    doc.save(path)
    print('header-runs', n_head, 'cover-paras', n_cover, 'spaces-removed', n)


if __name__ == '__main__':
    main(sys.argv[1])
