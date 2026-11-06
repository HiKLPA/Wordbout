# -*- coding: utf-8 -*-
"""生成《Wordbout 项目改进建议与面试知识手册》docx。"""
import os
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

CN = '微软雅黑'
EN = 'Calibri'
BRAND = RGBColor(0xBE, 0x4B, 0x3E)
ACCENT = RGBColor(0xC0, 0x39, 0x2B)
TEXT = RGBColor(0x22, 0x22, 0x22)
MUTED = RGBColor(0x77, 0x77, 0x77)
HAIR = 'DCDCDC'
TINT = 'FBF3F1'
HEAD_BG = 'F4EFEE'

BODY_PT = 10.5


# ---------------- 基础工具 ----------------

def set_font(run, size=BODY_PT, bold=False, color=TEXT, cn=CN, en=EN, italic=False):
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color
    run.font.name = en
    rPr = run._element.get_or_add_rPr()
    rFonts = rPr.find(qn('w:rFonts'))
    if rFonts is None:
        rFonts = OxmlElement('w:rFonts')
        rPr.append(rFonts)
    rFonts.set(qn('w:eastAsia'), cn)
    rFonts.set(qn('w:ascii'), en)
    rFonts.set(qn('w:hAnsi'), en)


def par(doc, text='', size=BODY_PT, bold=False, color=TEXT, before=0, after=6,
        line=1.62, indent=0.0, first=0.0, align=None, cn=CN, en=EN, italic=False,
        keep=False, left_bar=False):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.space_before = Pt(before)
    pf.space_after = Pt(after)
    pf.line_spacing = line
    pf.left_indent = Cm(indent)
    pf.first_line_indent = Cm(first)
    if align is not None:
        p.alignment = align
    if keep:
        pf.keep_with_next = True
    if left_bar:
        pPr = p._element.get_or_add_pPr()
        bdr = OxmlElement('w:pBdr')
        left = OxmlElement('w:left')
        left.set(qn('w:val'), 'single')
        left.set(qn('w:sz'), '18')
        left.set(qn('w:space'), '8')
        left.set(qn('w:color'), 'BE4B3E')
        bdr.append(left)
        pPr.insert_element_before(bdr, *_PBDR_SUCCESSORS)
        pf.left_indent = Cm(indent + 0.32)
    if text:
        r = p.add_run(text)
        set_font(r, size, bold, color, cn, en, italic)
    return p


def h1(doc, text, start_new=True):
    if start_new:
        doc.add_page_break()
    p = doc.add_paragraph(style='Heading 1')
    pf = p.paragraph_format
    pf.space_before = Pt(0)
    pf.space_after = Pt(4)
    pf.line_spacing = 1.3
    pf.keep_with_next = True
    r = p.add_run(text)
    set_font(r, 19, True, ACCENT)
    # 底部细线
    pPr = p._element.get_or_add_pPr()
    bdr = OxmlElement('w:pBdr')
    bot = OxmlElement('w:bottom')
    bot.set(qn('w:val'), 'single')
    bot.set(qn('w:sz'), '6')
    bot.set(qn('w:space'), '6')
    bot.set(qn('w:color'), HAIR)
    bdr.append(bot)
    pPr.insert_element_before(bdr, *_PBDR_SUCCESSORS)
    return p


def h2(doc, text, before=16):
    p = doc.add_paragraph(style='Heading 2')
    pf = p.paragraph_format
    pf.space_before = Pt(before)
    pf.space_after = Pt(4)
    pf.line_spacing = 1.4
    pf.keep_with_next = True
    r = p.add_run(text)
    set_font(r, 13.5, True, TEXT)
    return p


def h3(doc, text, before=12):
    p = doc.add_paragraph(style='Heading 3')
    pf = p.paragraph_format
    pf.space_before = Pt(before)
    pf.space_after = Pt(3)
    pf.line_spacing = 1.4
    pf.keep_with_next = True
    r = p.add_run(text)
    set_font(r, 11.5, True, BRAND)
    return p


def bullet(doc, text, after=3.5, size=BODY_PT):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.space_before = Pt(0)
    pf.space_after = Pt(after)
    pf.line_spacing = 1.58
    pf.left_indent = Cm(0.72)
    pf.first_line_indent = Cm(-0.72)
    r = p.add_run('·  ')
    set_font(r, size, False, BRAND)
    r2 = p.add_run(text)
    set_font(r2, size, False, TEXT)
    return p


def kv(doc, label, text, after=5):
    """问题 / 动作 / 产出 这类标签段，标签加粗。"""
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.space_before = Pt(0)
    pf.space_after = Pt(after)
    pf.line_spacing = 1.62
    r = p.add_run(label + '：')
    set_font(r, BODY_PT, True, RGBColor(0x33, 0x33, 0x33))
    r2 = p.add_run(text)
    set_font(r2, BODY_PT, False, TEXT)
    return p


def note(doc, text, after=10):
    """面试价值一行：左侧色条，深红标签 + 深灰正文。"""
    p = par(doc, '', after=after, line=1.55, left_bar=True, before=1)
    r = p.add_run('面试价值　')
    set_font(r, 9, True, BRAND)
    r2 = p.add_run(text)
    set_font(r2, 9.5, False, RGBColor(0x3A, 0x3A, 0x3A))
    return p


def spacer(doc, pt=6):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.0
    r = p.add_run('')
    set_font(r, pt / 2)


# ---------------- 表格 ----------------

_PBDR_SUCCESSORS = (
    'w:shd', 'w:tabs', 'w:suppressAutoHyphens', 'w:kinsoku', 'w:wordWrap',
    'w:overflowPunct', 'w:topLinePunct', 'w:autoSpaceDE', 'w:autoSpaceDN', 'w:bidi',
    'w:adjustRightInd', 'w:snapToGrid', 'w:spacing', 'w:ind', 'w:contextualSpacing',
    'w:mirrorIndents', 'w:suppressOverlap', 'w:jc', 'w:textDirection', 'w:textAlignment',
    'w:textboxTightWrap', 'w:outlineLvl', 'w:divId', 'w:cnfStyle', 'w:rPr', 'w:sectPr',
    'w:pPrChange',
)

_TBLPR_AFTER_BORDERS = ('w:shd', 'w:tblLayout', 'w:tblCellMar', 'w:tblLook',
                        'w:tblCaption', 'w:tblDescription', 'w:tblPrChange')
_TBLPR_AFTER_MAR = ('w:tblLook', 'w:tblCaption', 'w:tblDescription', 'w:tblPrChange')


def _borders(table):
    tbl = table._tbl
    tblPr = tbl.tblPr
    borders = OxmlElement('w:tblBorders')
    for edge in ('top', 'bottom', 'insideH'):
        el = OxmlElement('w:' + edge)
        el.set(qn('w:val'), 'single')
        el.set(qn('w:sz'), '4')
        el.set(qn('w:space'), '0')
        el.set(qn('w:color'), HAIR)
        borders.append(el)
    for edge in ('left', 'right', 'insideV'):
        el = OxmlElement('w:' + edge)
        el.set(qn('w:val'), 'none')
        el.set(qn('w:sz'), '0')
        el.set(qn('w:space'), '0')
        el.set(qn('w:color'), 'auto')
        borders.append(el)
    tblPr.insert_element_before(borders, *_TBLPR_AFTER_BORDERS)


