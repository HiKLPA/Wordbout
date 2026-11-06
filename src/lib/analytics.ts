import { Platform } from 'react-native';

import { appConfig } from '@/config/appConfig';
import { APP_VERSION } from '@/content/legal';
import { EVENT_NAMES, type EventProps, type TrackedEvent } from '@/domain/analytics';
import { loadJSON, removeJSON, saveJSON, utf8Length } from '@/lib/storage';

/**
 * 埋点采集与本地队列（NFR-6：进入、开始、提交、评分成功与失败可追踪）。
 *
 * 设计取舍：
 * - **先落本地，再谈上报**。队列写在设备存储里，没网、没后端也能完整回看，不丢事件；
 *   配了 `appConfig.analytics.endpoint` 才真的发出去，默认只在本地。
 * - **不阻塞交互**。`track()` 是同步的内存追加，落盘做了 600ms 防抖，
 *   写失败静默（下次变更会重写全量），任何埋点异常都不许冒泡到界面。
 * - **有上限**。队列超过 `maxEvents` 丢最旧的，避免长期不用把存储撑爆。
 * - **默认开、可关**。用户在设置里关掉后立刻停止采集，已有数据保留到他手动清空。
 */

const QUEUE_KEY = 'analytics:queue';

let enabled = false;
let loaded = false;
let queue: TrackedEvent[] = [];
let sessionId = '';
let sessionStart = 0;
/** 最近一次进入前台的时刻：用于算「这次在前台待了多久」，重复切后台不会累加 */
let activeSince = 0;
let currentScreen: string | null = null;
let seq = 0;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let sending = false;

/** 开关：设置页的「使用数据统计」与隐私同意状态共同决定 */
export function setAnalyticsEnabled(value: boolean): void {
  enabled = value;
}

export function analyticsEnabled(): boolean {
  return enabled;
}

function maxEvents(): number {
  return appConfig.analytics.maxEvents;
}

function scheduleSave(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void saveJSON(QUEUE_KEY, queue);
  }, 600);
}

function push(name: string, props?: EventProps, screen?: string | null): void {
  if (!enabled) return;
  const event: TrackedEvent = {
    id: `${Date.now().toString(36)}-${(seq++).toString(36)}`,
    name,
    ts: Date.now(),
    session: sessionId || 'none',
    screen: screen === undefined ? currentScreen : screen,
  };
  if (props) event.props = props;
  queue.push(event);
  if (queue.length > maxEvents()) queue = queue.slice(-maxEvents());
  scheduleSave();
}

/** 读回上次没来得及落盘的队列（冷启动时调用一次，之后再调无副作用） */
export async function initAnalytics(): Promise<void> {
  if (loaded) return;
  loaded = true;
  const stored = await loadJSON<TrackedEvent[]>(QUEUE_KEY);
  if (Array.isArray(stored) && stored.length) {
    queue = [...stored, ...queue].slice(-maxEvents());
  }
}

/** 冷启动：开一段会话，记下版本、平台与界面语言，便于按维度切分 */
export function startSession(locale: string): void {
  sessionId = `s${Date.now().toString(36)}`;
  sessionStart = Date.now();
  activeSince = sessionStart;
  push(EVENT_NAMES.appOpen, { version: APP_VERSION, platform: Platform.OS, locale });
}

/** 切到后台：结算当前页面停留，记一段后台时长并立刻落盘 */
export function endSession(): void {
  // iOS 会连发 inactive → background，用 activeSince 兜住，避免记两次
  if (!sessionId || !activeSince) return;
  if (currentScreen) {
    push(EVENT_NAMES.screenLeave, undefined, currentScreen);
    currentScreen = null;
  }
  push(EVENT_NAMES.appBackground, { ms: Date.now() - activeSince });
  activeSince = 0;
  void flushNow();
}

/** 回到前台：重新开始计「在前台的时间」，页面停留由调用方紧接着重新开一段 */
export function resumeSession(): void {
  activeSince = Date.now();
}

