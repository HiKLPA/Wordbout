import { useRouter } from 'expo-router';
import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  runOnUI,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CapabilityTrend,
  DEFAULT_TREND_RANGE,
  TrendRangeChips,
  type RangeKey,
} from '@/components/CapabilityTrend';
import { DialogPanel } from '@/components/DialogPanel';
import { SetCard } from '@/components/SetCard';
import { FocusTimer, PANEL_CARD_HEIGHT } from '@/components/FocusTimer';
import { TopFadeMask } from '@/components/TopFade';
import {
  BOARD_ICONS,
  BookmarkIcon,
  CheckIcon,
  CloseIcon,
  HintIcon,
  PaperIcon,
  PenIcon,
  ShuffleIcon,
  StackIcon,
  TableIcon,
} from '@/components/icons';
import {
  AppText,
  Card,
  ExercisePill,
  EmptyState,
  OptionChips,
  ProgressRing,
  Screen,
  SCREEN_HEADER_FADE,
  SCREEN_HEADER_GAP,
  SCREEN_TOP_GAP,
  SCREEN_TEXT_LEADING,
  SectionTitle,
  SegmentedTabs,
} from '@/components/ui';
import { exerciseItems } from '@/data/questions';
import { appConfig, boards, exerciseTypes, exerciseTypeMap, levels } from '@/config/appConfig';
import { addDays, todayKey } from '@/domain/date';
import { trackTap } from '@/lib/analytics';
import { aggregate } from '@/domain/stats';
import { tr, trf } from '@/i18n';
import { useApp } from '@/store/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, stroke } from '@/theme/tokens';

type TabKey = 'practice' | 'quiz' | 'sets' | 'trend';

/**
 * 顶部四档：**只显示图标、不显示文字**（文字仅作无障碍名，`SegmentedTabs` 的 `icon` 一栏）。
 * 意向：练习 = 笔（做题）、测验 = 题卷、题集 = 书签（收藏的题目）、能力趋势 = 表格（统计）。
 * 四枚胶囊等分整行宽度，下方正文随选中档切换 —— 能力趋势不再弹新页面 / 跳二级页。
 */
const TABS: {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
}[] = [
  { key: 'practice', label: '练习', icon: PenIcon },
  { key: 'quiz', label: '测验', icon: PaperIcon },
  { key: 'sets', label: '题集', icon: BookmarkIcon },
  { key: 'trend', label: '能力趋势', icon: TableIcon },
];

/** 四档在数组里的顺序 = 左右滑动的顺序：左滑 → 下一档、右滑 → 上一档 */
const TAB_KEYS: TabKey[] = TABS.map((t) => t.key);

/**
 * 四档之间的滑动切换走**原生分页滚动**（`Animated.ScrollView` + `pagingEnabled`），
 * 所以这里不再有激活阈值 / 落位时长 / 橡皮筋这些自绘手势参数：
 * 跟手、反悔、甩动落位的手感由系统滚动视图决定（iOS 上就是系统分页的那套手感）。
 * 要调手感就调 `screen` 里那个分页 ScrollView 的属性（如 `bounces` / `decelerationRate`）。
 */

/** 顶部固定区内部的纵向间距：连续天数行 ↔ 四档按钮 ↔（趋势页签下的）范围四档，统一 16 */
const HEADER_ROW_GAP = 16;

/** 顶部四档切换（练习 / 测验 / 题集 / 能力趋势）的间距：四档平分正文宽度，彼此隔 16 */
const TAB_GAP = 16;

/** 板块图标尺寸：32×32（与区块标题上方那条 32×4 短线同宽）；色取 `colors.brand` */
const BOARD_ICON_SIZE = 32;

/**
 * 顶部固定区（连续天数行 + 三档页签）距**顶部安全区下沿**的距离。
 * 本页首块是 32px 大标题，属「文字型首块」，行盒里自带 SCREEN_TEXT_LEADING(8) 的上方 leading；
 * 用 SCREEN_TOP_GAP(24) 会让标题字面比卡片 / 胶囊 / banner 这类「清晰上边缘」的首块低约 8px，
 * 所以按统一规则减掉这段 leading（二级页页头 `SCREEN_HEADER_TOP_GAP` 用的是同一条规则）。
 * 设计稿也一致：练习页首块 56、课本 / 更多页 64（练习页本来就高 8）。
 */
const PRACTICE_HEADER_TOP_GAP = SCREEN_TOP_GAP - SCREEN_TEXT_LEADING;

/** 打卡区两张卡之间的横向间距（与课本页卡片行的 16 一致） */
const PANEL_GAP = 16;

/** 卡片行里可左右滑动的面板数：① 打卡区（三枚进度环） ② 专注计时器 */
const PANEL_COUNT = 2;
/**
 * 卡片行下方的滑动指示：圆点直径 4、相邻间距 6、整行高 8（尺寸由用户指定）。
 * 圆点只是「还有一屏」的视觉提示，纯装饰，不进无障碍树。
 */
const DOT_SIZE = 4;
const DOT_GAP = 6;
const DOT_ROW_HEIGHT = 8;

/** 测验卡片右下角「开始」按钮的直径（正圆，圆角取半） */
const START_BUTTON_SIZE = 32;

/**
 * 测验（积累 / 综合）卡片右端纵向居中的「开始」入口：只有一枚向右的品牌红箭头
 * （页头返回箭头那一枚字形，不翻转即为向右），无底色、无描边。
 * 触控区仍是 32x32（正圆外形已去掉，尺寸只用来撑点击热区）。
 * 文字只在无障碍名里出现（`label` 即中文键）。
 */
function StartArrowButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={tr(label)}
      hitSlop={8}
      style={{
        width: START_BUTTON_SIZE,
        height: START_BUTTON_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <HintIcon size={18} color={theme.colors.brand} />
    </Pressable>
  );
}

/** 连续天数行右侧「每周摘要」入口：胶囊高 28、圆角取半 */
const SUMMARY_ENTRY_HEIGHT = 28;

/**
 * 连续天数右侧的入口钮：「每周摘要」，点进去是练习日历（周 / 月 / 年 + 补签）。
 * 只有一行字 + 一枚箭头（箭头用页头返回箭头那一枚字形，不翻转即为向右），
 * 底色不铺、只留 0.5px 描边 —— 它是页头里的次级入口，不该抢连续天数本身的注意力。
 */
