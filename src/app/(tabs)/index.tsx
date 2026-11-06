import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TranslateBar, ToolbarButtons } from '@/components/HomeBars';
import { Logo } from '@/components/icons';
import { FooterBar, SCREEN_HEADER_GAP, SCREEN_TOP_GAP, Screen } from '@/components/ui';

/**
 * 主页品牌区（Logo + 翻译条）顶端在页面竖直方向的位置 = **从上到下的 1/4 处**。
 * 按屏高比例定位而非写死像素：各机型上这块视觉重心落在同一相对高度。
 * 要调上下只改这一个数（1/4 = 0.25）。
 */
const HOME_TOP_RATIO = 1 / 4;

/**
 * 主页 / Main —— 对应 Figma「iPhone 16 & 17 Pro - 1」：
 * 固定页头 = Logo 160x160 + TranslateBar（竖向 gap 16），挂在滚动区之外，上下滑动时始终停住；
 * 页头顶端落在**屏高 1/4 处**（`HOME_TOP_RATIO`），比其它页面的 `SCREEN_TOP_GAP` 低得多 ——
 * 这块是全屏唯一的视觉重心，整体压在偏上的四分之一处，下方留出大片呼吸区。
 * 两个功能按钮（拍照翻译 / 语音翻译）已从页头**下沉到底栏正上方 16px**（走 `Screen` 的 footer 槽 + `FooterBar aboveBar`），
 * 排成一排等宽胶囊、含 8px 间隔的总宽与底栏一致、高度与探索页输入框同高。
 * 滚动区目前没有内容 —— 原来的「最近练习」快捷入口已挪到练习页（首个板块「听」的上方），
 * 让「继续上次练习」出现在练习这件事发生的那个页面里（设计原则：高效）。
 */
export default function MainScreen() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  /**
   * `Screen` 的 `headerTopGap` 是「安全区下沿 → 页头顶端」的距离（组件内部另加 `insets.top`），
   * 所以这里先减掉安全区高度，页头顶端才真正落在屏高 1/4 处；
   * 下限兜底 `SCREEN_TOP_GAP`，极矮的屏也不会把页头推到顶部安全区之上。
   */
  const headerTopGap = Math.max(SCREEN_TOP_GAP, height * HOME_TOP_RATIO - insets.top);

  /** 顶部固定区块：Logo → 翻译输入条（挂在 `Screen` 的 header 槽上，渲染在滚动区之外） */
  const topBlock = (
    <View style={{ gap: 16 }}>
      <View style={{ alignItems: 'center' }}>
        <Logo size={160} />
      </View>
      <TranslateBar />
    </View>
  );

  return (
    <Screen
      header={topBlock}
      headerTopGap={headerTopGap}
      headerMaskGap={SCREEN_HEADER_GAP}
      /* 两个功能按钮浮在底栏上方 16px：左右各 32、按钮间 8，含间隔的总宽与底栏一致 —— 几何全交给 FooterBar */
      footer={
        <FooterBar aboveBar gap={8}>
          <ToolbarButtons />
        </FooterBar>
      }
    >
      {/* 滚动区暂无内容：页面主体（Logo / 翻译条）在固定页头里，两个按钮浮在底栏上方。
          「最近练习」已搬到练习页，这里保留空滚动区，日后要加内容直接往这里放。 */}
      {null}
    </Screen>
  );
}
