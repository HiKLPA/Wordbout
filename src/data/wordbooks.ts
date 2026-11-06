import type { Wordbook, WordEntry } from '@/domain/types';

/**
 * 词库数据（DR-1 / FR-T-1 / FR-T-2）。
 * 初始开发阶段使用本地内置词库；正式版由词库包按需下载替换（NFR-2）。
 * 封面大字与副标题严格取自 Figma「Textbook」组件（Research 画板）。
 */
export const wordbooks: Wordbook[] = [
  // ---------- 热门 / Popular（Type=P/*） ----------
  {
    id: 'popular-cet4',
    coverText: 'CET4',
    subtitle: '1000 Words',
    name: 'CET4 核心词库',
    wordCount: 1000,
    tone: 'yellow',
    category: 'popular',
    license: '已授权（四六级词库）',
    downloaded: true,
    studyCount: 12843,
    levelId: 'cet4',
    description: '四级高频必修词，按真题频次排序。',
  },
  {
    id: 'popular-cet6',
    coverText: 'CET6',
    subtitle: '1200 Words',
    name: 'CET6 核心词库',
    wordCount: 1200,
    tone: 'yellow',
    category: 'popular',
    license: '已授权（四六级词库）',
    downloaded: false,
    studyCount: 9204,
    levelId: 'cet6',
    description: '六级高出题率词，含长难句用法。',
  },
  {
    id: 'popular-ielts',
    coverText: 'IELTS',
    subtitle: '2200 Words',
    name: 'IELTS 学术词库',
    wordCount: 2200,
    tone: 'yellow',
    category: 'popular',
    license: '已授权（IELTS 词库）',
    downloaded: false,
    studyCount: 7130,
    levelId: 'ielts',
    description: 'IELTS 听说读写四科通用学术词。',
  },
  {
    id: 'popular-toefl',
    coverText: 'TOEFL',
    subtitle: '2400 Words',
    name: 'TOEFL 学术词库',
    wordCount: 2400,
    tone: 'yellow',
    category: 'popular',
    license: '已授权（TOEFL 词库）',
    downloaded: false,
    studyCount: 6521,
    levelId: 'toefl',
    description: 'TOEFL 阅读与听力高频学术词。',
  },

  // ---------- 推荐 / Recommended（Type=R/*） ----------
  // 默认推荐词库：卡面色与「推荐」分区横条同色系（品牌蓝），点进去的词库详情页整页也走蓝强调色
  // （页强调色取 `book.tone`，见 `BOOK_TONE_COLORS` / `app/library/[bookId].tsx`）。
  // 词条数 20：预置词条数按 `wordCount` 取（见下方 `buildWords`），所以进度分母、卡片进度都是 20 词。
  {
    id: 'recommended-daily',
    coverText: 'Daily',
    subtitle: '20 Words',
    name: '日常 20 词·推荐词库',
    wordCount: 20,
    tone: 'blue',
    category: 'recommended',
    license: '内置示例词库',
    downloaded: true,
    studyCount: 0,
    description: '每天 20 个高频词，新用户默认推荐。',
  },
];

export const wordbookMap: Record<string, Wordbook> = wordbooks.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<string, Wordbook>,
);

/** 内置词条池；正式版由词库包按需下载（NFR-2） */
interface Seed {
  w: string;
  /** 英式音标（BrE） */
  uk: string;
  /** 美式音标（AmE） */
  us: string;
  /** 首条义项（最常见）：词性 / 英文释义 / 中文释义 */
  pos: string;
  en: string;
  zh: string;
  /** 追加义项（按字典顺序排在首条之后）：[词性, 英文释义, 中文释义] */
  more: [string, string, string][];
  /** 例句：[英文, 中文] 对；条数不定，界面默认最多展示 3 句 */
  exs: [string, string][];
  /** 派生词（同一词族的其它词形）：[词形, 词性, 英文释义, 中文释义] */
  dvs: [string, string, string, string][];
  /** 常用短语与固定搭配：[英文短语, 中文释义]；界面默认展示 3 个 */
  phrs: [string, string][];
}

