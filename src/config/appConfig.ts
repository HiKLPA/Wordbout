/**
 * 应用级可配置参数（NFR-6：词库、题库、评分标准与门槛参数必须配置化，改动不需要发版）。
 * 本文件对应「配置中心」的本地默认值；接服务端后可整份替换而不动业务代码。
 */

export type StreakQualifyRule = 'either' | 'time' | 'tasks';

export interface AppConfig {
  /** 打卡门槛（FR-E-1 / FR-E-2 / FR-E-3） */
  streak: {
    /** 连续天数达标规则；第 9 章待确认事项，默认「任一」 */
    qualifyRule: StreakQualifyRule;
    /** 当日练习时长门槛（分钟），默认 5 */
    defaultTimeThreshold: number;
    /** 时长门槛可选值 */
    timeThresholdOptions: number[];
    /** 当日完成任务数门槛，默认 5 */
    defaultTaskThreshold: number;
    /** 任务数门槛可选值 */
    taskThresholdOptions: number[];
    /** 跨天以用户所在时区的自然日零点为界 */
    dayBoundaryTimezone: 'device';
  };
  /** 练习行为参数 */
  exercise: {
    /** 听写一组默认题量 */
    dictationSetSize: number;
    /** 听写单题默认最多重播次数（界面上写作「至多重播 n 次」，NFR-6 配置化） */
    dictationMaxReplays: number;
    /** 听力/口语语速档位（五档，供语音 / 翻译页的完整档位条） */
    playbackRates: number[];
    /** 听写 / 听力理解播放器上的四档倍速（0.5 / 0.75 / 1.0 / 1.25，NFR-6 配置化） */
    audioRateOptions: number[];
    /** 跟读录音最长时长（秒） */
    recordingMaxSeconds: number;
    /** 未提交答案就退出不计入任务数 */
    requireSubmitToCount: boolean;
  };
  /** 专注计时器（练习页打卡区右侧面板：计时 / 计数两种模式） */
  focus: {
    /** 计时档四档预设（分钟），四枚按钮等分卡片内宽 */
    timePresets: number[];
    /** 计数档四档预设（任务数） */
    taskPresets: number[];
  };
  /** 测验（练习页「测验」页签下的两个测验：积累 + 综合） */
  quiz: {
    /**
     * 「积累」可选数量：四枚整宽卡片，样式与「选择题库」一致（先选、再按「确认」抽题）。
     * 题池（当前题库对应词库的词条 + 派生词 + 常用短语，按答案去重）不足所选数量时按实际出题。
     */
    accumulationSizes: number[];
    /**
     * 「积累」的统一评分：每题等权、满分按它，答对得满分、答错 0 分
     * （客观拼写题，复用练习页听写那一支的对错口径，不做主观给分）。
     */
    accumulationPointPerItem: number;
  };
  /** AI 评分（FR-E-14 / FR-E-15） */
  grading: {
    /** 20s：提示「正在评分」并保留页面 */
    softTimeoutMs: number;
    /** 30s 或接口报错：转「评分失败，请稍后重试」 */
    hardTimeoutMs: number;
    /** 评分结果必须包含的四块内容 */
    requiredSections: ['total', 'breakdown', 'issues', 'advice'];
    /** 免费策略：第 9 章待确认事项，本期按「不限次但需登录」 */
    freeQuota: 'unlimited' | number;
    requireLogin: boolean;
    /**
     * 拼写判定（听写 / 「积累」默写）：忽略大小写与首尾、多余空格；
     * 但下列单词是**专有名词**，必须原样大写才算对（如 English / IELTS）。
     * 除此之外，正确答案里本身就带大写字母的词也一律按「必须大写」处理 —— 数据里怎么写就怎么算。
     */
    keepCaseWords: string[];
  };
  /** 课本（FR-T-1 / FR-T-3） */
  textbook: {
    /** Popular 每日更新时刻（本地时间，小时） */
    popularRefreshHour: number;
    /** Popular 空数据态排序方式 */
    popularEmptySort: 'ALPHABETICAL' | 'MANUAL';
    /** 词库包与音频按需下载 */
    onDemandDownload: boolean;
  };
  /** 探索（FR-X-2）：随机探索可选的数量与默认值 */
  explore: {
    randomSizes: number[];
    defaultRandomSize: number;
  };
  /** 能力趋势（原「学习能力查询表」，FR-E-16 ~ FR-E-20） */
  queryTable: {
    /** 默认统计范围（天） */
    defaultRangeDays: number;
    /** 快捷档位（今日 / 近7天 / 近30天 / 近3月，四个胶囊等分主内容区宽度）；也是「当前水平」的评定时段 */
    quickRanges: { key: string; label: string; days: number }[];
    /** 区间跨度超过该天数时按周聚合（30：近30天仍按日，再长才升到周） */
    weeklyAggregateOverDays: number;
    /** 区间跨度超过该天数时按月聚合（60：近3月 90 天按「月」统计，正好 3 个月份） */
    monthlyAggregateOverDays: number;
    /** 趋势图至少需要同项目记录数 */
    trendMinPoints: number;
    /** 综合得分率（练习页打卡卡第三个环）的统计窗口（天）；能力趋势页的「当前水平」不用它、改用所选统计档位 */
    levelWindowDays: number;
    /** 当前水平分档（近 30 天平均得分率） */
    levelBands: { min: number; label: string }[];
    /** 单次查询超时（毫秒） */
    queryTimeoutMs: number;
    /** 离线时展示本地缓存 */
    offlineCacheEnabled: boolean;
  };
  /** 提醒（FR-N-1，二期） */
  reminder: {
    enabled: boolean;
    defaultHour: number;
    defaultMinute: number;
    /** 当天已达标则不发 */
    skipWhenQualified: boolean;
  };
  /** 本地化（NFR-8） */
  i18n: {
    defaultLocale: 'en' | 'zh-Hans' | 'zh-Hant';
    supported: ('en' | 'zh-Hans' | 'zh-Hant')[];
  };
  /** 隐私（NFR-5 / FR-O-3） */
  privacy: {
    /** 未同意隐私政策时禁用拍照翻译、语音翻译 */
    gatedFeatures: string[];
    /** 拍照翻译与语音翻译的原始图像 / 音频默认不上传、不留存 */
    uploadOriginals: boolean;
    retainOriginals: boolean;
  };
  /** 数据导出（FR-O-4） */
  dataExport: {
    formats: ('csv' | 'json')[];
    defaultFormat: 'csv' | 'json';
  };
  /**
   * 大模型服务（IF-3「大模型评分与单词解析服务」）。
   * 只要求 OpenAI 兼容的 `/chat/completions`，换服务商只改这里 + `.env`，不动业务代码；
   * 密钥不进代码：由环境变量 `EXPO_PUBLIC_AI_API_KEY` 注入（见根目录 `.env.example`）。
   */
  ai: {
    /** 服务根地址（默认智谱开放平台，GLM-4-Flash 有免费额度） */
    baseUrl: string;
    /** 模型名（`EXPO_PUBLIC_AI_MODEL` 可覆盖） */
    model: string;
    /** 采样温度：词典类任务要稳定，取低值 */
    temperature: number;
    /** 单次请求超时（毫秒），超时转「AI 响应超时，请检查网络后重试」 */
    timeoutMs: number;
    /**
     * 「AI 探索」提问专用超时（毫秒）。
     * 要一次生成一长串内容（如六级高频词清单）时 GLM-4-Flash 实测可到 30~40s，
     * 单独放宽；评分链路仍走上面的 `timeoutMs`，FR-E-15 的 20s / 30s 兜底口径不变。
     */
    answerTimeoutMs: number;
    /** 无密钥或请求失败时回退内置离线词条（NFR-3） */
    offlineFallback: boolean;
    /**
     * 「AI 探索」连续对话时最多带回几轮历史消息（单位：条，一问一答算 2 条）。
     * 太长会让每次提问都更慢更贵，取一个够理解追问的窗口即可。
     */
    historyLimit: number;
    /** 解析结果本地缓存上限（条），同词命中缓存不再请求（FR-M-5 验收：不重复计费） */
    cacheLimit: number;
    /**
     * 本地保留的「AI 探索」历史对话条数上限（单位：段，超出按最近活动时间淘汰最旧的）。
     * 只影响底部历史面板里能翻到多少段，不影响正在进行的这一段的上下文。
     */
    chatLimit: number;
    /**
     * 每条 AI 回复下方最多给几条**建议追问**（围绕这次回答发散；界面横向可滑）。
     * 多了会把回复区撑长，取 3 条一屏能扫完。
     */
    followUpLimit: number;
    /**
     * AI 探索**空态示例提问**的条数（纵向排几张引导卡，点了即发问）。
     * 与上面「建议追问」不是一回事：那个在回复下方、围绕这一轮发散；
     * 这个是还没提问时给的引导，按用户最近的学习情况现编。
     */
    suggestLimit: number;
    /**
     * 生成空态示例提问的超时（毫秒）。它只是引导，慢就退回本地兜底示例，不拖住页面。
     */
    suggestTimeoutMs: number;
    /**
     * 空态示例提问的缓存有效期（毫秒）：过了就按最新学习内容重新生成。
     * 同一上下文（等级 + 最近学过的词 + 收藏 + 错词）在有效期内命中缓存，不重复计费（FR-M-5）。
     */
    suggestTtlMs: number;
  };

