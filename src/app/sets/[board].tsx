import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { View } from 'react-native';

import { AppText, Card, EmptyState, PageHeader, Screen } from '@/components/ui';
import { boards, exerciseTypeMap } from '@/config/appConfig';
import { exerciseItems, type ExerciseItem } from '@/data/questions';
import { findAccumulationItem } from '@/domain/accumulation';
import { addDays, dateKey, formatDayShort, todayKey } from '@/domain/date';
import type { SavedItem } from '@/domain/types';
import { tr, trf } from '@/i18n';
import { useApp } from '@/store/AppStore';
import { useTheme } from '@/theme/ThemeProvider';

/** 题集列表里的一行：不同来源的题集把题目归一成同一形状再渲染 */
interface SetRow {
  id: string;
  /** 题型小标题（板块名 / 测验名） */
  typeLabel: string;
  /** 题面（点进去要做的提示语） */
  prompt: string;
  /** 点这一行去哪里开做 */
  href: string;
}

/**
 * 题集详情（`/sets/<board>`）—— 一个板块（听 / 说 / 读 / 写 / 译）或两档测验题集（积累 / 测验）的列表。
 *
 * 数据来自 `PersistedState.savedItems`（作答页「加入题集」收进来的题）：练习场次收的题归各板块题集，
 * 积累收的归「积累」题集，综合收的归「测验」题集，三者互不混。
 * 列表**按收藏日期分区**（同一天收藏的在同一区，今天 / 昨天 / M月D日），
 * 点某道题就从那道题开始做：板块 / 测验走错题重做链路（`mode=wrong` + `set` + `item`），
 * 积累走积累测验的题集来路（`?set=accumulation&item=`），队首都是点中的这题。
 */
export default function SetDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { board } = useLocalSearchParams<{ board: string }>();
  const { state } = useApp();

  const isQuiz = board === 'quiz';
  const isAccumulation = board === 'accumulation';
  const boardDef = boards.find((b) => b.id === board);

  /** 该题集里的收藏题目（带收藏时间），最近的排前面（早期没记时间的数据自然排在最后） */
  const entries = useMemo(() => {
    /** 把一条收藏归到本页要展示的题集；不属于本页时返回 null */
    const toRow = (saved: SavedItem): SetRow | null => {
      if (isAccumulation) {
        if (saved.source !== 'accumulation') return null;
        const acc = findAccumulationItem(saved.itemId);
        if (!acc) return null;
        return {
          id: acc.id,
          typeLabel: tr('积累'),
          prompt: acc.promptZh,
          href: `/accumulation?set=accumulation&item=${acc.id}`,
        };
      }
      const item: ExerciseItem | undefined = exerciseItems.find((i) => i.id === saved.itemId);
      if (!item) return null;
      const mine = isQuiz
        ? saved.source === 'quiz'
        : saved.source === 'practice' && exerciseTypeMap[item.typeId]?.board === board;
      if (!mine) return null;
      return {
        id: item.id,
        typeLabel: tr(exerciseTypeMap[item.typeId]?.labelZh ?? item.typeId),
        prompt: item.prompt,
        href: `/practice/${item.typeId}?mode=wrong&set=${isQuiz ? 'quiz' : board}&item=${item.id}`,
      };
    };

    const list: { saved: SavedItem; row: SetRow }[] = [];
    for (const saved of state.savedItems) {
      const row = toRow(saved);
      if (row) list.push({ saved, row });
    }
    return list.sort((a, b) => b.saved.savedAt - a.saved.savedAt);
  }, [state.savedItems, board, isQuiz, isAccumulation]);

  /** 按收藏日期分区：key = YYYY-MM-DD；早期数据没有时间，单独归到 legacy 一档 */
  const groups = useMemo(() => {
    const out: { key: string; rows: typeof entries }[] = [];
    for (const e of entries) {
      const key = e.saved.savedAt > 0 ? dateKey(new Date(e.saved.savedAt)) : 'legacy';
      const last = out[out.length - 1];
      if (last && last.key === key) last.rows.push(e);
      else out.push({ key, rows: [e] });
    }
    return out;
  }, [entries]);

  const dayLabel = (key: string) => {
    if (key === 'legacy') return tr('较早收藏');
    if (key === todayKey()) return tr('今天');
    if (key === addDays(todayKey(), -1)) return tr('昨天');
    return formatDayShort(key);
  };

  const setName = isQuiz ? tr('综合') : isAccumulation ? tr('积累') : tr(boardDef?.labelZh ?? board ?? '');
  const title = trf('{name}题集', { name: setName });

  return (
    <Screen
      header={<PageHeader title={title} />}
      contentStyle={{ gap: 24 }}
    >
      {entries.length === 0 ? (
        <EmptyState title="这个题集还是空的" hint="在作答页点「加入题集」把题目收进来" />
      ) : (
        groups.map((g) => (
          <View key={g.key} style={{ gap: 8 }}>
            <AppText kind="sm" color={theme.colors.text}>
              {dayLabel(g.key)}
            </AppText>
            {g.rows.map(({ row }) => (
              <Card
                key={row.id}
                style={{ padding: 16, gap: 6 }}
                onPress={() => router.push(row.href as never)}
                accessibilityLabel={trf('开始做这道题：{p}', { p: row.prompt })}
              >
                <AppText kind="micro" color={theme.colors.textMuted}>
                  {row.typeLabel}
                </AppText>
                <AppText kind="body" color={theme.colors.text} numberOfLines={2}>
                  {row.prompt}
                </AppText>
              </Card>
            ))}
          </View>
        ))
      )}
    </Screen>
  );
}
