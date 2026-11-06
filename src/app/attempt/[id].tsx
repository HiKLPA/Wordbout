import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { AppText, Badge, Card, Divider, EmptyState, PageHeader, PrimaryButton, Screen } from '@/components/ui';
import { exerciseTypeMap, levels } from '@/config/appConfig';
import { formatDateTime, formatDurationHuman } from '@/domain/date';
import { tr, trf } from '@/i18n';
import { useApp } from '@/store/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { layout } from '@/theme/tokens';

/**
 * 作答与评分详情（FR-E-14 验收标准：评分结果与原始作答一并保存，可回看、可对比、可删除）。
 * 评分失败时也能离线查看已提交的作答内容（FR-E-15）。
 */
export default function AttemptDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, actions } = useApp();
  const attempt = state.attempts.find((a) => a.id === id);

  if (!attempt) {
    return (
      <Screen header={<PageHeader title="作答详情" />}>
        <EmptyState title="该记录已被删除或不存在" hint="删除全部学习记录后，历史作答不可恢复" />
      </Screen>
    );
  }

  const def = exerciseTypeMap[attempt.typeId];
  const level = levels.find((l) => l.id === attempt.levelId);
  const result = attempt.result;

  return (
    <Screen header={<PageHeader
        title={attempt.promptTitle}
        subtitle={`${tr(def?.labelZh ?? attempt.typeId)} · ${tr(level?.labelZh ?? attempt.levelId)} · ${formatDateTime(attempt.finishedAt)}`}
      />} contentStyle={{ gap: 16 }}>
      <Card style={{ padding: 16, gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppText kind="micro" color={theme.colors.textMuted}>
            题目要求
          </AppText>
          <Badge text={trf('用时 {v}', { v: formatDurationHuman(attempt.durationSec) })} />
        </View>
        <AppText kind="body" color={theme.colors.text}>
          {attempt.prompt}
        </AppText>
      </Card>

      <Card style={{ padding: 16, gap: 8 }}>
        <AppText kind="micro" color={theme.colors.textMuted}>
          原始作答
        </AppText>
        <AppText kind="body" color={theme.colors.text}>
          {attempt.answer.trim() || '（空作答）'}
        </AppText>
      </Card>

      {attempt.status === 'failed' ? (
        <Card style={{ padding: 16, gap: 8 }}>
          <AppText kind="md" color={theme.colors.brand}>
            评分失败，请稍后重试
          </AppText>
          <AppText kind="micro" color={theme.colors.textSecondary}>
            作答内容已离线保留，可以回到练习页重新提交；重试成功后覆盖失败记录，不产生重复记录。
          </AppText>
        </Card>
      ) : null}

      {result ? (
        <>
          <Card style={{ padding: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <View>
                <AppText kind="micro" color={theme.colors.textMuted}>
                  总分（满分 100）
                </AppText>
                <AppText kind="xxxl" color={theme.colors.brand}>
                  {String(Math.round(attempt.scoreRate ?? result.total))}
                </AppText>
              </View>
              <AppText kind="micro" color={theme.colors.textMuted}>
                {trf('评分时间 {v}', { v: formatDateTime(result.gradedAt) })}
              </AppText>
            </View>
            <Divider />
            {result.breakdown.map((b) => (
              <View key={b.label} style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <AppText kind="micro" color={theme.colors.text}>
                    {b.label}
                  </AppText>
                  <AppText kind="micro" color={theme.colors.textSecondary}>
                    {`${b.score} / ${b.max}`}
                  </AppText>
                </View>
                <View style={{ height: layout.progressHeight, borderRadius: layout.progressHeight / 2, backgroundColor: theme.colors.progressTrack }}>
                  <View
                    style={{
                      width: `${Math.round((b.score / Math.max(1, b.max)) * 100)}%`,
                      height: layout.progressHeight,
                      borderRadius: layout.progressHeight / 2,
                      backgroundColor: theme.colors.brand,
                    }}
                  />
                </View>
              </View>
            ))}
          </Card>

          <Card style={{ padding: 16, gap: 8 }}>
            <AppText kind="micro" color={theme.colors.textMuted}>
              具体问题定位
            </AppText>
            {result.issues.length === 0 ? (
              <AppText kind="micro" color={theme.colors.textSecondary}>
                本次没有发现需要标注的问题。
              </AppText>
            ) : (
              result.issues.map((issue, i) => (
                <View key={`${issue.where}-${i}`} style={{ flexDirection: 'row', gap: 8 }}>
                  <Badge text={issue.kind} />
                  <View style={{ flex: 1 }}>
                    <AppText kind="micro" color={theme.colors.text}>
                      {issue.where}
                    </AppText>
                    <AppText kind="micro" color={theme.colors.textSecondary}>
                      {issue.detail}
                    </AppText>
                  </View>
                </View>
              ))
            )}
          </Card>

          <Card style={{ padding: 16, gap: 8 }}>
            <AppText kind="micro" color={theme.colors.textMuted}>
              改进建议
            </AppText>
            {result.advice.map((a) => (
              <AppText key={a} kind="micro" color={theme.colors.text}>
                · {a}
              </AppText>
            ))}
          </Card>

          {result.reference ? (
            <Card style={{ padding: 16, gap: 8 }}>
              <AppText kind="micro" color={theme.colors.textMuted}>
                参考内容
              </AppText>
              <AppText kind="body" color={theme.colors.text}>
                {result.reference}
              </AppText>
            </Card>
          ) : null}
        </>
      ) : null}

      <PrimaryButton
        label="删除这条记录"
        tone="ghost"
        onPress={() => actions.removeAttempt(attempt.id)}
      />
      <AppText kind="micro" color={theme.colors.textMuted}>
        删除后练习页计数与查询表会按剩余明细重新计算。需要清空全部记录时，请到「更多 — Statistics」使用「删除全部学习记录」（二次确认，删除后不可恢复）。
      </AppText>
    </Screen>
  );
}
