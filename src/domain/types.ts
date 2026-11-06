import type { BoardId, ExerciseTypeId } from '@/config/appConfig';
import type { FolderColor } from '@/theme/tokens';

/** ---------- 账号（FR-A-1 ~ FR-A-3） ---------- */

export type AuthMethod = 'qr' | 'phone' | 'guest';

export interface UserProfile {
  /** 系统生成的唯一 ID，用户不可修改（FR-A-2） */
  id: string;
  nickname: string;
  avatarUri?: string;
  /** 进入方式 */
  method: AuthMethod;
  /** 是否已登录（游客也持久化，但标记为 guest） */
  signedIn: boolean;
}

/** ---------- 设置（FR-O-2） ---------- */

export type ColorSchemePreference = 'system' | 'light' | 'dark';

export interface AppSettings {
  /** 字号档位下标：0 小 / 1 标准 / 2 大 */
  fontScaleIndex: 0 | 1 | 2;
  colorScheme: ColorSchemePreference;
  /** 辅助模式 */
  highContrast: boolean;
  reduceMotion: boolean;
  /** 界面语言（NFR-8） */
  locale: 'en' | 'zh-Hans' | 'zh-Hant';
  /** 已同意隐私政策（FR-O-3） */
  privacyAccepted: boolean;
  /** 是否已走过引导页（首次启动） */
  onboarded: boolean;
  /** 当日时长门槛（分钟） */
  dailyTimeThreshold: number;
  /** 当日任务数门槛 */
  dailyTaskThreshold: number;
  /** 学习提醒（FR-N-1，二期） */
  reminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  /**
   * 使用数据统计（NFR-6 埋点的用户开关）：记录本机的页面、点击与停留时长，
   * 不采集文本内容；关掉后立即停止采集，已有数据可在「数据统计」页清空。
   */
  analyticsEnabled: boolean;
}

/** ---------- 词库 / 课本（FR-T-1 ~ FR-T-3） ---------- */

export type WordbookCategory = 'popular' | 'recommended';

export interface Wordbook {
  id: string;
  /** 课本封面大字，如 Daily / CET4 */
  coverText: string;
  /** 副标题，如 100 Words */
  subtitle: string;
  /** 词库全名 */
  name: string;
  wordCount: number;
  /**
   * 卡面色（= 词库详情页的页面强调色，见 `BOOK_TONE_COLORS`）：
   * `red` / `yellow` / `blue` 三选一，热门课本黄、推荐课本蓝。
   */
  tone: 'red' | 'yellow' | 'blue';
  category: WordbookCategory;
  /** 授权来源（DR-1） */
  license: string;
  /** 是否已下载（可离线学习，NFR-3） */
  downloaded: boolean;
  /** 学习次数，用于 Popular 排序（DR-5） */
  studyCount: number;
  levelId?: string;
  description: string;
}

export interface WordExample {
  /** 英文例句 */
  en: string;
  /** 例句中文翻译 */
  zh: string;
}

/** 单词的一个义项（词性 + 中英释义） */
export interface WordSense {
  /** 词性缩写，如 `n.` / `v.` / `adj.` */
  partOfSpeech: string;
  /** 英文释义 */
  definition: string;
  /** 中文释义 */
  definitionZh: string;
}

/** 同一词族的派生词/词形变化（如 accurate → accuracy、inaccurate、accurately） */
export interface WordDerivative extends WordSense {
  /** 派生词本身 */
  word: string;
}

/** 单词的常用短语及其中文释义 */
export interface WordPhrase {
  /** 英文短语（含该单词或其变形） */
  en: string;
  /** 短语中文释义 */
  zh: string;
}

/** 音标：英式与美式各一套，分别对应 en-GB / en-US 朗读 */
export interface WordPhonetic {
  /** 英式音标（BrE） */
  uk: string;
  /** 美式音标（AmE） */
  us: string;
}

export interface WordEntry {
  id: string;
  word: string;
  /** 英式 / 美式音标（FR-T-? 词典信息） */
  phonetics: WordPhonetic;
  /** 义项列表，按字典顺序排列（首条为最常见义项）；界面**全部展示**（2026-10-17 起不再截断） */
  senses: WordSense[];
  /** 例句列表：界面默认最多展示 3 句，词库中不足 3 句时按实际数量展示（FR-T-3） */
  examples: WordExample[];
  /** 派生词（同一词族的其它词形）；为空时界面不渲染该面板 */
  derivatives: WordDerivative[];
  /** 常用短语与固定搭配：界面默认展示 3 个，不足 3 个时按实际数量展示 */
  phrases: WordPhrase[];
}

