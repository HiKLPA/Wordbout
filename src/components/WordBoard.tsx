import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
} from 'react-native-reanimated';

import { AppText } from '@/components/ui';
import type { WordEntry } from '@/domain/types';
import { trf } from '@/i18n';
import { approxTextWidth } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, stroke, typography } from '@/theme/tokens';

/**
 * 随机探索的「矩形滑动区」（原球面的替代形态）。
 *
 * 形态：一块**比屏幕宽**的矩形词区，词按**蜂窝（六角）排列**铺开 ——
 * 每颗胶囊**宽随词长**（长短不一），按顺序**贪心填满一行再换行**（行数上限 `MAX_ROWS`、
 * 行距 `ROW_GAP`），**奇数行整体右移半个平均节距**（`stagger`），落进上一行的空档里相互咬合，
 * 因此同样的宽度能塞进更多单词（不是单纯造型）。
 * **词区高度由内容决定**：整块蜂窝上下各留 `BOARD_PAD`(16)，行数少则词区跟着变矮。
 * 左右拖动即整块横移；
 * **两端到头即停**（不循环、不回弹），最右端额外留一格放 `endSlot` ——
 * 随机档在这里给「换一批」，滑到底才看得见。
 *
 * 对齐：内容左端留 `layout.pagePadding`（= 主内容区的左右边距），
 * 所以滑到最左端时最左侧那颗胶囊与正文左边线严丝合缝。
 *
 * 实现要点：
 * - 位置存在 reanimated 共享值 `pos`（单位 px，夹在 [0, 词区宽 − 视口宽] 内）；
 * - 拖动是 1:1 直接操作，位移超过 `DRAG_THRESHOLD` 才算滑动（否则留给词的点击），
 *   抬手带惯性（`withDecay` 的 `clamp` 夹到同一区间，滑到头就停住）；
 * - 动画样式在 UI 线程求值，拖动过程不经过 JS 线程、不触发 React 重渲染；
 * - 换了一批词（`words` 换了身份）自动归位到最左端，不用调用方操心。
 */

/** 词区最多排几行 */
const MAX_ROWS = 3;
/** 每颗词胶囊的高度（固定；文字在其中水平 + 垂直居中） */
const PILL_H = 32;
/** 相邻两行之间的竖直间距 */
const ROW_GAP = 16;
/** 相邻两行的竖直节距 = 胶囊高 + 行距 */
const ROW_PITCH = PILL_H + ROW_GAP;
/**
 * 词区的**上下留白**：整块蜂窝与词区上、下边界各留这么多 ——
 * 词区高度 = 蜂窝高 + `BOARD_PAD` × 2（由内容自适应，不再按可用高取固定比例居中）。
 */
const BOARD_PAD = 16;
/** 同一行里相邻两颗胶囊之间的空隙 */
const CELL_GAP = 12;
/**
 * 胶囊内文字的左右内边距：决定「一颗胶囊比它那个词宽多少」。
 * 只留横向 —— 纵向由固定高 `PILL_H` + 文字居中解决，不再靠四边内边距撑开。
 */
const PILL_PAD_X = 12;
/** 位移超过这么多像素才算滑动；否则把手势留给下面的词去做点击 */
const DRAG_THRESHOLD = 4;
/** 最右端「换一批」那一格的预留宽度（按钮是纯文字，够放即可） */
const END_SLOT_W = 80;
/**
 * 抬手后的惯性衰减：每 1/60 秒保留的速度比例（reanimated `rigidDecay` 同源口径）。
 * 越小停得越快；0.9965 ≈ 2.9s 滑停。想「滑一下就停」就调到 0.99 附近。
 */
const DECELERATION = 0.9965;

/**
 * 随机探索的矩形滑动区：`words` 按**蜂窝排列**铺在一个比屏幕宽的矩形里，
 * 左右滑动（两端到头即停），最右端还留一格给 `endSlot`（随机档的「换一批」）。
 * 点一颗词 → 由调用方把详解开在矩形区域**下方**（本组件不负责详解）。
 */
