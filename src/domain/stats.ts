import { appConfig } from '@/config/appConfig';
import type { BoardId, ExerciseTypeId } from '@/config/appConfig';
import type { Attempt, DailyStat } from '@/domain/types';
import { addDays, dateKey, diffDays, monthStartKey, parseKey, weekStartKey } from '@/domain/date';
import { trf } from '@/i18n';

export function emptyDaily(date: string): DailyStat {
  return { date, durationSec: 0, taskCount: 0, qualified: false, completedItemIds: [], byType: {}, byLevel: {} };
}

/** 是否达标（FR-E-1 / FR-E-2 / FR-E-3） */
export function isQualified(durationSec: number, taskCount: number, timeThresholdMin: number, taskThreshold: number): boolean {
  const timeOk = durationSec >= timeThresholdMin * 60;
  const taskOk = taskCount >= taskThreshold;
  switch (appConfig.streak.qualifyRule) {
    case 'time':
      return timeOk;
    case 'tasks':
      return taskOk;
    default:
      return timeOk || taskOk;
  }
}

/**
 * 连续练习天数（FR-E-1）。
 * 递增条件 = 当天达标；漏一天回到 1（当前未达标则展示已达成的连续段）。
 */
export interface ProjectRow {
  typeId: ExerciseTypeId;
  board: BoardId;
  count: number;
  durationSec: number;
  taskCount: number;
  avgScore: number | null;
  maxScore: number | null;
  minScore: number | null;
  lastScore: number | null;
  scoreRate: number | null;
  /** 每个分项的得分率，用于 AI 评分项目的分项趋势 */
  breakdown: Record<string, number>;
}

export interface AggregateResult {
  practiceDays: number;
  totalDurationSec: number;
  totalTaskCount: number;
  byBoard: {
    board: BoardId;
    /** 该板块的任务数（= 板块下各题型的作答条数之和，与打卡三计数器同口径） */
    count: number;
    scoreRate: number | null;
    /** 该板块的练习时长（秒） */
    durationSec: number;
    practiceCount: number;
  }[];
  byType: ProjectRow[];
  avgScoreRate: number | null;
}

function inRange(ts: number, from: string, to: string): boolean {
  const key = dateKey(new Date(ts));
  return diffDays(from, key) >= 0 && diffDays(key, to) >= 0;
}

export interface AggregateFilter {
  from: string;
  to: string;
  typeIds?: ExerciseTypeId[];
  levelIds?: string[];
}

