import React, { useEffect, useRef } from 'react';
import { Animated, Easing, useWindowDimensions, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

/** 新板块从右侧滑入的距离（占屏宽比例） */
const SLIDE_IN_RATIO = 0.35;
/** 板块推进动画时长（ms） */
const SLIDE_IN_DURATION = 280;
/** 块与块之间的默认间距（与练习页 BLOCK_GAP 同值） */
const DEFAULT_GAP = 16;

/**
 * 板块推进动画：新板块从右侧滑入并淡入（题库 → 文体 → 题目、数量 → 题目 → 结果）。
 * 换板块时由调用方传 `key` 重挂载，动画值随之回到起点重新播放；
 * 辅助模式（精简动画）下直接显示，不做位移。
 *
 * `gap` 挂在这一层：板块内部**块与块**之间统一 16（默认可不传），
 * 同类元素彼此的小间距（选项之间、题库卡之间）仍写在各自的列表容器上。
 */
export function SlideIn({ children, gap = DEFAULT_GAP }: { children: React.ReactNode; gap?: number }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (theme.reduceMotion) return;
    const run = Animated.timing(anim, {
      toValue: 1,
      duration: SLIDE_IN_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [anim, theme.reduceMotion]);

  if (theme.reduceMotion) return <View style={{ gap }}>{children}</View>;

  return (
    <Animated.View
      style={{
        gap,
        opacity: anim,
        transform: [
          {
            translateX: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [width * SLIDE_IN_RATIO, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
