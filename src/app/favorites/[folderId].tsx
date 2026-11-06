import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { FavoritePicker } from '@/components/FavoritePicker';
import { WORD_DETAIL_GAP, WordDetail, WordNavFooter } from '@/components/WordDetail';
import { WordRow } from '@/components/WordRow';
import {
  AppText,
  EmptyState,
  PageHeader,
  Screen,
  SectionTitle,
  SegmentedTabs,
} from '@/components/ui';
import { findWordEntry } from '@/data/wordbooks';
import { favoriteCountByFolder, favoriteFolderLabel } from '@/domain/favorites';
import type { FavoriteItem } from '@/domain/types';
import { tr, trf } from '@/i18n';
import { useApp } from '@/store/AppStore';
import { useTheme } from '@/theme/ThemeProvider';

/** 四种查看方式（FR-T-1）：A-Z（默认）/ 按词性 / 时序 / 单词详解 */
type ViewMode = 'detail' | 'alpha' | 'pos' | 'recent';
/** 列表类查看方式（详解视图的翻页顺序沿用其中一种） */
type ListMode = Exclude<ViewMode, 'detail'>;

/**
 * 单词词性：优先取词条首条义项的词性，取不到时从收藏时记下的释义里解析前缀
 * （词库详情收藏的是 `(n./v.) 好处；有益于` 这种形式，英文括号可有可无，
 * 以兼容加括号之前入库的旧记录）；两者都取不到时返回空串，
 * 渲染时归入最后一个「未分类」分组。
 */
function favoritePos(item: FavoriteItem): string {
  const pos = findWordEntry(item.word)?.senses[0]?.partOfSpeech;
  if (pos) return pos;
  const m = /^\(?([a-zA-Z]+\.(?:\s*\/\s*[a-zA-Z]+\.)*)\)?/.exec(item.definition.trim());
  return m ? m[1] : '';
}

/** 列表里的一格单词面板：只需要单词 + 音标 + 一条注释，点击进入该词的详解 */
function favoritePhonetic(item: FavoriteItem): string {
  const phonetics = findWordEntry(item.word)?.phonetics;
  return phonetics?.us || phonetics?.uk || '';
}

/**
 * 收藏夹详情（FR-T-1）：课本页「星标」区点进某个收藏夹后看到夹内的收藏单词。
 * 四种查看方式（顶部切换，默认第一种）：
 * 1. A-Z —— 按单词字母顺序排列的单词列表；
 * 2. 词性 —— 按词性分组的单词列表（组内仍按字母顺序）；
 * 3. 时序 —— 按收藏时间排列，最近收藏的排在最前；
 * 4. 详解 —— 与课本一样的单词详解（上一词 / 下一词切换 + 收藏按钮）。
 * 三种列表里点任一格都跳到「详解」视图，之后翻页沿用点击时那个列表的顺序。
 * 删除收藏夹的入口在收藏夹列表页（/folders）行内左滑，这里页头不再提供删除按钮。
 */
