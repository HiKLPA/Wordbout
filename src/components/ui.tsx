import { useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { HintIcon, StarIcon } from '@/components/icons';
import { renderScriptChildren } from '@/components/ScriptText';
import { TopFadeMask } from '@/components/TopFade';
import { localize, tr } from '@/i18n';
import { trackTap } from '@/lib/analytics';
import { approxTextWidth, type FontWeightKey } from '@/theme/fonts';
import { cjkFontOf, useAccent, useTheme, useTypography, type TextKind } from '@/theme/ThemeProvider';
import { layout, opacity, stroke, typography } from '@/theme/tokens';

export type { TextKind };

/** 装饰性红条的统一规格：小节标题（SectionTitle）上方的横条 */
const ACCENT_BAR_WIDTH = 32;
const ACCENT_BAR_HEIGHT = 4;
/** 小节标题上方横条与标题文字之间的纵向间距 */
const ACCENT_BAR_TITLE_GAP = 0;
/** 小节标题里「图标 ↔ 标题文字」的横向间距（图标与上方横条同宽 32） */
const SECTION_TITLE_ICON_GAP = 8;

/**
 * 页面顶部留白的唯一定义（全 App 统一，含一级页面与二级页面）。
 * 首块内容距「顶部安全区下沿」的距离 = SCREEN_TOP_GAP，不能再由页面各写各的 topExtra，
 * 否则一级页面 / 二级页面顶部永远对不齐。要整体调整，只改这一个数。
 */
export const SCREEN_TOP_GAP = 24;

/**
 * **文字型首块的行盒上方 leading 补偿（2026-10-09）**：
 * 首块若是**裸文字**（练习页的 32px 大标题、二级页的页头标题），
 * 行盒顶端到字面之间还空着约 8px（半行距 + 字体上沿留白）；
 * 而卡片 / 胶囊 / 通栏 banner 这类「清晰上边缘」没有这段空档。
 * 所以文字型首块要在 SCREEN_TOP_GAP 上**减掉**它，字面顶部才与其它页对齐。
 * 用途：`SCREEN_HEADER_TOP_GAP`（二级页页头）与练习页 `PRACTICE_HEADER_TOP_GAP`。
 */
export const SCREEN_TEXT_LEADING = 8;

/**
 * 固定页头的三段尺寸：
 * - TOP_GAP：页头距顶部安全区下沿的距离。页头首行是**文字**，故按文字型首块的规则
 *   = `SCREEN_TOP_GAP - SCREEN_TEXT_LEADING`(16) —— 与练习页大标题、课本页正文的字面顶对齐，
 *   一级页面与二级页面的顶部因此一致。
 * - GAP：页头与下方第一块滚动内容之间的间距（页头不在滚动区里，所以不走 contentStyle.gap）。
 * - FADE：遮罩实底之下继续淡出的长度，让滑过的内容渐变隐去，而不是被硬切一刀。
 *   练习页「能力趋势」页签里，统计范围四档是页内顶部钉住的一行（不在页头里），
 *   它下方那层同长度的渐变遮罩也复用这个值，全 App 的淡出长度只有这一处。
 */
const SCREEN_HEADER_TOP_GAP = SCREEN_TOP_GAP - SCREEN_TEXT_LEADING;
export const SCREEN_HEADER_GAP = 16;
export const SCREEN_HEADER_FADE = 16;
/** 页头首帧尚未量到高度时的估计值（一行标题 + 可选副行的中位高度） */
const SCREEN_HEADER_ESTIMATE = 34;

interface AppTextProps {
  children: React.ReactNode;
  kind?: TextKind;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  align?: 'left' | 'center' | 'right' | 'justify';
  /** 覆盖该档默认字重（如字号 24 的 lg 档改用 regular），中英文同时生效 */
  weight?: FontWeightKey;
  /** 无障碍标签，供屏幕阅读器读出（NFR-7） */
  accessibilityLabel?: string;
  accessibilityRole?: 'header' | 'text' | 'button' | 'link';
}

export function AppText({
  children,
  kind = 'body',
  color,
  style,
  numberOfLines,
  align,
  weight,
  accessibilityLabel,
  accessibilityRole,
}: AppTextProps) {
  const theme = useTheme();
  const type = useTypography();
  const style_ = type(kind, weight);
  return (
    <Text
      numberOfLines={numberOfLines}
      accessibilityLabel={accessibilityLabel ? tr(accessibilityLabel) : undefined}
      accessibilityRole={accessibilityRole ?? (kind === 'xl' || kind === 'lg' ? 'header' : 'text')}
      maxFontSizeMultiplier={1.6}
      allowFontScaling
      style={[style_, { color: color ?? theme.colors.text }, align ? { textAlign: align } : null, style]}
    >
      {/* 界面文案在渲染处按当前语言就地翻译（NFR-8），业务数据原样透传；
          再按脚本分流字体：英文/数字 Barlow、汉字思源黑体 */}
      {renderScriptChildren(localize(children), style_.fontFamily, cjkFontOf(kind, weight))}
    </Text>
  );
}

/** 页面容器：统一背景、左右内边距、顶部留白（SCREEN_TOP_GAP）与底部悬浮导航留白 */
export function Screen({
  children,
  scroll = true,
  padded = true,
  contentStyle,
  style,
  bottomExtra = 0,
  scrollEnabled = true,
  header,
  headerTopGap,
  headerMaskGap = 0,
  footer,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  bottomExtra?: number;
  /** 是否允许上下滚动。拖动排序这类「手指按住不放」的交互期间要置 false，避免与滚动抢手势 */
  scrollEnabled?: boolean;
  /**
   * 固定在顶部留白区内的页头（返回箭头 + 标题，通常直接传 <PageHeader />）。
   * 它渲染在滚动区之外，因此上下滑动页面时始终停住不动；
   * 其下沿带渐变遮罩，滚动内容从它下面滑过时是淡出而不是被硬切。
   */
  header?: React.ReactNode;
  /**
   * 页头距安全区下沿的距离。默认 `SCREEN_HEADER_TOP_GAP`（= `SCREEN_TOP_GAP - SCREEN_TEXT_LEADING` 16），
   * 一级页面与二级页面共用同一条文字对齐规则，字面顶部一致。
   * 仅当页头是整块顶部主内容、需要单独微调时才显式传（如主页 `+ HOME_TOP_EXTRA`），
   * 其余情况不要传，避免又变成各页各写一个顶部留白。
   */
  headerTopGap?: number;
  /**
   * 遮罩实底在页头下沿之下继续延伸的长度（渐变的起点随之下降）。
   * 默认 0：渐变就起在页头下沿。页头是整块固定区（首页 / 课本 / 探索 / 更多）时传 SCREEN_HEADER_GAP，
   * 让渐变从「固定区最后一行之下 16px」才开始，其下留出一段干净底色。
   * 练习页不传：它页头下沿紧接的就是「统计范围四档」/ 正文，「+16 才起淡出」会把这 16px
   * 压到下面那行上，所以淡出段从四档下沿直接起（正好占满四档与正文之间的空隙）。
   */
  headerMaskGap?: number;
  /** 固定在屏幕上的浮层（不随内容滚动），通常用绝对定位贴在底部；已由 bottomPad 预留留白 */
  footer?: React.ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = layout.barBottom + layout.barHeight + 24 + bottomExtra + insets.bottom;
  const scrollRef = React.useRef<ScrollView>(null);
  /** 用 RN ScrollView 自带的「把输入框滚到键盘上方」，双端都走同一条原生逻辑 */
  const scrollController = React.useMemo<ScreenScrollController>(
    () => ({
      keepVisible: (input, additionalOffset = 24) => {
        const responder = scrollRef.current as unknown as {
          scrollResponderScrollNativeHandleToKeyboard?: (
            handle: unknown,
            offset?: number,
            preventNegativeScrollOffset?: boolean,
          ) => void;
        } | null;
        responder?.scrollResponderScrollNativeHandleToKeyboard?.(input, additionalOffset, true);
      },
    }),
    [],
  );
  /**
   * 固定页头是「浮」在滚动区上方的一层，所以要先知道它多高：
   * 内容顶部要让出这一段（否则首屏内容会被页头压住），遮罩也要照着它铺。
   * 用 onLayout 实测而不是写死，标题行/副行/右侧插槽任意组合都能对。
   */
  const [headerBoxH, setHeaderBoxH] = React.useState(0);
  const headerPadTop = insets.top + (headerTopGap ?? SCREEN_HEADER_TOP_GAP);
  const headerBoxTop = headerBoxH > 0 ? headerBoxH : headerPadTop + SCREEN_HEADER_ESTIMATE;
  /**
   * 页头高度要等挂载后的 onLayout 才知道，首帧只能按估计值排版。
   * 若页头很高（如练习页顶部整块），首帧正文会明显错位再跳一下：量到之前先不显示正文，
   * 只留正确位置的页头和主题底色，跳变就看不出来了。
   */
  const bodyHidden = Boolean(header) && headerBoxH <= 0;
  /** 遮罩实底段（页头下沿 + headerMaskGap）与总高（实底段 + 下沿淡出的一段） */
  const maskOpaqueH = headerBoxTop + headerMaskGap;
  const maskHeight = maskOpaqueH + SCREEN_HEADER_FADE;
  /**
   * 正文起点 = 遮罩实底段下沿 + SCREEN_HEADER_GAP。
   * headerMaskGap = 0（二级页面页头）时就是「页头下沿 + 16」，与原先一致；
   * 整块固定区（练习页，headerMaskGap = 16）时正文随之下移 16，
   * 于是按钮下方留出一段干净底色，正文首项仍落在淡出段的同一相对位置（观感不变）。
   */
  const bodyTopPad = header ? maskOpaqueH + SCREEN_HEADER_GAP : insets.top + SCREEN_TOP_GAP;
  /** 页头层：实底遮罩（下沿 smoothstep 淡出，不是硬切）+ 页头本身，整体不随内容滚动 */
  const headerNode = header ? (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
      <TopFadeMask height={maskHeight} opaqueHeight={maskOpaqueH} style={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
      <View
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          setHeaderBoxH((prev) => (Math.abs(prev - h) > 0.5 ? h : prev));
        }}
        style={{
          paddingTop: headerPadTop,
          paddingHorizontal: padded ? layout.pagePadding : 0,
        }}
      >
        {header}
      </View>
    </View>
  ) : null;
  if (!scroll) {
    return (
      <View style={[{ flex: 1, backgroundColor: theme.colors.bg }, style]}>
        <View
          style={[
            {
              flex: 1,
              paddingTop: bodyTopPad,
              paddingHorizontal: padded ? layout.pagePadding : 0,
              opacity: bodyHidden ? 0 : 1,
            },
            contentStyle,
          ]}
        >
          {children}
        </View>
        {/* 页头层＝「实底 + 下沿淡出」的一层；没有页头的页面不再铺任何顶部遮罩 */}
        {headerNode}
        {footer}
      </View>
    );
  }
  return (
    <ScreenScrollContext.Provider value={scrollController}>
      <View style={[{ flex: 1, backgroundColor: theme.colors.bg }, style]}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1, opacity: bodyHidden ? 0 : 1 }}
          scrollEnabled={scrollEnabled}
          contentContainerStyle={[
            {
              paddingTop: bodyTopPad,
              paddingBottom: bottomPad,
              paddingHorizontal: padded ? layout.pagePadding : 0,
            },
            contentStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          // iOS：键盘弹出时自动内缩，让内容还能继续往上滑
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        {/* 页头层＝「实底 + 下沿淡出」的一层；没有页头的页面不再铺任何顶部遮罩 */}
        {headerNode}
        {footer}
      </View>
    </ScreenScrollContext.Provider>
  );
}

/** Screen 的滚动控制器：供页面把正在编辑的输入框滚到键盘上方 */
type ScreenScrollController = {
  /** 把某个输入框节点滚到键盘上方（RN ScrollView 原生能力，双端可用） */
  keepVisible: (input: unknown, additionalOffset?: number) => void;
};

const ScreenScrollContext = React.createContext<ScreenScrollController | null>(null);

/** 取当前页面（Screen）的滚动控制器；不在可滚动 Screen 内时为 null */
export function useScreenScroll() {
  return React.useContext(ScreenScrollContext);
}

/** 区块标题：32x4 品牌红短线（与标题的纵向间距见 ACCENT_BAR_TITLE_GAP） + ExtraBold 大字标题（Figma Title/*）。
 *  可选 `icon` 渲染在标题文字左侧（板块用听 / 写 / 说 / 读 / 译图标，32×32）。
 *  板块标题已改用 32×32 图标做前缀，故传 `showBar={false}` 去掉上方短线（图标顶替短线，避免重复）。 */
export function SectionTitle({
  label,
  icon,
  showBar = true,
  barColor,
  style,
}: {
  label: string;
  /** 标题左侧的可选图标（如板块的听 / 写 / 说 / 读 / 译），建议 32×32、取 `colors.brand` */
  icon?: React.ReactNode;
  /** 是否显示标题上方的 32×4 品牌红短线。默认 true；板块标题改用 32×32 图标做前缀时传 false（图标顶替短线，避免重复） */
  showBar?: boolean;
  /** 横条颜色。默认品牌红；个别分区要换色时传它（课本页「热门」走品牌黄） */
  barColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View style={[{ gap: ACCENT_BAR_TITLE_GAP }, style]}>
      {showBar ? (
        <View
          style={{
            width: ACCENT_BAR_WIDTH,
            height: ACCENT_BAR_HEIGHT,
            borderRadius: 2,
            backgroundColor: barColor ?? theme.colors.brand,
          }}
        />
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SECTION_TITLE_ICON_GAP }}>
        {icon}
        <AppText kind="xl" color={theme.colors.text} numberOfLines={1} style={{ flexShrink: 1 }}>
          {label}
        </AppText>
      </View>
    </View>
  );
}

/**
 * 内描边组件已在其复原要求下移除（2026-09-30 第二轮）：
 * 全 App 恢复普通描边 —— 直接在元素自身写 `borderWidth` / `borderColor`，
 * 不再用绝对定位的叠层。`stroke.base`（0.5px）仍是唯一线宽来源。
 */

export function Card({
  children,
  style,
  onPress,
  accessibilityLabel,
  strokeColor,
  strokeWidth,
  strokeStyle,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** 描边颜色。默认 colors.border（浅 #FFFFFF / 深 #3A3A3A）；需要品牌红（当前题库 / 单词卡）等强调态时传它 */
  strokeColor?: string;
  /** 描边粗细。默认 stroke.base（全 App 统一 0.5px） */
  strokeWidth?: number;
  /** 描边线型。默认实线；「新建收藏夹」这类占位卡传 'dashed' */
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
}) {
  const theme = useTheme();
  const base: StyleProp<ViewStyle> = [
    {
      borderRadius: layout.cardRadius,
      backgroundColor: theme.colors.surface,
      overflow: 'hidden',
      borderWidth: strokeWidth ?? stroke.base,
      borderStyle: strokeStyle ?? 'solid',
      borderColor: strokeColor ?? theme.colors.border,
    },
    style,
  ];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ? tr(accessibilityLabel) : undefined}
      style={base}
    >
      {children}
    </Pressable>
  );
}

