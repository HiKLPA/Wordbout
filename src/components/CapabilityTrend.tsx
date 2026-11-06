import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { BoardBars } from '@/components/BoardBars';
import { BOARD_ICONS, ChevronIcon } from '@/components/icons';
import { TrendChart } from '@/components/TrendChart';
import {
  AppText,
  Card,
  Divider,
  EmptyState,
  OptionChips,
  PageHeader,
  PrimaryButton,
  Screen,
  SectionTitle,
} from '@/components/ui';
import { appConfig, boards, exerciseTypeMap, exerciseTypes, levels, type BoardId, type ExerciseTypeId } from '@/config/appConfig';
import { addDays, formatDurationHuman, todayKey } from '@/domain/date';
import { aggregate, dailyTrend, levelBand, trendPoints, type Granularity } from '@/domain/stats';
import { tr, trf } from '@/i18n';
import { useApp } from '@/store/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { layout } from '@/theme/tokens';

/** 统计范围只有四档预设（quickRanges），不提供自定义日期区间 */
export type RangeKey = 'today' | '7d' | '30d' | '3m';

/** 四档的固定顺序（顺序即胶囊的排列顺序） */
const RANGE_KEYS: RangeKey[] = ['today', '7d', '30d', '3m'];

/** 默认统计范围（打开时选中的那一档） */
export const DEFAULT_TREND_RANGE: RangeKey = 'today';

/**
 * 统计范围四档（今日 / 近7天 / 近30天 / 近3月）—— 与 `RangeKey` 一一对应。
 * 它**永远不随正文上下滚动**：二级页 `/query-table` 放在自己的固定页头里；
 * 练习页「能力趋势」页签则由练习页把它钉在**那一页的页内顶部**
 * （不随纵滚，但在分页条内部 —— 左右拖动整页时跟着一起滑走，见 `(tabs)/exercise.tsx` 的 `renderBody`）。
 * 两处共用这一个组件，几何与文案只有一份。
 */
export function TrendRangeChips({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (k: RangeKey) => void;
}) {
  return (
    <OptionChips
      options={RANGE_KEYS}
      value={value}
      onChange={onChange}
      labelOf={(k) => appConfig.queryTable.quickRanges.find((r) => r.key === k)?.label ?? k}
      accessibilityLabel={tr('统计范围')}
      stretch
      /* 未选中档位不铺底、不描边：只有选中那一枚是品牌红实底，其余直接坐在页面底色上 */
      plainInactive
    />
  );
}

/**
 * 两张图（总览逐日曲线、分览板块条形图）**各自独立**可切换的三种维度：
 * 得分率 / 任务数 / 时长。两者用同一套胶囊、同一组文案，但选中项互不影响。
 */
type ChartMetric = 'score' | 'tasks' | 'time';

/** 题型 → 所属板块（模块级常量，避免每次渲染生成新函数引用） */
const boardOfType = (t: ExerciseTypeId): BoardId => exerciseTypeMap[t].board;

/** 题型行里的时长：不足 1 分钟用「s」缩写（时长 22s），更长沿用统一的人类可读格式 */
function compactDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return s < 60 ? `${s}s` : formatDurationHuman(s);
}

/**
 * 画出曲线所需的最少点数：
 * 按日 / 周聚合至少要有两点才成「趋势」；按月聚合时一个点就代表整月，
 * 有一个就已足够（否则「近3月」只在单个月份练过时会永远显示「暂无趋势」）。
 */
function minPointsOf(g: Granularity): number {
  return g === 'month' ? 1 : appConfig.queryTable.trendMinPoints;
}

/**
 * 能力趋势（FR-E-16 ~ FR-E-20）。
 *
 * 两个入口共用这一份实现：
 * - 练习页顶部「能力趋势」页签（与练习 / 测验 / 题集同一行，四枚胶囊等分宽度）→ 传 `embedded` + `range` / `onRangeChange`，
 *   **不铺自己的 `Screen`**（外层练习页已有分页器 + 每页自己的滚动区），只渲染正文：总览 / 分览，
 *   与另外三个页签一样在页头下方就地展现，不跳二级页面；统计范围四档由练习页钉在该页顶部
 *   （不随纵滚、随整页横滑），故这里不再自己渲染四档；
 * - 更多 → 学习统计页的「打开能力趋势」→ 走 `/query-table` 路由（不传 `embedded`，自管 range state，
 *   自带带返回箭头的 `PageHeader`，统计范围四档固定在页头不随内容滚动）。
 *
 * 两节互不干扰：
 * - 总览：恒统计全部题型，不随「分题型」的板块 / 等级筛选变化（FR-E-16）；
 * - 分题型：按板块拆成若干面板，板块筛选可多选、只显示选中的面板（FR-E-18）。
 */