function SummaryEntry({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={tr('每周摘要')}
      accessibilityHint={tr('查看练习日历，可补签漏掉的日期')}
      hitSlop={8}
      style={{
        height: SUMMARY_ENTRY_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingLeft: 12,
        paddingRight: 8,
        borderRadius: 999,
        borderWidth: stroke.base,
        borderColor: theme.colors.border,
      }}
    >
      <AppText kind="tiny" color={theme.colors.textSecondary}>
        {tr('每周摘要')}
      </AppText>
      <HintIcon size={14} color={theme.colors.brand} />
    </Pressable>
  );
}

/** 目标弹窗面板正下方「取消 / 确认」圆钮的直径 */
const DIALOG_BTN_SIZE = 48;

/**
 * 弹窗面板**下方**的圆形图标钮（48×48 正圆、内部只有图标，文字只留在无障碍名里）。
 * `tone='ghost'` = 凹槽底 + 灰描边（取消）；`tone='brand'` = 品牌红实底（确认）。
 */
function DialogCircleButton({
  icon,
  label,
  tone = 'ghost',
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  tone?: 'ghost' | 'brand';
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={tr(label)}
      hitSlop={8}
      style={{
        width: DIALOG_BTN_SIZE,
        height: DIALOG_BTN_SIZE,
        borderRadius: DIALOG_BTN_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: stroke.base,
        backgroundColor: tone === 'brand' ? theme.colors.brand : theme.colors.surface,
        borderColor: tone === 'brand' ? theme.colors.brand : theme.colors.border,
      }}
    >
      {icon}
    </Pressable>
  );
}

/** 打卡卡内三枚进度环的直径 */
const RING_SIZE = 80;
/** 进度环线宽 */
const RING_STROKE = 8;

/**
 * 题型 pill 的文字：英文下题型名自带板块前缀（Writing · sentences、Listening comprehension），
 * 而 pill 上一行就是板块标题，重复的那一段在这里去掉，只留题型本身。
 * 只认「板块名 + 分隔符」这一种形态 —— 中文的「听写 / 阅读理解」是完整词，不会被切断。
 * 题型是普通名词，首字母统一小写（dictation / sentences / comprehension），不做标题式大写。
 */
function typePillText(boardLabelZh: string, typeLabelZh: string): string {
  const board = tr(boardLabelZh);
  const full = tr(typeLabelZh);
  for (const sep of [' · ', ' ']) {
    const head = board + sep;
    if (full.startsWith(head) && full.length > head.length) return lowerFirst(full.slice(head.length));
  }
  return lowerFirst(full);
}

/** 首字母小写（中文/繁体首字符不受影响） */
function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/**
 * 练习 / Exercise —— 对应 Figma「iPhone 16 & 17 Pro - 2」：
 * 固定区 Frame 18（连续天数 + 右上「能力趋势」正圆按钮）→ Frame 15（练习 / 测验 / 错题，
 * 三枚等宽胶囊按钮，彼此隔 16）；
 * 滚动区第一项 Frame 16（打卡区：两个 72px 进度环 ↔ 专注计时器；仅「练习」页签下渲染，随页面上下滑动）
 * → Frame 14（五个板块，每块 Title + 题型 pill）。
 * 「测验」「错题」页签下不展示卡片，测验的过程与结果也都不计入卡片（见 Attempt.excluded）。
 * 三个页签：练习 = 题型列表；测验 = 综合；错题 = 题集（错词队列 + 手动加入的题 → 错题重做）。
 * 题库选择（FR-E-4）不在这一屏常驻：点任一题型 / 综合直接进入该题型的二级页面，
 * 在页面里先选题库，选定后自动加载该题库的习题（第一步见 practice/[typeId]）。
 */
