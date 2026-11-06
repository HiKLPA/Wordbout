import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, TextInput, View } from 'react-native';
import * as Speech from 'expo-speech';

import { ReadingPassage } from '@/components/ReadingPassage';
import { SlideIn } from '@/components/SlideIn';
import { StageProgressBar, type ProgressStage } from '@/components/StageProgress';
import {
  BookmarkIcon,
  CheckIcon,
  ChevronIcon,
  CloseIcon,
  EyeIcon,
  EyeOffIcon,
  HintIcon,
  MicIcon,
  PlayIcon,
  SoundIcon,
} from '@/components/icons';
import {
  AppText,
  Badge,
  Card,
  Divider,
  EmptyState,
  FOOTER_BUTTON_HEIGHT,
  FooterBar,
  PrimaryButton,
  Screen,
  SEGMENT_PADDING,
  SegmentedTabs,
} from '@/components/ui';
import { appConfig, exerciseTypeMap, levels, type ExerciseTypeId } from '@/config/appConfig';
import { exerciseItems, genresFor, itemsFor, type ExerciseItem } from '@/data/questions';
import { EVENT_NAMES } from '@/domain/analytics';
import { formatDurationHuman } from '@/domain/date';
import { friendlyError, requestGrading, spellingMatches, type GradingFeedback } from '@/domain/grading';
import type { PracticeResume, SavedItem } from '@/domain/types';
import { tr, trf } from '@/i18n';
import { track } from '@/lib/analytics';
import { useFocusPlaceholder } from '@/lib/focusPlaceholder';
import { useApp, usePracticeTimer } from '@/store/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { inputFont } from '@/theme/fonts';
import { layout, opacity, stroke, typography } from '@/theme/tokens';

/**
 * bank = 先选题库（FR-E-4）；choose = 选文体；answer = 作答（评分与解析都在这一屏原地展开）；
 * result = 本场结算（做完最后一题点「下一题」进来，见 `resultPanel`）。
 */
type Step = 'bank' | 'choose' | 'answer' | 'result';

/** 一次作答最多抽多少道题（题库里不足这个数就按实际数量全出） */
const SESSION_SIZE = 30;

/**
 * 正文区里各块（标题 / 题目区域 / 选项 / 提交 / 得分卡与解析卡）之间的垂直间距，全局统一 16。
 * 块与块之间的间距只此一处：面板里的每个直接子元素都被它拉开，内部再各自分组。
 * **8 只留给同类元素彼此**：选项与选项、题库卡与题库卡、文体 pill 与文体 pill
 * （它们各自的列表容器里写 8），以及同一块内部的文字行。
 */
const BLOCK_GAP = 16;

/**
 * 阅读理解的题干与「正文」左右对齐用：正文走 `ReadingPassage` 的 `Card`（自带 16 内边距），
 * 题干是裸文本，补同值水平内边距后两块的文字左缘 / 右缘才在同一列。
 */
const READING_CARD_PADDING = 16;

/**
 * 客观题选项的高度：胶囊型（全圆角 + 描边），内部文字 16px，A/B/C/D 前缀加粗。
 * 用 minHeight 而非 height —— 选项换行时胶囊随之长高，文字不会被裁掉；
 * 单行时就是 64。相邻选项之间仍是 8。
 */
const OPTION_HEIGHT = 64;

/**
 * 倍速胶囊条 / 播放圆钮的高度都不写死，由 `AudioPlayRow` 内部同一个算式得出：
 * 文字行高（md，随字号档位缩放）+ 上下各 `SEGMENT_PADDING`(8) + 胶囊外壳 0.5px 描边 ×2。
 * 两者同一行、同一个值，所以恒等高 —— 右侧圆钮与胶囊条齐平。
 */
/** 圆钮内的喇叭图标边长（与单词页音标朗读钮同一颗 icon，按直径等比放大） */
const PLAY_CIRCLE_ICON = 20;
/** 系统朗读的基准语速：1.0× 档对应它，四档倍速都在它之上做乘法 */
const SPEECH_BASE_RATE = 0.95;

/**
 * 客观题 / 主观题的分界（结算页的对错与正确率只统计客观题）：
 * 选择题看 `answerIndex`、听写看 `dictationAnswer`，两者都有唯一正确答案；
 * 其余（口语 / 翻译 / 写作 / 阅读简答）交给大模型打分，只在结算页列出分数、不判对错。
 */
function isObjective(item: ExerciseItem): boolean {
  return item.answerIndex !== undefined || !!item.dictationAnswer;
}

/**
 * 主题目文本：剥掉句末的终止标点（。．.！!？?）——「主题目结尾不出现标点符号」，
 * 全题型统一在这一处处理，题目数据本身仍按正常句子书写。
 * 万一整条只剩标点，则原样返回，不渲染出空白。
 */
function promptText(raw: string): string {
  const stripped = raw.replace(/[。．.！!？?]+$/u, '');
  return stripped.length > 0 ? stripped : raw;
}

/**
 * 口语三个题型（词与短语 / 句与段 / 短文）的题干是同一句固定指令，只说明「读什么」：
 * 「请阅读下方 + 题型名」——题面本身在下方原文面板里，不用题目数据里的 prompt
 * （`data/questions.ts` 里那几句「先听标准发音，再录一遍。」等已从界面退场）。
 * 走 `tr()`，中文原文即词条键（NFR-8）。
 */
const SPEAK_PROMPTS: Partial<Record<ExerciseTypeId, string>> = {
  'speaking-word': '请阅读下方词与短语',
  'speaking-sentence': '请阅读下方句与段',
  'speaking-passage': '请阅读下方短文',
};

/**
 * 播放器上的四档倍速胶囊（取值见 appConfig.exercise.audioRateOptions，档位本身配置化）。
 * 标签固定一位小数（0.5× / 0.75× / 1.0× / 1.25×）；键用字符串，因为 SegmentedTabs 取值是 string。
 */
const RATE_TABS = appConfig.exercise.audioRateOptions.map((v) => ({
  key: String(v),
  label: `${v.toFixed(1)}×`,
}));

/**
 * 底部操作条的按钮几何（与单词页「上一词 / 收藏 / 下一词」同一套 FooterBar 规则）。
 * 三个按钮并排分摊整行宽度，所以左右内边距压到 8、文字走 sm 档，中文标签才不会被挤到换行。
 */
const FOOTER_BTN = {
  flex: 1,
  minHeight: FOOTER_BUTTON_HEIGHT,
  height: FOOTER_BUTTON_HEIGHT,
  paddingHorizontal: 8,
};

/**
 * 「随机选题」这一项的内部标识：它和文体卡片用同一套选中逻辑，但确认后不带文体
 * （`startSession(levelId, undefined)` = 题库里该题型的题目全收，随机抽）。选它、选某个文体
 * 都算「文体已定」，进度条文体段随之点亮。
 */
const RANDOM_GENRE = '__random__';

