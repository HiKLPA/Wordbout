import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { DialogPanel, FolderColorRow, NameInput } from '@/components/DialogPanel';
import { SwipeRow, useSwipeRows } from '@/components/SwipeRow';
import { ChevronIcon, FolderIcon, HintIcon, PlusIcon } from '@/components/icons';
import { AppText, Card, EmptyState, PageHeader, Screen, SegmentedTabs } from '@/components/ui';
import {
  DEFAULT_FOLDER_ID,
  favoriteCountByFolder,
  favoriteFolderLabel,
  sortFoldersAlpha,
} from '@/domain/favorites';
import { tr, trf } from '@/i18n';
import { useApp } from '@/store/AppStore';
import {
  DEFAULT_FOLDER_COLOR,
  FOLDER_COLORS,
  folderColorValue,
  typography,
  type FolderColor,
} from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

/** 列表两行之间的间距 */
const ROW_GAP = 10;
/** 「按颜色分区」时：两个颜色分区之间的间距 */
const COLOR_GROUP_GAP = 16;
/** 「按颜色分区」时：同一颜色分区内两行之间的间距 */
const COLOR_ROW_GAP = 8;
/** 每个分区默认展示的收藏夹个数，多出来的折叠起来（底部居中按钮展开 / 收起） */
const PARTITION_LIMIT = 5;
/** 分区底部展开 / 收起按钮的直径（正圆） */
const PARTITION_TOGGLE_SIZE = 32;

/**
 * 收藏夹列表的三种查看方式（FR-T-1，顶部切换）：
 * 1. 时序 —— 按创建时间，越新越靠前（默认）；
 * 2. 颜色 —— 按封面色分区，分区之间 16、区内 8；
 * 3. A-Z —— 按显示名的字典序。
 * 三种方式只影响列表的排列，数据本身不变。
 */
type SortMode = 'created' | 'color' | 'alpha';

/**
 * 分区底部「展开 / 收起」按钮：箭头取自课本「常用短语」的展开收起按钮
 * （同一枚 24px 上下箭头：未展开朝下、已展开朝上），
 * 水平居中摆在分区底部，无底色，箭头直接取该分区自己的颜色。
 */
