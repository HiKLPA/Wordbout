import { approxTextWidth } from '@/theme/fonts';

/**
 * 图表共用几何口径（TrendChart / BoardBars 都从这里取，改一处即全局对齐）。
 *
 * 关键点：横线（网格线）在 viewBox 里的左右端点恒为 `GRID_LEFT` / `GRID_RIGHT`，
 * 与纵轴刻度文字宽度、数据点两端留白都无关 —— 因此总览曲线、分览各题型曲线与
 * 分览第一个面板（板块条形图）的横线位置与宽度完全一致（以分览第一个面板为基准）。
 */

/** 所有图表的 viewBox 宽度 */
export const CHART_W = 320;
/** 图表左右各留 4px，刻度文字与内容都不贴卡片内边缘 */
export const SIDE_INSET = 4;
/** 纵轴刻度文字左对齐的起点（叠加图表 4px 内缩后距卡片内缘 6px） */
export const AXIS_LEFT = 2;
/**
 * 纵轴刻度右缘与内容之间的净间隔。
 * 刻度左对齐成一列，所以每条刻度的实际间隔 ≥ 该值；取 10 是为了压紧纵轴与图的关系。
 */
export const AXIS_GAP = 10;
/** 纵轴刻度列宽：按条形图的 14px「100%」测算，全 App 图表取同一列宽 */
export const AXIS_COLUMN_W = Math.ceil(approxTextWidth('100%', 14)) + 2;
/** 纵轴刻度列的右缘 */
export const AXIS_RIGHT = AXIS_LEFT + AXIS_COLUMN_W;
/** 横线（网格线）左端 = 纵轴列 + 净间隔 */
export const GRID_LEFT = AXIS_RIGHT + AXIS_GAP;
/** 横线（网格线）右端 */
export const GRID_RIGHT = CHART_W - 8;

/** 纵轴每格的「整」步长候选，上限 = 4 格 × 步长 */
const AXIS_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

/**
 * 自动纵轴上限：≥ 数据最大值，且能被 4 等分成比较整齐的刻度。
 * 得分率视图固定 0~100，任务数 / 时长视图走这里（TrendChart 与 BoardBars 共用同一套取整）。
 */
export function autoAxisTop(dataMax: number): number {
  if (dataMax <= 0) return 4;
  const step = AXIS_STEPS.find((s) => s >= dataMax / 4) ?? AXIS_STEPS[AXIS_STEPS.length - 1];
  return step * 4;
}

/** 刻度 / 数值标注的数字文本：整数不带小数，非整数保留 1 位（两张图共用） */
export function axisValue(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