def _cell_margins(table, top=70, bottom=70, left=100, right=100):
    tblPr = table._tbl.tblPr
    mar = OxmlElement('w:tblCellMar')
    for k, v in (('top', top), ('left', left), ('bottom', bottom), ('right', right)):
        el = OxmlElement('w:' + k)
        el.set(qn('w:w'), str(v))
        el.set(qn('w:type'), 'dxa')
        mar.append(el)
    tblPr.insert_element_before(mar, *_TBLPR_AFTER_MAR)


def _shade(cell, color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), color)
    tcPr.append(shd)


def _cell(cell, text, size=9, bold=False, color=TEXT, cn=CN):
    cell.text = ''
    lines = str(text).split('\n')
    for i, ln in enumerate(lines):
        p = cell.paragraphs[0] if i == 0 else cell.add_paragraph()
        pf = p.paragraph_format
        pf.space_before = Pt(0)
        pf.space_after = Pt(1 if i < len(lines) - 1 else 0)
        pf.line_spacing = 1.36
        r = p.add_run(ln)
        set_font(r, size, bold, color, cn)


def plain_table(doc, rows, widths, size=9.5, after=10):
    """无表头的两列信息表，只有横线。"""
    t = doc.add_table(rows=0, cols=len(widths))
    t.alignment = WD_TABLE_ALIGNMENT.LEFT
    t.autofit = False
    _borders(t)
    _cell_margins(t, top=85, bottom=85)
    for row in rows:
        cells = t.add_row().cells
        _cell(cells[0], row[0], size, False, MUTED)
        _cell(cells[1], row[1], size, False, TEXT)
    for i, w in enumerate(widths):
        for row in t.rows:
            row.cells[i].width = Cm(w)
    spacer(doc, after)
    return t


def table(doc, headers, rows, widths, size=9, first_col_bold=False, after=10):
    t = doc.add_table(rows=1, cols=len(headers))
    t.alignment = WD_TABLE_ALIGNMENT.LEFT
    t.autofit = False
    _borders(t)
    _cell_margins(t)
    hdr = t.rows[0]
    for i, h in enumerate(headers):
        _shade(hdr.cells[i], HEAD_BG)
        _cell(hdr.cells[i], h, size - 0.3, True, RGBColor(0x5A, 0x2B, 0x25))
    # 表头重复
    trPr = hdr._tr.get_or_add_trPr()
    th = OxmlElement('w:tblHeader')
    th.set(qn('w:val'), 'true')
    trPr.append(th)

    for row in rows:
        cells = t.add_row().cells
        for i, val in enumerate(row):
            _cell(cells[i], val, size, first_col_bold and i == 0)

    for i, w in enumerate(widths):
        for row in t.rows:
            row.cells[i].width = Cm(w)
    spacer(doc, after)
    return t


# ---------------- 页眉页脚 ----------------

def _field(par, code):
    r1 = par.add_run()
    fc = OxmlElement('w:fldChar')
    fc.set(qn('w:fldCharType'), 'begin')
    r1._r.append(fc)
    r2 = par.add_run()
    it = OxmlElement('w:instrText')
    it.set(qn('xml:space'), 'preserve')
    it.text = code
    r2._r.append(it)
    r3 = par.add_run()
    fc2 = OxmlElement('w:fldChar')
    fc2.set(qn('w:fldCharType'), 'separate')
    r3._r.append(fc2)
    r4 = par.add_run('1')
    r5 = par.add_run()
    fc3 = OxmlElement('w:fldChar')
    fc3.set(qn('w:fldCharType'), 'end')
    r5._r.append(fc3)
    for r in (r1, r2, r3, r4, r5):
        set_font(r, 9, False, MUTED)


def build_header_footer(section):
    section.different_first_page_header_footer = True
    hp = section.header.paragraphs[0]
    hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r = hp.add_run('Wordbout 项目改进建议与面试知识手册')
    set_font(r, 8.5, False, MUTED)
    pPr = hp._element.get_or_add_pPr()
    bdr = OxmlElement('w:pBdr')
    bot = OxmlElement('w:bottom')
    bot.set(qn('w:val'), 'single')
    bot.set(qn('w:sz'), '4')
    bot.set(qn('w:space'), '4')
    bot.set(qn('w:color'), HAIR)
    bdr.append(bot)
    pPr.insert_element_before(bdr, *_PBDR_SUCCESSORS)

    fp = section.footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    _field(fp, ' PAGE ')


# ---------------- 文档 ----------------

doc = Document()
sec = doc.sections[0]
sec.page_width = Cm(21)
sec.page_height = Cm(29.7)
sec.left_margin = Cm(2.4)
sec.right_margin = Cm(2.4)
sec.top_margin = Cm(2.3)
sec.bottom_margin = Cm(2.2)
sec.header_distance = Cm(1.3)
sec.footer_distance = Cm(1.3)

normal = doc.styles['Normal']
normal.font.name = EN
normal.font.size = Pt(BODY_PT)
normal.element.rPr.rFonts.set(qn('w:eastAsia'), CN)

build_header_footer(sec)

# === 封面 ===
spacer(doc, 60)
p = par(doc, '需求文档 · 产品复盘 · 面试准备', size=10, color=MUTED, after=14)
p.runs[0].font.bold = False

p = par(doc, 'Wordbout 项目改进建议', size=30, bold=True, color=ACCENT, after=2, line=1.28)
p = par(doc, '与面试知识手册', size=30, bold=True, color=ACCENT, after=16, line=1.28)

p = par(doc, '面向金山软件产品经理实习岗位的自我盘点', size=13, color=RGBColor(0x44, 0x44, 0x44), after=26)

p = par(doc, '', after=0)
pPr = p._element.get_or_add_pPr()
bdr = OxmlElement('w:pBdr')
bot = OxmlElement('w:bottom')
bot.set(qn('w:val'), 'single')
bot.set(qn('w:sz'), '12')
bot.set(qn('w:space'), '1')
bot.set(qn('w:color'), 'BE4B3E')
bdr.append(bot)
pPr.insert_element_before(bdr, *_PBDR_SUCCESSORS)

spacer(doc, 20)

meta_rows = [
    ('项目', 'Wordbout　英语学习应用（iOS / Android / Web）'),
    ('技术栈', 'Expo SDK 54　React Native 0.81　TypeScript 5.9　expo-router 6'),
    ('规模', '约 100 个手写源文件　26,290 行 TS/TSX　24 个页面路由'),
    ('文档', '应用版本 0.10.0　本文 2026-11-06 第 1 版'),
]
plain_table(doc, meta_rows, [2.4, 13.8], size=9.5, after=18)

par(doc, '本文分两部分。第一部分盘点了项目当前的真实位置，给出按优先级排序的改进清单，'
         '每一条都标注它在面试中能换来什么。第二部分是与这个项目直接相关的技术、产品与设计知识，'
         '以及十个高频追问的回答骨架。文末是三周冲刺清单与三分钟自述稿。',
    size=10, color=RGBColor(0x44, 0x44, 0x44), after=8, indent=0.0, line=1.7)
par(doc, '所有数字取自仓库当前状态，可核对；所有建议都指向可交付的产出物，而不是抽象的方向。',
    size=10, color=RGBColor(0x44, 0x44, 0x44), line=1.7)