const seeds: Seed[] = [
  {
    w: 'abandon',
    uk: '/əˈbændən/',
    us: '/əˈbændən/',
    pos: 'v.',
    en: 'to leave somebody or something behind',
    zh: '放弃；抛弃',
    exs: [
      ['He abandoned the plan halfway.', '他中途放弃了这个计划。'],
      ['The crew had to abandon the sinking ship.', '船员们不得不弃船逃生。'],
      ['She never abandoned hope of finding work.', '她从未放弃找到工作的希望。'],
    ],
    /** 追加义项（按字典顺序排在首条之后）：[词性, 英文释义, 中文释义] */
    more: [
      ['v.', 'to stop doing something before it is finished', '中止；放弃（做某事）'],
      ['n.', 'a way of behaving that shows no care or control', '放任；放纵'],
    ],
    /** 派生词（同一词族的其它词形）：[词形, 词性, 英文释义, 中文释义] */
    dvs: [
      ['abandonment', 'n.', 'the act of leaving somebody or something for good', '抛弃；遗弃'],
      ['abandoned', 'adj.', 'left alone and no longer cared for', '被遗弃的；废弃的'],
    ],
    /** 常用短语与固定搭配：[英文短语, 中文释义]（界面默认展示 3 个） */
    phrs: [
      ['abandon ship', '弃船；及时抽身'],
      ['abandon hope', '放弃希望'],
      ['abandon all hope', '彻底绝望'],
      ['with gay abandon', '纵情地；满不在乎地'],
      ['abandon oneself to', '沉溺于…'],
    ],
  },
  {
    w: 'benefit',
    uk: '/ˈbenɪfɪt/',
    us: '/ˈbenɪfɪt/',
    pos: 'n./v.',
    en: 'an advantage or profit gained from something',
    zh: '好处；有益于',
    exs: [
      ['Regular reading benefits your writing.', '经常阅读对你的写作有益。'],
      ['The new policy will benefit small farmers.', '新政策将让小农户受益。'],
      ['We can all benefit from honest feedback.', '我们都能从坦诚的反馈中受益。'],
    ],
    /** 追加义项（按字典顺序排在首条之后）：[词性, 英文释义, 中文释义] */
    more: [
      ['n.', 'money or help given by the state or an employer', '补助金；福利'],
      ['n.', 'an event held to raise money for a good cause', '慈善义演'],
    ],
    /** 派生词（同一词族的其它词形）：[词形, 词性, 英文释义, 中文释义] */
    dvs: [
      ['beneficial', 'adj.', 'having a good effect on somebody or something', '有益的'],
      ['beneficiary', 'n.', 'a person who receives money or property under a will', '受益人；受赠人'],
    ],
    /** 常用短语与固定搭配：[英文短语, 中文释义]（界面默认展示 3 个） */
    phrs: [
      ['benefit from', '从…中受益'],
      ['for the benefit of', '为了…的利益'],
      ['the benefit of the doubt', '（证据不足时）姑且相信'],
      ['be of benefit to', '对…有益'],
      ['mutual benefit', '互利'],
      ['reap the benefits of', '收获…的成果'],
    ],
  },
  {
    w: 'candidate',
    uk: '/ˈkændɪdət/',
    us: '/ˈkændɪdət/',
    pos: 'n.',
    en: 'a person who applies for a job or is nominated for election',
    zh: '候选人；应试者',
    exs: [
      ['Each candidate gave a short speech.', '每位候选人都做了简短发言。'],
      ['She is a strong candidate for the post.', '她是这个职位的强力人选。'],
      ['Two candidates passed the written test.', '两名应试者通过了笔试。'],
    ],
    /** 追加义项（按字典顺序排在首条之后）：[词性, 英文释义, 中文释义] */
    more: [
      ['n.', 'a person who takes an examination', '应试者；考生'],
      ['n.', 'something considered suitable for a particular purpose', '合适之物；候选对象'],
    ],
    /** 派生词（同一词族的其它词形）：[词形, 词性, 英文释义, 中文释义] */
    dvs: [
      ['candidacy', 'n.', 'the position of being a candidate in an election', '候选人身份'],
      ['candidature', 'n.', 'the fact of being a candidate for a job or post', '候选资格'],
    ],
    /** 常用短语与固定搭配：[英文短语, 中文释义]（界面默认展示 3 个） */
    phrs: [
      ['a candidate for', '角逐…的人；…的候选'],
      ['stand as a candidate', '作为候选人参加竞选'],
      ['a strong candidate for', '很有希望…的人选'],
      ['the leading candidate', '领先的候选人'],
      ['a likely candidate', '可能的人选'],
      ['presidential candidate', '总统候选人'],
    ],
  },
  {
    w: 'deliberate',
    uk: '/dɪˈlɪbərət/',
    us: '/dɪˈlɪbərət/',
    pos: 'adj./v.',
    en: 'done consciously and intentionally',
    zh: '故意的；仔细考虑',
    exs: [
      ['It was a deliberate choice.', '那是一个刻意的选择。'],
      ['He spoke in a slow, deliberate way.', '他说话缓慢而从容。'],
      ['The board will deliberate before voting.', '董事会将在投票前仔细商议。'],
    ],
    /** 追加义项（按字典顺序排在首条之后）：[词性, 英文释义, 中文释义] */
    more: [
      ['v.', 'to think or talk about something carefully before deciding', '仔细考虑；商议'],
      ['adj.', 'slow and careful, not hurried', '从容不迫的；沉稳的'],
    ],
    /** 派生词（同一词族的其它词形）：[词形, 词性, 英文释义, 中文释义] */
    dvs: [
      ['deliberately', 'adv.', 'in a way that is intended or planned', '故意地'],
      ['deliberation', 'n.', 'long and careful discussion or thinking', '审议；从容'],
    ],
    /** 常用短语与固定搭配：[英文短语, 中文释义]（界面默认展示 3 个） */
    phrs: [
      ['deliberate on', '仔细考虑…'],
      ['deliberate over', '反复斟酌…'],
      ['a deliberate attempt to', '蓄意…的行为'],
      ['a deliberate act', '故意行为'],
      ['in a deliberate manner', '从容不迫地'],
      ['with deliberate intent', '蓄意地'],
    ],
  },
  {
    w: 'efficient',
    uk: '/ɪˈfɪʃnt/',
    us: '/ɪˈfɪʃnt/',
    pos: 'adj.',
    en: 'working well without wasting time or energy',
    zh: '高效的',
    exs: [
      ['The new method is far more efficient.', '新方法效率高得多。'],
      ['Reading on the train is an efficient use of time.', '在火车上阅读是高效利用时间。'],
      ['A clear plan makes the team more efficient.', '清晰的计划让团队更高效。'],
    ],
    /** 追加义项（按字典顺序排在首条之后）：[词性, 英文释义, 中文释义] */
    more: [
      ['adj.', 'of a person, able to work well without waste', '（人）干练的；有能力的'],
    ],
    /** 派生词（同一词族的其它词形）：[词形, 词性, 英文释义, 中文释义] */
    dvs: [
      ['efficiency', 'n.', 'the quality of doing something well without waste', '效率'],
      ['efficiently', 'adv.', 'in a way that wastes no time or energy', '高效地'],
      ['inefficient', 'adj.', 'not working well and wasting time or money', '低效的'],
    ],
    /** 常用短语与固定搭配：[英文短语, 中文释义]（界面默认展示 3 个） */
    phrs: [
      ['efficient at', '擅长…'],
      ['an efficient use of', '对…的高效利用'],
      ['highly efficient', '效率极高的'],
      ['energy-efficient', '节能的'],
      ['cost-efficient', '划算的；成本效益高的'],
      ['fuel-efficient', '省油的'],
    ],
  },
  {
    w: 'fatigue',
    uk: '/fəˈtiːɡ/',
    us: '/fəˈtiːɡ/',
    pos: 'n.',
    en: 'extreme tiredness',
    zh: '疲劳',
    exs: [
      ['Fatigue slowed the whole team down.', '疲劳拖慢了整个队伍。'],
      ['After the exam, fatigue set in quickly.', '考试结束后，疲劳很快袭来。'],
      ['Drivers should rest before fatigue affects them.', '司机应在疲劳影响自己之前休息。'],
    ],
    /** 追加义项（按字典顺序排在首条之后）：[词性, 英文释义, 中文释义] */
    more: [
      ['n.', 'the tendency of a material to break after repeated stress', '（材料的）疲劳'],
      ['v.', 'to make somebody very tired', '使疲劳；使劳累'],
    ],
    /** 派生词（同一词族的其它词形）：[词形, 词性, 英文释义, 中文释义] */
    dvs: [
      ['fatigued', 'adj.', 'very tired, especially after hard work', '疲惫的'],
      ['fatiguing', 'adj.', 'making somebody feel very tired', '令人疲惫的'],
    ],
    /** 常用短语与固定搭配：[英文短语, 中文释义]（界面默认展示 3 个） */
    phrs: [
      ['fatigue sets in', '疲劳袭来'],
      ['suffer from fatigue', '长期感到疲劳'],
      ['metal fatigue', '金属疲劳'],
      ['driver fatigue', '驾驶疲劳'],
      ['compassion fatigue', '同情疲劳'],
      ['mental fatigue', '精神疲劳'],
    ],
  },
  {
    w: 'genuine',
    uk: '/ˈdʒenjuɪn/',
    us: '/ˈdʒenjuɪn/',
    pos: 'adj.',
    en: 'truly what something is said to be',
    zh: '真实的；真诚的',
    exs: [
      ['She showed genuine interest in the topic.', '她对这个话题表现出真诚的兴趣。'],
      ['The bag is made of genuine leather.', '这个包是真皮做的。'],
      ['His surprise seemed entirely genuine.', '他的惊讶看起来完全是真实的。'],
    ],
    /** 追加义项（按字典顺序排在首条之后）：[词性, 英文释义, 中文释义] */
    more: [
      ['adj.', 'sincere and honest in the way you feel', '真诚的；真心实意的'],
    ],
    /** 派生词（同一词族的其它词形）：[词形, 词性, 英文释义, 中文释义] */
    dvs: [
      ['genuinely', 'adv.', 'in a way that is sincere and honest', '真正地；真诚地'],
      ['genuineness', 'n.', 'the quality of being real or sincere', '真诚；真实'],
    ],
    /** 常用短语与固定搭配：[英文短语, 中文释义]（界面默认展示 3 个） */
    phrs: [
      ['the genuine article', '真品；正宗货'],
      ['genuine leather', '真皮'],
      ['genuine interest in', '对…的真正兴趣'],
      ['out of genuine concern', '出于真诚的关心'],
      ['a genuine smile', '真诚的微笑'],
      ['genuine sympathy', '真诚的同情'],
    ],
  },
  {
    w: 'highlight',
    uk: '/ˈhaɪlaɪt/',
    us: '/ˈhaɪlaɪt/',
    pos: 'v./n.',
    en: 'to draw special attention to something',
    zh: '强调；亮点',
    exs: [
      ['Let me highlight two key points.', '我来强调两个要点。'],
      ['The report highlights the risk of delay.', '报告强调了延误的风险。'],
      ['The trip was the highlight of the year.', '那次旅行是那一年的亮点。'],
    ],
    /** 追加义项（按字典顺序排在首条之后）：[词性, 英文释义, 中文释义] */
    more: [
      ['n.', 'the best or most important part of something', '最精彩的部分；亮点'],
      ['n.', 'a bright area in a picture or on hair', '（图片或头发上的）高光；挑染'],
    ],
    /** 派生词（同一词族的其它词形）：[词形, 词性, 英文释义, 中文释义] */
    dvs: [
      ['highlighted', 'adj.', 'marked or stressed as especially important', '被突出的'],
      ['highlighter', 'n.', 'a pen with bright ink used to mark text', '荧光笔'],
    ],
    /** 常用短语与固定搭配：[英文短语, 中文释义]（界面默认展示 3 个） */
    phrs: [
      ['the highlight of', '…最精彩的部分'],
      ['highlight reel', '精彩集锦'],
      ['news highlights', '新闻摘要'],
      ['highlight the need for', '凸显…的必要性'],
      ['highlight the fact that', '强调…这一事实'],
      ['highlights and lowlights', '挑染的亮色与暗色'],
    ],
  },
  {
    w: 'identify',
    uk: '/aɪˈdentɪfaɪ/',
    us: '/aɪˈdentɪfaɪ/',
    pos: 'v.',
    en: 'to recognize and correctly name something',
    zh: '识别；确认',
    exs: [
      ['Please identify the main idea first.', '请先识别出主旨。'],
      ['Can you identify the man in the photo?', '你能认出照片里的这个男人吗？'],
      ['The test helps identify weak points.', '这个测试有助于识别薄弱环节。'],
    ],
    /** 追加义项（按字典顺序排在首条之后）：[词性, 英文释义, 中文释义] */
    more: [
      ['v.', 'to discover or notice something', '发现；察觉'],
      ['v.', 'to feel you share the feelings of another person', '感同身受；认同'],
    ],
    /** 派生词（同一词族的其它词形）：[词形, 词性, 英文释义, 中文释义] */
    dvs: [
      ['identity', 'n.', 'who or what somebody or something is', '身份；特性'],
      ['identification', 'n.', 'the act of recognizing somebody or something', '识别；身份证明'],
      ['identifiable', 'adj.', 'able to be recognized', '可辨认的'],
    ],
    /** 常用短语与固定搭配：[英文短语, 中文释义]（界面默认展示 3 个） */
    phrs: [
      ['identify with', '认同；与…共鸣'],
      ['identify as', '自认是…'],
      ['identify the cause of', '查明…的原因'],
      ['be identified with', '与…联系在一起'],
      ['identify the difference between', '分辨…的差别'],
      ['identify by name', '叫得出名字；指名'],
    ],
  },
  {
    w: 'justify',
    uk: '/ˈdʒʌstɪfaɪ/',
    us: '/ˈdʒʌstɪfaɪ/',
    pos: 'v.',
    en: 'to show that something is reasonable',
    zh: '证明…正当',
    exs: [
      ['Can you justify your conclusion?', '你能证明你的结论吗？'],
      ['Nothing can justify such rudeness.', '任何理由都不能为这种无礼开脱。'],
      ['He used data to justify the decision.', '他用数据证明这个决定的合理性。'],
    ],
    /** 追加义项（按字典顺序排在首条之后）：[词性, 英文释义, 中文释义] */
    more: [
      ['v.', 'to be a good reason for something', '成为…的理由'],
      ['v.', 'to give a good reason for something', '为…说明理由；辩解'],
    ],
    /** 派生词（同一词族的其它词形）：[词形, 词性, 英文释义, 中文释义] */
    dvs: [
      ['justification', 'n.', 'a good reason for something', '正当理由'],
      ['justifiable', 'adj.', 'able to be shown to be right or reasonable', '有道理的'],
      ['unjustified', 'adj.', 'not having a good or fair reason', '不合理的；无正当理由的'],
    ],
    /** 常用短语与固定搭配：[英文短语, 中文释义]（界面默认展示 3 个） */
    phrs: [
      ['the end justifies the means', '为达目的不择手段'],
      ['justify oneself', '为自己辩解'],
      ['be justified in doing', '有理由做…'],
      ['justify the expense', '说明这笔开销的合理性'],
      ['justify your answer', '说明你的理由（答题要求）'],
      ['justify a decision', '为决定提供依据'],
    ],
  },
  {
    w: 'keen',
    uk: '/kiːn/',
    us: '/kiːn/',
    pos: 'adj.',
    en: 'very interested or eager',
    zh: '热衷的；敏锐的',
    exs: [
      ['He is keen on language learning.', '他热衷语言学习。'],
      ['She has a keen eye for detail.', '她对细节有敏锐的观察力。'],
      ['I am keen to start the new course.', '我渴望开始新课程。'],
    ],
    /** 追加义项（按字典顺序排在首条之后）：[词性, 英文释义, 中文释义] */
    more: [
      ['adj.', 'strong and sharp, of a feeling or the senses', '强烈的；敏锐的'],
      ['adj.', 'of a blade, sharp and able to cut well', '锋利的；锐利的'],
    ],
    /** 派生词（同一词族的其它词形）：[词形, 词性, 英文释义, 中文释义] */
    dvs: [
      ['keenly', 'adv.', 'in a way that shows strong interest or sharp feeling', '敏锐地；热切地'],
      ['keenness', 'n.', 'great interest or enthusiasm', '热切；敏锐'],
    ],
    /** 常用短语与固定搭配：[英文短语, 中文释义]（界面默认展示 3 个） */
    phrs: [
      ['keen on', '热衷于'],
      ['keen to do', '渴望做…'],
      ['as keen as mustard', '非常热心'],
      ['a keen eye for', '对…的敏锐眼光'],
      ['keen interest in', '对…的浓厚兴趣'],
      ['keen competition', '激烈的竞争'],
    ],
  },
  {
    w: 'legitimate',
    uk: '/lɪˈdʒɪtɪmət/',
    us: '/lɪˈdʒɪtɪmət/',
    pos: 'adj.',
    en: 'conforming to the law or to rules',
    zh: '合法的；合理的',
    exs: [
      ['That is a legitimate concern.', '那是一个合理的担忧。'],
      ['Only legitimate businesses can apply.', '只有合法企业可以申请。'],
      ['They had a legitimate reason to complain.', '他们有正当理由抱怨。'],
    ],
    /** 追加义项（按字典顺序排在首条之后）：[词性, 英文释义, 中文释义] */
    more: [
      ['adj.', 'reasonable and able to be defended', '合理的；站得住脚的'],
    ],
    /** 派生词（同一词族的其它词形）：[词形, 词性, 英文释义, 中文释义] */
    dvs: [
      ['legitimacy', 'n.', 'the state of being allowed by law or reasonable', '合法性；正当性'],
      ['legitimately', 'adv.', 'in a way that is allowed by law', '合法地；正当地'],
      ['illegitimate', 'adj.', 'not allowed by law or not fair', '非法的；不合规的'],
    ],
    /** 常用短语与固定搭配：[英文短语, 中文释义]（界面默认展示 3 个） */
    phrs: [
      ['a legitimate concern', '合理的担忧'],
      ['a legitimate reason for', '…的正当理由'],
      ['a legitimate business', '合法经营的企业'],
      ['legitimate authority', '合法权力'],
      ['a legitimate claim to', '对…的正当主张'],
      ['legitimate expectation', '合法期待'],
    ],
  },
  {
    w: 'moderate',
    uk: '/ˈmɒdərət/',
    us: '/ˈmɑːdərət/',
    pos: 'adj./v.',
    en: 'average in amount or intensity',
    zh: '适度的；缓和',
    exs: [
      ['Moderate exercise helps memory.', '适度锻炼有助于记忆。'],
      ['Prices rose at a moderate pace.', '物价以温和的速度上涨。'],
      ['Try to moderate your tone in meetings.', '在会议上尽量缓和你的语气。'],
    ],
    /** 追加义项（按字典顺序排在首条之后）：[词性, 英文释义, 中文释义] */
    more: [
      ['v.', 'to make something less extreme or less strong', '使缓和；使减轻'],
      ['n.', 'a person whose opinions are not extreme', '温和派人士'],
      ['adj.', 'neither very good nor very bad', '中等的；过得去的'],
    ],
    /** 派生词（同一词族的其它词形）：[词形, 词性, 英文释义, 中文释义] */
    dvs: [
      ['moderately', 'adv.', 'to a degree that is neither too much nor too little', '适度地'],
      ['moderation', 'n.', 'the quality of not being extreme', '节制；适度'],
      ['immoderate', 'adj.', 'going beyond what is reasonable', '过度的；无节制的'],
    ],
    /** 常用短语与固定搭配：[英文短语, 中文释义]（界面默认展示 3 个） */
    phrs: [
      ['moderate in', '在…方面有节制'],
      ['moderate exercise', '适量运动'],
      ['moderate your language', '收敛言辞'],
      ['a moderate increase', '小幅上涨'],
      ['moderate voters', '温和派选民'],
      ['of moderate size', '中等大小的'],
    ],
  },
  {
    w: 'notion',
    uk: '/ˈnəʊʃn/',
    us: '/ˈnoʊʃn/',
    pos: 'n.',
    en: 'a belief or idea',
    zh: '观念；想法',
    exs: [
      ['I reject that notion entirely.', '我完全不同意那个观念。'],
      ['He has no notion of how much it costs.', '他完全不知道那要花多少钱。'],
      ['The notion of enough differs from person to person.', '「足够」的含义因人而异。'],
    ],
    /** 追加义项（按字典顺序排在首条之后）：[词性, 英文释义, 中文释义] */
    more: [
      ['n.', 'a desire or intention to do something', '想法；打算'],
    ],
    /** 派生词（同一词族的其它词形）：[词形, 词性, 英文释义, 中文释义] */
    dvs: [
      ['notional', 'adj.', 'existing as an idea rather than in fact', '概念上的；名义上的'],
    ],
    /** 常用短语与固定搭配：[英文短语, 中文释义]（界面默认展示 3 个） */
    phrs: [
      ['have no notion of', '对…毫无概念'],
      ['the notion that', '…这一观念'],
      ['a preconceived notion', '先入之见'],
      ['dispel the notion', '打消这种观念'],
      ['challenge the notion', '质疑这种观念'],
      ['a vague notion', '模糊的概念'],
    ],
  },
  {
    w: 'obstacle',
    uk: '/ˈɒbstəkl/',
    us: '/ˈɑːbstəkl/',
    pos: 'n.',
    en: 'something that blocks progress',
    zh: '障碍',
    exs: [
      ['Cost is the biggest obstacle.', '成本是最大的障碍。'],
      ['Language can be an obstacle at work.', '语言在工作中可能成为障碍。'],
      ['She overcame every obstacle in her way.', '她克服了前进路上的每一个障碍。'],
    ],
    /** 追加义项（按字典顺序排在首条之后）：[词性, 英文释义, 中文释义] */
    more: [
      ['n.', 'a situation or fact that prevents progress', '阻力；妨碍因素'],
      ['n.', 'something that must be jumped over in a race', '（赛跑中的）障碍物'],
    ],
    /** 派生词（同一词族的其它词形）：[词形, 词性, 英文释义, 中文释义] */
    dvs: [
      ['obstruct', 'v.', 'to block a road or prevent progress', '阻碍；阻塞'],
      ['obstruction', 'n.', 'the act of blocking something', '阻碍；障碍物'],
      ['obstructive', 'adj.', 'deliberately making things difficult', '故意阻碍的'],
    ],
    /** 常用短语与固定搭配：[英文短语, 中文释义]（界面默认展示 3 个） */
    phrs: [
      ['an obstacle to', '…的障碍'],
      ['overcome an obstacle', '克服障碍'],
      ['an obstacle course', '障碍赛道'],
      ['put obstacles in the way of', '给…设置阻碍'],
      ['a major obstacle', '主要障碍'],
    ],
  },
  {
    w: 'precise',
    uk: '/prɪˈsaɪs/',
    us: '/prɪˈsaɪs/',
    pos: 'adj.',
    en: 'marked by exactness',
    zh: '精确的',
    exs: [
      ['Give me a precise number.', '给我一个精确的数字。'],
      ['The instructions are short but precise.', '说明简短但精确。'],
      ['At that precise moment the phone rang.', '正在那一刻电话响了。'],
    ],
    /** 追加义项（按字典顺序排在首条之后）：[词性, 英文释义, 中文释义] */
    more: [
      ['adj.', 'careful and accurate about details', '一丝不苟的；严谨的'],
      ['adj.', 'exactly the one mentioned', '正是的；确切的'],
    ],
    /** 派生词（同一词族的其它词形）：[词形, 词性, 英文释义, 中文释义] */
    dvs: [
      ['precision', 'n.', 'the quality of being exact and accurate', '精确；精密'],
      ['precisely', 'adv.', 'exactly, or in an exact way', '精确地；恰好'],
      ['imprecise', 'adj.', 'not exact or accurate', '不精确的'],
    ],
    /** 常用短语与固定搭配：[英文短语, 中文释义]（界面默认展示 3 个） */
    phrs: [
      ['to be precise', '确切地说'],
      ['at that precise moment', '正是那一刻'],
      ['precise about', '对…要求精确'],
      ['precise to', '精确到…'],
      ['a precise definition of', '…的准确界定'],
      ['precise wording', '确切的措辞'],
    ],
  },
  {
    w: 'quota',
    uk: '/ˈkwəʊtə/',
    us: '/ˈkwoʊtə/',
    pos: 'n.',
    en: 'a fixed share or limit',
    zh: '定额；配额',
    exs: [
      ['The daily quota is five tasks.', '每日定额是五个任务。'],
      ['Each team has a strict import quota.', '每个团队都有严格的进口配额。'],
    ],
    /** 追加义项（按字典顺序排在首条之后）：[词性, 英文释义, 中文释义] */
    more: [
      ['n.', 'the share of work that somebody must do', '份额；分摊额'],
      ['n.', 'a fixed number of people allowed to enter a country', '（入境）限额'],
    ],
    /** 派生词（同一词族的其它词形）：[词形, 词性, 英文释义, 中文释义] */
    dvs: [],
    /** 常用短语与固定搭配：[英文短语, 中文释义]（界面默认展示 3 个） */
    phrs: [
      ['meet a quota', '完成配额'],
      ['impose a quota on', '对…实行配额限制'],
      ['a quota system', '配额制度'],
      ['fill your quota', '完成自己的份额'],
      ['exceed the quota', '超出限额'],
      ['an import quota', '进口配额'],
    ],
  },
  {
    w: 'reluctant',
    uk: '/rɪˈlʌktənt/',
    us: '/rɪˈlʌktənt/',
    pos: 'adj.',
    en: 'unwilling and hesitant',
    zh: '不情愿的',
    exs: [
      ['She was reluctant to speak first.', '她不愿先开口。'],
      ['He gave a reluctant nod.', '他勉强点了点头。'],
      ['Many were reluctant to change old habits.', '很多人不愿意改变旧习惯。'],
    ],
    /** 追加义项（按字典顺序排在首条之后）：[词性, 英文释义, 中文释义] */
    more: [
      ['adj.', 'slow to do something because you are not sure about it', '迟疑的；勉强的'],
    ],
    /** 派生词（同一词族的其它词形）：[词形, 词性, 英文释义, 中文释义] */
    dvs: [
      ['reluctance', 'n.', 'the feeling of being unwilling to do something', '不情愿；勉强'],
      ['reluctantly', 'adv.', 'in an unwilling and hesitant way', '不情愿地'],
    ],
    /** 常用短语与固定搭配：[英文短语, 中文释义]（界面默认展示 3 个） */
    phrs: [
      ['reluctant to do', '不愿做…'],
      ['a reluctant hero', '不情愿的英雄'],
      ['reluctant agreement', '勉强的同意'],
      ['reluctant witness', '不愿作证的证人'],
      ['reluctant acceptance', '勉强接受'],
      ['reluctant about', '对…态度犹豫'],
    ],
  },
  {
    w: 'substantial',
    uk: '/səbˈstænʃl/',
    us: '/səbˈstænʃl/',
    pos: 'adj.',
    en: 'of considerable importance or size',
    zh: '可观的；实质的',
    exs: [
      ['He made substantial progress.', '他取得了可观的进步。'],
      ['The project needs substantial funding.', '这个项目需要可观的资金。'],
      ['There is substantial evidence for the claim.', '这一说法有大量证据支持。'],
    ],
    /** 追加义项（按字典顺序排在首条之后）：[词性, 英文释义, 中文释义] */
    more: [
      ['adj.', 'strongly built and solid', '结实的；坚固的'],
      ['adj.', 'real and important rather than only formal', '实质性的'],
    ],
    /** 派生词（同一词族的其它词形）：[词形, 词性, 英文释义, 中文释义] */
    dvs: [
      ['substance', 'n.', 'a material, or the most important part of something', '物质；实质'],
      ['substantially', 'adv.', 'very much, or in an important way', '大幅度地；实质上'],
      ['substantive', 'adj.', 'important and real, not only formal', '实质性的'],
    ],
    /** 常用短语与固定搭配：[英文短语, 中文释义]（界面默认展示 3 个） */
    phrs: [
      ['a substantial amount of', '大量的…'],
      ['substantial evidence', '确凿的证据'],
      ['a substantial meal', '丰盛的一餐'],
      ['a substantial sum', '一大笔钱'],
      ['substantial damages', '巨额损害赔偿'],
      ['substantial progress', '实质性进展'],
    ],
  },
  {
    w: 'tolerate',
    uk: '/ˈtɒləreɪt/',
    us: '/ˈtɑːləreɪt/',
    pos: 'v.',
    en: 'to allow the existence of something',
    zh: '容忍；忍受',
    exs: [
      ['I cannot tolerate careless mistakes.', '我不能容忍粗心错误。'],
      ['The plant tolerates dry weather well.', '这种植物很耐旱。'],
      ['The school will not tolerate cheating.', '学校不会容忍作弊。'],
    ],
    /** 追加义项（按字典顺序排在首条之后）：[词性, 英文释义, 中文释义] */
    more: [
      ['v.', 'to accept something unpleasant without becoming annoyed', '忍受；容忍'],
      ['v.', 'to be able to be affected by something without harm', '耐受；经得起'],
    ],
    /** 派生词（同一词族的其它词形）：[词形, 词性, 英文释义, 中文释义] */
    dvs: [
      ['tolerance', 'n.', 'the ability to accept what you dislike', '容忍；宽容'],
      ['tolerant', 'adj.', 'willing to accept ways of thinking that differ', '宽容的'],
      ['intolerance', 'n.', 'unwillingness to accept different views', '不宽容；偏狭'],
    ],
    /** 常用短语与固定搭配：[英文短语, 中文释义]（界面默认展示 3 个） */
    phrs: [
      ['will not tolerate', '绝不姑息'],
      ['refuse to tolerate', '拒绝容忍'],
      ['tolerate differences', '包容差异'],
      ['tolerate dissent', '容忍异议'],
      ['tolerate alcohol', '耐受酒精'],
      ['tolerate pain', '忍受疼痛'],
    ],
  },
  {
    w: 'urge',
    uk: '/ɜːdʒ/',
    us: '/ɜːrdʒ/',
    pos: 'v./n.',
    en: 'to try earnestly to persuade',
    zh: '敦促；强烈愿望',
    exs: [
      ['They urged him to apply early.', '他们敦促他尽早申请。'],
      ['I had a sudden urge to laugh.', '我突然有种想笑的冲动。'],
      ['Doctors urge people to sleep more.', '医生敦促人们多睡觉。'],
    ],
    /** 追加义项（按字典顺序排在首条之后）：[词性, 英文释义, 中文释义] */
    more: [
      ['v.', 'to strongly advise somebody to do something', '力劝；主张'],
      ['n.', 'a strong wish or need to do something', '强烈的欲望；冲动'],
    ],
    /** 派生词（同一词族的其它词形）：[词形, 词性, 英文释义, 中文释义] */
    dvs: [
      ['urgent', 'adj.', 'needing immediate attention', '紧急的'],
      ['urgency', 'n.', 'the state of needing to be dealt with at once', '紧迫性'],
      ['urgently', 'adv.', 'in a way that needs immediate action', '紧急地'],
    ],
    /** 常用短语与固定搭配：[英文短语, 中文释义]（界面默认展示 3 个） */
    phrs: [
      ['urge somebody to do', '敦促某人做…'],
      ['urge against', '力劝不要…'],
      ['a sudden urge to', '突然想…的冲动'],
      ['resist the urge to', '忍住…的冲动'],
      ['have an urge to', '有做…的冲动'],
      ['urge caution', '呼吁谨慎'],
    ],
  },
  {
    w: 'vivid',
    uk: '/ˈvɪvɪd/',
    us: '/ˈvɪvɪd/',
    pos: 'adj.',
    en: 'producing powerful feelings or images',
    zh: '生动的',
    exs: [
      ['The essay gives a vivid picture.', '这篇文章描绘得很生动。'],
      ['I still have a vivid memory of that day.', '我对那天的记忆依然鲜明。'],
      ['She described the city in vivid detail.', '她生动细致地描述了这座城市。'],
    ],
    /** 追加义项（按字典顺序排在首条之后）：[词性, 英文释义, 中文释义] */
    more: [
      ['adj.', 'very bright and strong, of colours', '鲜艳的；鲜明的'],
      ['adj.', 'clear and detailed, of a memory', '清晰如昨的'],
    ],
    /** 派生词（同一词族的其它词形）：[词形, 词性, 英文释义, 中文释义] */
    dvs: [
      ['vividly', 'adv.', 'in a way that produces clear pictures in the mind', '生动地'],
      ['vividness', 'n.', 'the quality of being bright or clear', '生动；鲜明'],
    ],
    /** 常用短语与固定搭配：[英文短语, 中文释义]（界面默认展示 3 个） */
    phrs: [
      ['a vivid imagination', '丰富的想象力'],
      ['a vivid memory of', '对…清晰的记忆'],
      ['a vivid description of', '对…的生动描写'],
      ['paint a vivid picture of', '生动描绘…'],
      ['a vivid dream', '逼真的梦'],
      ['vivid colours', '鲜艳的色彩'],
    ],
  },
  {
    w: 'witness',
    uk: '/ˈwɪtnəs/',
    us: '/ˈwɪtnəs/',
    pos: 'n./v.',
    en: 'a person who sees an event',
    zh: '目击者；见证',
    exs: [
      ['We witnessed a real change.', '我们见证了一次真正的改变。'],
      ['The past decade witnessed rapid growth.', '过去十年见证了快速增长。'],
      ['She was the only witness to the accident.', '她是这场事故唯一的目击者。'],
    ],
    /** 追加义项（按字典顺序排在首条之后）：[词性, 英文释义, 中文释义] */
    more: [
      ['v.', 'to see something happen', '目睹；目击'],
      ['n.', 'a person who gives evidence in court', '（法庭上的）证人'],
    ],
    /** 派生词（同一词族的其它词形）：[词形, 词性, 英文释义, 中文释义] */
    dvs: [
      ['eyewitness', 'n.', 'a person who actually sees an event happen', '目击者'],
    ],
    /** 常用短语与固定搭配：[英文短语, 中文释义]（界面默认展示 3 个） */
    phrs: [
      ['bear witness to', '证明；为…作证'],
      ['witness an accident', '目睹事故'],
      ['a key witness', '关键证人'],
      ['witness statement', '证人陈述'],
      ['the witness stand', '证人席'],
      ['call somebody as a witness', '传唤某人作证'],
    ],
  },
  {
    w: 'yield',
    uk: '/jiːld/',
    us: '/jiːld/',
    pos: 'v./n.',
    en: 'to produce or give way',
    zh: '产生；让出',
    exs: [
      ['The test yielded clear results.', '这次测试得出了明确的结果。'],
      ['The farm yields two crops a year.', '这个农场一年产两季作物。'],
      ['He refused to yield to pressure.', '他拒绝对压力让步。'],
    ],
    /** 追加义项（按字典顺序排在首条之后）：[词性, 英文释义, 中文释义] */
    more: [
      ['n.', 'the amount produced or the profit made', '产量；收益'],
      ['v.', 'to give way to pressure', '让步；屈服'],
      ['v.', 'to bend or break under pressure', '（受压）弯曲；断裂'],
    ],
    /** 派生词（同一词族的其它词形）：[词形, 词性, 英文释义, 中文释义] */
    dvs: [
      ['yielding', 'adj.', 'giving way under pressure, or producing a good crop', '让步的；高产的'],
      ['unyielding', 'adj.', 'not willing to change or give way', '不屈的；坚定的'],
    ],
    /** 常用短语与固定搭配：[英文短语, 中文释义]（界面默认展示 3 个） */
    phrs: [
      ['yield to', '让步于；服从'],
      ['yield to temptation', '屈服于诱惑'],
      ['yield results', '产生成果'],
      ['yield up', '交出'],
      ['a high yield', '高产量；高收益'],
      ['bond yield', '债券收益率'],
    ],
  },
  {
    w: 'accurate',
    uk: '/ˈækjərət/',
    us: '/ˈækjərət/',
    pos: 'adj.',
    en: 'correct in all details',
    zh: '准确的',
    exs: [
      ['Her report is accurate.', '她的报告很准确。'],
      ['The clock keeps accurate time.', '这只钟走时准确。'],
      ['We need a more accurate estimate.', '我们需要更准确的估计。'],
    ],
    /** 追加义项（按字典顺序排在首条之后）：[词性, 英文释义, 中文释义] */
    more: [
      ['adj.', 'able to hit the intended target', '精准的；击中目标的'],
    ],
    /** 派生词（同一词族的其它词形）：[词形, 词性, 英文释义, 中文释义] */
    dvs: [
      ['accuracy', 'n.', 'the quality of being exact and correct', '准确性'],
      ['accurately', 'adv.', 'in an exact and correct way', '准确地'],
      ['inaccurate', 'adj.', 'not completely correct', '不准确的'],
      ['inaccuracy', 'n.', 'a piece of wrong information', '错误；不准确之处'],
    ],
    /** 常用短语与固定搭配：[英文短语, 中文释义]（界面默认展示 3 个） */
    phrs: [
      ['accurate to two decimal places', '精确到小数点后两位'],
      ['to be accurate', '准确地说'],
      ['an accurate reflection of', '…的准确反映'],
      ['historically accurate', '符合史实的'],
      ['factually accurate', '与事实相符的'],
      ['an accurate account of', '对…的准确叙述'],
    ],
  },
  {
    w: 'comprehensive',
    uk: '/ˌkɒmprɪˈhensɪv/',
    us: '/ˌkɑːmprɪˈhensɪv/',
    pos: 'adj.',
    en: 'including everything necessary',
    zh: '全面的',
    exs: [
      ['We need a comprehensive review.', '我们需要一次全面复盘。'],
      ['The book offers a comprehensive guide.', '这本书提供了全面的指南。'],
      ['She has comprehensive knowledge of the field.', '她对该领域有全面的了解。'],
    ],
    /** 追加义项（按字典顺序排在首条之后）：[词性, 英文释义, 中文释义] */
    more: [
      ['n.', 'an examination taken at the end of secondary school in Britain', '（英国的）综合中学毕业考试'],
    ],
    /** 派生词（同一词族的其它词形）：[词形, 词性, 英文释义, 中文释义] */
    dvs: [
      ['comprehend', 'v.', 'to understand something fully', '理解；领会'],
      ['comprehension', 'n.', 'the ability to understand', '理解力'],
      ['comprehensible', 'adj.', 'easy to understand', '易懂的'],
    ],
    /** 常用短语与固定搭配：[英文短语, 中文释义]（界面默认展示 3 个） */
    phrs: [
      ['comprehensive insurance', '综合险'],
      ['a comprehensive school', '综合中学（英国）'],
      ['a comprehensive review', '全面复审'],
      ['comprehensive coverage', '全面覆盖'],
      ['a comprehensive guide to', '…的全面指南'],
      ['take a comprehensive approach', '采取全面的方法'],
    ],
  },
  {
    w: 'diverse',
    uk: '/daɪˈvɜːs/',
    us: '/daɪˈvɜːrs/',
    pos: 'adj.',
    en: 'showing a great deal of variety',
    zh: '多样的',
    exs: [
      ['The topics are quite diverse.', '这些话题相当多样。'],
      ['The city has a diverse population.', '这座城市人口构成多样。'],
      ['We read texts from diverse cultures.', '我们阅读来自不同文化的文章。'],
    ],
    /** 追加义项（按字典顺序排在首条之后）：[词性, 英文释义, 中文释义] */
    more: [
      ['adj.', 'including people of many different types', '多元的；构成多样的'],
    ],
    /** 派生词（同一词族的其它词形）：[词形, 词性, 英文释义, 中文释义] */
    dvs: [
      ['diversity', 'n.', 'a range of many different types', '多样性'],
      ['diversify', 'v.', 'to develop a wider range of products or types', '使多样化'],
    ],
    /** 常用短语与固定搭配：[英文短语, 中文释义]（界面默认展示 3 个） */
    phrs: [
      ['a diverse range of', '各种各样的…'],
      ['culturally diverse', '文化多元的'],
      ['ethnically diverse', '族裔多元的'],
      ['a diverse group of', '由…构成的多元群体'],
      ['diverse in', '在…方面多样'],
      ['from diverse backgrounds', '来自不同背景'],
    ],
  },
  {
    w: 'enhance',
    uk: '/ɪnˈhɑːns/',
    us: '/ɪnˈhæns/',
    pos: 'v.',
    en: 'to increase the quality or value of',
    zh: '提升',
    exs: [
      ['Practice enhances fluency.', '练习能提升流利度。'],
      ['Good light enhances the photo.', '好的光线能提升照片效果。'],
      ['The course aims to enhance writing skills.', '这门课旨在提升写作能力。'],
    ],
    /** 追加义项（按字典顺序排在首条之后）：[词性, 英文释义, 中文释义] */
    more: [
      ['v.', 'to make something look or sound better', '美化；使更好看'],
      ['v.', 'to increase the value or price of something', '提高（价值）'],
    ],
    /** 派生词（同一词族的其它词形）：[词形, 词性, 英文释义, 中文释义] */
    dvs: [
      ['enhancement', 'n.', 'the act of improving something', '提升；增强'],
      ['enhanced', 'adj.', 'made better or greater in value', '增强的'],
    ],
    /** 常用短语与固定搭配：[英文短语, 中文释义]（界面默认展示 3 个） */
    phrs: [
      ['enhance the value of', '提升…的价值'],
      ['enhance the quality of', '提升…的质量'],
      ['enhance the reputation of', '提升…的声誉'],
      ['enhance the experience', '提升体验'],
      ['enhance performance', '提升性能'],
      ['enhance the image of', '改善…的形象'],
    ],
  },
  {
    w: 'flexible',
    uk: '/ˈfleksəbl/',
    us: '/ˈfleksəbl/',
    pos: 'adj.',
    en: 'able to change to suit new conditions',
    zh: '灵活的',
    exs: [
      ['Keep your schedule flexible.', '让你的日程保持灵活。'],
      ['The plan is flexible enough to change.', '这个计划足够灵活，可以调整。'],
      ['She is flexible about working hours.', '她在工作时间上比较灵活。'],
    ],
    /** 追加义项（按字典顺序排在首条之后）：[词性, 英文释义, 中文释义] */
    more: [
      ['adj.', 'able to bend or be bent easily', '柔韧的；可弯曲的'],
      ['adj.', 'willing to change and adapt', '变通的；乐于调整的'],
    ],
    /** 派生词（同一词族的其它词形）：[词形, 词性, 英文释义, 中文释义] */
    dvs: [
      ['flexibility', 'n.', 'the ability to change to suit new conditions', '灵活性'],
      ['inflexible', 'adj.', 'unwilling to change or be changed', '僵硬的；不灵活的'],
    ],
    /** 常用短语与固定搭配：[英文短语, 中文释义]（界面默认展示 3 个） */
    phrs: [
      ['flexible working hours', '弹性工作时间'],
      ['flexible about', '在…上灵活'],
      ['a flexible approach to', '对…的灵活做法'],
      ['stay flexible', '保持灵活'],
      ['flexible enough to', '灵活到足以…'],
      ['a flexible schedule', '弹性的日程'],
    ],
  },
  {
    w: 'gradually',
    uk: '/ˈɡrædʒuəli/',
    us: '/ˈɡrædʒuəli/',
    pos: 'adv.',
    en: 'in a slow way over time',
    zh: '逐渐地',
    exs: [
      ['Your accent improves gradually.', '你的口音会逐渐改善。'],
      ['The noise gradually died away.', '噪音逐渐消失了。'],
      ['He gradually got used to the new city.', '他逐渐习惯了这座新城市。'],
    ],
    /** 追加义项（按字典顺序排在首条之后）：[词性, 英文释义, 中文释义] */
    more: [
      ['adj.', 'happening slowly over a long period (gradual)', '逐渐的；渐进的（gradual）'],
    ],
    /** 派生词（同一词族的其它词形）：[词形, 词性, 英文释义, 中文释义] */
    dvs: [
      ['gradual', 'adj.', 'happening slowly over a long period', '逐渐的；渐进的'],
      ['gradualism', 'n.', 'a policy of making changes slowly in small steps', '渐进主义'],
    ],
    /** 常用短语与固定搭配：[英文短语, 中文释义]（界面默认展示 3 个） */
    phrs: [
      ['gradually build up', '逐步积累'],
      ['gradually fade away', '渐渐淡出'],
      ['gradually get used to', '渐渐习惯'],
      ['gradually take shape', '逐步成形'],
      ['gradually give way to', '逐渐让位于…'],
      ['gradually increase', '逐渐增加'],
    ],
  },
];

