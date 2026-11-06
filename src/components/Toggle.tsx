import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { opacity } from '@/theme/tokens';

/** 设计稿尺寸：轨道 48×24，滑块 20×20，四周留 2px */
const TRACK_W = 48;
const TRACK_H = 24;
const KNOB = 20;
const INSET = (TRACK_H - KNOB) / 2;

/**
 * 开关（设计稿 Toggle）：轨道 48×24、圆形滑块 20×20。
 * 未激活：浅灰轨道 + 近白滑块；激活：品牌红轨道 + 白色滑块。
 * 颜色过渡用红色层淡入实现，位移动画走原生驱动（精简动画模式下直接跳变）。
 */
export function Toggle({
  value,
  onValueChange,
  accessibilityLabel,
  disabled,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  accessibilityLabel?: string;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    if (theme.reduceMotion) {
      anim.setValue(value ? 1 : 0);
      return;
    }
    const t = Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    t.start();
    return () => t.stop();
  }, [value, anim, theme.reduceMotion]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [INSET, TRACK_W - KNOB - INSET],
  });

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={{
        width: TRACK_W,
        height: TRACK_H,
        borderRadius: TRACK_H / 2,
        backgroundColor: theme.colors.surfaceSunken,
        overflow: 'hidden',
        opacity: disabled ? opacity.disabled : 1,
      }}
    >
      {/* 激活态红底：淡入淡出，避免 JS 驱动的颜色插值 */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: theme.colors.brand,
          opacity: anim,
        }}
      />
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: INSET,
          left: 0,
          width: KNOB,
          height: KNOB,
          borderRadius: KNOB / 2,
          backgroundColor: theme.colors.surfaceRaised,
          transform: [{ translateX }],
        }}
      />
      <View pointerEvents="none" style={{ flex: 1 }} />
    </Pressable>
  );
}