export function WordBoard({
  words,
  selectedId,
  markedIds,
  onPick,
  onBackgroundPress,
  endSlot,
}: {
  words: readonly WordEntry[];
  /** 详解当前打开在这颗词上（无障碍状态用），null = 没有打开 */
  selectedId: string | null;
  /** 点过的词集合：**没看过的**是品牌红实底 + 白字（最跳，提示「这颗还没点」），
      看过的退回面板底 + 红描边 + 红字（红标记一直留着，一眼看出这批里哪些还没看） */
  markedIds: ReadonlySet<string>;
  onPick: (id: string) => void;
  /** 点词区的空白处（不收词：用于收起已展开的详解） */
  onBackgroundPress?: () => void;
  /** 最右端那一格的内容（随机档给「换一批」）：滑到底才露出来 */
  endSlot?: React.ReactNode;
}) {
  const theme = useTheme();
  /** 视口宽度（实测）：排版宽度、总宽与可滑位移都按它算（高度由本组件自己定，不测） */
  const [stageW, setStageW] = useState(0);

  const count = words.length;
  /** 胶囊内文实际字号（含用户字号档位 / 系统缩放）：估宽要用它 */
  const pillFont = theme.size(typography.sm);
  /**
   * 每颗胶囊的宽度 = **它自己那个词的估宽** + 左右内边距：
   * 长短由词本身决定（不再统一成最宽那颗），长短交错才咬得紧密。
   */
  const widths = useMemo(
    () => words.map((w) => approxTextWidth(w.word, pillFont) + PILL_PAD_X * 2),
    [words, pillFont],
  );
  /**
   * 行数上限 = `MAX_ROWS`：词区高度现在**由内容自己决定**（见 `boardH`），
   * 不再从可用高度反推行数，所以这里就是硬上限。
   */
  const maxRows = MAX_ROWS;
  /**
   * 蜂窝的横向错位量 = 这批词**平均节距的一半**（随词宽自适应）：
   * 奇数行整体右移这么多，正好落进上一行两颗胶囊之间的空档，上下两行咬合。
   */
  const stagger = useMemo(
    () => (count ? (widths.reduce((a, b) => a + b, 0) / count + CELL_GAP) / 2 : 0),
    [widths, count],
  );
  /**
   * 贪心排版：按顺序把词填进一行行（行宽 `rowW`，奇数行因错位少 `stagger` 可用），
   * 装不下就另起一行。返回每行装的是哪几颗词。
   */
  const packRows = useCallback(
    (rowW: number) => {
      const out: number[][] = [];
      let cur: number[] = [];
      let curW = 0;
      for (let i = 0; i < count; i += 1) {
        // 奇数行整体右移 `stagger`，所以可用宽少一截
        const cap = rowW - (out.length % 2 ? stagger : 0);
        const next = cur.length ? curW + CELL_GAP + widths[i] : widths[i];
        if (cur.length && next > cap) {
          out.push(cur);
          cur = [i];
          curW = widths[i];
        } else {
          cur.push(i);
          curW = next;
        }
      }
      if (cur.length) out.push(cur);
      return out;
    },
    [count, widths, stagger],
  );
  /**
   * 行宽：先按**主内容区的宽度**试排；词多到 `maxRows` 行装不下时再按需加宽
   * （二分找「刚好排进 `maxRows` 行」的最小行宽），词区于是比屏幕宽、能左右滑。
   * 词少时不硬撑宽度 —— 能一次看见的单词更多。
   */
  const rowW = useMemo(() => {
    if (!count) return 0;
    const widest = Math.max(...widths);
    const base = Math.max(stageW - layout.pagePadding * 2, widest);
    if (packRows(base).length <= maxRows) return base;
    let lo = widest;
    let hi = widths.reduce((a, b) => a + b, 0) + CELL_GAP * (count - 1) + stagger;
    for (let k = 0; k < 24; k += 1) {
      const mid = (lo + hi) / 2;
      if (packRows(mid).length <= maxRows) hi = mid;
      else lo = mid;
    }
    return hi;
  }, [count, widths, stagger, stageW, maxRows, packRows]);

  const packed = useMemo(() => packRows(rowW), [packRows, rowW]);
  /** 实际排出的行数（至少 1 行 —— 词表为空时也留一行的高度） */
  const rows = Math.max(1, packed.length);
  /** 每一行的**右端**相对左内边距的偏移（含奇数行的错位量） */
  const rowRight = packed.map(
    (ids, r) =>
      (r % 2 ? stagger : 0) + ids.reduce((a, i, k) => a + widths[i] + (k ? CELL_GAP : 0), 0),
  );
  /** 内容总宽 = 最靠右那一行的右端 */
  const contentW = Math.max(0, ...rowRight);
  /** 整块内容的竖直高度 = `rows` 行胶囊 + (rows−1) 个行距 */
  const blockH = rows * PILL_H + Math.max(0, rows - 1) * ROW_GAP;
  /** 内容顶端 = 固定留白 `BOARD_PAD`（不再按「剩余高度对半分」居中） */
  const topPad = BOARD_PAD;
  /**
   * 词区高度 = 内容高 + 上下各 `BOARD_PAD`：
   * 胶囊与词区上、下边界**恒为 16px**；行数变少时词区跟着变矮，不是固定比例。
   */
  const boardH = blockH + BOARD_PAD * 2;
  /** 词区总宽 = 左内边距 + 内容 + 右内边距；有「换一批」时再往右接一格 */
  const boardW = layout.pagePadding * 2 + contentW + (endSlot ? CELL_GAP + END_SLOT_W : 0);
  /** 可滑的最大位移 = 词区宽 − 视口宽（词区恒不窄于视口，故 ≥ 0） */
  const maxX = Math.max(0, boardW - stageW);
  const ready = stageW > 0 && count > 0;

  /** 每一颗词的落点（绝对定位）：行内按各自宽度依次排开，奇数行整体右移 `stagger` */
  const placed = useMemo(() => {
    const out: { i: number; x: number; y: number }[] = [];
    packed.forEach((ids, r) => {
      let x = layout.pagePadding + (r % 2 ? stagger : 0);
      const y = topPad + r * ROW_PITCH;
      ids.forEach((i) => {
        out.push({ i, x, y });
        x += widths[i] + CELL_GAP;
      });
    });
    return out;
  }, [packed, widths, stagger, topPad]);

  /** 已滑出的像素：0 = 停在最左端，`maxX` = 滑到最右端 */
  const pos = useSharedValue(0);

  /** 换了一批词（`words` 换了身份）→ 归位到最左端，免得新一批一上来就停在「换一批」那一格上 */
  useEffect(() => {
    cancelAnimation(pos);
    pos.value = 0;
  }, [words, pos]);

  /** 夹到 [0, maxX] 再取负：`pos` 是旧值（词数 / 屏宽刚变）时也不会画出界 */
  const boardStyle = useAnimatedStyle(
    () => {
      const x = Math.min(Math.max(pos.value, 0), maxX);
      return { transform: [{ translateX: -x }] };
    },
    [maxX],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // 位移超过阈值才激活 → 轻点仍然落到词自己的点击上
        .minDistance(DRAG_THRESHOLD)
        .enabled(ready)
        .onChange((e) => {
          // 1:1 跟手：手指左移 = 内容左移；两端硬夹，滑到头再拉也不动
          pos.value = Math.min(Math.max(pos.value - e.changeX, 0), maxX);
        })
        .onEnd((e) => {
          // 抬手带惯性，但整体夹在 [0, maxX]：滑到最右端就停在「换一批」那一格上（不回弹、不循环）
          pos.value = withDecay({
            velocity: -e.velocityX,
            deceleration: DECELERATION,
            clamp: [0, maxX],
          });
        }),
    [pos, ready, maxX],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setStageW((prev) => (Math.abs(prev - w) > 0.5 ? w : prev));
  };

  /**
   * 一颗词：**高固定 `PILL_H`、宽随词长**的胶囊，文字在其中水平 + 垂直居中，
   * 纵向不留内边距；超宽的长词尾部省略（宽度已按估宽留了 `PILL_PAD_X` 的余量）。
   */
  const renderPill = (index: number, x: number, y: number) => {
    const word = words[index];
    const seen = markedIds.has(word.id);
    return (
      <Pressable
        key={word.id}
        onPress={() => onPick(word.id)}
        accessibilityRole="button"
        accessibilityState={{ selected: word.id === selectedId }}
        accessibilityLabel={trf('查看 {word} 的详解', { word: word.word })}
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: widths[index],
          height: PILL_H,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 999,
          // 没看过：品牌红实底（配白字，最跳）；看过的：退回面板底，靠红描边 + 红字标记
          backgroundColor: seen ? theme.colors.surface : theme.colors.brand,
          borderWidth: stroke.base,
          // 描边一律品牌红（线宽恒 0.5px，不加粗）：红底上等于看不见，浅底上就是那道红边
          borderColor: theme.colors.brand,
        }}
      >
        <AppText
          kind="sm"
          color={seen ? theme.colors.brand : theme.colors.brandOn}
          numberOfLines={1}
          style={{ textAlign: 'center' }}
        >
          {word.word}
        </AppText>
      </Pressable>
    );
  };

  return (
    <GestureDetector gesture={pan}>
      {/* collapsable={false}：别让 Android 把这个手势宿主视图优化掉 */}
      {/* 词区高度由内容给出（`boardH`）—— 不再吃父级给的高度，胶囊与上下边界恒为 16px */}
      <View style={{ height: boardH, overflow: 'hidden' }} onLayout={onLayout} collapsable={false}>
        {ready ? (
          <Animated.View
            style={[
              { position: 'absolute', left: 0, top: 0, width: boardW, height: boardH },
              boardStyle,
            ]}
          >
            {/* 词区空白：点一下交给调用方（收起详解）；这一层在最底下，词的点击优先 */}
            {onBackgroundPress ? (
              <Pressable
                onPress={onBackgroundPress}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
              />
            ) : null}
            {placed.map(({ i, x, y }) => renderPill(i, x, y))}
            {/* 最右端那一格：滑到底才露出来的「换一批」，与整块内容竖直居中对齐 */}
            {endSlot ? (
              <View
                style={{
                  position: 'absolute',
                  left: layout.pagePadding + contentW + CELL_GAP,
                  top: topPad,
                  width: END_SLOT_W,
                  height: blockH,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {endSlot}
              </View>
            ) : null}
          </Animated.View>
        ) : null}
      </View>
    </GestureDetector>
  );
}
