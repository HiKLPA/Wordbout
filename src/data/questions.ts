import type { ExerciseTypeId } from '@/config/appConfig';

/** 练习题目 / 任务（FR-E-5 ~ FR-E-13） */
export interface ExerciseItem {
  id: string;
  typeId: ExerciseTypeId;
  levelId: string;
  /** 文体（阅读 / 翻译） */
  genre?: string;
  title: string;
  /** 题目要求 */
  prompt: string;
  /** 提问句（阅读理解的题目本身；prompt 只给「阅读文章后回答问题」这类通用指令） */
  question?: string;
  /** 音频 / 朗读文本 */
  audioText?: string;
  /** 选择题选项 */
  choices?: string[];
  answerIndex?: number;
  explanation?: string;
  /** 定位句 */
  evidence?: string;
  /** 参考范文 / 参考译文 */
  reference?: string;
  /** 写作要点 */
  points?: string[];
  /** 写作字数区间 */
  wordRange?: [number, number];
  /** 翻译原文 */
  sourceText?: string;
  direction?: 'zh-en' | 'en-zh';
  /** 跟读文本 */
  speakText?: string;
  /** 听写答案 */
  dictationAnswer?: string;
}

export const readingGenres = ['记叙文', '说明文', '议论文', '应用文'];
export const translatingGenres = ['新闻', '议论文', '学术论文'];
export const listeningGenres = ['新闻', '报告', '访谈'];

