import React, { useMemo, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import {
  AppText,
  Card,
  OptionChips,
  PageHeader,
  PrimaryButton,
  Screen,
  SectionTitle,
} from '@/components/ui';
import { appConfig } from '@/config/appConfig';
import {
  addDays,
  formatDayShort,
  monthEndKey,
  monthStartKey,
  monthsOfYear,
  parseKey,
  rangeKeys,
  todayKey,
  weekEndKey,
  weekStartKey,
} from '@/domain/date';
import {
  canMakeUp,
  dayMark,
  makeupLeftInWeek,
  type DayMark,
  type MakeupResult,
  type StreakThresholds,
} from '@/domain/streak';
import { tr, trf } from '@/i18n';
import { trackTap } from '@/lib/analytics';
import { useApp } from '@/store/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, stroke } from '@/theme/tokens';

/**
 * 练习日历（练习页「每周摘要」入口）。
 *
 * 三档范围共用一套格子和同一份判定（`domain/streak.dayMark`）：
 * 周 = 本周七天、月 = 整月、年 = 全年 12 个月（只画点，看趋势用）。
 *
 * 点某一天 → 下方出现这一天是什么状态、能不能补签。补签规则集中在 `domain/streak.canMakeUp`：
 * 今天之前、最近 30 天内、这一天没达标也没补过、且它所在的那一周还有免费额度（每周 1 次）。
 * 补签只写 `makeups`、不动 `daily`，所以日历上「达标」与「补签」是两种标记，
 * 学习统计里的时长与任务数不会凭空多出来。
 */

type RangeKey = 'week' | 'month' | 'year';

const RANGES: RangeKey[] = ['week', 'month', 'year'];
const RANGE_LABEL: Record<RangeKey, string> = { week: '本周', month: '本月', year: '今年' };

/** 周一起算，与 `weekStartKey` 一致 */
const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/** 格子水平间距 */
const CELL_GAP = 4;

export default function PracticeCalendarScreen() {
  const theme = useTheme();
  const { state, streak, actions } = useApp();
  const { width } = useWindowDimensions();
  const [range, setRange] = useState<RangeKey>('week');
  /** 点中的那一天（null = 没选中，下方不出面板） */
  const [picked, setPicked] = useState<string | null>(null);
  /** 补签结果的一行回执（成功与否都由它说明，不用弹窗） */
  const [feedback, setFeedback] = useState<MakeupResult | null>(null);

  const today = todayKey();
  const timeThresholdMin = state.settings.dailyTimeThreshold;
  const taskThreshold = state.settings.dailyTaskThreshold;
  const thresholds: StreakThresholds = { timeThresholdMin, taskThreshold };

  /** 卡片内容宽：整屏减页面左右留白与卡片内边距 */
  const innerWidth = width - layout.pagePadding * 2 - 32;
  /** 月视图一格：7 列等分，扣掉 6 个间隙 */
  const cellSize = Math.floor((innerWidth - CELL_GAP * 6) / 7);
  /**
   * 年视图一格：两列月份块，每块 7 列。
   * 块宽 = 7 × 格 + 6 × 间距，两块之间还要留一点空隙，所以分子先减掉这两部分。
   */
  const yearCellSize = Math.floor((innerWidth - 12 - CELL_GAP * 12) / 14);

  const weekFrom = weekStartKey(today);
  const weekTo = weekEndKey(today);
  const monthFrom = monthStartKey(today);
  const monthTo = monthEndKey(today);
  const year = parseKey(today).getFullYear();

  /** 当前档位的统计区间 */
  const scope = useMemo(() => {
    if (range === 'week') return { from: weekFrom, to: weekTo };
    if (range === 'month') return { from: monthFrom, to: monthTo };
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }, [range, weekFrom, weekTo, monthFrom, monthTo, year]);

  /** 三个数：有练习的天数 / 达标天数 / 补签次数（补签单列，不混进「达标」） */
  const summary = useMemo(() => {
    let practiced = 0;
    let qualified = 0;
    let makeup = 0;
    rangeKeys(scope.from, scope.to).forEach((key) => {
      const mark = dayMark(state.daily, state.makeups, { timeThresholdMin, taskThreshold }, key);
      if (mark === 'qualified') {
        qualified += 1;
        practiced += 1;
      } else if (mark === 'makeup') {
        makeup += 1;
      } else if (mark === 'practiced') {
        practiced += 1;
      }
    });
    return { practiced, qualified, makeup };
  }, [scope, state.daily, state.makeups, timeThresholdMin, taskThreshold]);

  /** 本周还剩几次补签（额度按自然周清零，与选中哪一天无关） */
  const weekLeft = makeupLeftInWeek(state.makeups, weekStartKey(today));

  const markOf = (key: string): DayMark => dayMark(state.daily, state.makeups, thresholds, key);

  const pick = (key: string) => {
    trackTap('日历日期', { day: key });
    setPicked((prev) => (prev === key ? null : key));
    setFeedback(null);
  };

  const confirmMakeup = () => {
    if (!picked) return;
    const result = actions.makeUpDay(picked);
    setFeedback(result);
    if (result === 'ok') trackTap('补签');
  };

  const pickedMark = picked ? markOf(picked) : 'none';
  const pickedVerdict = picked
    ? canMakeUp({ daily: state.daily, makeups: state.makeups, thresholds, key: picked, today })
    : 'invalid';

  /**
   * 一格。`compact` 用于年视图：格子小到放不下数字，只画点（细节看月视图）。
   */
  const renderCell = (
    key: string,
    opts: { weekday?: string; dim?: boolean; size: number; compact?: boolean },
  ) => {
    const mark = markOf(key);
    const { size, compact = false } = opts;
    const isToday = key === today;
    const marked = mark === 'qualified' || mark === 'makeup';
    const past = key < today;
    const color = marked
      ? theme.colors.brandOn
      : isToday
        ? theme.colors.brand
        : mark === 'practiced'
          ? theme.colors.text
          : theme.colors.textSecondary;
    const inner = compact ? size - 4 : size - 8;

    return (
      <Pressable
        key={key}
        onPress={past ? () => pick(key) : undefined}
        accessibilityRole={past ? 'button' : 'text'}
        accessibilityLabel={`${formatDayShort(key)} ${tr(markLabel(mark))}`}
        accessibilityState={{ selected: picked === key }}
        hitSlop={3}
        style={{
          width: size,
          alignItems: 'center',
          gap: 4,
          opacity: opts.dim ? 0.35 : 1,
          paddingVertical: 2,
        }}
      >
        {opts.weekday ? (
          <AppText kind="micro" color={theme.colors.textMuted}>
            {opts.weekday}
          </AppText>
        ) : null}
        {/* 补签多一圈虚线圈：只靠填充色区分「练的 / 补的」在色觉障碍下不成立（NFR-7） */}
        <View
          style={{
            width: inner + 4,
            height: inner + 4,
            borderRadius: (inner + 4) / 2,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: mark === 'makeup' ? 1 : 0,
            borderStyle: 'dashed',
            borderColor: theme.colors.brand,
          }}
        >
          <View
            style={{
              width: inner,
              height: inner,
              borderRadius: inner / 2,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: marked ? theme.colors.brand : 'transparent',
              borderWidth: mark === 'practiced' ? stroke.base : 0,
              borderColor: theme.colors.textMuted,
            }}
          >
            {compact ? null : (
              <AppText kind={opts.weekday ? 'sm' : 'micro'} color={color} weight={isToday ? 'bold' : undefined}>
                {Number(key.slice(8))}
              </AppText>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  /** 月 / 年视图里的一个自然周 */
  const renderWeekRow = (weekStart: string, from: string, to: string, size: number, compact: boolean) => (
    <View key={weekStart} style={{ flexDirection: 'row', gap: CELL_GAP }}>
      {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((k) =>
        renderCell(k, { dim: k < from || k > to, size, compact }),
      )}
    </View>
  );

  /** 一个月的网格：从 1 号所在的那一周排到最后一天所在的那一周 */
  const renderMonthGrid = (from: string, to: string, size: number, compact = false) => {
    const rows: string[] = [];
    let cur = weekStartKey(from);
    const last = weekEndKey(to);
    let guard = 0;
    while (cur <= last && guard < 6) {
      rows.push(cur);
      cur = addDays(cur, 7);
      guard += 1;
    }
    return (
      <View style={{ gap: CELL_GAP }}>
        {rows.map((w) => renderWeekRow(w, from, to, size, compact))}
      </View>
    );
  };

  return (
    <Screen header={<PageHeader title="练习日历" />} contentStyle={{ gap: 20 }}>
      {/* 摘要：三个数跟着上面的档位变（周 / 月 / 年） */}
      <View style={{ gap: 10 }}>
        <SectionTitle label="练习摘要" />
        <Card style={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row' }}>
            <Metric label={tr('练习')} value={trf('{n} 天', { n: summary.practiced })} />
            <Metric label={tr('达标')} value={trf('{n} 天', { n: summary.qualified })} />
            <Metric label={tr('补签')} value={trf('{n} 次', { n: summary.makeup })} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 8 }}>
            <AppText kind="micro" color={theme.colors.textMuted}>
              {rangeCaption(range, weekFrom, weekTo, monthFrom, monthTo, year)}
            </AppText>
            <AppText kind="micro" color={theme.colors.textMuted}>
              {trf('当前连续 {n} 天', { n: streak })}
            </AppText>
          </View>
        </Card>
      </View>

      {/* 日历：周 / 月 / 年三档 + 格子 + 图例 */}
      <View style={{ gap: 10 }}>
        <SectionTitle label="打卡日历" />
        <Card style={{ padding: 16, gap: 14 }}>
          <OptionChips
            options={RANGES}
            value={range}
            onChange={(v) => {
              setRange(v);
              setPicked(null);
              setFeedback(null);
            }}
            labelOf={(v) => RANGE_LABEL[v]}
            accessibilityLabel={tr('日历范围')}
            stretch
            plainInactive
            inactiveColor={theme.colors.textSecondary}
          />

          {range === 'week' ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {Array.from({ length: 7 }, (_, i) => addDays(weekFrom, i)).map((k, i) =>
                renderCell(k, { weekday: WEEKDAYS[i], size: cellSize }),
              )}
            </View>
          ) : null}

          {range === 'month' ? (
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', gap: CELL_GAP }}>
                {WEEKDAYS.map((w) => (
                  <View key={w} style={{ width: cellSize, alignItems: 'center' }}>
                    <AppText kind="micro" color={theme.colors.textMuted}>
                      {w}
                    </AppText>
                  </View>
                ))}
              </View>
              {renderMonthGrid(monthFrom, monthTo, cellSize)}
            </View>
          ) : null}

          {range === 'year' ? (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                rowGap: 16,
              }}
            >
              {monthsOfYear(year).map((m) => (
                <View key={m.month} style={{ gap: 6 }}>
                  <AppText kind="micro" color={theme.colors.textMuted}>
                    {trf('{m}月', { m: m.month })}
                  </AppText>
                  {renderMonthGrid(m.from, m.to, yearCellSize, true)}
                </View>
              ))}
            </View>
          ) : null}

          {/* 图例：四种标记各自是什么意思（颜色之外还要有文字） */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 6 }}>
            <Legend color={theme.colors.brand} label={tr('达标')} filled />
            <Legend color={theme.colors.brand} label={tr('补签')} filled dashed />
            <Legend color={theme.colors.textMuted} label={tr('有练习')} />
            <Legend color={theme.colors.textMuted} label={tr('未练习')} />
          </View>
        </Card>
      </View>

      {/* 选中某一天：状态 + 补签。没选中时整块不渲染，页面不留空位 */}
      {picked ? (
        <View style={{ gap: 10 }}>
          <SectionTitle label={formatDayShort(picked)} />
          <Card style={{ padding: 16, gap: 12 }}>
            <AppText kind="md" color={theme.colors.text}>
              {tr(markLabel(pickedMark))}
            </AppText>
            <AppText kind="micro" color={theme.colors.textMuted}>
              {feedback === 'ok' ? tr('已补签，连续天数已接上。') : verdictHint(pickedVerdict, weekLeft)}
            </AppText>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <PrimaryButton
                label="关闭"
                tone="ghost"
                style={{ flex: 1 }}
                onPress={() => {
                  setPicked(null);
                  setFeedback(null);
                }}
              />
              {pickedVerdict === 'ok' ? (
                <PrimaryButton label="补签这一天" style={{ flex: 1 }} onPress={confirmMakeup} />
              ) : null}
            </View>
          </Card>
        </View>
      ) : null}

      {/* 补签规则：额度、窗口、以及「只补签到不补数据」的口径 */}
      <View style={{ gap: 10 }}>
        <SectionTitle label="补签规则" />
        <Card style={{ padding: 16, gap: 8 }}>
          <AppText kind="sm" color={theme.colors.textSecondary}>
            {trf('每个自然周可补签 {n} 天，本周还剩 {left} 次。', {
              n: appConfig.streak.makeup.perWeek,
              left: weekLeft,
            })}
          </AppText>
          <AppText kind="sm" color={theme.colors.textSecondary}>
            {trf('只能补签今天之前 {n} 天内的日期；今天与未来不需要补签。', {
              n: appConfig.streak.makeup.windowDays,
            })}
          </AppText>
          <AppText kind="micro" color={theme.colors.textMuted}>
            {tr('补签只把这一天记为签到，不会补上练习时长与任务数，学习统计仍以实际练习为准。')}
          </AppText>
        </Card>
      </View>
    </Screen>
  );
}

