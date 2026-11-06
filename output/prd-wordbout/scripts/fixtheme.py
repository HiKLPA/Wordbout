# -*- coding: utf-8 -*-
import sys
from docx import Document
from docx.oxml.ns import qn

SANS = '思源黑体'
SANS_M = '思源黑体 Medium'

def set_rf(rf, name, keep_eastasia=False):
    for a in ('w:asciiTheme', 'w:hAnsiTheme', 'w:eastAsiaTheme', 'w:cstheme'):
        if rf.get(qn(a)) is not None:
            del rf.attrib[qn(a)]
    for a in ('w:ascii', 'w:hAnsi', 'w:cs', 'w:eastAsia'):
        rf.set(qn(a), name)

def main(path):
    doc = Document(path)
    st = doc.styles.element
    # docDefaults
    dd = st.find(qn('w:docDefaults'))
    if dd is not None:
        for rf in dd.iter(qn('w:rFonts')):
            set_rf(rf, SANS)
    # 逐样式映射并处理目录样式
    for style in st.findall(qn('w:style')):
        name_el = style.find(qn('w:name'))
        nm = name_el.get(qn('w:val')) if name_el is not None else ''
        rPr = style.find(qn('w:rPr'))
        if rPr is None:
            continue
        rf = rPr.find(qn('w:rFonts'))
        if nm in ('toc 1', 'toc 2'):
            if rf is None:
                from docx.oxml import OxmlElement
                rf = OxmlElement('w:rFonts')
                rPr.insert(0, rf)
            set_rf(rf, SANS_M if nm == 'toc 1' else SANS)
        elif rf is not None:
            cur = rf.get(qn('w:ascii')) or ''
            if cur in ('SimSun', '宋体'):
                set_rf(rf, SANS)
            elif cur in ('SimHei', '黑体'):
                set_rf(rf, SANS_M)
    doc.save(path)
    print('styles patched')

if __name__ == '__main__':
    main(sys.argv[1])
