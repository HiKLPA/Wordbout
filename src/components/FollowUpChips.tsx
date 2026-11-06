import React from 'react';
import { Pressable, ScrollView } from 'react-native';

import { HintIcon } from '@/components/icons';
import { AppText } from '@/components/ui';
import { trf } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, stroke } from '@/theme/tokens';

/** 建议追问的胶囊高度（与词条清单行同档，指头好点；比输入胶囊矮一档，不喧宾夺主） */
const CHIP_HEIGHT = 32;
/** 胶囊之间的横向间距 */
const CHIP_GAP = 8;

/**
 * AI 回复里那排**建议追问**（2026-10-16 新增）：
 * 由模型围绕这一条回复发散生成（最多 `appConfig.ai.followUpLimit` 条，见 `data/aiExplore.ts` 的
 * `followups` 字段），横向排成一行、宽度超出屏幕时**左右滑动查看**；点一条即把它作为新提问发出去
 * （与空态里的示例提问同一个动作）。
 *
 * 位置：**回复面板内部的最底部**（2026-10-16 从面板下方搬进来，被面板的描边与内边距一起框住），
 * 与上方正文之间的 16px 由调用方补（探索页 `followUpFooter`），本组件不自带外边距。
 *
 * 形态上刻意做成「小胶囊 + 一颗更小的向上箭头」：底色、描边与底栏 / 输入胶囊同源，
 * 但那颗箭头比发送钮更小更弱 —— 一眼看出「点它等于替你发一条」，又不至于是第二个发送按钮。
 * `items` 为空（模型没给、或缓存里的旧答案）时整块不渲染。
 */
export function FollowUpChips({
  items,
  onPress,
}: {
  /** 建议追问的句子（已去重、限长、限条数） */
  items: readonly string[];
  /** 点一条 → 作为新提问发出 */
  onPress: (text: string) => void;
}) {
  const theme = useTheme();
  if (items.length === 0) return null;

  return (
    <ScrollView
      horizontal
      /* Android：本行外面还套着探索页的**横向分页器**，同向嵌套默认轮不到自己滚
         （分页器只在「DOWN 落在带嵌套滚动的横向子滚动视图上」时才会让开，见
         RN 的 `ReactHorizontalScrollView.onInterceptTouchEvent`），必须显式打开嵌套滚动，
         这一行才消费得掉横向手势、滑到头才轮到翻档。与「能力趋势」里四档那行同一写法。 */
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      /* 点胶囊时不要先吞掉键盘 / 手势（与对话区其余点击手感一致） */
      keyboardShouldPersistTaps="handled"
      /* 只占一行胶囊的高度（不被上方回复面板的 flex 布局拉伸） */
      style={{ flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={{ gap: CHIP_GAP }}
    >
      {items.map((text) => (
        <Pressable
          key={text}
          onPress={() => onPress(text)}
          accessibilityRole="button"
          /* 与空态示例提问共用同一条词条：读屏听到的是「提问：……」 */
          accessibilityLabel={trf('提问：{q}', { q: text })}
          style={{
            height: CHIP_HEIGHT,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: layout.inputPad,
            borderRadius: 999,
            borderWidth: stroke.base,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.barBackground,
          }}
        >
          <AppText kind="tiny" color={theme.colors.text} numberOfLines={1}>
            {text}
          </AppText>
          <HintIcon size={14} direction="up" color={theme.colors.textMuted} />
        </Pressable>
      ))}
    </ScrollView>
  );
}
