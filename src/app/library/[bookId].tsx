import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { FavoritePicker } from '@/components/FavoritePicker';
import { WordListDrawer } from '@/components/WordListDrawer';
import { WORD_DETAIL_GAP, WordDetail, WordNavFooter } from '@/components/WordDetail';
import { ListIcon } from '@/components/icons';
import { AppText, EmptyState, PageHeader, Screen } from '@/components/ui';
import { getBookWords, wordbookMap } from '@/data/wordbooks';
import { favoriteCountByFolder } from '@/domain/favorites';
import { tr } from '@/i18n';
import { useApp } from '@/store/AppStore';
import { AccentProvider, useTheme } from '@/theme/ThemeProvider';
import { BOOK_TONE_COLORS, layout, stroke } from '@/theme/tokens';

/** 进度条与其下方面板（单词详解）之间的间距 */
const PROGRESS_PANEL_GAP = WORD_DETAIL_GAP;

/** 进度条行右端「展开单词列表」圆钮的直径：32×32 正圆（与全 App 小圆钮同一口径） */
const LIST_BUTTON_SIZE = 32;

/**
 * 词库详情页的**页面强调色 = 该课本的卡面色**（`book.tone`，见 `BOOK_TONE_COLORS`）：
 * 热门课本黄、推荐课本蓝、其余红 —— 卡片是什么色，点进来这一页就是什么色。
 * 做法是把整页套进 `<AccentProvider>`，页内所有读 `useAccent()` 的组件自动跟着换色 ——
 * 进度条填充、详解面板描边、单词大字、派生词、展开 / 收起箭头、朗读圆钮、
 * 单词列表抽屉的当前行、收藏夹弹窗的勾选态与加号、底部实心「下一词」按钮（前景自动按底色取深 / 浅）。
 */

/**
 * 词库详情与单词学习（FR-T-2 / FR-T-3）。
 * 顶部展示已学数量与学习进度条；点击进入即进入单词学习流程（释义、例句、发音、收藏）。
 * 详解面板组见 `components/WordDetail`（收藏夹的「详解」视图共用同一套）。
 * 学习位置按单词本身记录，词库更新导致词序变化时不会错位（FR-T-3 验收标准）。
 */
