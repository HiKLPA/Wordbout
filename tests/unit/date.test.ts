import { describe, expect, it } from 'vitest';
import {
  addDays,
  dateKey,
  diffDays,
  formatDayShort,
  formatDurationHuman,
  formatTime,
  monthEndKey,
  monthStartKey,
  monthsOfYear,
  parseKey,
  rangeKeys,
  weekDays,
  weekEndKey,
  weekStartKey,
} from '@/domain/date';

/**
 * 日期口径（FR-E-1 验收标准：跨天以设备时区自然日零点为界）。
 * 这一层是所有统计的地基，边界日（闰日、月末、年末、跨周）必须逐个钉住。
 */
describe('自然日键', () => {
  it('补零到 YYYY-MM-DD，个位数月日也要两位', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(dateKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('解析回本地零点，不因时区偏移成前一天', () => {
    const d = parseKey('2026-03-01');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(0);
  });
});

describe('加减天数与差值', () => {
  it('跨月、跨年、闰日都正确', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29'); // 闰年
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01'); // 平年
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('差值带符号，正反相加为零', () => {
    expect(diffDays('2026-11-01', '2026-11-06')).toBe(5);
    expect(diffDays('2026-11-06', '2026-11-01')).toBe(-5);
    expect(diffDays('2026-11-06', '2026-11-06')).toBe(0);
    expect(diffDays('2026-01-01', '2026-12-31')).toBe(364);
  });

  it('跨夏令时边界也不会少算一天（按自然日取整）', () => {
    // 多数时区在 3 月 / 11 月切换；这里只要求差值仍是整数天
    expect(diffDays('2026-03-07', '2026-03-09')).toBe(2);
    expect(diffDays('2026-10-31', '2026-11-02')).toBe(2);
  });
});

describe('区间生成', () => {
  it('闭区间，含首含尾', () => {
    expect(rangeKeys('2026-11-01', '2026-11-03')).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
  });

  it('起止相同时只给一天', () => {
    expect(rangeKeys('2026-11-06', '2026-11-06')).toEqual(['2026-11-06']);
  });

  it('起点晚于终点时为空，而不是死循环', () => {
    expect(rangeKeys('2026-11-06', '2026-11-01')).toEqual([]);
  });
});

describe('自然周（周一起）', () => {
  it('周一自身就是周起点', () => {
    expect(weekStartKey('2026-11-02')).toBe('2026-11-02'); // 周一
  });

  it('周日归到本周一，而不是下一周', () => {
    expect(weekStartKey('2026-11-08')).toBe('2026-11-02'); // 周日
  });

  it('一周固定 7 天，且首尾相连', () => {
    const start = weekStartKey('2026-11-06');
    expect(weekDays(start)).toHaveLength(7);
    expect(weekDays(start)[6]).toBe(weekEndKey('2026-11-06'));
    expect(weekEndKey('2026-11-06')).toBe('2026-11-08');
  });

  it('跨月的周不会被截断', () => {
    expect(weekStartKey('2026-11-01')).toBe('2026-10-26');
    expect(weekEndKey('2026-10-26')).toBe('2026-11-01');
  });
});

describe('月边界', () => {
  it('月末按大小月与闰年计算', () => {
    expect(monthEndKey('2026-02-10')).toBe('2026-02-28');
    expect(monthEndKey('2028-02-10')).toBe('2028-02-29');
    expect(monthEndKey('2026-04-01')).toBe('2026-04-30');
    expect(monthEndKey('2026-12-01')).toBe('2026-12-31');
  });

  it('月起点不管传哪一天都是 1 号', () => {
    expect(monthStartKey('2026-11-23')).toBe('2026-11-01');
  });

  it('一年 12 个月，每月区间连续且不重叠', () => {
    const months = monthsOfYear(2026);
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ month: 1, from: '2026-01-01', to: '2026-01-31' });
    expect(months[1].from).toBe('2026-02-01');
    expect(months[11].to).toBe('2026-12-31');
  });
});

describe('时长文案', () => {
  it('秒表格式：不足一小时不带小时位', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(3661)).toBe('1:01:01');
  });

  it('负数与非法值收敛到 0，不出现 -1:-1', () => {
    expect(formatTime(-5)).toBe('0:00');
    expect(formatDurationHuman(-5)).toBe('0 秒');
  });

  it('人读时长：秒 → 分 → 小时', () => {
    expect(formatDurationHuman(45)).toBe('45 秒');
    expect(formatDurationHuman(60)).toBe('1 分');
    expect(formatDurationHuman(600)).toBe('10 分');
    expect(formatDurationHuman(5400)).toBe('1 小时 30 分');
  });

  it('分钟四舍五入到 60 时要进位成小时，不能出现「60 分」「1 小时 60 分」', () => {
    expect(formatDurationHuman(3599)).toBe('1 小时');
    expect(formatDurationHuman(7199)).toBe('2 小时');
    expect(formatDurationHuman(359_999)).toBe('100 小时');
  });

  it('简短日期走词表（中文原文形态）', () => {
    expect(formatDayShort('2026-11-06')).toBe('11月6日');
  });
});
