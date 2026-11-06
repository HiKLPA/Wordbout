import * as Clipboard from 'expo-clipboard';
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  AppText,
  Card,
  EmptyState,
  PageHeader,
  PrimaryButton,
  Screen,
  SectionTitle,
} from '@/components/ui';
import { appConfig } from '@/config/appConfig';
import {
  formatDwell,
  formatPct,
  summarize,
  type AnalyticsSummary,
} from '@/domain/analytics';
import { tr, trf } from '@/i18n';
import { askDialog, notifyUser } from '@/components/AppDialog';
import { readAnalytics, clearAnalytics, trackTap, type AnalyticsSnapshot } from '@/lib/analytics';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * 数据统计（埋点自查页）。
 *
 * 这里不是报表，是**口径自查工具**：一个指标只有一处计算（`domain/analytics.summarize`），
 * 页面只负责把结果画出来，所以这里看到的数和导出的 JSON 永远一致。
 *
 * 四块内容对应四个问题：
 * - 概览：有没有人真的在用（会话数、平均会话时长、事件量）；
 * - 页面停留：哪些页面被看、看多久、是不是「点进去就走」；
 * - 点击排行：哪个按钮被反复点、哪个入口没人碰；
 * - 事件流水：最近发生了什么，出问题时按时间线复盘。
 */
export default function AnalyticsScreen() {
  const theme = useTheme();
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);

  const reload = useCallback(async () => {
    const snap = await readAnalytics();
    setSnapshot(snap);
    setSummary(summarize(snap.events, appConfig.analytics.engagedThresholdMs));
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const copyAll = async () => {
    trackTap('复制埋点数据');
    const json = JSON.stringify(snapshot?.events ?? [], null, 2);
    await Clipboard.setStringAsync(json);
    // 网页版没有系统弹窗，提示统一走 App 内面板
    void notifyUser(tr('已复制'), tr('埋点数据已复制到剪贴板，可直接粘贴到表格或文档里。'));
  };

  const confirmClear = () => {
    trackTap('清空埋点数据');
    void askDialog({
      title: tr('清空数据统计'),
      message: tr('清空后不可恢复，学习记录与收藏不受影响。'),
      actions: [
        { id: 'cancel', label: tr('取消'), tone: 'cancel' },
        { id: 'clear', label: tr('清空'), tone: 'danger' },
      ],
    }).then((picked) => {
      if (picked === 'clear') void clearAnalytics().then(reload);
    });
  };

  const empty = !snapshot || snapshot.events.length === 0;

  return (
    <Screen header={<PageHeader title="数据统计" />} contentStyle={{ gap: 20 }}>
      {empty ? (
        <EmptyState
          title={tr('还没有数据')}
          hint={tr('正常使用一会儿再回来，页面停留与点击会自动记下来。')}
        />
      ) : null}

      {summary && snapshot ? (
        <>
          {/* 概览：三个数放在一张卡里，横向等分 */}
          <View style={{ gap: 10 }}>
            <SectionTitle label="概览" />
            <Card style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row' }}>
                <Metric label={tr('会话')} value={String(summary.sessions)} />
                <Metric label={tr('平均会话')} value={formatDwell(summary.avgSessionMs)} />
                <Metric label={tr('事件')} value={String(summary.eventCount)} />
              </View>
              <AppText kind="micro" color={theme.colors.textMuted} style={{ marginTop: 12 }}>
                {trf('本地共 {n} 条记录，占用 {k} KB；停留达到 {t} 秒算一次有效访问。', {
                  n: snapshot.events.length,
                  k: Math.max(1, Math.round(snapshot.bytes / 1024)),
                  t: appConfig.analytics.engagedThresholdMs / 1000,
                })}
              </AppText>
            </Card>
          </View>

          {/* 页面停留 */}
          <View style={{ gap: 10 }}>
            <SectionTitle label="页面停留" />
            <Card style={{ padding: 16, gap: 14 }}>
              {summary.screens.length === 0 ? (
                <AppText kind="sm" color={theme.colors.textSecondary}>
                  {tr('还没有页面停留记录')}
                </AppText>
              ) : (
                summary.screens.slice(0, 8).map((row) => (
                  <View key={row.screen} style={{ gap: 3 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <AppText kind="md" color={theme.colors.text}>
                          {row.screen}
                        </AppText>
                      </View>
                      <AppText kind="sm" color={theme.colors.text}>
                        {formatDwell(row.avgMs)}
                      </AppText>
                    </View>
                    <AppText kind="micro" color={theme.colors.textMuted}>
                      {trf('{n} 次访问 · 占比 {p} · 有效 {q}', {
                        n: row.views,
                        p: formatPct(row.share),
                        q: formatPct(row.engagedRate),
                      })}
                    </AppText>
                  </View>
                ))
              )}
            </Card>
          </View>

          {/* 点击排行 */}
          <View style={{ gap: 10 }}>
            <SectionTitle label="点击排行" />
            <Card style={{ padding: 16, gap: 12 }}>
              {summary.taps.length === 0 ? (
                <AppText kind="sm" color={theme.colors.textSecondary}>
                  {tr('还没有点击记录')}
                </AppText>
              ) : (
                summary.taps.slice(0, 8).map((row) => (
                  <View
                    key={`${row.screen}|${row.element}`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                  >
                    <View style={{ flex: 1 }}>
                      <AppText kind="md" color={theme.colors.text} numberOfLines={1}>
                        {row.element}
                      </AppText>
                      <AppText kind="micro" color={theme.colors.textMuted}>
                        {row.screen}
                      </AppText>
                    </View>
                    <AppText kind="sm" color={theme.colors.textSecondary}>
                      {trf('{n} 次', { n: row.count })}
                    </AppText>
                  </View>
                ))
              )}
            </Card>
          </View>

          {/* 事件流水：最近 10 条，倒序 */}
          <View style={{ gap: 10 }}>
            <SectionTitle label="事件流水" />
            <Card style={{ padding: 16, gap: 10 }}>
              {[...snapshot.events]
                .slice(-10)
                .reverse()
                .map((event) => (
                  <View
                    key={event.id}
                    style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}
                  >
                    <AppText kind="micro" color={theme.colors.textMuted} style={{ width: 58 }}>
                      {clock(event.ts)}
                    </AppText>
                    <View style={{ flex: 1 }}>
                      <AppText kind="tiny" color={theme.colors.text}>
                        {event.name}
                      </AppText>
                    </View>
                    <AppText kind="micro" color={theme.colors.textSecondary}>
                      {event.screen ?? '—'}
                    </AppText>
                  </View>
                ))}
            </Card>
          </View>

          <View style={{ gap: 10 }}>
            <PrimaryButton label="刷新" tone="ghost" onPress={() => void reload()} />
            <PrimaryButton label="复制数据" onPress={() => void copyAll()} />
            <PrimaryButton label="清空数据" tone="danger" onPress={confirmClear} />
          </View>
        </>
      ) : null}
    </Screen>
  );
}

/** 概览里的一格：数字在上、标签在下，三格等分 */
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

/** 事件流水的时间戳只显示时分秒 */
function clock(ts: number): string {
  const d = new Date(ts);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}