export const exerciseItems: ExerciseItem[] = [
  // ---------- FR-E-5 听写 ----------
  {
    id: 'dictation-daily-1',
    typeId: 'dictation',
    levelId: 'daily',
    title: '听写 · 第 1 套',
    prompt: '播放发音，拼写你听到的单词。',
    dictationAnswer: 'abandon',
    audioText: 'abandon',
  },
  {
    id: 'dictation-cet4-1',
    typeId: 'dictation',
    levelId: 'cet4',
    title: '听写 · 四级第 1 套',
    prompt: '播放发音，拼写你听到的单词。',
    dictationAnswer: 'genuine',
    audioText: 'genuine',
  },

  // ---------- FR-E-6 听力理解 ----------
  {
    id: 'comprehension-daily-1',
    typeId: 'comprehension',
    levelId: 'daily',
    genre: '新闻',
    title: '听力理解 · 新闻',
    prompt: '先完整播放音频，再选择正确答案。',
    audioText:
      'A new report says that moderate exercise can improve memory. Researchers followed two hundred students for three months.',
    choices: [
      'Moderate exercise can improve memory.',
      'Students should study for three months.',
      'Memory cannot be trained.',
      'Two hundred teachers joined the study.',
    ],
    answerIndex: 0,
    evidence: 'A new report says that moderate exercise can improve memory.',
    explanation: '音频第一句直接给出主旨：适度运动可以提升记忆。',
  },
  {
    id: 'comprehension-cet4-1',
    typeId: 'comprehension',
    levelId: 'cet4',
    genre: '访谈',
    title: '听力理解 · 访谈',
    prompt: '先完整播放音频，再选择正确答案。',
    audioText:
      'Interviewer: What is the biggest obstacle for new learners? Guest: Cost, and then confidence. Most of them quit in the second month.',
    choices: [
      'Cost and then confidence.',
      'Only the exam difficulty.',
      'The lack of textbooks.',
      'The length of the course.',
    ],
    answerIndex: 0,
    evidence: 'Cost, and then confidence.',
    explanation: '受访者按顺序回答了两个障碍：成本，其次是信心。',
  },

  // ---------- FR-E-7 写作（句子） ----------
  {
    id: 'writing-sentence-cet4-1',
    typeId: 'writing-sentence',
    levelId: 'cet4',
    title: '写作 · 句子 1',
    prompt: '用 "not only ... but also ..." 写一个句子，说明读书的两个好处。',
    points: ['使用 not only ... but also ...', '包含两个具体的读书好处', '不少于 20 个词'],
    wordRange: [20, 60],
    reference:
      'Reading not only broadens my vocabulary but also trains me to think in English, which makes my writing more natural.',
  },
  {
    id: 'writing-sentence-daily-1',
    typeId: 'writing-sentence',
    levelId: 'daily',
    title: '写作 · 句子 1',
    prompt: '用一句英文描述你昨天最有收获的一件事。',
    points: ['使用一般过去时', '说明收获', '不少于 15 个词'],
    wordRange: [15, 50],
    reference: 'Yesterday I finished my first dictation set, and I learned ten new words by checking every mistake.',
  },

  // ---------- FR-E-8 写作（短文） ----------
  {
    id: 'writing-passage-cet4-1',
    typeId: 'writing-passage',
    levelId: 'cet4',
    title: '写作 · 短文 1',
    prompt: 'Write a short essay on "How I plan my daily English practice".',
    points: ['文体：说明文', '包含时间安排与具体做法', '说明坚持的办法'],
    wordRange: [120, 180],
    reference:
      'How I plan my daily English practice\n\nI keep my practice short but regular. Every morning I spend ten minutes on dictation before class, and every evening I read one short passage aloud.\n\nTo make it work, I set two rules. First, I never open a new lesson before finishing the old one. Second, I write down every mistake in a notebook and review it on Sunday.\n\nThese two rules turn a vague wish into a habit, and the habit is what really moves my English forward.',
  },

  // ---------- FR-E-9 口语跟读（词与短语） ----------
  {
    id: 'speaking-word-daily-1',
    typeId: 'speaking-word',
    levelId: 'daily',
    title: '口语 · 词与短语 1',
    prompt: '先听标准发音，再录一遍。',
    speakText: 'substantial progress',
  },
  {
    id: 'speaking-word-cet4-1',
    typeId: 'speaking-word',
    levelId: 'cet4',
    title: '口语 · 词与短语 1',
    prompt: '先听标准发音，再录一遍。',
    speakText: 'a legitimate concern',
  },

  // ---------- FR-E-10 口语跟读（句子） ----------
  {
    id: 'speaking-sentence-daily-1',
    typeId: 'speaking-sentence',
    levelId: 'daily',
    title: '口语 · 句子 1',
    prompt: '整句跟读，注意重音与语调。',
    speakText: 'Moderate exercise helps memory, and it also improves your mood.',
  },

  // ---------- FR-E-11 口语跟读（短文） ----------
  {
    id: 'speaking-passage-daily-1',
    typeId: 'speaking-passage',
    levelId: 'daily',
    title: '口语 · 短文 1',
    prompt: '文章可分句朗读，也可整篇朗读；单句可重录。',
    speakText:
      'Learning a language is a long walk, not a sprint. / Small daily steps beat one long session a week. / Write down what you get wrong, and read it again on the weekend.',
  },

  // ---------- FR-E-12 阅读理解 ----------
  {
    id: 'reading-genre-cet4-1',
    typeId: 'reading-genre',
    levelId: 'cet4',
    genre: '说明文',
    title: '阅读理解 · 说明文',
    prompt: '阅读文章后回答问题。',
    question: 'According to the passage, what matters more in learning vocabulary?',
    audioText:
      'Many students believe that vocabulary is only about quantity. In fact, research on second language learning suggests that how often a word appears in different contexts matters more than how many words a learner memorises. A word met ten times in ten different passages is far easier to recall than the same word repeated ten times on one list. This is why reading widely is often more efficient than reviewing a single word list again and again.',
    choices: [
      'How often a word appears in different contexts.',
      'How many words a learner memorises in total.',
      'How long a learner studies every day.',
      'How difficult the reading passage is.',
    ],
    answerIndex: 0,
    evidence:
      'how often a word appears in different contexts matters more than how many words a learner memorises',
    explanation: '第二句把「出现语境的数量」与「记忆的词量」做了对比，前者更重要。',
  },
  {
    id: 'reading-genre-daily-1',
    typeId: 'reading-genre',
    levelId: 'daily',
    genre: '记叙文',
    title: '阅读理解 · 记叙文',
    prompt: '阅读文章后回答问题。',
    question: 'What did Lin do with the words that appeared most often?',
    audioText:
      'On the last day of the term, Lin finally finished her dictation notebook. She had written down every word she missed since March. Flipping through it, she was surprised to find that the same eight words appeared again and again. She copied them onto one card and reviewed it on the bus.',
    choices: [
      'She reviewed the words that appeared most often.',
      'She threw the notebook away.',
      'She started a new notebook immediately.',
      'She asked a friend to read the notebook.',
    ],
    answerIndex: 0,
    evidence: 'She copied them onto one card and reviewed it on the bus.',
    explanation: '她发现重复出现的八个词，抄到一张卡上并复习。',
  },

  // ---------- FR-E-13 翻译 ----------
  {
    id: 'translating-genre-cet4-1',
    typeId: 'translating-genre',
    levelId: 'cet4',
    genre: '议论文',
    direction: 'zh-en',
    title: '翻译 · 议论文',
    prompt: '将下面这段话翻译成英文。',
    sourceText:
      '越来越多的人开始意识到，坚持每天练习比偶尔突击更有效。原因很简单：语言能力来自重复，而重复需要时间。',
    reference:
      'More and more people are beginning to realise that practising every day is more effective than studying in occasional bursts. The reason is simple: language ability comes from repetition, and repetition takes time.',
  },
  {
    id: 'translating-genre-ielts-1',
    typeId: 'translating-genre',
    levelId: 'ielts',
    genre: '学术论文',
    direction: 'en-zh',
    title: '翻译 · 学术论文',
    prompt: '将下面这段话翻译成中文。',
    sourceText:
      'The results indicate a substantial improvement in recall among participants who practised in short daily sessions rather than in weekly blocks.',
    reference: '结果表明，与按周集中学习相比，每天进行短时练习的参与者在回忆表现上有显著提升。',
  },
];