/**
 * 题型行（Figma Exercise/Listening 的 pill：370x48，圆角 999，fill #f5f5f5，右侧 Hint 箭头）。
 * 底色 / 描边与卡片完全同源（`colors.surface` + `colors.border` 0.5px），**不用品牌红**；
 * 卡内文字（题型名 + 小注释）一律 `colors.text`，右侧箭头退到 `colors.textMuted`
 * （箭头只是「可进入」的示意，不作强调）。文字纵向居中、横向左对齐。
 */
export function ExercisePill({
  label,
  hint,
  onPress,
  selected,
  accessibilityLabel,
}: {
  label: string;
  hint?: string;
  onPress?: () => void;
  selected?: boolean;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={tr(accessibilityLabel ?? label)}
      accessibilityState={{ selected: !!selected }}
      style={{
        minHeight: layout.pillHeight,
        borderRadius: 999,
        // 题型 pill 与卡片同款：surface 实色底 + colors.border 描边（不再是品牌红底）；
        // 选中态只体现在无障碍状态上（线宽全 App 统一 0.5px，不再加粗）
        backgroundColor: theme.colors.surface,
        borderWidth: stroke.base,
        borderColor: theme.colors.border,
        paddingHorizontal: 18,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <View style={{ flexShrink: 1 }}>
        {/* 题型名 18px（md 档 + regular 字重，与一级菜单同字号）；小注释与主文字同色 */}
        <AppText kind="md" weight="regular" color={theme.colors.text} numberOfLines={1}>
          {label}
        </AppText>
        {hint ? (
          <AppText kind="micro" color={theme.colors.text} numberOfLines={1}>
            {hint}
          </AppText>
        ) : null}
      </View>
      {/* 右侧箭头取品牌红：它不是可点的独立元素，只是「可进入」的示意 */}
      <HintIcon size={18} color={theme.colors.brand} />
    </Pressable>
  );
}

/** 档位胶囊之间的间距（普通换行行内 / 网格两用） */
const CHIP_GAP = 8;

/** 可配置档位选择（时长门槛 / 任务数门槛 / 探索力度 / 字号）；scroll=true 时单行横向滑动；stretch=true 时各档平分整行宽度；columns=n 时排成每排 n 枚的网格、各枚等宽 */
export function OptionChips<T extends string | number>({
  options,
  value,
  onChange,
  labelOf,
  iconOf,
  a11yLabelOf,
  accessibilityLabel,
  scroll = false,
  stretch = false,
  columns,
  height,
  labelKind = 'sm',
  plainInactive = false,
  joined = false,
  inactiveColor,
  background,
  loadingValue,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labelOf?: (v: T) => string;
  /** 视觉元素改用图标代替文字（返回 null / undefined 时该档仍显示文字）；`labelOf` 同时作为该档的无障碍名 */
  iconOf?: (v: T) => React.ReactNode;
  /**
   * 该档**无障碍名**（不传则用 `labelOf` / `String(v)`）。
   * 用于「屏幕上只写 `10`、读屏时念成 `10 个`」这类显示与朗读口径不同的档位。
   */
  a11yLabelOf?: (v: T) => string;
  accessibilityLabel?: string;
  scroll?: boolean;
  /** 各档平分整行宽度、单行不换行（档位少时用） */
  stretch?: boolean;
  /**
   * **合并成一枚胶囊**：各档不再各占一枚带描边的胶囊，而是同处一枚胶囊内的等分段
   * （外面只描一次 0.5px 边）。选中态**不改背景色**，只把该段的内容（图标 / 文字）
   * 本身染成品牌红 —— 与「深浅色模式 / 字号」那类实底胶囊不同，适合底栏里并排的
   * 「显示方式 / 数量」这类轻量档位。需与 `height` 同时给（容器高度由它定死）。
   */
  joined?: boolean;
  /** 网格列数（至少 2）：每排 `columns` 枚、各枚等宽并自动换行；设置后忽略 `scroll` / `stretch` */
  columns?: number;
  /** 胶囊固定高度（如弹窗内的紧凑档位）：设了就不再用纵向内边距撑高，文字垂直居中 */
  height?: number;
  /** 档位文字字号档（默认 `sm` 16；需要更紧凑的胶囊时可传 `tiny` 14） */
  labelKind?: TextKind;
  /** 未选中态不铺底、不描边（只靠同样式的文字与选中项区分）；设置页的字号 / 深浅色 / 语言档位用它 */
  plainInactive?: boolean;
  /**
   * 未选中档位的**内容颜色**（不传则用正文色 `colors.text`）。
   * 用于把未选中项整体弱化一档 —— 如设置页那三组「不铺底」档位统一用 `colors.textSecondary`。
   * 只影响文字档；图标档的颜色由调用方在 `iconOf` 里自行决定（需要同色就取同一个值）。
   */
  inactiveColor?: string;
  /**
   * **合并胶囊的实底**（只对 `joined` 生效，不传则用面板底色 `colors.surface`）。
   * 贴在底栏正上方的浮层传 `colors.barBackground`，让胶囊与底栏同底、看起来像同一条家具。
   */
  background?: string;
  /**
   * 正在忙的那一档（如「切过去正在查」的词典）：**在这一档自己的胶囊里**把文字换成一枚转圈，
   * 忙完自动换回原文字。转圈占位与文字行高同高，切换时整排不会跳一下。
   * 不传 / 传 undefined = 没有档位在忙（图标档位不受影响，仍显示图标）。
   */
  loadingValue?: T;
}) {
  const theme = useTheme();
  const type = useTypography();
  const grid = !!columns && columns > 1;
  /** 单枚档位的无障碍名：优先 `a11yLabelOf`，其次显示用的 `labelOf`，兜底 `String(v)` */
  const chipName = (opt: T) => (a11yLabelOf ?? labelOf)?.(opt) ?? String(opt);
  /** 这一档是否正在忙（`loadingValue`）：忙的档位内里换成转圈，并给读屏报 busy */
  const chipBusy = (opt: T) => loadingValue !== undefined && opt === loadingValue;

  /**
   * 单枚档位的内里：**图标 > 加载转圈 > 文字**，三选一。
   * 转圈按 `labelKind` 的行高占位（`height` 写死），所以「文字 ↔ 转圈」互换时胶囊高度不变。
   * 颜色跟随该档的状态：选中档用调用方给的选中色（实底胶囊是白字、合并胶囊是品牌红），
   * 未选中档用 `inactiveColor`（不传则正文色）。
   */
  const chipInner = (opt: T, active: boolean, activeColor: string) => {
    const icon = iconOf?.(opt);
    if (icon) return icon;
    const color = active ? activeColor : (inactiveColor ?? theme.colors.text);
    if (chipBusy(opt)) {
      return (
        <View
          style={{
            height: type(labelKind).lineHeight ?? theme.size(typography.sm),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator size="small" color={color} />
        </View>
      );
    }
    return (
      <AppText kind={labelKind} color={color} numberOfLines={1}>
        {labelOf ? labelOf(opt) : String(opt)}
      </AppText>
    );
  };

  /**
   * 单枚档位胶囊（含选中态）。形态微调：
   * - 网格（`columns`）：`flex: 1` 撑满所在格、文字居中；
   * - `stretch`：各档平分整行宽度、横向内边距收到 4（把省下的空间还给文字，长档位窄屏也能单行放下）。
   */
  const renderChip = (opt: T) => {
    const active = opt === value;
    return (
      <Pressable
        key={String(opt)}
        onPress={() => onChange(opt)}
        accessibilityRole="button"
        accessibilityState={{ selected: active, busy: chipBusy(opt) }}
        /* 图标档位没有文字可读，无障碍名一律取 `chipName`（未传 iconOf / a11yLabelOf 时与旧行为等价） */
        accessibilityLabel={tr(chipName(opt))}
        style={[
          {
            /* 档位选择器的原始胶囊内边距（横 14 / 纵 8，与分区切换按钮的 SEGMENT_PADDING 各自独立）；
               传了 height 时高度由外部定死（纵向内边距归零、内容居中），用于弹窗里的紧凑档位 */
            paddingHorizontal: 14,
            paddingVertical: height ? 0 : 8,
            borderRadius: 999,
            backgroundColor: active ? theme.colors.brand : plainInactive ? 'transparent' : theme.colors.surface,
            /* 描边线宽两态一致（0.5px）—— 只把颜色置透明来表示「没有描边」，
               否则选中 / 未选中的盒模型差 1px，切换档位时整排会跳一下 */
            borderWidth: stroke.base,
            borderColor: active ? theme.colors.brand : plainInactive ? 'transparent' : theme.colors.border,
          },
          height ? { height, justifyContent: 'center' } : null,
          grid || stretch ? { flex: 1, alignItems: 'center' } : null,
          stretch ? { paddingHorizontal: 4 } : null,
        ]}
      >
        {chipInner(opt, active, theme.colors.brandOn)}
      </Pressable>
    );
  };

  const a11y = accessibilityLabel ? tr(accessibilityLabel) : undefined;
  if (joined) {
    /* 合并胶囊：外层一枚胶囊（0.5px 描边 + 实底（默认 surface，可由 `background` 覆盖）+ 裁掉溢出），
       内部各档等分整宽、各自可点。
       选中态只用**内容本身的颜色**表示（图标 / 文字转品牌红），底色两态一致不铺色。 */
    return (
      <View
        accessibilityLabel={a11y}
        style={{
          flexDirection: 'row',
          height,
          borderRadius: 999,
          borderWidth: stroke.base,
          borderColor: theme.colors.border,
          backgroundColor: background ?? theme.colors.surface,
          overflow: 'hidden',
        }}
      >
        {options.map((opt) => {
          const active = opt === value;
          return (
            <Pressable
              key={String(opt)}
              onPress={() => onChange(opt)}
              accessibilityRole="button"
              accessibilityState={{ selected: active, busy: chipBusy(opt) }}
              /* 图标档位没有文字可读，无障碍名一律取 `chipName`（未传 iconOf / a11yLabelOf 时与文字档位等价） */
              accessibilityLabel={tr(chipName(opt))}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {chipInner(opt, active, theme.colors.brand)}
            </Pressable>
          );
        })}
      </View>
    );
  }
  if (grid) {
    /* 等宽网格：按每排 `columns` 枚切行，行内各枚 `flex: 1` 平分整宽；
       末排不足时补等宽空位（不进无障碍树），保证每枚与满排同宽（不会被拉伸成半屏）。 */
    const n = columns as number;
    const rows: T[][] = [];
    for (let i = 0; i < options.length; i += n) rows.push(options.slice(i, i + n) as T[]);
    return (
      <View style={{ gap: CHIP_GAP }} accessibilityLabel={a11y}>
        {rows.map((row, r) => (
          <View key={r} style={{ flexDirection: 'row', gap: CHIP_GAP }}>
            {row.map(renderChip)}
            {Array.from({ length: n - row.length }, (_, k) => (
              <View key={`spacer-${k}`} style={{ flex: 1 }} />
            ))}
          </View>
        ))}
      </View>
    );
  }
  if (scroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -layout.pagePadding }}
        contentContainerStyle={{
          gap: CHIP_GAP,
          paddingHorizontal: layout.pagePadding,
          alignItems: 'center',
        }}
        accessibilityLabel={a11y}
      >
        {options.map(renderChip)}
      </ScrollView>
    );
  }
  return (
    <View
      style={{ flexDirection: 'row', flexWrap: stretch ? 'nowrap' : 'wrap', gap: CHIP_GAP }}
      accessibilityLabel={a11y}
    >
      {options.map(renderChip)}
    </View>
  );
}

/**
 * 分区切换按钮（`SegmentedTabs`）的上下内边距：练习页「练习 / 测验 / 错题」、收藏夹
 * 「A-Z / 词性 / 时序 / 详解」、练习播放条里的倍速胶囊（外壳同高）共用。
 * **不写死高度** —— 高 = 文字行高 + 上下各 8 + 0.5px 描边，随字号档位自然变化。改这一个数即可。
 */
export const SEGMENT_PADDING = 8;

/**
 * 分区切换按钮里**只显示图标**时的图标尺寸（取 24 = 文字 md 档的行高，
 * 于是图标版与文字版的胶囊高度完全一致，仍是「行高 + 上下各 8 + 描边」）。
 */
const SEGMENT_ICON = 24;

/** 无壳（`bare`）形态下，选中图标相对未选中的放大倍数（「稍微变大」） */
const SEGMENT_ICON_ACTIVE_SCALE = 1.18;

/**
 * 无壳形态（`bare`）下的分段图标：选中 / 未选中之间做一段连贯的过渡动画 ——
 * 图标颜色由正文色渐变为品牌红、同时整体轻微放大。
 *
 * - 用两根图层（未选中色在下、品牌红在上）交叉淡化来过渡颜色，
 *   所以缩放与淡入淡出都能走原生驱动（`useNativeDriver`），不掉帧；
 * - 未选中图层的透明度恒为 1 打底，省去「透明时点击热区消失」的问题；
 * - 弹簧参数偏「活泼但不夸张」：到位快、尾部只留极小回弹。
 */
function SegmentIconMotion({
  Icon,
  active,
  activeColor,
  inactiveColor,
}: {
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  active: boolean;
  activeColor: string;
  inactiveColor: string;
}) {
  const p = React.useRef(new Animated.Value(active ? 1 : 0)).current;
  React.useEffect(() => {
    Animated.spring(p, {
      toValue: active ? 1 : 0,
      useNativeDriver: true,
      speed: 20,
      bounciness: 9,
    }).start();
  }, [active, p]);
  const scale = p.interpolate({ inputRange: [0, 1], outputRange: [1, SEGMENT_ICON_ACTIVE_SCALE] });
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      {/* 底层：未选中色，选中进程越高越淡出 */}
      <Animated.View style={{ opacity: p.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}>
        <Icon size={SEGMENT_ICON} color={inactiveColor} />
      </Animated.View>
      {/* 顶层：品牌红，与底层完全重叠，随选中进程淡入 */}
      <Animated.View style={{ position: 'absolute', opacity: p }}>
        <Icon size={SEGMENT_ICON} color={activeColor} />
      </Animated.View>
    </Animated.View>
  );
}

/**
 * **跟手形态**（`pos`）下的分段图标：选中进度不来自「选中 / 未选中」布尔量，
 * 而是直接由**档位位置** `pos` 插值 —— 第 i 枚图标的进度
 * `f = max(0, 1 - |i - pos|)`（pos 落在哪一档，那一档就是 1；落在两档之间就是两者交叉淡化）。
 *
 * `pos` 是共享值、三根样式都在 UI 线程上求值，所以图标能**逐帧跟着手指位移**连续变色 / 放大，
 * 不经过 React 渲染、不掉帧；拖动松手后的落位动画（`withTiming` 写 `pos`）也照样带着图标走。
 */
function SwipeIconMotion({
  Icon,
  index,
  pos,
  activeColor,
  inactiveColor,
}: {
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  /** 该图标对应的档位序号（0 起） */
  index: number;
  /** 档位位置：单位 = 档位，可为小数（拖动中就在两档之间） */
  pos: SharedValue<number>;
  activeColor: string;
  inactiveColor: string;
}) {
  /* 三根样式各自内联同一段进度计算：worklet 里不调外部普通函数，免得求值跑到 JS 线程 */
  const box = useAnimatedStyle(() => {
    const f = Math.max(0, Math.min(1, 1 - Math.abs(index - pos.value)));
    return { transform: [{ scale: 1 + (SEGMENT_ICON_ACTIVE_SCALE - 1) * f }] };
  });
  const rest = useAnimatedStyle(() => ({
    opacity: 1 - Math.max(0, Math.min(1, 1 - Math.abs(index - pos.value))),
  }));
  const lit = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(1, 1 - Math.abs(index - pos.value))),
  }));
  return (
    <Reanimated.View style={box}>
      {/* 底层：未选中色，进度越高越淡出 */}
      <Reanimated.View style={rest}>
        <Icon size={SEGMENT_ICON} color={inactiveColor} />
      </Reanimated.View>
      {/* 顶层：品牌红，与底层完全重叠，随进度淡入 */}
      <Reanimated.View style={[{ position: 'absolute' }, lit]}>
        <Icon size={SEGMENT_ICON} color={activeColor} />
      </Reanimated.View>
    </Reanimated.View>
  );
}

