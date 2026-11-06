# -*- coding: utf-8 -*-
"""按需求改字：英文与数字统一思源宋体；5.4/5.5 语言重写；每日额度按盈利口径调整。

用法: python font_serif_quota.py <docx>
"""
import sys
from docx import Document
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

W_T = qn('w:t')
SERIF = '思源宋体'
SANS = '思源黑体'
SANS_M = '思源黑体 Medium'

# ---------- 文本替换 ----------

PARA_MAP = {
    # 5.4 三处正文
    '模式为能力免费加高阶订阅。': None,  # 前缀匹配，见 rewrite_prefix
    '定价依据有四条。': None,
    '订阅入口只有两处': None,
    # 5.5 正文
    'AI不收费不等于没有成本。': None,
    '额度用尽后的处理比数字本身更影响体验。': None,
    '额度取60次，是与市面对照后的结论。': None,
    '市面上的免费额度只有两种逻辑': None,
    '成本可按同一口径估算。': None,
    # 7 章流程句
    '② Then服务端按账号计额度': None,
    # 附录 B / C 单元格
    '默认只走快速模型；': None,
    '每日20次评分 ＋ 40次提问（合计60次）；单分钟6次': None,
    '每日40次评分 ＋ 60次提问（合计100次）': None,
    '暂不加成，统一为每日20评分／40提问': None,
}

