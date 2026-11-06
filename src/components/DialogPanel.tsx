import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  TextInput,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { CheckIcon, ChevronIcon } from '@/components/icons';
import { FOOTER_BUTTON_HEIGHT, PrimaryButton } from '@/components/ui';
import { tr } from '@/i18n';
import { useFocusPlaceholder } from '@/lib/focusPlaceholder';
import { useAccent, useTheme } from '@/theme/ThemeProvider';
import { inputFont } from '@/theme/fonts';
import { FOLDER_COLORS, layout, opacity, stroke, type FolderColor } from '@/theme/tokens';

/**
 * 弹窗的**关闭**入口：`close(after)` 先执行 `after`（例如「确认」要先落库），再关掉弹窗。
 * 没有收回动画，所以不会「播完再关」。
 */
export type DialogClose = (after?: () => void) => void;

/** 收藏夹颜色色块的直径（与全 App「小圆钮 32×32 正圆」同一口径） */
const COLOR_SWATCH_SIZE = 32;

/** 面板与面板正下方操作行（footer）之间的间距 */
const FOOTER_GAP = 16;

/**
 * 弹窗内部各区（标题行 / 列表 / 按钮行…）之间的**纵向间距统一 16** ——
 * 与页内卡片内边距、输入框内边距同一档，全 App 的纵向节奏只有这一个数。
 */
const PANEL_GAP = 16;

/**
 * 面板**内容高度变化**时的过渡时长（ms）—— 只在 `animateHeight` 开启时生效。
 * 内容块整体换掉时（收藏弹窗从「收藏夹列表」切到「新增收藏夹」）面板高度平滑收缩 / 展开，
 * 而不是瞬间跳到新高度：否则高度一跳会被读成「换了一个面板」。
 */
const HEIGHT_DURATION = 240;

/**
 * 弹窗内**操作行按钮**（取消 / 确认）的尺寸：**高度与底栏那排按钮一致**
 * （`FOOTER_BUTTON_HEIGHT` 48，比 `PrimaryButton` 默认的 52 矮一档）——
 * 弹窗里的操作行和页面底栏读起来是同一档，不会因为「弹窗按钮更高」显得两块东西不同源。
 */
export const DIALOG_ACTION_STYLE: StyleProp<ViewStyle> = {
  minHeight: FOOTER_BUTTON_HEIGHT,
  height: FOOTER_BUTTON_HEIGHT,
};

/**
 * 弹窗外壳：圆角面板（**无遮罩**，点面板外空白关闭、点面板吞掉事件）。
 * 收藏夹选择弹窗与题库选择弹窗共用同一套几何与配色，不要再各写一份。
 * 竖向上**一律居中**（2026-10-17 统一：此前课本详情 / 收藏夹详解的收藏弹窗会贴底栏按钮上方，
 * 现在全 App 的弹窗都浮在整屏正中，从哪个按钮点出来都一样，不再有第二套摆放）。
 * 宽度对齐**主内容区**：左右各留 `layout.pagePadding`（18）—— 面板与页面正文**同宽**
 * （2026-10-17 定；此前曾与底栏同宽 `barSideMargin` 32，比正文窄一档）。
 *
 * `footer` 渲染在面板**正下方**（间距 `FOOTER_GAP` 16、水平居中）：给「取消 / 确认」这类
 * 圆钮用，让操作行脱离面板本体、落在页面之上。外壳自身不接收触摸 —— 点面板外的空白仍落到透明热区 → 关闭。
 *
 * 弹出 / 收回**没有任何动画**（2026-10-17 删除：原先的位移 / 形变 / 不透明度淡入淡出与锚点机制一并移除）：
 * 弹窗打开即整块呈现、关闭即消失，`Modal` 的 `animationType` 也是 `none`。
 * 外部不铺任何底色，页面内容保持原样。
 *
 * `children` 与 `footer` 都是**函数**（render prop），接一个 `close`：
 * 面板里凡是会让弹窗消失的按钮（取消 / 确认 / 点面板外空白）都要走 `close()`，
 * 它执行完 `after` 再调 `onClose` —— 调用方不必自己记「先落库再关」的顺序。
 * `close(after)` 里的 `after` 在关闭前执行（例如「确认」要先落库再让父级卸载弹窗）。
 *
 * `animateHeight`：内容块高度变化时面板高度**平滑跟过去**（默认关闭，逐像素不变）。
 * 收藏弹窗用它，把「收藏夹列表 ↔ 新增收藏夹」的切换做成同一块面板收缩 / 展开，
 * 而不是高度瞬间跳到新值（那一跳会被读成「又冒出一个面板」）。
 *
 * `ignoreKeyboard`：键盘弹出时面板**不动**（默认关闭，即跟着 Android 的窗口压缩上移）。
 * 给「面板内带输入框、但整块本来就在键盘上方」的弹窗用 —— 目前只有「收藏到」的「新增」状态。
 */