/**
 * 顶部横向切换（Figma Frame 15：练习 / 测验 / 错题）；收藏夹的四种查看方式共用同一套样式。
 *
 * 两种形态（`variant`）：
 * - `pill`（默认）：胶囊按钮 —— 选中 = 品牌红实底 + `brandOn` 文字；
 *   **未选中 = 无壳**（无底色、无描边，只有正文色文字，2026-10-17 由「透明底 + 灰描边」改）：
 *   一排里只有当前那档是实心的，其余像普通文字，视觉噪音小一截。
 *   描边宽度仍恒为 `stroke.base`（未选中只是透明），所以两种状态外形、高度完全一致，切换不跳。
 * - `text`：纯文字 —— 没有任何底色/描边/圆角/下划线，只有文字本身，
 *   选中 = 品牌红文字，未选中 = 弱化文字色（`textMuted`）。
 *
 * 传 `bare` 时**两种状态都不带底色与描边**（胶囊彻底消失）：选中只靠「图标变品牌红 +
 * 稍微放大」来表达，且颜色与缩放都走一段连贯动画（练习页顶部四档用）。
 * 再传 `pos` 时改用**跟手形态**：选中进度直接取档位位置插值，可以跟着左右拖动逐帧变化
 * （见 `SwipeIconMotion`）。
 *
 * 不带任何横条或下划线指示。
 * 文字 18px（md）。各标签等分整行宽度、首尾贴住左右边界（按钮两端对齐），**不横向滚动**
 * ——练习页三档各占三分之一（间距 16），收藏夹四档各占四分之一。
 * 高度**不写死**：文字行高 + 上下各 `SEGMENT_PADDING = 8` + 0.5px 描边（默认档位约 42）。
 */