/** 课本学习位置（FR-T-3） */
export interface ReadingPosition {
  bookId: string;
  wordId: string;
  /** 第 n 个词，仅用于展示 */
  index: number;
  updatedAt: number;
}

/** ---------- 收藏 / 收藏夹（FR-M-5 / FR-T-1 / FR-X-3，共用一份收藏数据源） ---------- */

export type FavoriteSource = 'translate' | 'exercise' | 'explore' | 'wordbook';

/**
 * 收藏夹：课本页「星标」区的一格。
 * 初始只有一个内置收藏夹（id 为 `DEFAULT_FOLDER_ID`、名称为中文原文键「默认」，随语言切换）；
 * 用户可以新建自定义收藏夹，删除时夹内单词一并取消收藏。
 */
export interface FavoriteFolder {
  id: string;
  /** 内置收藏夹存中文原文键（走 tr() 三语切换），用户新建的存用户输入、原样展示 */
  name: string;
  createdAt: number;
  /** 封面颜色（六选一）；缺省 = 品牌红（老数据与内置「默认」收藏夹） */
  color?: FolderColor;
}

export interface FavoriteItem {
  id: string;
  word: string;
  definition: string;
  source: FavoriteSource;
  /** 所属收藏夹；收藏夹被删除时该条也一并移除 */
  folderId: string;
  createdAt: number;
}

/** ---------- 练习记录（DR-2） ---------- */

export interface AnswerBreakdownItem {
  label: string;
  score: number;
  max: number;
}

export interface GradingIssue {
  /** 定位信息，例如「第 2 句」「第 3 个词」 */
  where: string;
  /** 问题类型：用词 / 语法 / 语序 / 地道度 / 发音 / 流利度 */
  kind: string;
  detail: string;
}

export interface GradingResult {
  /** 总分，满分 100（FR-E-14） */
  total: number;
  /** 分项得分 */
  breakdown: AnswerBreakdownItem[];
  /** 具体问题定位 */
  issues: GradingIssue[];
  /** 可执行的改进建议 */
  advice: string[];
  /** 参考范文 / 参考译文 / 示范朗读文本 */
  reference?: string;
  gradedAt: number;
}

export type AttemptStatus = 'draft' | 'grading' | 'succeeded' | 'failed';

export interface Attempt {
  id: string;
  typeId: ExerciseTypeId;
  board: BoardId;
  levelId: string;
  /** 题目 id：同一任务重复提交只计一次（FR-E-3 验收标准） */
  itemId: string;
  /** 题目 / 任务名 */
  promptTitle: string;
  /** 题目要求 */
  prompt: string;
  /** 用户作答（文本或逐句数组） */
  answer: string;
  /** 得分率 0~100，未评分时为 null */
  scoreRate: number | null;
  /** 用时（秒） */
  durationSec: number;
  status: AttemptStatus;
  /**
   * 测验（「测验」页签下的错题重做 / 综合）产生的作答：只留作答记录本身，
   * 不计入打卡卡片（今日时长 / 今日任务 / 连续天数）与学习统计聚合。
   */
  excluded?: boolean;
  result?: GradingResult;
  /** 错词（听写 / 跟读） */
  wrongWords?: string[];
  createdAt: number;
  /** 完成时间用于冲突合并（FR-A-3：以完成时间更晚的一条为准） */
  finishedAt: number;
}

/** 单日打卡聚合（DR-3） */
export interface DailyStat {
  /** YYYY-MM-DD（设备时区自然日） */
  date: string;
  /** 当日累计练习秒数 */
  durationSec: number;
  /** 当日完成的任务数 */
  taskCount: number;
  /** 当日是否达标（FR-E-1） */
  qualified: boolean;
  /** 当日已完成的任务 id，用于「同一任务重复提交只计一次」（FR-E-3 验收标准） */
  completedItemIds: string[];
  /** 按题型聚合 */
  byType: Record<string, { count: number; durationSec: number; scoreSum: number; scoreMax: number }>;
  /** 按等级聚合 */
  byLevel: Record<string, { count: number; durationSec: number }>;
}

/** ---------- 写作本（FR-E-8） ---------- */

export interface WritingBookEntry {
  id: string;
  title: string;
  text: string;
  attempts: { attemptId: string; scoreRate: number; gradedAt: number }[];
}

/** ---------- 探索（FR-X-1 / FR-X-2） ---------- */