  /**
   * 中英翻译与词典（FR-M-1 / FR-M-3 / FR-M-4）。
   * 词典是开源数据（ECDICT / CC-CEDICT），随包内置；整句译文走上面的 `ai`。
   */
  translation: {
    /** 默认选中的词典 id（见 `src/data/dictionaries` 的 `DICTIONARIES`） */
    defaultDictionary: string;
    /** 超过该字符数提示分段（FR-M-1：500 字符） */
    suggestSplitChars: number;
    /** 每段文本最多给出多少条词条注释 */
    maxNotes: number;
    /**
     * 输入框下方「前缀联想」最多给几个候选（英 → 中方向的内置词表）；
     * 0 = 关闭联想。
     */
    suggestLimit: number;
    /** 触发前缀联想所需的最少已输入字母数（1 个字母的候选太多，默认 2） */
    suggestMinChars: number;
    /** 在线词典（Wiktionary）接口地址 */
    wiktionaryUrl: string;
    /** 在线词典单次查询超时（毫秒） */
    onlineTimeoutMs: number;
    /** 在线词典每段文本最多查几个词（每词一次请求，免费服务对生僻词很慢，必须设上限） */
    onlineMaxLookups: number;
  };
}

export const appConfig: AppConfig = {
  streak: {
    qualifyRule: 'either',
    defaultTimeThreshold: 5,
    timeThresholdOptions: [5, 10, 15, 20, 25, 30, 40, 50],
    defaultTaskThreshold: 5,
    taskThresholdOptions: [5, 10, 15, 20, 25, 30, 40, 50],
    dayBoundaryTimezone: 'device',
  },
  exercise: {
    dictationSetSize: 10,
    dictationMaxReplays: 3,
    playbackRates: [0.5, 0.75, 1, 1.25, 1.5],
    audioRateOptions: [0.5, 0.75, 1, 1.25],
    recordingMaxSeconds: 60,
    requireSubmitToCount: true,
  },
  focus: {
    timePresets: [10, 25, 30, 45],
    taskPresets: [10, 20, 30, 40],
  },
  quiz: {
    accumulationSizes: [20, 40, 60, 80],
    accumulationPointPerItem: 100,
  },
  grading: {
    softTimeoutMs: 20_000,
    hardTimeoutMs: 30_000,
    requiredSections: ['total', 'breakdown', 'issues', 'advice'],
    freeQuota: 'unlimited',
    requireLogin: true,
    keepCaseWords: [],
  },
  textbook: {
    popularRefreshHour: 0,
    popularEmptySort: 'ALPHABETICAL',
    onDemandDownload: true,
  },
  explore: {
    randomSizes: [15, 30, 45],
    defaultRandomSize: 15,
  },
  queryTable: {
    defaultRangeDays: 7,
    quickRanges: [
      { key: 'today', label: '今日', days: 1 },
      { key: '7d', label: '近7天', days: 7 },
      { key: '30d', label: '近30天', days: 30 },
      { key: '3m', label: '近3月', days: 90 },
    ],
    weeklyAggregateOverDays: 30,
    monthlyAggregateOverDays: 60,
    trendMinPoints: 2,
    levelWindowDays: 30,
    levelBands: [
      { min: 90, label: '熟练' },
      { min: 80, label: '良好' },
      { min: 65, label: '中等' },
      { min: 50, label: '基础' },
      { min: 0, label: '入门' },
    ],
    queryTimeoutMs: 2_000,
    offlineCacheEnabled: true,
  },
  reminder: {
    enabled: false,
    defaultHour: 8,
    defaultMinute: 0,
    skipWhenQualified: true,
  },
  i18n: {
    defaultLocale: 'en',
    supported: ['en', 'zh-Hans', 'zh-Hant'],
  },
  privacy: {
    gatedFeatures: ['FR-M-3 拍照翻译', 'FR-M-4 语音翻译'],
    uploadOriginals: false,
    retainOriginals: false,
  },
  dataExport: {
    formats: ['csv', 'json'],
    defaultFormat: 'csv',
  },
  ai: {
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    temperature: 0.2,
    /** 实测 GLM-4-Flash 输出整段 JSON 需 7~16s，留出余量避免首次请求被误判超时 */
    timeoutMs: 30_000,
    /** 生成整段回答（词表 / 计划）更慢，实测可到 40s，单独放宽到 60s */
    answerTimeoutMs: 60_000,
    offlineFallback: true,
    /** 追问通常只依赖最近一两个话题：6 条（最多 3 轮问答）够用，再长只是拖慢每次请求 */
    historyLimit: 6,
    cacheLimit: 200,
    /** 历史面板一屏也就看七八段，留 20 段足够回翻，又不至于把存储撑大 */
    chatLimit: 20,
    /** 每条回复下方最多 3 条建议追问（横滑可见） */
    followUpLimit: 3,
    /** 空态示例提问固定 3 条（与「建议追问」同数，一屏扫完） */
    suggestLimit: 3,
    /** 生成示例提问比整段回答快，留 20s 即可；超时就用本地兜底示例 */
    suggestTimeoutMs: 20_000,
    /** 示例提问缓存 6 小时：一天内同一学习阶段不重复请求，又不会长期停在旧建议上 */
    suggestTtlMs: 6 * 60 * 60 * 1000,
  },
  translation: {
    // 默认「简明英汉词典」；查到中文方向时会自动换成默认的汉英词典
    defaultDictionary: 'ecdict',
    suggestSplitChars: 500,
    maxNotes: 6,
    suggestLimit: 8,
    suggestMinChars: 2,
    wiktionaryUrl: 'https://api.dictionaryapi.dev/api/v2/entries/en',
    // 实测该免费服务常见词 1s 内、生僻词可拖到 20s 以上，所以超时收紧 + 限量并发
    onlineTimeoutMs: 8_000,
    onlineMaxLookups: 3,
  },
};