export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  variant = 'pill',
  gap = 8,
  bare = false,
  pos,
  accessibilityLabel,
}: {
  /**
   * 各段：`label` 是文案（也是无障碍名）；给了 `icon` 就**只渲染图标、不渲染文字**，
   * 图标颜色随选中态自动切（选中 `brandOn` / 未选中 `text`）。
   */
  items: { key: T; label: string; icon?: React.ComponentType<{ size?: number; color?: string }> }[];
  value: T;
  onChange: (k: T) => void;
  /** 胶囊按钮 / 纯文字，默认胶囊 */
  variant?: 'pill' | 'text';
  /** 标签之间的横向间距（默认 8；练习页三档用 16），各标签仍等分整行宽度 */
  gap?: number;
  /**
   * 无壳形态：选中 / 未选中**都不显示底色与描边**，只剩图标 / 文字本身（练习页顶部四档用）。
   * 描边仍占位（只是透明），所以两种状态的外形、高度完全一致，切换时不跳动；
   * 选中只靠「图标变品牌红 + 轻微放大」表达（见 `SegmentIconMotion`）。
   */
  bare?: boolean;
  /**
   * 跟手形态的档位位置（可选）：单位 = 档位序号，可为小数 —— 拖动中它就在两档之间。
   * 给了它（且是 `bare` + 图标）之后，选中过渡不再走弹簧，而是每帧由它插值出颜色与缩放，
   * 于是能跟着手指连续变化；松手后的落位动画把它写到位，图标也就跟着走完。
   * 谁持有这个共享值、怎么随拖动写它，由调用方（页面）决定，本组件只负责读。
   */
  pos?: SharedValue<number>;
  /** 整组的无障碍名称（例如「播放语速」）；单段名称取各自的文字 */
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const plain = variant === 'text';
  return (
    <View style={{ flexDirection: 'row', gap }} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel ? tr(accessibilityLabel) : undefined}>
      {items.map((item, index) => {
        const active = item.key === value;
        const SegmentIcon = item.icon;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tr(item.label)}
            style={
              plain
                ? {
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: SEGMENT_PADDING,
                    paddingVertical: SEGMENT_PADDING,
                  }
                : {
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: SEGMENT_PADDING,
                    /* 高度不写死：由文字行高 + 上下各 SEGMENT_PADDING(8) + 描边自然撑开，
                       同一字号档位下各标签必然等高，字号档位变化时按比例长高 */
                    paddingVertical: SEGMENT_PADDING,
                    borderRadius: 999,
                    /* 无壳形态：两种状态都不上色（连选中也是空的），
                       选中与否只由图标的颜色与轻微放大表达 */
                    backgroundColor: active && !bare ? theme.colors.brand : 'transparent',
                    /* 描边宽度两种状态都一样，只换颜色 —— 选中 / 未选中外形完全一致、切换不跳动。
                       **未选中一律透明**（2026-10-17 起：不再留那圈 `colors.border` 灰线）：
                       一排档位里只有当前这档是实心胶囊，其余只是文字；`bare` 则两种状态都空。 */
                    borderWidth: stroke.base,
                    borderColor: active && !bare ? theme.colors.brand : 'transparent',
                  }
            }
          >
            {plain ? (
              /* 纯文字：只有文字本身，没有任何附加图形；选中靠品牌红与未选中的弱化色区分 */
              <AppText
                kind="md"
                color={active ? theme.colors.brand : theme.colors.textMuted}
                numberOfLines={1}
              >
                {item.label}
              </AppText>
            ) : SegmentIcon ? (
              bare ? (
                pos ? (
                  /* 无壳 + 跟手：进度由档位位置逐帧插值，跟着左右拖动连续变色 / 放大 */
                  <SwipeIconMotion
                    Icon={SegmentIcon}
                    index={index}
                    pos={pos}
                    activeColor={theme.colors.brand}
                    inactiveColor={theme.colors.text}
                  />
                ) : (
                  /* 无壳：选中 = 图标变品牌红 + 轻微放大，颜色与缩放都走一段连贯动画 */
                  <SegmentIconMotion
                    Icon={SegmentIcon}
                    active={active}
                    activeColor={theme.colors.brand}
                    inactiveColor={theme.colors.text}
                  />
                )
              ) : (
                /* 只给图标：文字退到无障碍名里（上方 accessibilityLabel），颜色随选中态切换 */
                <SegmentIcon size={SEGMENT_ICON} color={active ? theme.colors.brandOn : theme.colors.text} />
              )
            ) : (
              <AppText kind="md" color={active ? theme.colors.brandOn : theme.colors.text} numberOfLines={1}>
                {item.label}
              </AppText>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * 当前按钮是否渲染在 `FooterBar`（底部悬浮操作条）之内。
 *
 * 底栏那排按钮的底色**不再铺白**（`surface`），直接取页面底色（`bg`）：底栏浮在页面之上，
 * 按钮与页面同底、只靠 0.5px 描边分层，读起来是「贴在页面上的一圈线」而不是一块块白胶囊
 * （2026-10-17 定，与弹窗底色改 `bg` 同日）。
 * 页面内的 `panel` 胶囊（能力趋势的两排筛选等）仍是白底 —— 用这个上下文区分，
 * 调用方（`WordNavFooter` / 练习页 / 积累页 / 扫码登录…）不用逐个传参。
 */
const InFooterBarContext = React.createContext(false);

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  tone = 'brand',
  style,
  accessibilityLabel,
  icon,
  panel = false,
  labelKind = 'md',
  contentPadX = 24,
  strokeColor,
}: {
  /** 有 icon 时可省略：此时按钮只显示图标，无障碍名称取 accessibilityLabel */
  label?: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: 'brand' | 'ghost' | 'danger';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  icon?: React.ReactNode;
  /** 给按钮铺一层实底（悬浮在内容之上的图标钮；能力趋势的两排筛选胶囊未选中态也用它）。底色：页面内 = `surface`，`FooterBar` 内 = `bg` */
  panel?: boolean;
  /** 文字按钮的字号档位。默认 md（18）；底部一行并排三个中文按钮时传 sm，避免挤到换行 */
  labelKind?: TextKind;
  /** 内容区（文字 / 图标）的横向内边距，默认 24；**只放一枚图标的小胶囊**传 12~14 收窄 */
  contentPadX?: number;
  /** 描边颜色。默认 colors.border（浅 #FFFFFF / 深 #3A3A3A）；需要状态色描边的按钮才传它（激活态一律不加粗、只换色） */
  strokeColor?: string;
}) {
  const theme = useTheme();
  const { accent, onAccent } = useAccent();
  /** 底栏里的实心胶囊跟页面同底（`bg`）；页面内的仍用 `surface` */
  const inFooterBar = React.useContext(InFooterBarContext);
  const bg = tone === 'brand' ? accent : tone === 'danger' ? accent : 'transparent';
  const fg = tone === 'ghost' ? theme.colors.text : onAccent;
  return (
    <Pressable
      onPress={
        disabled || loading
          ? undefined
          : () => {
              // 按钮点击统一在这里记一次：几十个页面的主操作都走 PrimaryButton，不必逐页埋
              trackTap(accessibilityLabel ?? label ?? '未命名按钮');
              onPress();
            }
      }
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      accessibilityLabel={tr(accessibilityLabel ?? label ?? '')}
      style={[
        {
          minHeight: 52,
          borderRadius: 999,
          backgroundColor: panel ? (inFooterBar ? theme.colors.bg : theme.colors.surface) : bg,
          opacity: disabled ? opacity.disabled : 1,
          borderWidth: stroke.base,
          borderColor: strokeColor ?? theme.colors.border,
        },
        style,
      ]}
    >
      <View
        style={{
          flex: 1,
          paddingHorizontal: contentPadX,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : icon ? (
          icon
        ) : (
          <AppText kind={labelKind} color={fg} numberOfLines={1}>
            {label}
          </AppText>
        )}
      </View>
    </Pressable>
  );
}

/**
 * 底部悬浮操作条左右留白 = 32。
 * 页面内容区 `layout.pagePadding` = 16，底栏操作条比内容区再收窄一档；
 * 改这一个数即改所有底栏按钮的宽度。
 */
const FOOTER_SIDE_MARGIN = 32;
/** 底部悬浮操作条的按钮高度（比 PrimaryButton 默认的 52 略矮，便于一行放下三个） */
export const FOOTER_BUTTON_HEIGHT = 48;
/**
 * `FooterBar` 开启 `avoidKeyboard` 时，整条停在键盘顶边**上方**多少（px）。
 * 与「底栏距屏幕底边」的 16 同值：抬起来之后四周留白一致，不会显得贴死在键盘上。
 */
const FOOTER_KEYBOARD_GAP = 16;

/**
 * 底栏（`FooterBar`）静止位距屏幕底边的高度：贴安全区（至少 8）再抬 16。
 * `aboveBar` 为真时再抬「导航条高 + 16」（页面自带底部悬浮导航条的情形）。
 * 只给 `FooterBar` 自己算静止位用（弹窗已统一居中，不再借用这个高度）。
 */
export function footerBarBottomInset(insetsBottom: number, aboveBar = false) {
  return Math.max(insetsBottom, 8) + 16 + (aboveBar ? layout.barHeight + 16 : 0);
}

/**
 * 底部悬浮操作条容器：贴屏幕底部的一层浮层（不随内容滚动），
 * 位置公式 bottom = max(safeArea.bottom, 8) + 16，左右各留 32px（FOOTER_SIDE_MARGIN，与底栏的 `layout.barSideMargin` 同值）
 * —— 所以**总宽度与底部导航条完全一致**；按钮之间 12px（可用 `gap` 覆盖，如探索页「输入框 + 正圆按钮」用 12px）。
 * `aboveBar`：页面自带底部悬浮导航条（五个一级页面）时置 true，整条再上抬「条带高 + 16」，
 * 即落在底栏正上方 16px 处（底栏自身 bottom 与这里同口径，两者上下正好隔 16）。
 * 键盘弹出时**默认不动**（整条钉在静止位）：底栏里的输入框由页面滚动区自己避让
 * （`Screen` 的 `automaticallyAdjustKeyboardInsets`），底栏那排按钮就留在键盘后面。
 * 需要整条跟着键盘抬起的浮层（探索页 AI 提问输入行）传 `avoidKeyboard` —— 见该参数说明。
 * 上一词 / 收藏 / 下一词与收藏夹页的删除 / 新建共用这一套几何，不要再各写一份。
 * 需要绝对定位的浮层请务必放进 Screen 的 `footer` 插槽（底部留白已由 Screen 预留）。
 */
export function FooterBar({
  children,
  gap = 12,
  aboveBar = false,
  hidden = false,
  avoidKeyboard = false,
  style,
}: {
  children: React.ReactNode;
  gap?: number;
  /** 页面自带底部悬浮导航条时置 true：整条抬到导航条正上方 16px（宽度仍与导航条一致） */
  aboveBar?: boolean;
  /** 隐藏态（如跟手滑出屏幕中）：根节点不再拦截点击，整块也退出无障碍树（位移 / 透明度由 `style` 给） */
  hidden?: boolean;
  /**
   * 键盘弹出时整条跟着上抬（默认不抬）。给「底栏里放着输入框、且键盘会盖住它」的页面用 ——
   * 目前只有探索页的 AI 提问输入行。
   *
   * 实现走 RN 自带的 `KeyboardAvoidingView`（`behavior="padding"`），不自己监听键盘高度、也不做补间：
   * 它按「自己这一框的下沿」与「键盘顶边」的**实际重叠量**给出底部内边距，于是
   * - iOS（键盘只浮在窗口上、窗口不缩）→ 内边距 = 键盘高，整条正好抬到键盘上方；
   * - Android（窗口按 adjustResize 自身缩小）→ 重叠量本来就是 0，**不会二次补偿**；
   * - Web（键盘不改窗口）→ 重叠量 0，无操作。
   * 一条式子三端自洽，这正是当年手写 `useKeyboardLift` 想模拟的效果。
   *
   * 前提：本节点是绝对定位、且父级顶边与屏幕顶边对齐（`Screen` 的根节点就是），
   * `KeyboardAvoidingView` 内部用「父级内的 y + 高」与屏幕坐标里的键盘顶边相比，位置对得上才算得准。
   * 因此这个模式下根节点由 `KeyboardAvoidingView` 充当，**不要再往 `style` 里塞 Reanimated 动画样式**
   * （需要动画的那几页请继续用默认模式，动画样式挂在里面的节点上）。
   */
  avoidKeyboard?: boolean;
  /** 追加到根节点的样式（用于跟手位移 / 淡出这类动画样式） */
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  /**
   * 静止位：贴安全区（至少 8）再抬 16；页面自带底部导航条时再抬「条带高 + 16」。
   * 它是**静态样式**，随安全区 / 朝向即时变，不走补间。
   *
   * **底栏默认不跟键盘走**（2026-10-17 明确）：整条钉在这个静止位上 ——
   * 此前那套三端 `useKeyboardLift`（iOS `will` / Android `did` / Web `visualViewport` 反推）已整段删除，
   * 需要跟随的浮层改由 `avoidKeyboard` 交给原生 `KeyboardAvoidingView`。
   */
  const restingBottom = footerBarBottomInset(insets.bottom, aboveBar);
  const rootStyle: StyleProp<ViewStyle> = [
    {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: restingBottom,
      paddingHorizontal: FOOTER_SIDE_MARGIN,
    },
    style,
  ];
  const row = <View style={{ flexDirection: 'row', gap }}>{children}</View>;
  return (
    /* 告诉里面的 `PrimaryButton`：这是底栏，实心胶囊的底色取页面底色（`bg`）而不是白（`surface`） */
    <InFooterBarContext.Provider value>
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          behavior="padding"
          /* 正值 = 键盘顶边再往上让这么多：整条停在键盘上方 16（与旧版手写抬升的落点一致） */
          keyboardVerticalOffset={FOOTER_KEYBOARD_GAP}
          pointerEvents={hidden ? 'none' : 'box-none'}
          accessibilityElementsHidden={hidden}
          importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
          style={rootStyle}
        >
          {row}
        </KeyboardAvoidingView>
      ) : (
        <Reanimated.View
          pointerEvents={hidden ? 'none' : 'box-none'}
          accessibilityElementsHidden={hidden}
          importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
          style={rootStyle}
        >
          {row}
        </Reanimated.View>
      )}
    </InFooterBarContext.Provider>
  );
}

/**
 * 环心数值的候选字号（从大到小）：直径 80 的环里放不下时逐档降级。
 * 「x/总数」这类长串（如 `1800/1800`）在 24px 下会顶到描边，降档比截断可读。
 */
const RING_VALUE_SIZES = [typography.lg, 20, 18, 16, 14, 13, typography.micro];

/**
 * 打卡进度环（FR-E-1 / FR-E-2 / FR-E-3）。
 * 数值显示在环心，进度用弧长表示（图形通道），与环心数字互为替代，
 * 达标与否另有文字标注 —— 不单靠颜色传意（NFR-7）。
 *
 * 字号口径：环心数值 24px（lg 档），放不下时按 `RING_VALUE_SIZES` 逐档缩小；
 * 环下方标签 14px（显式，无对应档位；行高沿用 micro 的 17）。
 * 单位由调用方拼进 `value` —— 分母型（时长 / 任务）写成「当前 / 目标」并把单位留给标签
 * （「时长/分」「任务/个」），比率型（得分率）则把 `%` 直接跟在环心数字后（标签只写「得分率」）。
 * 组件本身不感知单位，因此没有 `unit` 参数。
 */
export function ProgressRing({
  value,
  label,
  ratio,
  done,
  statusText,
  size = 76,
  strokeWidth = 7,
  onPress,
  accessibilityLabel,
}: {
  value: string;
  label: string;
  /** 0~1，环内已填充的弧长比例 */
  ratio: number;
  done?: boolean;
  /** 文字化的状态标注（如「达标 / 未达标」） */
  statusText?: string;
  size?: number;
  strokeWidth?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const p = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  /* 环心可用宽度 = 直径 − 2×线宽，再留 4px，保证字不会碰到描边 */
  const innerWidth = size - strokeWidth * 2 - 4;
  /* approxTextWidth 取值刻意偏大（数字按 0.6em 计），所以只用它做上界判断，宁小勿撞 */
  const valueSize =
    RING_VALUE_SIZES.find((s) => approxTextWidth(value, s) <= innerWidth) ??
    RING_VALUE_SIZES[RING_VALUE_SIZES.length - 1];

  const body = (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size}>
          {/* 环槽取进度专用参数 `progressTrack`（当前值与 `border` 相同） */}
          <Circle cx={center} cy={center} r={radius} stroke={theme.colors.progressTrack} strokeWidth={strokeWidth} fill="none" />
          {p > 0 ? (
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={theme.colors.brand}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={circumference * (1 - p)}
              strokeLinecap="round"
              rotation={-90}
              originX={center}
              originY={center}
            />
          ) : null}
        </Svg>
        <View style={{ position: 'absolute', alignItems: 'center' }}>
          {/* 环心数值：默认 24px（lg 档），长串逐档降到放得下为止（行高按 4/3 跟随） */}
          <AppText
            kind="lg"
            style={{ fontSize: theme.size(valueSize), lineHeight: theme.size(Math.round((valueSize * 4) / 3)) }}
            color={done ? theme.colors.brand : theme.colors.text}
            numberOfLines={1}
          >
            {value}
          </AppText>
        </View>
      </View>
      {/* 环下方标签：字号取 tiny 档的 14px，但**行高仍用 micro 的 17**（比 tiny 的 19 更紧，
          打卡卡内容高维持 环 80 + 间距 6 + 标签 17 = 103 不变）；字重保持 regular */}
      <AppText
        kind="sm"
        weight="regular"
        style={{ fontSize: theme.size(typography.tiny), lineHeight: theme.size(typography.lineHeights.micro) }}
        color={theme.colors.textSecondary}
        numberOfLines={1}
      >
        {label}
      </AppText>
      {statusText ? (
        <AppText kind="micro" color={done ? theme.colors.brand : theme.colors.textMuted}>
          {statusText}
        </AppText>
      ) : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={tr(accessibilityLabel ?? `${tr(label)} ${value}`)}
    >
      {body}
    </Pressable>
  );
}

/** 子页面顶部：返回箭头 + 标题（一级页面之外的页面统一使用） */
export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
      <View style={{ flexShrink: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable
            onPress={() => {
              // 深链接直达二级页时没有上一页可回：兜底到主页，别让用户卡在这一层
              if (router.canGoBack()) router.back();
              else router.replace('/');
            }}
            accessibilityRole="button"
            accessibilityLabel={tr('返回')}
            hitSlop={8}
          >
            <View style={{ transform: [{ rotate: '180deg' }] }}>
              <HintIcon size={16} color={theme.colors.text} />
            </View>
          </Pressable>
          <AppText kind="lg" color={theme.colors.text} numberOfLines={2} style={{ flexShrink: 1 }}>
            {title}
          </AppText>
        </View>
        {subtitle ? (
          <AppText kind="micro" color={theme.colors.textMuted}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  // 与卡片描边同色（border），保持同一套「发丝线」语言
  return <View style={[{ height: 1, backgroundColor: theme.colors.border }, style]} />;
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, gap: 8 }}>
      <AppText kind="md" color={theme.colors.textSecondary} align="center">
        {title}
      </AppText>
      {hint ? (
        <AppText kind="micro" color={theme.colors.textMuted} align="center">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

/** 星标收藏按钮的触控区边长：32×32，热区与视觉盒同尺寸（不再另加 hitSlop） */
export const STAR_BUTTON_SIZE = 32;

/**
 * 星标收藏按钮（全 App 统一的收藏控件，FR-M-5 / FR-X-3）—— 单词释义面板（词条块 / AI 词条面板）
 * 与探索页词条头部共用同一份实现。
 * - **触控区 32×32 的透明热区**：无填充、无描边（不套「小圆钮」那套 `surface` 底 + `border` 描边），
 *   热区里只有一颗星。
 * - 内容物与「课本」底栏的收藏按钮同一套（`StarIcon size 26`、空心 / 实心同一开关语义）：
 *   未收藏 = 空心星（`text`）、已收藏 = 实心星（**页面强调色 `accent`**，默认品牌红；
 *   整页用 `<AccentProvider>` 换色时跟着变，热门黄 / 推荐蓝书页上的星标也是那颗星），
 *   形状即状态、不单靠颜色传意（NFR-7）。
 * - 点按由调用方决定；三个面板的点击行为都与课本一致 —— 打开收藏夹选择弹窗（多选，全不选 = 取消收藏）。
 * - `marginLeft: 'auto'` 让它在所在行固定右端对齐。
 */
export function StarButton({
  active,
  onPress,
  accessibilityLabel,
  size = 26,
  disabled,
  style,
}: {
  active?: boolean;
  onPress?: () => void;
  accessibilityLabel: string;
  size?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  /** 激活态的星色取页面强调色（默认 = 品牌红，未包 `AccentProvider` 时逐像素不变） */
  const { accent } = useAccent();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active, disabled: !!disabled }}
      accessibilityLabel={tr(accessibilityLabel)}
      style={[
        {
          width: STAR_BUTTON_SIZE,
          height: STAR_BUTTON_SIZE,
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: 'auto',
        },
        disabled ? { opacity: opacity.disabled } : null,
        style,
      ]}
    >
      <StarIcon
        size={size}
        filled={!!active}
        color={active ? accent : theme.colors.text}
      />
    </Pressable>
  );
}

/** 无障碍：图形/颜色之外的文字徽标 */
export function Badge({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'brand' | 'good' }) {  const theme = useTheme();
  const bg = tone === 'brand' ? theme.colors.brand : tone === 'good' ? theme.colors.accentBlue : theme.colors.divider;
  const fg = tone === 'neutral' ? theme.colors.text : theme.colors.brandOn;
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: bg }}>
      <AppText kind="micro" color={fg}>
        {text}
      </AppText>
    </View>
  );
}

export const numbers = { layout, typography };