export default function LibraryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const { state, actions } = useApp();
  const book = wordbookMap[bookId];

  const words = useMemo(() => (book ? getBookWords(book.id) : []), [book]);
  const savedPosition = state.readingPositions[bookId];
  const initialIndex = useMemo(() => {
    if (!savedPosition) return 0;
    const i = words.findIndex((w) => w.id === savedPosition.wordId);
    return i >= 0 ? i : 0;
  }, [savedPosition, words]);

  const [index, setIndex] = useState(initialIndex);
  /** 收藏夹选择弹窗是否打开 */
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  /** 单词列表抽屉（进度条右端圆钮打开）是否展开 */
  const [listOpen, setListOpen] = useState(false);

  if (!book) {
    return (
      <Screen header={<PageHeader title="词库" />}>
        <EmptyState title="未找到该词库" hint="未授权的词库不会上架" />
      </Screen>
    );
  }

  const word = words[index];
  /** 页面强调色 = 该课本卡面色（热门黄 / 推荐蓝 / 其余红），整页由 `<AccentProvider>` 下发 */
  const accent = BOOK_TONE_COLORS[book.tone];
  const wordSaved = !!word && state.favorites.some((f) => f.word === word.word);
  /** 已收藏时所在的全部收藏夹（星标按钮点开的选择弹窗会勾选它们） */
  const wordFolderIds = word
    ? state.favorites.filter((f) => f.word === word.word).map((f) => f.folderId)
    : [];
  /** 各收藏夹内的单词数（选择弹窗里每行显示） */
  const folderCounts = favoriteCountByFolder(state.favorites);
  const total = words.length;
  const learned = savedPosition?.index ?? 0;
  const progress = total > 0 ? Math.round((learned / total) * 100) : 0;

  /**
   * 跳到指定下标（上一词 / 下一词 / 单词列表点选共用）：
   * 同时把学习位置写回 store —— 位置按**单词本身**记录（FR-T-3 验收标准），
   * 词库更新导致词序变化时不会错位。
   */
  const goTo = (target: number) => {
    const next = Math.max(0, Math.min(words.length - 1, target));
    setIndex(next);
    const targetWord = words[next];
    if (targetWord) {
      actions.setReadingPosition({
        bookId: book.id,
        wordId: targetWord.id,
        index: next + 1,
        updatedAt: Date.now(),
      });
    }
  };

  const go = (delta: number) => goTo(index + delta);

  return (
    <AccentProvider accent={accent} highlight={accent}>
      <Screen
        header={<PageHeader title={book.coverText} />}
        contentStyle={{ gap: 16 }}
        footer={
          word ? (
            <WordNavFooter
              saved={wordSaved}
              prevDisabled={index === 0}
              nextDisabled={index >= words.length - 1}
              finished={index >= words.length - 1}
              prevLabel={tr('上一个')}
              nextLabel={tr('下一个（记录位置）')}
              onPrev={() => go(-1)}
              onNext={() => go(1)}
              onFinish={() => router.back()}
              onStar={() => setFolderPickerOpen(true)}
            />
          ) : null
        }
      >
        {/* 进度条与其下方面板为一组：组内间距由 PROGRESS_PANEL_GAP 单独控制 */}
        <View style={{ gap: PROGRESS_PANEL_GAP }}>
          {/* 学习进度：放在面板外，正文区域顶部（返回按钮 / 标题区域之下） */}
          <View style={{ gap: 6 }}>
            {/* 一行三件：左「百分比」、右「已学 / 总数」+ 展开单词列表的圆钮，两处数字统一 textSecondary */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <AppText kind="md" color={theme.colors.textSecondary}>
                {`${progress}%`}
              </AppText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <AppText kind="md" color={theme.colors.textSecondary}>
                  {`${learned} / ${total}`}
                </AppText>
                {/* 32×32 正圆：点开左侧的单词列表抽屉，选中某一行即跳到那个单词 */}
                <Pressable
                  onPress={() => setListOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={tr('单词列表')}
                  hitSlop={8}
                  style={{
                    width: LIST_BUTTON_SIZE,
                    height: LIST_BUTTON_SIZE,
                    borderRadius: LIST_BUTTON_SIZE / 2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: theme.colors.surface,
                    borderWidth: stroke.base,
                    borderColor: theme.colors.border,
                  }}
                >
                  <ListIcon size={18} color={theme.colors.text} />
                </Pressable>
              </View>
            </View>
            <View style={{ height: layout.progressHeight, borderRadius: layout.progressHeight / 2, backgroundColor: theme.colors.progressTrack }}>
              <View
                style={{
                  width: `${Math.min(100, progress)}%`,
                  height: layout.progressHeight,
                  borderRadius: layout.progressHeight / 2,
                  backgroundColor: accent,
                }}
              />
            </View>
          </View>

          {/* 单词 + 音标 + 义项 → 派生词 → 常用短语 → 例句；key 换词时重挂载，展开状态自动复位。
              收藏按钮在底栏（`WordNavFooter`）里已经有了，面板右上角不再重复放一枚 */}
          {word ? (
            <WordDetail key={word.id} word={word} hideFavorite />
          ) : (
            <EmptyState title="该词库暂无可学习的词条" />
          )}
        </View>

        {/* 单词列表抽屉：列出整本词库，点某一行即跳过去（并记录学习位置） */}
        <WordListDrawer
          visible={listOpen}
          words={words}
          currentIndex={index}
          onSelect={(i) => {
            goTo(i);
            setListOpen(false);
          }}
          onClose={() => setListOpen(false)}
        />

        {/* 收藏夹选择：多选收藏到哪些收藏夹（全不选 = 取消收藏）（FR-T-1）。
            弹窗统一居中展示（2026-10-17），与其它弹窗同一摆法 */}
        {word ? (
          <FavoritePicker
            visible={folderPickerOpen}
            folders={state.favoriteFolders}
            counts={folderCounts}
            selectedIds={wordFolderIds}
            onConfirm={(folderIds) => {
              actions.setFavoriteFolders(
                {
                  word: word.word,
                  definition: `(${word.senses[0].partOfSpeech}) ${word.senses[0].definitionZh}`,
                  source: 'wordbook',
                },
                folderIds,
              );
              setFolderPickerOpen(false);
            }}
            onCreate={(name, color) => actions.addFavoriteFolder(name, color)}
            onClose={() => setFolderPickerOpen(false)}
          />
        ) : null}
      </Screen>
    </AccentProvider>
  );
}
