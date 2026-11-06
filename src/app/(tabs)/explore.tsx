import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  FadeIn,
  runOnUI,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';

import {
  PANEL_GAP_BLOCK,
  PANEL_GAP_INNER,
  PronunciationRow,
  SenseRows,
} from '@/components/DictEntryBlock';
import { askDialog } from '@/components/AppDialog';
import { AiAnswerView } from '@/components/AiAnswer';
import { AiHistoryPanel } from '@/components/AiHistoryPanel';
import { EmphasisText } from '@/components/EmphasisText';
import { FavoriteStar } from '@/components/FavoriteStar';
import { FollowUpChips } from '@/components/FollowUpChips';
import { TopFadeMask } from '@/components/TopFade';
import { ExampleText, WORD_DETAIL_GAP, WordDetail } from '@/components/WordDetail';
import { WordBoard } from '@/components/WordBoard';
import {
  AiIcon,
  BoardIcon,
  CloseIcon,
  HistoryIcon,
  HintIcon,
  ListIcon,
  RefreshIcon,
  ShuffleIcon,
} from '@/components/icons';
import {
  AppText,
  Card,
  EmptyState,
  FooterBar,
  OptionChips,
  PrimaryButton,
  SCREEN_HEADER_FADE,
  SCREEN_HEADER_GAP,
  SCREEN_TOP_GAP,
  Screen,
  SegmentedTabs,
} from '@/components/ui';
import { appConfig, levels } from '@/config/appConfig';
import {
  deleteAiChat,
  listAiChats,
  newChatId,
  saveAiChat,
  type AiChatMessage,
  type AiChatRecord,
} from '@/data/aiChats';
import {
  aiExplore,
  LlmError,
  resultToHistoryText,
  type AiExploreResult,
  type LlmErrorCode,
  type LlmMessage,
} from '@/data/aiExplore';
import { getBookWords } from '@/data/wordbooks';
import { aiSuggestExamples, type AiSuggestContext } from '@/data/aiSuggest';
import { bookForLevel } from '@/domain/accumulation';
import { tr, trf } from '@/i18n';
import { useFocusPlaceholder } from '@/lib/focusPlaceholder';
import { useApp } from '@/store/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { inputFont } from '@/theme/fonts';
import { layout, opacity, stroke } from '@/theme/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * 两档（内部 key 沿用 `directed` 不改，避免牵动分页器与无障碍树）：
 * - directed：**AI 探索** —— 想问什么问什么（像聊天页一样连续对话）：查单词给词条
 *   （音标 / 释义 / 词源 / 近义词 / 词性变形 / 搭配 / 例句），其他请求（找近义词、要单词表、
 *   让做背词计划、问两词区别…）给一段通用回答；
 * - random：随机探索（随机抽词，铺在比屏幕宽的矩形词区里，左右拖动即整块横移）。
 */
type ExploreKind = 'directed' | 'random';

/**
 * 随机探索的两种显示方式：
 * - board：词铺在**比屏幕宽的矩形词区**里（默认），左右拖动即整块横移（两端到头即停、不循环）；
 * - list：同一批词按 A-Z 排成一列（只有单词本身，点开详解与矩形档完全一致）。
 * 两者共用「显示方式 / 抽取数量（都在底栏浮层的两枚胶囊里）/ 换一批 / 详解面板」，区别只在词的呈现。
 */
type RandomView = 'board' | 'list';

/** 顶部固定区 / 随机档动作行里各块之间的上下间距 */
const BLOCK_GAP = 8;

/**
 * 「建议追问」与上方正文之间的竖直间距（2026-10-16 定为 16）——
 * 这一排胶囊已**搬进回复面板内部的最底部**（原来是面板下方另起一块），
 * 16 是面板内「正文 → 建议词」这一段的高度；面板本身已给块间 `PANEL_GAP_BLOCK`(8)，
 * 落定时只补差（见 `followUpFooter`），免得两处口径各算一遍。
 */
const FOLLOW_UP_GAP = 16;

/**
 * 顶部两档：**只显示图标、不显示文字**（文字退到无障碍名里）。
 * 第一档 = AI 探索（`AiIcon`）、第二档 = 随机探索（洗牌图标）。
 * 两枚图标等分整行宽度；下方正文并排在横向分页器里，跟随左右原生滑动切换（见 `pagerRef`）。
 */
const KIND_TABS: {
  key: ExploreKind;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
}[] = [
  { key: 'directed', label: 'AI 探索', icon: AiIcon },
  { key: 'random', label: '随机探索', icon: ShuffleIcon },
];

/** 两档在数组里的顺序 = 左右滑动的顺序：左滑 → 随机、右滑 → AI 探索 */
const KIND_KEYS: ExploreKind[] = KIND_TABS.map((t) => t.key);

/** 顶部两档图标之间的间距（等分整行宽度、彼此隔 16，与练习页四档同一套） */
const KIND_GAP = 16;

/** 随机档显示方式的两档（顺序即底栏左侧胶囊内的排列顺序） */
const RANDOM_VIEWS: RandomView[] = ['board', 'list'];
const RANDOM_VIEW_LABEL: Record<RandomView, string> = {
  board: '矩形',
  list: '列表',
};

/** 列表显示方式里相邻两行（词条卡）之间的间距 */
const LIST_GAP = 8;

/**
 * 矩形档释义区上下沿渐变遮罩的长度 —— 直接复用页头遮罩的淡出长度（`SCREEN_HEADER_FADE`），
 * 与收藏夹弹窗的列表（`FavoritePicker` 的 `LIST_FADE`）、AI 历史对话面板同一口径：
 * 全 App 的「化开距离」只有这一个数。
 * 上沿贴词区下沿（释义区的裁切顶边）、下沿贴底栏浮层上方（释义区的裁切底边），
 * 滚动中的词条面板在这两段里化开，而不是被上下邻区硬切一刀。
 */
const DETAIL_FADE = SCREEN_HEADER_FADE;

/**
 * 矩形档的「换一批」放在**词区最右端那一格**里（滑到底才露出来），
 * 所以底栏浮层只剩两枚胶囊一行 —— 浮层高 = `layout.pillHeight`（两档共用同一份口径）。
 */

/** 释义区未选中单词时的居中提示（进词表，`AppText` 自动本地化） */
const BOARD_HINT = '点击上方单词查看释义';

/**
 * AI 探索的对话消息（一问一答各算一条，**可各自删除**）：
 * - user：用户发出去的问题，靠右的实底气泡；
 * - ai：这条问题的回复，靠左；`status` 走 loading 思考中 → done 出结果 / none 答不上来 / error 失败。
 *   回复把对应的问题存在自己身上（`question`），「重试」和「回灌历史」都用它。
 */
type AiMessage =
  | { id: number; role: 'user'; text: string }
  | {
      id: number;
      role: 'ai';
      status: 'loading' | 'done' | 'none' | 'error';
      question: string;
      result: AiExploreResult | null;
      error: LlmErrorCode | null;
    };

/** 回复消息（渲染 / 重试时要收窄类型） */
type AiReplyMessage = Extract<AiMessage, { role: 'ai' }>;

/** 用户气泡最宽占正文区的比例（留出左边一截空白，一眼看出「这是我说的」） */
const CHAT_BUBBLE_MAX_WIDTH = '85%';

/** 长按多久算「要删除这条消息」（ms）：比默认的 500 略短，手感更跟手 */
const CHAT_LONG_PRESS_MS = 400;

/**
 * 空态里的**示例提问池**（2026-10-16 由固定的 4 条改成池子）：界面每次从里面随机抽
 * `appConfig.ai.suggestLimit`(3) 条先顶上（立即可点），同时按用户最近的学习情况请模型现编一版替换
 * （见 `data/aiSuggest.ts`）—— 所以这 10 条只负责「模型没回来 / 没配置密钥 / 请求失败」时的兜底，
 * 以及首屏那一眼。想加减兜底文案改这里即可（进词表，三语自动带上）。
 *
 * 10 条刻意覆盖不同意图（查词义、词表、学习计划、词义辨析、用法、翻译、复习、写作），
 * 随机抽 3 条时不容易抽到三条同类型。
 */
const EXAMPLE_POOL = [
  'hexagon 有哪些近义词',
  '列出大学英语六级的高频常考单词',
  '帮我做一个 7 天背单词计划',
  'describe 和 depict 有什么区别',
  'abandon 这个词怎么用',
  '把「我们明天出发」翻译成英语',
  '给我 10 个商务场景常用词',
  '为什么是 I have been to 而不是 I have gone to',
  '帮我复习昨天学的单词',
  'IELTS 写作常用连接词有哪些',
];

/** 从示例池里**随机**抽 n 条（不重复）—— 空态首屏 / 兜底用，每次进来看到的都不一样 */
function pickExamples(pool: readonly string[], n: number): string[] {
  const rest = [...pool];
  const out: string[] = [];
  while (out.length < n && rest.length > 0) {
    out.push(...rest.splice(Math.floor(Math.random() * rest.length), 1));
  }
  return out;
}