/** 摘要里的一格 */
function Metric({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <AppText kind="lg" color={theme.colors.text} numberOfLines={1}>
        {value}
      </AppText>
      <AppText kind="micro" color={theme.colors.textMuted}>
        {label}
      </AppText>
    </View>
  );
}

/** 图例的一枚小圆：实心 = 达标 / 补签，空心 = 有练习 */
function Legend({
  color,
  label,
  filled = false,
  dashed = false,
}: {
  color: string;
  label: string;
  filled?: boolean;
  dashed?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: filled ? color : 'transparent',
          borderWidth: filled ? (dashed ? 1 : 0) : stroke.base,
          borderStyle: dashed ? 'dashed' : 'solid',
          borderColor: color,
        }}
      />
      <AppText kind="micro" color={theme.colors.textMuted}>
        {label}
      </AppText>
    </View>
  );
}

function markLabel(mark: DayMark): string {
  if (mark === 'qualified') return '已达标';
  if (mark === 'makeup') return '已补签';
  if (mark === 'practiced') return '有练习，未达标';
  return '未练习';
}

function verdictHint(verdict: MakeupResult, weekLeft: number): string {
  switch (verdict) {
    case 'ok':
      return trf('补签后这一天记为签到，连续天数会重新接上；本周还剩 {n} 次额度。', { n: weekLeft });
    case 'quota':
      return tr('这一周的免费补签额度已用完，下周会有新的额度。');
    case 'window':
      return trf('超出可补签的时间范围，只能补最近 {n} 天。', {
        n: appConfig.streak.makeup.windowDays,
      });
    case 'done':
      return tr('这一天已经是签到状态，不用补签。');
    default:
      return tr('今天与未来的日期不需要补签，先练起来就好。');
  }
}

/** 摘要卡底下那行：当前档位覆盖的日期范围 */
function rangeCaption(
  range: RangeKey,
  weekFrom: string,
  weekTo: string,
  monthFrom: string,
  monthTo: string,
  year: number,
): string {
  if (range === 'week') return `${formatDayShort(weekFrom)} – ${formatDayShort(weekTo)}`;
  if (range === 'month') return `${formatDayShort(monthFrom)} – ${formatDayShort(monthTo)}`;
  return trf('{y} 年全年', { y: year });
}
