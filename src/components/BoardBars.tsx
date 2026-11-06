import React from 'react';
import { View } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';

import {
  AXIS_GAP,
  AXIS_LEFT,
  autoAxisTop,
  axisValue,
  CHART_W,
  GRID_LEFT,
  GRID_RIGHT,
  SIDE_INSET,
} from '@/components/chartGeometry';
import { tr } from '@/i18n';
import { approxTextWidth, scriptFont } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * 分览的纵向条形图：横坐标 = 项目（板块）名，纵坐标 = 当前所选指标。
 * 与总览第二个面板同口径的三种维度（`metric`）：
 * - `score`：得分率 0~100%，纵轴固定 0 / 25 / 50 / 75 / 100；
 * - `tasks`：完成任务数（个），纵轴上限按数据最大值自动取整（4 等分刻度）；
 * - `time`：练习时长（分），同样自适应纵轴。
 * 每个竖条顶部标注该项目的当前指标值；**横坐标下方不再给出个数统计**（那就是所选指标本身）。
 * 没有任何数据的项目不画竖条，改在条位底部给出「无」（不靠颜色或长度单独传意，NFR-7）。
 * 纵轴刻度左对齐成一列、横线端点走 `chartGeometry` 的共用口径（全 App 图表横线等宽）。
 */
export interface BoardBarItem {
  /** 项目名（听 / 写 / 说 / 读 / 译） */
  label: string;
  /** 得分率 0~100；无已评分作答时为 null */
  scoreRate: number | null;
  /** 该项目的完成任务数 */
  taskCount: number;
  /** 该项目的练习时长（秒） */
  durationSec: number;
}

/** 条形图可切换的三种维度（与总览第二个面板完全一致） */
export type BoardMetric = 'score' | 'tasks' | 'time';

const H = 172;
const PAD_TOP = 30;
/** 横坐标只有一行项目名（个数统计已删除），留 32 够放 14px 文字 */
const PAD_BOTTOM = 32;
const PLOT_H = H - PAD_TOP - PAD_BOTTOM;
const PLOT_BOTTOM = PAD_TOP + PLOT_H;
const BAR_W = 26;
/** 全图文字统一 14px（与总览其余文字同档） */
const TEXT_SIZE = 14;

export function BoardBars({ items, metric = 'score' }: { items: BoardBarItem[]; metric?: BoardMetric }) {
  const theme = useTheme();
  /** 纵轴单位：得分率 `%`、任务数 `个`、时长 `分`（与总览曲线同一套） */
  const unit = metric === 'score' ? '%' : tr(metric === 'tasks' ? '个' : '分');
  /** 每个项目的当前指标值；得分率无已评分作答时为 null（其余指标为 0 即「无」） */
  const valueOf = (it: BoardBarItem): number | null => {
    if (metric === 'score') return it.scoreRate;
    const v = metric === 'tasks' ? it.taskCount : it.durationSec / 60;
    return v > 0 ? v : null;
  };
  const values = items.map(valueOf);
  /** 得分率固定 0~100；任务数 / 时长按数据自适应（与总览曲线同一套取整） */
  const axisTop =
    metric === 'score' ? 100 : autoAxisTop(Math.max(0, ...values.map((v) => v ?? 0)));
  const ticks = [0, 1, 2, 3, 4].map((i) => (axisTop / 4) * i);
  const tickText = (v: number) => `${axisValue(v)}${unit}`;

  /** 纵轴刻度列宽 = 最宽的一条 + 2px 估算余量（刻度文字左对齐在这列里） */
  const axisColumnW = Math.ceil(Math.max(0, ...ticks.map((v) => approxTextWidth(tickText(v), TEXT_SIZE)))) + 2;
  /**
   * 横线左端 = 共用口径 GRID_LEFT；只有刻度文字比基准（14px 的「100%」）更宽时才让位，
   * 否则整段横线会从刻度文字下面穿过。
   */
  const gridLeft = Math.max(GRID_LEFT, AXIS_LEFT + axisColumnW + AXIS_GAP);

  // 竖条区 = 横线区间：竖条中心与横坐标项目名共用同一个 x
  const colW = (GRID_RIGHT - gridLeft) / Math.max(1, items.length);
  const centerX = (i: number) => gridLeft + colW * i + colW / 2;
  const yOf = (v: number) => PLOT_BOTTOM - (Math.max(0, Math.min(axisTop, v)) / axisTop) * PLOT_H;
  /** 顶部圆角、底部贴横轴的竖条 */
  const barPath = (x: number, top: number) => {
    const r = Math.min(4, BAR_W / 2, Math.max(0, PLOT_BOTTOM - top));
    return [
      `M ${x} ${PLOT_BOTTOM}`,
      `L ${x} ${top + r}`,
      `Q ${x} ${top} ${x + r} ${top}`,
      `L ${x + BAR_W - r} ${top}`,
      `Q ${x + BAR_W} ${top} ${x + BAR_W} ${top + r}`,
      `L ${x + BAR_W} ${PLOT_BOTTOM}`,
      'Z',
    ].join(' ');
  };

  return (
    <View style={{ paddingHorizontal: SIDE_INSET }}>
      <Svg width="100%" height={H} viewBox={`0 0 ${CHART_W} ${H}`}>
        {ticks.map((v) => (
          <React.Fragment key={v}>
            <Line
              x1={gridLeft}
              y1={yOf(v)}
              x2={GRID_RIGHT}
              y2={yOf(v)}
              stroke={theme.colors.divider}
              strokeWidth={1}
            />
            {/* 纵轴刻度左对齐成一行：起点固定，宽度变化只影响右缘 */}
            <SvgText
              x={AXIS_LEFT}
              y={yOf(v) + 5}
              fontSize={TEXT_SIZE}
              fontFamily={scriptFont(tickText(v))}
              fill={theme.colors.textMuted}
              textAnchor="start"
            >
              {tickText(v)}
            </SvgText>
          </React.Fragment>
        ))}

        {items.map((it, i) => {
          const cx = centerX(i);
          const x = cx - BAR_W / 2;
          const value = values[i];
          // 无：条位底部留一小段轨道色（表示「此处没有数据」），上方用文字给出原因
          const height = value === null ? 4 : Math.max(4, (Math.max(0, Math.min(axisTop, value)) / axisTop) * PLOT_H);
          const top = PLOT_BOTTOM - height;
          const text = value === null ? tr('无') : tickText(value);
          return (
            <React.Fragment key={it.label}>
              <Path
                d={barPath(x, top)}
                fill={value === null ? theme.colors.surfaceSunken : theme.colors.brand}
              />
              <SvgText
                x={cx}
                y={Math.max(PAD_TOP - 8, top - 6)}
                fontSize={TEXT_SIZE}
                fontFamily={scriptFont(text)}
                fill={value === null ? theme.colors.textMuted : theme.colors.text}
                textAnchor="middle"
              >
                {text}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* 横坐标：只有项目名一行（个数的统计已删除，当前指标已由竖条与顶部标注给出） */}
        {items.map((it, i) => (
          <SvgText
            key={`x-${it.label}`}
            x={centerX(i)}
            y={PLOT_BOTTOM + 20}
            fontSize={TEXT_SIZE}
            fontFamily={scriptFont(it.label)}
            fill={theme.colors.text}
            textAnchor="middle"
          >
            {it.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}
