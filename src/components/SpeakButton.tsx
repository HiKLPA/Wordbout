import React from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import * as Speech from 'expo-speech';

import { SoundIcon } from '@/components/icons';
import { tr } from '@/i18n';
import { useAccent, useTheme } from '@/theme/ThemeProvider';
import { stroke, typography } from '@/theme/tokens';

/** 圆形朗读按钮的直径：与所有释义面板里的序号圆标同口径（全 App 统一 20） */
export const SPEAK_BUTTON_SIZE = 20;

/**
 * 圆形按钮的**点击热区**边长：视觉直径 20，向外各扩 2px → 触达区 24×24
 * （≥ 平台推荐的最小可点尺寸，视觉不变胖）。
 */
export const SPEAK_BUTTON_HIT_SLOP = 2;

/**
 * 把发音钮放到**句子左侧**时，与正文首行中线对齐所需的上边距。
 * 按钮直径固定 `SPEAK_BUTTON_SIZE`(20)，正文首行行盒见 `tokens.typography`（body 28 / md 24），
 * 高差的一半就是偏移量。句子在 `alignItems: 'flex-start'` 的行里换行后，
 * 按钮仍贴着第一行，而不会跑到整段文字中间。使用时套一层 `theme.size()`。
 */
export function speakButtonOffset(kind: 'body' | 'md'): number {
  const lineHeight = kind === 'body' ? typography.bodyLineHeight : typography.lineHeights.md;
  return (lineHeight - SPEAK_BUTTON_SIZE) / 2;
}

/**
 * 圆形朗读按钮（20px 强调色正圆 + 反白喇叭 + 主题描边 + hitSlop 2 → 热区 24×24）。
 * 圆底默认品牌红，页面可用 `<AccentProvider>` 换成别的强调色（词库详情页走品牌黄）；
 * 词条音标行、逐句译文、语音翻译的识别原文 / 译文都复用这一份实现，几何完全一致。
 * 放在句子左侧时用 `speakButtonOffset()` 给它 `marginTop` 对齐首行。
 */
export function SpeakButton({
  text,
  lang,
  accessibilityLabel,
  style,
}: {
  /** 要朗读的内容 */
  text: string;
  /** 朗读语言（`zh-CN` / `en-US`） */
  lang: string;
  /** 无障碍名（中文原文，内部走 tr） */
  accessibilityLabel: string;
  /** 额外样式（对齐首行时传 `marginTop`） */
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  /** 圆底取页面强调色（默认品牌红；词库详情页整页换品牌黄时跟着变） */
  const { accent, onAccent } = useAccent();
  return (
    <Pressable
      onPress={() => Speech.speak(text, { language: lang, rate: 0.95 })}
      accessibilityRole="button"
      accessibilityLabel={tr(accessibilityLabel)}
      hitSlop={SPEAK_BUTTON_HIT_SLOP}
      style={[
        {
          width: SPEAK_BUTTON_SIZE,
          height: SPEAK_BUTTON_SIZE,
          borderRadius: 999,
          backgroundColor: accent,
          borderWidth: stroke.base,
          borderColor: theme.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <SoundIcon size={12} color={onAccent} />
    </Pressable>
  );
}