export default function ExerciseScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { state, today, streak, actions } = useApp();
  const [tab, setTab] = useState<TabKey>('practice');
  /**
   * 正在修改的目标（点进度环里的数字进入）：'time' = 今日时长门槛、'task' = 今日任务数门槛。
   * 目标值本身仍来自 appConfig.streak 的候选值（NFR-6 配置化），这里只是给一个就地修改的入口。
   */
  const [goalEdit, setGoalEdit] = useState<'time' | 'task' | null>(null);
  /** 目标设置的草稿值：点环打开时读入当前门槛，改选只动草稿，点「确认选择」才写回 settings */
  const [goalDraft, setGoalDraft] = useState<number | null>(null);
  /**
   * 「能力趋势」页签的统计范围（今日 / 近7天 / 近30天 / 近3月）。
   * state 提在练习页这一层：因为它对应的四档按钮要渲染进**固定页头**（不随正文滚动），
   * 页头与正文是两个兄弟节点，只能由页面这一层同时喂给两边（受控 props）。
   */
  const [trendRange, setTrendRange] = useState<RangeKey>(DEFAULT_TREND_RANGE);
  const { width: windowWidth } = useWindowDimensions();
  /** 卡片宽度 = 内容宽（与下方题型按钮等宽）；滑动区本身左右各外扩 pagePadding，占满屏幕宽 */
  const panelWidth = windowWidth - layout.pagePadding * 2;
  /** 卡片行里「当前停在第几屏」——只用于点亮下方对应的圆点（自由滚动，不做吸附） */
  const [panelIndex, setPanelIndex] = useState(0);
  /**
   * 面板每前进一屏，内容位移 = 卡宽 + 卡间距。
   * 滑动区左右各外扩 pagePadding 后占满屏宽，两侧 padding 又都是 pagePadding，
   * 所以偏移 0 与 `panelStride` 正好各自把一张卡对齐到正文左缘。
   */
  const panelStride = panelWidth + PANEL_GAP;
  /** 卡片行滚动 → 更新圆点；页码没变时返回原值，避免每帧都触发重渲染 */
  const onPanelsScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.min(
      PANEL_COUNT - 1,
      Math.max(0, Math.round(e.nativeEvent.contentOffset.x / Math.max(1, panelStride))),
    );
    setPanelIndex((prev) => (prev === next ? prev : next));
  };
  /**
   * 面板描边：卡片行里左右滑动的两张面板（① 打卡区 ② 专注计时器）**统一描品牌红**
   * （`colors.brand`），与其它卡片的发丝线（`colors.border`）区分开，提示这是一屏独立的面板。
   */

  /** 「练习」列出全部题型；「测验」= 综合；「错题」= 题集（见下方三分支） */
  const grouped = useMemo(
    () =>
      boards
        .map((b) => ({ board: b, items: exerciseTypes.filter((t) => t.board === b.id) }))
        .filter((g) => g.items.length > 0),
    [],
  );

  /** 题集：各板块（练习场次收藏的题）各有几道 */
  const savedByBoard = useMemo(() => {
    const map: Record<string, number> = {};
    for (const saved of state.savedItems) {
      if (saved.source !== 'practice') continue;
      const item = exerciseItems.find((i) => i.id === saved.itemId);
      const b = item ? exerciseTypeMap[item.typeId]?.board : undefined;
      if (b) map[b] = (map[b] ?? 0) + 1;
    }
    return map;
  }, [state.savedItems]);
  /** 测验题集：积累 / 综合 各收了几道 */
  const savedQuizCount = state.savedItems.filter((x) => x.source === 'quiz').length;
  const savedAccumulationCount = state.savedItems.filter((x) => x.source === 'accumulation').length;

  /**
   * 断点续做卡（FR-M 主页原入口，现挪到练习页、紧挨着首个板块「听」的上方）：
   * = 练习二级页回写的断点（`state.lastPractice`），上次停在哪道题就从哪道题接着做。
   * 一直没练过、或已经把练习退回题库 / 文体板块（断点被清）时，这一整块不显示。
   */
  const lastPractice = state.lastPractice;
  const lastDef = lastPractice ? exerciseTypeMap[lastPractice.typeId] : undefined;
  const lastLevel = lastPractice ? levels.find((l) => l.id === lastPractice.levelId) : undefined;

  /**
   * 接着做：把断点原样交给练习页（`resume=1` 表示「恢复上次现场」），
   * 测验 / 题集那一支还要带上 `mode` / `set`，否则恢复出来的会话会丢掉「不计入打卡」等口径。
   */
  const resumePractice = () => {
    if (!lastPractice) return;
    const query = [
      'resume=1',
      lastPractice.mode ? `mode=${lastPractice.mode}` : '',
      lastPractice.set ? `set=${lastPractice.set}` : '',
    ]
      .filter(Boolean)
      .join('&');
    router.push(`/practice/${lastPractice.typeId}?${query}` as never);
  };

  const timeDone = today.durationSec >= state.settings.dailyTimeThreshold * 60;
  const taskDone = today.taskCount >= state.settings.dailyTaskThreshold;

  /**
   * 平均得分率：近 `appConfig.queryTable.levelWindowDays`（30）天全部已评分作答的平均得分率，
   * 与查询表「平均得分率 / 当前水平」完全同口径（`aggregate` 内部已剔除测验 excluded 的作答）。
   * 无任何已评分作答时为 null —— 按 FR-E-16 的空数据口径显示占位符，不展示 0 分。
   */
  const overallScoreRate = useMemo(() => {
    const to = todayKey();
    const from = addDays(to, -(appConfig.queryTable.levelWindowDays - 1));
    return aggregate(
      state.attempts,
      state.daily,
      { from, to },
      exerciseTypes.map((t) => t.id),
      (t) => exerciseTypeMap[t].board,
    ).avgScoreRate;
  }, [state.attempts, state.daily]);

  // 进度环：弧长比例（今日时长 / 今日任务 / 平均得分率 0~100）
  const timeRatio = Math.min(1, today.durationSec / Math.max(1, state.settings.dailyTimeThreshold * 60));
  const taskRatio = Math.min(1, today.taskCount / Math.max(1, state.settings.dailyTaskThreshold));
  const scoreRatio = overallScoreRate === null ? 0 : Math.min(1, overallScoreRate / 100);
  /**
   * 环心数值：时长 / 任务用「当前 / 目标」的分数式（单位「分 / 个」写在下方标签里）；
   * 得分率没有分母，直接把 `%` 跟在数字后面（标签只写「得分率」）。
   * 时长**只在分钟这一档**：门槛配置本身就是分钟（NFR-6），分子取已练分钟数的整数部分
   * （不足 1 分钟记 0，弧长仍按秒算，所以环会有细细一段）。
   */
  const durValue = `${Math.floor(today.durationSec / 60)}/${state.settings.dailyTimeThreshold}`;
  const taskValue = `${today.taskCount}/${state.settings.dailyTaskThreshold}`;
  /** 无已评分作答时按 FR-E-16 显示占位符，此时没有数字，也就不带 `%` */
  const scoreValue = overallScoreRate === null ? '—' : `${Math.round(overallScoreRate)}%`;

  /**
   * 点进度环 → 打开目标设置弹窗：先把当前门槛读进草稿（改选只动草稿），
   * 弹窗里选档后需点「确认选择」才写回 settings —— 与「取消」形成可撤销的一步。
   */
  const openGoal = (kind: 'time' | 'task') => {
    setGoalDraft(kind === 'time' ? state.settings.dailyTimeThreshold : state.settings.dailyTaskThreshold);
    setGoalEdit(kind);
  };
  /** 确认选择：把草稿写回对应门槛并关闭弹窗 */
  const confirmGoal = () => {
    if (goalEdit === null || goalDraft === null) return;
    actions.updateSettings(
      goalEdit === 'time' ? { dailyTimeThreshold: goalDraft } : { dailyTaskThreshold: goalDraft },
    );
    setGoalEdit(null);
  };

  /**
   * 左右滑动正文 = 切换四档（练习 / 测验 / 题集 / 能力趋势）。这一块走**原生分页滚动**：
   * 分页器就是一个横向 `Animated.ScrollView`（`pagingEnabled`），四档正文并排铺在里面、各占一屏宽。
   *
   * 为什么不用自绘手势（曾经的 `Gesture.Pan` + 共享值位移）：
   * - 跟手 / 反悔 / 甩动落位全部交给系统滚动视图，位置只有原生那一份 ——
   *   不会出现「JS 位移与档位号不同帧落地」的中间态，快速连滑也只是连续滚动，不会再在两页之间来回跳；
   * - 页面上不再压着一层覆盖全屏的手势，正文里每个页面自己的纵向 `ScrollView`、
   *   以及那些可左右滑动的行都是纯原生滚动：**横滑由行自己消费、纵滑由页自己消费**，
   *   不需要再声明「让位 / 阻塞」关系（`components/pageSwipe.tsx` 已随之删除）。
   *
   * 页头四档图标的位置 `tabPos = 滚动偏移 ÷ 一屏宽`（单位 = 档位、拖动中为小数），
   * 由 `onScroll` 的 worklet 逐帧写入共享值，所以拖动时图标跟手、点页头切档时图标跟着正文一起滑。
   */
  /** 一页 = 整屏宽（正文整块占满屏宽，左右内边距落在每一页自己身上，见 `renderBody`） */
  const pageWidth = windowWidth;
  /**
   * 每一页**自己的**纵向滚动区：分页器本身要整条横滑，所以外层不再有滚动区
   * （`Screen` 走 `scroll={false}`），纵向滚动下沉到每一页内部 —— 各档各留各的滚动位置，
   * 且每页顶部都能钉一行不随纵滚的内容（能力趋势的统计范围四档就用这个位置）。
   * 底部留白需自己补，数值与 `Screen` 给的 `bottomPad` 一致（底栏 + 24 + 安全区）。
   */
  const insets = useSafeAreaInsets();
  const pageBottomPad = layout.barBottom + layout.barHeight + 24 + insets.bottom;
  /** 分页器本体：点页头切档要让它滚到目标档（worklet 里的 `scrollTo` 需要一个 animated ref） */
  const pagerRef = useAnimatedRef<Animated.ScrollView>();
  /** 分页器的横向滚动偏移（像素）：只用来驱动页头四档图标 */
  const scrollX = useSharedValue(0);
  const onPagerScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });
  /** 页头四档图标的位置（单位 = 档位）= 滚动偏移 ÷ 一屏宽 */
  const tabPos = useDerivedValue(() => scrollX.value / pageWidth, [pageWidth]);
  /**
   * 分页视口高度（实测）。横向 `ScrollView` 的子树高度**不会**由内容撑出确定值，
   * 而每一页里的纵向滚动区必须有确定高度才会滚 —— 所以量一次视口高再显式发给每页。
   */
  const [pagerHeight, setPagerHeight] = useState(0);
  /** 当前档在 `TAB_KEYS` 里的序号：只用于无障碍树（几何全在原生滚动视图里，不由它推） */
  const tabIndex = TAB_KEYS.indexOf(tab);
  /**
   * 当前档序号的**同步镜像**，给「点页头切档」和「屏宽变化后重新对齐」用。
   * `tab` 是渲染态（落位后才更新），这两处要的是「此刻停在哪一档」，用普通 ref 免去一拍延迟。
   */
  const tabIndexRef = useRef(tabIndex);
  /**
   * 落位后把档位同步回 state：只影响无障碍树与页头选中态（`tabPos` 由滚动偏移自推，不依赖它）。
   * `onScrollEndDrag` / `onMomentumScrollEnd` 都接：前者覆盖「松手即停」的慢拖，后者覆盖带甩动的落位；
   * 算出来还是当前档时 `setTab` 不会触发重渲染。
   */
  const syncTabFromOffset = useCallback(
    (offsetX: number) => {
      const j = Math.max(0, Math.min(TAB_KEYS.length - 1, Math.round(offsetX / pageWidth)));
      tabIndexRef.current = j;
      setTab(TAB_KEYS[j]);
    },
    [pageWidth],
  );
  /**
   * 点页头四档切档：正文滚到目标档（一段横向滚动，图标跟着一起滑）。
   * 用 `runOnUI` + `scrollTo`（与 `useAnimatedRef` 配套）而不是 JS 侧滚动，避免 JS 线程忙时被压后。
   */
  const selectTab = useCallback(
    (key: TabKey) => {
      const j = TAB_KEYS.indexOf(key);
      tabIndexRef.current = j;
      setTab(key);
      runOnUI((x: number) => {
        'worklet';
        scrollTo(pagerRef, x, 0, true);
      })(j * pageWidth);
    },
    // `pagerRef` 是 reanimated 的 animated ref（稳定对象），列进来只为让 lint 满意
    [pageWidth, pagerRef],
  );
  /**
   * 屏宽变化（旋转 / 分屏）后把偏移重新对齐到当前档 —— 页宽变了、偏移还是旧像素的话，
   * 画面会停在两页之间。首帧也走一次（偏移本来就是 0，等价于不动）。
   */
  useLayoutEffect(() => {
    const x = tabIndexRef.current * pageWidth;
    runOnUI((next: number) => {
      'worklet';
      scrollTo(pagerRef, next, 0, false);
    })(x);
  }, [pageWidth, pagerRef]);

  /**
   * 顶部固定区块：标题行 →「练习 / 测验 / 题集 / 能力趋势」四枚胶囊按钮（等分整行宽度、彼此隔 16）。
   * 它通过 Screen 的 header 槽渲染在滚动区之外，所以上下滑动页面时整块停住；
   * 卡片行（打卡区 + 专注计时器）不在这一块里 —— 它随内容一起上下滑动（见下方 children）。
   * 块内纵向间距统一 16（`gap`：连续天数行 ↔ 四档按钮）；
   * 页头也不传 `headerMaskGap`（= 0）：遮罩实底到四档图标下沿为止，接着往下 `SCREEN_HEADER_FADE`(16)
   * 是淡出段；分页器整体上移 16（见分页器），让**每页页顶 = 四档下沿** —— 页内滚动区的裁切边
   * 于是正好落在淡出段起点上，内容滚上去在淡出段里化开（不是硬切）；
   * 静止时首项仍在四档下沿之下 16px（淡出段之外），不会被糊。
   * **能力趋势的统计范围四档不在这里** —— 它钉在「能力趋势」那一页的页内顶部，
   * 这样上下滑动时它停住不动、左右滑动时又跟着整页一起滑走（见 `renderBody`）。
   * 好处之一是页头高度不再随页签变化，横向拖动时正文起点不会被页头撑动。
   * 题库选择（FR-E-4）已从这一行移走：点具体练习项目时先弹 BankPicker 选题库，再开始作答。
   */
  const topBlock = (
    <View style={{ gap: HEADER_ROW_GAP, paddingHorizontal: layout.pagePadding }}>
      {/* Frame 18：连续天数 + 右侧「每周摘要」入口（进练习日历，可在日历里补签） */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <AppText kind="xl" color={theme.colors.text}>
            {tr('已连续')}
          </AppText>
          {/* 「天」并入数字：数值 + 单位是同一个整体（品牌红），
              整串走 `{n} 天` 词条 → 英文取 `{n} days`，避免单位单独翻译成空串导致英文缺一截 */}
          <AppText kind="xl" color={theme.colors.brand}>
            {trf('{n} 天', { n: streak })}
          </AppText>
        </View>
        <SummaryEntry
          onPress={() => {
            trackTap('每周摘要', { kind: 'entry' });
            router.push('/practice-calendar' as never);
          }}
        />
      </View>

      {/* Frame 15：练习 / 测验 / 题集 / 能力趋势 四枚等分整行宽度的按钮（各一枚图标、无文字），
          形态完全一致 —— 能力趋势不再另做圆钮，也不再弹新页面。
          两种状态**都不带底色与描边**（`bare`），只剩图标本身：未选中 = 正文色，
          选中 = 品牌红 + 轻微放大。选中进度由 `pos`（= 档位位置 `tabPos`）驱动：
          左右拖动正文时它跟着手指逐帧走，四枚图标于是**连续**变色 / 放大，
          而不是等松手后才跳过去；点页头切档时也走同一段过场。
          正文第一项是卡片行（仅「练习」页签），它落在滚动区里，会随页面一起上下滑动。 */}
      <SegmentedTabs items={TABS} value={tab} onChange={selectTab} gap={TAB_GAP} bare pos={tabPos} />
    </View>
  );

  /** 点题型 / 综合：直接进入该题型的二级页面，题库选择在页面里做（先选题库 → 自动加载习题） */
  const openExercise = (target: string) =>
    router.push((target === 'mixed' ? '/practice/comprehension?mode=mixed' : `/practice/${target}`) as never);

  /**
   * 某一档的正文（不含页头）。宽 = **整屏宽**（`Screen` 走 `padded={false}` + `scroll={false}`）：
   * 正文要能在分页器里左右滑动，必须整块占满屏宽；左右内边距与**纵向滚动**都搬到每一页自己身上
   * —— 内边距落在滚动区的内容容器上（这样满宽外扩的横向滑动行不会被滚动区裁掉，见下面那些
   * `marginHorizontal: -layout.pagePadding`），纵向滚动则是每页一个 `ScrollView`。
   * 每页顶部还留了一行「不随纵滚」的位置：能力趋势用它钉统计范围四档
   * —— 上下滑动时四档停住，左右滑动整页时它跟着一起滑走（其余三档没有这一行）。
   * 参数是 `key` 而不是直接用 `tab`：分页器里**四档正文都常驻挂载**（见 `screen` 里那个分页器）。
   */
  const renderBody = (key: TabKey) => (
    <View style={{ width: pageWidth, flex: 1 }}>
      {/* 能力趋势页签的统计范围四档（今日 / 近7天 / 近30天 / 近3月）钉在**本页顶部**：
          上下滑动本页内容时它停住不动，但它本身在分页器内部 —— 左右滑动整页时跟着一起滑走。
          `paddingTop`（不是 paddingBottom）= 四档下沿与页头四档图标之间的 16px 空隙，
          这段空隙正好让页头那把淡出段（`SCREEN_HEADER_FADE` = 16）落在里面，不会糊到胶囊上；
          四档下沿之下即是本页滚动区上沿（见下方滚动区，不再另加 paddingBottom）。 */}
      {key === 'trend' ? (
        <View style={{ paddingHorizontal: layout.pagePadding, paddingTop: SCREEN_HEADER_GAP }}>
          <TrendRangeChips value={trendRange} onChange={setTrendRange} />
        </View>
      ) : null}
      {/* 滚动区外面这层只做两件事：给滚动区一个不随页面横移的定位参照，
          并让渐变遮罩有一个能盖住滚动内容的绘制顺序（见下面遮罩的注释）。 */}
      <View style={{ flex: 1 }}>
        <ScrollView
          /*
           * 滚动区上沿**不再自己上探**：整页已由分页器整体上移 `SCREEN_HEADER_GAP`，
           * 页顶就是四档图标的下沿（能力趋势页的四档胶囊之下同理），滚动区上沿于是正好压在
           * 页头那把淡出段的起点上 —— 可见内容整体处在淡出段的渐变里，滚上去是被化开的，
           * 不会在淡出段**之外**（也就是渐变够不着的地方）被硬切一刀。
           * 内容容器再补 `paddingTop: SCREEN_HEADER_GAP`，静止时首项仍从页顶往下 16px 起
           * （正好在淡出段尽头、不被糊）。`flex: 1` 必须给：高度要由父级定，否则会长成内容高度而不滚动。
           */
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: SCREEN_HEADER_GAP,
            paddingHorizontal: layout.pagePadding,
            gap: 16,
            paddingBottom: pageBottomPad,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Frame 16：打卡区 ↔ 专注计时器（结构同课本页卡片行：滑动区占满屏宽、卡宽同下方按钮、自由滚动）。
              它排在滚动区第一项，与题型列表 / 测验卡片一起上下滑动（不再固定在页头）；
              整块只在「练习」页签下渲染：测验 / 错题时不展示卡片，测验的作答也不写入卡片数据。 */}
          {key === 'practice' ? (
            /* 卡片行（滑动区占满屏宽、卡宽同下方按钮、自由滚动）+ 其下方的滑动指示圆点。
               圆点跟着左右滑动换位，纯装饰。
               它是分页器里的嵌套横向滚动视图：横滑由它自己消费，不会把整页切走。 */
            <View style={{ gap: 8 }}>
              <ScrollView
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -layout.pagePadding }}
                contentContainerStyle={{ gap: PANEL_GAP, paddingHorizontal: layout.pagePadding, alignItems: 'stretch' }}
                scrollEventThrottle={16}
                onScroll={onPanelsScroll}
              >
                <View style={{ width: panelWidth, gap: PANEL_GAP }}>
                  {/* 打卡区卡：内边距 16，三枚 80px 进度环分列、外缘各抵住内边距（垂直居中）；
                      高度走 PANEL_CARD_HEIGHT，与计时卡等高；描边沿用 Card 默认（colors.border） */}
                  <Card style={{ padding: 16, height: PANEL_CARD_HEIGHT, justifyContent: 'center' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <ProgressRing
                        size={RING_SIZE}
                        strokeWidth={RING_STROKE}
                        value={durValue}
                        label="时长/分"
                        ratio={timeRatio}
                        done={timeDone}
                        onPress={() => openGoal('time')}
                        accessibilityLabel={trf('今日时长 {v} 分，门槛 {t} 分，点按可修改目标', {
                          v: Math.floor(today.durationSec / 60),
                          t: state.settings.dailyTimeThreshold,
                        })}
                      />
                      <ProgressRing
                        size={RING_SIZE}
                        strokeWidth={RING_STROKE}
                        value={taskValue}
                        label="任务/个"
                        ratio={taskRatio}
                        done={taskDone}
                        onPress={() => openGoal('task')}
                        accessibilityLabel={trf('今日任务 {n} 个，门槛 {t} 个，点按可修改目标', {
                          n: today.taskCount,
                          t: state.settings.dailyTaskThreshold,
                        })}
                      />
                      <ProgressRing
                        size={RING_SIZE}
                        strokeWidth={RING_STROKE}
                        value={scoreValue}
                        label="得分率"
                        ratio={scoreRatio}
                        accessibilityLabel={trf('平均得分率 {v}，统计近 {n} 天', {
                          v: overallScoreRate === null ? tr('无') : trf('得分率 {v}%', { v: overallScoreRate.toFixed(1) }),
                          n: appConfig.queryTable.levelWindowDays,
                        })}
                      />
                    </View>
                  </Card>
                </View>
                <View style={{ width: panelWidth }}>
                  <FocusTimer />
                </View>
              </ScrollView>

              {/* 滑动指示：4x4 正圆、间距 6、整行固定 8px 高；当前面板品牌红，其余分割线灰。
                  纯装饰（面板内容各自的 a11y 名已说明含义），不进无障碍树 */}
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{
                  height: DOT_ROW_HEIGHT,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: DOT_GAP,
                }}
              >
                {Array.from({ length: PANEL_COUNT }, (_, i) => (
                  <View
                    key={i}
                    style={{
                      width: DOT_SIZE,
                      height: DOT_SIZE,
                      borderRadius: DOT_SIZE / 2,
                      backgroundColor: i === panelIndex ? theme.colors.brand : theme.colors.divider,
                    }}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {/* 「测验」页签：两个测验 —— 积累（先选数量 20/40/60/80，再按中文释义写英文词 / 短语，统一评分）
              与综合（原有逻辑不变：选定题库后随机抽题，覆盖五个板块）。
              两者的作答都只留记录，不计入打卡卡片与学习统计（Attempt.excluded）。 */}
          {key === 'quiz' ? (
            /* 两个测验各自成一个分区（分区标题 + 卡片），与「题集」页签同一套节奏：
               分区之间 32、分区内标题与卡片之间 8。
               分区标题前挂 32×32 品牌红图标（积累 = 叠层 / 综合 = 交叉双箭头，与练习的笔、测验的题卷不重复），
               并 `showBar={false}` 去掉原「32×4 短线」（与练习页板块标题、题集页分区标题同一套写法）。 */
            <View style={{ gap: 32 }}>
              <View style={{ gap: 8 }}>
                <SectionTitle
                  label="积累"
                  icon={<StackIcon size={BOARD_ICON_SIZE} color={theme.colors.brand} />}
                  showBar={false}
                />
                <Card style={{ padding: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <AppText
                      kind="body"
                      color={theme.colors.textSecondary}
                      style={{ flex: 1, textAlign: 'justify' }}
                    >
                      选定积累数量，按中文释义写出对应的英文词或短语。
                    </AppText>
                    <StartArrowButton
                      label="开始积累"
                      onPress={() => router.push('/accumulation' as never)}
                    />
                  </View>
                </Card>
              </View>

              <View style={{ gap: 8 }}>
                <SectionTitle
                  label="综合"
                  icon={<ShuffleIcon size={BOARD_ICON_SIZE} color={theme.colors.brand} />}
                  showBar={false}
                />
                <Card style={{ padding: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <AppText
                      kind="body"
                      color={theme.colors.textSecondary}
                      style={{ flex: 1, textAlign: 'justify' }}
                    >
                      选定题库后随机抽题，覆盖听读写说译五个板块。
                    </AppText>
                    <StartArrowButton label="开始综合" onPress={() => openExercise('mixed')} />
                  </View>
                </Card>
              </View>
            </View>
          ) : key === 'sets' ? (
            /* 「题集」页签：与课本页同一套版式 —— 分区标题 + 一行横向滑动的卡片（说明行已按要求删除）。
               练习区 = 听 / 说 / 读 / 写 / 译 五个板块题集，测验区 = 测验（综合）里收藏的题目。
               板块内 / 测验里的题集卡片点进去是列表页（按收藏日期分区），点列表里某道题就从那道题开始做。
               标题直接用本页 Screen 的 pagePadding，**不要再套一层 paddingHorizontal**（会推成两倍边距，
               与别的分区标题不齐）；卡片行左右外扩 pagePadding，所以滑动区占满屏宽（与打卡区那一行同一做法）。
               分区标题前挂 32×32 品牌红图标（练习 = 笔 / 测验 = 题卷），并 `showBar={false}` 去掉原短线；
               卡片封面也是图标（板块题集 = 该板块图标，测验题集 = 积累的叠层 / 综合的交叉双箭头），
               与分区标题那枚同源；信息条照收藏夹卡片那样两行 —— 上行题集名、下行题数。 */
            <View style={{ gap: 32 }}>
              <View style={{ gap: 8 }}>
                <SectionTitle
                  label="练习"
                  icon={<PenIcon size={BOARD_ICON_SIZE} color={theme.colors.brand} />}
                  showBar={false}
                />
                {/* 卡片行是嵌套横向滚动视图：横滑只滑卡片，整页不会跟着切走（下同） */}
                <ScrollView
                  horizontal
                  nestedScrollEnabled
                  showsHorizontalScrollIndicator={false}
                  style={{ marginHorizontal: -layout.pagePadding }}
                  contentContainerStyle={{ gap: PANEL_GAP, paddingHorizontal: layout.pagePadding }}
                >
                  {boards.map((b) => (
                    <SetCard
                      key={b.id}
                      icon={BOARD_ICONS[b.id]}
                      name={tr(b.labelZh)}
                      count={savedByBoard[b.id] ?? 0}
                      onPress={() => router.push(`/sets/${b.id}` as never)}
                    />
                  ))}
                </ScrollView>
              </View>

              <View style={{ gap: 8 }}>
                <SectionTitle
                  label="测验"
                  icon={<PaperIcon size={BOARD_ICON_SIZE} color={theme.colors.brand} />}
                  showBar={false}
                />
                <ScrollView
                  horizontal
                  nestedScrollEnabled
                  showsHorizontalScrollIndicator={false}
                  style={{ marginHorizontal: -layout.pagePadding }}
                  contentContainerStyle={{ gap: PANEL_GAP, paddingHorizontal: layout.pagePadding }}
                >
                  {/* 两档测验各有一份题集，与「测验」页签里的两个测验一一对应（封面同样是品牌红） */}
                  <SetCard
                    icon={StackIcon}
                    name={tr('积累')}
                    count={savedAccumulationCount}
                    onPress={() => router.push('/sets/accumulation' as never)}
                  />
                  <SetCard
                    icon={ShuffleIcon}
                    name={tr('综合')}
                    count={savedQuizCount}
                    onPress={() => router.push('/sets/quiz' as never)}
                  />
                </ScrollView>
              </View>
            </View>
          ) : key === 'practice' ? (
            <View style={{ gap: 32 }}>
              {/* 接着上次退出的那道题做（断点见 `PracticeResume`，由练习二级页回写）。
                  位置紧挨着首个板块「听」的上方 —— 一进练习页就能续上，不用再回主页。
                  不带标签，靠一道品牌红描边把它从下方板块里拎出来，与板块的灰描边卡区分开。 */}
              {lastPractice && lastDef ? (
                <View>
                  <Card
                    style={{ padding: 16 }}
                    onPress={resumePractice}
                    accessibilityLabel={tr('继续上次练习')}
                    strokeColor={theme.colors.brand}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <View style={{ flexShrink: 1, gap: 4 }}>
                        <AppText kind="md" color={theme.colors.text} numberOfLines={1}>
                          {lastDef.labelZh}
                        </AppText>
                        <AppText kind="tiny" color={theme.colors.textSecondary} numberOfLines={1}>
                          {trf('{level} · 第 {a} / {b} 题', {
                            level: tr(lastLevel?.labelZh ?? lastPractice.levelId),
                            a: Math.min(lastPractice.index + 1, lastPractice.itemIds.length),
                            b: lastPractice.itemIds.length,
                          })}
                        </AppText>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <AppText kind="tiny" weight="bold" color={theme.colors.brand}>
                          继续
                        </AppText>
                        <HintIcon size={18} color={theme.colors.brand} />
                      </View>
                    </View>
                  </Card>
                </View>
              ) : null}
              {grouped.map(({ board, items }) => {
                const BoardIcon = BOARD_ICONS[board.id];
                return (
                  <View key={board.id} style={{ gap: 8 }}>
                    <SectionTitle
                      label={board.labelZh}
                      icon={<BoardIcon size={BOARD_ICON_SIZE} color={theme.colors.brand} />}
                      showBar={false}
                    />
                    {items.map((t) => {
                      const pillText = typePillText(board.labelZh, t.labelZh);
                      return (
                        <ExercisePill
                          key={t.id}
                          label={pillText}
                          selected={false}
                          accessibilityLabel={pillText}
                          onPress={() => openExercise(t.id)}
                        />
                      );
                    })}
                  </View>
                );
              })}
              {grouped.length === 0 ? <EmptyState title="该分类下暂无题型" /> : null}
            </View>
          ) : null}

          {/*
            「能力趋势」页签：与练习 / 测验 / 题集一样在页头下方就地展现（不弹新页面、不跳二级页），
            内容与 `/query-table` 二级页共用 `components/CapabilityTrend`，只是走内嵌形态（`embedded`），
            由本页自己的滚动区承载 —— 全程不离开练习页，底栏与页头位置都不变。
            统计范围四档在本页顶部（`renderBody` 开头那行）钉住：不随纵滚、但随整页横滑；
            选中范围由本页 state 持有（`trendRange`），受控传给内嵌正文。
          */}
          {key === 'trend' ? (
            <CapabilityTrend embedded range={trendRange} onRangeChange={setTrendRange} />
          ) : null}
        </ScrollView>
        {/*
          统计范围四档**下方**的渐变遮罩（原先是固定页头自带的那一层，四档搬进页内后要补回来）：
          四档胶囊下沿就是本页滚动区上沿，所以遮罩就贴在滚动区顶边（`top: 0`，无需再偏移），
          往下 `SCREEN_HEADER_FADE`(16) 淡出 —— 内容滚上去在这 16px 里化开，而不是被硬切。
          必须画在滚动区**之后**（同层里后画的才在内容上面）。纯装饰，不接收触摸。
        */}
        {key === 'trend' ? (
          <TopFadeMask
            height={SCREEN_HEADER_FADE}
            opaqueHeight={0}
            style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
          />
        ) : null}
      </View>
    </View>
  );

  const screen = (
    <Screen
      header={topBlock}
      headerTopGap={PRACTICE_HEADER_TOP_GAP}
      /* 四档图标下方的渐变遮罩：**不传** `headerMaskGap`（= 0），淡出段就从四档下沿起、往下 16px，
         与页内滚动区的裁切边重合 —— 滚上去的内容化开而不是被硬切，也不会压到静止的正文上。
         （其它整块固定页头：首页 / 课本 / 探索 / 更多，仍传 SCREEN_HEADER_GAP。） */
      /* 正文整块占满屏宽（左右内边距落在每一页自己身上，见 `renderBody`）：分页器要能让整页横向滑动 */
      padded={false}
      /* 纵向滚动下沉到每一页内部（见 `renderBody`）：分页器本身要能整条横滑，不能再套一层滚动区 */
      scroll={false}
    >
      {/*
        分页器：横向 `Animated.ScrollView` + `pagingEnabled`，**四档正文并排全量常驻**在它里面。
        - 位置（跟手、反悔、甩动落位、连滑）全由这个原生滚动视图持有，只有一份事实，
          不会出现「JS 位移与档位号不同帧落地」的闪烁，快速连滑也不会在两页之间来回跳；
        - 四档全挂：正文就是它的子视图，滑进来时内容是现成的，不会现场加载闪一下；
        - 每页高度用实测的 `pagerHeight` **显式给出**（横向滚动视图的子树不会由内容撑出确定高度），
          页内的纵向 `ScrollView` 因此有界、能滚；各页各留各的滚动位置；
        - 正文里那些横向滑动的行现在是它的嵌套滚动子视图：横滑由行自己消费、纵滑由页自己消费，
          不再需要「让位 / 阻塞」的声明（`components/pageSwipe.tsx` 已删）。
        页头与底栏都在它之外，横滑时不动。
      */}
      <Animated.ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        /* Android 的嵌套滚动：让行内那些横向滚动**先消费**，滑到头才轮到本页翻页
           （不加这个，Android 的横向 ScrollView 会在手指一动时就抢走触摸，行自己就滑不动了）。
           iOS 本来就是「最内层先滚」的原生行为，这个 prop 在 iOS 上是空操作。 */
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onPagerScroll}
        scrollEventThrottle={16}
        /* 松手（慢拖停下 / 甩动落位）后把档位同步回 state：无障碍树与页头选中态用 */
        onScrollEndDrag={(e) => syncTabFromOffset(e.nativeEvent.contentOffset.x)}
        onMomentumScrollEnd={(e) => syncTabFromOffset(e.nativeEvent.contentOffset.x)}
        /* 量一次视口高：每页都要一个确定高度，页内的纵向滚动区才会滚 */
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          setPagerHeight((prev) => (Math.abs(prev - h) > 0.5 ? h : prev));
        }}
        /* 分页器整体上移 `SCREEN_HEADER_GAP`：让**每一页的页顶**落在四档图标下沿
           （`Screen` 的 `bodyTopPad` 已给到「四档下沿 + 16」，这里抵回 16）。
           于是页内滚动区的裁切边正好在四档下沿 —— 那里正是页头遮罩淡出段的起点，
           滚上去的内容会在淡出段里化开，不会在淡出段之外被硬切；而静止时首项仍在四档下沿之下 16px。
           这段上移落在 `Screen` 的 padding 区里（父级盒子之内），不依赖子级越界绘制。
           分页器没有底色；页内滚动区自带 `pageBottomPad`。`DialogPanel` 走 `Modal`，不受影响。 */
        style={{ flex: 1, marginTop: -SCREEN_HEADER_GAP }}
      >
        {TABS.map((t, i) => (
          <View
            key={t.key}
            accessibilityElementsHidden={i !== tabIndex}
            importantForAccessibility={i === tabIndex ? 'auto' : 'no-hide-descendants'}
            style={{ width: pageWidth, height: pagerHeight }}
          >
            {renderBody(t.key)}
          </View>
        ))}
      </Animated.ScrollView>

      {/*
        点进度环里的数字 → 就地改目标（不必再进设置页）。
        候选值仍取自 appConfig.streak（时长：分钟数；任务：个数）。
        改选只动草稿（goalDraft），点「确认选择」才写回 settings —— 「取消」可原样退出。
      */}
      {goalEdit ? (
        <DialogPanel
          onClose={() => setGoalEdit(null)}
          /* 取消（叉）/ 确认选择（勾）：移到面板正下方 16px 处，两枚 48×48 正圆、居中、内部只有图标。
             两枚都走 `close`：先播收回动画，播完再退出 / 落库 */
          footer={(close) => (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <DialogCircleButton
                label="取消"
                icon={<CloseIcon size={22} color={theme.colors.text} />}
                onPress={() => close()}
              />
              <DialogCircleButton
                label="确认选择"
                tone="brand"
                icon={<CheckIcon size={22} color={theme.colors.brandOn} />}
                onPress={() => close(confirmGoal)}
              />
            </View>
          )}
        >
          {/* 标题（18）+ 注释（14，textMuted）属同一部分：内部纵向间距 4 */}
          <View style={{ gap: 4 }}>
            <AppText kind="md" color={theme.colors.text}>
              {goalEdit === 'time' ? '时长目标' : '任务目标'}
            </AppText>
            <AppText kind="tiny" color={theme.colors.textMuted}>
              进度环与连续天数按这个目标计算
            </AppText>
          </View>
          {/* 档位：四枚一排、平分整宽；只显示数字（单位由标题表明，不重复）；胶囊高度统一 32、内文 16 */}
          <OptionChips
            columns={4}
            height={32}
            options={
              goalEdit === 'time'
                ? appConfig.streak.timeThresholdOptions
                : appConfig.streak.taskThresholdOptions
            }
            value={
              goalDraft ??
              (goalEdit === 'time' ? state.settings.dailyTimeThreshold : state.settings.dailyTaskThreshold)
            }
            onChange={setGoalDraft}
            accessibilityLabel={goalEdit === 'time' ? '时长目标' : '任务目标'}
          />
        </DialogPanel>
      ) : null}
    </Screen>
  );

  /**
   * 左右滑动切四档由 `Screen` 里的那个横向分页 `Animated.ScrollView` 承担
   * （跟手 / 反悔 / 甩动落位都是原生滚动行为，见 `pagerRef` 处的注释）：
   * 只有页头（连续天数 + 四档图标）与底栏不动，正文整条在分页器里横移 ——
   * 包括能力趋势页顶部那行统计范围四档。
   * 这里不再包任何手势宿主，所以页面上的纵向滚动（页内 `ScrollView`）与行内横向滚动
   * 都是纯原生行为，不存在「抢触摸」的问题。
   */
  return screen;
}
