import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

/**
 * 页头渐变遮罩（对应 Figma 的「渐变 + 图层模糊」两层处理）：
 * 渐变用 smoothstep 多段取样，两端斜率为 0，消除起止硬边
 * （等价 Figma 图层模糊对遮罩自身边缘的羽化）。
 * 只在 `Screen` 的固定页头层里用：页头下沿保持主题底色，再沿曲线平滑淡出到全透明，
 * 滚动内容从页头下面经过时是化开而不是被硬切（跟随深浅模式）。纯装饰层，不接收触摸事件。
 */
/** 淡出段分段数：越多曲线越平滑 */
const FADE_STEPS = 16;

/**
 * 遮罩峰值不透明度（全 App 统一的渐隐强度）：
 * 1 = 实底段完全不透明，滚动内容在页头下沿被完全化掉、不留影子；
 * 想更"透气"就调小这个值（0.75 / 0.95 都试过），改这一处全 App 同步。
 */
export const TOP_FADE_PEAK_ALPHA = 1;

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/** #RRGGBB + alpha(0~1) → #RRGGBBAA */
function withAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  return `${hex}${Math.round(clamp01(alpha) * 255)
    .toString(16)
    .padStart(2, '0')}`;
}

/** smoothstep：t=0/1 处斜率为 0，用于生成无硬边的淡出曲线 */
function smoothstep(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

/**
 * 渐变遮罩：`opaqueHeight` 之内保持 `peakAlpha` 不透明度（默认 `TOP_FADE_PEAK_ALPHA`），
 * 之后到 `height` 之间沿 smoothstep 平滑淡出到全透明
 * （多段取样，两端斜率为 0，所以上下都不会出现硬边）。
 */
export function TopFadeMask({
  height,
  opaqueHeight,
  peakAlpha = TOP_FADE_PEAK_ALPHA,
  color,
  style,
}: {
  height: number;
  opaqueHeight: number;
  peakAlpha?: number;
  /**
   * 遮罩底色，默认页面底色 `colors.bg`。
   * 遮罩是「用所在容器的底色把内容化掉」，所以贴在非页面底色的面上（如底栏底色的历史面板）
   * 时要显式传该面的底色，否则会露出一条异色带。
   */
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const bg = color ?? theme.colors.bg;
  const h = Math.max(0, height);
  // 实底段占比：h 为 0 时退化为整段透明渐变
  const fadeStart = h > 0 ? Math.min(0.98, Math.max(0, opaqueHeight) / h) : 0;

  const bgColors: [string, string, ...string[]] = [withAlpha(bg, peakAlpha), withAlpha(bg, peakAlpha)];
  const locations: [number, number, ...number[]] = [0, fadeStart];
  for (let i = 1; i <= FADE_STEPS; i += 1) {
    const t = i / FADE_STEPS;
    locations.push(fadeStart + (1 - fadeStart) * t);
    bgColors.push(withAlpha(bg, peakAlpha * (1 - smoothstep(t))));
  }

  return (
    <View pointerEvents="none" style={[{ height: h }, style]}>
      <LinearGradient
        colors={bgColors}
        locations={locations}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