/** 五板块与九题型（FR-E-5 ~ FR-E-13） */
export type BoardId = 'listening' | 'writing' | 'speaking' | 'reading' | 'translating';
export type ExerciseTypeId =
  | 'dictation'
  | 'comprehension'
  | 'writing-sentence'
  | 'writing-passage'
  | 'speaking-word'
  | 'speaking-sentence'
  | 'speaking-passage'
  | 'reading-genre'
  | 'translating-genre';

export interface ExerciseTypeDef {
  id: ExerciseTypeId;
  board: BoardId;
  /** 设计稿 pill 上的英文标签 */
  label: string;
  /** 中文说明 */
  labelZh: string;
  /** 板块分组标题 */
  groupLabel: string;
  /** 是否需要人工智能评分 */
  aiGraded: boolean;
  /** 是否需要麦克风 */
  needsMic: boolean;
  /** 对应设计稿分组「BASIC / TEST」（练习页 ALL / BASIC / TEST / QUIZ 四个分类标签） */
  tier: 'basic' | 'advanced';
}

export const boards: { id: BoardId; label: string; labelZh: string }[] = [
  { id: 'listening', label: 'Listening', labelZh: '听' },
  { id: 'writing', label: 'Writing', labelZh: '写' },
  { id: 'speaking', label: 'Speaking', labelZh: '说' },
  { id: 'reading', label: 'Reading', labelZh: '读' },
  { id: 'translating', label: 'Translating', labelZh: '译' },
];

