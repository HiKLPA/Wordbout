import React from 'react';
import { View } from 'react-native';

import { Logo } from '@/components/icons';
import { AppText, Card, PageHeader, Screen, SectionTitle } from '@/components/ui';
import { APP_VERSION, releaseNotes } from '@/content/legal';
import { useTheme } from '@/theme/ThemeProvider';

/** 软件信息与更新记录（FR-O-3） */
export default function AboutScreen() {
  const theme = useTheme();
  /**
   * 版本号 16、更新记录 16/12 都不在排版 token 档位里，按工程约定逐档显式给行高 ——
   * 中英行盒一致，切语言不重排。品牌名「Wordbout」直接用 `kind="xl"` 的 32 / 行高 42。
   */
  const versionText = { fontSize: theme.size(16), lineHeight: theme.size(22) };
  const noteMetaText = { fontSize: theme.size(16), lineHeight: theme.size(22) };
  /** 更新记录正文：两端对齐（中文长句右侧不留参差） */
  const noteBodyText = {
    fontSize: theme.size(12),
    lineHeight: theme.size(17),
    textAlign: 'justify' as const,
  };

  return (
    <Screen header={<PageHeader title="关于" />} contentStyle={{ gap: 18 }}>
      {/* 品牌区不套面板：Logo + 品牌名 + 版本号直接落在页面底色上 */}
      <View style={{ alignItems: 'center', gap: 10, paddingVertical: 8 }}>
        <Logo size={160} />
        {/* 版本号跟在品牌名后面同一行（基线对齐），不再单独占一行 */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <AppText kind="xl" color={theme.colors.text}>
            Wordbout
          </AppText>
          <AppText kind="micro" color={theme.colors.textMuted} style={versionText}>
            {APP_VERSION}
          </AppText>
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <SectionTitle label="更新简介" />
        <Card style={{ padding: 16, gap: 16 }}>
          {/* 只渲染最新版一条（`releaseNotes[0]`）：历史版本仍留在 `content/legal.ts` 数据里，需要时再加「历史版本」入口 */}
          {releaseNotes.slice(0, 1).map((note) => (
            <View key={note.version} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <AppText kind="sm" color={theme.colors.text} style={noteMetaText}>
                  {note.version}
                </AppText>
                <AppText kind="micro" color={theme.colors.textMuted} style={noteMetaText}>
                  {note.date}
                </AppText>
              </View>
              {/* 最新版的一句话简介：夹在版本行与条目之间，与条目正文同号同对齐 */}
              {note.summary ? (
                <AppText kind="micro" color={theme.colors.textSecondary} style={noteBodyText}>
                  {note.summary}
                </AppText>
              ) : null}
              {note.items.map((item) => (
                <View key={item} style={{ flexDirection: 'row', gap: 6 }}>
                  <AppText kind="micro" color={theme.colors.brand}>
                    ·
                  </AppText>
                  <AppText
                    kind="micro"
                    color={theme.colors.textSecondary}
                    style={[noteBodyText, { flex: 1 }]}
                  >
                    {item}
                  </AppText>
                </View>
              ))}
            </View>
          ))}
        </Card>
      </View>
    </Screen>
  );
}
