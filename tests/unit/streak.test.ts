import { describe, expect, it } from 'vitest';
import {
  canMakeUp,
  computeStreak,
  dayMark,
  daySigned,
  makeupLeftInWeek,
  makeupUsedInWeek,
} from '@/domain/streak';
import { addDays, weekStartKey } from '@/domain/date';
import { appConfig } from '@/config/appConfig';
import type { DailyStat } from '@/domain/types';
import { day, qualifiedDay, thresholdDefaults } from './fixtures';

const TH = thresholdDefaults();
/** 固定「今天」为周五，避免用例随运行日期漂移 */
const TODAY = '2026-11-06';

function build(spec: Record<string, 'q' | 'p' | 'none'>, makeups: Record<string, number> = {}) {
  const daily: Record<string, DailyStat> = {};
  Object.entries(spec).forEach(([offset, kind]) => {
    const key = addDays(TODAY, Number(offset));
    if (kind === 'q') daily[key] = qualifiedDay(key);
    else if (kind === 'p') daily[key] = day(key, 60, 1);
  });
  return { daily, makeups };
}

describe('日历标记（四种状态）', () => {
  const { daily, makeups } = build({ '0': 'q', '-1': 'p', '-2': 'none' }, { [addDays(TODAY, -3)]: 1 });

  it('达标 / 有练习未达标 / 补签 / 没练 各自可辨', () => {
    expect(dayMark(daily, makeups, TH, TODAY)).toBe('qualified');
    expect(dayMark(daily, makeups, TH, addDays(TODAY, -1))).toBe('practiced');
    expect(dayMark(daily, makeups, TH, addDays(TODAY, -3))).toBe('makeup');
    expect(dayMark(daily, makeups, TH, addDays(TODAY, -2))).toBe('none');
  });

  it('补签只影响「是否算签到」，不改「这天有没有练习」的标记优先级', () => {
    // 同一天既达标又补过签时，仍记「达标」——补签不能覆盖真实数据
    const m = { ...makeups, [TODAY]: 1 };
    expect(dayMark(daily, m, TH, TODAY)).toBe('qualified');
    expect(daySigned(daily, m, TH, TODAY)).toBe(true);
  });
});

describe('连续天数（FR-E-1）', () => {
  it('今天达标：从今天往回数', () => {
    const { daily, makeups } = build({ '0': 'q', '-1': 'q', '-2': 'q' });
    expect(computeStreak({ daily, makeups, thresholds: TH, today: TODAY })).toEqual({
      streak: 3,
      todayQualified: true,
    });
  });

  it('今天还没达标：从昨天往回数，不把今天算成断点', () => {
    const { daily, makeups } = build({ '-1': 'q', '-2': 'q' });
    expect(computeStreak({ daily, makeups, thresholds: TH, today: TODAY })).toEqual({
      streak: 2,
      todayQualified: false,
    });
  });

  it('中间漏一天就断，不跨过空缺继续累加', () => {
    const { daily, makeups } = build({ '0': 'q', '-1': 'none', '-2': 'q', '-3': 'q' });
    expect(computeStreak({ daily, makeups, thresholds: TH, today: TODAY }).streak).toBe(1);
  });

  it('补签能把断开的两段接起来', () => {
    const { daily } = build({ '0': 'q', '-1': 'none', '-2': 'q' });
    const makeups = { [addDays(TODAY, -1)]: 1 };
    expect(computeStreak({ daily, makeups: {}, thresholds: TH, today: TODAY }).streak).toBe(1);
    expect(computeStreak({ daily, makeups, thresholds: TH, today: TODAY }).streak).toBe(3);
  });

  it('有练习但没达标不算签到', () => {
    const { daily, makeups } = build({ '0': 'p', '-1': 'q' });
    expect(computeStreak({ daily, makeups, thresholds: TH, today: TODAY })).toEqual({
      streak: 1,
      todayQualified: false,
    });
  });

  it('实时会话（todayQualified）能把今天算进连续段', () => {
    const { daily, makeups } = build({ '-1': 'q' });
    expect(computeStreak({ daily, makeups, thresholds: TH, today: TODAY }).streak).toBe(1);
    expect(
      computeStreak({ daily, makeups, thresholds: TH, today: TODAY, todayQualified: true }).streak,
    ).toBe(2);
  });

  it('没有任何记录时连续 0 天，不会死循环', () => {
    expect(computeStreak({ daily: {}, makeups: {}, thresholds: TH, today: TODAY }).streak).toBe(0);
  });

  it('长连续段（400 天）能算完，性能可接受', () => {
    const spec: Record<string, 'q'> = {};
    for (let i = 0; i < 400; i += 1) spec[`${-i}`] = 'q';
    const { daily } = build(spec);
    expect(computeStreak({ daily, makeups: {}, thresholds: TH, today: TODAY }).streak).toBe(400);
  });
});