export const exerciseTypes: ExerciseTypeDef[] = [
  {
    id: 'dictation',
    board: 'listening',
    label: 'Dictation',
    labelZh: '听写',
    groupLabel: 'Listening',
    aiGraded: false,
    needsMic: false,
    tier: 'basic',
  },
  {
    id: 'comprehension',
    board: 'listening',
    label: 'Comprehension',
    labelZh: '听力理解',
    groupLabel: 'Listening',
    aiGraded: false,
    needsMic: false,
    tier: 'basic',
  },
  {
    id: 'writing-sentence',
    board: 'writing',
    label: 'Sentence',
    labelZh: '作句',
    groupLabel: 'Writing',
    aiGraded: true,
    needsMic: false,
    tier: 'basic',
  },
  {
    id: 'writing-passage',
    board: 'writing',
    label: 'Passage',
    labelZh: '作文',
    groupLabel: 'Writing',
    aiGraded: true,
    needsMic: false,
    tier: 'basic',
  },
  {
    id: 'speaking-word',
    board: 'speaking',
    label: 'Word & Phrase',
    labelZh: '词与短语',
    groupLabel: 'Speaking',
    aiGraded: true,
    needsMic: true,
    tier: 'basic',
  },
  {
    id: 'speaking-sentence',
    board: 'speaking',
    label: 'Sentence',
    labelZh: '句与段',
    groupLabel: 'Speaking',
    aiGraded: true,
    needsMic: true,
    tier: 'basic',
  },
  {
    id: 'speaking-passage',
    board: 'speaking',
    label: 'Passage',
    labelZh: '短文',
    groupLabel: 'Speaking',
    aiGraded: true,
    needsMic: true,
    tier: 'basic',
  },
  {
    id: 'reading-genre',
    board: 'reading',
    label: 'Genre',
    labelZh: '阅读理解',
    groupLabel: 'Reading',
    aiGraded: false,
    needsMic: false,
    tier: 'advanced',
  },
  {
    id: 'translating-genre',
    board: 'translating',
    label: 'Genre',
    labelZh: '翻译',
    groupLabel: 'Translating',
    aiGraded: true,
    needsMic: false,
    tier: 'advanced',
  },
];

