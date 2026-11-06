import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { TrendChart } from '@/components/TrendChart';
import { AppText, Card, Divider, EmptyState, OptionChips, PageHeader, PrimaryButton, Screen, SectionTitle } from '@/components/ui';
import { exerciseTypeMap, exerciseTypes, type ExerciseTypeId } from '@/config/appConfig';
import { addDays, formatDateTime, formatDurationHuman, todayKey } from '@/domain/date';
import { aggregate, trendPoints } from '@/domain/stats';
import { tr, trf } from '@/i18n';
import { useApp } from '@/store/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { layout } from '@/theme/tokens';

/**
 * 学习统计与数据管理（FR-O-4）。
 * 本页只保留三件事：累计概览、导出学习记录、删除全部学习记录；
 * 分时段 / 分项目的详细查询与得分趋势由练习页的「能力趋势」承担（FR-E-16 ~ FR-E-20）。
 */
export default function StatsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { state, actions } = useApp();
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [exported, setExported] = useState<string | null>(null);
  const [curveType, setCurveType] = useState<ExerciseTypeId | null>(null);

  const from = addDays(todayKey(), -29);
  const to = todayKey();

  const overview = useMemo(
    () =>
      aggregate(
        state.attempts,
        state.daily,
        { from, to },
        exerciseTypes.map((t) => t.id),
        (t) => exerciseTypeMap[t].board,
      ),
    [state.attempts, state.daily, from, to],
  );

  const lifetime = useMemo(() => {
    const days = Object.values(state.daily);
    return {
      days: days.filter((d) => d.taskCount > 0 || d.durationSec > 0).length,
      durationSec: days.reduce((s, d) => s + d.durationSec, 0),
      taskCount: days.reduce((s, d) => s + d.taskCount, 0),
    };
  }, [state.daily]);

  const curve = useMemo(
    () => (curveType ? trendPoints(state.attempts, curveType, { from, to }) : null),
    [state.attempts, curveType, from, to],
  );

  const doExport = async () => {
    const text = actions.exportData(exportFormat);
    setExported(text);
    await Clipboard.setStringAsync(text);
    Alert.alert(tr('已生成并复制到剪贴板'), trf('格式：{fmt}，共 {n} 行。可直接粘贴到任何文本工具中保存。', { fmt: exportFormat.toUpperCase(), n: text.split('\n').length }));
  };

  const confirmDelete = () => {
    Alert.alert(
      tr('删除全部学习记录'),
      '删除后不可恢复：练习记录、连续天数、能力趋势统计与写作本都会被清空，且不再参与词库排行统计。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            actions.resetLearningData();
            setExported(null);
            Alert.alert(tr('已删除'), tr('全部学习记录已清空，练习页计数器与查询表已回到空数据态。'));
          },
        },
      ],
    );
  };

  return (
    <Screen header={<PageHeader title="学习统计与数据管理" />} contentStyle={{ gap: 18 }}>
      <View style={{ gap: 10 }}>
        <SectionTitle label="总览" />
        <Card style={{ padding: 16, gap: 16 }}>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText kind="micro" color={theme.colors.textMuted}>
                累计学习天数
              </AppText>
              <AppText kind="md" color={theme.colors.text}>
                {lifetime.days} 天
              </AppText>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText kind="micro" color={theme.colors.textMuted}>
                累计总时长
              </AppText>
              <AppText kind="md" color={theme.colors.text}>
                {formatDurationHuman(lifetime.durationSec)}
              </AppText>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText kind="micro" color={theme.colors.textMuted}>
                累计完成任务
              </AppText>
              <AppText kind="md" color={theme.colors.text}>
                {lifetime.taskCount} 个
              </AppText>
            </View>
          </View>
          <Divider />
          <AppText kind="micro" color={theme.colors.textSecondary}>
            {trf('近 30 天：练习 {d} 天 · {t} · {n} 个任务 · 平均得分率 {r}', { d: overview.practiceDays, t: formatDurationHuman(overview.totalDurationSec), n: overview.totalTaskCount, r: overview.avgScoreRate === null ? tr('无') : `${overview.avgScoreRate.toFixed(1)}%` })}
          </AppText>
          <PrimaryButton label="打开能力趋势" tone="ghost" onPress={() => router.push('/query-table' as never)} />
        </Card>
      </View>

      <View style={{ gap: 10 }}>
        <SectionTitle label="正确率" />
        <Card style={{ padding: 16, gap: 16 }}>
          <AppText kind="micro" color={theme.colors.textMuted}>
            各题型正确率（近 30 天）
          </AppText>
          {overview.byType.every((r) => r.count === 0) ? (
            <EmptyState title="还没有练习记录，先完成一次练习吧" />
          ) : (
            overview.byType
              .filter((r) => r.count > 0)
              .map((r) => (
                <View key={r.typeId} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <AppText kind="micro" color={theme.colors.text}>
                      {exerciseTypeMap[r.typeId].labelZh}
                    </AppText>
                    <AppText kind="micro" color={theme.colors.textSecondary}>
                      {r.scoreRate === null ? '无' : `${r.scoreRate.toFixed(1)}%`}
                    </AppText>
                  </View>
                  <View style={{ height: layout.progressHeight, borderRadius: layout.progressHeight / 2, backgroundColor: theme.colors.progressTrack }}>
                    <View
                      style={{
                        width: `${Math.min(100, Math.max(0, r.scoreRate ?? 0))}%`,
                        height: layout.progressHeight,
                        borderRadius: layout.progressHeight / 2,
                        backgroundColor: theme.colors.brand,
                      }}
                    />
                  </View>
                  <PrimaryButton
                    label="看正确率曲线"
                    tone="ghost"
                    onPress={() => setCurveType(r.typeId)}
                    style={{ alignSelf: 'flex-start', minHeight: 30, paddingHorizontal: 10 }}
                  />
                </View>
              ))
          )}
          {curveType && curve ? (
            <View style={{ gap: 8 }}>
              <Divider />
              <AppText kind="sm" color={theme.colors.text}>
                {trf('{name} 正确率曲线', { name: tr(exerciseTypeMap[curveType].labelZh) })}
              </AppText>
              {curve.points.length < 2 ? (
                <AppText kind="micro" color={theme.colors.textSecondary}>
                  {tr('暂无趋势，需至少练习同一项目两日')}
                </AppText>
              ) : (
                <TrendChart points={curve.points} />
              )}
            </View>
          ) : null}
        </Card>
      </View>

      <View style={{ gap: 10 }}>
        <SectionTitle label="导出" />
        <Card style={{ padding: 16, gap: 16 }}>
          <AppText kind="micro" color={theme.colors.textSecondary}>
            导出格式为可读文本（CSV 或 JSON），与练习页查询表使用同一份数据源与同一种格式。
          </AppText>
          <OptionChips options={['csv', 'json'] as const} value={exportFormat} onChange={setExportFormat} labelOf={(v) => v.toUpperCase()} />
          <PrimaryButton label="生成并复制学习记录" onPress={doExport} disabled={state.attempts.length === 0} />
          {exported ? (
            <View style={{ gap: 6 }}>
              <AppText kind="micro" color={theme.colors.textMuted}>
                {trf('预览（前 12 行 / 共 {n} 行）', { n: exported.split('\n').length })}
              </AppText>
              <Card style={{ padding: 16, backgroundColor: theme.colors.surfaceRaised }}>
                <AppText kind="micro" color={theme.colors.textSecondary} numberOfLines={14}>
                  {exported.split('\n').slice(0, 12).join('\n')}
                </AppText>
              </Card>
            </View>
          ) : null}
        </Card>
      </View>

      <View style={{ gap: 10 }}>
        <SectionTitle label="记录" />
        <Card style={{ padding: 16, gap: 16 }}>
          {state.attempts.length === 0 ? (
            <EmptyState title="没有可查看的记录" hint="删除全部学习记录后这里会保持为空" />
          ) : (
            state.attempts.slice(0, 20).map((a, i) => (
              <View key={a.id}>
                {i > 0 ? <Divider /> : null}
                <View style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <AppText kind="micro" color={theme.colors.text} numberOfLines={1} style={{ flexShrink: 1 }}>
                      {a.promptTitle}
                    </AppText>
                    <AppText kind="micro" color={theme.colors.textSecondary}>
                      {a.scoreRate === null ? '未评分' : trf('{v} 分', { v: a.scoreRate.toFixed(0) })}
                    </AppText>
                  </View>
                  <AppText kind="micro" color={theme.colors.textMuted}>
                    {trf('{time} · 用时 {v}', { time: formatDateTime(a.finishedAt), v: formatDurationHuman(a.durationSec) })}
                  </AppText>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <PrimaryButton
                      label="查看详情"
                      tone="ghost"
                      onPress={() => router.push(`/attempt/${a.id}` as never)}
                      style={{ minHeight: 30, paddingHorizontal: 10 }}
                    />
                    <PrimaryButton
                      label="删除"
                      tone="ghost"
                      onPress={() => actions.removeAttempt(a.id)}
                      style={{ minHeight: 30, paddingHorizontal: 10 }}
                    />
                  </View>
                </View>
              </View>
            ))
          )}
        </Card>
      </View>

      <PrimaryButton label="删除全部学习记录" tone="danger" onPress={confirmDelete} />
    </Screen>
  );
}