function buildWords(bookId: string, count: number): WordEntry[] {
  const out: WordEntry[] = [];
  for (let i = 0; i < count; i += 1) {
    const s = seeds[i % seeds.length];
    out.push({
      id: `${bookId}-${i + 1}`,
      word: s.w,
      phonetics: { uk: s.uk, us: s.us },
      senses: [
        { partOfSpeech: s.pos, definition: s.en, definitionZh: s.zh },
        ...s.more.map(([partOfSpeech, definition, definitionZh]) => ({
          partOfSpeech,
          definition,
          definitionZh,
        })),
      ],
      examples: s.exs.map(([en, zh]) => ({ en, zh })),
      derivatives: s.dvs.map(([word, partOfSpeech, definition, definitionZh]) => ({
        word,
        partOfSpeech,
        definition,
        definitionZh,
      })),
      phrases: s.phrs.map(([en, zh]) => ({ en, zh })),
    });
  }
  return out;
}

/**
 * 每个词库预置的可学习词条数（演示用）= 词库标称数量与内置种子池（30 条）的较小值：
 * 标称上千词的热门词库取满 30 条种子；标称 20 词的推荐词库就正好按 20 条建，
 * 于是进度分母（`getBookWordCount`）与词库自己声明的 `wordCount` 对得上。
 */