# === 目录 ===
doc.add_page_break()
p = par(doc, '目　录', size=15, bold=True, color=TEXT, after=12)

toc = [
    ('一', '项目现状盘点', 0),
    ('1.1', '一句话定位与规模', 1),
    ('1.2', '已有资产', 1),
    ('1.3', '成熟度六维自评', 1),
    ('二', '改进建议', 0),
    ('2.1', 'A 组　立刻要补的硬伤', 1),
    ('2.2', 'B 组　产品完成度', 1),
    ('2.3', 'C 组　工程专业度', 1),
    ('2.4', 'D 组　加分项', 1),
    ('三', '怎么把项目写进简历', 0),
    ('四', '技术知识：会被追问的部分', 0),
    ('五', '产品知识：判断力的证据', 0),
    ('六', '设计知识：审美的依据', 0),
    ('七', '高频追问与回答骨架', 0),
    ('八', '三周冲刺清单', 0),
    ('九', '三分钟自述稿', 0),
]
for num, title, lvl in toc:
    indent = 0.0 if lvl == 0 else 0.85
    p = par(doc, '', after=4 if lvl else 7, before=3 if lvl == 0 else 0)
    p.paragraph_format.left_indent = Cm(indent)
    if lvl == 0:
        r = p.add_run(num + '　')
        set_font(r, 11, True, BRAND)
        r2 = p.add_run(title)
        set_font(r2, 11, True, TEXT)
    else:
        r = p.add_run(num + '　')
        set_font(r, 10, False, MUTED)
        r2 = p.add_run(title)
        set_font(r2, 10, False, RGBColor(0x44, 0x44, 0x44))

# =========================================================
# 一
# =========================================================
h1(doc, '一　项目现状盘点')

h2(doc, '1.1　一句话定位与规模', before=6)
par(doc, 'Wordbout 是一个面向中文母语备考人群的英语学习应用。它把查词翻译、五板块九题型的练习、'
         '大模型评分、能力趋势四件事串在同一条链路上，用户不必在词典、背单词、写作批改、'
         '数据统计四个工具之间搬数据。')
par(doc, '工程规模如下。这些数字在面试里会被追问来源，建议记住并能在仓库里立刻指出。')
table(doc, ['维度', '数值', '口径'], [
    ('手写代码', '26,290 行', 'src 下 .ts / .tsx，剔除 4 个生成文件'),
    ('源文件', '约 100 个', '不含生成文件与 node_modules'),
    ('页面路由', '24 个', 'expo-router 文件即路由，另有布局文件 2 个'),
    ('一级页面', '5 个', '主页 / 探索 / 课本 / 练习 / 更多'),
    ('练习题型', '9 种', '听写、听力理解、作句、作文、词与短语、句与段、短文、阅读理解、翻译'),
    ('覆盖板块', '5 个', '听 / 写 / 说 / 读 / 译'),
    ('等级题库', '5 档', '日常、CET4、CET6、IELTS、TOEFL'),
    ('界面语言', '3 种', '英文、简体中文、繁体中文，约 786 条英文词条'),
    ('内置词典', '4 部', 'ECDICT、CC-CEDICT、Wiktionary 在线、汉英反查'),
], [3.2, 3.4, 9.6])

h2(doc, '1.2　已有资产')
par(doc, '多数学生项目只有代码。这个项目真正稀缺的是文档与规范，面试时应该主动亮出来。')
bullet(doc, '九章 SRS 全文。每条功能三段式：功能定义、操作与反馈、验收标准。另含非功能需求八条、'
            '数据需求六条、外部接口四条、优先级三档、验收要点九条、待确认事项五条。')
bullet(doc, '十三章 PRD（58 张表）。在 SRS 之上补齐了界面结构、状态流转与边界情况。')
bullet(doc, '配置中心。词库、题库、评分标准、门槛、超时、模型名全部集中在 appConfig，'
            '改参数不发版，对应 SRS 的可维护性要求。')
bullet(doc, '设计令牌。字号、字重、行高、色值、间距集中定义，组件里禁止写死数值。')
bullet(doc, '本地化流水线。以中文原文为键，三个脚本分别做构建、覆盖率检查与漏译审计，'
            '繁中由 OpenCC 生成且不手改。当前未收录为 0。')
bullet(doc, '质量门禁脚本。类型检查、lint、本地化检查三条命令，收尾必跑。')

h2(doc, '1.3　成熟度六维自评')
par(doc, '把项目当成一个要交付的产品来打分。分数不重要，短板在哪才重要。')
table(doc, ['维度', '评分', '支撑事实', '短板'], [
    ('需求定义', '8 / 10', 'SRS 九章、PRD 十三章、验收标准可执行', '五条待确认事项仍是待定'),
    ('交互与视觉', '8 / 10', '设计令牌、字阶体系、三语、无障碍开关', '缺实机无障碍验证'),
    ('工程结构', '7 / 10', '路由 / 展示 / 纯逻辑 / 数据 / 配置分层清楚', '分层约束未用工具固化'),
    ('质量保障', '2 / 10', '有类型检查与本地化审计', '无测试、无 CI、无崩溃上报、无版本控制'),
    ('数据与增长', '2 / 10', '无', '无埋点、无指标、无真实用户、无服务端同步'),
    ('交付与上线', '2 / 10', 'Web 端可预览', '无构建产物、无分发渠道、无商店素材'),
], [3.0, 2.0, 5.4, 5.8])

par(doc, '一句话结论：原型成熟度已经接近可演示，产品成熟度仍停在自证阶段。'
         '面试要做的不是掩饰后三行的低分，而是给出补齐路径。第二部分的后半段就是这个路径。')

# =========================================================
# 二
# =========================================================
h1(doc, '二　改进建议')

par(doc, '四组共二十条。A 组是面试官一眼能看出的硬伤，成本低、收益高，先做。'
         'B 组决定这个项目算不算一个产品。C 组决定它算不算一个工程项目。D 组是加分项。')
par(doc, '每条给四件事：问题是什么、动作怎么做、产出什么、面试能换来什么。'
         '最后一项不要跳过，它决定你先做哪条。')

h2(doc, '2.1　A 组　立刻要补的硬伤')

h3(doc, 'A1　没有版本控制', before=6)
kv(doc, '问题', '整个项目没有 .git。改错一处只能靠编辑器缓存和临时备份复原，'
                '无法回滚、无法对比、无法说明任何一次决策的来龙去脉。')
kv(doc, '动作', '初始化仓库，按功能域补八到十二个提交，不要求还原真实时间线。'
                '提交信息统一为 类型: 内容，例如 feat: 统一收藏按钮组件。补一份 README。')
kv(doc, '产出', '一个能讲清历史的仓库，加一页 README：定位、截图、运行方式、目录说明、已知限制。')
note(doc, '面试官一定会问你怎么协作、怎么回滚、怎么处理冲突。没有仓库，这三个问题都无法作答。')

h3(doc, 'A2　一个测试用例都没有')
kv(doc, '问题', '领域层全是纯函数，包括打卡判定、统计聚合、日期边界、收藏夹、拼写判定、'
                '断点恢复。这些恰好是最该测也最好测的部分，现在为零。')
kv(doc, '动作', '引入 jest，只测领域层，目标 25 到 40 条用例。优先覆盖七类：'
                '跨天边界（23:59 与 00:01）、设备时区、同一任务重复提交只计一次、'
                '达标规则的三种取值、测验作答不进三计数器、聚合与明细一致、'
                '断点恢复时题目已下架的处理。')