export function CapabilityTrend({
  embedded = false,
  range: rangeProp,
  onRangeChange,
}: {
  /** 内嵌进练习页「能力趋势」页签：不铺自己的 `Screen`，四档由练习页渲染在那一页的页内顶部 */
  embedded?: boolean;
  /** 受控的统计范围（练习页把 state 提到页头一起管时传）；不传则组件自管 */
  range?: RangeKey;
  /** 受控的范围切换回调 */
  onRangeChange?: (k: RangeKey) => void;
}) {
  const theme = useTheme();
  const { state } = useApp();

  const [rangeState, setRangeState] = useState<RangeKey>(DEFAULT_TREND_RANGE);
  /** 受控 / 非受控两种用法共用同一个 `range` / `setRange`（练习页受控，二级页自管） */
  const range = rangeProp ?? rangeState;
  const setRange = onRangeChange ?? setRangeState;
  /** 分题型的板块筛选：**多选**，空数组 = 不筛选（五个板块全显示）；点已选板块取消该板块 */
  const [boardFilter, setBoardFilter] = useState<BoardId[]>([]);
  const [levelFilter, setLevelFilter] = useState<string[]>([]);
  /** 已展开趋势图的题型（可同时展开多个，各自独立） */
  const [expandedTypes, setExpandedTypes] = useState<ExerciseTypeId[]>([]);
  /** 每个已展开题型的「分项成线」选择，键 = 题型 id */
  const [trendBreakdowns, setTrendBreakdowns] = useState<Record<string, string | null>>({});
  /** 总览第二个面板当前展示的曲线（默认得分率） */
  const [overviewMetric, setOverviewMetric] = useState<ChartMetric>('score');
  /** 分览板块条形图当前展示的维度（默认得分率，与总览各自独立） */
  const [boardMetric, setBoardMetric] = useState<ChartMetric>('score');
  const { from, to } = useMemo(() => {
    const preset = appConfig.queryTable.quickRanges.find((r) => r.key === range);
    const span = preset?.days ?? appConfig.queryTable.defaultRangeDays;
    const end = todayKey();
    return { from: addDays(end, -(span - 1)), to: end };
  }, [range]);

  const allTypeIds = useMemo(() => exerciseTypes.map((t) => t.id), []);

  /** 总览：恒为全部题型的统计，不受「分题型」里的任何筛选影响 */
  const overview = useMemo(
    () => aggregate(state.attempts, state.daily, { from, to }, allTypeIds, boardOfType),
    [state.attempts, state.daily, from, to, allTypeIds],
  );

  /** 总览「平均得分率」的变化曲线：与题型趋势同口径（同一时段、同一天取当天均值） */
  const overviewTrend = useMemo(
    () => trendPoints(state.attempts, null, { from, to }),
    [state.attempts, from, to],
  );

  /** 总览第二个面板可切换的逐日任务数 / 时长（口径与打卡计数器一致，取 daily 聚合） */
  const dailySeries = useMemo(
    () => ({
      tasks: dailyTrend(state.daily, { from, to }, 'taskCount'),
      time: dailyTrend(state.daily, { from, to }, 'durationMin'),
    }),
    [state.daily, from, to],
  );

  /** 「今日」只有当天一个数据点，画不出趋势，因此该档位不展示任何趋势图 */
  const showTrends = range !== 'today';

  /** 总览第二个面板的曲线数据与纵轴单位（随所选指标切换） */
  const overviewChart =
    overviewMetric === 'score'
      ? { points: overviewTrend.points, granularity: overviewTrend.granularity, unit: '%', autoScale: false }
      : overviewMetric === 'tasks'
        ? { points: dailySeries.tasks.points, granularity: dailySeries.tasks.granularity, unit: tr('个'), autoScale: true }
        : { points: dailySeries.time.points, granularity: dailySeries.time.granularity, unit: tr('分'), autoScale: true };

  /** 分题型：只统计当前选中板块 + 等级范围内的题型（板块多选，空 = 全部） */
  const section = useMemo(() => {
    const typeIds =
      boardFilter.length > 0
        ? allTypeIds.filter((id) => boardFilter.includes(exerciseTypeMap[id].board))
        : allTypeIds;
    return aggregate(state.attempts, state.daily, { from, to, typeIds, levelIds: levelFilter }, allTypeIds, boardOfType);
  }, [state.attempts, state.daily, from, to, allTypeIds, boardFilter, levelFilter]);

  /** 各已展开题型的趋势数据（可同时展开多个，互不影响） */
  const trends = useMemo(() => {
    const out: Record<string, ReturnType<typeof trendPoints>> = {};
    expandedTypes.forEach((t) => {
      out[t] = trendPoints(state.attempts, t, { from, to }, trendBreakdowns[t] ?? null);
    });
    return out;
  }, [state.attempts, expandedTypes, from, to, trendBreakdowns]);

  const hasData = overview.byType.some((r) => r.count > 0);
  const band = levelBand(overview.avgScoreRate);
  /** 某题型的「分项成线」候选标签取全量口径，避免被板块 / 等级筛选裁掉 */
  const breakdownLabelsOf = (typeId: ExerciseTypeId) =>
    Object.keys(overview.byType.find((r) => r.typeId === typeId)?.breakdown ?? {});
  /** 纵向条形图的数据：项目顺序与 boards 一致（听 / 写 / 说 / 读 / 译）；三种维度都由这一份数据切 */
  const boardBars = boards.map((b) => {
    const row = overview.byBoard.find((x) => x.board === b.id);
    return {
      label: b.labelZh,
      scoreRate: row?.scoreRate ?? null,
      taskCount: row?.count ?? 0,
      durationSec: row?.durationSec ?? 0,
    };
  });
  /** 只渲染选中的板块面板（多选，按 boards 原顺序）；未选任何板块时五个板块各一块 */
  const visibleBoards = boardFilter.length > 0 ? boards.filter((b) => boardFilter.includes(b.id)) : boards;

  /** 统计范围四档：落在页头固定区（二级页在自己的页头里；练习页在练习页的固定页头里） */
  const rangeChips = <TrendRangeChips value={range} onChange={setRange} />;

  /**
   * 二级页（`/query-table`）的页头固定区：标题 + 统计范围四档。
   * 它渲染在滚动区之外，因此上下滑动正文时这一块始终停住不动。
   * 顶部间距**不传 `headerTopGap` / `headerMaskGap`**，沿用二级页默认（页头距顶部安全区
   * `SCREEN_HEADER_TOP_GAP` = `SCREEN_TOP_GAP - SCREEN_TEXT_LEADING` 16、遮罩紧贴页头下沿）
   * ——与收藏夹 / 设置 / 翻译等所有二级页一致，页头字面也与练习 / 课本这些一级页顶部对齐。
   */
  const topBlock = (
    <View style={{ gap: 16 }}>
      <PageHeader title="能力趋势" />
      {rangeChips}
    </View>
  );

  const body = (
    <>
      {!hasData ? (
        /* 空态注释不套面板，落在正文区正中（与 AI 探索页 / 语音翻译页同款居中）；
           内嵌进练习页页签时正文没有固定高度，改用内边距撑出一块居中的空态区 */
        <View
          style={
            embedded
              ? { alignItems: 'center', justifyContent: 'center', paddingVertical: 72 }
              : { flex: 1, alignItems: 'center', justifyContent: 'center' }
          }
        >
          <EmptyState title="还没有练习记录，先完成一次练习吧" hint="完成任意一个题型后，这里会显示统计结果" />
        </View>
      ) : (
        <>
          {/* 总览（FR-E-16）：全量口径，与下面的板块 / 等级筛选无关 */}
          <View style={{ gap: 8 }}>
            <SectionTitle label="总览" />
            <Card style={{ padding: 16, gap: 8 }}>
              {/* 卡片顶部：平均得分率 + 当前水平（评定时段 = 当前所选档位，不是固定 30 天） */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ gap: 2 }}>
                  <AppText kind="micro" color={theme.colors.textMuted} style={{ fontSize: theme.size(14) }}>
                    平均得分率
                  </AppText>
                  <AppText kind="lg" color={theme.colors.text}>
                    {overview.avgScoreRate === null ? '无' : `${overview.avgScoreRate.toFixed(1)}%`}
                  </AppText>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <AppText kind="micro" color={theme.colors.textMuted} style={{ fontSize: theme.size(14) }}>
                    当前水平
                  </AppText>
                  <AppText kind="lg" color={theme.colors.brand}>
                    {band ?? '暂无'}
                  </AppText>
                </View>
              </View>
              <Divider />
              <View style={{ flexDirection: 'row' }}>
                <Metric label="练习天数" value={trf('{n} 天', { n: overview.practiceDays })} />
                <Metric label="累计时长" value={formatDurationHuman(overview.totalDurationSec)} />
                <Metric label="完成任务" value={trf('{n} 个', { n: overview.totalTaskCount })} />
              </View>
            </Card>

            {/* 第二个面板：切换「得分率 / 任务数 / 时长」的逐日曲线；「今日」只有当天一个点、画不出趋势，整块不展示 */}
            {showTrends ? (
              <Card style={{ padding: 16, gap: 8 }}>
                <MetricChips value={overviewMetric} onChange={setOverviewMetric} />
                {overviewChart.points.length >= minPointsOf(overviewChart.granularity) ? (
                  <TrendChart
                    points={overviewChart.points}
                    unit={overviewChart.unit}
                    autoScale={overviewChart.autoScale}
                  />
                ) : (
                  <AppText kind="micro" color={theme.colors.textSecondary}>
                    {tr('暂无趋势，需至少两天的练习记录')}
                  </AppText>
                )}
              </Card>
            ) : null}
          </View>

          {/* 分览（FR-E-18）：项目 / 板块维度的明细，筛选只作用于这一节 */}
          <View style={{ gap: 8 }}>
            <SectionTitle label="分览" />

            {/* 项目卡片：纵向条形图 —— 横轴项目名、纵轴为所选维度（与总览第二面板同一组三档：
                得分率 / 任务数 / 时长）；横坐标下方不再给个数统计 */}
            <Card style={{ padding: 16, gap: 8 }}>
              <MetricChips value={boardMetric} onChange={setBoardMetric} />
              <BoardBars items={boardBars} metric={boardMetric} />
            </Card>

            {/* 筛选区：「分览面板（项目卡片）↔ 板块筛选」间距 = 16（分览节 gap 8 + 这里额外 marginTop 8）；
                节内的其它相邻项仍是 8，只有这一处拉开，把筛选区与上方面板分开。 */}
            <View style={{ gap: 8, marginTop: 8 }}>
              <AppText kind="micro" color={theme.colors.textMuted} style={{ fontSize: theme.size(14) }}>
                板块筛选
              </AppText>
              {/* 板块筛选：五枚按钮**平分整行宽度**（不横向滑动）、可**多选**，每枚只显示板块图标。
                  下面「题库筛选」（等级）与它同一套排布：五枚同样**平分主内容区宽度**（不横向滑动），
                  两排都不再有横向滚动 —— 内嵌进练习页分页器时也不会出现横滑吃掉换页手势的问题。 */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {boards.map((b) => {
                  const active = boardFilter.includes(b.id);
                  const BoardIcon = BOARD_ICONS[b.id];
                  return (
                    <PrimaryButton
                      key={b.id}
                      /* 只显示图标（听 = 耳朵 / 写 = 笔 / 说 = 麦克风 / 读 = 题卷 / 译 = 文 A），
                         板块名退到无障碍名里；选中 = 品牌红实底，未选中 = surface 实底胶囊
                         （`panel`，与「收藏 / 加入题集 / 查看解析」那些图标钮同一套底色） */
                      label={b.labelZh}
                      icon={
                        <BoardIcon size={20} color={active ? theme.colors.brandOn : theme.colors.text} />
                      }
                      tone={active ? 'brand' : 'ghost'}
                      panel={!active}
                      contentPadX={14}
                      onPress={() => {
                        setBoardFilter((prev) =>
                          prev.includes(b.id) ? prev.filter((x) => x !== b.id) : [...prev, b.id],
                        );
                        setExpandedTypes([]);
                        setTrendBreakdowns({});
                      }}
                      style={{ flex: 1, minHeight: 36, paddingHorizontal: 0 }}
                    />
                  );
                })}
              </View>
              <AppText kind="micro" color={theme.colors.textMuted} style={{ fontSize: theme.size(14) }}>
                题库筛选
              </AppText>
              {/* 与板块筛选同排布：五枚平分主内容区宽度、可多选。
                  这批档位是文字（CET4 / IELTS / TOEFL）比图标宽，字号收到 sm（16）、
                  内容左右边距压到 6，保证最长的「TOEFL」在等分后的窄胶囊里也不被截断。 */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {levels.map((l) => {
                  const active = levelFilter.includes(l.id);
                  return (
                    <PrimaryButton
                      key={l.id}
                      label={l.labelZh}
                      tone={active ? 'brand' : 'ghost'}
                      panel={!active}
                      labelKind="sm"
                      onPress={() => setLevelFilter((prev) => (active ? prev.filter((x) => x !== l.id) : [...prev, l.id]))}
                      contentPadX={6}
                      style={{ flex: 1, minHeight: 36, paddingHorizontal: 0 }}
                    />
                  );
                })}
              </View>
            </View>

            {/* 每个板块一块面板；板块筛选可多选，只渲染选中的那几块（未选 = 全部） */}
            <View style={{ gap: 8 }}>
              {visibleBoards.map((board) => {
                const rows = section.byType.filter((r) => r.board === board.id);
                const boardCount = section.byBoard.find((b) => b.board === board.id)?.count ?? 0;
                return (
                  <Card key={board.id} style={{ padding: 16 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingBottom: 8,
                      }}
                    >
                      <AppText kind="lg" color={theme.colors.brand} weight="bold">
                        {board.labelZh}
                      </AppText>
                      <AppText kind="lg" color={theme.colors.textSecondary}>
                        {trf('{n} 次', { n: boardCount })}
                      </AppText>
                    </View>
                    <View style={{ flexDirection: 'row', paddingVertical: 8, gap: 8 }}>
                      <AppText kind="micro" color={theme.colors.textMuted} style={{ flex: 1.6, fontSize: theme.size(14) }}>
                        项目
                      </AppText>
                      <AppText kind="micro" color={theme.colors.textMuted} style={{ flex: 1, textAlign: 'right', fontSize: theme.size(14) }}>
                        次数
                      </AppText>
                      <AppText kind="micro" color={theme.colors.textMuted} style={{ flex: 1, textAlign: 'right', fontSize: theme.size(14) }}>
                        时长
                      </AppText>
                      <AppText kind="micro" color={theme.colors.textMuted} style={{ flex: 1, textAlign: 'right', fontSize: theme.size(14) }}>
                        得分率
                      </AppText>
                    </View>
                    {rows.map((row) => {
                      const def = exerciseTypeMap[row.typeId];
                      const empty = row.count === 0;
                      /** 趋势展开在本行内（不再另起一块）；多个题型可同时展开；「今日」档位不展示任何趋势图 */
                      const expanded = showTrends && expandedTypes.includes(row.typeId);
                      const rowTrend = trends[row.typeId];
                      const rowBreakdown = trendBreakdowns[row.typeId] ?? null;
                      return (
                        <View key={row.typeId}>
                          <View style={{ paddingVertical: 8, gap: 2 }}>
                            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                              <View style={{ flex: 1.6 }}>
                                <AppText kind="micro" color={theme.colors.text} numberOfLines={1} style={{ fontSize: theme.size(14) }}>
                                  {def.labelZh}
                                </AppText>
                              </View>
                              {/* 三个数值列：有数据 = 品牌红（「/」是空位标记，不标红） */}
                              <AppText
                                kind="micro"
                                color={empty ? theme.colors.textSecondary : theme.colors.brand}
                                style={{ flex: 1, textAlign: 'right', fontSize: theme.size(14) }}
                              >
                                {empty ? '/' : String(row.count)}
                              </AppText>
                              <AppText
                                kind="micro"
                                color={empty ? theme.colors.textSecondary : theme.colors.brand}
                                style={{ flex: 1, textAlign: 'right', fontSize: theme.size(14) }}
                              >
                                {empty ? '/' : compactDuration(row.durationSec)}
                              </AppText>
                              <AppText
                                kind="micro"
                                color={row.scoreRate === null ? theme.colors.text : theme.colors.brand}
                                style={{ flex: 1, textAlign: 'right', fontSize: theme.size(14) }}
                              >
                                {row.scoreRate === null ? '/' : `${row.scoreRate.toFixed(1)}%`}
                              </AppText>
                            </View>
                            {!empty ? (
                              <View style={{ gap: 8 }}>
                                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                                  <AppText kind="micro" color={theme.colors.textMuted} style={{ flexShrink: 1, fontSize: theme.size(14) }}>
                                    {trf('最高 {max} · 最低 {min}', {
                                      max: row.maxScore?.toFixed(0) ?? '-',
                                      min: row.minScore?.toFixed(0) ?? '-',
                                    })}
                                  </AppText>
                                  {/* 展开 / 收起 = 课本单词释义面板同款的红色上下箭头（不再用文字按钮）；「今日」档位无趋势可看，箭头不展示 */}
                                  {showTrends ? (
                                    <Pressable
                                      onPress={() => {
                                        setExpandedTypes((prev) =>
                                          prev.includes(row.typeId)
                                            ? prev.filter((x) => x !== row.typeId)
                                            : [...prev, row.typeId],
                                        );
                                        setTrendBreakdowns((prev) => ({ ...prev, [row.typeId]: null }));
                                      }}
                                      accessibilityRole="button"
                                      accessibilityLabel={tr(expanded ? '收起趋势' : '展开趋势')}
                                      hitSlop={10}
                                      style={{ marginLeft: 'auto', padding: 2 }}
                                    >
                                      <ChevronIcon size={24} direction={expanded ? 'up' : 'down'} color={theme.colors.brand} />
                                    </Pressable>
                                  ) : null}
                                </View>
                                {/* 趋势图就地展开在本行（FR-E-19）。
                                    与上方「最高 / 最低」行之间恒 8（父级 gap，这里不再额外垫 paddingTop），
                                    区内胶囊 ↔ 曲线同样 8 —— 展开区内的纵向节奏统一取 8。 */}
                                {expanded && rowTrend ? (
                                  <View style={{ gap: 8 }}>
                                    {/* 评分方面（AI 评分项目）：放在趋势图上方，单行横向滑动 */}
                                    {def.aiGraded ? (
                                      <ScrollView
                                        horizontal
                                        nestedScrollEnabled
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={{ gap: 8 }}
                                      >
                                        <OptionChips
                                          options={['', ...breakdownLabelsOf(row.typeId)] as string[]}
                                          value={rowBreakdown ?? ''}
                                          onChange={(v) =>
                                            setTrendBreakdowns((prev) => ({ ...prev, [row.typeId]: v === '' ? null : v }))
                                          }
                                          labelOf={(v) => (v === '' ? '总分' : v)}
                                        />
                                      </ScrollView>
                                    ) : null}
                                    {rowTrend.points.length < minPointsOf(rowTrend.granularity) ? (
                                      <AppText kind="micro" color={theme.colors.textSecondary}>
                                        {tr('暂无趋势，需至少练习同一项目两日')}
                                      </AppText>
                                    ) : (
                                      <TrendChart points={rowTrend.points} />
                                    )}
                                  </View>
                                ) : null}
                              </View>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                  </Card>
                );
              })}
            </View>
          </View>
        </>
      )}

      {/* 底部呼吸留白；空态已由 flex 居中，无需再垫一段（否则会让居中点偏上 9px） */}
      {hasData ? <View style={{ height: layout.pagePadding }} /> : null}
    </>
  );

  /* 练习页页签内嵌：外层（练习页 Screen）已经是滚动区，这里只交正文。
     统计范围四档**不在这里渲染** —— 它由练习页渲染在那一页的页内顶部（不随纵滚，
     但随整页横滑一起走，见 `(tabs)/exercise.tsx` 的 `renderBody`）；
     正文只剩总览 / 分览（与练习 / 测验 / 题集三个页签同一形态）。 */
  if (embedded) {
    return <View style={{ gap: 32 }}>{body}</View>;
  }

  return (
    <Screen header={topBlock} contentStyle={{ flexGrow: 1, gap: 32 }}>
      {body}
    </Screen>
  );
}

/**
 * 两张图共用的「得分率 / 任务数 / 时长」三档切换（总览第二个面板 ↔ 分览板块条形图）。
 * 两处各持一份选中态（`overviewMetric` / `boardMetric`），互不影响；文案与几何完全一致。
 */
function MetricChips({ value, onChange }: { value: ChartMetric; onChange: (v: ChartMetric) => void }) {
  return (
    <OptionChips
      options={['score', 'tasks', 'time'] as ChartMetric[]}
      value={value}
      onChange={onChange}
      labelOf={(k) => tr(k === 'score' ? '得分率' : k === 'tasks' ? '任务数' : '时长')}
      accessibilityLabel={tr('切换指标')}
      stretch
      /* 与统计范围四档同一口径：未选中不铺底、不描边 */
      plainInactive
    />
  );
}

/** 总览三指标：三等分卡片内宽（不含内边距）且各自居中对齐；标签 14px（行高沿用 micro 17）、数值 16px（sm 档） */
function Metric({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <AppText kind="micro" color={theme.colors.textMuted} style={{ fontSize: theme.size(14), textAlign: 'center' }}>
        {label}
      </AppText>
      <AppText kind="sm" color={theme.colors.text} style={{ textAlign: 'center' }}>
        {value}
      </AppText>
    </View>
  );
}
