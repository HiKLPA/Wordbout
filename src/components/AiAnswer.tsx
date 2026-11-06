import React from 'react';
import { Pressable, View } from 'react-native';

import { PANEL_GAP_BLOCK } from '@/components/DictEntryBlock';
import { EmphasisText } from '@/components/EmphasisText';
import { AppText, Card } from '@/components/ui';
import type { AiAnswerBlock, AiTerm } from '@/data/aiExplore';
import { trf } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';

/** 词条清单里一行的高度（与翻译页的联想候选行同一档，方便指头点） */
const TERM_ROW_HEIGHT = 32;
/**
 * 词条清单里行与行之间的**竖直间距**（2026-10-16 定为 8）。
 * 比面板内其它间距（`PANEL_GAP_INNER` 4）松一档：这一块是「一行一颗词」的清单，
 * 上下挨得太紧会串行，看不清哪条释义属于哪个词。
 */
const TERM_ROW_GAP = 8;

/**
 * AI 探索的**通用回答**渲染（非查词类提问的结果）：若干块。
 *
 * 块类型由模型选（见 `data/aiExplore.ts` 的提示词），这里只负责排版：
 * - `text` 整段说明 → 16px/28 端正文字（左右对齐）；
 * - `list` 要点列表 → 每条一行，行首一个弱化的 `·`；
 * - `terms` 词条清单 → 一行一颗词（左 18px 单词、右 14px 中文说明右对齐），点了就去查这个词。
 *
 * **强调只由「自动辨析」产生**（2026-10-16 按设计）：正文一律正规字重，真正被强调的只有两处 ——
 * 模型在 `keys` 里挑出的关键字词（`EmphasisText` 渲染成加粗描红），以及词条清单里的英文单词
 * （它本身就是这一块要记的东西）。AI 回答里凡加粗处一律同时描红，不再有「加粗但仍是黑色」的文字。
 * **整条回答只占一张面板**（2026-10-15 按设计合并，原来是每块一张卡），块与块之间靠面板的
 * `gap`（`PANEL_GAP_BLOCK`）拉开，**不画分割线**（2026-10-16 按设计去掉）；面板内边距 16、
 * 块内间距 `PANEL_GAP_*`。可选 `footer` 追加在面板**内部最底部**（探索页的「建议追问」胶囊，
 * 2026-10-16 从面板下方搬进来、与正文间距 16），间距由调用方补，这里只把它排在最后。
 *
 * 模型给的 `title`（概括提问的一行小字）**不再渲染**：回答上方已经有一条用户提问气泡，
 * 再重复一遍是冗余（2026-10-15 按设计去掉；`title` 仍留在结果里供回灌上下文用）。
 */
export function AiAnswerView({
  blocks,
  keywords,
  onTermPress,
  footer,
}: {
  blocks: readonly AiAnswerBlock[];
  /** 模型辨析出的关键词（出现即加粗描红） */
  keywords?: readonly string[];
  /** 点词条清单里的某一项 → 顺着这一项往下问（探索页把它作为新的一条提问接在对话末尾）；不传则该行不可点 */
  onTermPress?: (term: string) => void;
  /**
   * 追加在面板**内部最底部**的一块（探索页用它放那排「建议追问」胶囊）。
   * 与上面的正文之间留 `FOLLOW_UP_GAP`(16) —— 由调用方在元素上补
   * `marginTop: 16 − PANEL_GAP_BLOCK`（面板已给块间 8），这里不再自带间距。
   */
  footer?: React.ReactNode;
}) {
  const theme = useTheme();

  const termRow = (item: AiTerm) => {
    const content = (
      <>
        <AppText kind="md" color={theme.colors.accentRed} numberOfLines={1}>
          {item.term}
        </AppText>
        {item.note ? (
          <EmphasisText
            text={item.note}
            keywords={keywords}
            kind="tiny"
            color={theme.colors.textSecondary}
            align="right"
            // 「词性 + 中文说明」以 `v.` / `adj.` 这类英文缩写起头，别把它们也标红
            markLatin={false}
            numberOfLines={1}
            style={{ flex: 1 }}
          />
        ) : null}
      </>
    );

    if (!onTermPress) {
      return (
        <View key={item.term} style={{ minHeight: TERM_ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {content}
        </View>
      );
    }
    return (
      <Pressable
        key={item.term}
        onPress={() => onTermPress(item.term)}
        accessibilityRole="button"
        accessibilityLabel={trf('查看 {word} 的详解', { word: item.term })}
        style={{ minHeight: TERM_ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 12 }}
      >
        {content}
      </Pressable>
    );
  };

  return (
    <Card style={{ padding: 16, gap: PANEL_GAP_BLOCK }}>
      {blocks.map((block, blockIndex) => (
        <React.Fragment key={blockIndex}>
          {block.type === 'text' ? (
            <EmphasisText
              text={block.text}
              keywords={keywords}
              kind="body"
              color={theme.colors.text}
              align="justify"
            />
          ) : null}

          {block.type === 'list'
            ? block.items.map((item) => (
                <View
                  key={item}
                  style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}
                >
                  <AppText kind="body" color={theme.colors.textMuted}>
                    ·
                  </AppText>
                  <EmphasisText
                    text={item}
                    keywords={keywords}
                    kind="body"
                    color={theme.colors.text}
                    align="justify"
                    style={{ flex: 1 }}
                  />
                </View>
              ))
            : null}

          {block.type === 'terms' ? (
            <View style={{ gap: TERM_ROW_GAP }}>{block.items.map(termRow)}</View>
          ) : null}
        </React.Fragment>
      ))}
      {footer}
    </Card>
  );
}
