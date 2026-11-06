import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { SwipeRow, useSwipeRows } from '@/components/SwipeRow';
import { TopFadeMask } from '@/components/TopFade';
import { PlusIcon } from '@/components/icons';
import { AppText, SCREEN_HEADER_FADE } from '@/components/ui';
import { chatTitle, type AiChatRecord } from '@/data/aiChats';
import { formatDayTimeShort } from '@/domain/date';
import { tr } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { stroke } from '@/theme/tokens';

/** 一行对话的高度与行距 —— 上下间隔固定 8px */
const ROW_H = 36;
const ROW_GAP = 8;
/** 面板内边距（统一 16） */
const PANEL_PAD = 16;
/** 面板圆角 */
const PANEL_RADIUS = 32;
/** 「新建对话」那块的圆角（比面板小一档，读起来像一枚行内控件） */
const NEW_RADIUS = 16;
/**
 * 「新建对话」块**下方**那段渐变遮罩的长度 —— 直接复用页头遮罩的淡出长度
 * （`SCREEN_HEADER_FADE`），全 App 的化开距离只有这一处口径。
 * 列表内容同步下垫等长的一段，静止时首行整行可见，只有滚动中的行会在这 16px 里化开。
 */
const LIST_FADE = SCREEN_HEADER_FADE;
/** 历史列表最多同时露出 6 行，超出的靠面板内上下滑动查看 */
const VISIBLE_ROWS = 6;
const LIST_MAX_H = LIST_FADE + VISIBLE_ROWS * ROW_H + (VISIBLE_ROWS - 1) * ROW_GAP;

/**
 * AI 探索的**历史对话面板**（输入行左侧历史按钮点出来的那块）：
 * 顶部一块**品牌红虚线**的「新建新对话」（与历史行等高、加号居中，**固定在顶部不滚**；
 * 还没有任何历史时，面板里就只有这一块），
 * 下面按「一句话标题 + 截止时间」列出最近的对话（最近在前），当前正在进行的这一段标题取**品牌红**，
 * 点某一行即把那段对话载回对话区继续追问。
 * 右侧时间是该段对话**上次截止的时刻**（精确到分）。列表最多同时露出 6 行，超出靠面板内上下滑动查看。
 * 新建块下沿用一层 16px 的渐变遮罩（复用页头那套 `TopFadeMask`），滚上去的行在遮罩里化开而不是被硬切。
 * 每行**左滑可删除**，样式与逻辑都取自 `components/SwipeRow`（与收藏夹列表同一套：右端露出 32px 正圆按钮、
 * 点第一下变对号、点第二下才真删，不弹确认框）。
 *
 * 挂载位置见探索页的 `dock`：贴在输入行**上方 16px**、宽度与底栏一致。
 */
export function AiHistoryPanel({
  chats,
  currentId,
  onOpen,
  onNew,
  onDelete,
}: {
  /** 历史对话（倒序，最近在前） */
  chats: readonly AiChatRecord[];
  /** 当前正在进行的这一段 —— 标题标品牌红，同时作无障碍的 selected 标记 */
  currentId: string;
  onOpen: (record: AiChatRecord) => void;
  onNew: () => void;
  /** 行内左滑删除已确认（点第二下）时执行 */
  onDelete: (record: AiChatRecord) => void;
}) {
  const theme = useTheme();
  /** 行内左滑删除：同一时刻只允许一行露出删除按钮 */
  const swipe = useSwipeRows();

  const rowStyle = {
    minHeight: ROW_H,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    /**
     * 行必须是**不透明**的：左滑时下层那枚删除按钮要被行盖住，直到行滑开才露出来
     * （与收藏夹行的卡片同一个道理）。底色取面板底色，静止时看不出差别。
     */
    backgroundColor: theme.colors.barBackground,
  };

  return (
    <View
      style={{
        borderRadius: PANEL_RADIUS,
        borderWidth: stroke.base,
        borderColor: theme.colors.border,
        // 底色取**底栏底色**（与底栏、输入胶囊、历史钮同底），看起来像同一条家具
        backgroundColor: theme.colors.barBackground,
        padding: PANEL_PAD,
      }}
    >
      {/*
       * 新建新对话：**固定在面板顶部**（不随历史列表滚动），几何与历史行完全一致
       * （同为 ROW_H 高、同为 `rowStyle`）—— 只是加号居中、描边换成**品牌红虚线**，
       * 读作「这里可以新增一行」。整块虚线区域都是热区。
       */}
      <Pressable
        onPress={onNew}
        accessibilityRole="button"
        accessibilityLabel={tr('新建新对话')}
        style={[
          rowStyle,
          {
            justifyContent: 'center',
            borderRadius: NEW_RADIUS,
            borderWidth: stroke.base,
            borderStyle: 'dashed',
            borderColor: theme.colors.brand,
          },
        ]}
      >
        <PlusIcon size={20} color={theme.colors.brand} />
      </Pressable>

      {/* 还没有任何历史对话时，面板里只剩「新建对话」这一块（不给空态文案，免得为一行字撑出一段空白） */}
      {chats.length === 0 ? null : (
        <View style={{ position: 'relative' }}>
          <ScrollView
            style={{ maxHeight: LIST_MAX_H }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: ROW_GAP, paddingTop: LIST_FADE }}
          >
            {chats.map((record) => {
              const title = chatTitle(record) || tr('新对话');
              const active = record.id === currentId;
              return (
                <SwipeRow
                  key={record.id}
                  id={record.id}
                  controller={swipe}
                  onDelete={() => swipe.tapDelete(record.id, () => onDelete(record))}
                >
                  <Pressable
                    onPress={() => {
                      // 有行露着删除时，点任意行先收起，避免误载入某段对话
                      if (swipe.isAnyOpen()) {
                        swipe.close();
                        return;
                      }
                      onOpen(record);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={title}
                    // 当前段用**品牌红标题**标出（其余段取 `textSecondary`）；同时保留无障碍的
                    // selected 状态，读屏也能分辨「就是这段」。
                    accessibilityState={{ selected: active }}
                    style={rowStyle}
                  >
                    {/* 标题一行截断（16/22）；右侧是该段对话**最后一次活动**的日期 + 时刻（精确到分） */}
                    <AppText
                      kind="sm"
                      color={active ? theme.colors.brand : theme.colors.textSecondary}
                      numberOfLines={1}
                      style={{ flex: 1 }}
                    >
                      {title}
                    </AppText>
                    <AppText kind="micro" color={theme.colors.textMuted}>
                      {formatDayTimeShort(record.updatedAt)}
                    </AppText>
                  </Pressable>
                </SwipeRow>
              );
            })}
          </ScrollView>
          {/*
           * 「新建对话」块**下方**的渐变遮罩：与页头那层同款（`TopFadeMask` + 同一淡出长度），
           * 贴在列表视口顶边（`top: 0`），往下 `LIST_FADE` 由面板底色平滑淡到全透明 ——
           * 列表向上滚动时，行是在这 16px 里化开，而不是被新建块下沿硬切一刀。
           * 底色必须给**面板底色**（`barBackground`，默认值是页面底色 `bg`，在这里会露出异色带）；
           * 必须画在滚动区**之后**（同层里后画的才在内容上面）。纯装饰，不接收触摸。
           */}
          <TopFadeMask
            height={LIST_FADE}
            opaqueHeight={0}
            color={theme.colors.barBackground}
            style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
          />
        </View>
      )}
    </View>
  );
}
