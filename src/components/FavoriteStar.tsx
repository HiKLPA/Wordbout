import React, { useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { FavoritePicker } from '@/components/FavoritePicker';
import { StarButton } from '@/components/ui';
import { favoriteCountByFolder } from '@/domain/favorites';
import type { FavoriteSource } from '@/domain/types';
import { useApp } from '@/store/AppStore';

/**
 * 词条收藏星标 + 收藏夹选择弹窗 —— **所有单词释义面板右上角的收藏按钮都走这一份**：
 *
 * - 视觉与触控：`ui.tsx` 的 `StarButton`（32×32 透明热区、无填充无描边、空心 / 实心星）；
 * - 点击行为：打开 `FavoritePicker`（多选收藏夹，全不选 = 取消收藏），与课本详情页底栏那一枚完全一致；
 * - 收藏夹状态、词条名与释义、来源标记都由调用方给，组件自己读 `state.favorites` 判断空心 / 实心。
 *
 * 面板把「单词 + 释义」交给它即可，不必各自再维护一份 `pickerOpen` 状态。
 */
export function FavoriteStar({
  word,
  definition,
  source = 'wordbook',
  style,
}: {
  /** 词条名（收藏键） */
  word: string;
  /** 收起时记下的那条释义（形如 `(n.) 好处`），与课本详情页写的格式一致 */
  definition: string;
  /** 收藏来源标记，只影响新建记录时的归类 */
  source?: FavoriteSource;
  /** 透传给星标按钮（位置微调用） */
  style?: StyleProp<ViewStyle>;
}) {
  const { state, actions } = useApp();
  /** 收藏夹选择弹窗是否打开 */
  const [pickerOpen, setPickerOpen] = useState(false);

  const saved = state.favorites.some((f) => f.word === word);
  /** 该词当前所在的收藏夹（弹窗打开时的勾选态） */
  const savedFolderIds = state.favorites.filter((f) => f.word === word).map((f) => f.folderId);
  const folderCounts = favoriteCountByFolder(state.favorites);

  return (
    <>
      <StarButton
        active={saved}
        accessibilityLabel={saved ? '已收藏' : '收藏'}
        onPress={() => setPickerOpen(true)}
        style={style}
      />
      {/* 收藏夹选择：多选收藏到哪些收藏夹（全不选 = 取消收藏）（FR-T-1）——与「课本」同一套逻辑 */}
      {pickerOpen ? (
        <FavoritePicker
          visible
          folders={state.favoriteFolders}
          counts={folderCounts}
          selectedIds={savedFolderIds}
          onConfirm={(folderIds) => {
            actions.setFavoriteFolders({ word, definition, source }, folderIds);
            setPickerOpen(false);
          }}
          onCreate={(name, color) => actions.addFavoriteFolder(name, color)}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </>
  );
}
