import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { FavoriteFolderCard } from '@/components/FavoriteFolderCard';
import { TextbookCard } from '@/components/TextbookCard';
import { EllipsisVerticalIcon, HintIcon } from '@/components/icons';
import { AppText, Card, EmptyState, SCREEN_HEADER_GAP, SCREEN_TOP_GAP, Screen, SectionTitle } from '@/components/ui';
import { appConfig } from '@/config/appConfig';
import { getBookWordCount, wordbooks, wordbookMap } from '@/data/wordbooks';
import { favoriteCountByFolder } from '@/domain/favorites';
import type { Wordbook } from '@/domain/types';
import { tr, trf } from '@/i18n';
import { useApp } from '@/store/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { BOOK_TONE_COLORS, layout, stroke } from '@/theme/tokens';

/** 星标区右上角「更多」入口的直径：32×32 正圆，与练习页「能力趋势」入口同一口径 */
const MORE_BUTTON_SIZE = 32;

/**
 * 课本 / Textbook —— 对应 Figma「iPhone 16 & 17 Pro - 3」：
 * Textbook/Main（370x1062，竖向 gap 32）= STARRED / POPULAR / RECOMMENDED 三个区块，
 * 每块为 Title（36x4 品牌色短线 + Barlow ExtraBold 32 大写标题）+ 一行 192x240 的 Textbook 卡片。
 * 短线颜色与卡片封面同色系：星标 = 品牌红、热门 = 品牌黄、推荐 = 品牌蓝；
 * 卡片颜色来自 `book.tone`，同时决定点进去那一页（词库详情）的页面强调色。
 * 顶部固定「继续学习」条（FR-T-3）：最近在读的那本，卡片描边、「继续」文字与箭头都取
 * **那本书的卡面色**（`book.tone` → `BOOK_TONE_COLORS`，与下方卡片封面、点进去的详情页同源），
 * 从下方三个区块的灰描边卡里拎出来；没有在读的词库时是一张灰描边提示卡。
 *
 * 星标区（FR-T-1）只放收藏夹卡片：课本本身不再有「星标课本」概念，
 * 收藏夹装用户收藏的单词，点进去看夹内单词；区块标题右侧是「更多」入口，
 * 点开以列表形式展示全部收藏夹（按 A-Z 排序，可当场新建、左滑删除）。
 *
 * 版面：顶部「继续学习」条固定在顶部留白区里（与练习页同一套做法），
 * 竖向滚动只发生在下方三个区块；区块从固定条下沿经过时是渐变淡出而不是硬切。
 */