kv(doc, '产出', '__tests__ 目录，npm test 脚本，一份覆盖率数字。')
note(doc, '口径问题在 PM 面试里出现频率极高。能把口径说成可执行的断言，'
          '比背诵功能列表有说服力得多。')

h3(doc, 'A3　质量门禁停在手动')
kv(doc, '问题', '类型检查、lint、本地化审计三条命令都在本地手动跑，靠自觉。'
                '项目已经有漏译审计脚本，却没有任何机制保证它被跑过。')
kv(doc, '动作', '建一个持续集成任务，四步：安装依赖、类型检查、lint、本地化检查加测试。'
                '仓库首页挂状态徽章。')
kv(doc, '产出', '一个配置文件，加 README 上的徽章。')
note(doc, '这体现的是质量门禁必须落在流水线上、不能依赖人的自觉。一句话就能讲明白，'
          '但很少有候选人真的做了。')

h3(doc, 'A4　大模型密钥被打进客户端')
kv(doc, '问题', '密钥通过公开前缀的环境变量注入，构建期被写进安装包。'
                '任何人反编译都能拿到并消耗额度。这不是代码风格问题，是产品级风险。')
kv(doc, '动作', '加一层最薄的服务端（云函数或轻量 Node 服务），客户端只带自己的会话凭证。'
                '服务端做三件事：转发请求、按用户每日次数限流、记录耗时与 token 用量。'
                '密钥只存在服务端环境变量。')
kv(doc, '产出', '一页接口说明加一张调用链图。真正上线与否不重要，能讲清取舍就够。')
note(doc, '这是通向成本控制、限流、降级、审计四个话题的天然入口，'
          '而它们正是大模型产品岗最常问的几件事。')

h3(doc, 'A5　没有埋点，也就没有产品判断')
kv(doc, '问题', 'SRS 明确要求关键流程埋点可追踪，代码里没有实现。没有埋点就没有行为数据，'
                '没有数据的产品经理只能靠感觉说话。')
kv(doc, '动作', '定义八个事件的极小事件表，统一从一个模块出口，本地缓存后批量上报。'
                '同时把北极星指标与漏斗写死在一页纸上。')
table(doc, ['事件', '触发时机', '关键字段', '用来回答什么'], [
    ('app_open', '冷启动完成', '版本、机型、渠道', '启动量与留存基数'),
    ('translate_query', '提交查询', '方向、词典、字数', '查词是不是真正的入口'),
    ('exercise_start', '进入作答页', '题型、题库、来源', '哪些题型被真正使用'),
    ('exercise_submit', '提交作答', '题型、用时、是否重做', '完成率与投入程度'),
    ('grade_result', '评分返回', '成功与否、耗时、是否降级', 'AI 失败率与体验水位'),
    ('practice_resume', '恢复断点', '题型、停在第几题', '中断率与流失位置'),
    ('favorite_add', '加入收藏或题集', '来源页、词', '内容价值验证'),
    ('quiz_finish', '测验完成', '题量、得分率', '测验功能是否值得做'),
], [3.4, 3.3, 5.0, 4.5], size=8.6)
kv(doc, '动作补充', '北极星指标定为每周完成有效练习任务的用户数。'
                    '辅助指标五个：次日留存、七日留存、人均周练习任务数、'
                    'AI 评分失败率、查词到练习的转化率。有效练习的口径要写死：'
                    '提交且评分成功，且不来自测验。')
note(doc, '产品经理的核心证据是能不能用数据说话。哪怕只有五个人自测的数据，'
          '指标定义完整就已经赢过一半候选人。')

h3(doc, 'A6　全部状态挤在一个键里')
kv(doc, '问题', '所有数据序列化成一个 JSON 存进单一键。三个后果：'
                '写放大（改一次收藏就重写全量）、无并发保护（两次写入互相覆盖）、'
                '无迁移函数（版本号字段存在，但没有对应的升级分支，'
                '下次改结构会直接丢掉老字段）。')
kv(doc, '动作', '短期补迁移函数，从旧版本逐级升到新版本，禁止一步跨版本。'
                '中期按域拆键：资料、设置、作答、日聚合、收藏各一个键。'
                '长期换 SQLite，只把聚合结果写回，明细走索引查询。')
kv(doc, '产出', '一页数据演进说明，加一个能跑的迁移函数。')
note(doc, '被问到数据怎么存、怎么保证不丢时，能给出分阶段方案，'
          '而不是一句用了本地存储。这三步本身就是一条完整的技术判断。')

h2(doc, '2.2　B 组　产品完成度')

h3(doc, 'B1　留存缺一个触发器', before=6)
kv(doc, '问题', '学习类产品的留存几乎全靠外部触发，而这个项目只有记录机制：'
                '连续天数在记，但没有提醒（配置里默认关闭，标注为二期），没有周报，没有补签。')
kv(doc, '动作', '做最小闭环。本地通知加三个规则：当天未达标才发、达标不发、'
                '系统权限被拒时在设置页给说明且不反复弹窗。再加一条每周一的练习摘要推送。'
                '补签只给一次免费额度，作为连续天数的保险。')
kv(doc, '产出', '一条完整的召回链路，能在演示里走通。')
note(doc, '能区分记录机制与触发机制，是判断一个候选人是否真想过留存的分水岭。')

h3(doc, 'B2　内容供给与版权没有闭环')
kv(doc, '问题', '词库数据结构里有授权来源字段，但用的开源词典要求署名，'
                '而全 App 没有任何一处承载这个署名。词库的更新、审核、下架流程也没有定义。')
kv(doc, '动作', '关于页加致谢区，写清词典名称、许可协议与链接。'
                '词库结构补三个字段：来源、版本、审核人。写一份两百字的内容审核规则。')
kv(doc, '产出', '合规页面加一页规则文档。')
note(doc, '合规是很多学生项目的完全空白区，也是能上架的前置条件。'
          '主动提这一点，会明显区别于只会写功能的候选人。')

h3(doc, 'B3　AI 质量没有任何评估机制')
kv(doc, '问题', '评分完全交给大模型，只有超时兜底，没有准确性验证。'
                '免费策略定为不限次，没有成本模型。')
kv(doc, '动作', '建二十到三十条人工标注样本，好中差各若干，'
                '每次改提示词跑一遍，看两件事：分数偏差分布、理由是否可执行。'
                '线上记录失败率与平均耗时。成本按单次 token 成本乘人均日调用估算，'
                '反推免费额度。')
kv(doc, '产出', '一页评分质量报告：样本数、偏差分布、结论、下一步。')
note(doc, '大模型产品最容易被问的就是效果怎么评。有样本集、有偏差数字，'
          '这个问题就从软肋变成强项。')

h3(doc, 'B4　个性化还停在配置层')
kv(doc, '问题', '题量、门槛、超时都可以配，但练习内容对所有人一样，抽题按题库随机。'
                '这个产品已经沉淀了错词、得分率、中断位置三类信号，却没用起来。')
kv(doc, '动作', '算一个薄弱项权重：错词加权、低分项加权、长期未复习加权，'
                '抽题时按权重倾斜。规则简单、可解释、可手算就够，不必上模型。')