describe('补签额度（每周 perWeek 次）', () => {
  it('同一自然周内第二次补签被拦下', () => {
    const weekStart = weekStartKey(TODAY);
    const used = { [TODAY]: 1 };
    expect(makeupUsedInWeek(used, weekStart)).toBe(1);
    expect(makeupLeftInWeek(used, weekStart)).toBe(appConfig.streak.makeup.perWeek - 1);
  });

  it('额度按被补那天所在的周归组，不按今天所在的周', () => {
    const lastWeek = addDays(weekStartKey(TODAY), -3); // 上一周的周四
    const used = { [lastWeek]: 1 };
    // 上周已用完，不影响本周额度
    expect(makeupLeftInWeek(used, weekStartKey(lastWeek))).toBe(0);
    expect(makeupLeftInWeek(used, weekStartKey(TODAY))).toBe(appConfig.streak.makeup.perWeek);
  });

  it('额度不会变负数', () => {
    const weekStart = weekStartKey(TODAY);
    const used = { [TODAY]: 1, [addDays(TODAY, -1)]: 1, [addDays(TODAY, -2)]: 1 };
    expect(makeupLeftInWeek(used, weekStart)).toBe(0);
  });
});

describe('补签可行性（canMakeUp）', () => {
  const { daily } = build({ '-1': 'q', '-2': 'p' });

  it('正常可补：昨天漏了、本周还没用过额度', () => {
    expect(canMakeUp({ daily, makeups: {}, thresholds: TH, key: addDays(TODAY, -3), today: TODAY })).toBe('ok');
  });

  it('今天与未来不能补', () => {
    expect(canMakeUp({ daily, makeups: {}, thresholds: TH, key: TODAY, today: TODAY })).toBe('invalid');
    expect(canMakeUp({ daily, makeups: {}, thresholds: TH, key: addDays(TODAY, 3), today: TODAY })).toBe('invalid');
  });

  it('回溯窗口边界：正好 30 天可补，31 天拒', () => {
    const win = appConfig.streak.makeup.windowDays;
    expect(canMakeUp({ daily, makeups: {}, thresholds: TH, key: addDays(TODAY, -win), today: TODAY })).toBe('ok');
    expect(canMakeUp({ daily, makeups: {}, thresholds: TH, key: addDays(TODAY, -win - 1), today: TODAY })).toBe('window');
  });

  it('已达标或已补签的日期返回 done，不重复写', () => {
    expect(canMakeUp({ daily, makeups: {}, thresholds: TH, key: addDays(TODAY, -1), today: TODAY })).toBe('done');
    expect(
      canMakeUp({ daily, makeups: { [addDays(TODAY, -3)]: 1 }, thresholds: TH, key: addDays(TODAY, -3), today: TODAY }),
    ).toBe('done');
  });

  it('本周额度用完返回 quota', () => {
    const used = { [addDays(TODAY, -4)]: 1 };
    expect(canMakeUp({ daily, makeups: used, thresholds: TH, key: addDays(TODAY, -3), today: TODAY })).toBe('quota');
  });

  it('有练习但没达标的那天仍可补（补的是签到，不是重写数据）', () => {
    expect(canMakeUp({ daily, makeups: {}, thresholds: TH, key: addDays(TODAY, -2), today: TODAY })).toBe('ok');
  });
});
