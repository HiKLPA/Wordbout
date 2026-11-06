/**
 * 字体加载（设计令牌：Barlow / 思源黑体）。
 *
 * 排版规则（全局统一）：
 * - 英文与数字 → Barlow（**只用 500 Medium / 600 SemiBold / 700 Bold 三档**）
 * - 汉字与中文标点 → 思源黑体（Google Fonts 上的同源字体 Noto Sans SC，
 *   与 Adobe 思源黑体为同一套字形，**500 Medium / 600 SemiBold / 700 Bold 三档**）
 *
 * 全 App 字重范围 = **[500, 700]**：最低 500、最高 700，不再出现 400 与 800+。
 * 三个字重槽 `regular / bold / extraBold` 依次映射到 500 / 600 / 700 ——
 * `regular` = 正文与说明（body / micro），`bold` = 标题与强调（lg / md / sm），
 * `extraBold` = 页面大标题与大字号（display / xxxl / xxl / xl）。
 *
 * 混排由 <AppText> 拆 run 处理（见 src/theme/script.ts），输入框用 scriptFont() 选字体。
 */
// 注意：必须从字重子目录导入。从包根 index 导入会把 18 个字重的 ttf 全部打进包（~4MB 冗余）。
import { Barlow_500Medium } from '@expo-google-fonts/barlow/500Medium';
import { Barlow_600SemiBold } from '@expo-google-fonts/barlow/600SemiBold';
import { Barlow_700Bold } from '@expo-google-fonts/barlow/700Bold';
import { useFonts } from 'expo-font';

import { hasCjk } from '@/theme/script';

/** 英文与数字（Barlow）：槽位 → 实际字重文件 */
export const LatinFont = {
  /** 正文 / 小字 → 500 Medium */
  regular: 'Barlow_500Medium',
  /** 标题 / 强调（lg / md / sm）→ 600 SemiBold */
  bold: 'Barlow_600SemiBold',
  /** 大标题 / 大字号（display / xxxl / xxl / xl）→ 700 Bold */
  extraBold: 'Barlow_700Bold',
} as const;

/** 汉字与中文标点（思源黑体 / Noto Sans SC）：与拉丁侧同档 */
export const CjkFont = {
  regular: 'NotoSansSC_500Medium',
  bold: 'NotoSansSC_600SemiBold',
  extraBold: 'NotoSansSC_700Bold',
} as const;

export type FontWeightKey = keyof typeof LatinFont;

/** 设计令牌里的字体别名（保持既有调用点不变） */
export const FontFamily = {
  /** 小字档 micro 12 / ENG 16 / ENG 18 / ENG 24 */
  bar: LatinFont.bold,
  bold: LatinFont.bold,
  /** ENG 32 / ENG 64 / ENG 128 */
  extraBold: LatinFont.extraBold,
  /** Body 16/28 正文 */
  body: LatinFont.regular,
} as const;

/** 拆不了 run 的单行文本（图表刻度等）：含汉字用思源黑体，否则用 Barlow。**输入框不走它**，见 `inputFont()` */
export function scriptFont(text: string | null | undefined, weight: FontWeightKey = 'regular'): string {
  return hasCjk(text ?? '') ? CjkFont[weight] : LatinFont[weight];
}

/**
 * **输入框内部统一用它 —— 思源黑体**（子集里带了 ASCII，中英文与数字都能显示）。
 *
 * 输入框只能有一个 `font-family`：若按内容在 Barlow / 思源黑体之间切换，往英文里敲下第一个汉字的
 * 那一瞬就会整段重排 —— 两款字体的字面度量与视觉大小不同，看着像字号跳了一档、框还闪一下。
 * 统一成思源黑体后 `font-family` 在输入全程恒定不变，既没有切换重排，也不会再有字体闪烁。
 *
 * 只给输入框用；正文与图表刻度仍走 `<AppText>` 拆 run 与 `scriptFont()`。
 */
export function inputFont(weight: FontWeightKey = 'regular'): string {
  return CjkFont[weight];
}

/**
 * 粗估一段单行文字的渲染宽度（**仅供给坐标轴刻度留位**，取值刻意偏大）。
 * 数字 / 字母按 0.6em、`%` 按 0.85em、汉字与全角标点按 1em 计。
 * 图表外不再用固定数值猜宽度，避免长刻度（如「4000分」）压到绘图区。
 */
export function approxTextWidth(text: string, fontSize: number): number {
  let width = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (/[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/.test(ch)) width += fontSize;
    else if (ch === '%') width += fontSize * 0.85;
    else width += fontSize * 0.6;
  }
  return width;
}

export function useAppFonts(): boolean {
  const [loaded] = useFonts({
    Barlow_500Medium,
    Barlow_600SemiBold,
    Barlow_700Bold,
    // 思源黑体子集（常用汉字 + 全角标点 + ASCII），由 scripts/fonts-subset.py 生成
    NotoSansSC_500Medium: require('../../assets/fonts/NotoSansSC-500Medium.ttf'),
    NotoSansSC_600SemiBold: require('../../assets/fonts/NotoSansSC-600SemiBold.ttf'),
    NotoSansSC_700Bold: require('../../assets/fonts/NotoSansSC-700Bold.ttf'),
  });
  return loaded;
}