kv(doc, '产出', '一套可解释的抽题规则，加一个能展示权重来源的说明。')
note(doc, '讲个性化时能给出最小可行版本，比一上来就说算法要可信得多。'
          '面试官在意的是你能否从零到一，而不是能否从一到一百。')

h3(doc, 'B5　没有商业化设计')
kv(doc, '问题', '没有付费点、没有试用、没有分享。金山是商业公司，'
                '产品经理要能算账，这个项目目前算不出账。')
kv(doc, '动作', '画一条从查词到订阅的路径：查词、收藏、加入题集、练习、看到水平分档、'
                '解锁详细报告。给每个节点一个转化率假设，给两档定价与免费额度。')
kv(doc, '产出', '一页转化路径图加一页成本与定价测算。')
note(doc, '能主动谈收入和成本，说明你想的是生意而不是作业。')

h2(doc, '2.3　C 组　工程专业度')

h3(doc, 'C1　分层只写在文档里', before=6)
kv(doc, '问题', '路由、组件、纯逻辑、数据、配置、主题六层分得清楚，'
                '但没有任何工具约束。任何人都能从组件反向引用路由，或在领域层引入 React。')
kv(doc, '动作', '用 lint 的路径限制规则固化四条：领域层不得引入 React、'
                '组件层不得引用路由、数据层不得引用组件、主题之外不得出现裸色值。')
note(doc, '架构不是画出来的，是拦出来的。这句话能直接用。')

h3(doc, 'C2　全局状态会拖垮列表与图表')
kv(doc, '问题', '单一上下文承载全部状态，任何一次写入都会让所有消费者重渲染。'
                '练习记录一多，列表页与趋势图会明显掉帧。')
kv(doc, '动作', '按域拆成三到四个上下文，或者引入带选择器的订阅方式，'
                '让订阅方只在关心的字段变化时重渲染。')
note(doc, '这是能讲出具体因果的性能问题，比背概念有效。')

h3(doc, 'C3　没有错误边界，没有崩溃采集')
kv(doc, '问题', '任何一处渲染异常都会白屏，且没有任何记录。'
                '用户反馈时，你拿不到版本号、机型与堆栈。')
kv(doc, '动作', '加一层兜底页（显示版本号与重试按钮），接入崩溃上报服务（个人项目免费额度够用），'
                '关于页固定展示版本号与构建号。')
note(doc, '线上可观测性是产品成熟度的隐形分水岭，提到的人不多。')

h3(doc, 'C4　不可构建，也不可分发')
kv(doc, '问题', '没有构建配置，没有安装包，没有分发渠道。'
                '严格说，这是一个能跑的工程，还不是一个能被安装的产品。')
kv(doc, '动作', '配置云构建，出 Android 安装包与 iOS 内测包，走内测分发或公测渠道，'
                '找五到十个真实用户。')
kv(doc, '产出', '一个可扫码安装的链接。')
note(doc, '一个能装的 App 和一个能跑的仓库，在面试官眼里是两个量级的成果。'
          '真实用户还能换来第一份行为数据，直接补上前面的数据短板。')

h3(doc, 'C5　缺 README 与架构决策记录')
kv(doc, '问题', '所有设计意图都在代码注释与对话历史里，新人（或者三个月后的你）读不出来。')
kv(doc, '动作', 'README 给六块：定位、截图、运行、目录、规范、已知限制。'
                '再写三篇架构决策记录，每篇半页：为什么选 Expo、为什么本地优先、'
                '为什么先用本地评分引擎再换大模型。每篇写清背景、选项、决定、代价。')
note(doc, '决策记录是极少见的加分项。它证明你想过取舍，而不只是把功能堆出来。')

h2(doc, '2.4　D 组　加分项')

h3(doc, 'D1　六十秒演示视频', before=6)
kv(doc, '动作', '录一条完整路径：查词、收藏、加入题集、开始练习、提交、看评分、看趋势。'
                '不加旁白，只加字幕。')
note(doc, '面试时放视频比讲十分钟都有效，而且不依赖现场网络和你的口才。')

h3(doc, 'D2　一页纸作品集')
kv(doc, '动作', '一页放五块：项目定位一句话、我的角色、三个关键决策、一组数据、一句复盘。')
note(doc, '简历决定有没有面试，作品集决定面试聊得深不深。')

h3(doc, 'D3　竞品对比表')
kv(doc, '动作', '选五个直接竞品，按六个维度横向比，最后落到一句话差异。详见第五章。')
note(doc, '差异化只有一句话说得清，才算真的想清楚了。')

h3(doc, 'D4　把待确认事项真的定下来')
kv(doc, '问题', 'SRS 第九章有五条待确认：连续天数的达标条件、AI 评分免费策略、'
                '热门排行口径、当前水平的评定方式、聚合在端上还是服务端。')
kv(doc, '动作', '逐条给结论与依据，哪怕依据是经验判断。把待确认改成已决策，并注明假设。')
note(doc, '面试官最爱挑待定项。留着五条待定，等于给对方五个追问入口。')

# =========================================================
# 三
# =========================================================
h1(doc, '三　怎么把项目写进简历')

h2(doc, '3.1　三条 bullet', before=6)
par(doc, '简历上给三行，动词开头，每行一个能力维度：定义、工程、AI。')
kv(doc, '第一条', '独立完成英语学习应用 Wordbout 的需求定义，输出九章 SRS 与十三章 PRD，'
                  '含 58 张表、九条可执行验收标准；把词库、题库、门槛与评分标准做成配置中心，'
                  '调参不发版。')
kv(doc, '第二条', '实现五个一级页面、24 个页面路由与九种练习题型（Expo SDK 54、React Native、'
                  'TypeScript，2.6 万行），建立三语本地化流水线，786 条词条零漏译，'
                  '类型检查与漏译审计纳入持续集成。')
kv(doc, '第三条', '接入 OpenAI 兼容大模型完成评分与词条解析，设计三级降级（缓存、模型、离线词条）'
                  '与 20 秒 / 30 秒双层超时兜底，把失败率与耗时纳入指标。')

h2(doc, '3.2　诚实边界')
par(doc, '不要写日活、留存、付费率、用户量这类你没有的数字。面试官追问数据来源时，'
         '编造一次就全盘失信。')
par(doc, '正确做法是分层标注。已经实现的、设计完成但未实现的、只有规划的，'
         '在作品集里用不同标记区分。能坦然说出还没做的人，反而更容易被信任。')
par(doc, '另一个容易翻车的点是把 AI 的作用藏起来。项目规模摆在那里，'
         '面试官会默认你用了工具。与其被问出来，不如主动交代协作方式与自己的判断点。')

h2(doc, '3.3　作品集的版式建议')
bullet(doc, '第一页只放定位、角色、三个决策、一组数据。不要放目录。')
bullet(doc, '第二页放信息架构与主流程，用一张图说清五个一级页面之间的关系。')
bullet(doc, '第三页放两个关键界面，配一句设计理由，不要只放截图。')
bullet(doc, '第四页放文档与规范（SRS 目录、令牌表、字阶表），证明过程而不只是结果。')
bullet(doc, '最后一页放已知问题与下一步，这是成熟度最直接的证据。')

# =========================================================
# 四 技术
# =========================================================
h1(doc, '四　技术知识：会被追问的部分')

par(doc, '产品经理不需要会写代码，但需要能判断技术方案的成本与代价。'
         '这一章按被问到的概率排序，每条都给出可以直接说出口的结论。')

