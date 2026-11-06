import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import { ScriptRuns } from '@/components/ScriptText';
import { AppText } from '@/components/ui';
import { splitEmphasis } from '@/domain/text';
import { useTheme, type TextKind } from '@/theme/ThemeProvider';
import { CjkFont, LatinFont, type FontWeightKey } from '@/theme/fonts';

/**
 * **带关键词强调的文本**：把一段文字里该被强调的部分渲染成加粗描红，其余保持正文样式。
 *
 * 强调来自**自动辨析**（2026-10-16 按设计）：
 * 1. 大模型在回答里一并给出的关键词（`data/aiExplore.ts` 的 `keys`）—— 在文中原样出现处；
 * 2. `markLatin` 打开时，中英混排的正文里**成串的英文**：中文句子里的英文就是要学的那个词，
 *    本地就能认出来，不必依赖模型每次都把关键词摘对。
 *
 * 命中片段走**加粗 + `accentRed`**（与例句 / 近义词 / 搭配里的查询词、词条清单里的单词同一套
 * 强调口径：AI 回答里凡加粗皆为红）。命中片段内部仍按脚本分流字体（英文 Barlow Bold、汉字
 * 思源黑体 Bold），因为 React Native 的 `fontFamily` 不接受回退列表。
 *
 * 没给关键词、也没命中时，渲染结果与普通 `<AppText>` 完全一致。
 */
export function EmphasisText({
  text,
  keywords,
  kind = 'body',
  weight,
  color,
  align,
  highlight,
  markLatin = true,
  numberOfLines,
  style,
}: {
  text: string;
  /** 要强调的关键词 / 关键短语（模型给的），命中即加粗描红 */
  keywords?: readonly string[];
  kind?: TextKind;
  weight?: FontWeightKey;
  color?: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  /** 强调色；默认取主题的 `accentRed` */
  highlight?: string;
  /**
   * 是否把中英混排正文里成串的英文一并强调；默认开。
   * 词条清单的「词性 + 说明」这类以英文缩写起头的短句要关掉，否则 `adj.` / `n.` 会被标红。
   */
  markLatin?: boolean;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
}) {
  const theme = useTheme();
  const parts = splitEmphasis(text, keywords ?? [], markLatin);
  const marked = highlight ?? theme.colors.accentRed;

  return (
    <AppText
      kind={kind}
      weight={weight}
      color={color}
      align={align}
      numberOfLines={numberOfLines}
      style={style}
    >
      {parts.map((part, index) =>
        part.hit ? (
          <Text key={index} style={{ color: marked }}>
            <ScriptRuns text={part.text} latin={LatinFont.bold} cjk={CjkFont.bold} />
          </Text>
        ) : (
          part.text
        ),
      )}
    </AppText>
  );
}
