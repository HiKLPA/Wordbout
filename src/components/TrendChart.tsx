import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import type { ChartPoint } from '@/domain/stats';
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
import { approxTextWidth, scriptFont } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * 变化趋势（FR-E-19）：横轴日期、纵轴为该视图的指标值。
 * - 得分率视图：纵轴 0~100%，每个数据点上方标注其得分率；
 * - 任务数 / 时长视图：纵轴上限按数据最大值自动取整（4 等分刻度），点标注同样落在点上方。
 * 少于两次记录时不出曲线，由调用方给出文字提示。
 * 纵轴刻度左对齐成一列、列宽随刻度文字宽度自适应，刻度右缘与绘图区之间恒留 `AXIS_GAP`，
 * 因此长刻度（「4000分」）或左端第一个数据点的数值标注都不会与纵轴文字重合。
 * 横线端点走 `chartGeometry` 的共用口径，与分览第一个面板（板块条形图）等宽对齐。
 */

/** 纵轴刻度字号 */
const AXIS_FONT = 12;

export function TrendChart({
  points,
  height = 180,
  onPressPoint,
  unit = '%',
  autoScale = false,
}: {
  points: ChartPoint[];
  height?: number;
  onPressPoint?: (p: ChartPoint) => void;
  /** 纵轴单位：得分率为 `%`、任务数为 `个`（en 空串）、时长为 `分` */
  unit?: string;
  /** 纵轴上限按数据自适应（任务数 / 时长视图）；默认固定按百分比取 0~100 */
  autoScale?: boolean;
}) {
  const theme = useTheme();
  const width = CHART_W;

  const axisTop = autoScale ? autoAxisTop(points.reduce((m, p) => Math.max(m, p.value), 0)) : 100;
  const ticks = [0, 1, 2, 3, 4].map((i) => (axisTop / 4) * i);
  const valueLabel = (p: ChartPoint) => `${axisValue(p.value)}${unit}`;
  /** 横轴标签的抽样规则，与下方渲染保持一致：每 ceil(n/5) 取一个，并保证有最后一个 */
  const labelStep = Math.max(1, Math.ceil(points.length / 5));
  /**
   * 红点、点上方数值、横轴标签三者共用同一个 x（一律居中），所以红点与横坐标天然对齐。
   * 首尾两点上的标注会向两侧各外扩半个字宽，绘图区两端各按它预留「内侧留白」，
   * 最外一格的数字与横轴标签都不会越过 viewBox 被裁掉。
   */
  const halfWidth = (text: string) => approxTextWidth(text, AXIS_FONT) / 2;
  const edgeRoom = (p: ChartPoint) => Math.ceil(Math.max(halfWidth(valueLabel(p)), halfWidth(p.label))) + 2;
  const leftInset = points.length > 1 ? edgeRoom(points[0]) : 0;
  const rightInset = points.length > 1 ? edgeRoom(points[points.length - 1]) : 0;
  /** 纵轴刻度列宽 = 最宽的一条 + 2px 估算余量（刻度文字左对齐在这列里） */
  const axisColumnW =
    Math.ceil(Math.max(0, ...ticks.map((v) => approxTextWidth(`${axisValue(v)}${unit}`, AXIS_FONT)))) + 2;
  /**
   * 横线左端 = 共用口径 GRID_LEFT；只有刻度文字比基准（14px 的「100%」）更宽时才让位，
   * 否则整段横线会从刻度文字下面穿过。
   */
  const gridLeft = Math.max(GRID_LEFT, AXIS_LEFT + axisColumnW + AXIS_GAP);
  // top 22 给点上方的数值标注留位
  const padding = {
    top: 22,
    right: Math.max(width - GRID_RIGHT, rightInset),
    bottom: 26,
    // left = 横线左端与「纵轴刻度列 + AXIS_GAP + 首点标注半宽」取大：
    // 数据点整体落在横线区间内，且刻度文字与首点数值之间恒留 AXIS_GAP
    left: Math.max(gridLeft, AXIS_LEFT + axisColumnW + AXIS_GAP + leftInset),
  };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const x = (i: number) => padding.left + (points.length <= 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => padding.top + plotH - (Math.max(0, Math.min(axisTop, v)) / axisTop) * plotH;

  const coords = points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ');

  return (
    <View style={{ paddingHorizontal: SIDE_INSET }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {ticks.map((v) => {
          const text = `${axisValue(v)}${unit}`;
          return (
            <React.Fragment key={v}>
              <Line
                x1={gridLeft}
                y1={y(v)}
                x2={GRID_RIGHT}
                y2={y(v)}
                stroke={theme.colors.divider}
                strokeWidth={1}
              />
              {/* 纵轴刻度左对齐成一行：起点固定，宽度变化只影响右缘，不会推着绘图区动 */}
              <SvgText
                x={AXIS_LEFT}
                y={y(v) + 4}
                fontSize={AXIS_FONT}
                fontFamily={scriptFont(text)}
                fill={theme.colors.textMuted}
                textAnchor="start"
              >
                {text}
              </SvgText>
            </React.Fragment>
          );
        })}
        <Polyline points={coords} fill="none" stroke={theme.colors.text} strokeWidth={2} />
        {points.map((p, i) => (
          <Circle
            key={p.key}
            cx={x(i)}
            cy={y(p.value)}
            r={4}
            fill={theme.colors.brand}
            onPress={onPressPoint ? () => onPressPoint(p) : undefined}
          />
        ))}
        {/* 每个小红点上方标注该点的纵轴值，恒与红点居中对齐（两端已按标注宽度预留留白，不会被裁） */}
        {points.map((p, i) => {
          const text = `${axisValue(p.value)}${unit}`;
          return (
            <SvgText
              key={`v-${p.key}`}
              x={x(i)}
              y={Math.max(padding.top - 4, y(p.value) - 8)}
              fontSize={12}
              fontFamily={scriptFont(text)}
              fill={theme.colors.text}
              textAnchor="middle"
            >
              {text}
            </SvgText>
          );
        })}
        {points.map((p, i) =>
          i % labelStep === 0 || i === points.length - 1 ? (
            <SvgText
              key={`l-${p.key}`}
              // 恒与红点居中对齐；最外两格的文字靠 padding 预留的留白容纳
              x={x(i)}
              y={height - 6}
              fontSize={12}
              fontFamily={scriptFont(p.label)}
              fill={theme.colors.textMuted}
              textAnchor="middle"
            >
              {p.label}
            </SvgText>
          ) : null,
        )}
      </Svg>
    </View>
  );
}
