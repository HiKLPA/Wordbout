import { formatDurationHuman } from '@/domain/date';
import { trf } from '@/i18n';

/**
 * 埋点的数据形状与聚合口径（NFR-6：关键流程埋点可追踪）。
 *
 * 这一层只做纯计算，不碰存储也不碰网络：
 * - 事件是**事实**，聚合是**派生物**，任何页面要看统计都调 `summarize()`，不各算各的；
 * - 页面停留时长由 `screen_view` / `screen_leave` 成对配对得出，不依赖页面自己上报。
 *
 * 口径（三处页面共用同一份定义，见 `MEMORY` 的数据口径约定）：
 * - 停留时长 = 进入该页到离开该页之间的时间，超过 `DWELL_CAP_MS` 按上限截断（后台挂着不算学习）；
 * - 停留占比 = 该页停留总时长 ÷ 全部页面停留总时长；
 * - 有效停留率 = 停留时长达到门槛的访问次数 ÷ 该页访问次数。
 */

/** 事件附加字段：只允许标量，便于序列化与聚合 */
export type EventProps = Record<string, string | number | boolean>;

export interface TrackedEvent {
  /** 本机唯一 id，用于去重与按条删除 */
  id: string;
  /** 事件名，蛇形，见 EVENT_NAMES */
  name: string;
  /** 发生时间（毫秒） */
  ts: number;
  /** 会话 id：一次冷启动算一段 */
  session: string;
  /** 事件发生时用户所在的页面（页面名，中文原文为键） */
  screen: string | null;
  props?: EventProps;
}

/** 事件名清单：改名字会断历史数据，新增只往后加 */
export const EVENT_NAMES = {
  appOpen: 'app_open',
  appBackground: 'app_background',
  screenView: 'screen_view',
  screenLeave: 'screen_leave',
  tap: 'tap',
  translateQuery: 'translate_query',
  exerciseSubmit: 'exercise_submit',
  gradeResult: 'grade_result',
  favoriteToggle: 'favorite_toggle',
  settingsChange: 'settings_change',
  /** 补签：看「一周一次」的额度是不是够用，也看补签会不会被当成常规操作 */
  makeup: 'makeup_day',
  /** 每日提醒：排程 / 撤掉 / 权限被拒（只记结果，不记内容） */
  reminder: 'reminder_sync',
} as const;

/** 单次停留上限：超过半小时按半小时算，避免「开着页面去吃饭」污染均值 */
export const DWELL_CAP_MS = 30 * 60 * 1000;
/** 低于该时长的停留视为误触（切页动画期间的一瞬），不计入 */
const DWELL_FLOOR_MS = 300;

export interface DwellRow {
  screen: string;
  /** 被访问次数 */
  views: number;
  totalMs: number;
  avgMs: number;
  medianMs: number;
  /** 停留占比 0~1 */
  share: number;
  /** 有效停留率 0~1 */
  engagedRate: number;
  engagedViews: number;
}

export interface TapRow {
  element: string;
  /** 点击发生时所在页面 */
  screen: string;
  count: number;
}

export interface AnalyticsSummary {
  eventCount: number;
  /** 冷启动次数 */
  sessions: number;
  /** 全部页面停留总时长 */
  totalDwellMs: number;
  /** 平均每次会话的页面停留时长 */
  avgSessionMs: number;
  /** 有效停留门槛（毫秒），与统计一起返回，避免界面与计算口径各写一个数 */
  engagedThresholdMs: number;
  screens: DwellRow[];
  taps: TapRow[];
  counts: { name: string; count: number }[];
  firstTs: number;
  lastTs: number;
}

export function median(list: number[]): number {
  if (!list.length) return 0;
  const sorted = [...list].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** 汇总一份事件流。输入顺序不限，内部按时间排序后再配对停留。 */
export function summarize(events: TrackedEvent[], engagedThresholdMs = 3000): AnalyticsSummary {
  const ordered = [...events].sort((a, b) => a.ts - b.ts);
  const dwell = new Map<string, number[]>();
  const views = new Map<string, number>();
  const taps = new Map<string, TapRow>();
  const counts = new Map<string, number>();
  const sessions = new Set<string>();
  let totalDwellMs = 0;
  let open: { screen: string; ts: number } | null = null;

  /** 关闭当前这次页面停留，把时长记到它自己那个页面上 */
  const close = (endTs: number) => {
    if (!open) return;
    const ms = Math.max(0, Math.min(endTs - open.ts, DWELL_CAP_MS));
    if (ms >= DWELL_FLOOR_MS) {
      const arr = dwell.get(open.screen);
      if (arr) arr.push(ms);
      else dwell.set(open.screen, [ms]);
      totalDwellMs += ms;
    }
    open = null;
  };

  for (const e of ordered) {
    counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
    if (e.name === EVENT_NAMES.appOpen) {
      sessions.add(e.session);
    } else if (e.name === EVENT_NAMES.screenView) {
      // 换页即结算上一页；同一页重复上报（刷新）也照常重开
      close(e.ts);
      const screen = e.screen ?? '—';
      views.set(screen, (views.get(screen) ?? 0) + 1);
      open = { screen, ts: e.ts };
    } else if (e.name === EVENT_NAMES.screenLeave) {
      close(e.ts);
    } else if (e.name === EVENT_NAMES.tap) {
      const element = String(e.props?.element ?? '未命名');
      const screen = e.screen ?? '—';
      const key = `${screen}|${element}`;
      const row = taps.get(key);
      if (row) row.count += 1;
      else taps.set(key, { element, screen, count: 1 });
    }
  }
  // 最后一段没有 leave（直接杀进程 / 冷退出）：用最后一条事件的时间兜底，不丢这一段
  if (open) close(ordered.length ? ordered[ordered.length - 1].ts : 0);

  const screens: DwellRow[] = [...views.entries()]
    .map(([screen, viewCount]) => {
      const list = dwell.get(screen) ?? [];
      const sum = list.reduce((acc, v) => acc + v, 0);
      const engagedViews = list.filter((v) => v >= engagedThresholdMs).length;
      return {
        screen,
        views: viewCount,
        totalMs: sum,
        avgMs: list.length ? Math.round(sum / list.length) : 0,
        medianMs: median(list),
        share: totalDwellMs > 0 ? sum / totalDwellMs : 0,
        engagedRate: list.length ? engagedViews / list.length : 0,
        engagedViews,
      };
    })
    .sort((a, b) => b.totalMs - a.totalMs || b.views - a.views);

  return {
    eventCount: ordered.length,
    sessions: sessions.size,
    totalDwellMs,
    avgSessionMs: sessions.size ? Math.round(totalDwellMs / sessions.size) : 0,
    engagedThresholdMs,
    screens,
    taps: [...taps.values()].sort((a, b) => b.count - a.count),
    counts: [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    firstTs: ordered.length ? ordered[0].ts : 0,
    lastTs: ordered.length ? ordered[ordered.length - 1].ts : 0,
  };
}

/** 停留时长文案：不足一分钟带一位小数（12.4 秒），再长走统一的时长格式 */
export function formatDwell(ms: number): string {
  if (ms <= 0) return trf('{v} 秒', { v: 0 });
  if (ms < 60_000) return trf('{v} 秒', { v: (ms / 1000).toFixed(1) });
  return formatDurationHuman(Math.round(ms / 1000));
}

/** 百分比文案：占比与有效率共用，统一保留整数位 */
export function formatPct(ratio: number): string {
  return `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
}
