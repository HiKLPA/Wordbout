import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { CloseIcon } from '@/components/icons';
import { TopFadeMask } from '@/components/TopFade';
import { AppText } from '@/components/ui';
import type { WordEntry } from '@/domain/types';
import { tr, trf } from '@/i18n';
import { useAccent, useTheme } from '@/theme/ThemeProvider';
import { OVERLAY_FADE_IN, OVERLAY_FADE_OUT, SCRIM, stroke, typography } from '@/theme/tokens';

/** 抽屉从左侧滑入的时长（ms）—— 走完整块面板宽度，需要比原来「只移 25%」更慢一点才不会显得窜 */
const DRAWER_DURATION = 260;
/** 收回（滑回左侧 + 遮罩淡出）的时长（ms）—— 比滑入短，收得干脆 */
const DRAWER_EXIT_DURATION = 180;
/** 面板宽度：屏宽的 82%，最宽 340（窄屏也留出右侧一条可点的遮罩） */
const DRAWER_MAX_W = 340;
const DRAWER_W_RATIO = 0.82;
/**
 * 列表每行 = **一枚高 48 的胶囊**（左英文、右词性，同一行两端对齐），行距 8、内边距 16。
 * 未选中不描边不填色（描边色透明占位，线宽恒 `stroke.base`，切换不抖），当前行整枚填上强调色。
 */
const ROW_H = 48;
const ROW_GAP = 8;
const ROW_PAD = 16;
/** 英文与词性之间的**最小**间隔（词性靠 `marginLeft: 'auto'` 顶到右端，只在词很长时才会吃掉这个间距） */
const WORD_GAP = 8;
/** 编号左对齐，最小宽度给到两位数，三位数（词库百词）自动撑开 */
const INDEX_MIN_W = 20;
/** 列表滚动区上下渐变遮罩的高度（与 `AiHistoryPanel` 的渐隐段同一档） */
const LIST_FADE = 16;
const PANEL_PAD = 16;
/** 单行占位（含行距）：`getItemLayout` 与初始定位都按它算，避免滚动时逐行测量 */
const ITEM_H = ROW_H + ROW_GAP;

/**
 * 单词列表抽屉（FR-T-2）：从左侧边缘滑出，列出词库里的全部单词，
 * 点某一行即跳到那个单词（由调用方记录学习位置），右侧点遮罩或右上角关闭钮收起。
 *
 * 打开时自动把当前所在的单词滚到可视区顶端（超过一屏的词库不用手动找）。
 * 每行 = **胶囊外侧的编号**（左对齐，与胶囊间隔 8）+ **一枚高 48 的胶囊**
 * （英文 18 靠左、词性（如「（n.）」）14 靠右，只列词性不列释义）；
 * 未选中时胶囊无底色无描边，当前行整枚填上强调色、文字统一转 `onAccent`。
 * 滚动区上下沿各压一层与抽屉同色的渐变遮罩，滚出边界的行是化开而不是被硬切。
 *
 * **性能口径**（滑出不能掉帧、不能闪）：
 * ① 位移用 Reanimated 的共享值跑在 **UI 线程**（`useAnimatedStyle` + `withTiming`），JS 线程忙也不卡；
 * ② 位移**走满整块面板宽度**，`progress = 0` 时面板整块在屏幕左外侧 —— 挂载帧 / 卸载帧都不会出现
 *    「半开的面板」（只移 25% 时，挂载先看到大半块面板再滑，收回停在半开处被硬卸载，就是那两下闪）；
 * ③ 面板只动 `translateX`、**不叠 opacity** —— 少一层整块离屏合成，也不会逐帧重绘子树；
 * ④ 列表用 `FlatList` + `getItemLayout` **虚拟化**，打开时只挂首屏十几行（整本词库一次性铺开是掉帧主因），
 *    并靠 `initialScrollIndex` 直接落到当前词，不再「先挂完再 scrollTo」；
 * ⑤ 滑入动作**延后两帧**起跑：一帧给 Modal 挂载、一帧给面板与首屏行布局，动画期间没有新的布局任务插进来。
 */
