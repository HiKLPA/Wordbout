# -*- coding: utf-8 -*-
"""把 HTML 正文里的中文-英文之间的空格去掉（与 docx 收尾脚本口径一致）。
只处理 <style>/<script> 之外的文本节点；标签边界处的空格（如章节号 span 之后）不动。
"""
import re
import sys

CJK = r'\u4e00-\u9fff'
A = re.compile(r'(?<=[' + CJK + r']) +(?=[A-Za-z])')
B = re.compile(r'(?<=[A-Za-z]) +(?=[' + CJK + r'])')


def main(path):
    src = open(path, encoding='utf-8').read()
    out, i, skip = [], 0, False
    n = 0
    for m in re.finditer(r'<[^>]+>', src):
        text = src[i:m.start()]
        if not skip:
            new = B.sub('', A.sub('', text))
            n += len(text) - len(new)
            out.append(new)
        else:
            out.append(text)
        tag = m.group(0).lower()
        if re.match(r'<(style|script)\b', tag):
            skip = True
        elif re.match(r'</(style|script)', tag):
            skip = False
        out.append(m.group(0))
        i = m.end()
    tail = src[i:]
    if not skip:
        new = B.sub('', A.sub('', tail))
        n += len(tail) - len(new)
        out.append(new)
    else:
        out.append(tail)
    open(path, 'w', encoding='utf-8', newline='').write(''.join(out))
    print('spaces removed', n)


if __name__ == '__main__':
    main(sys.argv[1])
