import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { DIALOG_ACTION_STYLE, DialogPanel, FolderColorRow, NameInput } from '@/components/DialogPanel';
import { TopFadeMask } from '@/components/TopFade';
import { FolderIcon, PlusIcon, SelectAllIcon } from '@/components/icons';
import { AppText, PrimaryButton, SCREEN_HEADER_FADE } from '@/components/ui';
import { favoriteFolderLabel } from '@/domain/favorites';
import type { FavoriteFolder } from '@/domain/types';
import { tr, trf } from '@/i18n';
import { useAccent, useTheme } from '@/theme/ThemeProvider';
import { DEFAULT_FOLDER_COLOR, folderColorValue, stroke, typography, type FolderColor } from '@/theme/tokens';

/** 每行固定高度与行距：列表默认只显示 4 行，超出的部分上下滑动查看 */
const ROW_H = 64;
const ROW_GAP = 8;
/**
 * 不滑动时可见的行数 = 3。**只数收藏夹行** —— 上方那条「新建收藏夹」虚线块固定不滚，
 * 不占这个额度（它是列表之外的独立一块）。
 */
const VISIBLE_ROWS = 3;
/**
 * 列表上下沿各一段渐变遮罩的长度 —— 直接复用页头遮罩的淡出长度（`SCREEN_HEADER_FADE`），
 * 与 AI 探索历史对话面板（`AiHistoryPanel` 的 `LIST_FADE`）同一口径，全 App 的化开距离只有这一个数。
 * 列表内容从上/下垫出等长的一段，静止时首末行整行可见，只有滚动中的行会在这 16px 里化开。
 */
const LIST_FADE = SCREEN_HEADER_FADE;
/**
 * 列表最大高度 = 顶部渐隐段 + 3 行 + 2 个行距 = 224；
 * 收藏夹不超过 3 个时列表按内容自适应，第 4 个起才上下滑动。
 */
const LIST_MAX_H = LIST_FADE + ROW_H * VISIBLE_ROWS + ROW_GAP * (VISIBLE_ROWS - 1);
/** 收藏夹行的圆角与内边距（内边距取 16，与输入框同一档；圆角比弹窗面板的 32 小两档） */
const ROW_RADIUS = 16;
const ROW_PAD = 16;
/** 标题行右端「全选 / 全部取消」钮的热区边长：图标 24 居中，热区 32×32 正方的透明热区 */
const SELECT_ALL_HIT = 32;
/** 行首文件夹图标及其与文字的间距 —— 图标尺寸与收藏夹列表页（`app/folders.tsx` 的行图标）一致 */
const ROW_ICON_SIZE = 32;
const ROW_ICON_GAP = 16;

/**
 * 收藏夹里的一行：图标 + 名称 + 单词数。
 * 选中态 = **该收藏夹自己的封面色**：行边框与名称同色（与行首图标一个色系），无勾选框。
 */
function FolderRow({
  name,
  count,
  color,
  checked,
  onPress,
}: {
  name: string;
  count: number;
  /** 该收藏夹自选的颜色：图标 / 选中态边框与名称都按它上色（老数据没颜色时回落品牌红） */
  color?: FolderColor;
  checked: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  /**
   * 选中态颜色 = **该收藏夹自己的封面色**（不跟页面强调色走）：
   * 每一行选中时亮的是它自己那个颜色，一眼就知道「这个夹子是哪个颜色的」，
   * 也不会在整页换色（如热门黄书页）时把每行都染成同一种黄。
   */
  const tone = folderColorValue(color);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={trf('{name}，共 {n} 个单词', { name, n: count })}
      style={{
        height: ROW_H,
        flexDirection: 'row',
        alignItems: 'center',
        gap: ROW_ICON_GAP,
        // 行内边距 16（与输入框同一档），圆角 16 —— 比弹窗面板的 32 小两档，像「面板里的一枚行内控件」
        paddingHorizontal: ROW_PAD,
        borderRadius: ROW_RADIUS,
        /*
         * 未选中 = **不描边**（描边色透明），只有选中才亮出该收藏夹颜色的一圈：
         * 弹窗底色已改成页面底色（`bg`），未选中的行再挂一条近白的灰线只会留下一个「空盒子」的轮廓，
         * 看着像一张张没内容的卡片。线宽恒为 `stroke.base`、只换颜色，选中时行不会因为加边而抖一下。
         */
        borderWidth: stroke.base,
        borderColor: checked ? tone : 'transparent',
      }}
    >
      {/* 图标恒用该收藏夹自己的颜色（不随勾选态换色）：勾选反馈由整行同色描边 + 名称变色承担 */}
      <FolderIcon size={ROW_ICON_SIZE} color={tone} />
      <View style={{ flexShrink: 1, flexGrow: 1, gap: 2 }}>
        <AppText
          kind="sm"
          color={checked ? tone : theme.colors.text}
          numberOfLines={1}
        >
          {name}
        </AppText>
        {/* 次标题：字号取 tiny 档的 14px，行高沿用 micro 的 17（与「更多」页编号同一套写法） */}
        <AppText
          kind="micro"
          color={theme.colors.textMuted}
          numberOfLines={1}
          style={{ fontSize: theme.size(typography.tiny) }}
        >
          {String(count)}
        </AppText>
      </View>
    </Pressable>
  );
}