/** Fisher–Yates 洗牌：不改动原数组，每次进入题目阶段都重新随机抽题 */
function shuffled<T>(list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 文体匹配：题库里同文体的题目（无文体的题目任何文体都算） */
function inGenre(item: ExerciseItem, genre: string): boolean {
  if (!item.genre) return true;
  return item.genre === genre || item.genre.startsWith(genre.split(' ')[0]);
}

/**
 * 抽定本次作答的题目队列。
 * 普通练习（FR-E-5 ~ FR-E-13）：取所选题库下该题型的全部题目，按文体收敛后随机抽最多 SESSION_SIZE 道；
 * 选了文体但该文体下没有题时退回全部题目，避免「选完文体没题可做」。
 * 错题重做（FR-E-7）：题集里手动加入的原题最前 → 题库里命中错词的原题 → 题库里没有的错词临时组一条听写题，
 * 三层兜底保证不空手（只有题集、或只有错词时都能练）。
 */
function buildSessionItems(opts: {
  typeId: ExerciseTypeId;
  levelId: string;
  genre?: string;
  mode?: 'wrong' | 'mixed';
  wrongQueue: string[];
  /** 题集（收藏的题目） */
  savedItems: SavedItem[];
  /**
   * 从题集的哪一档进来（`mode === 'wrong'` 时才有值）：
   * 五个板块 id 之一 = 该板块题集；'quiz' = 测验题集（综合里收藏的题，跨板块）。
   * 不传 = 全部题集（练习页旧入口的兜底口径）。
   */
  set?: string;
  /** 从题集列表点进来的那道题：排在队首，从它开始做 */
  startItemId?: string;
}): ExerciseItem[] {
  const all = itemsFor(opts.typeId, opts.levelId);
  if (opts.mode === 'wrong') {
    // 题集里的原题排在最前；它们可能不属于当前题型，所以从全量题目里按 id 取
    const inSet = (i: ExerciseItem) => {
      if (!opts.set) return true;
      if (opts.set === 'quiz') {
        return opts.savedItems.some((x) => x.itemId === i.id && x.source === 'quiz');
      }
      return exerciseTypeMap[i.typeId]?.board === opts.set;
    };
    const book = exerciseItems.filter(
      (i) => opts.savedItems.some((x) => x.itemId === i.id) && inSet(i),
    );
    // 从列表点进来的那道题排最前（点哪题就从哪题开始）
    if (opts.startItemId) {
      const at = book.findIndex((i) => i.id === opts.startItemId);
      if (at > 0) book.unshift(...book.splice(at, 1));
    }
    const inBook = new Set(book.map((i) => i.id));
    /** 错词队列是听写 / 跟读攒下的，只跟着听力题集（或不分档时）一起练 */
    const withWords = !opts.set || opts.set === 'listening';
    const wanted = new Set(withWords ? opts.wrongQueue.map((w) => w.toLowerCase()) : []);
    const matched = all.filter(
      (i) => i.dictationAnswer && wanted.has(i.dictationAnswer.toLowerCase()) && !inBook.has(i.id),
    );
    const covered = new Set(matched.map((i) => (i.dictationAnswer ?? '').toLowerCase()));
    const extras: ExerciseItem[] = opts.wrongQueue
      .filter((w) => withWords && !covered.has(w.toLowerCase()))
      .map((w) => ({
        id: `wrong-${w.toLowerCase()}`,
        typeId: opts.typeId,
        levelId: opts.levelId,
        title: trf('错词听写：{w}', { w }),
        prompt: '根据标准发音写出单词。',
        audioText: w,
        dictationAnswer: w,
      }));
    return [...book, ...matched, ...extras];
  }
  const scoped = opts.genre ? all.filter((i) => inGenre(i, opts.genre!)) : all;
  const pool = scoped.length > 0 ? scoped : all;
  return shuffled(pool).slice(0, SESSION_SIZE);
}

/**
 * 从断点恢复本次队列（练习页「最近练习」续做）：按存下来的题目 id 把原题取回来，顺序照旧。
 * 取不到的（换了题库、或当时临时组的「错词听写」题）直接丢掉；一道都取不回就返回空数组，
 * 调用方据此把它当作「没有断点」——退回原来「先选题库」的流程。
 */
function restoreSessionItems(resume: PracticeResume, typeId: ExerciseTypeId): ExerciseItem[] {
  const byId = new Map(exerciseItems.map((i) => [i.id, i]));
  const restored: ExerciseItem[] = [];
  for (const id of resume.itemIds) {
    const found = byId.get(id);
    if (found && found.typeId === typeId) restored.push(found);
  }
  return restored;
}

/**
 * 板块推进动画见 `components/SlideIn`（与「积累」测验共用同一套滑入）。
 * 它与上方进度条之间同样是这 16（`Screen` 的 `contentStyle`）。
 */

/**
 * 按住录音按钮（FR-E-9 ~ FR-E-11）。
 * 独立成组件：底色与图标都要反映按下态，而 Pressable 的 style 回调作用域不影响子节点。
 * 按钮本体只画一颗麦克风图标（不写「按住说话」字样），录音中才换成带秒数的文字反馈。
 */
function HoldToSpeakButton({
  active,
  seconds,
  onPressIn,
  onPressOut,
}: {
  active: boolean;
  seconds: number;
  onPressIn: () => void;
  onPressOut: () => void;
}) {
  const theme = useTheme();
  const [pressed, setPressed] = useState(false);
  const highlight = active || pressed;
  return (
    <Pressable
      onPressIn={() => {
        setPressed(true);
        onPressIn();
      }}
      onPressOut={() => {
        setPressed(false);
        onPressOut();
      }}
      accessibilityRole="button"
      accessibilityLabel={tr('按住录音，松开结束')}
      style={{
        width: '100%',
        height: FOOTER_BUTTON_HEIGHT,
        borderRadius: 999,
        borderWidth: stroke.base,
        borderColor: theme.colors.border,
        /* 底栏按钮与页面同底（`bg`），不铺白：常态只剩描边，按下 / 录音中才整块转品牌红 */
        backgroundColor: highlight ? theme.colors.brand : theme.colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {active ? (
        <AppText kind="md" color={theme.colors.brandOn}>
          {trf('录音中 {s}s，松开结束', { s: seconds })}
        </AppText>
      ) : (
        <MicIcon size={26} color={highlight ? theme.colors.brandOn : theme.colors.text} />
      )}
    </Pressable>
  );
}

/**
 * 播放行（IF-2 扬声器 + FR-E-6 倍速）：不套面板，整行占满正文宽度，
 * 左边一条四档倍速胶囊条（分段切换，各段自身不带底/边，选中态只落在文字颜色上），
 * 右边一颗圆形播放钮（品牌红实底 + 喇叭图标），两块之间隔 `BLOCK_GAP`。
 * 等高 = 内部文字行高 + 上下各 `SEGMENT_PADDING` + 描边（不写死高度）。
 * 听写 / 听力理解的题干下方、口语跟读的原文下方三处共用这一套。
 */
function AudioPlayRow({
  rate,
  onRateChange,
  onPlay,
  disabled = false,
  playLabel,
}: {
  rate: number;
  onRateChange: (r: number) => void;
  onPlay: () => void;
  /** 听写的重播次数用尽时置灰且不可点 */
  disabled?: boolean;
  /** 播放钮的无障碍名；不传则为「播放发音」 */
  playLabel?: string;
}) {
  const theme = useTheme();
  const size = theme.size(typography.lineHeights.md) + SEGMENT_PADDING * 2 + stroke.base * 2;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: BLOCK_GAP }}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          borderRadius: 999,
          borderWidth: stroke.base,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          overflow: 'hidden',
        }}
      >
        <SegmentedTabs
          items={RATE_TABS}
          value={String(rate)}
          onChange={(k) => onRateChange(Number(k))}
          variant="text"
          accessibilityLabel="播放语速"
        />
      </View>
      <Pressable
        onPress={onPlay}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={playLabel ?? tr('播放发音')}
        hitSlop={10}
        style={{
          width: size,
          height: size,
          borderRadius: 999,
          backgroundColor: theme.colors.brand,
          borderWidth: stroke.base,
          borderColor: theme.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? opacity.disabled : 1,
        }}
      >
        <SoundIcon size={PLAY_CIRCLE_ICON} color={theme.colors.brandOn} />
      </Pressable>
    </View>
  );
}

/**
 * 练习会话（FR-E-5 ~ FR-E-15）。
 * 一个路由覆盖九种题型，三个板块依次推进：选题库（FR-E-4）→ 选文体（阅读 / 翻译 / 听力理解，
 * 错题重做与综合跳过）→ 题目。板块之间不换页：选完题库 / 文体，下一块自动从右侧滑入，
 * 上面挂一条三段进度条（题库 · 文体 | 题目）持续显示走到哪儿了。
 * 题目队列在进入题目板块时一次性抽定：该题库该题型的全部题目随机抽最多 SESSION_SIZE 道。
 *
 * **提交后不再切结果页**（全题型统一走听力理解那套）：评分返回后留在题面上，
 * 该冻结的作答就地冻结（客观题选项标对错、听写胶囊里也画勾 / 叉、文本框只读），
 * 底部固定「查看解析 / 加入题集 / 下一题」三个按钮。「查看解析」把该题型的参考内容
 * （听力原文 / 参考译文 / 参考范文 / 示范朗读 / 正确拼写）就地展开在作答下方，固定落在最后一块；
 * 阅读理解把「定位句 + 题目解析」合成一块（中间 Divider），
 * AI 主观题（写 / 译 / 说）把「具体问题定位 + 改进建议」合成一块（FR-E-14 的理由与建议）。
 * 结果面板沿用默认描边（`colors.border` 灰），不额外上色。
 * **分数与分项得分只有写作与翻译显示**（`def.board === 'writing' | 'translating'`）且**默认展开**，
 * 其余题型只用对错 / 参考内容说话。
 */