export interface ExploreResultItem {
  id: string;
  title: string;
  /** 说明文字，可缺省（如搭配条目只给词组本身） */
  detail?: string;
  extra?: string;
}

/** ---------- 持久化根状态 ---------- */

/**
 * 题集里的一条收藏（作答页点「加入题集」收进来的题目）。
 * 带收藏时间与来源场次：题集页据此分成「练习 / 测验」两大题集、并在每个题集里按收藏日期分区
 * （同一天收藏的题目落在同一区），列表里点某道题即从该题开始做（FR-E-7 的错题重做就是练这些题）。
 */
export interface SavedItem {
  itemId: string;
  /** 收藏时间戳（毫秒）；0 = 早期数据没有记录时间 */
  savedAt: number;
  /**
   * 收藏时的场次：practice = 练习（日常练习 / 错题重做）、quiz = 测验（综合）、
   * accumulation = 测验（积累）。三个来源互不混，各自成一份题集。
   */
  source: 'practice' | 'quiz' | 'accumulation';
}

/**
 * 断点里那道题的作答现场：只有**已经确认过答案**（`attemptId` 有值）时才带，
 * 恢复后直接呈现上次的判定结果与作答，不用重做一遍；没确认过就不带（`null`），恢复后重新作答。
 * 已落库的那次作答本身在 `state.attempts` 里（判定 / 分数 / 用时都在那），这里只补 UI 现场。
 */
export interface PracticeDraft {
  /** 已落库的那次作答 id（`state.attempts` 里的一条）；恢复时据此回到「已确认」的画面 */
  attemptId: string | null;
  /** 作答内容：客观题是选项下标字符串，其余是文本框里的文字 */
  answer: string;
  /** 客观题选中的选项下标（其余题型为 null） */
  selectedChoice: number | null;
  /** 「解析」是否已展开 */
  reveal: boolean;
  /** 这道题是否已加入题集 */
  savedMarked: boolean;
}

/**
 * 上次练习的断点：练习页「最近练习」据此回到**同一批题、同一个位置**接着做。
 * 练习页在作答过程中持续回写（抽定队列时、每换一题时）；断点一旦写下就保留，
 * 只有下次抽定新队列时才被覆盖（清空学习数据时一并清掉）。
 */
export interface PracticeResume {
  typeId: ExerciseTypeId;
  /** 选题库那一步选的题库 id（恢复时直接落回这个题库，不再走选题库） */
  levelId: string;
  /** 测验 / 题集分支：'wrong' = 错题重做或题集，'mixed' = 综合；日常练习没有 */
  mode?: 'wrong' | 'mixed';
  /** 题集分档（`mode === 'wrong'` 时才有值） */
  set?: string;
  /** 本次队列的题目 id（按抽定顺序）；恢复时按 id 取回，找不到的题目直接丢掉 */
  itemIds: string[];
  /** 停在第几题（0 基） */
  index: number;
  /** 停在这道题上的作答现场（已确认才有；未确认为 null） */
  draft?: PracticeDraft | null;
  updatedAt: number;
}

export interface PersistedState {
  version: number;
  profile: UserProfile;
  settings: AppSettings;
  /** 当前选中的等级 / 题库（FR-E-4） */
  levelId: string;
  /** 打卡与练习聚合，key 为 YYYY-MM-DD */
  daily: Record<string, DailyStat>;
  attempts: Attempt[];
  /** 收藏的单词（每条归属一个收藏夹，见 folderId） */
  favorites: FavoriteItem[];
  /**
   * 星标区里的收藏夹；内置「默认」始终存在且不可删除（FR-T-1）。
   * 数组顺序即列表顺序，由 store 按显示名 A-Z 维护（载入与新建时重排）。
   */
  favoriteFolders: FavoriteFolder[];
  readingPositions: Record<string, ReadingPosition>;
  /** 词库下载状态 */
  downloadedBookIds: string[];
  writingBook: WritingBookEntry[];
  /**
   * 题集：作答页点「加入题集」收进来的题目（按「题」记，见 SavedItem）。
   * 与听写 / 跟读的「错词队列」（由 `Attempt.wrongWords` 汇总的错词，按「词」记）分工不同，
   * 两者都会进错题重做。
   */
  savedItems: SavedItem[];
  /** 上次练习的断点（练习页「最近练习」从这里接着做）；null = 当前没有进行中的练习 */
  lastPractice: PracticeResume | null;
  /** 最近一次同步时间，用于「离线数据可能未同步」标注 */
  lastSyncedAt: number;
  /** 是否有未同步的本地改动 */
  pendingSync: boolean;
}