export const exerciseTypeMap: Record<ExerciseTypeId, ExerciseTypeDef> = exerciseTypes.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<ExerciseTypeId, ExerciseTypeDef>,
);

/** 等级 / 题库（FR-E-4） */
export interface LevelDef {
  id: string;
  label: string;
  labelZh: string;
}

export const levels: LevelDef[] = [
  { id: 'daily', label: 'Daily', labelZh: '日常' },
  { id: 'cet4', label: 'CET4', labelZh: 'CET4' },
  { id: 'cet6', label: 'CET6', labelZh: 'CET6' },
  { id: 'ielts', label: 'IELTS', labelZh: 'IELTS' },
  { id: 'toefl', label: 'TOEFL', labelZh: 'TOEFL' },
];

/** 探索方式（FR-X-1） */
export type ExploreModeId = 'etymology' | 'roots' | 'synonyms' | 'antonyms' | 'collocations';

export interface ExploreModeDef {
  id: ExploreModeId;
  label: string;
  labelZh: string;
  description: string;
}

export const exploreModes: ExploreModeDef[] = [
  { id: 'etymology', label: 'Story', labelZh: '词源故事', description: '这个词从哪儿来' },
  { id: 'roots', label: 'Roots', labelZh: '同根词', description: '同一词根扩展出的单词' },
  { id: 'synonyms', label: 'Synonyms', labelZh: '近义词', description: '常用近义词' },
  { id: 'antonyms', label: 'Antonyms', labelZh: '反义词', description: '常用反义词' },
  { id: 'collocations', label: 'Collocations', labelZh: '常用连词', description: '常见搭配' },
];
