import React from 'react';
import { Pressable, View } from 'react-native';

import { FolderIcon } from '@/components/icons';
import { AppText } from '@/components/ui';
import type { FavoriteFolder } from '@/domain/types';
import { favoriteFolderLabel } from '@/domain/favorites';
import { trf } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { folderColorValue, layout, stroke } from '@/theme/tokens';

/**
 * 收藏夹卡片 —— 与 TextbookCard 同款几何（192x240 = 192x192 封面 + 192x48 信息条），
 * 所以星标区里「收藏夹」和「收藏的课本」能并排成一行、视觉同级（课本本质上也是一种收藏）。
 * 封面为该收藏夹自选的颜色（六选一，默认品牌红）+ 文件夹图标居中（图标恒白）；信息条显示收藏夹名与收藏条数。
 */
export function FavoriteFolderCard({
  folder,
  count,
  onPress,
}: {
  folder: FavoriteFolder;
  /** 夹内单词数 */
  count: number;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const name = favoriteFolderLabel(folder);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={trf('{name}，共 {n} 个单词', { name, n: count })}
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
          // 封面底色 = 该收藏夹自选的颜色（没选过 = 品牌红）
          backgroundColor: folderColorValue(folder.color),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* 封面的文件夹图标一律白色（`brandOn`，与全 App「文字 / 图标白」同一档），不再按底色明暗自适应 */}
        <FolderIcon size={96} color={theme.colors.brandOn} />
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