NEW = {
    '模式为能力免费加高阶订阅。':
        '模式为能力免费加高阶订阅。查词、练习、AI评分与AI对话在免费档全部开放，不做按次付费，只设每日额度，细则见5.5。'
        '订阅只对应两件事：换成高阶模型，打开高阶词库。划界有两条理由。'
        '一是成本随付费意愿走，不随用量走：换不换更强模型是用户可感知的一次动作，比按次收费好解释，也不会因重度免费用户推高成本而被迫改规则。'
        '二是保住DAU：核心链路按次收费会把轻用户直接筛掉，门槛应该放在想要更好，而不是想继续用。'
        '不做广告，广告与不打扰的原则冲突，也会污染未成年人的使用环境。',
    '定价依据有四条。':
        '定价依据有四条。锚点：百词斩会员约15–30元/月，扇贝约20–40元/月，多邻国Super约13美元/月；'
        '国内学生与初入职场者能接受10–25元/月，19.9元取区间中位，压在20元关口之下。'
        '首月9.9元用于压低首次付费的决策成本，验证的是次月续订，首月转化只作参考。'
        '年付199元折16.6元/月，比月付低约17%，相当于付十个月用十二个月。'
        '成本：快速模型单次在分币以下，高阶模型单价为数倍，因此只对主动切换的用户开放，并单独计量。',
    '订阅入口只有两处':
        '订阅入口只有两处，都由用户主动触发：在AI面板把快速模型切到高阶模型，在课本页打开未解锁的高阶词库。'
        '两处都不拦断日常使用，免费用户查词、练习、提交评分、看趋势的行为与付费用户一致，差别只在模型档位与可打开的课本范围。'
        '切换模型时先给一次能力对比，说明响应更慢、成本更高，换来更细的批改与更强的长文理解，未订阅才进入权益页；'
        '打开高阶词库时先展示课本规模与适配考试，而不是先关上门。'
        '全程不用倒计时与限时折扣，不对未成年人做付费引导。超额只提示次日恢复并降级到本地能力，不跳转付费。',
    'AI不收费不等于没有成本。':
        'AI不收费不等于没有成本。每次评分与提问都是真实调用，成本随DAU线性增长，而订阅收入只来自少数用户，免费档必须有一条用量上限。'
        '这条上限保护成本，不制造付费点，标准是正常使用碰不到、异常使用一定被拦住。',
    '额度用尽后的处理比数字本身更影响体验。':
        '额度用尽后的处理比数字本身更影响体验。评分超额时降级到本地规则判分，按拼写、关键词命中、字数覆盖率给分，'
        '结果标注基础判分并说明不含AI反馈，用户仍可完成这一轮练习，打卡与统计照常记录。'
        '对话超额时退回内置双词典，释义、音标、例句仍可查。'
        '两者都只提示今日额度已用完、次日00:00恢复，不弹付费页、不做倒计时、不向未成年人做额度引导。'
        '额度按自然日重置而非按月累计，因为学习按天发生，按月累计会让月初的重度使用者在月末失去AI能力。',
    '额度取60次，是与市面对照后的结论。':
        '额度取45次，是与市面对照后的结论。以下为几款同类产品的公开口径（2026年10月检索，随活动与地区浮动）。',
    '市面上的免费额度只有两种逻辑':
        '市面上的免费额度只有两种逻辑。2至5次的额度是商品，AI本身即增值功能，限次为了卖会员；'
        '20至30次的额度是防滥用，AI已进入主链路，限次只为压成本。'
        'Wordbout属于后者：额度压到5次以下会毁掉一轮完整练习，因此评分取15次、对话取30次，合计45次，'
        '落在防滥用线附近，比Studdy的30次高一档，比原方案低四分之一。'
        '差别来自成本结构，Studdy每次含拍照识别与多模态推理，单价高出纯文本一个量级，同样预算能买到更多次文本评分。'
        '超额后降级本地能力，长文批改与深度反馈只给Pro。',
    '成本可按同一口径估算。':
        '成本与盈利按同一口径估算。快速模型单次0.002–0.005元，45次上限对应单用户日成本0.09–0.23元，这是最坏情况；'
        '真实使用中DAU人均每日8–10次调用，折合0.02–0.05元，月成本0.6–1.5元。'
        '缓存命中三成以上、长文只送前2000字加结构摘要，还能再压三成到一半，有效成本落在0.4–1.0元。'
        '以2.5%付费转化、19.9元/月计算，每DAU月收入约0.5元，免费档接近盈亏平衡，差额由Pro补贴。'
        'Pro按高阶模型单价数倍、人均每日20次估算，月成本6–9元，对应19.9元收入，毛利六成上下，与主流订阅制学习产品相近。'
        '降本顺序是先降额度、再换更小模型，最后才考虑对AI收费。'
        '单用户日成本连续两周超过0.06元时，评分额度回调到10次，此项只改服务端配置。',
    '② Then服务端按账号计额度':
        '② Then服务端按账号计额度（快速模型每日15次评分、30次提问，合计45次；单分钟6次；单条输入2000字），超额返回可读文案与次日恢复时间',
    '默认只走快速模型；':
        '默认只走快速模型；每日额度封顶（15次评分／30次提问／45次合计）、单分钟6次、单条2000字；'
        '结果缓存与长文截断；高阶模型单独计量；M2起建单用户日成本看板，超阈值先降额度再降模型，不停服',
    '每日20次评分 ＋ 40次提问（合计60次）；单分钟6次':
        '每日15次评分 ＋ 30次提问（合计45次）；单分钟6次',
    '每日40次评分 ＋ 60次提问（合计100次）':
        '每日50次评分 ＋ 100次提问（合计150次）',
    '暂不加成，统一为每日20评分／40提问':
        '暂不加成，统一为每日15评分／30提问',
}

# 5.5 表格：按行标签改
FREE_TABLE = {
    'AI评分': ('每日15次', '每日50次', '一轮练习里走模型的主观题通常4–6道，15次可覆盖两轮练习，留出补交与重做'),
    'AI对话／查词': ('每日30次', '每日100次', '单次探索常见2–4轮追问，30次约等于八个独立话题，覆盖人均真实用量三倍以上'),
    '合计调用': ('每日45次', '每日150次', '成本封顶用的硬上限；人均真实用量8–10次，P95约22次，正常使用碰不到'),
}
# 5.4 表格：按行标签改
PLAN_TABLE = {
    '查词与翻译': ('不限次查词，AI对话每日30次（快速模型）', '可切高阶模型，对话每日100次，支持长文解析与多轮深挖'),
    'AI评分': ('每日15次，四要素反馈（快速模型）', '可切高阶模型，评分每日50次，含分项细节与改写对照'),
}


