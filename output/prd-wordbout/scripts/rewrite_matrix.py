# -*- coding: utf-8 -*-
"""重写 4.2 五维横评的评分说明：把抽象结论改成具体能看见的行为描述。

只动表格里 5 个维度 × 5 列的评分单元格，以及该表上方一段评判口径说明。
"""
import sys

from docx import Document
from docx.oxml.ns import qn

NEW_ROWS = {
    '功能集成度': [
        '3：以看图选词背单词为主，能查词、能听发音，但没有写作与口语练习，做完题只判对错，不解释错在哪',
        '3：背词时配原声例句与词根，可查生词，但没有写作与口语环节，练习完只对答案，不给分数和建议',
        '4：听说读写都有课程，练完立刻判对错，但内容只按课程进度走，不能自由查一个词，也不能导入自己的生词表',
        '2：只做卡片复习，卡片要自己录入或导入，没有查词，也没有成套的练习题和评分',
        '5：查词、背词、练习、评分在同一个入口完成，查到的词能直接进练习，写错时给出具体改法',
    ],
    '完善度': [
        '5：手机、平板、网页多端同步，可离线下载，词书与例句成体系，版本迭代稳定',
        '4：词书与例句质量高，界面打磨细腻，但只覆盖背词一件事，翻译、练习、批改都缺',
        '5：课程从入门排到进阶，动画、音效、连续打卡与排行榜形成完整激励，长期运营内容充足',
        '4：桌面端与手机端同步稳定，插件生态成熟，但界面停留在工具形态，缺少引导与视觉设计',
        '2：查词、练习、评分的主流程已跑通，但词书只有五本，账号与多端同步未做，内容量是主要缺口',
    ],
    '学习成本': [
        '2：每次打开要过签到、复习、新词几层界面，任务量偏大，中途退出后当天很难续上',
        '3：要先弄懂例句语境和复习节奏，头几次用会慢，熟悉之后路径才变清晰',
        '1：进去就能开始一课，一节三到五分钟，几乎不用做任何设置',
        '1：要自己制卡、调复习参数、装插件，新用户通常要一两天才能顺手',
        '5：打开首页选个词书就能开练，一轮三到十分钟，不用配置也不用先建词表',
    ],
    '词库完善度': [
        '5：两百余本词书，覆盖考试、教材与行业，释义取自权威词典，配图与例句齐全',
        '5：两百余本词书，例句取自影视与名著原声，可按考试和场景筛选',
        '2：约2500–3000词，只按课程分级，够入门，对不上四六级与雅思托福的词表',
        '1：不带词库，用户自己制卡或下载社区词包，质量参差，释义来源不统一',
        '2：五本自建词书（日常、CET4、CET6、IELTS、TOEFL），释义与例句已有，但体量只有竞品的百分之一量级，例句偏少',
    ],
    'AI能力': [
        '2：AI用在单词讲解与课程推荐上，判分仍靠规则匹配，写错只标红不解释',
        '2：AI用于例句翻译和词义扩展，帮助理解，但不参与作答评分',
        '3：付费档有AI对话练习，能就话题聊天并纠正表达，但不针对具体题型给分',
        '1：本体没有AI，要自己装插件或接外部模型',
        '5：六种主观题型由AI判分，给出分数、理由和可以照着改的具体建议',
    ],
}

NEW_INTRO = (
    '评分采用五分制，5分为该类目内的上限。功能集成度看查词、背词、练习、评分是否都能做；'
    '完善度看内容体量、多端与稳定性、功能完成度；学习成本看从打开到完成一轮训练要几步、'
    '要不要先学设置；词库完善度看词书数量、释义来源与例句质量；'
    'AI能力看AI是否真正参与核心学习环节，而不只是讲解和推荐。'
)


def set_cell_text(tc, text):
    ps = tc.findall(qn('w:p'))
    p = ps[0]
    runs = p.findall(qn('w:r'))
    if not runs:
        raise RuntimeError('cell has no run')
    t = runs[0].find(qn('w:t'))
    if t is None:
        t = runs[0].makeelement(qn('w:t'), {})
        runs[0].append(t)
    t.text = text
    t.set(qn('xml:space'), 'preserve')
    for r in runs[1:]:
        p.remove(r)
    for extra in ps[1:]:
        tc.remove(extra)


def set_para_text(p, text):
    runs = p.findall(qn('w:r'))
    if not runs:
        raise RuntimeError('para has no run')
    t = runs[0].find(qn('w:t'))
    t.text = text
    t.set(qn('xml:space'), 'preserve')
    for r in runs[1:]:
        p.remove(r)


def main(path):
    doc = Document(path)
    body = doc.element.body
    blocks = list(body.iterchildren())

    intro = None
    table = None
    on = False
    for el in blocks:
        txt = ''.join(t.text or '' for t in el.iter(qn('w:t'))).strip()
        if el.find('.//' + qn('w:instrText')) is not None:
            continue
        if txt.startswith('4.2 五维横评'):
            on = True
            continue
        if txt.startswith('4.3'):
            break
        if not on:
            continue
        if el.tag == qn('w:p') and txt.startswith('评分采用五分制'):
            intro = el
        elif el.tag == qn('w:tbl'):
            table = el

    if table is None:
        raise SystemExit('未找到五维横评表格')

    changed = 0
    for tr in table.findall(qn('w:tr')):
        tcs = tr.findall(qn('w:tc'))
        if len(tcs) < 6:
            continue
        dim = ''.join(t.text or '' for t in tcs[0].iter(qn('w:t'))).strip()
        if dim not in NEW_ROWS:
            continue
        for tc, new in zip(tcs[1:6], NEW_ROWS[dim]):
            old = ''.join(t.text or '' for t in tc.iter(qn('w:t'))).strip()
            if old[:1].isdigit() is False:
                print('skip (no score prefix):', dim, old[:12])
                continue
            set_cell_text(tc, new)
            changed += 1

    if intro is not None:
        set_para_text(intro, NEW_INTRO)
        changed += 1

    doc.save(path)
    print('updated cells', changed)


if __name__ == '__main__':
    main(sys.argv[1])