export function itemsFor(typeId: ExerciseTypeId, levelId: string): ExerciseItem[] {
  const exact = exerciseItems.filter((i) => i.typeId === typeId && i.levelId === levelId);
  if (exact.length) return exact;
  const fallback = exerciseItems.filter((i) => i.typeId === typeId);
  return fallback;
}

export function genresFor(typeId: ExerciseTypeId): string[] {
  if (typeId === 'reading-genre') return readingGenres;
  if (typeId === 'translating-genre') return translatingGenres;
  if (typeId === 'comprehension') return listeningGenres;
  return [];
}

/** AI 探索（FR-M-5）的内置离线词条：只用于「查单词」这一类提问的兜底 */
export const aiWordCache: Record<
  string,
  {
    phonetic: string;
    senses: { pos: string; zh: string; en: string }[];
    origin: string;
    examples: { en: string; zh: string }[];
    collocations: string[];
    synonyms: string[];
    /** 其他词性下的形式（词族），不含原词本身 */
    forms: { pos: string; form: string }[];
  }
> = {
  substantial: {
    phonetic: '/səbˈstænʃl/',
    senses: [
      { pos: 'adj.', zh: '大量的；可观的', en: 'large in amount or degree' },
      { pos: 'adj.', zh: '实质的；重要的', en: 'important in a real sense' },
    ],
    origin: '源自拉丁语 substantia（本质、实体），sub-（在下）+ stare（站立），字面意为「站在下面支撑的东西」。',
    examples: [
      { en: 'He made substantial progress in three months.', zh: '他在三个月里取得了可观的进步。' },
      { en: 'There is substantial evidence for this claim.', zh: '这一说法有实质性的证据。' },
    ],
    collocations: ['substantial progress', 'a substantial amount of', 'substantial evidence'],
    synonyms: ['considerable', 'significant', 'sizeable'],
    forms: [
      { pos: 'n.', form: 'substance' },
      { pos: 'adv.', form: 'substantially' },
    ],
  },
  genuine: {
    phonetic: '/ˈdʒenjuɪn/',
    senses: [
      { pos: 'adj.', zh: '真正的；非伪造的', en: 'real; not fake' },
      { pos: 'adj.', zh: '真诚的', en: 'sincere and honest' },
    ],
    origin: '源自拉丁语 genuinus（天生的），与 gignere（产生）同源，后引申为「天生的、真的」。',
    examples: [
      { en: 'She showed genuine interest in the topic.', zh: '她对这个话题表现出真诚的兴趣。' },
      { en: 'This is a genuine leather bag.', zh: '这是一个真皮包。' },
    ],
    collocations: ['genuine interest', 'genuine concern', 'a genuine attempt'],
    synonyms: ['authentic', 'sincere', 'real'],
    forms: [
      { pos: 'adv.', form: 'genuinely' },
      { pos: 'n.', form: 'genuineness' },
    ],
  },
  abandon: {
    phonetic: '/əˈbændən/',
    senses: [
      { pos: 'v.', zh: '放弃；抛弃', en: 'to leave or give up completely' },
      { pos: 'n.', zh: '放任；无拘无束', en: 'complete lack of restraint' },
    ],
    origin: '源自古法语 abandoner（置于他人支配之下），a-（向）+ bandon（支配权）。',
    examples: [
      { en: 'He abandoned the plan halfway.', zh: '他中途放弃了这个计划。' },
      { en: 'They danced with abandon.', zh: '他们尽情地跳舞。' },
    ],
    collocations: ['abandon a plan', 'abandon ship', 'with abandon'],
    synonyms: ['desert', 'quit', 'forsake'],
    forms: [
      { pos: 'adj.', form: 'abandoned' },
      { pos: 'n.', form: 'abandonment' },
    ],
  },
};