/**
 * 切换页面：先结算上一页的停留（`screen_leave` 与上一条 `screen_view` 成对），再开新的一页。
 * 同一个页面重复调用是空操作，避免返回键连点刷出一堆零长度的停留。
 */
export function trackScreen(next: string | null): void {
  if (next === currentScreen) return;
  if (currentScreen) push(EVENT_NAMES.screenLeave, undefined, currentScreen);
  currentScreen = next;
  if (next) push(EVENT_NAMES.screenView, undefined, next);
}

/** 记一个业务事件（带当前页面） */
export function track(name: string, props?: EventProps): void {
  push(name, props);
}

/** 记一次点击。`element` 建议传界面上的中文原文（既是展示名也是稳定键） */
export function trackTap(element: string, extra?: EventProps): void {
  push(EVENT_NAMES.tap, { element, ...(extra ?? {}) });
}

/** 立即落盘；队列攒够 `flushThreshold` 条时顺带上报 */
export async function flushNow(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await saveJSON(QUEUE_KEY, queue);
  if (queue.length >= appConfig.analytics.flushThreshold) await sendRemote();
}

async function sendRemote(): Promise<void> {
  const endpoint = appConfig.analytics.endpoint;
  if (!endpoint || sending) return;
  sending = true;
  const batch = queue.slice(-maxEvents());
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ events: batch }),
    });
    if (!res.ok) return;
    // 只删掉这一批真的发成功的，期间新产生的事件留在队里
    const sent = new Set(batch.map((e) => e.id));
    queue = queue.filter((e) => !sent.has(e.id));
    await saveJSON(QUEUE_KEY, queue);
  } catch {
    // 离线或服务不可用：留在本地，下次攒够再发（不做重试风暴）
  } finally {
    sending = false;
  }
}

export interface AnalyticsSnapshot {
  events: TrackedEvent[];
  /** 本地队列占用的字节数，导出前给用户一个体量预期 */
  bytes: number;
}

/** 读全量事件（按时间正序），供统计页与导出使用 */
export async function readAnalytics(): Promise<AnalyticsSnapshot> {
  if (!loaded) await initAnalytics();
  const events = [...queue].sort((a, b) => a.ts - b.ts);
  return { events, bytes: utf8Length(JSON.stringify(events)) };
}

/** 清空本地埋点数据（不影响学习记录） */
export async function clearAnalytics(): Promise<void> {
  queue = [];
  sessionId = '';
  activeSince = 0;
  currentScreen = null;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await removeJSON(QUEUE_KEY);
}

/**
 * 页面名映射：底栏五个一级页面直接给中文名，二级页面按路由段归到一个可读的名字。
 * 存中文原文是因为它同时是 i18n 的键（界面渲染时走 `tr()`，英文界面下照样是英文）。
 */
const TAB_LABELS: Record<string, string> = {
  '/': '主页',
  '/exercise': '练习',
  '/textbook': '课本',
  '/explore': '探索',
  '/more': '更多',
};

const SEGMENT_LABELS: Record<string, string> = {
  practice: '练习作答',
  accumulation: '积累测验',
  sets: '题集',
  attempt: '作答回顾',
  library: '词库详情',
  favorites: '收藏夹',
  folders: '收藏夹管理',
  'query-table': '能力趋势',
  stats: '学习统计',
  settings: '设置',
  profile: '个人资料',
  translate: '翻译',
  scan: '拍照翻译',
  voice: '语音翻译',
  'qr-login': '账号',
  privacy: '隐私与协议',
  'privacy-consent': '隐私授权',
  about: '关于',
  onboarding: '引导页',
  analytics: '数据统计',
  'practice-calendar': '练习日历',
};

export function screenLabelOf(pathname: string): string {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const tab = TAB_LABELS[clean];
  if (tab) return tab;
  const segment = clean.split('/')[1] ?? '';
  return SEGMENT_LABELS[segment] ?? (segment || '—');
}
