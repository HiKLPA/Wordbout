import React from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui';
import { getBookWordCount } from '@/data/wordbooks';
import type { Wordbook } from '@/domain/types';
import { trf } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { BOOK_TONE_COLORS, layout, stroke } from '@/theme/tokens';

/** 封面大字左边距（9 → 16 → 8；底边仍贴齐封面底沿，故 paddingBottom 保持 0） */
const COVER_PAD = 8;

/**
 * 课本卡片 —— 对应 Figma「Textbook」组件：
 * 192x240 = 192x192 封面（按 `book.tone` 取品牌红 / 黄 / 蓝）+ 192x48 信息条（面板底色 surface，正文近黑）。
 * 封面色与词库详情页的页面强调色同源（`BOOK_TONE_COLORS`）：卡片是什么色，点进去那一页就是什么色。
 * 封面大字 Barlow ExtraBold 48（`xxl` 档，行高 64），左内边距 8、底边贴齐封面底沿；信息条 Barlow Bold 16，内边距 9/14。
 * 封面右上角的「已下载」白底圆角标已于 2026-10-14 删除（`book.downloaded` 仍在数据里，界面不再呈现）。
 * 圆角取 `layout.cardRadius`（32），描边与 `Card` 同源（`theme.colors.border`，普通描边），
 * 靠 overflow: hidden 裁掉封面 / 信息条的直角。
 */
export function TextbookCard({
  book,
  learned = 0,
  onPress,
}: {
  book: Wordbook;
  learned?: number;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const coverColor = BOOK_TONE_COLORS[book.tone];
  /**
   * 封面大字**恒取浅色**（`brandOn`）：红 / 黄 / 蓝底都是同一档浅色（2026-10-17 起黄底不再转深色，
   * 与封面文件夹图标、色板勾一致）。
   */
  const coverTextColor = theme.colors.brandOn;
  /** 词数取课本内实际词条数（实时统计），不用词库标称的 wordCount */
  const total = getBookWordCount(book.id);
  const progress = total > 0 ? Math.min(1, learned / total) : 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={trf('{name}，共 {n} 词，已学 {l} 词', { name: book.name, n: total, l: learned })}
      style={{
        width: layout.bookWidth,
        borderRadius: layout.cardRadius,
        borderWidth: stroke.base,
        borderColor: theme.colors.border,
        overflow: 'hidden',
      }}
    >
      <View style={{ height: layout.bookCoverHeight, backgroundColor: coverColor, justifyContent: 'flex-end' }}>
        <View style={{ paddingLeft: COVER_PAD, paddingBottom: 0 }}>
          <AppText kind="xxl" color={coverTextColor} numberOfLines={1}>
            {book.coverText}
          </AppText>
        </View>
      </View>
      <View
        style={{
          height: layout.bookLabelHeight,
          backgroundColor: theme.colors.surface,
          justifyContent: 'center',
          paddingHorizontal: 9,
          overflow: 'hidden',
        }}
      >
        {/* 进度条在上、单词进度（已学 / 总数）在下，且水平居中；
            进度填充与封面同色（黄封面的课本 → 黄进度条，蓝封面 → 蓝进度条） */}
        <View style={{ height: layout.progressHeight, borderRadius: layout.progressHeight / 2, backgroundColor: theme.colors.progressTrack }}>
          <View
            style={{
              width: `${Math.round(progress * 100)}%`,
              height: layout.progressHeight,
              borderRadius: layout.progressHeight / 2,
              backgroundColor: coverColor,
            }}
          />
        </View>
        <AppText
          kind="tiny"
          color={theme.colors.text}
          numberOfLines={1}
          align="center"
          style={{ marginTop: 4 }}
        >
          {learned}/{total}
        </AppText>
      </View>
    </Pressable>
  );
}