/** 按区间 + 项目维度聚合（FR-E-16 ~ FR-E-18） */
export function aggregate(
  attempts: Attempt[],
  daily: Record<string, DailyStat>,
  filter: AggregateFilter,
  typeOrder: ExerciseTypeId[],
  boardOf: (t: ExerciseTypeId) => BoardId,
): AggregateResult {
  const { from, to } = filter;
  // 测验（excluded）只留作答记录，不参与学习统计 —— 与打卡卡片同口径
  const scoped = attempts.filter(
    (a) =>
      a.status === 'succeeded' &&
      !a.excluded &&
      inRange(a.finishedAt, from, to) &&
      (!filter.typeIds?.length || filter.typeIds.includes(a.typeId)) &&
      (!filter.levelIds?.length || filter.levelIds.includes(a.levelId)),
  );

  // 练习天数 / 时长 / 任务数一律以 daily 聚合为准，保证与练习页三个计数器同口径（FR-E-20）
  const keys: string[] = [];
  let cur = from;
  while (diffDays(cur, to) >= 0) {
    keys.push(cur);
    cur = addDays(cur, 1);
  }
  let practiceDays = 0;
  let totalDurationSec = 0;
  let totalTaskCount = 0;
  keys.forEach((k) => {
    const d = daily[k];
    if (!d) return;
    if (d.taskCount > 0 || d.durationSec > 0) practiceDays += 1;
    totalDurationSec += d.durationSec;
    totalTaskCount += d.taskCount;
  });

  const byType: ProjectRow[] = typeOrder.map((typeId) => {
    const rows = scoped.filter((a) => a.typeId === typeId);
    const scored = rows.filter((a) => a.scoreRate !== null) as (Attempt & { scoreRate: number })[];
    const sorted = [...rows].sort((a, b) => a.finishedAt - b.finishedAt);
    const breakdown: Record<string, number> = {};
    const bAcc: Record<string, { sum: number; n: number }> = {};
    scored.forEach((a) => {
      a.result?.breakdown.forEach((b) => {
        if (b.max <= 0) return;
        const rate = (b.score / b.max) * 100;
        bAcc[b.label] = bAcc[b.label] ?? { sum: 0, n: 0 };
        bAcc[b.label].sum += rate;
        bAcc[b.label].n += 1;
      });
    });
    Object.entries(bAcc).forEach(([label, v]) => {
      breakdown[label] = v.sum / v.n;
    });

    return {
      typeId,
      board: boardOf(typeId),
      count: rows.length,
      durationSec: rows.reduce((s, a) => s + a.durationSec, 0),
      taskCount: rows.length,
      avgScore: scored.length ? scored.reduce((s, a) => s + a.scoreRate, 0) / scored.length : null,
      maxScore: scored.length ? Math.max(...scored.map((a) => a.scoreRate)) : null,
      minScore: scored.length ? Math.min(...scored.map((a) => a.scoreRate)) : null,
      lastScore: sorted.length ? (sorted[sorted.length - 1].scoreRate ?? null) : null,
      scoreRate: scored.length ? scored.reduce((s, a) => s + a.scoreRate, 0) / scored.length : null,
      breakdown,
    };
  });

  const boardIds: BoardId[] = ['listening', 'writing', 'speaking', 'reading', 'translating'];
  const byBoard = boardIds.map((board) => {
    const rows = byType.filter((r) => r.board === board);
    const scored = rows.filter((r) => r.scoreRate !== null);
    const count = rows.reduce((s, r) => s + r.count, 0);
    return {
      board,
      count,
      practiceCount: count,
      durationSec: rows.reduce((s, r) => s + r.durationSec, 0),
      scoreRate: scored.length ? scored.reduce((s, r) => s + (r.scoreRate ?? 0), 0) / scored.length : null,
    };
  });

  const allScored = scoped.filter((a) => a.scoreRate !== null) as (Attempt & { scoreRate: number })[];
  return {
    practiceDays,
    totalDurationSec,
    totalTaskCount,
    byBoard,
    byType,
    avgScoreRate: allScored.length ? allScored.reduce((s, a) => s + a.scoreRate, 0) / allScored.length : null,
  };
}

export type Granularity = 'day' | 'week' | 'month';

/** 区间跨度过大时自动聚合，避免曲线数据点过密（FR-E-17 验收标准） */
export function pickGranularity(days: number): Granularity {
  if (days > appConfig.queryTable.monthlyAggregateOverDays) return 'month';
  if (days > appConfig.queryTable.weeklyAggregateOverDays) return 'week';
  return 'day';
}

/** 把一个自然日归到所属的聚合桶（日 = 自身、周 = 周一、月 = 1 号） */
function bucketKey(key: string, g: Granularity): string {
  if (g === 'week') return weekStartKey(key);
  if (g === 'month') return monthStartKey(key);
  return key;
}

/** 横轴标签：按日 / 周聚合给 M-D，按月聚合给「x月」（一个月就是一个点，写日期会误读成某天） */
function bucketLabel(key: string, g: Granularity): string {
  if (g === 'month') return trf('{m}月', { m: parseKey(key).getMonth() + 1 });
  return key.slice(5);
}

/** 曲线上的一个点：`value` 是该点画在纵轴上的取值（含义随视图而定，见 ChartPoint.value） */
export interface ChartPoint {
  key: string;
  label: string;
  /** 纵轴取值：得分率视图 = 百分比、任务数视图 = 个、时长视图 = 分 */
  value: number;
}

export interface TrendPoint extends ChartPoint {
  scoreRate: number;
  count: number;
}

/**
 * 得分变化与趋势（FR-E-19）。
 * 同一项目一天内练了多次时，当日曲线取当天得分率的平均值（FR-E-20）。
 */
