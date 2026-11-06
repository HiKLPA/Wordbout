import React from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { layout } from '@/theme/tokens';

/** 标签行与进度条之间的间距 */
const LABEL_GAP = 8;
/** 进度条高度（全 App 统一，见 layout.progressHeight）与圆角（半高 = 全圆头） */
const BAR_HEIGHT = layout.progressHeight;
const BAR_RADIUS = BAR_HEIGHT / 2;
/** 段与段之间、左右两个半区之间的间距 */
const SEGMENT_GAP = 8;

/**
 * 三段进度条的标签字号：全段统一 `micro` —— 12px / 500（Barlow Medium / 思源黑体 Medium），
 * 题库名、文体名、「x/n」与百分比同号同字重，三栏看起来是一条线。
 */
const LABEL_KIND = 'micro' as const;

export interface ProgressStage {
  /** 标签文案（题库名 / 文体 /「x / n」），贴在进度条上方；无 `leading` 时靠左，有则靠右 */
  label: string;
  /** 左端附加文案（题目段的百分比）；省略时只有标签 */
  leading?: string;
  /** 0 ~ 1：题库段与文体段只有 0 / 1，题目段按 x ÷ n */
  ratio: number;
  /** 尚未到达的段：不铺品牌红，标签也停在占位态 */
  pending?: boolean;
  /** 无障碍名（调用方译好的成品文案，组件不再二次翻译） */
  accessibilityLabel: string;
}

/**
 * 练习流程的三段进度条（题库 → 文体 → 题目）。
 *
 * 样式与单词本（`library/[bookId]` 的学习进度）一致：**文字在条外**、贴在进度条上方左对齐，
 * 下方是一条 4px 高的细条 —— 轨道取进度专用参数 `progressTrack`（当前值与 `border` 相同），
 * 已完成的部分从左侧铺品牌红。
 * 不再把文案压在条里，所以没有「半截字压在两色交界上」的问题，也不需要再渲染两份文字。
 *
 * 版面：整条铺满正文宽度，分左右两个半区 —— 左半区放「选题库」与「选文体」，两者平分左半区；
 * 右半区放「题目」段（**左百分比、右「x/n」**，即完成率在左、已做几题在右）。
 * 三栏都是 12px 加粗（`bar`）、底部对齐，条因此落在同一条水平线上。
 *
 * 状态不单靠颜色（NFR-7）：未到达的段不铺红（图形通道），标签也停在占位态（弱化色），
 * 题目段另有「x / n」与百分比文字。
 */
export function StageProgressBar({
  left,
  right,
}: {
  /** 左半区的段：选题库（+ 选文体，若有），两者平分左半区 */
  left: ProgressStage[];
  /** 右半区的段：题目进度 */
  right: ProgressStage;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: SEGMENT_GAP }}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: SEGMENT_GAP }}>
        {left.map((stage) => (
          <View key={stage.accessibilityLabel} style={{ flex: 1 }}>
            <Stage stage={stage} />
          </View>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        <Stage stage={right} />
      </View>
    </View>
  );
}

/** 单段：上面一行标签（有 `leading` 时左端带百分比、标签靠右），下面一条细进度条 */
function Stage({ stage }: { stage: ProgressStage }) {
  const theme = useTheme();
  const ratio = stage.pending
    ? 0
    : Math.max(0, Math.min(1, Number.isFinite(stage.ratio) ? stage.ratio : 0));
  const color = stage.pending ? theme.colors.textMuted : theme.colors.text;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={stage.accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
      style={{ gap: LABEL_GAP }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6 }}>
        {/* 完成率（题目段的百分比）在**左**，题目数在右 */}
        {stage.leading ? (
          <AppText kind={LABEL_KIND} color={color} numberOfLines={1}>
            {stage.leading}
          </AppText>
        ) : null}
        {/* 标签最多两行：12px 下「CET4 核心词库」在半栏里放得下，
            再长的库名则换行而不截断；换行只往上长，条仍与相邻两段底对齐 */}
        <AppText kind={LABEL_KIND} color={color} numberOfLines={2} style={{ flexShrink: 1 }}>
          {stage.label}
        </AppText>
      </View>
      {/* 进度填充：图形通道（另有「x / n」与百分比文字，不单靠颜色传意） */}
      <View
        style={{
          height: BAR_HEIGHT,
          borderRadius: BAR_RADIUS,
          backgroundColor: theme.colors.progressTrack,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${ratio * 100}%`,
            height: BAR_HEIGHT,
            borderRadius: BAR_RADIUS,
            backgroundColor: theme.colors.brand,
          }}
        />
      </View>
    </View>
  );
}