h2(doc, '4.1　技术栈与选型理由', before=6)
table(doc, ['技术', '在项目里的作用', '为什么选它', '代价'], [
    ('Expo SDK 54', '构建、权限、原生模块的统一入口', '一套 TypeScript 同时跑 iOS、Android、Web，'
     'Web 端能直接发链接', '原生模块受 SDK 支持范围限制，深度定制需要自定义客户端'),
    ('React Native 0.81', '跨端渲染', '生态成熟，列表与手势方案齐全', '长列表与复杂动画需要额外优化'),
    ('expo-router 6', '路由', '文件即路由，深链与目录结构天然一致', '路由配置分散在文件系统里'),
    ('TypeScript 5.9', '类型约束', '数据模型复杂，类型能挡住大半低级错误', '初期建模成本高'),
    ('异步键值存储', '本地持久化', '零依赖，够快够简单', '无事务、无索引、单键全量写'),
    ('SVG 图表', '趋势图与环形进度', '矢量、可主题化、体积小', '复杂图表要自己算坐标'),
    ('音频与语音', '发音、倍速、跟读录音', '系统级播放与录音，无需自建', '倍速与录音时长需要自己兜底'),
], [3.2, 4.2, 4.6, 4.2], size=8.6)

par(doc, '选型题的答法固定：先说约束（一个人、要覆盖三端、要能快速迭代），'
         '再说选择，最后主动说代价。只说优点会被认为没做过取舍。')

h2(doc, '4.2　状态与持久化')
par(doc, '这是最容易被问穿的一层，因为它是所有数据问题的根。')
kv(doc, '单上下文的问题', '全部状态放在一个上下文里，任何一次写入都会让全部订阅者重渲染。'
                          '表现是列表滚动掉帧、图表切换卡顿。解法是按域拆分或引入选择器订阅。')
kv(doc, '键值存储的边界', '它不是数据库：没有事务、没有索引、没有查询能力。'
                          '单键全量写带来两个后果，写放大与损坏风险。'
                          '数据量上去以后应该换关系型存储，只把聚合结果留在内存。')
kv(doc, '迁移怎么做', '版本号加逐级升级函数。每个版本一个 upgrade 分支，从旧到新依次执行，'
                      '禁止一步跨版本。迁移要幂等，失败要能回退到原始快照。')
kv(doc, '冲突怎么解', 'SRS 已定义以完成时间更晚的一条为准。但要补一句：'
                      '设备时间可以被用户修改，正式版应改用服务端时间戳，'
                      '或者用混合逻辑时钟保证偏序。')
note(doc, '能说出设备时间不可信这一层，说明你想过分布式的基本问题。')

h2(doc, '4.3　数据口径：一个指标只能有一个入口')
par(doc, '同一个数字出现在三个页面，就必须来自同一处计算。这个项目里练习页的打卡卡、'
         '能力趋势页、更多页的学习统计共用一份按日聚合，作答记录是唯一事实来源，'
         '聚合是派生物。删除明细时聚合同步失效，不许各自维护。')
par(doc, '三个具体规则要能脱口而出：')
bullet(doc, '测验作答打排除标记。不进三计数器、不进日聚合、不进趋势。这是口径隔离，'
            '不是补丁，理由是同一次练习不能既算日常训练又算考试。')
bullet(doc, '跨天以设备时区的自然日零点为界。23:59 提交算今天，00:01 提交算明天，'
            '不接受模糊的二十四小时窗口。')
bullet(doc, '同一任务重复提交只计一次，靠当日已完成题目列表去重。'
            '这条规则决定了连续天数和任务数的可信度。')
par(doc, '如果面试官问怎么保证三处一致，答案就是一句话：任何页面都不得自己算指标，'
         '只能读同一个聚合函数的结果。')

h2(doc, '4.4　大模型工程')
kv(doc, '结构化输出', '只让模型输出 JSON，提示词里写死字段与类型，给一个反例，温度取低值。'
                      '解析失败重试一次，仍失败就降级。不要让界面直接消费模型的自由文本。')
kv(doc, '三级降级', '缓存命中、在线模型、离线词条。查词类问题可以退化到内置词条，'
                    '问答类问题只能提示重试。降级路径要在产品上说清楚，'
                    '否则用户会以为功能坏了。')
kv(doc, '超时分层', '评分 30 秒，其中 20 秒时给评分中的提示；整段回答 60 秒；'
                    '示例提问 20 秒，超时直接退到本地兜底。慢任务不能拖住页面。')
kv(doc, '缓存键设计', '问题文本、会话历史、提示词版本三者一起散列。'
                      '把历史算进去，同一句追问在不同上下文里才不会串答案。'
                      '缓存要能按前缀统计占用与批量清理。')
kv(doc, '成本模型', '成本等于输入 token 加输出 token 乘以单价。'
                    '缓存命中率直接决定账单，历史轮数也直接决定账单。'
                    '免费额度应由人均日调用乘单次成本反推，而不是拍一个次数。')
kv(doc, '幻觉控制', '只允许引用给定词表；不确定时要求模型明说；'
                    '关键字段做格式与范围校验（分数 0 到 100，分项之和等于总分）。')
kv(doc, '评测方法', '二十到三十条标注样本，每次改提示词必跑。'
                    '看三个数：分数偏差、理由可执行率、格式合规率。')
kv(doc, '流式与并发', '长回答用流式降低感知延迟；并发按用户限流，'
                      '否则免费额度会被单个用户吃光。')
note(doc, '这一节是整份文档里最值钱的部分。大模型产品的面试，八成问题落在这八个点上。')

h2(doc, '4.5　隐私与合规')
bullet(doc, '权限按使用申请、用后不驻留。相机只在拍照翻译时申请，麦克风只在跟读与语音翻译时申请。')
bullet(doc, '原始图像与音频默认不上传、不留存，识别在设备本地完成。这一点必须写进隐私政策正文。')
bullet(doc, '未同意隐私政策时，拍照与语音功能直接禁用，而不是弹一次窗就放行。')
bullet(doc, '提供导出与删除：学习记录可导出 CSV 与 JSON，可一键删除；注销后按法规删除或匿名化。')
bullet(doc, '未成年人条款写到十四周岁，这是个人信息保护法对敏感个人信息的分界线。')
note(doc, '合规细节答得出来，说明你读过法规而不只是抄了模板。')

h2(doc, '4.6　可维护性的三件套')
kv(doc, '配置中心', '门槛、题量、超时、模型名、词典顺序全部外置。好处是调参不发版，'
                    '坏处是配置散落需要文档与校验，否则会出现代码与配置不一致。')
kv(doc, '本地化', '中文原文做键，漏译靠脚本审计，繁中由转换工具生成不手改。'
                  '代价是键名随文案变动，必须靠审计脚本兜底。'
                  '这一条的价值在于：它把翻译从人工检查变成了流水线。')
kv(doc, '设计令牌', '字号、行高、色值、间距集中定义，组件里禁止写死。'
                    '代价是前期慢，收益是改版只改一处。')

# =========================================================
# 五 产品
# =========================================================
h1(doc, '五　产品知识：判断力的证据')

h2(doc, '5.1　用户与场景', before=6)
par(doc, '一句话说清用户：中文母语、以考试为目标的英语学习者，'
         '四六级、雅思、托福三个方向，碎片时间为主。')
