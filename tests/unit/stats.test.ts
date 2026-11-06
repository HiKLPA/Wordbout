import { describe, expect, it } from 'vitest';
import {
  aggregate,
  dailyTrend,
  emptyDaily,
  isQualified,
  levelBand,
  pickGranularity,
  recomputeDaily,
  trendPoints,
} from '@/domain/stats';
import { dateKey } from '@/domain/date';
import { appConfig, exerciseTypeMap } from '@/config/appConfig';
import { attempt, day, qualifiedDay, thresholdDefaults } from './fixtures';

const TH = thresholdDefaults();

/** 统计区间：取「今天往前 30 天」，让 daily 与 attempts 落在同一窗口里 */
function window30() {
  const now = new Date();
  const to = dateKey(now);
  const from = dateKey(new Date(now.getTime() - 29 * 86_400_000));
  return { from, to };
}

describe('达标判定（FR-E-1 / FR-E-2 / FR-E-3）', () => {
  it('时长或任务数任一满足即达标（当前配置为 either）', () => {
    expect(isQualified(TH.timeThresholdMin * 60, 0, TH.timeThresholdMin, TH.taskThreshold)).toBe(true);
    expect(isQualified(0, TH.taskThreshold, TH.timeThresholdMin, TH.taskThreshold)).toBe(true);
    expect(isQualified(TH.timeThresholdMin * 60 - 1, TH.taskThreshold - 1, TH.timeThresholdMin, TH.taskThreshold)).toBe(false);
  });

  it('边界值：正好等于门槛算达标，差 1 秒不算', () => {
    expect(isQualified(300, 5, 5, 5)).toBe(true);
    expect(isQualified(299, 5, 5, 5)).toBe(true); // 任务数够
    expect(isQualified(299, 4, 5, 5)).toBe(false);
  });

  it('门槛可配：改成只看时长时，任务数再多也不算', () => {
    const original = appConfig.streak.qualifyRule;
    try {
      appConfig.streak.qualifyRule = 'time';
      expect(isQualified(0, 999, 5, 5)).toBe(false);
      expect(isQualified(300, 0, 5, 5)).toBe(true);
    } finally {
      appConfig.streak.qualifyRule = original;
    }
  });
});

describe('按日聚合重算（DR-3：聚合与明细必须同口径）', () => {
  it('同一道题重复提交只计一次', () => {
    const t = Date.now();
    const daily = recomputeDaily(
      [
        attempt({ typeId: 'dictation', itemId: 'w1', durationSec: 60, finishedAt: t }),
        attempt({ typeId: 'dictation', itemId: 'w1', durationSec: 60, finishedAt: t }),
      ],
      TH,
    );
    const k = dateKey(new Date(t));
    expect(daily[k].taskCount).toBe(1);
    expect(daily[k].durationSec).toBe(60);
    expect(daily[k].completedItemIds).toEqual(['w1']);
  });

  it('评分失败的作答不计入', () => {
    const t = Date.now();
    const daily = recomputeDaily(
      [
        attempt({ typeId: 'dictation', itemId: 'w1', finishedAt: t }),
        attempt({ typeId: 'dictation', itemId: 'w2', status: 'failed', scoreRate: null, finishedAt: t }),
      ],
      TH,
    );
    expect(daily[dateKey(new Date(t))].taskCount).toBe(1);
  });

  it('测验作答（excluded）不计入三计数器 —— 与 finishAttempt 的增量口径一致', () => {
    const t = Date.now();
    const daily = recomputeDaily(
      [
        attempt({ typeId: 'dictation', itemId: 'w1', finishedAt: t }),
        attempt({ typeId: 'dictation', itemId: 'q1', excluded: true, finishedAt: t }),
      ],
      TH,
    );
    expect(daily[dateKey(new Date(t))].taskCount).toBe(1);
    expect(daily[dateKey(new Date(t))].byType.dictation.count).toBe(1);
  });

  it('达标标记随累计变化，不依赖写入时机', () => {
    const t = new Date(2026, 10, 6, 10, 0, 0).getTime();
    const daily = recomputeDaily(
      Array.from({ length: 5 }, (_, i) =>
        attempt({ typeId: 'dictation', itemId: `w${i}`, durationSec: 60, scoreRate: 90, finishedAt: t }),
      ),
      TH,
    );
    const d = daily['2026-11-06'];
    expect(d.taskCount).toBe(5);
    expect(d.qualified).toBe(true);
    expect(d.byType.dictation.scoreSum).toBe(450);
    expect(d.byType.dictation.scoreMax).toBe(500);
  });
});