export function trendPoints(
  attempts: Attempt[],
  typeId: ExerciseTypeId | null,
  filter: AggregateFilter,
  breakdownLabel: string | null = null,
): { points: TrendPoint[]; granularity: Granularity } {
  const span = diffDays(filter.from, filter.to) + 1;
  const g = pickGranularity(span);
  const scoped = attempts.filter(
    (a) =>
      a.status === 'succeeded' &&
      !a.excluded &&
      (!typeId || a.typeId === typeId) &&
      inRange(a.finishedAt, filter.from, filter.to),
  );
  const buckets = new Map<string, { sum: number; n: number }>();
  scoped.forEach((a) => {
    let rate: number | null = a.scoreRate;
    if (breakdownLabel) {
      const b = a.result?.breakdown.find((x) => x.label === breakdownLabel);
      rate = b && b.max > 0 ? (b.score / b.max) * 100 : null;
    }
    if (rate === null || Number.isNaN(rate)) return;
    const bk = bucketKey(dateKey(new Date(a.finishedAt)), g);
    const prev = buckets.get(bk) ?? { sum: 0, n: 0 };
    prev.sum += rate;
    prev.n += 1;
    buckets.set(bk, prev);
  });
  const points = [...buckets.entries()]
    .sort((a, b) => parseKey(a[0]).getTime() - parseKey(b[0]).getTime())
    .map(([key, v]) => ({
      key,
      label: bucketLabel(key, g),
      value: v.sum / v.n,
      scoreRate: v.sum / v.n,
      count: v.n,
    }));
  return { points, granularity: g };
}

/** 总览第二个面板可切换的逐日指标 */
export type DailyMetric = 'taskCount' | 'durationMin';

/**
 * 逐日完成任务数 / 时长的变化点（总览第二个面板，FR-E-16）。
 * 取 daily 聚合，与练习页打卡的三个计数器同口径；同一天多次练习按日累加，
 * 跨度大时同样按周 / 月聚合（粒度选择同得分率曲线，见 pickGranularity）。
 * 没有练习记录的日子不出点。
 */
export function dailyTrend(
  daily: Record<string, DailyStat>,
  filter: { from: string; to: string },
  metric: DailyMetric,
): { points: ChartPoint[]; granularity: Granularity } {
  const span = diffDays(filter.from, filter.to) + 1;
  const g = pickGranularity(span);
  const buckets = new Map<string, number>();
  Object.keys(daily).forEach((key) => {
    if (diffDays(filter.from, key) < 0 || diffDays(key, filter.to) < 0) return;
    const d = daily[key];
    if (d.taskCount <= 0 && d.durationSec <= 0) return;
    const bk = bucketKey(key, g);
    buckets.set(bk, (buckets.get(bk) ?? 0) + (metric === 'taskCount' ? d.taskCount : d.durationSec / 60));
  });
  const points = [...buckets.entries()]
    .sort((a, b) => parseKey(a[0]).getTime() - parseKey(b[0]).getTime())
    .map(([key, value]) => ({ key, label: bucketLabel(key, g), value }));
  return { points, granularity: g };
}

export interface DeltaResult {
  delta: number;
  direction: 'up' | 'down' | 'flat';
  text: string;
}

/** 当前水平分档（传入哪个时段的平均得分率就按哪个时段评定，能力趋势页传的是当前所选档位） */
export function levelBand(avgScoreRate: number | null): string | null {
  if (avgScoreRate === null) return null;
  const band = appConfig.queryTable.levelBands.find((b) => avgScoreRate >= b.min);
  return band ? band.label : null;
}

/**
 * 由明细重建按日聚合（DR-3：聚合结果与明细记录的口径必须一致，明细被删除时聚合同步失效）。
 */
export function recomputeDaily(
  attempts: Attempt[],
  thresholds: { timeThresholdMin: number; taskThreshold: number },
): Record<string, DailyStat> {
  const out: Record<string, DailyStat> = {};
  const done = attempts.filter((a) => a.status === 'succeeded');
  done.forEach((a) => {
    const key = dateKey(new Date(a.finishedAt));
    const day = out[key] ?? emptyDaily(key);
    const already = day.completedItemIds.includes(a.itemId);
    if (!already) {
      day.taskCount += 1;
      day.durationSec += a.durationSec;
      day.completedItemIds = [...day.completedItemIds, a.itemId];
      const t = day.byType[a.typeId] ?? { count: 0, durationSec: 0, scoreSum: 0, scoreMax: 0 };
      day.byType[a.typeId] = {
        count: t.count + 1,
        durationSec: t.durationSec + a.durationSec,
        scoreSum: t.scoreSum + (a.scoreRate ?? 0),
        scoreMax: t.scoreMax + 100,
      };
      const l = day.byLevel[a.levelId] ?? { count: 0, durationSec: 0 };
      day.byLevel[a.levelId] = { count: l.count + 1, durationSec: l.durationSec + a.durationSec };
    }
    day.qualified = isQualified(day.durationSec, day.taskCount, thresholds.timeThresholdMin, thresholds.taskThreshold);
    out[key] = day;
  });
  return out;
}