par(doc, '三类场景对应三种设计取舍：')
bullet(doc, '通勤碎片，一到三分钟。产品形态是查词与背词，要求单手、单手能完成，'
            '所以主页把翻译框放在第一屏。')
bullet(doc, '整块时间，十五到三十分钟。产品形态是写作与口语评分，要求有草稿、有断点、'
            '不能丢输入，所以做了断点续做与草稿保留。')
bullet(doc, '考前冲刺，按周计。产品形态是测验与趋势复盘，要求能看到薄弱项，'
            '所以做了九种题型的分项得分率。')
par(doc, '被问为什么不做泛英语学习时，答案要落到资源约束上：'
         '一个人做不出全场景，先做窄场景才可能做出差异。')

h2(doc, '5.2　竞品格局')
table(doc, ['产品', '强项', '弱项', '我们的差异'], [
    ('百词斩', '图像记忆、词库全、用户量大', '释义浅、练习类型单一', '五板块九题型的练习闭环'),
    ('墨墨背单词', '记忆算法、复习曲线成熟', '偏背诵、缺输出训练', '强调写、说、译三种输出'),
    ('扇贝', '社区与打卡、内容生态完整', '重运营、AI 能力弱', '用大模型做即时反馈'),
    ('多邻国', '游戏化、留存机制强', '中文母语者的应试场景弱', '应试导向，按等级分题库'),
    ('金山词霸', '词典权威、查词入口稳', '学习闭环弱，练与评是断开的', '查、练、评、看趋势在一条链路上'),
], [2.6, 3.9, 4.1, 5.6], size=8.6)
par(doc, '差异点只能有一个，一句话说完：把查词、练习、评分、趋势放在同一条链路上，'
         '用户不用在四个工具之间搬数据。这一句话要能顶住三次追问。')

h2(doc, '5.3　指标与漏斗')
par(doc, '北极星：每周完成有效练习任务的用户数。选它而不选日活，'
         '是因为学习产品的价值发生在完成一次练习之后，而不是打开一次。')
table(doc, ['漏斗层级', '指标', '可接受阈值', '不达标时的动作'], [
    ('获取', '安装量', '—', '渠道素材与商店页'),
    ('激活', '引导完成率', '80%', '砍引导步数，延后权限申请'),
    ('首次价值', '首次完成练习率', '50%', '把练习入口前置到查词之后'),
    ('留存', '次日留存', '35%', '加提醒与周报'),
    ('留存', '七日留存', '15%', '看中断率，优化断点恢复'),
    ('变现', '付费转化率', '2%', '调整免费额度与报告颗粒度'),
], [2.6, 3.9, 3.2, 6.5], size=8.6)
par(doc, '口径必须自洽。什么算有效练习要写死：提交且评分成功，且不来自测验。'
         '否则同一个数字在三个页面会算出三个值。')

h2(doc, '5.4　优先级方法')
par(doc, '项目已有三档划分：必须实现、应当实现、可延后。这一层解决的是能不能上线，'
         '解决不了先做哪一个。第二层用 RICE：触达人数乘影响程度乘置信度，除以投入。')
par(doc, '举两个例子说明排序会翻盘：提醒功能触达全体、影响留存、投入小，'
         '按原始分档属于二期，按 RICE 应该提前；社交功能在冷启动阶段触达为零，'
         '无论多有想象力都该往后放。')
par(doc, '第三层看依赖关系。埋点必须先于任何增长实验，否则实验无法归因。'
         '面试时把这三层说清楚，比报一堆方法论名字管用。')

h2(doc, '5.5　商业化与成本')
par(doc, '成本结构分两块。大模型调用是变动成本，随使用线性增长；'
         '词库、音频、内容是固定成本，一次性投入。'
         '这意味着定价必须让变动成本有上限，否则用得越多亏得越多。')
par(doc, '定价思路：免费给足查词与基础练习，把 AI 评分与趋势报告放进订阅，'
         '学生场景做校园包。关键指标三个：付费转化率、每付费用户收入、毛利率。'
         '毛利率要减掉模型成本，这一点很多候选人会漏。')

h2(doc, '5.6　版本节奏')
par(doc, '项目按天切版本，一个开发日一个末位版本号，十三天走了十三个版本。'
         '好处是变更可追溯、回滚粒度小、文档与代码不容易脱节。'
         '风险是版本号通胀，用户无感，而且小步快跑掩盖了缺少里程碑的问题。')
par(doc, '如果被问怎么改，答案是对内保留日版本，对外按里程碑合并成大版本，'
         '两者用同一份变更记录派生。')

# =========================================================
# 六 设计
# =========================================================
h1(doc, '六　设计知识：审美的依据')

h2(doc, '6.1　设计系统', before=6)
par(doc, '字号档位从大到小：128、64、48、32、24、18、16、16、14、12。'
         '命名按大小单调，避免出现中号比大号还大的历史坑。'
         '字重只用三档：500、600、700，再多就是噪音。行高统一由令牌管理，组件里禁止写死。')
par(doc, '颜色只有两个来源：品牌红与页面强调色。'
         '强调色由一层提供者统一注入，整页换色只包一层，不逐级传参。'
         '这条规则的价值在于，它让换肤变成了改一个值，而不是改四十个组件。')

h2(doc, '6.2　中文排版')
bullet(doc, '汉字与中文标点走思源黑体，英文与数字走 Barlow，混排按字符脚本自动分流。'
            '混排不处理，中英数字的字面高度会不一致，看起来像两个字体拼在一起。')
bullet(doc, '中英之间不加空格。这是中文排版的惯例，不是审美偏好。'
            'AI 生成的文本尤其要处理，模型默认会加空格。')
bullet(doc, '图表纵轴要预留固定宽度，用文本宽度估算而不是写死像素，'
            '否则换语言或放大字号就会截断。')

h2(doc, '6.3　无障碍')
bullet(doc, '正文对比度不低于 4.5 比 1，深浅色模式都要满足。')
bullet(doc, '颜色不能是唯一的信息载体。题目答对是红描边加红勾，答错是黑描边加黑叉，'
            '形状与符号同时区分，色弱用户也能判断。')
bullet(doc, '触控区不小于 32，主按钮不小于 44。图标按钮要有透明热区，'
            '视觉尺寸和点击尺寸不必相等。')
bullet(doc, '支持系统字体缩放后布局不重叠，这是很多中文 App 的翻车点。')
bullet(doc, '屏幕阅读器要能读出选项内容与题目要求。选项的视觉状态不能只靠样式，'
            '要有可读的状态描述。')

h2(doc, '6.4　两个能讲的交互决策')
kv(doc, '提交后不跳解析', '答完立刻跳解析页会打断心流，用户失去对节奏的控制。'
                          '改成留在原页、只标对错、把解析放到按钮上，'
                          '信息密度让位于可预期性。这个取舍可以用一句话讲完，'
                          '但它体现的是对心流的理解。')
kv(doc, '收藏入口必须共用', '收藏按钮曾在五个页面各写一套，视觉与行为逐渐漂移，'
                            '修一处漏四处。后来收敛成一个组件，'
                            '空心态、弹窗、颜色全部内置。教训是重复出现的界面元素，'
                            '必须先抽象再落地。')