export default function TextbookScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { state } = useApp();
  /** 各收藏夹内的单词数（显示在收藏夹卡片信息条上） */
  const folderCounts = useMemo(() => favoriteCountByFolder(state.favorites), [state.favorites]);

  // 热门：**只统计热门词库**（推荐区的词库不该混进热门，否则同一本书会在两区各出现一次），
  // 按学习人次排序；空数据态默认字典序（FR-T-1 验收标准）
  const popular = useMemo(() => {
    const list = wordbooks
      .filter((b) => b.category === 'popular')
      .map((b) => ({
        ...b,
        downloaded: state.downloadedBookIds.includes(b.id),
      }));
    const sorted = [...list].sort((a, b) => b.studyCount - a.studyCount);
    if (sorted.every((b) => b.studyCount <= 0)) {
      return [...list].sort((a, b) => a.coverText.localeCompare(b.coverText));
    }
    return sorted.slice(0, 8);
  }, [state.downloadedBookIds]);

  const recommended = useMemo(
    () =>
      wordbooks
        .filter((b) => b.category === 'recommended')
        .map((b) => ({ ...b, downloaded: state.downloadedBookIds.includes(b.id) })),
    [state.downloadedBookIds],
  );

  const lastPosition = Object.values(state.readingPositions).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const lastBook = lastPosition ? wordbookMap[lastPosition.bookId] : undefined;
  const lastTotal = lastBook ? getBookWordCount(lastBook.id) : 0;
  const lastPercent = lastPosition && lastTotal > 0 ? Math.min(100, Math.round((lastPosition.index / lastTotal) * 100)) : 0;
  /** 继续学习条的主题色 = 在读那本书的卡面色（`book.tone`），与下方卡片、点进去的详情页同源 */
  const lastAccent = lastBook ? BOOK_TONE_COLORS[lastBook.tone] : theme.colors.brand;

  /** 14px 小字：继续学习条的标签与进度行、三个区块标题下的说明行（与主页卡片同口径） */

  const goBook = (id: string) => router.push(`/library/${id}` as never);

  /** 一行横向滑动的课本卡片（封面 / 进度条颜色一律取 `book.tone`） */
  const renderRow = (list: Wordbook[]) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 16, paddingHorizontal: layout.pagePadding }}
    >
      {list.map((book) => (
        <TextbookCard
          key={book.id}
          book={book}
          learned={state.readingPositions[book.id]?.index ?? 0}
          onPress={() => goBook(book.id)}
        />
      ))}
    </ScrollView>
  );

  /** 星标区一行：只有收藏夹（内置「默认」始终排第一） */
  const renderStarredRow = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 16, paddingHorizontal: layout.pagePadding }}
    >
      {state.favoriteFolders.map((folder) => (
        <FavoriteFolderCard
          key={folder.id}
          folder={folder}
          count={folderCounts[folder.id] ?? 0}
          onPress={() => router.push(`/favorites/${folder.id}` as never)}
        />
      ))}
    </ScrollView>
  );

  /**
   * 顶部固定区：上次位置记忆（FR-T-3），不随下方三个区块滚动。
   * 有在读的词库时，这张卡走**品牌红描边**（与练习页「继续上次练习」同一套口径）；
   * 没有时换成一张灰描边的提示卡（空态不给红边，没有「最近」可言）。
   * contentStyle 只给区块间距：不要再写 paddingBottom，否则会盖掉容器为底部悬浮导航预留的留白。
   */
  const topBlock = (
    <View style={{ paddingHorizontal: layout.pagePadding }}>
      {lastBook && lastPosition ? (
        <Card
          style={{ padding: 16 }}
          onPress={() => goBook(lastBook.id)}
          accessibilityLabel={tr('继续学习')}
          /* 用**在读那本书的卡面色**（红 / 黄 / 蓝，同下方卡片与其详情页）把它从灰描边卡里拎出来 */
          strokeColor={lastAccent}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flexShrink: 1, gap: 4 }}>
              <AppText kind="md" color={theme.colors.text} numberOfLines={1}>
                {lastBook.coverText}
              </AppText>
              <AppText kind="tiny" color={theme.colors.textSecondary} numberOfLines={1}>
                {trf('{a} / {b} · {p}%', {
                  a: lastPosition.index,
                  b: lastTotal,
                  p: lastPercent,
                })}
              </AppText>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {/* kind 取 tiny（14px）+ bold：与 micro 档（500）区分，靠字重让「继续」跳出来 */}
              <AppText kind="tiny" weight="bold" color={lastAccent}>
                继续
              </AppText>
              <HintIcon size={18} color={lastAccent} />
            </View>
          </View>
        </Card>
      ) : (
        <Card style={{ padding: 16 }}>
          <AppText kind="micro" color={theme.colors.textSecondary}>
            还没有学习中的词库，从下面挑一本开始吧
          </AppText>
        </Card>
      )}
    </View>
  );

  return (
    <Screen
      padded={false}
      header={topBlock}
      headerTopGap={SCREEN_TOP_GAP}
      headerMaskGap={SCREEN_HEADER_GAP}
      contentStyle={{ gap: 32 }}
    >
        <View style={{ gap: 8 }}>
          <View style={{ paddingHorizontal: layout.pagePadding }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <View style={{ flexShrink: 1 }}>
                <SectionTitle label="星标" />
                <AppText kind="tiny" color={theme.colors.textMuted}>
                  收藏的单词
                </AppText>
              </View>
              <Pressable
                onPress={() => router.push('/folders' as never)}
                accessibilityRole="button"
                accessibilityLabel={tr('更多')}
                hitSlop={8}
                style={{
                  width: MORE_BUTTON_SIZE,
                  height: MORE_BUTTON_SIZE,
                  borderRadius: MORE_BUTTON_SIZE / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.surface,
                  borderWidth: stroke.base,
                  borderColor: theme.colors.border,
                }}
              >
                {/* 32×32 正圆 + 竖向三点（与练习页「能力趋势」入口同一套按钮几何）；
                    文字「更多」已删，按钮含义靠无障碍标签传达 */}
                <EllipsisVerticalIcon size={18} color={theme.colors.text} />
              </Pressable>
            </View>
          </View>
          {renderStarredRow()}
        </View>

        <View style={{ gap: 8 }}>
          <View style={{ paddingHorizontal: layout.pagePadding }}>
            {/* 热门区走品牌黄：上方短线 + 卡片封面（`tone: 'yellow'`）+ 封面下进度条都是黄的 */}
            <SectionTitle label="热门" barColor={theme.palette.brandSecondary} />
            <AppText kind="tiny" color={theme.colors.textMuted}>
              {trf('每日 {h} 点更新', { h: appConfig.textbook.popularRefreshHour })}
            </AppText>
          </View>
          {popular.length ? renderRow(popular) : <EmptyState title="暂无热门数据" hint="已按字典序排列" />}
        </View>

        <View style={{ gap: 8 }}>
          <View style={{ paddingHorizontal: layout.pagePadding }}>
            {/* 推荐区走品牌蓝：短线蓝、卡片封面（`tone: 'blue'`）与进度条也蓝，点进去的详情页整页蓝 */}
            <SectionTitle label="推荐" barColor={theme.palette.brandComplementary} />
            <AppText kind="tiny" color={theme.colors.textMuted}>
              Wordbout 推荐
            </AppText>
          </View>
          {recommended.length ? renderRow(recommended) : <EmptyState title="暂无推荐词库" />}
        </View>

      {/* 收藏夹列表（默认 A-Z、可拖动排序）在二级页面 /folders 里，见页头「更多」入口 */}
    </Screen>
  );
}
