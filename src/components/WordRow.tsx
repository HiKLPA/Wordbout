import React from 'react';
import { View } from 'react-native';

import { AppText, Card } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * 单词行面板：单词（18px 品牌红）+ 音标（14px 弱化色，没有时不渲染）+ 一条释义（14px 次要色）。
 *
 * 收藏夹的单词列表（FR-T-1）与探索页的词条结果（FR-X-1）共用这一份实现，两处观感一致；
 * 行的容器、内边距与描边跟普通卡片完全同源（`Card`，0.5px `colors.border`），
 * 需要强调态（如「看过的词」）由调用方套一层 `Card` 之外的处理，或改传 `strokeColor`。
 *
 * - `trailing`：行首右侧的插槽（收藏星标等），有自己的点击区域，不会触发行本身的 `onPress`；
 * - `expanded`：展开态 —— 行距放宽到 12，释义不再截断（`numberOfLines` 放开），
 *   下方渲染 `children`（单词详解面板）。收起态行距 4，释义恒一行，与收藏夹列表保持一致。
 */
export function WordRow({
  word,
  phonetic,
  definition,
  trailing,
  expanded,
  strokeColor,
  onPress,
  accessibilityLabel,
  children,
}: {
  /** 单词 / 短语 / 词条标题（18px 品牌红） */
  word: string;
  /** 展示的音标（美式优先，没有英式兜底）；不传则不渲染这一小段 */
  phonetic?: string;
  /** 一行释义：收起时截断一行，展开时展示全文 */
  definition?: string;
  /** 行首右侧插槽（收藏星标等） */
  trailing?: React.ReactNode;
  /** 展开态（释义放开、行距放宽、渲染 children） */
  expanded?: boolean;
  /** 描边色。默认 `colors.border`；强调态（如探索页「看过的词」）传品牌红 */
  strokeColor?: string;
  onPress?: () => void;
  /** 无障碍名（调用方译好的成品文案，组件不再二次翻译） */
  accessibilityLabel?: string;
  /** 展开态下方的内容（单词详解） */
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      strokeColor={strokeColor}
      style={{ padding: 16, gap: expanded ? 12 : 4 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'baseline',
            flexWrap: 'wrap',
            columnGap: 8,
          }}
        >
          <AppText kind="md" color={theme.colors.brand} numberOfLines={1}>
            {word}
          </AppText>
          {phonetic ? (
            <AppText kind="tiny" color={theme.colors.textMuted} numberOfLines={1}>
              {phonetic}
            </AppText>
          ) : null}
        </View>
        {trailing}
      </View>
      {definition ? (
        <AppText
          kind="tiny"
          color={theme.colors.textSecondary}
          numberOfLines={expanded ? undefined : 1}
        >
          {definition}
        </AppText>
      ) : null}
      {expanded ? children : null}
    </Card>
  );
}