export function WordListDrawer({
  visible,
  words,
  currentIndex,
  onSelect,
  onClose,
}: {
  visible: boolean;
  /** 词库里的全部单词（顺序即学习顺序） */
  words: WordEntry[];
  /** 当前所在的单词下标，打开时高亮并滚动到它 */
  currentIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  /** 当前词所在行的强调色（默认品牌红；词库详情页整页换品牌黄时跟着变） */
  const { accent, onAccent } = useAccent();
  const { width } = useWindowDimensions();
  const panelW = Math.min(width * DRAWER_W_RATIO, DRAWER_MAX_W);
  /** 面板滑入进度：0 = 完全收起（左移 slide 距离）、1 = 到位（共享值，动画全程在 UI 线程） */
  const progress = useSharedValue(0);
  /**
   * 遮罩自己的淡入淡出值：与面板的滑入滑出**分开跑** ——
   * 时长取全 App 统一的那一对（`OVERLAY_FADE_IN` 160 / `OVERLAY_FADE_OUT` 120），
   * 所以背景比面板 240ms 的滑入更快铺上暗度、比 160ms 的滑出更早亮回去。
   */
  const scrim = useSharedValue(0);
  /**
   * 位移**走满一整块面板宽度**：`progress = 0` 时面板整体落在屏幕左外侧（看不见），
   * 这样挂载那一帧与卸载那一帧都不存在「半开的面板」——原来的写法只移 25%，
   * 面板在动画起跑前就已经露出大半（看着是闪一下再滑），收回时又停在半开位置被硬卸载（闪一下消失）。
   */
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (progress.value - 1) * panelW }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }));
  /**
   * 内部渲染开关：`visible` 落回 false 时**不能立刻卸载** —— 要留着先播完「滑回 + 遮罩淡出」，
   * 播完再真正卸载。调用方只管切 `visible`，收回动画在这里自己收尾。
   */
  const [rendered, setRendered] = useState(visible);
  /** 正在播收回动画：面板与遮罩都不再响应点击（避免收回途中又触发一次 `onClose`） */
  const closing = !visible && rendered;

  useEffect(() => {
    if (visible) setRendered(true);
  }, [visible]);

  useEffect(() => {
    if (!rendered) return undefined;
    /* 收回：面板滑回左侧 + 遮罩淡出（两条并行，都是 UI 线程动画），时长到了才卸载 */
    if (!visible) {
      if (theme.reduceMotion) {
        setRendered(false);
        return undefined;
      }
      progress.value = withTiming(0, { duration: DRAWER_EXIT_DURATION, easing: Easing.in(Easing.cubic) });
      scrim.value = withTiming(0, { duration: OVERLAY_FADE_OUT, easing: Easing.in(Easing.quad) });
      /* 卸载不用动画回调（那要跨线程回 JS），直接等时长 + 一帧余量；重开时 cleanup 会清掉它 */
      const t = setTimeout(() => setRendered(false), DRAWER_EXIT_DURATION + 40);
      return () => clearTimeout(t);
    }
    if (theme.reduceMotion) {
      progress.value = 1;
      scrim.value = 1;
      return undefined;
    }
    /* 滑入：先把进度钉回 0（重开时可能停在半路），再延后两帧起跑 ——
       一帧给 Modal 自己完成挂载、一帧给面板与首屏行完成首次布局，
       动画真正开始时没有新的布局任务插进来，UI 线程也不会被挂载卡住 */
    progress.value = 0;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        progress.value = withTiming(1, { duration: DRAWER_DURATION, easing: Easing.out(Easing.cubic) });
        scrim.value = withTiming(1, { duration: OVERLAY_FADE_IN, easing: Easing.out(Easing.quad) });
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [visible, rendered, theme.reduceMotion, progress, scrim]);

  /**
   * 行：编号在胶囊外侧（左对齐、与胶囊间隔 8），胶囊内英文 18 靠左、词性 14 靠右；
   * 当前行整枚填强调色、文字转 `onAccent`（编号与词性压 72% 留层次）。
   */
  const renderItem = useCallback(
    ({ item: w, index: i }: { item: WordEntry; index: number }) => {
      const current = i === currentIndex;
      const sense = w.senses[0];
      return (
        <Pressable
          onPress={() => onSelect(i)}
          accessibilityRole="button"
          accessibilityState={{ selected: current }}
          accessibilityLabel={trf('第 {n} 个，{word}', { n: i + 1, word: w.word })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: ROW_GAP, marginBottom: ROW_GAP }}
        >
          <AppText
            kind="micro"
            color={current ? accent : theme.colors.textMuted}
            numberOfLines={1}
            style={{ minWidth: INDEX_MIN_W, fontSize: theme.size(typography.tiny) }}
          >
            {String(i + 1)}
          </AppText>
          <View
            style={{
              flex: 1,
              height: ROW_H,
              flexDirection: 'row',
              alignItems: 'center',
              gap: WORD_GAP,
              paddingHorizontal: ROW_PAD,
              borderRadius: 999,
              backgroundColor: current ? accent : 'transparent',
              borderWidth: stroke.base,
              borderColor: 'transparent',
            }}
          >
            <AppText
              kind="md"
              color={current ? onAccent : theme.colors.text}
              numberOfLines={1}
              style={{ flexShrink: 1 }}
            >
              {w.word}
            </AppText>
            {sense?.partOfSpeech ? (
              <AppText
                kind="micro"
                color={current ? onAccent : theme.colors.textSecondary}
                numberOfLines={1}
                style={{
                  /* 只留词性并**右对齐**：`marginLeft: 'auto'` 把它顶到胶囊右端，词性短、英文长时不会挤在一起 */
                  marginLeft: 'auto',
                  fontSize: theme.size(typography.tiny),
                  opacity: current ? 0.72 : 1,
                }}
              >
                {/* 词性直接出原文（如 `n.` / `vt.`），不加括号 */}
                {sense.partOfSpeech}
              </AppText>
            ) : null}
          </View>
        </Pressable>
      );
    },
    [accent, currentIndex, onAccent, onSelect, theme],
  );

  /** 行高固定（含行距），给出后 FlatList 不必逐行测量，`initialScrollIndex` 才能一次落到当前词 */
  const getItemLayout = useCallback(
    (_: ArrayLike<WordEntry> | null | undefined, index: number) => ({
      length: ITEM_H,
      offset: LIST_FADE + index * ITEM_H,
      index,
    }),
    [],
  );

  if (!rendered) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      {/* 铺满整屏的遮罩垫在面板**下面**：面板是从屏外滑过来的，它的落位区在滑到之前是空的，
          如果遮罩只从面板右边缘开始铺，那一带就会先露出一块没被压暗的亮区（看着像「就位处先有底色」）。
          现在整屏统一变暗，面板滑进来只是盖在暗底上。`pointerEvents='none'`，点击交给上面那层。 */}
      <View style={{ flex: 1 }}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, scrimStyle]}>
          <View style={{ flex: 1, backgroundColor: SCRIM }} />
        </Animated.View>

        <View style={{ flex: 1, flexDirection: 'row' }}>
          <Animated.View
            pointerEvents={closing ? 'none' : 'auto'}
            style={[
              {
                width: panelW,
                height: '100%',
                backgroundColor: theme.colors.surface,
                borderRightWidth: stroke.base,
                borderColor: theme.colors.border,
                padding: PANEL_PAD,
                gap: 12,
              },
              panelStyle,
            ]}
          >
            {/* 标题行：左「单词列表」18 + 词数 14，右上角 32×32 热区关闭钮（无底无框，图标 24 取页面强调色） */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flexShrink: 1 }}>
                <AppText kind="md" color={theme.colors.text} numberOfLines={1}>
                  单词列表
                </AppText>
                <AppText
                  kind="micro"
                  color={theme.colors.textMuted}
                  numberOfLines={1}
                  style={{ fontSize: theme.size(typography.tiny) }}
                >
                  {trf('共 {n} 个', { n: words.length })}
                </AppText>
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={tr('关闭')}
                style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
              >
                <CloseIcon size={24} color={accent} />
              </Pressable>
            </View>

            {/* 列表区：上下沿各压一层与抽屉同色的渐变遮罩，滚出边界的行是化开而不是被硬切 */}
            <View style={{ flex: 1 }}>
              <FlatList
                data={words}
                keyExtractor={(w) => w.id}
                renderItem={renderItem}
                getItemLayout={getItemLayout}
                initialScrollIndex={Math.max(0, currentIndex)}
                contentContainerStyle={{ paddingTop: LIST_FADE, paddingBottom: LIST_FADE }}
                showsVerticalScrollIndicator={false}
                initialNumToRender={12}
                maxToRenderPerBatch={8}
                windowSize={5}
              />
              <TopFadeMask
                height={LIST_FADE}
                opaqueHeight={0}
                color={theme.colors.surface}
                style={{ position: 'absolute', left: 0, right: 0, top: 0 }}
              />
              {/* 底部遮罩：同一张遮罩翻 180°，实底落到底边、向上淡出 */}
              <TopFadeMask
                height={LIST_FADE}
                opaqueHeight={0}
                color={theme.colors.surface}
                style={{ position: 'absolute', left: 0, right: 0, bottom: 0, transform: [{ scaleY: -1 }] }}
              />
            </View>
          </Animated.View>

          {/* 点击区：只占面板右侧那一条（点它收起），自身透明，暗度由下面那层全屏遮罩给 */}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={tr('关闭')}
            pointerEvents={closing ? 'none' : 'auto'}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </Modal>
  );
}