export function DialogPanel({
  children,
  footer,
  onClose,
  animateHeight = false,
  ignoreKeyboard = false,
}: {
  /** 面板内容；需要拿「先落库再关」的顺序时写成函数、接 `close`（不需要就直接给节点） */
  children: React.ReactNode | ((close: DialogClose) => React.ReactNode);
  /** 面板正下方的操作行（同样可写成接 `close` 的函数） */
  footer?: React.ReactNode | ((close: DialogClose) => React.ReactNode);
  onClose: () => void;
  /** 内容高度变化时是否平滑过渡面板高度（默认否：内容随内容变，高度瞬间到位） */
  animateHeight?: boolean;
  /**
   * 键盘弹出时是否让面板**留在原位**（默认否）。
   *
   * Android 的 `Modal` 那层窗口自带 `SOFT_INPUT_ADJUST_RESIZE`（RN 在 `ReactModalHostView` 里写死），
   * 键盘一弹起窗口就被压矮，竖直居中的面板于是整体上跳「半个键盘高」——
   * 对本来就整块落在键盘上方的弹窗（「收藏到 → 新增」的名称输入）来说，这段避让纯属多余。
   * 开启后把整屏容器的高度**钉在量到的高度**上：窗口被压矮时不跟着缩，居中的参考不变，面板纹丝不动。
   * 判定按「宽度不变、高度变小 = 键盘」来做：宽度一变（旋转 / 分屏）说明可用空间真的变了，接受新高度；
   * 键盘收起时高度变大，也照常采纳。iOS / Web 上键盘不改窗口尺寸，等于无操作。
   */
  ignoreKeyboard?: boolean;
}) {
  const theme = useTheme();

  /**
   * 「键盘弹起也不动」用的定高（仅 `ignoreKeyboard`）：把 `Modal` 里那层铺满屏幕的容器钉住，
   * 见上面 `ignoreKeyboard` 的说明。`pinnedRef` 存上一次采纳的尺寸（判断是键盘还是真的变了），
   * `pinnedH` 存渲染用的高度（`null` = 还没量到，先按 `flex: 1` 铺满）。
   */
  const [pinnedH, setPinnedH] = useState<number | null>(null);
  const pinnedRef = useRef<{ width: number; height: number } | null>(null);
  const handleFrameLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      if (!Number.isFinite(height) || height <= 0) return;
      const prev = pinnedRef.current;
      /* 宽度不变、高度没长高 → 这次是键盘把窗口压矮（或压根没变），保持原高 */
      if (prev && Math.abs(prev.width - width) <= 1 && height <= prev.height + 0.5) return;
      pinnedRef.current = { width, height };
      setPinnedH(height);
    },
    [],
  );

  /**
   * 关闭入口：先执行 `after`（例如落库），再调 `onClose` 让父级卸载弹窗。
   * 点面板外空白、系统返回、面板内的取消 / 确认都走这里。
   * **没有收回动画**（2026-10-17 删除）：弹窗一关即消失，不需要「播完再关」。
   */
  const requestClose = useCallback<DialogClose>(
    (after) => {
      after?.();
      onClose();
    },
    [onClose],
  );

  /**
   * **面板上端固定、高度变化只收下端**（收藏弹窗「收藏夹列表 ↔ 新增收藏夹」切换时用）。
   * 做法：给面板套一个**开口时就定高**的槽（`slotH` = 首次量到的面板高），槽再交给 flexbox 居中。
   * 内容变矮时槽高不变 → 居中位置不变 → 面板顶边钉在原地，只有底边往上收；
   * 而且居中始终由 flexbox 算（不自己推 top），旋转、键盘改窗口高度都不会把它算偏。
   * `slotH` 只取**首次测量**：`animateHeight` 期间面板高度会连续变，记下的必须是展开态那个高度。
   */
  const [slotH, setSlotH] = useState<number | null>(null);
  const slotMeasured = useRef(false);
  const handleSlotLayout = useCallback((e: LayoutChangeEvent) => {
    if (slotMeasured.current) return;
    const h = e.nativeEvent.layout.height;
    if (!Number.isFinite(h) || h <= 0) return;
    slotMeasured.current = true;
    setSlotH(h);
  }, []);

  /**
   * 内容高度跟随（仅 `animateHeight`）：`children` 外面包一层可量高的容器，
   * 每次内容变高 / 变矮就补一段 `HEIGHT_DURATION` 的过渡。
   * - **首次测量直接落值**、不播动画：打开瞬间不该看到面板自己「长」一下；
   * - 变化小于 0.5px 忽略：避免亚像素误差导致来回抖；
   * - `height` 不能用 native driver，所以这条动画跑在 JS 线程上（只在内容切换时触发，代价可忽略）。
   */
  const [contentH, setContentH] = useState<number | null>(null);
  const contentHeight = useRef(new Animated.Value(0)).current;
  const contentHeightRef = useRef(0);
  const handleContentLayout = useCallback(
    (e: LayoutChangeEvent) => {
      if (!animateHeight) return;
      const h = e.nativeEvent.layout.height;
      /* 量不到（0 / NaN）就别接管高度：宁可让面板继续按内容自适应，也不能把它裁没 */
      if (!Number.isFinite(h) || h <= 0) return;
      if (Math.abs(h - contentHeightRef.current) < 0.5) return;
      const first = contentHeightRef.current === 0;
      contentHeightRef.current = h;
      setContentH(h);
      if (first || theme.reduceMotion) {
        contentHeight.setValue(h);
        return;
      }
      Animated.timing(contentHeight, {
        toValue: h,
        duration: HEIGHT_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    },
    [animateHeight, contentHeight, theme.reduceMotion],
  );

  return (
    <Modal visible transparent animationType="none" onRequestClose={() => requestClose()}>
      {/* 无遮罩：面板直接浮在页面之上，外部只剩一层透明热区（点它关闭弹窗） */}
      <View
        /* 开了 `ignoreKeyboard` 就把高度钉住：键盘压矮窗口时这里不缩，居中的面板才不会上移 */
        style={ignoreKeyboard && pinnedH !== null ? { height: pinnedH } : { flex: 1 }}
        onLayout={ignoreKeyboard ? handleFrameLayout : undefined}
      >
        <Pressable
          onPress={() => requestClose()}
          accessibilityLabel={tr('关闭')}
          style={{
            flex: 1,
            alignItems: 'center',
            /* 一律竖直居中：弹窗浮在整屏正中，不再有「贴底栏按钮上方」的第二套摆放 */
            justifyContent: 'center',
            /* 弹窗左右留白 = 主内容区（`pagePadding` 18）：面板与页面正文同宽 */
            paddingHorizontal: layout.pagePadding,
          }}
        >
          {/*
           * 面板槽：高度恒为**开口时量到的面板高**（`slotH`），内容变矮时槽不缩 →
           * 居中位置不动 → 面板顶边钉住、只有底边上升（见上面 `slotH` 的说明）。
           * 首帧还没量到就按内容自然高度，视觉与之后完全一致。
           */}
          <View
            style={{ width: '100%', height: slotH ?? undefined }}
            onLayout={handleSlotLayout}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                /* 弹窗面板圆角与卡片 / 面板同一个 token（`layout.cardRadius` = 32），全 App 一致 */
                borderRadius: layout.cardRadius,
                borderWidth: stroke.base,
                borderColor: theme.colors.border,
                /* 面板底色 = 页面底色（`bg`）：弹窗与页面同底，只靠描边与阴影般的层次浮起来 */
                backgroundColor: theme.colors.bg,
                overflow: 'hidden',
                /* 面板内边距四边统一 16：与块间距（`PANEL_GAP`）、输入框内边距同一档。
                   此前是 20，比内部节奏宽一档，弹窗看着「外松内紧」。 */
                padding: 16,
                gap: PANEL_GAP,
              }}
            >
              {animateHeight ? (
                /*
                 * 高度可动画的内容层：外层 `height` 跟着实测高度走（切换期间裁剪超出部分），
                 * 内层按内容自然高度布局 —— 只有内层不被压扁，`onLayout` 量出来的才是「内容真要占多高」。
                 * 内容块之间的间距由内层的 `gap` 给（外包一层后面板自身的 `gap` 只剩一个子项，不再起作用）。
                 */
                <Animated.View
                  style={
                    contentH === null
                      ? /* 首帧还没量到高度：先按自然高度铺开、**不裁剪** ——
                           原生上若此时给了 0 高 + `overflow: hidden`，面板会被裁成一条缝、看着像「弹不出来」 */
                        { overflow: 'visible' }
                      : { overflow: 'hidden', height: contentHeight }
                  }
                >
                  <View style={{ gap: PANEL_GAP, flexShrink: 0 }} onLayout={handleContentLayout}>
                    {typeof children === 'function' ? children(requestClose) : children}
                  </View>
                </Animated.View>
              ) : typeof children === 'function' ? (
                children(requestClose)
              ) : (
                children
              )}
            </Pressable>
            {/* footer 在面板正下方，与面板同宽 */}
            {footer ? (
              <View style={{ marginTop: FOOTER_GAP, alignItems: 'center' }}>
                {typeof footer === 'function' ? footer(requestClose) : footer}
              </View>
            ) : null}
          </View>
        </Pressable>
      </View>
    </Modal>
  );
}

