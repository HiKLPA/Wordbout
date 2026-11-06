import React from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui';
import type { IconProps } from '@/components/icons';
import { trf } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, stroke } from '@/theme/tokens';

/** 封面图标边长：192 见方的封面上居中一枚，大小按原来那档 64px 大字的手感给 */
const COVER_ICON_SIZE = 72;

/**
 * 题集卡片 —— 与课本卡片（`TextbookCard`）同一套版式：
 * 宽 `layout.bookWidth`(192)、上封面 `bookCoverHeight`(192) + 下信息条 `bookLabelHeight`(48)，
 * 圆角 `layout.cardRadius`(32)、描边与 `Card` 同源（`colors.border`），靠 `overflow: hidden` 裁掉直角。
 *
 * 封面 = **题集对应的图标**（听 = 耳朵 / 说 = 麦克风 / 读 = 题卷 / 写 = 笔 / 译 = 文 A / 积累 = 叠层 /
 * 综合 = 交叉双箭头），与各分区标题前那枚同源；题集名不再画在封面上（与分区标题重复）。
 * 信息条与**收藏夹卡片**同一套两行版式：上行 = 题集名（`tiny`，正文色），下行 = 收进题集的题目数
 * （`micro`，次要色；**只有数字，不带量词**），两行均**水平居中**（2026-10-16 与星标区收藏夹卡片对齐）。
 * 封面底色**一律品牌红**（2026-10-16：测验题集原先单独用品牌黄，已按用户要求改回红），
 * 图标走 `palette.invert`（封面底色上的反白），跟课本卡片排在一起也不打架。
 */
export function SetCard({
  icon: Icon,
  name,
  count,
  onPress,
  accessibilityLabel,
}: {
  /** 封面图标（按题集取，见 `BOARD_ICONS` / `StackIcon` / `ShuffleIcon`） */
  icon: React.ComponentType<IconProps>;
  /** 题集名（已是本地化后的文案）：画在信息条上行，同时进无障碍名 */
  name: string;
  /** 收藏的题目数 */
  count: number;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? trf('{name}，{n} 道题', { name, n: count })}
      style={{
        width: layout.bookWidth,
        borderRadius: layout.cardRadius,
        borderWidth: stroke.base,
        borderColor: theme.colors.border,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          height: layout.bookCoverHeight,
          backgroundColor: theme.palette.brandPrimary,
          // 图标居中（原先中文大字是贴左下角、英文是居中，现在两语同款）
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={COVER_ICON_SIZE} color={theme.palette.invert} />
      </View>
      <View
        style={{
          height: layout.bookLabelHeight,
          backgroundColor: theme.colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 9,
          overflow: 'hidden',
        }}
      >
        {/* 信息条两行：题集名（tiny，正文色）+ 题数（micro，次要色）—— 与收藏夹卡片同一套，且同样水平居中 */}
        <AppText kind="tiny" color={theme.colors.text} numberOfLines={1} align="center">
          {name}
        </AppText>
        <AppText
          kind="micro"
          color={theme.colors.textSecondary}
          numberOfLines={1}
          align="center"
          style={{ marginTop: 2 }}
        >
          {String(count)}
        </AppText>
      </View>
    </Pressable>
  );
}