def para_text(p):
    return ''.join(t.text or '' for t in p.iter(W_T))


def set_para_text(p, text):
    runs = [r for r in p if r.tag == qn('w:r')]
    if not runs:
        r = OxmlElement('w:r')
        t = OxmlElement('w:t')
        r.append(t)
        p.append(r)
        runs = [r]
    for r in runs[1:]:
        p.remove(r)
    t = runs[0].find(W_T)
    if t is None:
        t = OxmlElement('w:t')
        runs[0].append(t)
    t.text = text
    t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')


def cell_text(tc):
    return ' '.join(para_text(p) for p in tc.iter(qn('w:p'))).strip()


def set_cell(tc, text):
    ps = [p for p in tc.iter(qn('w:p'))]
    set_para_text(ps[0], text)
    for p in ps[1:]:
        tc.remove(p)


def do_tables(doc):
    n = 0
    for tbl in doc.tables:
        rows = tbl.rows
        if not rows:
            continue
        head = ' '.join(c.text for c in rows[0].cells)
        if '取值依据' in head:
            for row in rows[1:]:
                cs = row.cells
                label = cs[0].text.strip()
                if label in FREE_TABLE:
                    free, pro, note = FREE_TABLE[label]
                    set_cell(cs[1]._tc, free)
                    set_cell(cs[2]._tc, pro)
                    set_cell(cs[3]._tc, note)
                    n += 1
        elif '免费版' in head and 'Pro' in head:
            for row in rows[1:]:
                cs = row.cells
                label = cs[0].text.strip()
                if label in PLAN_TABLE:
                    free, pro = PLAN_TABLE[label]
                    set_cell(cs[1]._tc, free)
                    set_cell(cs[2]._tc, pro)
                    n += 1
    return n


def do_paras(doc):
    n = 0
    for p in doc.element.body.iter(qn('w:p')):
        if p.find('.//' + qn('w:instrText')) is not None:
            continue
        txt = para_text(p).strip()
        if not txt:
            continue
        for key, new in NEW.items():
            if txt.startswith(key):
                set_para_text(p, new)
                n += 1
                break
    return n


def fix_typo(doc):
    n = 0
    for p in doc.element.body.iter(qn('w:p')):
        txt = para_text(p)
        if '挡位' in txt:
            set_para_text(p, txt.replace('挡位', '档位'))
            n += 1
    return n


# ---------- 字体 ----------

def serif_swap(root):
    """Latin 与数字走思源宋体，中日韩字形保持原字体。"""
    n = 0
    for rf in root.iter(qn('w:rFonts')):
        ea = rf.get(qn('w:eastAsia'))
        ascii_ = rf.get(qn('w:ascii'))
        if ascii_ not in (SERIF,):
            rf.set(qn('w:ascii'), SERIF)
            rf.set(qn('w:hAnsi'), SERIF)
            n += 1
        rf.set(qn('w:cs'), SERIF)
        if ea is None:
            rf.set(qn('w:eastAsia'), SANS)
    return n


def do_fonts(doc):
    total = 0
    targets = [doc.element]
    for part in doc.part.package.parts:
        name = str(part.partname)
        if name.startswith('/word/header') or name.startswith('/word/footer') or name == '/word/styles.xml':
            try:
                targets.append(part.element)
            except Exception:
                pass
    for el in targets:
        total += serif_swap(el)
    return total


def main(path):
    doc = Document(path)
    print('paras', do_paras(doc))
    print('tables', do_tables(doc))
    print('typo', fix_typo(doc))
    print('font nodes', do_fonts(doc))
    doc.save(path)


if __name__ == '__main__':
    main(sys.argv[1])