/**
 * 收藏夹封面色块行（新建收藏夹时六选一，FR-T-1）：
 * 六个正圆色块等距铺满弹窗宽度，选中态加对勾（勾色按底色明暗取，保证对比度）。
 */
export function FolderColorRow({
  value,
  onChange,
}: {
  value: FolderColor;
  onChange: (color: FolderColor) => void;
}) {
  /** 色块描边取弹窗边框那一档（`colors.border`），与面板外框同色 */
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {FOLDER_COLORS.map((c) => {
        const selected = c.id === value;
        return (
          <Pressable
            key={c.id}
            onPress={() => onChange(c.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={tr(c.label)}
            hitSlop={4}
            style={{
              width: COLOR_SWATCH_SIZE,
              height: COLOR_SWATCH_SIZE,
              borderRadius: COLOR_SWATCH_SIZE / 2,
              backgroundColor: c.value,
              borderWidth: stroke.base,
              /*
               * 描边色**恒为弹窗边框那一档**（`colors.border`）：色块只是面板里的一枚小控件，
               * 选中与否都跟面板外框同色 —— 不再用深色加粗轮廓强调选中（那会读成「另一种边框」）。
               * 选中态由对勾图标承担。
               */
              borderColor: theme.colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* 勾色恒 `brandOn`（与封面文件夹图标同档）：黄底也照常白勾，不按明暗转深色 */}
            {selected ? <CheckIcon size={16} color={theme.colors.brandOn} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** 弹窗右下角小圆钮的边长（与全 App「小圆钮 32×32 正圆」同一口径） */
const ACTION_SIZE = 32;

/**
 * 弹窗右下角的操作行：左「取消 / 撤回」圆钮（凹槽底 + 灰描边 + 撤回箭头）、
 * 右「确认」圆钮（强调色实底 + 反白对勾）。两者都是 32×32 正圆、右对齐。
 * 强调色默认品牌红，页面可用 `<AccentProvider>` 换色（词库详情页走品牌黄，对勾自动转深色）。
 *
 * **当前没有调用点**（2026-10-16）：弹窗内的「取消 / 确认」已统一为**两枚等宽 `PrimaryButton`**
 * （`FavoritePicker` 底部与 `NameInput` 都走那一套），与面板内其它按钮同源。
 * 这枚圆钮款式保留备用，新弹窗若回到圆钮形态可直接取用。
 */
export function DialogActions({
  onCancel,
  onConfirm,
  cancelLabel = '取消',
  confirmLabel = '确认',
  confirmDisabled,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  /** 无障碍名（默认「取消」；确认钮一律用「确认」，全 App 只有这一个叫法） */
  cancelLabel?: string;
  confirmLabel?: string;
  confirmDisabled?: boolean;
}) {
  const theme = useTheme();
  const { accent, onAccent } = useAccent();
  const circle: StyleProp<ViewStyle> = {
    width: ACTION_SIZE,
    height: ACTION_SIZE,
    borderRadius: ACTION_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: stroke.base,
  };
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
      <Pressable
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel={tr(cancelLabel)}
        hitSlop={8}
        style={[circle, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      >
        {/* 撤回箭头 = 全 App 统一的返回箭头（ChevronIcon left） */}
        <ChevronIcon size={18} direction="left" color={theme.colors.text} />
      </Pressable>
      <Pressable
        onPress={confirmDisabled ? undefined : onConfirm}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!confirmDisabled }}
        accessibilityLabel={tr(confirmLabel)}
        hitSlop={8}
        style={[
          circle,
          {
            backgroundColor: accent,
            borderColor: accent,
            opacity: confirmDisabled ? opacity.disabled : 1,
          },
        ]}
      >
        <CheckIcon size={18} color={onAccent} />
      </Pressable>
    </View>
  );
}

/**
 * 弹窗内的「名称输入 + 取消/确认」（新建收藏夹时用它替换列表，
 * 避免在弹窗里再套一层弹窗；收藏夹选择弹窗与收藏夹列表弹窗共用）：
 * - 输入框 = **胶囊**（左右内边距 `layout.inputPad` 16 由外层容器给、内层 `TextInput` 清零）；
 * - 底部操作行 = **两枚等宽按钮**「取消 / 确认」，与上一层面板（收藏夹列表的「取消 / 确认」）
 *   同一款式：取消是纯文字按钮（无填充、无描边），确认是强调色实底；
 * - 各区纵向间距 = `PANEL_GAP`（16），与面板其余各区一致。
 */
export function NameInput({
  value,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const valid = value.trim().length > 0;
  /** 占位提示：聚焦后即隐（全 App 统一口径） */
  const hint = useFocusPlaceholder(tr('收藏夹名称'));
  return (
    <View style={{ gap: PANEL_GAP }}>
      {/* 胶囊输入框：草稿为空时描边提示品牌色（还没填），有内容即回落到常规描边 */}
      <View
        style={{
          height: 48,
          borderRadius: 999,
          borderWidth: stroke.base,
          borderColor: valid ? theme.colors.border : theme.colors.brand,
          backgroundColor: theme.colors.surface,
          // 胶囊类输入框：左右内边距给外层容器，内层 TextInput 清零（全 App 口径）
          paddingHorizontal: layout.inputPad,
          justifyContent: 'center',
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChange}
          autoFocus
          maxLength={12}
          {...hint}
          placeholderTextColor={theme.colors.textMuted}
          accessibilityLabel={tr('收藏夹名称')}
          onSubmitEditing={() => valid && onSubmit()}
          style={{
            paddingHorizontal: 0,
            paddingVertical: 0,
            includeFontPadding: false,
            // 单行胶囊：文字垂直居中（Android 需要显式指定）
            textAlignVertical: 'center',
            color: theme.colors.text,
            fontFamily: inputFont('bold'),
            fontSize: theme.size(16),
            backgroundColor: theme.colors.surface,
          }}
        />
      </View>
      {/* 两枚等宽按钮：取消（纯文字）/ 确认（强调色实底，没填名字时禁用）；高度同底栏按钮 */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <PrimaryButton
            label="取消"
            tone="ghost"
            strokeColor="transparent"
            labelKind="sm"
            style={DIALOG_ACTION_STYLE}
            onPress={onCancel}
          />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton
            label="确认"
            labelKind="sm"
            style={DIALOG_ACTION_STYLE}
            disabled={!valid}
            onPress={onSubmit}
          />
        </View>
      </View>
    </View>
  );
}
