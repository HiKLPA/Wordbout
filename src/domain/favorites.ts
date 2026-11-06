import type { FavoriteFolder, FavoriteItem } from '@/domain/types';
import { tr } from '@/i18n';

/** 内置收藏夹：始终存在、不可删除；名称为中文原文键，随界面语言切换（FR-T-1） */
export const DEFAULT_FOLDER_ID = 'fav-default';
export const DEFAULT_FOLDER_NAME = '默认';

export function defaultFavoriteFolder(): FavoriteFolder {
  return { id: DEFAULT_FOLDER_ID, name: DEFAULT_FOLDER_NAME, createdAt: 0 };
}

/**
 * 收藏夹显示名：内置收藏夹存的是词表键，走 `tr()` 三语切换；
 * 用户新建的收藏夹存的是用户输入，原样显示 —— 否则用户起的名字可能被词表误翻译。
 */
export function favoriteFolderLabel(folder: FavoriteFolder): string {
  return folder.id === DEFAULT_FOLDER_ID ? tr(folder.name) : folder.name;
}

/**
 * 收藏夹按显示名升序排列的副本（即「A-Z」顺序，不改动入参）。
 * store 载入与新建时都过一遍它，`favoriteFolders` 的数组顺序因此恒为 A-Z；
 * 收藏夹列表页的「A-Z」查看方式也复用它。
 */
export function sortFoldersAlpha(folders: FavoriteFolder[]): FavoriteFolder[] {
  return [...folders].sort((a, b) => favoriteFolderLabel(a).localeCompare(favoriteFolderLabel(b)));
}

/** 统计每个收藏夹内的收藏条数（key 为收藏夹 id） */
export function favoriteCountByFolder(favorites: FavoriteItem[]): Record<string, number> {
  const acc: Record<string, number> = {};
  favorites.forEach((f) => {
    acc[f.folderId] = (acc[f.folderId] ?? 0) + 1;
  });
  return acc;
}
