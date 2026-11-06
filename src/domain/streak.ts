import { appConfig } from '@/config/appConfig';
import { addDays, diffDays, weekStartKey } from '@/domain/date';
import { isQualified } from '@/domain/stats';
import type { DailyStat } from '@/domain/types';

/**
 * 打卡口径的唯一实现（FR-E-1）。
 *
 * 三处都用这一份，避免「练习页显示 7 天、日历显示 6 天」这类对不上的问题：
 * - 练习页页头的连续天数（store 的 `streak`）；
 * - 练习日历里每个格子的标记；
 * - 补签的额度与可行性判断。
 *
 * 「达标」= 当日时长或任务数达到门槛（规则见 `appConfig.streak.qualifyRule`）；
 * 「补签」= 当天没练、但事后把这一天补记为达标 —— 它只作用于连续天数与日历标记，
 * **不动 `daily` 里的时长与任务数**，统计口径仍以作答明细为准（DR-3）。
 */

export interface StreakThresholds {
  /** 当日时长门槛（分钟） */
  timeThresholdMin: number;
  /** 当日任务数门槛 */
  taskThreshold: number;
}

/** 日历格子的四种状态 */
export type DayMark = 'qualified' | 'makeup' | 'practiced' | 'none';

/** 某天是否达标（只看作答明细，不含补签） */
export function isDayQualified(
  day: DailyStat | undefined,
  thresholds: StreakThresholds,
): boolean {
  if (!day) return false;
  return isQualified(day.durationSec, day.taskCount, thresholds.timeThresholdMin, thresholds.taskThreshold);
}

/** 某天在日历里的标记：达标 / 补签 / 有练习未达标 / 没练 */
export function dayMark(
  daily: Record<string, DailyStat>,
  makeups: Record<string, number>,
  thresholds: StreakThresholds,
  key: string,
): DayMark {
  if (isDayQualified(daily[key], thresholds)) return 'qualified';
  if (makeups[key]) return 'makeup';
  const day = daily[key];
  return day && (day.taskCount > 0 || day.durationSec > 0) ? 'practiced' : 'none';
}

/** 某天是否算「签到」（达标或已补签）—— 连续天数按它递增 */
export function daySigned(
  daily: Record<string, DailyStat>,
  makeups: Record<string, number>,
  thresholds: StreakThresholds,
  key: string,
): boolean {
  return isDayQualified(daily[key], thresholds) || Boolean(makeups[key]);
}

/**
 * 连续天数：从今天（或今天未达标时从昨天）往回数，遇到没签到的一天就停。
 * `todayQualified` 传的是「含进行中会话」的今日状态 —— 计时器还在跑时连续天数也要跟着动。
 */
export function computeStreak(args: {
  daily: Record<string, DailyStat>;
  makeups: Record<string, number>;
  thresholds: StreakThresholds;
  today: string;
  /** 今日的实时达标状态（含未结算的会话秒数）；不传则只看已落库的 daily */
  todayQualified?: boolean;
}): { streak: number; todayQualified: boolean } {
  const { daily, makeups, thresholds, today } = args;
  const signed = (k: string) => daySigned(daily, makeups, thresholds, k);
  const qualifiedToday = signed(today) || Boolean(args.todayQualified);

  let count = 0;
  let cur = qualifiedToday ? today : addDays(today, -1);
  let guard = 0;
  while (signed(cur) && guard < 3650) {
    count += 1;
    cur = addDays(cur, -1);
    guard += 1;
  }
  return { streak: count, todayQualified: qualifiedToday };
}

/** 某天所属自然周的起点（周一）—— 补签额度按它归组 */
export function makeupWeekOf(key: string): string {
  return weekStartKey(key);
}

/** 某一周已经用掉的补签次数 */
export function makeupUsedInWeek(makeups: Record<string, number>, weekStart: string): number {
  return Object.keys(makeups).filter((k) => weekStartKey(k) === weekStart).length;
}

/** 某一周还剩几次补签（额度来自 `appConfig.streak.makeup.perWeek`，当前为 1） */
export function makeupLeftInWeek(makeups: Record<string, number>, weekStart: string): number {
  return Math.max(0, appConfig.streak.makeup.perWeek - makeupUsedInWeek(makeups, weekStart));
}

/** 补签结果：页面据此决定提示什么 */
export type MakeupResult =
  /** 补签成功 */
  | 'ok'
  /** 今天与未来不能补签 */
  | 'invalid'
  /** 超出回溯窗口（默认 30 天） */
  | 'window'
  /** 这天本来就已达标 / 已补签 */
  | 'done'
  /** 这一周的免费额度已用完 */
  | 'quota';

/**
 * 能不能补签（纯判断，不写状态）：store 的 `makeUpDay` 与日历页的按钮态都用它。
 * 规则：今天之前、回溯窗口内、该天没达标也没补过、该天所在的这一周还有额度。
 */
export function canMakeUp(args: {
  daily: Record<string, DailyStat>;
  makeups: Record<string, number>;
  thresholds: StreakThresholds;
  key: string;
  today: string;
}): MakeupResult {
  const { daily, makeups, thresholds, key, today } = args;
  /* YYYY-MM-DD 定长字符串可直接比较，不必再转日期 */
  if (key >= today) return 'invalid';
  if (diffDays(key, today) > appConfig.streak.makeup.windowDays) return 'window';
  if (daySigned(daily, makeups, thresholds, key)) return 'done';
  if (makeupLeftInWeek(makeups, weekStartKey(key)) <= 0) return 'quota';
  return 'ok';
}