/**
 * 收藏夹选择弹窗（FR-T-1）：**可多选**要收藏到的收藏夹，底部两枚等宽按钮「取消 / 确认」。
 * - 标题行左「收藏到」（**新建流程里改读「新增」**，字号取收藏夹名字那一档 `sm` 16px / 600）、
 *   右端「全选 / 全部取消」（双勾图标 24px，热区 32×32 透明方框）；
 * - 列表上方一条**整行宽的虚线「新建收藏夹」块**（几何同收藏夹行、加号居中），
 *   样式与位置与 AI 探索历史对话面板的「新建新对话」（`AiHistoryPanel`）同源，新建后自动勾选；
 * - 列表默认显示 3 个收藏夹，超过 3 个可上下滑动（「新建收藏夹」那块在列表之外、不参与计数也不滚动）；
 * - 列表可滚动时，**上下沿各压一层渐变遮罩**（复用页头那套 `TopFadeMask` + 同一淡出长度）：
 *   上沿把滚上来的行化在虚线块下沿，下沿把滚到底的行化开在「取消 / 确认」按钮行上方，都不硬切；
 * - 「全选」第二次点击 = 全部取消（图标不变，无障碍名随状态切换）；
 * - 「取消」为纯文字按钮（无填充、无描边）；
 * - 「取消」与「确认」都走 `DialogPanel` 的 `close`：**先播收回动画、播完才真正关闭 / 落库**；
 * - 全部取消勾选后确认 = 取消收藏（该单词从所有收藏夹移除）。
 * - 弹窗一律**竖直居中**（2026-10-17 统一）：无论从页面里还是从底栏那枚星星点出来，
 *   都浮在整屏正中，不再有「贴在按钮上方」的第二种摆法。
 */