export default function FavoriteFolderScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { folderId } = useLocalSearchParams<{ folderId: string }>();
  const { state, actions } = useApp();

  const [view, setView] = useState<ViewMode>('alpha');
  /** 详解视图的翻页顺序：默认按收藏时间（时序），从别的列表点进来时换成那个列表的顺序 */
  const [order, setOrder] = useState<ListMode>('recent');
  const [detailIndex, setDetailIndex] = useState(0);
  /** 收藏夹选择弹窗是否打开 */
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);

  const folder = state.favoriteFolders.find((f) => f.id === folderId);
  const list = useMemo(
    () => state.favorites.filter((f) => f.folderId === folderId),
    [state.favorites, folderId],
  );

  /** A-Z：忽略大小写的字母顺序 */
  const alphaList = useMemo(
    () => [...list].sort((a, b) => a.word.localeCompare(b.word, 'en', { sensitivity: 'base' })),
    [list],
  );
  /** 时序：最近收藏的排在最前 */
  const recentList = useMemo(() => [...list].sort((a, b) => b.createdAt - a.createdAt), [list]);
  /** 按词性分组（组内沿用字母顺序）；取不到词性的归到最后一组 */
  const posGroups = useMemo(() => {
    const map = new Map<string, FavoriteItem[]>();
    alphaList.forEach((f) => {
      const key = favoritePos(f);
      const bucket = map.get(key);
      if (bucket) bucket.push(f);
      else map.set(key, [f]);
    });
    return [...map.entries()]
      .map(([pos, items]) => ({ pos, items }))
      .sort((a, b) => (a.pos === '' ? 1 : b.pos === '' ? -1 : a.pos.localeCompare(b.pos)));
  }, [alphaList]);
  /** 词性分组的扁平顺序（详解视图从「词性」列表点进来时沿它翻页） */
  const posFlatList = useMemo(() => posGroups.flatMap((g) => g.items), [posGroups]);

  const listFor = (mode: ListMode) =>
    mode === 'alpha' ? alphaList : mode === 'pos' ? posFlatList : recentList;
  /** 详解视图当前的翻页序列 */
  const detailList = listFor(order);
  /** 夹内单词可能被取消收藏，下标要按当前长度夹紧 */
  const safeIndex = Math.min(detailIndex, Math.max(0, detailList.length - 1));
  const current = detailList[safeIndex];
  const folderCounts = favoriteCountByFolder(state.favorites);

  if (!folder) {
    return (
      <Screen header={<PageHeader title="收藏夹" />}>
        <EmptyState title="未找到该收藏夹" hint="它可能已被删除" />
      </Screen>
    );
  }

  const name = favoriteFolderLabel(folder);

  /** 从某个列表点进详解：翻页顺序沿用该列表 */
  const openDetail = (item: FavoriteItem, from: ListMode) => {
    const i = listFor(from).findIndex((f) => f.id === item.id);
    setOrder(from);
    setDetailIndex(i >= 0 ? i : 0);
    setView('detail');
  };

  const tabs: { key: ViewMode; label: string }[] = [
    { key: 'alpha', label: tr('A-Z') },
    { key: 'pos', label: tr('词性') },
    { key: 'recent', label: tr('时序') },
    { key: 'detail', label: tr('详解') },
  ];

  return (
    <Screen
      header={
        <View style={{ gap: 12 }}>
          <PageHeader title={name} />
          {list.length > 0 ? (
            <SegmentedTabs items={tabs} value={view} onChange={setView} />
          ) : null}
        </View>
      }
      contentStyle={{ gap: 16 }}
      footer={
        view === 'detail' && current ? (
          <WordNavFooter
            saved
            prevDisabled={safeIndex === 0}
            nextDisabled={safeIndex >= detailList.length - 1}
            finished={safeIndex >= detailList.length - 1}
            prevLabel={tr('上一个')}
            nextLabel={tr('下一个')}
            onPrev={() => setDetailIndex(Math.max(0, safeIndex - 1))}
            onNext={() => setDetailIndex(Math.min(detailList.length - 1, safeIndex + 1))}
            onFinish={() => router.back()}
            onStar={() => setFolderPickerOpen(true)}
          />
        ) : null
      }
    >
      {list.length === 0 ? (
        <EmptyState title="该收藏夹还没有单词" hint="在词库详情页点星标即可收藏进来" />
      ) : view === 'detail' && current ? (
        <View style={{ gap: WORD_DETAIL_GAP }}>
          {/* 当前是第几个 / 共几个（纯数字，不需要词表） */}
          <AppText kind="micro" color={theme.colors.textMuted}>
            {`${safeIndex + 1} / ${detailList.length}`}
          </AppText>
          {/* 收藏按钮在底栏（`WordNavFooter`）里已经有了，面板右上角不再重复放一枚 */}
          <WordDetail
            key={current.id}
            word={findWordEntry(current.word)}
            fallback={{ word: current.word, definition: current.definition }}
            favoriteSource={current.source}
            hideFavorite
          />
        </View>
      ) : view === 'pos' ? (
        <View style={{ gap: 24 }}>
          {posGroups.map((group) => (
            <View key={group.pos || 'unknown'} style={{ gap: 8 }}>
              <SectionTitle label={group.pos || '未分类'} />
              <View style={{ gap: 10 }}>
                {group.items.map((f) => (
                  <WordRow
                    key={f.id}
                    word={f.word}
                    phonetic={favoritePhonetic(f)}
                    definition={f.definition}
                    onPress={() => openDetail(f, 'pos')}
                    accessibilityLabel={trf('查看 {word} 的详解', { word: f.word })}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {(view === 'alpha' ? alphaList : recentList).map((f) => (
            <WordRow
              key={f.id}
              word={f.word}
              phonetic={favoritePhonetic(f)}
              definition={f.definition}
              onPress={() => openDetail(f, view as ListMode)}
              accessibilityLabel={trf('查看 {word} 的详解', { word: f.word })}
            />
          ))}
        </View>
      )}

      {current ? (
        /* 收藏夹选择弹窗：多选收藏到哪些收藏夹（全不选 = 取消收藏）（FR-T-1）*/
        <FavoritePicker
          visible={folderPickerOpen}
          folders={state.favoriteFolders}
          counts={folderCounts}
          selectedIds={state.favorites
            .filter((f) => f.word === current.word)
            .map((f) => f.folderId)}
          onConfirm={(folderIds) => {
            actions.setFavoriteFolders(
              { word: current.word, definition: current.definition, source: current.source },
              folderIds,
            );
            setFolderPickerOpen(false);
          }}
          onCreate={(folderName, color) => actions.addFavoriteFolder(folderName, color)}
          onClose={() => setFolderPickerOpen(false)}
        />
      ) : null}
    </Screen>
  );
}