export default function PracticeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{
    typeId: string;
    mode?: string;
    set?: string;
    item?: string;
    /** '1' = 从练习页「最近练习」进来，接上次退出的那道题继续做 */
    resume?: string;
  }>();
  const typeId = (params.typeId ?? 'dictation') as ExerciseTypeId;
  const def = exerciseTypeMap[typeId] ?? exerciseTypeMap.dictation;
  /**
   * 阅读理解的正文 / 题目 / 选项统一走 md 档（18px）：正文与题目在下方阅读分支里写死 md，
   * 而选项那一块是全 App 共用的，所以按题型切档 —— 其余题型的选项仍是既定的 body（16px）。
   */
  const readingPassage = typeId === 'reading-genre';
  /** wrong = 错题重做（FR-E-7）；mixed = 综合（跨板块随机） */
  const mode = params.mode === 'wrong' || params.mode === 'mixed' ? params.mode : undefined;
  /**
   * 从题集列表点进来的那一路（`set` + `item`）：
   * `set` = 哪一档题集（板块 id 或 'quiz'），`item` = 点的那道题（排在队首，从它开始）。
   * 从练习页题型 / 测验页签直接进来的没有这两个参数，口径不变。
   */
  const setKey = mode === 'wrong' && params.set ? params.set : undefined;
  const startItemId = mode === 'wrong' && params.item ? params.item : undefined;
  /**
   * 测验（练习页「测验」页签下的两个入口）与日常练习分开：
   * 测验的作答只留一份记录，不计入打卡卡片（今日时长 / 今日任务 / 连续天数）与学习统计。
   */
  const isQuiz = mode !== undefined;
  const { state, actions } = useApp();
  const timer = usePracticeTimer();
  /**
   * 从题集列表点某道题进来（有 `set`）：**跳过选题库**，直接用当前题库把那道题开起来 ——
   * 「点题即开始」。所以初始就落在作答步骤，题库回填成上次选的那个（进度条上不显示「选择题库」）。
   */
  const fromSet = Boolean(setKey);
  /**
   * 从练习页「最近练习」进来（`?resume=1`）：接上上次退出时的断点 —— 题型 / 题库 / 本次队列 /
   * 停在第几题全部照旧，直接落在作答步骤。只在首次渲染取一次（之后 store 里的断点由本页自己回写）。
   * 断点里的题一道都取不回（换了题库、题目被删）时当作没有断点，退回原来的「先选题库」流程。
   */
  const [resumed] = useState(() => {
    if (params.resume !== '1') return null;
    const saved = state.lastPractice;
    if (!saved || saved.typeId !== typeId) return null;
    const restored = restoreSessionItems(saved, typeId);
    return restored.length > 0 ? { saved, items: restored } : null;
  });

  /** 错词队列（听写 / 跟读攒下的词）：题集入口在首次渲染就要用它抽题，所以提到状态前面 */
  const wrongQueue = useMemo(() => {
    const words = state.attempts
      .filter((a) => a.wrongWords && a.wrongWords.length > 0)
      .flatMap((a) => a.wrongWords ?? []);
    return [...new Set(words)];
  }, [state.attempts]);

  const genres = useMemo(() => genresFor(typeId), [typeId]);
  /** 带文体的题型（阅读 / 翻译 / 听力理解）才走文体这一块；错题重做与综合直接进题目 */
  const hasGenreStep = genres.length > 0 && !mode;
  /** 本次选定的题库 id（null = 还没选；三段进度条的题库段据此判断完成态） */
  const [bankId, setBankId] = useState<string | null>(
    resumed ? resumed.saved.levelId : fromSet ? state.levelId : null,
  );
  /**
   * 文体板块里**待确认**的选择：点一下只把它标成选中（品牌红描边），
   * 按「确认」才真正抽题开始作答 —— 与题库板块的「先选、再确认」一致。
   * 取值是文体名，或「随机选题」那一项（`RANDOM_GENRE`）；`undefined` = 还没选。
   */
  const [pickedGenre, setPickedGenre] = useState<string | undefined>(undefined);
  /**
   * 文体是否已定（按过「确认」、已经抽题进题目板块）。
   * 进度条的文体段就认它 —— 只「点中卡片」不算，返回文体板块时会退回占位态。
   * 段上显示的名字取 `pickedGenre`，不再另存一份「本次文体」。
   */
  const [genrePicked, setGenrePicked] = useState(Boolean(resumed));
  /**
   * 本次作答的题目队列：进入题目板块时一次性抽定（FR-E-5 ~ FR-E-13），
   * 之后「下一题」只挪指针不再重抽 —— 否则每答一题都会换一批题。
   */
  const [items, setItems] = useState<ExerciseItem[]>(() =>
    resumed
      ? resumed.items
      : fromSet
        ? buildSessionItems({
            typeId,
            levelId: state.levelId,
            mode,
            wrongQueue,
            savedItems: state.savedItems,
            set: setKey,
            startItemId,
          })
        : [],
  );
  const [itemIndex, setItemIndex] = useState(resumed?.saved.index ?? 0);
  /**
   * 本场每题落下的 attempt id（题目下标 → attempt id）：结算页据此取每题的得分与对错
   * —— 按 id 取而不是按 `itemId` 反查，避免同一道题在别的场次做过时串到本场成绩里。
   */
  const [sessionAttempts, setSessionAttempts] = useState<Record<number, string>>({});
  /**
   * 进入本页先选题库（FR-E-4）：选完在同一页滑入下一块，不换页、不弹窗。
   * 从题集点题进来的那一支直接落在作答步骤（题目队列上面已经抽好）。
   */
  const [step, setStep] = useState<Step>(resumed || fromSet ? 'answer' : 'bank');
  /** 作答现场：从断点恢复时连上次的作答一起带回（已确认的那题不用重做，见 `draft`） */
  const [answer, setAnswer] = useState(resumed?.saved.draft?.answer ?? '');
  /** 主观题作答框的占位提示：聚焦后即隐（全 App 统一口径） */
  const answerHint = useFocusPlaceholder(tr('在这里作答…'));
  const [replays, setReplays] = useState(0);
  /** 播放器上的倍速档位（0.5 / 0.75 / 1.0 / 1.25，取值见 appConfig.exercise.audioRateOptions） */
  const [playbackRate, setPlaybackRate] = useState(1);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(
    resumed?.saved.draft?.selectedChoice ?? null,
  );
  const [feedback, setFeedback] = useState<GradingFeedback>({ phase: 'idle', message: '' });
  const [attemptId, setAttemptId] = useState<string | null>(resumed?.saved.draft?.attemptId ?? null);
  const [recording, setRecording] = useState(false);
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  /**
   * 上一次录音的时长（秒）：0 = 本页还没录过，「听自己的录音」按钮此时禁用。
   * 初始开发阶段只记时长，音频本身待录音链路接入后再落盘。
   */
  const [lastRecordingSeconds, setLastRecordingSeconds] = useState(0);
  const recordRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** 提交后留在题面上就地展开「解析」（听力原文 / 定位句 / 参考译文 / 参考范文 / 示范朗读） */
  const [reveal, setReveal] = useState(Boolean(resumed?.saved.draft?.reveal));
  /** 本次已选的题库（含刚选的）；未选时为 null，此时进度条题库段停在占位态 */
  const chosenLevel = levels.find((l) => l.id === bankId) ?? null;

  const item: ExerciseItem | undefined = items[itemIndex] ?? items[0];
  const currentAttempt = attemptId ? state.attempts.find((a) => a.id === attemptId) : undefined;
  const result = currentAttempt?.result;

  /**
   * 提交后留在题面上（不切结果页）—— 全题型统一：对错就地标记（客观题标选项、听写标作答框、
   * 文本框转只读），底部换成「查看解析 / 加入题集 / 下一题」。
   * 判定条件 = 仍是作答步骤 + 本次作答已评分成功；「下一题」清掉 attemptId 后自动复位。
   */
  const inlineGraded = step === 'answer' && currentAttempt?.status === 'succeeded';
  /**
   * 本题是否已加入题集 —— **默认不加入**：每换到一道新题，按钮都回到「加入题集」的初态，
   * 不因为这道题曾在别的场次被收进题集就先显示「移出题集」。
   * 按钮本身是**可逆开关**：点一次加入、再点一次取消，因此加入后仍然可点。
   */
  const [savedMarked, setSavedMarked] = useState(Boolean(resumed?.saved.draft?.savedMarked));

  /** 本次作答的起点秒数：每次进入作答步骤时记一次，用于算「用时」（FR-E-2） */
  const startSeconds = useRef(0);
  /** 测验不走全局计时器（不计入卡片），改用进入作答的时间戳记录真实用时 */
  const quizStartedAt = useRef(Date.now());

  /**
   * 只统计作答时间（FR-E-2）：进入作答步骤才起表，评分返回（本轮作答结束）即停表结算，
   * 选题库 / 选文体阶段不计时；测验不计入打卡，全程不启动计时器。
   * `itemIndex` 也在依赖里：听力理解不切步骤，靠它来复位「本次作答」的计时起点。
   */
  useEffect(() => {
    if (isQuiz || step !== 'answer' || inlineGraded) return;
    startSeconds.current = timer.seconds;
    timer.start();
    return () => timer.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, itemIndex, inlineGraded]);

  /**
   * 朗读：`rate` 是界面上选的三档倍速（1 = 1.0×），乘在系统基准语速上。
   * 传 1 时与原先的朗读完全一致，所以文档朗读 / 头图朗读等调用点不受影响。
   */
  const speak = useCallback(
    (text: string, rate = 1) => {
      if (!text) return;
      Speech.stop();
      Speech.speak(text.replace(/\//g, ','), { language: 'en-US', rate: SPEECH_BASE_RATE * rate });
    },
    [],
  );

  /**
   * 选定题库（FR-E-4）：记为当前题库。带文体的题型接着在同一页滑入文体选择，
   * 其余（错题重做 / 综合，以及本就没有文体的题型）直接抽题进入作答。
   */
  const chooseBank = (levelId: string) => {
    actions.setLevel(levelId);
    setBankId(levelId);
    /** 换了题库，文体板块的待确认选择复位 */
    setPickedGenre(undefined);
    if (hasGenreStep) {
      setStep('choose');
      return;
    }
    startSession(levelId, undefined);
  };

  /** 进入题目板块：按题库 + 文体抽定本次的题目队列（题库不足 SESSION_SIZE 道时全出） */
  const startSession = (levelId: string, g?: string) => {
    setGenrePicked(true);
    setItemIndex(0);
    setSavedMarked(false);
    /* 开新一局：上一局的作答现场与本场成绩一并清空（从题库 / 文体进来时本来就是空的） */
    setAnswer('');
    setSelectedChoice(null);
    setReplays(0);
    setFeedback({ phase: 'idle', message: '' });
    setAttemptId(null);
    setReveal(false);
    setSessionAttempts({});
    setItems(
      buildSessionItems({
        typeId,
        levelId,
        genre: g,
        mode,
        wrongQueue,
        savedItems: state.savedItems,
        set: setKey,
        startItemId,
      }),
    );
    quizStartedAt.current = Date.now();
    setStep('answer');
  };

  /**
   * 断点续做（FR-M 练习页「最近练习」）：停在作答步骤时把「题型 + 题库 + 本次队列 +
   * 停在第几题 + 这道题的作答现场」回写进 store —— 抽定队列时写一次，之后每换一题、
   * 每次确认答案 / 展开解析 / 加入题集时各刷新一次。
   *
   * 注意：**不要在这里清除断点**。退出练习页时页头返回 / Android 返回键 / iOS 侧滑都是
   * 「逐级返回」，会先把这页退到题库板块（队列清空），如果清空就顺带清断点，
   * 那用户一离开练习页，「最近练习」就没了 —— 断点的语义是「上次退出的那次练习」，
   * 退到哪一层都该留着。只有下次真正抽定新队列时才被覆盖。
   */
  useEffect(() => {
    if (step !== 'answer' || items.length === 0) return;
    actions.savePracticeResume({
      typeId,
      levelId: bankId ?? state.levelId,
      mode,
      set: setKey,
      itemIds: items.map((i) => i.id),
      index: itemIndex,
      /**
       * 作答现场：**已经确认过答案**（`attemptId` 有值）才带上 —— 下次从主页接着做时
       * 直接呈现上次的判定与作答，不用重做一遍；还没确认就不带（`null`），
       * 免得把写到一半的内容也存进去，那道题重新作答。
       */
      draft: attemptId ? { attemptId, answer, selectedChoice, reveal, savedMarked } : null,
      updatedAt: Date.now(),
      // 提交后文本框只读、选项锁定，`answer` / `selectedChoice` 不再变，
      // 所以它们不进依赖：`attemptId` 变化那一帧的闭包里拿到的就是最终作答。
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, items, itemIndex, bankId, mode, setKey, typeId, attemptId, reveal, savedMarked]);

  /** 回到第一步重新选题库（题库下没有该题型的题目时用） */
  const backToBank = () => {
    setBankId(null);
    setPickedGenre(undefined);
    setGenrePicked(false);
    setItems([]);
    setItemIndex(0);
    setSavedMarked(false);
    setSessionAttempts({});
    setStep('bank');
  };

  /**
   * 逐级返回（本页内部的「上一层」，不是退出本页）：
   * 题目板块 → 文体板块（有这一步的题型）→ 题库板块 → 退出本页。
   * 页头返回箭头、Android 返回键、iOS 侧滑都走这里，所以整条练习是「一页三板块」的单向推进 + 逐级回退。
   *
   * 退回上一层时把本次作答清空（题目队列 / 选项 / 草稿 / 评分反馈 / 录音计时），
   * 但**保留已选的题库与文体高亮**，方便直接再按「确认」重来。
   * 评分进行中不让退（避免半途清掉正在写回的这次作答）。
   */
  const goBackStage = () => {
    if (feedback.phase === 'grading' || feedback.phase === 'soft-pending') return;
    if (recording) stopRecording();
    /* 作答板块与结算页同一层：从结算页返回也是退回题库 / 文体，并把这一局清干净 */
    if (step === 'answer' || step === 'result') {
      setAttemptId(null);
      setAnswer('');
      setSelectedChoice(null);
      setReplays(0);
      setReveal(false);
      setFeedback({ phase: 'idle', message: '' });
      setSavedMarked(false);
      setItems([]);
      setItemIndex(0);
      setSessionAttempts({});
      /* 文体这一步重来（连选择也要重走） */
      setGenrePicked(false);
      setStep(hasGenreStep ? 'choose' : 'bank');
      return;
    }
    if (step === 'choose') {
      setPickedGenre(undefined);
      setGenrePicked(false);
      setItems([]);
      setItemIndex(0);
      setStep('bank');
      return;
    }
    /* 已在题库板块：没有更上一层了，退出本页 */
    router.back();
  };

  /**
   * Android 硬件返回键与页头返回箭头同一口径：还在本页内部的板块就走「逐级返回」，
   * 已在题库板块时返回 false，交回系统 —— 也就是退出本页。
   */
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'bank') return false;
      goBackStage();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  /**
   * iOS 侧滑返回也走「逐级返回」：还在本页内部的板块时先关掉原生侧滑手势，
   * 免得一滑就整页退出、跳过文体 / 题库这两层；回到题库板块后手势恢复，可以滑出去。
   */
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: step === 'bank' });
  }, [navigation, step]);

  const startRecording = () => {
    setRecording(true);
    setRecordedSeconds(0);
    recordRef.current = setInterval(() => setRecordedSeconds((s) => s + 1), 1000);
  };

  const stopRecording = () => {
    setRecording(false);
    if (recordRef.current) clearInterval(recordRef.current);
    recordRef.current = null;
    // 录满 1 秒才算一次有效录音，「听自己的录音」按钮才有东西可放
    if (recordedSeconds > 0) setLastRecordingSeconds(recordedSeconds);
    // 初始开发阶段：语音识别由第三方服务承担，这里按朗读时长与文本完整性估算
    setAnswer(item?.speakText ?? '');
  };

  /**
   * 听自己的上一次录音（按钮在「按住录音」左边，两者一起固定在底部「确认」上方）。
   * 初始开发阶段录音没有落盘，先用系统朗读把本次跟读文本读一遍作占位回放；
   * 录音链路接入后改成播放本地音频文件即可。没录过时按钮是禁用态，这里再兜一次底。
   */
  const replayRecording = () => {
    if (lastRecordingSeconds <= 0 || !item?.speakText) return;
    Speech.stop();
    Speech.speak(item.speakText, { rate: SPEECH_BASE_RATE });
  };

  useEffect(() => () => {
    if (recordRef.current) clearInterval(recordRef.current);
    Speech.stop();
  }, []);

  useEffect(() => {
    if (recording && recordedSeconds >= appConfig.exercise.recordingMaxSeconds) stopRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, recordedSeconds]);

  const composedAnswer = item?.answerIndex !== undefined ? String(selectedChoice ?? '') : answer;

  const submit = async () => {
    if (!item) return;
    // 练习的用时取自全局计时器增量；测验没有计时器，按进入本页到提交的实际秒数记录
    const durationSec = isQuiz
      ? Math.max(1, Math.round((Date.now() - quizStartedAt.current) / 1000))
      : Math.max(1, Math.round(timer.seconds - startSeconds.current));
    const localResultPreview =
      item.answerIndex !== undefined
        ? selectedChoice === item.answerIndex
          ? 100
          : 0
        : item.dictationAnswer
          ? spellingMatches(composedAnswer, item.dictationAnswer)
            ? 100
            : 0
          : null;

    // 未提交答案就退出不计入任务数 → 只有走到这里才创建 attempt（FR-E-3 验收标准）
    // 提交与评分分两条事件：分值靠评分那条，完成率靠提交这条，中间失败也能看出卡在哪
    track(EVENT_NAMES.exerciseSubmit, { type: typeId, quiz: isQuiz, sec: durationSec });
    const gradeStartedAt = Date.now();
    const id = actions.startAttempt({
      typeId,
      levelId: state.levelId,
      itemId: item.id,
      board: def.board,
      promptTitle: item.title,
      prompt: item.prompt,
      answer: composedAnswer,
      durationSec,
      // 测验的作答只记录、不计入打卡与统计
      excluded: isQuiz,
    });
    setAttemptId(id);
    /* 记下「这一题」的 attempt id → 结算页逐题取分与对错用 */
    setSessionAttempts((m) => ({ ...m, [itemIndex]: id }));
    setReveal(false);
    // 评分期间留在作答页（提示只在按钮的转圈上）。
    // 练习在这里就停表：等评分的那几秒不算学习时长，也不等切板块才结算。
    if (!isQuiz) timer.stop();

    const graded = await requestGrading({
      attemptId: id,
      item,
      def,
      answer: composedAnswer,
      seconds: durationSec,
      onFeedback: setFeedback,
    });

    const score = graded ? (localResultPreview ?? graded.total) : null;
    track(EVENT_NAMES.gradeResult, {
      type: typeId,
      ok: Boolean(graded),
      ms: Date.now() - gradeStartedAt,
      score: score ?? -1,
      quiz: isQuiz,
    });

    if (graded) {
      actions.finishAttempt(id, graded, score ?? graded.total);
    } else {
      actions.finishAttempt(id, null, null);
    }
    /* 评分返回后**不换屏**：留在作答页就地展开对错与解析（全题型同一口径，见 inlineGraded） */
  };

  /** 下一题：还有题就挪指针、清掉上一题的作答与评分状态；最后一题答完则进结算页 */
  const goNext = () => {
    if (itemIndex + 1 < items.length) {
      setItemIndex(itemIndex + 1);
      setStep('answer');
      setAnswer('');
      setSelectedChoice(null);
      setReplays(0);
      setFeedback({ phase: 'idle', message: '' });
      setAttemptId(null);
      setReveal(false);
      // 新题回到「默认不加入题集」的初态
      setSavedMarked(false);
      return;
    }
    /* 最后一题：不再直接退页，改为进本场结算页（原地替换作答区，见 resultPanel） */
    setStep('result');
  };

  const canSubmit =
    item?.answerIndex !== undefined
      ? selectedChoice !== null
      : def.needsMic
        ? answer.length > 0
        : answer.trim().length > 0;

  /** 正在评分（占位提示 / 软超时），底部「确认」按钮据此转圈并禁用 */
  const submitting = feedback.phase === 'grading' || feedback.phase === 'soft-pending';

  /** 听写的重听次数已达上限（听力理解不受此限，可反复听） */
  const dictationExhausted =
    typeId === 'dictation' && replays >= appConfig.exercise.dictationMaxReplays;

  /**
   * 听写评分后的对错（判定口径与 `domain/grading.ts` 里听写那一支一致）：
   * 勾 / 叉**画在作答胶囊内部右侧**（与选项同款：拼对红边红勾、拼错黑边黑叉）—— 听写没有选项可标，标记落在作答本身。
   */
  const dictationCorrect =
    typeId === 'dictation' && item?.dictationAnswer
      ? spellingMatches(answer, item.dictationAnswer)
      : null;

  /**
   * 「查看解析」最后那块参考内容的标题与正文，按题型取 ——
   * 客观题给对错依据（听力原文 / 正确拼写），主观题给参考译文 / 范文 / 示范朗读文本。
   * 阅读理解的依据是「定位句」，已并进上面那块合并卡（见渲染处），所以这里只服务其余题型。
   */
  const revealTitle =
    typeId === 'dictation'
      ? '正确拼写'
      : typeId === 'comprehension'
        ? '听力原文'
        : typeId === 'reading-genre'
          ? '定位句'
          : def.board === 'translating'
            ? '参考译文'
            : def.board === 'speaking'
              ? '示范朗读'
              : '参考范文';
  const revealText =
    typeId === 'dictation'
      ? (item?.dictationAnswer ?? '')
      : typeId === 'comprehension'
        ? (item?.audioText ?? '')
        : typeId === 'reading-genre'
          ? (item?.evidence ?? '')
          : (result?.reference ?? '');

  /**
   * 底部固定条的「确认」提交按钮：文字作答与口语共用。
   * 口语那一支要在它**上方**再挂一行录音控件（左「听自己的录音」+ 右「按住录音」），见 Screen 的 footer。
   */
  const confirmSubmitButton = (
    <PrimaryButton
      style={FOOTER_BTN}
      label="确认"
      loading={submitting}
      disabled={!canSubmit || submitting}
      onPress={submit}
    />
  );

  /* ---------------- 三段进度条：左半区「题库 · 文体」，右半区「题目」 ----------------
     每一段的「已完成」都跟**当前所在区域**绑定 —— 只有走完并确认、离开那个板块才算完成，
     所以逐级返回（题目 → 文体 → 题库）时对应段会自动退回占位态，条上永远是
     「前面几段红、当前这一段（第一段没红的）在选、后面的还没到」：
       题库段 → `step !== 'bank'`（按过「确认」离开题库板块）
       文体段 → `genrePicked`（按过「确认」抽题，进题目板块那一刻才 true）
       题目段 → 题目队列是否已抽定（`items.length > 0`）
     注意别用「卡片被点中」当完成条件（`bankId` / `pickedGenre` 只是待确认的高亮），
     否则人还站在题库区、条上题库段就已经满了，返回时也对不上。 */
  const answered = Math.min(itemIndex + 1, items.length);
  const total = items.length;
  const progressPct = total > 0 ? Math.round((answered / total) * 100) : 0;
  /** 题库已确认（按过「确认」，step 已离开题库板块） */
  const bankDone = step !== 'bank';

  const leftStages: ProgressStage[] = [
    {
      label: bankDone && chosenLevel ? chosenLevel.labelZh : '选择题库',
      ratio: bankDone ? 1 : 0,
      pending: !bankDone,
      accessibilityLabel:
        bankDone && chosenLevel
          ? trf('{name}，已选中', { name: tr(chosenLevel.labelZh) })
          : tr('选择题库'),
    },
  ];
  if (hasGenreStep) {
    /* 文体段显示的名称 = 文体列表里那张卡的文案本身（逐字一致）：
       选了「随机选题」就写「随机选题」，不要再显示成「不限」。
       取值走 `pickedGenre`（待确认/已确认的选择都留着），不靠 `genre`（抽题时随机选题会被折成 undefined）。 */
    const genreStageLabel =
      pickedGenre === RANDOM_GENRE ? '随机选题' : (pickedGenre ?? '不限');
    leftStages.push({
      label: genrePicked ? genreStageLabel : '选择文体',
      ratio: genrePicked ? 1 : 0,
      pending: !genrePicked,
      accessibilityLabel: genrePicked ? tr(genreStageLabel) : tr('选择文体'),
    });
  }

  // 尚未抽题（还没选题库 / 文体）时不写「题目」占位，直接给零进度「0% 0/0」——
  // 三段进度条显示的永远是真实进度，没有第三种状态（NFR-7 文字通道）
  const questionStage: ProgressStage = {
    label: `${answered}/${total}`,
    leading: `${progressPct}%`,
    ratio: total > 0 ? answered / total : 0,
    pending: total === 0,
    accessibilityLabel: `${tr('题目')} ${answered}/${total}，${progressPct}%`,
  };

  /* ---------------- 结算页数据（本场逐题结果） ----------------
     每题优先取本场记下的 attempt（`sessionAttempts`）；断点续做进来的题没有记录，
     回落到该题最近一次成功的作答（同 `itemId`、`status === 'succeeded'` 里取完成时间最晚的）。
     客观题判对错（选择题比选项、听写比拼写，与 `domain/grading` 口径一致）；
     主观题只带分数、不判对错 —— 正确率只看客观题。 */
  const sessionOutcome = items.map((it, i) => {
    const id = sessionAttempts[i];
    const attempt = id
      ? state.attempts.find((a) => a.id === id)
      : state.attempts
          .filter((a) => a.itemId === it.id && a.status === 'succeeded')
          .sort((a, b) => b.finishedAt - a.finishedAt)[0];
    const objectiveQ = isObjective(it);
    const correct = !attempt || !objectiveQ
      ? null
      : it.answerIndex !== undefined
        ? attempt.answer === String(it.answerIndex)
        : spellingMatches(attempt.answer, it.dictationAnswer ?? '');
    return {
      item: it,
      attempt,
      objective: objectiveQ,
      correct,
      /** 得分率 0~100（客观题非 0 即 100，主观题是 AI 总分）；没做过为 null */
      score: attempt?.scoreRate ?? null,
    };
  });
  const objectiveOutcome = sessionOutcome.filter((o) => o.objective);
  const subjectiveOutcome = sessionOutcome.filter((o) => !o.objective);
  const rightCount = objectiveOutcome.filter((o) => o.correct === true).length;
  const wrongCount = objectiveOutcome.filter((o) => o.correct === false).length;
  /** 正确率：只统计客观题；本场一道客观题都没有时为 null（界面显示 —） */
  const accuracy = objectiveOutcome.length > 0 ? Math.round((rightCount / objectiveOutcome.length) * 100) : null;

  /**
   * 从结算页点回某一道题：把该题的作答现场还原成「已评分」的样子（解析默认展开），
   * 底栏随之回到「查看解析 / 加入题集 / 下一题」那一套 —— 相当于原地回看这一题。
   */
  const jumpToItem = (i: number) => {
    const outcome = sessionOutcome[i];
    const target = items[i];
    if (!outcome || !target) return;
    setItemIndex(i);
    setStep('answer');
    setAnswer(outcome.attempt?.answer ?? '');
    setSelectedChoice(
      target.answerIndex !== undefined && outcome.attempt ? Number(outcome.attempt.answer) : null,
    );
    setAttemptId(outcome.attempt?.id ?? null);
    setReveal(true);
    setSavedMarked(false);
    setReplays(0);
    setFeedback({ phase: 'idle', message: '' });
  };

  /* ---------------- 板块一：选题库（FR-E-4） ---------------- */
  const bankPanel = (
    <>
      {/* 标题与本题题干同号（24px，`lg` 档），不带 `SectionTitle` 上方那条装饰红短横 */}
      <AppText kind="lg" color={theme.colors.text} numberOfLines={1}>
        选择题库
      </AppText>
      {/* 每张卡只写题库名（如「日常」「IELTS」「TOEFL」），不再跟一行英文缩写小注释（如 Daily） */}
      <View style={{ gap: 8 }}>
        {levels.map((l) => {
          /** 选中态跟的是**本地待确认**的选择（`bankId`），不是全局的当前题库 */
          const current = l.id === bankId;
          const name = tr(l.labelZh);
          return (
            <Card
              key={l.id}
              onPress={() => setBankId(l.id)}
              accessibilityLabel={current ? trf('{name}，已选中', { name }) : name}
              style={{ padding: 16 }}
              strokeColor={current ? theme.colors.brand : theme.colors.border}
            >
              <AppText
                kind="md"
                color={current ? theme.colors.brand : theme.colors.text}
                numberOfLines={1}
              >
                {l.labelZh}
              </AppText>
            </Card>
          );
        })}
      </View>
    </>
  );

  /* ---------------- 板块二：选文体（阅读 / 翻译 / 听力理解才有） ---------------- */
  /** 「随机选题」（不限文体）是否处于待确认的选中态 */
  const randomSelected = pickedGenre === RANDOM_GENRE;
  const genrePanel = (
    <>
      {/* 标题与本题题干同号（24px，`lg` 档），不带 `SectionTitle` 上方那条装饰红短横 */}
      <AppText kind="lg" color={theme.colors.text} numberOfLines={1}>
        选择文体
      </AppText>
      {/* 面板样式与「选择题库」完全一致：同一套 `Card`（面板底 + 描边 + md 主标题），
          选中态同为品牌红描边 + 红字，不再是品牌红实底的题型 pill */}
      <View style={{ gap: 8 }}>
        {genres.map((g) => {
          const selected = g === pickedGenre;
          const name = tr(g);
          return (
            <Card
              key={g}
              onPress={() => setPickedGenre(g)}
              accessibilityLabel={selected ? trf('{name}，已选中', { name }) : name}
              style={{ padding: 16, gap: 4 }}
              strokeColor={selected ? theme.colors.brand : theme.colors.border}
            >
              <AppText
                kind="md"
                color={selected ? theme.colors.brand : theme.colors.text}
                numberOfLines={1}
              >
                {g}
              </AppText>
            </Card>
          );
        })}
        {/* 「随机选题」= 最后一张同款面板（不选文体，题库里该题型的题目全收随机抽），
            接在其它文体下方，与它们同样「先选、再确认」 */}
        <Card
          onPress={() => setPickedGenre(RANDOM_GENRE)}
          accessibilityLabel={
            randomSelected ? trf('{name}，已选中', { name: tr('随机选题') }) : tr('随机选题')
          }
          style={{ padding: 16 }}
          strokeColor={randomSelected ? theme.colors.brand : theme.colors.border}
        >
          <AppText
            kind="md"
            color={randomSelected ? theme.colors.brand : theme.colors.text}
            numberOfLines={1}
          >
            随机选题
          </AppText>
        </Card>
      </View>
      {/* 只有「确认」置底，见 Screen 的 footer 槽（与作答页的「确认」同一位置、同一套按钮） */}
    </>
  );

  /**
   * 评分失败（FR-E-15）：就地显示在作答页，草稿仍在输入框里。
   * 评分中不再有独立文案（转圈在按钮上），所以这里只处理失败态。
   */
  const gradeFailedCard =
    currentAttempt?.status === 'failed' && !inlineGraded ? (
      <Card style={{ padding: 16, gap: 10 }}>
        <AppText kind="md" color={theme.colors.brand}>
          {feedback.message || friendlyError('UPSTREAM_UNAVAILABLE')}
        </AppText>
        <AppText kind="micro" color={theme.colors.textSecondary}>
          你的作答已保留，可以稍后重试；重试成功后覆盖失败记录，不产生重复记录。
        </AppText>
        <PrimaryButton label="重试评分" onPress={submit} />
        <PrimaryButton
          label="离线查看我的作答"
          tone="ghost"
          onPress={() => router.push(`/attempt/${currentAttempt?.id}` as never)}
        />
      </Card>
    ) : null;

  /* ---------------- 板块三：题目（作答，评分后同屏展开得分 / 解析） ---------------- */
  const questionPanel = !item ? (
    <>
      <EmptyState title="该题库下暂无此题型的题目" hint="可换一个题库再试" />
      <PrimaryButton label="重新选择题库" tone="ghost" onPress={backToBank} />
    </>
  ) : step === 'answer' ? (
        <>
          {/* 题干：不套面板、不带「题目要求」小标题，直接以 **24px 粗体**起头（lg 档，
              全 App 题干同号：写作主题目与听力练习那道题一样大）；
              口语三题型换成固定指令（「请阅读下方词与短语 / 句与段 / 短文」，见 SPEAK_PROMPTS）。
              下面「具体要求 / 写作要点」是 16px（sm 档），属于同一块，所以内部走 8 的小间距。 */}
          <View style={{ gap: 8 }}>
            <AppText kind="lg" color={theme.colors.text}>
              {def.needsMic ? tr(SPEAK_PROMPTS[typeId] ?? '') : promptText(item.prompt)}
            </AppText>
            {item.points?.length ? (
              <View style={{ gap: 4 }}>
                {item.points.map((p) => (
                  <View key={p} style={{ flexDirection: 'row', gap: 6 }}>
                    <AppText kind="sm" color={theme.colors.brand}>
                      ·
                    </AppText>
                    <AppText kind="sm" color={theme.colors.textSecondary} style={{ flex: 1 }}>
                      {p}
                    </AppText>
                  </View>
                ))}
              </View>
            ) : null}
            {/* 听写的重播口径：12px（micro 档）小字紧贴在题目下方；次数以文字给出，不靠颜色传达（NFR-7） */}
            {typeId === 'dictation' ? (
              <AppText kind="micro" color={theme.colors.textMuted}>
                {trf('至多重播 {n} 次，已播 {u} 次', {
                  n: appConfig.exercise.dictationMaxReplays,
                  u: replays,
                })}
              </AppText>
            ) : null}
          </View>

          {/* 听写 / 听力：播放行（IF-2 扬声器 + FR-E-6 倍速），整行占满正文宽度 */}
          {typeId === 'dictation' || typeId === 'comprehension' ? (
            <AudioPlayRow
              rate={playbackRate}
              onRateChange={setPlaybackRate}
              onPlay={() => {
                speak(item.audioText ?? '', playbackRate);
                setReplays((r) => r + 1);
              }}
              disabled={dictationExhausted}
              playLabel={
                dictationExhausted
                  ? trf('重播次数已用完（{n} 次）', { n: appConfig.exercise.dictationMaxReplays })
                  : undefined
              }
            />
          ) : null}

          {/* 阅读：文章（FR-E-12 点词即查，点词变红 → 翻译 / 收入默认收藏夹），
              正文下方直接给出题目，再往下才是选项。
              正文 / 题目 / 选项三处同一档：md = 18px / 行高 24。
              题干带 READING_CARD_PADDING 的水平内边距：正文那块 `Card` 自带 16 内边距，
              不补这一层的话题目文字会比正文文字左右各宽出 16，两者对不齐。 */}
          {typeId === 'reading-genre' ? (
            <>
              <ReadingPassage text={item.audioText ?? ''} />
              {item.question ? (
                <AppText
                  kind="md"
                  color={theme.colors.text}
                  style={{ paddingHorizontal: READING_CARD_PADDING }}
                >
                  {item.question}
                </AppText>
              ) : null}
            </>
          ) : null}

          {/* 翻译：原文。不再挂「英文原文（译成中文）」这类小标题——题干已经写了翻译方向，
              也不再提供「分句作答」入口，作答一律在下方输入框里完成 */}
          {item.sourceText ? (
            <Card style={{ padding: 16 }}>
              <AppText kind="body" color={theme.colors.text}>
                {item.sourceText}
              </AppText>
            </Card>
          ) : null}

          {/* 客观题选项：胶囊型（高 64 / 全圆角 / 16px 文字 / 前缀加粗）。
              评分后就地判对错：正确的选项走品牌红描边 + 红勾，选错的选项走黑描边 + 黑叉。
              界面上不再写「正确答案 / 你的选择」文字，对错是「颜色 + 图形」双通道；
              屏幕阅读器仍读到这两个词（accessibilityLabel），信息不丢（NFR-7） */}
          {item.answerIndex !== undefined ? (
            <View style={{ gap: 8 }}>
              {(item.choices ?? []).map((c, i) => {
                const active = selectedChoice === i;
                const isKey = inlineGraded && i === item.answerIndex;
                const isWrongPick = inlineGraded && active && i !== item.answerIndex;
                /** 只用于无障碍播报的判词（界面上改用对号 / 叉号图形，不显示文字） */
                const mark = isKey ? '正确答案' : isWrongPick ? '你的选择' : undefined;
                /** 选错 → 黑（正文色）；选中 / 正确 → 品牌红；其余 → 正文色 */
                const fg = isWrongPick ? theme.colors.text : active || isKey ? theme.colors.brand : theme.colors.text;
                /** 描边同色：选错黑边、选中 / 正确红边、其余默认白（深色下为深灰）边 */
                const edge = isWrongPick
                  ? theme.colors.text
                  : active || isKey
                    ? theme.colors.brand
                    : theme.colors.border;
                return (
                  <Pressable
                    key={c}
                    onPress={inlineGraded ? undefined : () => setSelectedChoice(i)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={mark ? trf('{option}，{mark}', { option: `${String.fromCharCode(65 + i)}. ${c}`, mark: tr(mark) }) : undefined}
                    style={{
                      minHeight: theme.size(OPTION_HEIGHT),
                      justifyContent: 'center',
                      paddingHorizontal: 20,
                      borderRadius: 999,
                      borderWidth: stroke.base,
                      borderColor: edge,
                      backgroundColor: theme.colors.surface,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <View style={{ flexDirection: 'row', gap: 6, flexShrink: 1 }}>
                        {/* 前缀字重：非阅读题型保持加粗（sm 档 = 16px / 700，行高显式对齐 body 档才能基线对齐）；
                            阅读理解与选项文字同走 md 档 = 18px / 24，且**常规字重**（不抢正文，整块不加粗） */}
                        <AppText
                          kind={readingPassage ? 'md' : 'sm'}
                          weight={readingPassage ? 'regular' : undefined}
                          color={fg}
                          style={readingPassage ? undefined : { lineHeight: theme.size(typography.bodyLineHeight) }}
                        >
                          {`${String.fromCharCode(65 + i)}.`}
                        </AppText>
                        <AppText
                          kind={readingPassage ? 'md' : 'body'}
                          weight={readingPassage ? 'regular' : undefined}
                          color={fg}
                          style={{ flexShrink: 1 }}
                        >
                          {c}
                        </AppText>
                      </View>
                      {/* 对错记号：对号 / 叉号，盒子取首行行盒高，图标与首行文字居中对齐 */}
                      {isKey || isWrongPick ? (
                        <View
                          style={{
                            height: theme.size(
                              readingPassage ? typography.lineHeights.md : typography.bodyLineHeight,
                            ),
                            justifyContent: 'center',
                          }}
                        >
                          {isKey ? (
                            <CheckIcon size={18} color={theme.colors.brand} />
                          ) : (
                            <CloseIcon size={18} color={theme.colors.text} />
                          )}
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* 口语：跟读原文面板（FR-E-9 ~ FR-E-11）。一个 Card、原文 16px 正文色两端对齐；
              播放行不套面板，直接排在原文**下方**，与听力练习里那一行完全同款（四档倍速 + 圆形播放钮）。
              「按住录音」与左侧「听自己的录音」固定在底部「确认」上方，见 footer。 */}
          {def.needsMic ? (
            <>
              <Card style={{ padding: 16 }}>
                {/* 跟读原文：字号与行高都保持 16 / 22（`sm` 档那套），只把字重从 bold 换成 regular
                    —— 段落级长文本用常规字重更好读，`body` 档正好是 16px regular，行高再显式压回 sm 档 */}
                <AppText
                  kind="body"
                  color={theme.colors.text}
                  align="justify"
                  style={{ lineHeight: theme.size(typography.lineHeights.sm) }}
                >
                  {item.speakText}
                </AppText>
              </Card>
              <AudioPlayRow
                rate={playbackRate}
                onRateChange={setPlaybackRate}
                onPlay={() => speak(item.speakText ?? '', playbackRate)}
              />
            </>
          ) : null}

          {/* 文本作答。听写只给一个 64px 高的胶囊输入框：不套面板、不写「你的作答」小标题、
              也不要 placeholder（题干已说明拼写所听到的单词），选中即可直接写；
              其余题型（翻译 / 写作等）是多行矩形输入框（16px 圆角、基础高 64、自适应长高），同样不套面板。
              评分后两种输入框都转只读（作答冻结）；听写的勾 / 叉画在胶囊内部右侧，与客观题选项同一套对错样式 */}
          {item.answerIndex === undefined && !def.needsMic ? (
            typeId === 'dictation' ? (
              /* 听写 = 一个 64px 高的胶囊，**勾 / 叉画在胶囊内部右侧**，与客观题选项的对错完全同款：
                 拼对 = 品牌红描边 + 红勾，拼错 = 正文色描边 + 黑叉。
                 所以描边与实色底都落在外层这枚胶囊上，里面的输入框自己不带边框、不铺底色 */
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  height: theme.size(OPTION_HEIGHT),
                  borderWidth: stroke.base,
                  borderColor:
                    inlineGraded && dictationCorrect !== null
                      ? dictationCorrect
                        ? theme.colors.brand
                        : theme.colors.text
                      : theme.colors.border,
                  borderRadius: 999,
                  // 输入框统一内边距 16（内层 TextInput 清零，左右留白由此处给）
                  paddingHorizontal: layout.inputPad,
                  backgroundColor: theme.colors.surface,
                }}
              >
                <TextInput
                  value={answer}
                  onChangeText={setAnswer}
                  editable={!inlineGraded}
                  accessibilityLabel={tr('作答输入框')}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    flex: 1,
                    height: theme.size(OPTION_HEIGHT),
                    paddingHorizontal: 0,
                    paddingVertical: 0,
                    includeFontPadding: false,
                    textAlignVertical: 'center',
                    color: theme.colors.text,
                    fontFamily: inputFont('regular'),
                    fontSize: theme.size(16),
                    // 内层输入框自己也铺 surface（外层胶囊已有底色）：显式写上，避免平台默认底透出来
                    backgroundColor: theme.colors.surface,
                  }}
                />
                {inlineGraded && dictationCorrect !== null ? (
                  dictationCorrect ? (
                    <CheckIcon size={18} color={theme.colors.brand} />
                  ) : (
                    <CloseIcon size={18} color={theme.colors.text} />
                  )
                ) : null}
              </View>
            ) : (
              /* 多行作答（写作 / 翻译 / 词与短语 / 句与段 / 短文）：与听写同一口径 ——
                 **不套面板**、不写「你的作答」小标题、不显示字数统计，
                 就是一个 16px 圆角的矩形输入框（描边 + 实色底），基础高 64，随内容自适应长高 */
              <TextInput
                value={answer}
                onChangeText={setAnswer}
                editable={!inlineGraded}
                multiline
                {...answerHint}
                placeholderTextColor={theme.colors.textMuted}
                accessibilityLabel={tr('作答输入框')}
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  minHeight: theme.size(OPTION_HEIGHT),
                  borderWidth: stroke.base,
                  borderColor: theme.colors.border,
                  borderRadius: 16,
                  // 输入框统一内边距 16
                  padding: layout.inputPad,
                  color: theme.colors.text,
                  fontFamily: inputFont('regular'),
                  fontSize: theme.size(16),
                  lineHeight: theme.size(24),
                  textAlignVertical: 'top',
                  backgroundColor: theme.colors.surface,
                }}
              />
            )
          ) : null}

          {/* 提交按钮已移到底部固定条（FooterBar），正文里不再有按钮。
              评分期间留在本页，转圈提示由底部按钮承担 —— 不另写「正在评分…」文案 */}
          {gradeFailedCard}

          {/* 写作与翻译是显示分数的题型组：总分 + 用时 + 分项得分。
              **默认展示**（不随「查看解析」开关，提交后就出现）；其余题型不给分数，
              只按「对错 + 参考内容」说话（见下面的解析卡）。卡片沿用默认灰描边 */}
          {inlineGraded && result && (def.board === 'writing' || def.board === 'translating') ? (
            <Card style={{ padding: 16, gap: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <View>
                  <AppText kind="micro" color={theme.colors.textMuted}>
                    总分（满分 100）
                  </AppText>
                  <AppText kind="xxxl" color={theme.colors.brand}>
                    {String(Math.round(currentAttempt?.scoreRate ?? result.total))}
                  </AppText>
                </View>
                <Badge text={trf('用时 {v}', { v: formatDurationHuman(currentAttempt?.durationSec ?? 0) })} />
              </View>
              <Divider />
              <AppText kind="micro" color={theme.colors.textMuted}>
                分项得分
              </AppText>
              {result.breakdown.map((b) => (
                <View key={b.label} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <AppText kind="micro" color={theme.colors.text}>
                      {b.label}
                    </AppText>
                    <AppText kind="micro" color={theme.colors.textSecondary}>
                      {`${b.score} / ${b.max}`}
                    </AppText>
                  </View>
                  <View style={{ height: layout.progressHeight, borderRadius: layout.progressHeight / 2, backgroundColor: theme.colors.progressTrack }}>
                    <View
                      style={{
                        width: `${Math.round((b.score / Math.max(1, b.max)) * 100)}%`,
                        height: layout.progressHeight,
                        borderRadius: layout.progressHeight / 2,
                        backgroundColor: theme.colors.brand,
                      }}
                    />
                  </View>
                </View>
              ))}
            </Card>
          ) : null}

          {/* 查看解析：按题型就地展开下面的结果面板（描边沿用默认灰）。
              阅读理解 → 一个面板装两块内容（原文定位 + 题目解析），中间一条横线分隔（与设置页同款 Divider）；
              AI 主观题（写 / 译 / 说）→ 一个面板装两块内容（具体问题定位 + 改进建议），同样横线分隔（FR-E-14）；
              参考内容（听力原文 / 正确拼写 / 参考译文 / 参考范文 / 示范朗读）永远排在最后一块 ——
              所以翻译的「参考译文」落在最下方。阅读题的对错依据就是上面那个面板里的定位句，不再重复一份。 */}
          {inlineGraded && reveal ? (
            <>
              {typeId === 'reading-genre' ? (
                <Card style={{ padding: 16, gap: 12 }}>
                  <View style={{ gap: 8 }}>
                    <AppText kind="micro" color={theme.colors.textMuted}>
                      定位句
                    </AppText>
                    <AppText kind="body" color={theme.colors.text}>
                      {item.evidence ?? ''}
                    </AppText>
                  </View>
                  {item.explanation ? (
                    <>
                      <Divider />
                      <View style={{ gap: 8 }}>
                        <AppText kind="micro" color={theme.colors.textMuted}>
                          题目解析
                        </AppText>
                        <AppText kind="body" color={theme.colors.text}>
                          {item.explanation}
                        </AppText>
                      </View>
                    </>
                  ) : null}
                </Card>
              ) : null}

              {/* AI 主观题（写 / 译 / 说）：评分给的理由与建议合成一块（FR-E-14） */}
              {def.aiGraded && result ? (
                <Card style={{ padding: 16, gap: 12 }}>
                  <View style={{ gap: 8 }}>
                    <AppText kind="micro" color={theme.colors.textMuted}>
                      具体问题定位
                    </AppText>
                    {result.issues.length === 0 ? (
                      <AppText kind="micro" color={theme.colors.textSecondary}>
                        本次没有发现需要标注的问题。
                      </AppText>
                    ) : (
                      result.issues.map((issue, i) => (
                        <View key={`${issue.where}-${i}`} style={{ flexDirection: 'row', gap: 8 }}>
                          <Badge text={issue.kind} />
                          <View style={{ flex: 1 }}>
                            <AppText kind="micro" color={theme.colors.text}>
                              {issue.where}
                            </AppText>
                            <AppText kind="micro" color={theme.colors.textSecondary}>
                              {issue.detail}
                            </AppText>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                  {result.advice.length > 0 ? (
                    <>
                      <Divider />
                      <View style={{ gap: 8 }}>
                        <AppText kind="micro" color={theme.colors.textMuted}>
                          改进建议
                        </AppText>
                        {result.advice.map((a) => (
                          <View key={a} style={{ flexDirection: 'row', gap: 6 }}>
                            <AppText kind="micro" color={theme.colors.brand}>
                              →
                            </AppText>
                            <AppText kind="micro" color={theme.colors.text} style={{ flex: 1 }}>
                              {a}
                            </AppText>
                          </View>
                        ))}
                      </View>
                    </>
                  ) : null}
                </Card>
              ) : null}

              {/* 参考内容：听力原文 / 正确拼写 / 参考译文 / 参考范文 / 示范朗读 —— 固定最后一块 */}
              {revealText && typeId !== 'reading-genre' ? (
                <Card style={{ padding: 16, gap: 8 }}>
                  <AppText kind="micro" color={theme.colors.textMuted}>
                    {revealTitle}
                  </AppText>
                  <AppText kind="body" color={theme.colors.text}>
                    {revealText}
                  </AppText>
                  {def.board === 'speaking' ? (
                    <PrimaryButton label="播放示范朗读" tone="ghost" onPress={() => speak(revealText)} />
                  ) : null}
                </Card>
              ) : null}
            </>
          ) : null}
        </>
      ) : null;

  /* ---------------- 板块三：本场结算（做完最后一题点「下一题」进来） ----------------
     只报客观题的对错与正确率，主观题列出分数不判对错 —— 口径与 `sessionOutcome` 一致。
     底部「重做本场」重新抽题重开一局（FR-E-5：每次抽题都是新队列）。 */
  const resultPanel = (
    <>
      <View style={{ gap: 8 }}>
        <AppText kind="lg" color={theme.colors.text}>
          本场练习已完成
        </AppText>
        <AppText kind="tiny" color={theme.colors.textMuted}>
          {trf('{name} · 共 {n} 题', { name: tr(def.labelZh), n: items.length })}
        </AppText>
      </View>

      {/* 正确率：大数字走品牌红，下面两行给出计数与统计口径（文字通道，NFR-7） */}
      <Card style={{ padding: 16, gap: 6 }}>
        <AppText kind="micro" color={theme.colors.textMuted}>
          正确率
        </AppText>
        <AppText kind="xxxl" color={theme.colors.brand}>
          {accuracy === null ? '—' : `${accuracy}%`}
        </AppText>
        <AppText kind="tiny" color={theme.colors.textSecondary}>
          {trf('客观题 {n} 道 · 正确 {c} · 错误 {w}', {
            n: objectiveOutcome.length,
            c: rightCount,
            w: wrongCount,
          })}
        </AppText>
        {subjectiveOutcome.length > 0 ? (
          <AppText kind="tiny" color={theme.colors.textMuted}>
            {trf('主观题 {n} 道（记录分数，不计对错）', { n: subjectiveOutcome.length })}
          </AppText>
        ) : null}
      </Card>

      {/* 逐题清单：点一行回到那道题（回看作答 + 解析，解析默认展开） */}
      <View style={{ gap: 8 }}>
        {sessionOutcome.map((o, i) => {
          const marker = o.objective
            ? o.correct === true
              ? { text: tr('正确'), color: theme.colors.brand }
              : o.correct === false
                ? { text: tr('错误'), color: theme.colors.text }
                : { text: tr('未作答'), color: theme.colors.textMuted }
            : {
                text: o.score === null ? tr('未作答') : trf('{s} 分', { s: Math.round(o.score) }),
                color: theme.colors.textSecondary,
              };
          return (
            <Pressable
              key={`${o.item.id}-${i}`}
              onPress={() => jumpToItem(i)}
              accessibilityRole="button"
              accessibilityLabel={trf('第 {n} 题，{s}', { n: i + 1, s: marker.text })}
              style={{
                minHeight: 56,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 12,
                borderWidth: stroke.base,
                /* 当前停在最后一题上，所以清单里高亮的是它（与单词列表抽屉同一套「只换色」口径） */
                borderColor: i === itemIndex ? theme.colors.brand : theme.colors.border,
              }}
            >
              <AppText kind="micro" color={theme.colors.textMuted} style={{ width: 44 }}>
                {trf('第 {n} 题', { n: i + 1 })}
              </AppText>
              <AppText kind="sm" color={theme.colors.text} numberOfLines={1} style={{ flex: 1 }}>
                {promptText(o.item.prompt)}
              </AppText>
              <AppText kind="tiny" color={marker.color}>
                {marker.text}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </>
  );

  /** 当前板块：题库 / 文体 / 题目 / 结算（作答与就地评分同属题目板块，所以换题、评分返回都会重播滑入动画） */
  const stage: 'bank' | 'genre' | 'question' | 'result' =
    step === 'bank' ? 'bank' : step === 'choose' ? 'genre' : step === 'result' ? 'result' : 'question';

  return (
    <Screen
      header={
        <Header
          /* 页头只写当前练习大项的名称（「听力理解」等），不跟在题目名 / 文体这类详注后面 */
          title={def.labelZh}
          /* 返回箭头 = 逐级返回：题目 → 文体 → 题库 → 退出本页 */
          onBack={goBackStage}
        />
      }
      /* 「进度条 ↔ 操作区」= 16（BLOCK_GAP）；操作区内部块与块之间同为 16，
         只有同类元素之间是 8（选项 / 题库卡 / 文体 pill 各自的列表容器） */
      contentStyle={{ gap: BLOCK_GAP }}
      /* 口语的底部固定条是两行（录音行 + 确认），比常规多占一行高，滚动区底部相应多留一段 */
      bottomExtra={def.needsMic ? FOOTER_BUTTON_HEIGHT + 12 : 0}
      footer={
        /* 底部固定条：几何与单词页「上一词 / 收藏 / 下一词」同一套，各板块的确认动作都固定在这一条上。
           选题库 →「确认」（选中后才可用）；选文体 →「确认」（文体或「随机选题」选中后才可用）；
           评分返回后（全题型）→ 查看解析 / 加入题集（再点一次移出）/ 下一题；
           口语作答中 → 录音行（听自己的录音 + 按住录音）在上、「确认」在下；
           其余题目在作答中 → 单个「确认」提交按钮（评分期间按钮自带转圈）；
           做完最后一题进结算页 → 单个「重做本场」（重新抽题重开一局）。
           板块内部的逐级返回见 goBackStage（页头返回箭头 / Android 返回键 / iOS 侧滑）。 */
        step === 'result' ? (
          <FooterBar>
            <PrimaryButton
              style={FOOTER_BTN}
              label="重做本场"
              /* 重开一局：题库与文体沿用本场的选择，队列重新抽（startSession 会清掉本场成绩） */
              onPress={() =>
                startSession(
                  bankId ?? state.levelId,
                  pickedGenre === RANDOM_GENRE ? undefined : pickedGenre,
                )
              }
            />
          </FooterBar>
        ) : step === 'bank' ? (
          <FooterBar>
            <PrimaryButton
              style={FOOTER_BTN}
              label="确认"
              disabled={!bankId}
              onPress={() => {
                if (bankId) chooseBank(bankId);
              }}
            />
          </FooterBar>
        ) : step === 'choose' ? (
          <FooterBar>
            <PrimaryButton
              style={FOOTER_BTN}
              label="确认"
              disabled={!pickedGenre}
              onPress={() => {
                if (!pickedGenre) return;
                /* 选的是「随机选题」那一项 → 不带文体（undefined），题库里该题型的题目全收 */
                startSession(
                  bankId ?? state.levelId,
                  pickedGenre === RANDOM_GENRE ? undefined : pickedGenre,
                );
              }}
            />
          </FooterBar>
        ) : inlineGraded && item ? (
          <FooterBar>
            {/* 查看解析 / 收起解析：与另两枚同款图标钮（panel 胶囊 + 居中图标，无文字），
                展开态用「闭眼」、收起态用「睁眼」，与下方解析面板的展开状态一致 */}
            <PrimaryButton
              tone="ghost"
              panel
              style={FOOTER_BTN}
              accessibilityLabel={reveal ? '收起解析' : '查看解析'}
              icon={
                reveal ? (
                  <EyeOffIcon size={26} color={theme.colors.text} />
                ) : (
                  <EyeIcon size={26} color={theme.colors.text} />
                )
              }
              onPress={() => setReveal((r) => !r)}
            />
            {/* 「加入题集」走单词页「收藏」按钮同一套样式（panel 胶囊 + 居中图标），
                只把内部的星星换成标记（书签）图标；已加入时同「收藏」激活态：黄底 + 实心图标 */}
            <PrimaryButton
              tone="ghost"
              panel
              style={[FOOTER_BTN, savedMarked ? { backgroundColor: theme.colors.accentYellow } : null]}
              accessibilityLabel={savedMarked ? '移出题集' : '加入题集'}
              icon={
                <BookmarkIcon
                  size={26}
                  filled={savedMarked}
                  color={savedMarked ? theme.colors.brandOn : theme.colors.text}
                />
              }
              onPress={() => {
                if (savedMarked) {
                  actions.removeSavedItem(item.id);
                  setSavedMarked(false);
                  return;
                }
                actions.addSavedItem(item.id, mode === 'mixed' ? 'quiz' : 'practice');
                setSavedMarked(true);
              }}
            />
            <PrimaryButton
              style={FOOTER_BTN}
              accessibilityLabel={itemIndex + 1 < items.length ? '下一题' : '完成'}
              icon={<ChevronIcon size={26} direction="right" color={theme.colors.brandOn} />}
              onPress={goNext}
            />
          </FooterBar>
        ) : step === 'answer' && item ? (
          def.needsMic ? (
            /* 口语：录音行固定在「确认」上方 —— 左「听自己的录音」（没录过时禁用）+ 右「按住录音」。
               两枚各套一个 `flex: 1` 的外壳容器：宽度由外壳平分，内层按钮一律撑满外壳
               （`width: '100%'`），所以两枚恒等宽、等高（FOOTER_BUTTON_HEIGHT），中间隔 12 */
            <FooterBar>
              <View style={{ flex: 1, gap: 12 }}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Pressable
                      onPress={replayRecording}
                      disabled={lastRecordingSeconds <= 0}
                      accessibilityRole="button"
                      accessibilityLabel={tr('听自己上一次录音')}
                      hitSlop={8}
                      style={{
                        width: '100%',
                        height: FOOTER_BUTTON_HEIGHT,
                        borderRadius: 999,
                        borderWidth: stroke.base,
                        borderColor: theme.colors.border,
                        /* 底栏按钮底色 = 页面底色（`bg`），与其它底栏按钮同一口径 */
                        backgroundColor: theme.colors.bg,
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: lastRecordingSeconds > 0 ? 1 : opacity.disabled,
                      }}
                    >
                      <PlayIcon size={20} color={theme.colors.text} />
                    </Pressable>
                  </View>
                  <View style={{ flex: 1 }}>
                    <HoldToSpeakButton
                      active={recording}
                      seconds={recordedSeconds}
                      onPressIn={startRecording}
                      onPressOut={stopRecording}
                    />
                  </View>
                </View>
                {confirmSubmitButton}
              </View>
            </FooterBar>
          ) : (
            <FooterBar>{confirmSubmitButton}</FooterBar>
          )
        ) : undefined
      }
    >
      {/* 三段进度条：左半区「题库 · 文体」，右半区「题目」 */}
      <StageProgressBar left={leftStages} right={questionStage} />
      {/* 板块推进：新板块从右侧滑入；换题、评分返回同样重播一次 */}
      <SlideIn key={`${stage}-${itemIndex}-${step}`} gap={BLOCK_GAP}>
        {stage === 'bank'
          ? bankPanel
          : stage === 'genre'
            ? genrePanel
            : stage === 'result'
              ? resultPanel
              : questionPanel}
      </SlideIn>
    </Screen>
  );
}

/** 本页页头：返回箭头 + 当前练习大项的名称（题型名，如「听力理解」） */
function Header({ title, onBack }: { title: string; onBack: () => void }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={tr('返回')} hitSlop={8}>
        <View style={{ transform: [{ rotate: '180deg' }] }}>
          <HintIcon size={16} color={theme.colors.text} />
        </View>
      </Pressable>
      <AppText kind="lg" color={theme.colors.text} numberOfLines={1} style={{ flexShrink: 1 }}>
        {title}
      </AppText>
    </View>
  );
}