export function FavoritePicker({
  visible,
  folders,
  counts,
  selectedIds,
  onConfirm,
  onCreate,
  onClose,
}: {
  visible: boolean;
  folders: FavoriteFolder[];
  /** 各收藏夹的单词数，key 为收藏夹 id */
  counts: Record<string, number>;
  /** 打开时勾选的收藏夹（该单词当前所在的全部收藏夹） */
  selectedIds: string[];
  /** 确认：提交勾选结果（空数组 = 从所有收藏夹移除） */
  onConfirm: (folderIds: string[]) => void;
  /** 新建收藏夹（可带封面颜色），返回新收藏夹 id（会立刻出现在列表里并自动勾选） */
  onCreate: (name: string, color?: FolderColor) => string;
  onClose: () => void;
}) {
  const theme = useTheme();
  /** 「新建收藏夹」加号的强调色（默认品牌红；词库详情页整页换品牌黄时跟着变） */
  const { accent } = useAccent();
  const [selected, setSelected] = useState<string[]>(selectedIds);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState('');
  /** 新建收藏夹时选中的封面颜色 */
  const [draftColor, setDraftColor] = useState<FolderColor>(DEFAULT_FOLDER_COLOR);
  /**
   * 列表内容是否超出视口（需要上下滑动）。只有溢出时才铺上下两段渐变遮罩、
   * 并在底部垫出渐隐段 —— 4 个以内能一次看全，遮罩反而会把首末行压虚，不如不铺。
   */
  const [scrollable, setScrollable] = useState(false);

  /** 只在弹窗「打开」的那一刻把勾选同步为当前状态：开着的时候用户改过的不被覆盖 */
  const wasVisible = useRef(false);
  useEffect(() => {
    if (visible && !wasVisible.current) {
      setSelected(selectedIds);
      setCreating(false);
      setDraft('');
      setDraftColor(DEFAULT_FOLDER_COLOR);
    }
    wasVisible.current = visible;
  }, [visible, selectedIds]);

  if (!visible) return null;

  const toggle = (folderId: string) =>
    setSelected((prev) =>
      prev.includes(folderId) ? prev.filter((id) => id !== folderId) : [...prev, folderId],
    );

  /** 是否已全部勾选：决定「全选」按钮第二次点是「全部取消」 */
  const allSelected = folders.length > 0 && selected.length === folders.length;
  const toggleAll = () => setSelected(allSelected ? [] : folders.map((f) => f.id));

  const submitCreate = () => {
    const name = draft.trim();
    if (!name) return;
    const folderId = onCreate(name, draftColor);
    setSelected((prev) => (prev.includes(folderId) ? prev : [...prev, folderId]));
    setCreating(false);
    setDraft('');
    setDraftColor(DEFAULT_FOLDER_COLOR);
  };

  return (
    /* `ignoreKeyboard`：「新增」状态里有名称输入框，点它键盘弹起时面板**留在原位**
       （这块弹窗本来整块就在键盘上方，Android 的窗口压缩避让只会让它白白上跳半屏）。 */
    <DialogPanel onClose={onClose} animateHeight ignoreKeyboard>
      {(close) => (
        <>
          {/* 标题行：左「收藏到」（新建流程里换成「新增」），右端是全选钮（新建时隐藏）。
              标题字号 = 收藏夹名字那一档（`sm` 16px / 600），弹窗里不再有「更大的标题」 */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              /* 行高恒为全选钮热区那一档：新建态全选钮隐藏时行也不缩，标题不会上下跳 */
              minHeight: SELECT_ALL_HIT,
            }}
          >
            <AppText kind="sm" color={theme.colors.text}>
              {creating ? '新增' : '收藏到'}
            </AppText>
            {/* 全选 / 全部取消：24px 图标 + 32×32 热区（热区由外圈定尺寸，不再叠 `hitSlop`）。
                新建流程里列表被输入框取代，全选无意义 → 隐藏 */}
            {creating ? null : (
              <Pressable
                onPress={toggleAll}
                accessibilityRole="button"
                accessibilityState={{ selected: allSelected }}
                accessibilityLabel={allSelected ? '全部取消' : '全选'}
                style={{
                  width: SELECT_ALL_HIT,
                  height: SELECT_ALL_HIT,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <SelectAllIcon size={24} color={accent} />
              </Pressable>
            )}
          </View>

          {creating ? (
            <>
              <FolderColorRow value={draftColor} onChange={setDraftColor} />
              <NameInput
                value={draft}
                onChange={setDraft}
                onSubmit={submitCreate}
                onCancel={() => setCreating(false)}
              />
            </>
          ) : (
            <>
              {/*
               * 新建收藏夹：**整行宽的虚线块**，几何与下方收藏夹行完全一致（同 `ROW_H` 高、同 `ROW_RADIUS` 圆角），
               * 只是加号居中、描边换成强调色虚线 —— 读作「这里可以新增一行」，整块都是热区。
               * 样式与位置都取自 AI 探索历史对话面板的「新建新对话」（`AiHistoryPanel`）：贴在列表**上方、不随列表滚动**。
               */}
              <Pressable
                onPress={() => setCreating(true)}
                accessibilityRole="button"
                accessibilityLabel={tr('新建收藏夹')}
                style={{
                  minHeight: ROW_H,
                  borderRadius: ROW_RADIUS,
                  borderWidth: stroke.base,
                  borderStyle: 'dashed',
                  borderColor: accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <PlusIcon size={20} color={accent} />
              </Pressable>

              {/*
               * 收藏夹列表视口：一个 relative 容器套住滚动区，遮罩叠在它上面（同层里后画的才在内容之上）。
               * 上沿遮罩贴在**新建收藏夹虚线块下沿**（列表视口顶边），下沿遮罩贴在**「取消 / 确认」按钮行上方**
               * （列表视口底边）—— 滚动中的行在这两段里化开，而不是被上下邻块硬切一刀。
               */}
              <View style={{ position: 'relative' }}>
                <ScrollView
                  style={{ maxHeight: LIST_MAX_H }}
                  contentContainerStyle={{
                    gap: ROW_GAP,
                    // 上下各垫出渐隐段：静止时首行 / 末行仍整行可见，只有滚动中的行会被遮罩化开
                    paddingTop: LIST_FADE,
                    // 底部这段只在确实要滚动时才垫（否则静止状态会平白多出 16px 空白，把列表底推离按钮行）
                    paddingBottom: scrollable ? LIST_FADE : 0,
                  }}
                  showsVerticalScrollIndicator={false}
                  onContentSizeChange={(_w, h) => setScrollable(h > LIST_MAX_H + 0.5)}
                >
                  {folders.map((f) => (
                    <FolderRow
                      key={f.id}
                      name={favoriteFolderLabel(f)}
                      count={counts[f.id] ?? 0}
                      color={f.color}
                      checked={selected.includes(f.id)}
                      onPress={() => toggle(f.id)}
                    />
                  ))}
                </ScrollView>
                {scrollable ? (
                  <>
                    {/* 上沿：不透明端在上（紧贴虚线块下沿），向下平滑淡到全透明 */}
                    <TopFadeMask
                      height={LIST_FADE}
                      opaqueHeight={0}
                      color={theme.colors.bg}
                      style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
                    />
                    {/* 下沿：整层竖直镜像 → 不透明端落在底边（按钮行上方），向上淡出 */}
                    <TopFadeMask
                      height={LIST_FADE}
                      opaqueHeight={0}
                      color={theme.colors.bg}
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        transform: [{ scaleY: -1 }],
                      }}
                    />
                  </>
                ) : null}
              </View>

              {/* 底部两枚等宽按钮：取消（无填充无描边，纯文字）/ 确认。两者都走 `close`，先收回再关。
                  高度与底栏那排按钮一致（`DIALOG_ACTION_STYLE`） */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    label="取消"
                    tone="ghost"
                    strokeColor="transparent"
                    labelKind="sm"
                    style={DIALOG_ACTION_STYLE}
                    onPress={() => close()}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    label="确认"
                    labelKind="sm"
                    style={DIALOG_ACTION_STYLE}
                    onPress={() => close(() => onConfirm(selected))}
                  />
                </View>
              </View>
            </>
          )}
        </>
      )}
    </DialogPanel>
  );
}
