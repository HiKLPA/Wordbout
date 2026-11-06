# -*- coding: utf-8 -*-
import sys, re
from docx import Document
from docx.oxml.ns import qn

MEDIUM = '思源黑体 Medium'

def main(path):
    doc = Document(path)
    body = doc.element.body
    n = 0
    for tc in body.iter(qn('w:tc')):
        shd = tc.find(qn('w:tcPr') + '/' + qn('w:shd'))
        if shd is None:
            tcPr = tc.find(qn('w:tcPr'))
            shd = tcPr.find(qn('w:shd')) if tcPr is not None else None
        fill = (shd.get(qn('w:fill')) or '').lower() if shd is not None else ''
        if fill != 'f2efec':
            continue
        for r in tc.iter(qn('w:r')):
            rPr = r.find(qn('w:rPr'))
            if rPr is None:
                continue
            for tag in ('w:b', 'w:bCs'):
                e = rPr.find(qn(tag))
                if e is not None:
                    rPr.remove(e)
            rf = rPr.find(qn('w:rFonts'))
            if rf is None:
                continue
            for a in ('w:ascii', 'w:hAnsi', 'w:cs', 'w:eastAsia'):
                # 数字已单独设为思源宋体，跳过
                if (rf.get(qn(a)) or '').startswith('思源宋体'):
                    continue
                rf.set(qn(a), MEDIUM)
            n += 1
    doc.save(path)
    print('th runs patched', n)

if __name__ == '__main__':
    main(sys.argv[1])
