import { describe, expect, it } from 'vitest';
import {
  DWELL_CAP_MS,
  EVENT_NAMES,
  formatDwell,
  formatPct,
  median,
  summarize,
  type TrackedEvent,
} from '@/domain/analytics';

let seq = 0;
function ev(name: string, ts: number, screen: string | null, props?: TrackedEvent['props']): TrackedEvent {
  seq += 1;
  return { id: `e${seq}`, name, ts, session: 's1', screen, props };
}

/** 一次完整访问：进入 ts、离开 ts */
function visit(screen: string, from: number, to: number) {
  return [ev(EVENT_NAMES.screenView, from, screen), ev(EVENT_NAMES.screenLeave, to, screen)];
}

describe('停留配对（页面停留率的计算基础）', () => {
  it('进入与离开成对时，时长记到该页', () => {
    const s = summarize(visit('主页', 0, 5000));
    expect(s.screens).toHaveLength(1);
    expect(s.screens[0]).toMatchObject({ screen: '主页', views: 1, totalMs: 5000, avgMs: 5000 });
  });

  it('换页即结算上一页，不需要显式 leave', () => {
    const s = summarize([
      ev(EVENT_NAMES.screenView, 0, '主页'),
      ev(EVENT_NAMES.screenView, 4000, '练习'),
      ev(EVENT_NAMES.screenLeave, 9000, '练习'),
    ]);
    const home = s.screens.find((r) => r.screen === '主页')!;
    const practice = s.screens.find((r) => r.screen === '练习')!;
    expect(home.totalMs).toBe(4000);
    expect(practice.totalMs).toBe(5000);
  });

  it('单次停留超过 30 分钟按上限截断（挂着页面去吃饭不算学习）', () => {
    const s = summarize(visit('主页', 0, DWELL_CAP_MS * 3));
    expect(s.screens[0].totalMs).toBe(DWELL_CAP_MS);
  });

  it('低于 300ms 的停留视为误触，丢弃', () => {
    const s = summarize(visit('主页', 0, 120));
    expect(s.screens[0].views).toBe(1);
    expect(s.screens[0].totalMs).toBe(0);
    expect(s.totalDwellMs).toBe(0);
  });

  it('没有离开事件的最后一段，用最后一条事件时间兜底，不丢', () => {
    const s = summarize([
      ev(EVENT_NAMES.screenView, 0, '主页'),
      ev(EVENT_NAMES.tap, 3000, '主页', { element: '开始练习' }),
      ev(EVENT_NAMES.tap, 7000, '主页', { element: '开始练习' }),
    ]);
    expect(s.screens[0].totalMs).toBe(7000);
  });

  it('乱序事件按时间排序后再配对（存储顺序不可信）', () => {
    const [view, leave] = visit('主页', 0, 6000);
    const s = summarize([leave, view]);
    expect(s.screens[0].totalMs).toBe(6000);
  });

  it('只有 leave 没有 view 时不产生负时长', () => {
    const s = summarize([ev(EVENT_NAMES.screenLeave, 5000, '主页')]);
    expect(s.totalDwellMs).toBe(0);
    expect(s.screens).toHaveLength(0);
  });
});

describe('停留率指标', () => {
  const s = summarize([
    ...visit('主页', 0, 10_000),
    ...visit('主页', 20_000, 24_000),
    ...visit('练习', 30_000, 31_000),
  ]);

  it('停留占比 = 该页 / 全部，合计约 1', () => {
    const home = s.screens.find((r) => r.screen === '主页')!;
    const practice = s.screens.find((r) => r.screen === '练习')!;
    expect(home.share).toBeCloseTo(14 / 15, 2);
    expect(practice.share).toBeCloseTo(1 / 15, 2);
    expect(s.screens.reduce((acc, r) => acc + r.share, 0)).toBeCloseTo(1, 5);
  });

  it('有效停留率 = 达到门槛的访问次数 / 访问次数（默认 3 秒）', () => {
    const home = s.screens.find((r) => r.screen === '主页')!;
    const practice = s.screens.find((r) => r.screen === '练习')!;
    expect(home.engagedViews).toBe(2);
    expect(home.engagedRate).toBe(1);
    expect(practice.engagedViews).toBe(0);
    expect(practice.engagedRate).toBe(0);
    expect(s.engagedThresholdMs).toBe(3000);
  });

  it('门槛可调（配置化，NFR-6）', () => {
    const custom = summarize([...visit('主页', 0, 2000)], 1500);
    expect(custom.screens[0].engagedRate).toBe(1);
  });

  it('平均会话时长 = 全部停留 / 会话数', () => {
    const events = [...visit('主页', 0, 8000), ev(EVENT_NAMES.appOpen, 0, null), ev(EVENT_NAMES.appOpen, 100, null, undefined)];
    const withSession = summarize([
      { ...ev(EVENT_NAMES.appOpen, 0, null), session: 's1' },
      ...visit('主页', 1000, 9000),
    ]);
    expect(withSession.sessions).toBe(1);
    expect(withSession.avgSessionMs).toBe(8000);
    expect(summarize(events).sessions).toBe(1); // 同一会话多开只算一次
  });
});

describe('点击聚合', () => {
  it('同一页面同一元素累加，按次数降序', () => {
    const s = summarize([
      ev(EVENT_NAMES.tap, 1, '主页', { element: '开始练习' }),
      ev(EVENT_NAMES.tap, 2, '主页', { element: '开始练习' }),
      ev(EVENT_NAMES.tap, 3, '主页', { element: '查词' }),
      ev(EVENT_NAMES.tap, 4, '练习', { element: '开始练习' }),
    ]);
    expect(s.taps[0]).toMatchObject({ element: '开始练习', screen: '主页', count: 2 });
    expect(s.taps).toHaveLength(3);
  });

  it('元素名缺失时归到「未命名」，不让 key 变 undefined', () => {
    const s = summarize([ev(EVENT_NAMES.tap, 1, '主页')]);
    expect(s.taps[0].element).toBe('未命名');
  });
});

describe('空数据与工具函数', () => {
  it('没有事件时全部为 0，不出现 NaN', () => {
    const s = summarize([]);
    expect(s).toMatchObject({ eventCount: 0, sessions: 0, totalDwellMs: 0, avgSessionMs: 0, firstTs: 0, lastTs: 0 });
    expect(s.screens).toEqual([]);
    expect(s.taps).toEqual([]);
  });

  it('事件计数与时间范围', () => {
    const s = summarize([ev(EVENT_NAMES.tap, 100, '主页'), ev(EVENT_NAMES.tap, 900, '主页')]);
    expect(s.eventCount).toBe(2);
    expect(s.firstTs).toBe(100);
    expect(s.lastTs).toBe(900);
    expect(s.counts[0]).toEqual({ name: 'tap', count: 2 });
  });

  it('中位数：奇数取中间，偶数取两侧平均', () => {
    expect(median([])).toBe(0);
    expect(median([3000, 1000, 2000])).toBe(2000);
    expect(median([1000, 2000])).toBe(1500);
  });

  it('文案格式：秒保留一位小数，占比取整', () => {
    expect(formatDwell(12400)).toBe('12.4 秒');
    expect(formatDwell(0)).toBe('0 秒');
    expect(formatDwell(90_000)).toBe('2 分');
    expect(formatPct(0.899)).toBe('90%');
    expect(formatPct(2)).toBe('100%');
    expect(formatPct(-1)).toBe('0%');
  });
});