describe('区间聚合（FR-E-16 ~ FR-E-20）', () => {
  const { from, to } = window30();
  const todayKey = dateKey(new Date());
  const daily = { [todayKey]: { ...emptyDaily(todayKey), durationSec: 600, taskCount: 3 } };

  it('剔除测验与失败记录，只统计成功且未排除的作答', () => {
    const res = aggregate(
      [
        attempt({ typeId: 'dictation', itemId: 'a', scoreRate: 100, finishedAt: Date.now() }),
        attempt({ typeId: 'dictation', itemId: 'b', scoreRate: 60, excluded: true, finishedAt: Date.now() }),
        attempt({ typeId: 'dictation', itemId: 'c', status: 'failed', scoreRate: null, finishedAt: Date.now() }),
      ],
      daily,
      { from, to },
      ['dictation', 'comprehension'],
      (t) => exerciseTypeMap[t].board,
    );
    const row = res.byType.find((r) => r.typeId === 'dictation')!;
    expect(row.count).toBe(1);
    expect(row.avgScore).toBe(100);
  });

  it('练习天数、时长、任务数取 daily，不用作答条数重算', () => {
    const res = aggregate(
      [attempt({ typeId: 'dictation', itemId: 'a', finishedAt: Date.now() })],
      daily,
      { from, to },
      ['dictation'],
      (t) => exerciseTypeMap[t].board,
    );
    expect(res.practiceDays).toBe(1);
    expect(res.totalDurationSec).toBe(600);
    expect(res.totalTaskCount).toBe(3);
  });

  it('区间外（上个月）的作答不计入', () => {
    const old = new Date();
    old.setMonth(old.getMonth() - 3);
    const res = aggregate(
      [attempt({ typeId: 'dictation', itemId: 'old', finishedAt: old.getTime() })],
      {},
      { from, to },
      ['dictation'],
      (t) => exerciseTypeMap[t].board,
    );
    expect(res.byType[0].count).toBe(0);
    expect(res.avgScoreRate).toBeNull();
  });

  it('题型筛选与区块汇总互不串味', () => {
    const now = Date.now();
    const res = aggregate(
      [
        attempt({ typeId: 'dictation', itemId: 'a', scoreRate: 100, finishedAt: now }),
        attempt({ typeId: 'writing-passage', itemId: 'b', scoreRate: 60, finishedAt: now }),
      ],
      {},
      { from, to },
      ['dictation', 'writing-passage'],
      (t) => exerciseTypeMap[t].board,
    );
    const listening = res.byBoard.find((b) => b.board === 'listening')!;
    const writing = res.byBoard.find((b) => b.board === 'writing')!;
    expect(listening.count).toBe(1);
    expect(writing.count).toBe(1);
    expect(res.avgScoreRate).toBe(80);
  });
});

describe('趋势点（FR-E-19）', () => {
  it('同一天多次练习取当日平均', () => {
    const base = new Date(2026, 10, 6, 9, 0, 0).getTime();
    const res = trendPoints(
      [
        attempt({ typeId: 'dictation', itemId: 'a', scoreRate: 80, finishedAt: base }),
        attempt({ typeId: 'dictation', itemId: 'b', scoreRate: 100, finishedAt: base + 3600_000 }),
      ],
      'dictation',
      { from: '2026-11-01', to: '2026-11-07' },
    );
    expect(res.points).toHaveLength(1);
    expect(res.points[0].value).toBe(90);
    expect(res.points[0].count).toBe(2);
  });

  it('没有评分的记录不出点，避免曲线掉到 0', () => {
    const res = trendPoints(
      [attempt({ typeId: 'dictation', itemId: 'a', scoreRate: null, finishedAt: Date.now() })],
      'dictation',
      { from: '2026-11-01', to: '2026-11-07' },
    );
    expect(res.points).toHaveLength(0);
  });
});

describe('粒度选择与逐日曲线', () => {
  it('30 天仍按日，31 天升到周，超过 60 天升到月', () => {
    expect(pickGranularity(30)).toBe('day');
    expect(pickGranularity(31)).toBe('week');
    expect(pickGranularity(60)).toBe('week');
    expect(pickGranularity(61)).toBe('month');
  });

  it('跨月区间按月聚合时，横轴是月而不是日', () => {
    const daily = { '2026-09-10': day('2026-09-10', 600, 6), '2026-10-01': day('2026-10-01', 300, 3) };
    const res = dailyTrend(daily, { from: '2026-07-01', to: '2026-10-31' }, 'taskCount');
    expect(res.granularity).toBe('month');
    expect(res.points.map((p) => p.label)).toEqual(['9月', '10月']);
    expect(res.points.map((p) => p.value)).toEqual([6, 3]);
  });

  it('时长为 0 的天不出点', () => {
    const res = dailyTrend({ '2026-11-06': emptyDaily('2026-11-06') }, { from: '2026-11-01', to: '2026-11-07' }, 'durationMin');
    expect(res.points).toHaveLength(0);
  });
});

describe('当前水平分档', () => {
  it('按平均得分率落到配置档位', () => {
    expect(levelBand(95)).toBe('熟练');
    expect(levelBand(82)).toBe('良好');
    expect(levelBand(null)).toBeNull();
  });
});

describe('达标日的聚合结果与打卡卡片一致', () => {
  it('qualifiedDay 生成的日聚合正好达标', () => {
    const d = qualifiedDay('2026-11-06');
    expect(isQualified(d.durationSec, d.taskCount, TH.timeThresholdMin, TH.taskThreshold)).toBe(true);
    expect(day('2026-11-06', 60, 1).qualified).toBe(false);
  });
});