# =========================================================
# 七 追问
# =========================================================
h1(doc, '七　高频追问与回答骨架')

par(doc, '每题给三行：怎么答、核心要点、别踩的坑。二十秒内说完一层，留出追问空间。')

QA = [
    ('这个项目是你一个人做的吗，AI 帮了多少',
     '产品定义、交互规范、需求文档由我定；代码实现大量借助 AI 结对，我的工作是拆解、验收与纠错。'
     '举个具体例子：Web 端输入框右侧总溢出一块，是我先定位到浏览器按字符数算固有宽度、'
     '而弹性布局默认不允许压缩，才让它按这个方向改。',
     '不否认 AI，把价值锚在判断力上。'),
    ('最大的返工是什么',
     '收藏按钮在五个页面各写一套，三个月里视觉与行为持续漂移，最后收敛成一个公共组件。'
     '教训是重复出现的界面元素必须先抽象，否则每一处改动都是五处改动。',
     '讲一个有因果的返工，不要讲心态。'),
    ('只能留三个功能上线，留哪三个',
     '查词翻译、听写、趋势页。查词是入口，决定获客；听写是客观题，不依赖模型、判定明确，'
     '能独立闭环；趋势是唯一能证明学了有用的地方，决定付费意愿。',
     '先给判断标准，再给答案。'),
    ('没有真实用户，怎么证明有效',
     '三层替代证据。规则可验证，有测试用例；可用性自测，找五个同学走同一任务，记录卡点；'
     '路径对比，同一件事在竞品里要几步、在我们这里要几步。',
     '承认局限，给替代方案，不要硬撑。'),
    ('为什么不用 Flutter 或者原生',
     '一个人做，一套 TypeScript 覆盖三端最划算，而且 Web 端能直接把链接发给人看。'
     '原生在相机与音频上体验更好，但当前阶段迭代速度与分发成本更重要。',
     '一定要说代价，只说优势会被认为没权衡过。'),
    ('AI 评分不准怎么办',
     '三道防线。分项给分，总分由分项算出来，不让模型自由给总分；标注样本回归，改提示词必跑；'
     '兜底文案，不确定时给区间与建议，不硬给精确分。产品上还要明确评分仅供参考。',
     '不要答调整提示词，那是第一层不是全部。'),
    ('你怎么定优先级',
     '三层。第一层按必须、应当、可延后分档，解决能不能上线；第二层用 RICE 排序，'
     '解决先做谁；第三层看依赖，比如埋点必须先于增长实验。冲突时看北极星指标。',
     '别只报方法论名字，要举一个排序翻盘的例子。'),
    ('这个产品和金山词霸、WPS 有什么关系',
     '能力同源，场景不同。词霸是查词入口，WPS 是文档场景，我们做的是把查词、练习、评分、'
     '趋势串成学习闭环。放进金山生态，最自然的接口是文档里的生词一键进词库，'
     '以及复用 WPS 的写作批改能力做作文评分。',
     '提前想清楚与目标公司的业务接口，这是明显的加分项。'),
    ('你怎么处理隐私合规',
     '最小必要、按使用申请、原件不留存、可导出可删除、十四周岁条款。'
     '未同意隐私政策时，相机与麦克风相关功能直接禁用。',
     '能说出具体条款年龄，说明读过法规。'),
    ('你作为产品经理具体做了什么',
     '需求（九章 SRS，含验收标准与待确认事项）、优先级（三档加依赖）、'
     '交互与视觉规范（字阶、令牌、组件收敛）、数据口径（三处计数同源）、'
     '质量门禁（类型检查、漏译审计、口径测试）。',
     '不要答我写了代码，要答我定义了什么叫对。'),
]

for i, (q, a, tip) in enumerate(QA, 1):
    h3(doc, 'Q%d　%s' % (i, q), before=10)
    par(doc, a, after=3)
    p = par(doc, '', after=8)
    r = p.add_run('要点　')
    set_font(r, 9, True, BRAND)
    r2 = p.add_run(tip)
    set_font(r2, 9, False, MUTED)

# =========================================================
# 八
# =========================================================
h1(doc, '八　三周冲刺清单')

par(doc, '按投入产出排序。每周结束时应该有一个能拿给别人看的产出物，而不是完成度百分比。')
table(doc, ['周次', '事项', '产出', '判定标准'], [
    ('第一周', '版本控制、README、持续集成、领域层测试', '仓库 + 流水线 + 20 条用例',
     '主分支一键跑绿，历史提交能讲清三次决策'),
    ('第二周', '八个事件埋点、指标定义、云构建、内测分发', '可扫码安装的包 + 第一份漏斗数据',
     '五个真实用户走完一条完整路径'),
    ('第三周', '评分样本集、演示录屏、一页纸作品集、简历三条', '质量报告 + 60 秒视频 + 一页纸',
     '不看稿讲满三分钟不卡'),
], [1.8, 5.8, 4.8, 3.8], size=8.6)
par(doc, '如果只有一周，做第一周加演示视频。前者补硬伤，后者决定第一印象。')

# =========================================================
# 九
# =========================================================
h1(doc, '九　三分钟自述稿')

par(doc, '约五百字，语速正常三分钟。分五段，每段一个落点：是什么、为什么做、怎么定义、'
         '怎么验证、学到什么。')
par(doc, '我做了一个英语学习应用，叫 Wordbout。起因很具体：备考的时候，查词在词典里，'
         '背词在另一个 App，写作批改要发给老师，练习数据散在四个地方，'
         '我始终不知道自己的时间到底花出了什么效果。所以我想做一个把这条链路接上的东西。')
par(doc, '它的结构是五个一级页面。主页查词，练习做九种题型，课本按等级和热门组织词库，'
         '探索做词汇发散，更多放统计与设置。核心不是功能多，而是数据只走一条链：'
         '任何一次练习都会落到同一条作答记录上，打卡、趋势、统计三处都从它派生，'
         '所以不会出现三个页面三个数。')
par(doc, '我先写需求再做界面。SRS 一共九章，每条功能都带验收标准，'
         '比如同一任务重复提交只计一次、测验作答不进打卡、跨天以零点为界。'
         '这些规则看起来很细，但它们是产品能被信任的基础。')
par(doc, '验证方面我做了三件事。规则用测试用例固定下来；AI 评分建了标注样本看偏差；'
         '并且把类型检查、漏译审计这些质量门禁放进了流水线，而不是靠人记得跑。')
par(doc, '最大的收获是明白了产品经理的产出不是功能清单，而是定义。'
         '什么叫完成、什么叫一致、什么叫失败，这些东西定清楚了，实现才有得谈。')

# 结尾
spacer(doc, 16)
p = par(doc, '', after=0)
pPr = p._element.get_or_add_pPr()
bdr = OxmlElement('w:pBdr')
bot = OxmlElement('w:bottom')
bot.set(qn('w:val'), 'single')
bot.set(qn('w:sz'), '6')
bot.set(qn('w:space'), '1')
bot.set(qn('w:color'), HAIR)
bdr.append(bot)
pPr.insert_element_before(bdr, *_PBDR_SUCCESSORS)
par(doc, '文档完　Wordbout 0.10.0　2026-11-06', size=9, color=MUTED, align=WD_ALIGN_PARAGRAPH.CENTER, before=8)

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'Wordbout项目改进建议与面试知识手册.docx')
doc.save(out)
print('SAVED', out)