/** 失败原因 → 用户可读文案（IF-4：不把原始错误码 / 报文展示给用户） */
const AI_ERROR_TEXT: Record<LlmErrorCode, string> = {
  'not-configured': '还没配置 AI 服务密钥，无法实时回答',
  network: '网络不可用或服务暂时无法访问，请检查网络后重试',
  timeout: 'AI 响应超时，请检查网络后重试',
  'bad-response': 'AI 解析暂时不可用，请稍后重试',
};

/**
 * 详解右上角的关闭钮（列表档展开态用）：32 正圆 + surface 底 + 灰描边 + 叉图标。
 * 全 App 的卡内小圆钮都是这一套口径（见「更多」页 / 收藏夹）。
 */
function CloseDetailButton({ onPress, label }: { onPress: () => void; label: string }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: 32,
        height: 32,
        borderRadius: 999,
        backgroundColor: theme.colors.surface,
        borderWidth: stroke.base,
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CloseIcon size={16} color={theme.colors.text} />
    </Pressable>
  );
}

/** 以 seed 为准的洗牌（同一 seed 结果稳定，换 seed 即重抽），不改动入参 */
function shuffleBySeed<T>(source: readonly T[], seed: number): T[] {
  let s = (seed % 233280) + 1;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const out = [...source];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * 探索 / Explore —— 对应 Figma「iPhone 16 & 17 Pro - 4」。
 * 顶部固定区两档图标（FR-X-1 / FR-X-2）：
 * 第一档 · AI 探索（`AiIcon`）：**想问什么问什么**，而且是一段**连续对话** ——
 *   用户提问是靠右的红底气泡、AI 回复靠左，一条条往下排（长按任一条即确认删除）；
 *   输入交给 `data/aiExplore.ts` 先判意图：查单词 / 短语 → 音标 / 词性释义 / 词源 / 近义词 / 词性变形 /
 *   搭配 / 例句；其他请求（找近义词、要单词表、让做背词计划、问两词区别…）→ 一段**通用回答**
 *   （标题 + 说明 / 要点 / 词条清单）；发送后输入框立刻清空，之前成功的轮次作为历史一起发给模型，
 *   所以「再举两个例子」这类追问接得住；
 *   还没说过话时正文区给几条**示例提问**，点一条即提问；
 *   （原 `app/ai-word.tsx` 整页平移到这个板块，主页第 4 个工具栏按钮随之删除）；
 * - 第二档 · 随机探索：底栏浮层里两枚合并胶囊（左 = 显示方式、右 = 数量）→
 *   · 矩形：**上下分区** —— 上方是比屏幕宽的矩形词区（左右拖动即整块横移，**两端到头即停、不循环**，
 *     最右端那一格是「换一批」，滑到底才露出来）；**高度由内容决定**（胶囊与词区上下边界各 16px，
 *     行数少则词区跟着变矮），
 *     下方释义区吃掉剩余高度：未点词时居中提示，点词后**直接铺词条面板本身**（不套外层详解面板）；
 *     **点过的词一直留红标记**；
 *   · 列表：同一批词按 A-Z 排成一列，只显示单词本身；点一行 → **这一行自己拉伸**成含详解的面板。
 * 第一档的正文与随机档的列表都由各自的滚动区承担滚动；
 * 随机档的矩形词区不滚动页面（横向手势全部交给词区、纵向本就没有内容，与练习页 / 课本页同一套固定区做法）。
 */
export default function ExploreScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { state } = useApp();
  const { width } = useWindowDimensions();

  const [kind, setKind] = useState<ExploreKind>('directed');

  /* ---------- 左右滑动切两档：横向分页器（与练习页四档同一套） ---------- */
  /** 一页 = 整屏宽（`Screen` 走 `padded={false}`：左右内边距落在每一页自己身上） */
  const pageWidth = width;
  /**
   * 底栏上沿距屏幕底的距离：底栏自身底边距 = max(safeArea.bottom, 8) + 16（与 `BottomBar` /
   * `FooterBar` 同一口径），再加上条带高 —— 两档的浮层都停在这条线上方 16 处。
   */
  const barTopOffset = Math.max(insets.bottom, 8) + 16 + layout.barHeight;
  /**
   * 两档页内滚动区的底部留白：让过「底栏上沿 → 16 → 底栏浮层 → 16 → 正文」，
   * 结果最后一行 / 矩形词区 / 列表末尾都不会被浮层压住。
   * 浮层两档都只有一行胶囊高（`layout.pillHeight`），于是两档共用这一个值。
   */
  const dockH = layout.pillHeight;
  const dockBottomPad = barTopOffset + 16 + dockH + SCREEN_HEADER_GAP;
  /** 分页器本体：点顶部图标切档要让它滚到目标档（worklet 里的 `scrollTo` 需要 animated ref） */
  const pagerRef = useAnimatedRef<Animated.ScrollView>();
  /** 分页器的横向滚动偏移（像素）：只用来驱动顶部两枚图标 */
  const scrollX = useSharedValue(0);
  const onPagerScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });
  /** 顶部图标的位置（单位 = 档位）= 滚动偏移 ÷ 一屏宽；拖动中为小数，图标随之逐帧变色 / 放大 */
  const kindPos = useDerivedValue(() => scrollX.value / pageWidth, [pageWidth]);
  /** 分页视口高度（实测）：横向 ScrollView 的子树不会由内容撑出高度，量一次再显式发给每页 */
  const [pagerHeight, setPagerHeight] = useState(0);
  /**
   * 分页器接不接左右滑（2026-10-16 加）：**触摸落在对话卡片里时先关掉** ——
   * 卡片自己有横向手势（建议词的左右滑动、长按、点词条），不该顺手把页面翻到另一档。
   * 落在别处（卡片之间的留白、左右边距、屏内空白）时照旧可横滑翻档。
   * 只借响应者**捕获阶段**翻一个开关、**不接管触摸**（一律 `return false`），
   * 所以不抢任何控件的点击与滚动；开关值不变时 `setState` 会被 React 直接吞掉，不会多渲染。
   *
   * 输入框与左右两个圆钮不用管：底栏浮层挂在 `Screen` 的 `footer` 槽、是分页器的**兄弟节点**
   * （见 `Screen` 里 `{footer}` 的位置），落在它上面的触摸本来就进不了分页器。
   */
  const [pagerSwipeEnabled, setPagerSwipeEnabled] = useState(true);
  /**
   * 「可以翻档」的区域（分页器自身）：捕获阶段先把开关打开。
   * 捕获是从祖先往后代走的，所以卡片里那个关闭开关会盖在它后面，最终以卡片为准。
   */
  const pagerSwipeOn = {
    onStartShouldSetResponderCapture: () => {
      setPagerSwipeEnabled(true);
      return false;
    },
  };
  /** 「不翻档」的区域（用户提问气泡 / AI 回复面板） */
  const pagerSwipeOff = {
    onStartShouldSetResponderCapture: () => {
      setPagerSwipeEnabled(false);
      return false;
    },
  };
  /** 当前档在 `KIND_KEYS` 里的序号：只用于无障碍树 */
  const kindIndex = KIND_KEYS.indexOf(kind);
  /** 档序号的同步镜像：给「点图标切档」与「屏宽变化后重新对齐」用（免一拍延迟） */
  const kindIndexRef = useRef(kindIndex);
  /** 档位的同步镜像：滑动落位时判断是否真的换了档，只有换了才复位 / 重抽 */
  const kindRef = useRef(kind);
  /**
   * 底栏浮层随分页**跟手横移**：位移 = −横向滚动偏移，与各自那一档的正文同向同速，
   * 因此浮层看上去就是页面底部的一部分 —— 滑到另一档时跟着一起滑出屏幕。
   * 第一档（输入行）停在原位、第二档（显示方式 / 数量胶囊）从右侧滑进来。
   */
  const aiDockStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -scrollX.value }],
  }));
  const randomDockStyle = useAnimatedStyle(
    () => ({ transform: [{ translateX: pageWidth - scrollX.value }] }),
    [pageWidth],
  );

  /* ---------- 第一档：AI 探索（原 `app/ai-word.tsx` 平移而来，现在不止查词） ---------- */
  /** 待提问的输入 —— 不是每敲一个字就发问，只在回车 / 点右侧按钮 / 点示例 / 点词条时发起 */
  const [query, setQuery] = useState('');
  /**
   * 对话消息流（像聊天页）：用户提问靠右、AI 回复靠左，按时间顺序往下排。
   * 一条提问 + 它的回复是**两条独立消息**，所以可以只删问题、只删回答（长按气泡确认后删除）。
   */
  const [messages, setMessages] = useState<AiMessage[]>([]);
  /** 消息自增 id（只用于 key 与按 id 回填回复） */
  const aiMessageId = useRef(0);
  /** 连点 / 过期响应保护：只有最后一次请求的结果能落到界面上 */
  const aiRequestId = useRef(0);
  /** 对话滚动区：新消息进来后自动滚到底 */
  const chatRef = useRef<ScrollView>(null);

  /**
   * 对话内容量一变就把滚动条带到最底（像聊天页）。
   *
   * 与翻译页输入框同理，这里也固定引用：滚动区的 `onContentSizeChange` 是浏览器尺寸观察器
   * 在内容量变化时回调的，回调引用一变就会重新绑定一次，稳定下来可以避免每轮 render 都重新注册。
   */
  const scrollChatToEnd = useCallback(() => {
    chatRef.current?.scrollToEnd({ animated: true });
  }, []);

  /**
   * 当前这一段对话的 id：与落盘的「历史对话」用同一个 —— 「新建新对话」换一个新的，
   * 打开历史某段则改回那一段的 id（之后继续追问就写回那一条）。
   */
  const [chatId, setChatId] = useState(newChatId);
  /** 历史对话（落盘，见 `data/aiChats`）：历史面板直接拿它渲染 */
  const [chats, setChats] = useState<readonly AiChatRecord[]>([]);
  /** 历史面板是否展开（输入行左侧那颗历史按钮开合，面板贴在输入行上方 16px） */
  const [historyOpen, setHistoryOpen] = useState(false);
  /**
   * 上一次落盘的「段 id + 内容」签名：内容没变就不重写 ——
   * 否则每次打开历史某段都会再写一遍，把面板上的**截止时间**刷成当前时刻。
   */
  const savedSig = useRef('');

  /** 有回复还在等结果：此时输入行整块禁用（一次只发一问，历史才干净） */
  const aiSending = messages.some((m) => m.role === 'ai' && m.status === 'loading');

  /** 首帧读一次历史（只读存储一次，之后走 `data/aiChats` 的内存镜像） */
  useEffect(() => {
    void listAiChats().then(setChats);
  }, []);

  /**
   * 对话一变就落盘（历史面板的数据源）：**思考中的占位不写**，
   * 于是同一次提问最多落两回 —— 提问发出时先存下提问，结果回来后再补上终态。
   * 内容与上次落盘一致时直接跳过，`updatedAt` 只在真有新内容时才推进。
   */
  useEffect(() => {
    if (messages.length === 0) return;
    const settled: AiChatMessage[] = [];
    for (const m of messages) {
      if (m.role === 'user') settled.push({ role: 'user', text: m.text });
      else if (m.status !== 'loading') {
        settled.push({
          role: 'ai',
          question: m.question,
          status: m.status,
          result: m.result,
          error: m.error,
        });
      }
    }
    if (settled.length === 0) return;
    const sig = `${chatId}|${JSON.stringify(settled)}`;
    if (sig === savedSig.current) return;
    savedSig.current = sig;
    void saveAiChat({ id: chatId, updatedAt: Date.now(), messages: settled }).then(setChats);
  }, [messages, chatId]);

  /**
   * 打开一段历史对话：整段载回对话区（消息 id 重新编号），并把该段设为「当前段」。
   * 在途请求先作废 —— 否则旧结果会落到刚载入的这段对话上。
   */
  const openChat = (record: AiChatRecord) => {
    aiRequestId.current += 1;
    const list: AiMessage[] = [];
    for (const m of record.messages) {
      const id = (aiMessageId.current += 1);
      list.push(
        m.role === 'user'
          ? { id, role: 'user', text: m.text }
          : {
              id,
              role: 'ai',
              status: m.status,
              question: m.question,
              result: m.result,
              error: m.error,
            },
      );
    }
    setMessages(list);
    setChatId(record.id);
    setQuery('');
    setHistoryOpen(false);
    // 刚载入的内容就是存储里那一份：先认下签名，免得下面那个 effect 再写一遍把截止时间刷掉
    savedSig.current = `${record.id}|${JSON.stringify(record.messages)}`;
  };

  /** 新建新对话：清空对话区、换一个新的段 id（上一段已经落盘，历史面板里仍能找到） */
  const startNewChat = () => {
    aiRequestId.current += 1;
    aiMessageId.current = 0;
    setMessages([]);
    setChatId(newChatId());
    setQuery('');
    setHistoryOpen(false);
    savedSig.current = '';
  };

  /**
   * 删除一段历史对话（面板行内左滑 → 点两下确认）：
   * 只从历史里拿掉这一条，**对话区里正在看的内容原样留着**（它是当前工作副本，不属于「历史上的某一段」）；
   * 若之后又在这段里继续追问，它会带着新内容重新出现在历史最前面。
   */
  const deleteChat = (record: AiChatRecord) => {
    void deleteAiChat(record.id).then(setChats);
  };

  /** 随机探索：抽取数量 + 洗牌种子（换种子即重抽） */
  const [randomSize, setRandomSize] = useState<number>(appConfig.explore.defaultRandomSize);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  /** 随机探索的显示方式：矩形滑动区（默认）/ A-Z 列表 */
  const [randomView, setRandomView] = useState<RandomView>('board');
  /** 随机探索里点开的那颗词（详解开在词区下方；再点同一颗 / 点叉钮 / 点词区空白处收起） */
  const [pickedId, setPickedId] = useState<string | null>(null);
  /**
   * 点过的词（红标记**一直留着**，不再随详解收起而消失）：
   * 只累加、不清空 —— 换一批 / 换数量 / 切显示方式之后，之前看过的词仍是红的，
   * 方便一眼看出「这批里哪些还没看」。
   */
  const [visitedIds, setVisitedIds] = useState<ReadonlySet<string>>(() => new Set<string>());

  /** 随机探索的词池 = 当前题库对应词库的全部词条（带完整详解，点开即可看面板） */
  const pool = useMemo(() => getBookWords(bookForLevel(state.levelId).id), [state.levelId]);

  /** 抽出的词：洗牌后取前 n 条（词池不足所选数量时按实际出） */
  const picked = useMemo(
    () => shuffleBySeed(pool, seed).slice(0, Math.min(randomSize, pool.length)),
    [pool, randomSize, seed],
  );
  /**
   * 列表显示方式用的同一批词：只按 A-Z 排序（矩形档按抽取顺序铺在词区里 ——
   * 随机抽出来的顺序本来就不该有序；列表里字母序才好扫读），集合与数量档完全一致。
   */
  const listed = useMemo(() => [...picked].sort((a, b) => a.word.localeCompare(b.word)), [picked]);
  const pickedWord = picked.find((w) => w.id === pickedId) ?? null;

  /**
   * 矩形档释义区的实测视口高与内容高：**只有内容确实溢出（要滚动）时**才铺上下两段渐变遮罩，
   * 并在内容上下各垫出等长的渐隐段 —— 面板装得下时铺遮罩反而会把首末张压虚、还平白多出空白。
   * 判定稳定：阈值是固定视口高，垫出的那 16×2 不会把「刚好装得下」推成「溢出」。
   */
  const [detailH, setDetailH] = useState(0);
  const [detailContentH, setDetailContentH] = useState(0);
  const detailScrollable = detailContentH > detailH + 0.5;

  /**
   * 落位后把档位同步回 state：只影响无障碍树与顶部图标的选中态（`kindPos` 由滚动偏移自推，不依赖它）。
   * `onScrollEndDrag` / `onMomentumScrollEnd` 都接：前者覆盖「松手即停」的慢拖，后者覆盖带甩动的落位。
   * 只有真的换了档才复位 / 重抽（切到随机档时换一批，避免每次进来都是同一组词）。
   */
  const syncKindFromOffset = useCallback(
    (offsetX: number) => {
      const j = Math.max(0, Math.min(KIND_KEYS.length - 1, Math.round(offsetX / pageWidth)));
      kindIndexRef.current = j;
      const next = KIND_KEYS[j];
      if (kindRef.current === next) return;
      kindRef.current = next;
      setPickedId(null);
      /* 历史面板只属于第一档：换档（含跟手滑走）时收起，避免它挂在第二档上 */
      setHistoryOpen(false);
      if (next === 'random') setSeed(Math.floor(Math.random() * 1e9));
      setKind(next);
    },
    [pageWidth],
  );

  /**
   * 点顶部图标切档：正文滚到目标档（一段横向滚动，图标跟着一起滑）。
   * 用 `runOnUI` + `scrollTo`（与 `useAnimatedRef` 配套）而不是 JS 侧滚动，避免 JS 线程忙时被压后。
   */
  const selectKind = useCallback(
    (next: ExploreKind) => {
      const j = KIND_KEYS.indexOf(next);
      kindIndexRef.current = j;
      if (kindRef.current !== next) {
        kindRef.current = next;
        setPickedId(null);
        setHistoryOpen(false);
        if (next === 'random') setSeed(Math.floor(Math.random() * 1e9));
        setKind(next);
      }
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
    const x = kindIndexRef.current * pageWidth;
    runOnUI((next: number) => {
      'worklet';
      scrollTo(pagerRef, next, 0, false);
    })(x);
  }, [pageWidth, pagerRef]);

  /** 换一批：换洗牌种子重抽（顺带收起已展开的详解） */
  const reshuffle = () => {
    setSeed(Math.floor(Math.random() * 1e9));
    setPickedId(null);
  };

  /** 换抽取数量：重抽一批并收起已展开的详解 */
  const changeRandomSize = (v: number) => {
    setRandomSize(v);
    reshuffle();
  };

  /**
   * 回灌给模型的上文（连续对话用）：只收「用户提问 + 解答成功的回复」——
   * 思考中 / 失败 / 答不上来的轮次不进上下文，免得模型被自己的失败答案带偏。
   */
  const historyOf = (list: readonly AiMessage[]): LlmMessage[] => {
    const out: LlmMessage[] = [];
    for (const m of list) {
      if (m.role === 'user') out.push({ role: 'user', content: m.text });
      else if (m.status === 'done' && m.result) {
        out.push({ role: 'assistant', content: resultToHistoryText(m.result) });
      }
    }
    return out;
  };

  /** 按 id 回填某条回复（这条消息可能刚被删掉 —— 找不到就什么都不做） */
  const patchReply = (id: number, next: Partial<Omit<AiReplyMessage, 'id' | 'role'>>) => {
    setMessages((prev) => prev.map((m) => (m.id === id && m.role === 'ai' ? { ...m, ...next } : m)));
  };

  /**
   * 真发一次请求，结果回填到 `replyId` 那条回复上。
   * 只认最后一次请求（`aiRequestId`）：连点或慢响应回来时，旧的那次直接丢弃。
   */
  const runAsk = async (replyId: number, question: string, history: LlmMessage[]) => {
    const id = aiRequestId.current + 1;
    aiRequestId.current = id;
    try {
      const res = await aiExplore(question, history);
      if (id !== aiRequestId.current) return;
      patchReply(replyId, {
        status: res.kind === 'none' ? 'none' : 'done',
        result: res,
        error: null,
      });
    } catch (error) {
      if (id !== aiRequestId.current) return;
      patchReply(replyId, {
        status: 'error',
        result: null,
        error: error instanceof LlmError ? error.code : 'network',
      });
    }
  };

  /**
   * 发一条提问（回车 / 点右侧红圆按钮 / 点空态示例 / 点回答里的词条）：
   * **输入框立刻清空**，消息流末尾追加「用户提问 + 占位回复」，结果回来后就地替换占位。
   * 历史取追加之前的消息流 —— 这条提问自己不能进自己的上文。
   */
  const send = (input: string) => {
    const question = input.trim();
    if (!question || aiSending) return;
    const history = historyOf(messages);
    const userId = (aiMessageId.current += 1);
    const replyId = (aiMessageId.current += 1);
    setQuery('');
    setMessages((prev) => [
      ...prev,
      { id: userId, role: 'user', text: question },
      { id: replyId, role: 'ai', status: 'loading', question, result: null, error: null },
    ]);
    void runAsk(replyId, question, history);
  };

  /** 重试某条失败的回复：用它自己记着的问题重发，历史取它**之前**的那几条（不含它自己与之后的） */
  const retryReply = (message: AiReplyMessage) => {
    if (aiSending) return;
    const index = messages.findIndex((m) => m.id === message.id);
    const history = historyOf(index > 0 ? messages.slice(0, index) : []);
    patchReply(message.id, { status: 'loading', result: null, error: null });
    void runAsk(message.id, message.question, history);
  };

  /** 长按一条消息 → 确认后删掉**这一条**（问题与回答各算一条，删哪条由长按的那条决定） */
  const confirmRemove = (message: AiMessage) => {
    void askDialog({
      title: tr('删除这条消息？'),
      message: tr('删除后无法恢复。'),
      actions: [
        { id: 'cancel', label: tr('取消'), tone: 'cancel' },
        { id: 'delete', label: tr('删除'), tone: 'danger' },
      ],
    }).then((picked) => {
      if (picked === 'delete') setMessages((prev) => prev.filter((m) => m.id !== message.id));
    });
  };

  /**
   * 点词区里的词 / 点列表行：再点同一颗即收起释义；
   * 同时把这颗词记进 visitedIds —— 红标记会一直留着（不随释义收起而消失）。
   * 释义**直接呈现**（不做逐渐展开的入场动画）。
   * 回调身份固定，避免滑动时白重渲染整块词区。
   */
  const handlePick = useCallback((id: string) => {
    setVisitedIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    setPickedId((prev) => (prev === id ? null : id));
  }, []);

  /**
   * AI 探索输入框占位文案 + 聚焦即隐（全 App 统一口径：选中输入框后框内不再挂提示文字，只留光标）：
   * 空框时按它选字体，避免汉字落到 Barlow 上（同主页翻译条）。
   */
  const aiHint = useFocusPlaceholder(tr('输入以开始AI探索'));

  /**
   * 顶部固定区：两枚档位图标（AI 探索 / 随机探索）——**只显示图标、不显示文字**（文字退到无障碍名里）。
   * 通过 `Screen` 的 `header` 槽渲染在滚动区之外，上下滚动时整块停住；
   * 不传 `headerMaskGap`（= 0）：淡出段从图标下沿起、与页内滚动区的裁切边重合，
   * 滚上去的内容在渐变里化开而不是被硬切（与练习页四档同一套做法）。
   */
  const topBlock = (
    <View style={{ paddingHorizontal: layout.pagePadding }}>
      <SegmentedTabs
        items={KIND_TABS}
        value={kind}
        onChange={selectKind}
        gap={KIND_GAP}
        bare
        pos={kindPos}
        accessibilityLabel={tr('探索方式')}
      />
    </View>
  );

  /**
   * 随机档的「换一批」：**词区最右端那一格**里的按钮（见 `WordBoard` 的 `endSlot`）——
   * 一路滑到最右边才露出来，所以底栏浮层里不再有它那一行。
   * 样式 = **一枚图标**（无底色、无描边），颜色 `textMuted`：
   * 它是这一批词末尾的一个次级动作，不跟词胶囊抢视觉；文字含义退到无障碍名。
   * 内边距只用来撑触控区（透明）。
   */
  const reshuffleButton = (
    <Pressable
      onPress={reshuffle}
      accessibilityRole="button"
      accessibilityLabel={tr('换一批')}
      hitSlop={8}
      style={{ paddingVertical: 8, paddingHorizontal: 12 }}
    >
      <RefreshIcon size={24} color={theme.colors.textMuted} />
    </Pressable>
  );

  /**
   * 底栏浮层（挂在 `Screen` 的 `footer` 槽、不随纵向滚动、随分页横向跟手滑动）：
   * 同一块位置上叠着两档各自的控件，宽度 = 底栏宽度（`FooterBar` 左右各留 32），
   * 两档的浮层都贴容器底部，所以第一档的输入行与第二档的胶囊行**落在同一条线上**。
   * - 第一档 · AI 探索：**左**历史对话钮（点开上方 16px 的历史面板：日期 + 一句话标题 + 新建新对话）
   *   + 中间输入胶囊 + **右**品牌红正圆发送钮（内容物 = `HintIcon direction="up"`，即更多面板同款实心箭头转向上；
   *   回车 / 点它 / 点空态里的示例才发起，不是每敲一个字）；
   * - 第二档 · 随机探索：左胶囊选**显示方式**（矩形 / 列表）、右胶囊选**数量**
   *   （两枚都是一枚胶囊内等分的合并形态，见 `OptionChips joined`）；
   *   「换一批」不在这里 —— 它是矩形词区**最右端那一格**（滑到底才露出来，见 `WordBoard` 的 `endSlot`）。
   * 两档各自跟手横移（`aiDockStyle` / `randomDockStyle`），滑出屏幕的那一档同步退出命中与无障碍树。
   */
  const dock = (
    /* `avoidKeyboard`：这一档里有 AI 提问输入框，键盘一弹起整条跟着上抬（走原生 `KeyboardAvoidingView`，
       不再自己监听键盘高度），抬完停在键盘顶边上方 16；其余页面的底栏仍钉在静止位不动。 */
    <FooterBar aboveBar avoidKeyboard>
      {/* 外层只作定位容器（`box-none` 不吞点击）：竖向排「历史面板（开着才有）→ 16 → 输入行」。
          高度由内容撑开，而底栏浮层是从底往上长的，所以面板往上开、输入行位置不动。
          两档的浮层都**贴容器底部**（`bottom: 0`），于是两档的控件落在同一条线上。 */}
      <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'flex-end', gap: 16 }}>
        {/* 历史对话面板：贴在输入行上方 16px，宽度与底栏一致；随第一档一起跟手横移 */}
        {historyOpen ? (
          <Animated.View
            pointerEvents={kind === 'directed' ? 'auto' : 'none'}
            style={aiDockStyle}
          >
            <AiHistoryPanel
              chats={chats}
              currentId={chatId}
              onOpen={openChat}
              onNew={startNewChat}
              onDelete={deleteChat}
            />
          </Animated.View>
        ) : null}

        <View pointerEvents="box-none" style={{ height: dockH, justifyContent: 'flex-end' }}>
          <Animated.View
            pointerEvents={kind === 'directed' ? 'auto' : 'none'}
            accessibilityElementsHidden={kind !== 'directed'}
            importantForAccessibility={kind === 'directed' ? 'auto' : 'no-hide-descendants'}
            style={[
              {
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                flexDirection: 'row',
                alignItems: 'center',
                // 历史钮 / 输入胶囊 / 发送钮 三者之间的水平间距（2026-10-16 定为 8）
                gap: 8,
              },
              aiDockStyle,
            ]}
          >
            {/* 输入框左侧：历史对话按钮（正圆，与右侧提问钮同高；底色取**页面底色**（`bg`）、描品牌红，
                图标走线性 1.8 线宽，一眼区分「不是发消息那一下」） */}
            <Pressable
              onPress={() => setHistoryOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={tr('历史对话')}
              accessibilityState={{ expanded: historyOpen }}
              style={{
                width: layout.pillHeight,
                height: layout.pillHeight,
                borderRadius: 999,
                borderWidth: stroke.base,
                borderColor: theme.colors.brand,
                backgroundColor: theme.colors.bg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <HistoryIcon size={22} color={theme.colors.brand} />
            </Pressable>

            {/* 输入胶囊：与主页翻译条同一套口径（18px 粗体）；底色取**底栏底色**（barBackground），
                描边走**品牌红**（描红，与外层提问红钮同色系） */}
            <View
              style={{
                flex: 1,
                minHeight: layout.pillHeight,
                borderWidth: stroke.base,
                borderColor: theme.colors.brand,
                borderRadius: 999,
                backgroundColor: theme.colors.barBackground,
                // 裁掉内层输入框可能的溢出（web 上 `input` 自带固有宽度，见下方 `minWidth: 0`）——
                // 与主页翻译条同一道保险
                overflow: 'hidden',
                flexDirection: 'row',
                alignItems: 'center',
                // 输入框统一内边距 16（内层 TextInput 清零，左右留白由此处给）
                paddingHorizontal: layout.inputPad,
              }}
            >
              <TextInput
                value={query}
                onChangeText={setQuery}
                {...aiHint}
                placeholderTextColor={theme.colors.textSecondary}
                accessibilityLabel={tr('输入单词或问题')}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                onSubmitEditing={() => send(query)}
                style={{
                  flex: 1,
                  /**
                   * web 上 `TextInput` 渲染成 `<input>`，它自带**固有宽度**（浏览器按 `size=20`
                   * 算出一段固定宽度），而 flex 子项默认 `min-width: auto` 会把这条固有宽度当作
                   * 不可压缩的下限 —— 于是窗口一窄，输入框就比胶囊的内容区还宽、向右溢出，
                   * 在胶囊圆头之外露出一块自己的底色（看着像「输入框右侧突出一块黑条」）。
                   * 显式置 0 才是根因修复：允许它被压缩到父级给的那点宽度；原生端本就没有固有宽度，
                   * 这个值对原生没有任何影响。
                   */
                  minWidth: 0,
                  paddingHorizontal: 0,
                  paddingVertical: 0,
                  includeFontPadding: false,
                  textAlignVertical: 'center',
                  color: theme.colors.text,
                  // 空框时按占位文字（中文）选字体，避免汉字落到 Barlow 上
                  fontFamily: inputFont('bold'),
                  fontSize: theme.size(18),
                  // 内层输入框自己也铺底：外层胶囊已有底色，显式写上避免各平台默认底透出来
                  backgroundColor: theme.colors.barBackground,
                }}
              />
            </View>
            {/* 发送钮：品牌红实底正圆 + **向上的箭头**（与「更多」面板里那颗向右的尖括号箭头同一套
                线宽与圆头端点，只是转向上），发送中换成转圈 */}
            <Pressable
              onPress={() => send(query)}
              disabled={aiSending}
              accessibilityRole="button"
              accessibilityLabel={tr('提问')}
              accessibilityState={{ disabled: aiSending, busy: aiSending }}
              style={{
                width: layout.pillHeight,
                height: layout.pillHeight,
                borderRadius: 999,
                borderWidth: stroke.base,
                borderColor: theme.colors.brand,
                backgroundColor: theme.colors.brand,
                alignItems: 'center',
                justifyContent: 'center',
                // 等上一条回复时整块变淡（进行中，仍属「可交互但非主行动」档）
                opacity: aiSending ? opacity.muted : 1,
              }}
            >
              {aiSending ? (
                <ActivityIndicator color={theme.colors.brandOn} />
              ) : (
                <HintIcon size={24} direction="up" color={theme.colors.brandOn} />
              )}
            </Pressable>
          </Animated.View>

          {/* 第二档 · 随机探索：只有一行 —— 左「显示方式」+ 右「数量」的合并胶囊
              （「换一批」已挪到矩形词区最右端那一格，见 `reshuffleButton`）。
              整块随分页跟手横移（`randomDockStyle`）。 */}
          <Animated.View
            pointerEvents={kind === 'random' ? 'auto' : 'none'}
            accessibilityElementsHidden={kind !== 'random'}
            importantForAccessibility={kind === 'random' ? 'auto' : 'no-hide-descendants'}
            style={[
              { position: 'absolute', left: 0, right: 0, bottom: 0 },
              randomDockStyle,
            ]}
          >
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {/* 左胶囊：显示方式（矩形 / A-Z 列表）——两档平分这半边的宽度，用图标、不带文字；
                  底色取底栏底色，与上方输入胶囊 / 底栏同底 */}
              <View style={{ flex: 1 }}>
                <OptionChips
                  joined
                  background={theme.colors.barBackground}
                  height={layout.pillHeight}
                  options={RANDOM_VIEWS}
                  value={randomView}
                  onChange={setRandomView}
                  labelOf={(v) => RANDOM_VIEW_LABEL[v]}
                  iconOf={(v) => {
                    const c = randomView === v ? theme.colors.brand : theme.colors.text;
                    return v === 'board' ? <BoardIcon size={24} color={c} /> : <ListIcon size={24} color={c} />;
                  }}
                  accessibilityLabel={tr('显示方式')}
                />
              </View>
              {/* 右胶囊：抽取数量（15 / 30 / 45，不带单位）——三档平分这半边的宽度，只有数字（`md` 18） */}
              <View style={{ flex: 1 }}>
                <OptionChips
                  joined
                  background={theme.colors.barBackground}
                  height={layout.pillHeight}
                  labelKind="md"
                  options={appConfig.explore.randomSizes}
                  value={randomSize}
                  onChange={changeRandomSize}
                  a11yLabelOf={(v) => trf('{v} 个', { v })}
                  accessibilityLabel={tr('探索数量')}
                />
              </View>
            </View>
          </Animated.View>
        </View>
      </View>
    </FooterBar>
  );

  /**
   * 面板**内部最底部**那一排**建议追问**（模型围绕这条回复发散的，最多 `appConfig.ai.followUpLimit` 条，
   * 横向可滑）：点一条 = 把这句话作为新提问发出去，与空态示例提问同一个动作。
   * **它属于这张面板**（2026-10-16 从面板下方搬进来，随面板的品牌红描边一起被框住），
   * 与上方正文之间留 `FOLLOW_UP_GAP`(16) —— 面板已给块间 `PANEL_GAP_BLOCK`(8)，这里只补差额。
   * 没有建议词时不渲染任何东西（失败 / 答不上来 / 思考中都不会多出一段空白）。
   */
  const followUpFooter = (items: readonly string[]) =>
    items.length === 0 ? null : (
      <View style={{ marginTop: FOLLOW_UP_GAP - PANEL_GAP_BLOCK }}>
        <FollowUpChips items={items} onPress={send} />
      </View>
    );

  /**
   * 词条类结果的排版（查单词）：**单词 + 义项 → 词源 → 近义词·词性变形·常用搭配 → 例句**，
   * 整条回复只占**一张面板**，各段之间靠面板的 `gap` 拉开、不画分割线（2026-10-15 按设计合并，
   * 原来是「释义面板 + 词源 + 中间块 + 例句」四张卡叠着；2026-10-16 按设计去掉段间分割线）。面板沿用释义面板的品牌红描边。
   * 段内：近义词与搭配走例句同款 18px（**正规字重**，只有命中词加粗描红），
   * 词性变形按「(词性) 形式」逐行排；正文一律左右对齐；
   * 音标行与义项列表复用「单词本」词条详解那一套（`DictEntryBlock`）。
   *
   * **强调口径（2026-10-16）**：AI 回答里**凡加粗处一律同时描红** —— 释义（本档默认 16px 加粗）、
   * 词性变形的形式、近义词 / 搭配 / 例句里命中的查询词，全部走 `accentRed`；中文里的关键词则由
   * 模型辨析后在 `keys` 里给出，命中处用 `EmphasisText` 加粗描红（词源、例句中文翻译）。
   */
  const aiEntryPanel = (result: Extract<AiExploreResult, { kind: 'entry' }>) => {
    const entry = result.entry;
    const word = result.query;
    /** 模型辨析出的关键词 —— 在词源与例句中文翻译里命中即加粗描红 */
    const keywords = result.keys;
    /** 真有内容的段（顺序 = 单词 → 词源 → 近义词/词性变形/搭配 → 例句），渲染时靠面板 gap 分隔 */
    const sections: React.ReactNode[] = [];

    // ① 单词 32px 品牌红 + 音标行（品牌红圆喇叭）+ 收藏星标 + 义项（序号圆标 + 释义）
    sections.push(
      <>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <View style={{ flex: 1, gap: PANEL_GAP_INNER }}>
            <AppText kind="xl" color={theme.colors.brand}>
              {word}
            </AppText>
            {entry.phonetic ? (
              <PronunciationRow word={word} text={entry.phonetic} lang="en-US" />
            ) : null}
          </View>
          {/* 收藏星标走公共组件（带收藏夹选择弹窗），与词条块 / 详解面板同一份 */}
          <FavoriteStar word={word} definition={entry.senses[0]?.zh ?? ''} source="explore" />
        </View>
        <SenseRows
          // 中文释义为主行、英文释义为次级行（同一义项两条都要有）；万一模型只给了英文，
          // 就把英文顶到主行，避免出现一行空白
          senses={entry.senses.map((s) => ({
            pos: s.pos,
            primary: s.zh || s.en,
            secondary: s.zh && s.en ? s.en : undefined,
          }))}
          // 主释义是本档默认的加粗字重 → 按「凡加粗皆为红」口径换成强调红
          emphasisColor={theme.colors.accentRed}
        />
      </>,
    );

    // ② 词源（模型辨析出的关键词在正文里加粗描红）
    if (entry.origin) {
      sections.push(
        <>
          <AppText kind="tiny" color={theme.colors.textMuted}>
            词源
          </AppText>
          <EmphasisText
            text={entry.origin}
            keywords={keywords}
            kind="tiny"
            color={theme.colors.textSecondary}
            align="justify"
          />
        </>,
      );
    }

    // ③ 近义词 → 词性变形 → 常用搭配（这三小块之间也靠面板 gap 分隔）
    if (entry.synonyms.length > 0 || entry.forms.length > 0 || entry.collocations.length > 0) {
      sections.push(
        <>
          {entry.synonyms.length > 0 ? (
            <View style={{ gap: PANEL_GAP_INNER }}>
              <AppText kind="tiny" color={theme.colors.textMuted}>
                近义词
              </AppText>
              <ExampleText
                text={entry.synonyms.join(' · ')}
                term={word}
                highlight={theme.colors.accentRed}
                weight="regular"
                align="justify"
              />
            </View>
          ) : null}
          {entry.forms.length > 0 ? (
            <View style={{ gap: PANEL_GAP_INNER }}>
              <AppText kind="tiny" color={theme.colors.textMuted}>
                词性变形
              </AppText>
              {entry.forms.map((f) => (
                <View key={`${f.pos}-${f.form}`} style={{ flexDirection: 'row', gap: 4 }}>
                  {f.pos ? (
                    <AppText kind="md" weight="regular" color={theme.colors.textSecondary}>
                      {`(${f.pos})`}
                    </AppText>
                  ) : null}
                  {/* 形式是这一行的重点（本档默认加粗）→ 按「凡加粗皆为红」口径走强调红 */}
                  <AppText kind="md" color={theme.colors.accentRed} style={{ flex: 1 }}>
                    {f.form}
                  </AppText>
                </View>
              ))}
            </View>
          ) : null}
          {entry.collocations.length > 0 ? (
            <View style={{ gap: PANEL_GAP_INNER }}>
              <AppText kind="tiny" color={theme.colors.textMuted}>
                常用搭配
              </AppText>
              {entry.collocations.map((c) => (
                <ExampleText
                  key={c}
                  text={`· ${c}`}
                  term={word}
                  highlight={theme.colors.accentRed}
                  weight="regular"
                  align="justify"
                />
              ))}
            </View>
          ) : null}
        </>,
      );
    }

    // ④ 例句固定收尾：英文整句 18px（正规字重，只有命中词加粗描红）+ 中文翻译为次级行
    //    （中文翻译里同样接受模型辨析出的关键词，命中处加粗描红）
    if (entry.examples.length > 0) {
      sections.push(
        <>
          <AppText kind="tiny" color={theme.colors.textMuted}>
            例句
          </AppText>
          {entry.examples.map((ex, i) => (
            <View key={`${ex.en}-${i}`} style={{ gap: PANEL_GAP_INNER }}>
              <ExampleText
                text={ex.en}
                term={word}
                highlight={theme.colors.accentRed}
                weight="regular"
                align="justify"
              />
              {ex.zh ? (
                <EmphasisText
                  text={ex.zh}
                  keywords={keywords}
                  kind="tiny"
                  color={theme.colors.textSecondary}
                  align="justify"
                />
              ) : null}
            </View>
          ))}
        </>,
      );
    }

    // ⑤ 建议追问：**面板内部最底部**那排胶囊（没有建议词时为空，不会多出空白）
    sections.push(followUpFooter(result.followups));

    return (
      <Card style={{ padding: 16, gap: PANEL_GAP_BLOCK }} strokeColor={theme.colors.brand}>
        {sections.map((section, index) => (
          <React.Fragment key={index}>{section}</React.Fragment>
        ))}
      </Card>
    );
  };

  /**
   * 一条 AI 回复的内容（**靠左**）：思考中 → 失败（带「重试」）/ 答不上来 / 词条 / 通用回答。
   * **每条回复都只占一张面板**（词条与通用回答内部各段靠面板 gap 分隔、无分割线），天然左对齐；
   * 出了结果的回复，**这张面板内部的最底部**还排着那排**建议追问**（模型围绕这条回复发散的，
   * 横向可滑，点了即提问）—— 它受面板的品牌红描边与内边距一起框住，不再另起一块。
   */
  const aiReplyBody = (message: AiReplyMessage) => {
    if (message.status === 'loading') {
      return (
        <Card style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <ActivityIndicator color={theme.colors.brand} />
          <AppText kind="micro" color={theme.colors.textSecondary}>
            思考中…
          </AppText>
        </Card>
      );
    }

    if (message.status === 'error' && message.error) {
      return (
        <Card style={{ padding: 16, gap: 10 }}>
          <AppText kind="md" color={theme.colors.brand}>
            出了点问题
          </AppText>
          <AppText kind="micro" color={theme.colors.textSecondary}>
            {tr(AI_ERROR_TEXT[message.error])}
          </AppText>
          {message.error === 'not-configured' ? (
            <AppText kind="micro" color={theme.colors.textMuted}>
              在项目根目录的 .env 里填 EXPO_PUBLIC_AI_API_KEY 后重启即可（参考 .env.example）
            </AppText>
          ) : null}
          {/* 重试：与原文字按钮同一尺寸（撑满整行、minHeight 40），只有内容物由「重试」二字换成循环箭头图标
              —— 文案改由无障碍名承载 */}
          <PrimaryButton
            tone="ghost"
            onPress={() => retryReply(message)}
            accessibilityLabel={tr('重试')}
            style={{ minHeight: 40 }}
            icon={<RefreshIcon size={20} color={theme.colors.text} />}
          />
        </Card>
      );
    }

    if (message.status === 'none') {
      return (
        <Card style={{ padding: 16, gap: 6 }}>
          <AppText kind="md" color={theme.colors.brand}>
            抱歉，这个我答不上来
          </AppText>
          <AppText kind="micro" color={theme.colors.textSecondary}>
            查单词就检查一下拼写；其他问题可以换个说法再问一次
          </AppText>
        </Card>
      );
    }

    const result = message.result;
    if (!result || result.kind === 'none') return null;
    /* 通用回答：找近义词 / 要单词表 / 让做背词计划 等非查词请求走这一支；
       点里面的词条 = 顺着往下问（`send` 会把它作为新的一条提问接在对话末尾）。
       模型给的 `title` 不渲染 —— 上方已有用户提问气泡，重复一遍是冗余。
       建议追问卷胶囊排在**面板内部最底部**（`followUpFooter`），所以这里直接交面板本身。 */
    return result.kind === 'entry' ? (
      aiEntryPanel(result)
    ) : (
      <AiAnswerView
        blocks={result.blocks}
        keywords={result.keys}
        onTermPress={send}
        footer={followUpFooter(result.followups)}
      />
    );
  };

  /**
   * 一条消息：用户提问是**靠右**的品牌红实底气泡，AI 回复**靠左**；
   * 长按任一条 → 确认后删掉**这一条**（提问与回复各算一条，见 `confirmRemove`）。
   * AI 一侧 `accessible={false}`：让卡内那些收藏星标 / 词条各自还是独立的无障碍元素。
   */
  const aiMessageView = (message: AiMessage) => {
    if (message.role === 'user') {
      return (
        <Pressable
          key={message.id}
          onLongPress={() => confirmRemove(message)}
          delayLongPress={CHAT_LONG_PRESS_MS}
          accessibilityRole="button"
          accessibilityLabel={message.text}
          accessibilityHint={tr('长按可删除')}
          /* 对话卡片里的横滑不翻档（见 `pagerSwipeOff`）：气泡上的手势留给长按与选中 */
          {...pagerSwipeOff}
          style={{
            alignSelf: 'flex-end',
            maxWidth: CHAT_BUBBLE_MAX_WIDTH,
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: layout.cardRadius,
            borderWidth: stroke.base,
            borderColor: theme.colors.brand,
            backgroundColor: theme.colors.brand,
          }}
        >
          <AppText kind="sm" color={theme.colors.brandOn}>
            {message.text}
          </AppText>
        </Pressable>
      );
    }
    return (
      <Pressable
        key={message.id}
        accessible={false}
        onLongPress={() => confirmRemove(message)}
        delayLongPress={CHAT_LONG_PRESS_MS}
        /* 回复面板里的横滑不翻档（见 `pagerSwipeOff`）：面板内那排建议词要能自己左右滑 */
        {...pagerSwipeOff}
        style={{ alignSelf: 'stretch' }}
      >
        {aiReplyBody(message)}
      </Pressable>
    );
  };

  /**
   * 空态示例提问（3 条，2026-10-16 改成**动态生成**）——
   * 首屏先用内置池随机抽 3 条顶上（立即可点、不用等），同时把**最近的学习情况**
   * （当前等级 / 正在学的词库 / 最近学过的词 / 收藏的词 / 做错过的词）交给模型现编 3 条替换，
   * 回来以淡入换上（见下面示例区的 `entering`）。换等级、学新词、收藏变化都会让上下文签名变，
   * 于是重新生成；同一上下文 6 小时内走缓存（`appConfig.ai.suggestTtlMs`）；没配置密钥、
   * 超时或请求失败就继续用兜底那 3 条 —— 不报错、不空屏。
   * 只有空态用得上：一旦有了消息这一块就不再渲染（`chatEmpty`）。
   */
  const suggestContext = useMemo<AiSuggestContext>(() => {
    const book = bookForLevel(state.levelId);
    const learnedIndex = state.readingPositions[book.id]?.index ?? 0;
    return {
      /* 等级用中文名（日常 / CET4 / …）：模型看到「Daily」会把等级名当成要讲的单词 */
      level: levels.find((l) => l.id === state.levelId)?.labelZh ?? state.levelId,
      book: book.name,
      learned: getBookWords(book.id)
        .slice(0, learnedIndex)
        .slice(-3)
        .map((w) => w.word),
      favorites: state.favorites.slice(-3).map((f) => f.word),
      missed: [...new Set(state.attempts.flatMap((a) => a.wrongWords ?? []))].slice(-3),
    };
  }, [state.levelId, state.readingPositions, state.favorites, state.attempts]);

  /** 空态当前显示的三句：先本地随机抽一版，模型生成回来整体换成它那一版 */
  const [examples, setExamples] = useState<string[]>(() =>
    pickExamples(EXAMPLE_POOL, appConfig.ai.suggestLimit),
  );
  const chatEmpty = messages.length === 0;

  useEffect(() => {
    if (!chatEmpty) return;
    let alive = true;
    void aiSuggestExamples(suggestContext).then((list) => {
      if (!alive || list.length === 0) return;
      /* 内容没变就别换引用：省一次重渲染，也免得重播一次淡入 */
      setExamples((prev) => (prev.join('|') === list.join('|') ? prev : list));
    });
    return () => {
      alive = false;
    };
  }, [chatEmpty, suggestContext]);

  /**
   * 第一档 · AI 探索的对话区：像聊天页一样按时间顺序往下排 ——
   * 用户提问**靠右**、AI 回复**靠左**；一条提问与它的回复是两条独立消息，可各自长按删除。
   * 支持连续对话（`send` 把之前解答成功的轮次作为历史一起发出去）；
   * 没有消息时是「提示 + 示例提问」的空态。输入行不在这里，它是底栏之上的 `dock`。
   */
  const aiPanel = (
    <>
      {messages.length === 0 ? (
        /* 空态：**3 条示例提问**（点了即提问）—— 让用户一眼看懂「这里不只能查单词，
            还能直接提要求」。内容是动态的：先由 `EXAMPLE_POOL` 随机抽 3 条顶上，
            紧接着按最近的学习情况请模型现编 3 条替换（见 `suggestContext` / `aiSuggestExamples`）。
            整块**贴着正文区顶部**排（原来垂直居中，现在置顶），
            每行**右端**统一挂一颗向上的箭头（与右下角发送钮同一套字形，只是更小、更弱），
            提示「点它即发送」。原来的「输入单词，或直接说你想做什么」提示已按设计删除，
            占位文案已说明怎么用。 */
        <Animated.View
          /* key 跟着内容走：模型那版回来时整块重挂载 → 由 entering 淡入换上，
             用户能看出「建议刷新了」，而不是无声无息换掉几行字 */
          key={examples.join('|')}
          entering={FadeIn.duration(240)}
          style={{ gap: BLOCK_GAP }}
        >
          {examples.map((example) => (
            <Card
              key={example}
              onPress={() => send(example)}
              accessibilityLabel={trf('提问：{q}', { q: example })}
              style={{ paddingVertical: 12, paddingHorizontal: 16 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <AppText kind="sm" color={theme.colors.text} style={{ flex: 1 }}>
                  {example}
                </AppText>
                <HintIcon size={20} direction="up" color={theme.colors.textSecondary} />
              </View>
            </Card>
          ))}
        </Animated.View>
      ) : null}

      {messages.map(aiMessageView)}
    </>
  );

  return (
    <Screen
      header={topBlock}
      headerTopGap={SCREEN_TOP_GAP}
      /* 正文整块占满屏宽（左右内边距落在每一页自己身上，见下面两页）：分页器要能整页横滑 */
      padded={false}
      /* 纵向滚动下沉到每一页内部：分页器本身要能整条横滑，不能再套一层滚动区 */
      scroll={false}
      /* 两档的底栏浮层（第一档输入行 / 第二档显示方式·数量胶囊，同一位置、随分页跟手横移） */
      footer={dock}
    >
      {/* 分页器：横向 `Animated.ScrollView` + `pagingEnabled`，**两档正文并排全量常驻**。
          位置（跟手 / 反悔 / 甩动落位 / 连滑）全由这个原生滚动视图持有，只有一份事实；
          每页高度用实测的 `pagerHeight` 显式给出（横向滚动视图的子树不会由内容撑出确定高度），
          页内的纵向滚动区因此有界、能滚；各页各留各的滚动位置。
          整体上移 `SCREEN_HEADER_GAP`：让每页页顶落在顶部图标下沿（`Screen` 的 `bodyTopPad`
          已给到「图标下沿 + 16」，这里抵回 16），页内滚动区的裁切边于是正好压在淡出段起点上。 */}
      <Animated.ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        /* 触摸落在对话卡片里时临时关掉（见 `pagerSwipeEnabled`）：卡片自己的横向手势优先 */
        scrollEnabled={pagerSwipeEnabled}
        {...pagerSwipeOn}
        /* Android 的嵌套滚动：让行内那些横向滚动**先消费**，滑到头才轮到本页翻页 */
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onPagerScroll}
        scrollEventThrottle={16}
        /* 松手（慢拖停下 / 甩动落位）后把档位同步回 state：无障碍树与顶部图标选中态用 */
        onScrollEndDrag={(e) => syncKindFromOffset(e.nativeEvent.contentOffset.x)}
        onMomentumScrollEnd={(e) => syncKindFromOffset(e.nativeEvent.contentOffset.x)}
        /* 量一次视口高：每页都要一个确定高度，页内的纵向滚动区才会滚 */
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          setPagerHeight((prev) => (Math.abs(prev - h) > 0.5 ? h : prev));
        }}
        style={{ flex: 1, marginTop: -SCREEN_HEADER_GAP }}
      >
        {/* 第 1 页：AI 探索 —— 对话区（空态示例 / 一问一答 / 思考中 / 失败 / 答不上来）整页自己纵向滚动；
            新消息进来或回复由「思考中」换成整段回答时自动滚到底（像聊天页）；
            输入行是浮在底栏之上的 `dock`（挂在 `Screen` 的 footer 槽），不在这条滚动流里 */}
        <View
          accessibilityElementsHidden={kindIndex !== 0}
          importantForAccessibility={kindIndex === 0 ? 'auto' : 'no-hide-descendants'}
          style={{ width: pageWidth, height: pagerHeight }}
        >
          <ScrollView
            ref={chatRef}
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            /* iOS：键盘弹出时自动内缩，底部输入行抬到键盘上后，内容仍能继续往上滑 */
            automaticallyAdjustKeyboardInsets
            onContentSizeChange={scrollChatToEnd}
            contentContainerStyle={{
              paddingTop: SCREEN_HEADER_GAP,
              paddingHorizontal: layout.pagePadding,
              gap: 16,
              // 让过底部浮层（两档都有，厚度一致）
              paddingBottom: dockBottomPad,
              // 空态提示要能在正文区正中（内容不足一屏时也撑满可用高度）
              flexGrow: 1,
            }}
          >
            {aiPanel}
          </ScrollView>
        </View>

        {/* 第 2 页：随机探索 —— 「换一批」在底栏浮层（胶囊正上方居中），
            正文是「矩形滑动区 / A-Z 列表」二选一 */}
        <View
          accessibilityElementsHidden={kindIndex !== 1}
          importantForAccessibility={kindIndex === 1 ? 'auto' : 'no-hide-descendants'}
          style={{ width: pageWidth, height: pagerHeight }}
        >
          {picked.length === 0 ? (
            /* 空态：在「底栏浮层之上的可视区」正中，与矩形档一致 */
            <View style={{ flex: 1, justifyContent: 'center', paddingBottom: dockBottomPad }}>
              <EmptyState title="该词库暂无可探索的词条" />
            </View>
          ) : (
            /* 随机档舞台：矩形滑动区（比屏幕宽的词区，左右循环滑动）或 A-Z 列表（只有单词本身）。
               列表档是「行内拉伸」—— 点一行，这一行自己长成详解面板；
               矩形档是「上下分区」—— 上方是矩形词区（**高度由内容决定**：胶囊上下各留 16px，
               行数少则词区跟着变矮；点过的词一直红着），下方释义区吃掉剩余高度：
               没点词时居中一句提示，点词后就地展示详解。
               `paddingTop: SCREEN_HEADER_GAP` 与 `paddingBottom: dockBottomPad` 让它
               落在顶部图标下沿与底栏浮层之间 —— 与第一档同一段留白。 */
            <View
              style={{
                flex: 1,
                paddingTop: SCREEN_HEADER_GAP,
                paddingBottom: dockBottomPad,
              }}
            >
              {randomView === 'list' ? (
                /* 列表显示方式：一行一个单词（没有音标 / 释义 / 收藏等注释）。
                   点一行 → **这一行自己变成**含详解的面板（不是在别处另开浮层）：
                   头部换成一个红字单词（再点即收起）+ 关闭叉钮，下面是同一份 `WordDetail`
                   （收藏按钮在详解面板自己的右上角，头部不再重复一颗）。
                   **无展开动画**：不套 `layout`、详解也不淡入，一按即到位（与矩形档释义区同一口径）。 */
                <ScrollView
                  style={{ flex: 1 }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  /* 底部留白由外层舞台容器的 `paddingBottom` 统一给，这里只要左右内边距 */
                  contentContainerStyle={{
                    gap: LIST_GAP,
                    paddingHorizontal: layout.pagePadding,
                  }}
                >
                  {listed.map((w) => {
                    const seen = visitedIds.has(w.id);
                    const expanded = w.id === pickedId;
                    return (
                      <View key={w.id}>
                        <Card
                          // 收起的行整行可点；展开后整卡不再拦截点击（改由头部的单词 / 叉钮各自处理）
                          onPress={expanded ? undefined : () => handlePick(w.id)}
                          accessibilityLabel={
                            expanded ? undefined : trf('查看 {word} 的详解', { word: w.word })
                          }
                          // 点过的行（与矩形词区里点过的词同一套标记）**一直**品牌红：描边 + 文字
                          strokeColor={seen ? theme.colors.brand : undefined}
                          style={{
                            paddingVertical: 12,
                            paddingHorizontal: 16,
                            gap: expanded ? 12 : 0,
                          }}
                        >
                          {expanded ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <Pressable
                                onPress={() => handlePick(w.id)}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel={trf('收起 {word} 的详解', { word: w.word })}
                                style={{ flex: 1 }}
                              >
                                <AppText kind="md" color={theme.colors.brand} numberOfLines={1}>
                                  {w.word}
                                </AppText>
                              </Pressable>
                              <CloseDetailButton
                                onPress={() => setPickedId(null)}
                                label={tr('关闭详解')}
                              />
                            </View>
                          ) : (
                            <AppText
                              kind="md"
                              color={seen ? theme.colors.brand : theme.colors.text}
                              numberOfLines={1}
                            >
                              {w.word}
                            </AppText>
                          )}
                          {/* 收藏按钮在详解面板的右上角（`WordDetail` 自带的 `FavoriteStar`），
                              头部不再重复放一颗 */}
                          {expanded ? <WordDetail word={w} favoriteSource="explore" /> : null}
                        </Card>
                      </View>
                    );
                  })}
                </ScrollView>
              ) : (
                /* 矩形滑动档：**上下分区** —— 上方是矩形词区（比屏幕宽，
                   左右拖动即整块横移，**两端到头即停、不循环**；最右端那一格是「换一批」），
                   **高度由 `WordBoard` 按内容给出**（胶囊与词区上下边界恒为 16px），
                   下方释义区吃掉剩余高度。
                   词区铺满整屏宽并溢出到屏外，由它自己 `overflow: hidden` 裁掉左右两端，
                   所以这一档只有释义区带水平内边距（`pagePadding`）。
                   点一颗词 → 详解就地开在下方释义区里（词区高度不受详解影响）。 */
                <>
                  <WordBoard
                    words={picked}
                    selectedId={pickedId}
                    markedIds={visitedIds}
                    onPick={handlePick}
                    onBackgroundPress={() => setPickedId(null)}
                    endSlot={reshuffleButton}
                  />

                  {/* 下方释义区（吃掉词区之外的剩余高度）：未点词时居中一句提示；点词后**就地铺释义本身** ——
                      外面不套面板（没有那圈「单词 + 收藏 + 关闭」的头行），直接渲染
                      `WordDetail` 的各张词条面板，超出时由它自己的滚动区承担；**无入场动画**（直接呈现）。
                      面板溢出时，滚动区上下沿各压一层渐变遮罩（复用页头那套 `TopFadeMask`）：
                      上沿在词区下沿把滚上去的面板化开、下沿在底栏浮层上方把滚到底的面板化开。
                      收起靠「再点同一颗词」（`handlePick` 第二次点即收起）或点词区空白处。 */}
                  <View
                    style={{
                      flex: 1,
                      paddingTop: BLOCK_GAP,
                      paddingHorizontal: layout.pagePadding,
                    }}
                  >
                    {pickedWord ? (
                      /**
                       * `position: relative` 是给两段渐变遮罩当定位基准：
                       * 遮罩必须贴在**滚动区的裁切边**上（内容正是在这里被切断），
                       * 而不是词区 / 底栏浮层本身的边缘 —— 所以基准取这个 flex:1 的视口，
                       * 它的上边 = 词区下沿（含 `BLOCK_GAP`）、下边 = 底栏浮层上方。
                       */
                      <View
                        style={{ flex: 1, position: 'relative' }}
                        onLayout={(e) => {
                          const h = e.nativeEvent.layout.height;
                          setDetailH((prev) => (Math.abs(prev - h) > 0.5 ? h : prev));
                        }}
                      >
                        <ScrollView
                          style={{ flex: 1 }}
                          showsVerticalScrollIndicator={false}
                          // 详解内部滚动，别把横向拖动传给词区
                          keyboardShouldPersistTaps="handled"
                          contentContainerStyle={{
                            gap: WORD_DETAIL_GAP,
                            // 溢出时上下各垫出渐隐段：静止时第一张 / 最后一张面板整张可见，
                            // 只有滚动中的面板会被遮罩化开（不溢出则一点都不垫）
                            paddingTop: detailScrollable ? DETAIL_FADE : 0,
                            paddingBottom: detailScrollable ? DETAIL_FADE : 0,
                          }}
                          onContentSizeChange={(_w, h) => setDetailContentH(h)}
                        >
                          <WordDetail
                            key={pickedWord.id}
                            word={pickedWord}
                            favoriteSource="explore"
                          />
                        </ScrollView>
                        {detailScrollable ? (
                          <>
                            {/* 上沿：不透明端在上（紧贴词区下沿），向下平滑淡到全透明 */}
                            <TopFadeMask
                              height={DETAIL_FADE}
                              opaqueHeight={0}
                              style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
                            />
                            {/* 下沿：整层竖直镜像 → 不透明端落在底边（底栏浮层上方），向上淡出 */}
                            <TopFadeMask
                              height={DETAIL_FADE}
                              opaqueHeight={0}
                              style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                transform: [{ scaleY: -1 }],
                              }}
                            />
                          </>
                        ) : null}
                      </View>
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <AppText kind="micro" color={theme.colors.textSecondary} align="center">
                          {BOARD_HINT}
                        </AppText>
                      </View>
                    )}
                  </View>
                </>
              )}
            </View>
          )}
        </View>
      </Animated.ScrollView>
    </Screen>
  );
}