export const bookWords: Record<string, WordEntry[]> = wordbooks.reduce(
  (acc, book) => {
    acc[book.id] = buildWords(book.id, Math.min(30, book.wordCount));
    return acc;
  },
  {} as Record<string, WordEntry[]>,
);

export function getBookWords(bookId: string): WordEntry[] {
  return bookWords[bookId] ?? [];
}

/** 词库当前实际词条总数（实时统计，用于学习进度与课本卡片；wordCount 为词库标称数量） */
export function getBookWordCount(bookId: string): number {
  return (bookWords[bookId] ?? []).length;
}

/**
 * 单词 → 词条的反查索引（键为小写、去首尾空格的单词）。
 * 收藏夹里的单词除了来自词库，还可能来自翻译 / 探索 / 练习错词，这些入口只存了
 * 「单词 + 一句释义」；收藏夹的「详解」视图要靠它把单词还原成完整词条
 * （音标 / 义项 / 例句）；查不到时退回收藏条目自带的释义。
 * 同一个单词命中多本词库时取第一本（各词库的重合词内容一致）。
 */
const wordEntryByWord: Record<string, WordEntry> = (() => {
  const map: Record<string, WordEntry> = {};
  Object.keys(bookWords).forEach((bookId) => {
    bookWords[bookId].forEach((w) => {
      const key = w.word.trim().toLowerCase();
      if (!map[key]) map[key] = w;
    });
  });
  return map;
})();

export function findWordEntry(word: string): WordEntry | undefined {
  return wordEntryByWord[word.trim().toLowerCase()];
}