function PartitionToggle({
  expanded,
  color,
  hidden,
  onPress,
}: {
  expanded: boolean;
  /** 箭头颜色：该分区的颜色 */
  color: string;
  /** 折叠起来的个数（只进无障碍名，视觉上不显示文字） */
  hidden: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={expanded ? tr('收起') : trf('展开其余 {n} 个', { n: hidden })}
      hitSlop={8}
      style={{
        alignSelf: 'center',
        width: PARTITION_TOGGLE_SIZE,
        height: PARTITION_TOGGLE_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ChevronIcon size={24} direction={expanded ? 'up' : 'down'} color={color} />
    </Pressable>
  );
}

/**
 * 收藏夹列表（FR-T-1）：课本页「星标」区标题右侧的「更多」进入。
 * 版面与收藏夹详情页同一套 —— 固定页头（返回 + 标题）+ 可滚动的收藏夹列表，
 * 点任一行进入该收藏夹详情。
 *
 * 页头是整块固定区：标题 → 三种查看方式（样式同单词列表：一枚三档胶囊）→「新建」卡片。
 * 新建按钮因此常驻列表顶部、不随列表滚动；页头层下方的渐变遮罩照着这块固定区自动铺开
 * （见 Screen 的 onLayout 实测逻辑），淡出段就落在新建卡片之下。
 *
 * 三种查看方式：时序（默认，越新越靠前）/ 颜色（按封面色分区）/ A-Z。
 * 只有「颜色」这一种会分区折叠：每个分区默认只展示 PARTITION_LIMIT 个收藏夹，
 * 多出来的折叠起来，分区底部居中一枚箭头按钮展开 / 收起（颜色取该分区自己的颜色）；
 * 「时序」和「A-Z」是平铺列表、恒全部展开。
 *
 * 每行左滑可露出右端的 32px 正圆删除按钮，点两下删除（不弹确认框）；内置「默认」不可删。
 * 左滑这套样式与逻辑由 `components/SwipeRow` 提供（AI 历史面板同一套）。
 */
export default function FoldersScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { state, actions } = useApp();
  /**
   * 收藏夹行内「两行文字」的高度（md 行高 + 行内 4 的间距 + 14/19 的小字）。
   * 新建卡片卡内只有一个加号，用它把卡片撑到与收藏夹行等高，
   * 且随「字号档位」同步变化，不会出现卡片比行矮一截。
   */
  const rowTextHeight = theme.size(typography.lineHeights.md) + 4 + theme.size(19);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState('');
  /** 新建收藏夹时选中的封面颜色（六选一，默认品牌红） */
  const [draftColor, setDraftColor] = useState<FolderColor>(DEFAULT_FOLDER_COLOR);

  /** 行内左滑删除：同一时刻只允许一行露出删除按钮（机制见 `components/SwipeRow`） */
  const swipe = useSwipeRows();

  /** 顶部切换的查看方式：默认「时序」 */
  const [sortMode, setSortMode] = useState<SortMode>('created');
  /**
   * 已展开的颜色分区（键 = 颜色 id）。默认每个分区都折叠到前 PARTITION_LIMIT 个。
   * 只有「颜色」这一种查看方式会分区折叠 ——「时序」和「A-Z」是平铺列表、恒全部展开。
   */
  const [expandedParts, setExpandedParts] = useState<string[]>([]);

  const counts = useMemo(() => favoriteCountByFolder(state.favorites), [state.favorites]);
  const folderById = useMemo(
    () => new Map(state.favoriteFolders.map((f) => [f.id, f])),
    [state.favoriteFolders],
  );

  /** 时序：越新越靠前（后建的排在前；内置「默认」的 createdAt 为 0，因此排在最后） */
  const createdIds = useMemo(
    () => [...state.favoriteFolders].sort((a, b) => b.createdAt - a.createdAt).map((f) => f.id),
    [state.favoriteFolders],
  );
  /** A-Z：按显示名的字典序（与 store 维护默认顺序用的是同一个函数） */
  const alphaIds = useMemo(
    () => sortFoldersAlpha(state.favoriteFolders).map((f) => f.id),
    [state.favoriteFolders],
  );
  /**
   * 按颜色分区：分区顺序沿用色板顺序（红 / 黄 / 蓝 / 紫 / 珊瑚 / 青），
   * 区内的顺序沿用「时序」；没选过颜色的（含内置「默认」）与品牌红同区。
   */
  const colorGroups = useMemo(() => {
    const buckets = new Map<FolderColor, string[]>();
    createdIds.forEach((id) => {
      const folder = folderById.get(id);
      if (!folder) return;
      const color = folder.color ?? DEFAULT_FOLDER_COLOR;
      const bucket = buckets.get(color);
      if (bucket) bucket.push(id);
      else buckets.set(color, [id]);
    });
    return FOLDER_COLORS.filter((c) => buckets.has(c.id)).map((c) => ({
      color: c.id,
      ids: buckets.get(c.id) as string[],
    }));
  }, [createdIds, folderById]);

  const tabs: { key: SortMode; label: string }[] = [
    { key: 'created', label: tr('时序') },
    { key: 'color', label: tr('颜色') },
    { key: 'alpha', label: tr('A-Z') },
  ];

  /** 一行收藏夹：三种查看方式共用（key 用收藏夹 id，切方式时行内左滑状态不会串） */
  const renderRow = (id: string) => {
    const folder = folderById.get(id);
    if (!folder) return null;
    const name = favoriteFolderLabel(folder);
    const count = counts[id] ?? 0;
    return (
      <SwipeRow
        key={id}
        id={id}
        controller={swipe}
        // 内置「默认」不可删：不做左滑、也不渲染删除按钮
        enabled={id !== DEFAULT_FOLDER_ID}
        onDelete={() => swipe.tapDelete(id, () => actions.removeFavoriteFolder(id))}
      >
        <Card
          onPress={() => {
            // 有行露着删除时，点任意行先收起，避免误入收藏夹
            if (swipe.isAnyOpen()) {
              swipe.close();
              return;
            }
            router.push(`/favorites/${id}` as never);
          }}
          accessibilityLabel={trf('{name}，共 {n} 个单词', { name, n: count })}
          style={{ padding: 16 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <FolderIcon size={32} color={folderColorValue(folder.color)} />
            <View style={{ flexShrink: 1, flexGrow: 1, gap: 4 }}>
              <AppText kind="md" color={theme.colors.text} numberOfLines={1}>
                {name}
              </AppText>
              <AppText kind="tiny" color={theme.colors.textMuted} numberOfLines={1}>
                {String(count)}
              </AppText>
            </View>
            <HintIcon size={18} color={theme.colors.brand} />
          </View>
        </Card>
      </SwipeRow>
    );
  };

  /**
   * 一个分区：默认只铺 PARTITION_LIMIT 行，多出来的折叠；行与行之间用 `gap`，
   * 底部居中一枚箭头按钮展开 / 收起（箭头颜色 = 该分区的颜色）。
   */
  const renderPartition = (key: string, color: string, ids: string[], gap: number) => {
    const expanded = expandedParts.includes(key);
    const shown = expanded ? ids : ids.slice(0, PARTITION_LIMIT);
    return (
      <View key={key} style={{ gap }}>
        {shown.map(renderRow)}
        {ids.length > PARTITION_LIMIT ? (
          <PartitionToggle
            expanded={expanded}
            color={color}
            hidden={ids.length - PARTITION_LIMIT}
            onPress={() =>
              setExpandedParts((prev) =>
                prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
              )
            }
          />
        ) : null}
      </View>
    );
  };

  const closeCreate = () => {
    setCreating(false);
    setDraft('');
    setDraftColor(DEFAULT_FOLDER_COLOR);
  };

  return (
    <Screen
      header={
        <View style={{ gap: 12 }}>
          <PageHeader title={tr('收藏夹')} />
          {/* 三种查看方式：与单词列表同一套顶部胶囊（页头下方、左右铺满） */}
          {state.favoriteFolders.length > 0 ? (
            <SegmentedTabs
              items={tabs}
              value={sortMode}
              onChange={(mode) => {
                // 换查看方式会重排整页，先把露出的删除按钮收回去，免得它跟着挪位
                swipe.close();
                setSortMode(mode);
              }}
              accessibilityLabel={tr('查看方式')}
            />
          ) : null}

          {/*
            新建收藏夹：固定在页头最下面（即列表顶部），不随列表滚动。
            卡内只有一个加号，高度靠 rowTextHeight 撑到与收藏夹行完全一致（同样 padding 16，
            中间那段等于行内两行文字的高度，且随字号档位同步变化），因此永远与下面的行等高；
            只把描边改成虚线以示「新增」。
          */}
          <Card
            onPress={() => setCreating(true)}
            accessibilityLabel="新建收藏夹"
            style={{ padding: 16 }}
            strokeStyle="dashed"
          >
            <View
              style={{
                height: rowTextHeight,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PlusIcon size={22} color={theme.colors.brand} />
            </View>
          </Card>
        </View>
      }
      contentStyle={{ gap: ROW_GAP }}
    >
      {state.favoriteFolders.length === 0 ? (
        <EmptyState title="还没有收藏夹" hint="点上方「新建」建一个吧" />
      ) : sortMode === 'color' ? (
        /* 按颜色分区：分区之间 16，区内两行之间 8，分区之间靠间距区分（不再画分隔线） */
        <View style={{ gap: COLOR_GROUP_GAP }}>
          {colorGroups.map((group) =>
            renderPartition(group.color, folderColorValue(group.color), group.ids, COLOR_ROW_GAP),
          )}
        </View>
      ) : (
        /* 时序 / A-Z：平铺整个列表、全部展开，不做分区也不折叠 */
        <View style={{ gap: ROW_GAP }}>
          {(sortMode === 'alpha' ? alphaIds : createdIds).map(renderRow)}
        </View>
      )}

      {creating ? (
        <DialogPanel onClose={closeCreate}>
          {(close) => (
            <>
              <AppText kind="md" color={theme.colors.text}>
                新建收藏夹
              </AppText>
              {/* 封面色六选一：放在名称输入框上方（输入框自动聚焦弹键盘时它不会被遮住） */}
              <FolderColorRow value={draftColor} onChange={setDraftColor} />
              {/* 输入框的取消 / 确认都走 `close`：先播收回动画，播完再新建 / 退出 */}
              <NameInput
                value={draft}
                onChange={setDraft}
                onSubmit={() =>
                  close(() => {
                    actions.addFavoriteFolder(draft.trim(), draftColor);
                    closeCreate();
                  })
                }
                onCancel={() => close(closeCreate)}
              />
            </>
          )}
        </DialogPanel>
      ) : null}
    </Screen>
  );
}
