import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import type { LocaleName } from '@/i18n';
import { setLocale } from '@/i18n';
import { CjkFont, FontFamily, LatinFont, type FontWeightKey } from '@/theme/fonts';
import {
  FONT_SCALES,
  highContrastOverrides,
  layout,
  palette,
  semanticColors,
  typography,
} from '@/theme/tokens';
import type { ColorSchemeName, SemanticColors } from '@/theme/tokens';
import { useApp } from '@/store/AppStore';

export type TextKind = 'display' | 'xxxl' | 'xxl' | 'xl' | 'lg' | 'md' | 'sm' | 'body' | 'tiny' | 'micro';

/** 字号档位 → 字重档：英文数字取 Barlow、汉字取思源黑体的同一档字重（全 App 只用 500 / 600 两档） */
export function fontWeightOf(kind: TextKind): FontWeightKey {
  switch (kind) {
    case 'display':
    case 'xxxl':
    case 'xxl':
    case 'xl':
      return 'extraBold';
    case 'lg':
    case 'md':
    case 'sm':
      return 'bold';
    default:
      return 'regular';
  }
}

/** 某档位下汉字应使用的字体（思源黑体）；weight 可覆盖该档默认字重 */
export function cjkFontOf(kind: TextKind, weight?: FontWeightKey): string {
  return CjkFont[weight ?? fontWeightOf(kind)];
}

export interface Theme {
  scheme: ColorSchemeName;
  colors: SemanticColors;
  fontScale: number;
  /** 当前界面语言（NFR-8）：变更时整棵树重渲染，文字随之切换 */
  locale: LocaleName;
  /** 是否禁用动画（辅助模式 → 精简动画） */
  reduceMotion: boolean;
  /** 按设计令牌取字号并应用字号档位 */
  size: (base: number) => number;
  family: typeof FontFamily;
  layout: typeof layout;
  palette: typeof palette;
  /** 字号目标仍遵循设计比例，1.6 上限避免布局重叠（NFR-4） */
  maxFontSizeMultiplier: number;
}

const defaultTheme: Theme = {
  scheme: 'light',
  colors: semanticColors.light,
  fontScale: 1,
  locale: 'zh-Hans',
  reduceMotion: false,
  size: (base) => base,
  family: FontFamily,
  layout,
  palette,
  maxFontSizeMultiplier: 1.6,
};

const ThemeContext = createContext<Theme>(defaultTheme);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { state } = useApp();
  const systemScheme = useColorScheme();
  const settings = state.settings;

  const scheme: ColorSchemeName =
    settings.colorScheme === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : settings.colorScheme;

  const fontScale = FONT_SCALES[settings.fontScaleIndex] ?? 1;

  // 语言是模块级单例（供域层工具函数读取），在任何子树渲染前同步一次
  const locale = (settings.locale ?? 'zh-Hans') as LocaleName;
  setLocale(locale);

  const theme = useMemo<Theme>(() => {
    const base = semanticColors[scheme];
    const colors = settings.highContrast ? { ...base, ...highContrastOverrides[scheme] } : base;
    return {
      scheme,
      colors,
      fontScale,
      locale,
      reduceMotion: settings.reduceMotion,
      size: (b: number) => Math.round(b * fontScale * 100) / 100,
      family: FontFamily,
      layout,
      palette,
      maxFontSizeMultiplier: 1.6,
    };
  }, [scheme, fontScale, locale, settings.highContrast, settings.reduceMotion]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/**
 * **页面级强调色（Accent Scope）**：整 App 默认用 `colors.brand`（品牌红）。
 * 某个页面要整体换一套强调色时（如词库详情页全走品牌黄），用 `<AccentProvider>` 包住该页，
 * 页内所有读 `useAccent()` 的地方（强调描边 / 强调文字 / 选中态 / 进度条 / 实心按钮 / 朗读圆钮）
 * 自动跟着换，不必逐级传 props；没包 provider 的页面取默认值，观感与改动前完全一致。
 */
export interface AccentScope {
  /** 强调色本体：描边、强调文字、选中态、进度条填充、实心按钮底色 */
  accent: string;
  /** 压在强调色**实底**之上的前景色（图标 / 文字）：自定义强调色时按亮度自动取深或浅 */
  onAccent: string;
  /** 正文里的**高亮色**（例句 / 短语里的命中词）：与强调色分开一档，默认 `colors.accentRed` */
  highlight: string;
}

const AccentContext = createContext<{ accent?: string; highlight?: string }>({});

export function AccentProvider({
  accent,
  highlight,
  children,
}: {
  /** 强调色；不传 = 主题品牌红 */
  accent?: string;
  /** 高亮色；不传 = 主题 `accentRed` */
  highlight?: string;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ accent, highlight }), [accent, highlight]);
  return <AccentContext.Provider value={value}>{children}</AccentContext.Provider>;
}

export function useAccent(): AccentScope {
  const theme = useTheme();
  const scope = useContext(AccentContext);
  const accent = scope.accent ?? theme.colors.brand;
  return {
    accent,
    /*
     * 强调色实底上的文字 / 图标**一律 `colors.brandOn`**（2026-10-17 起）：黄底也照常盖浅色，
     * 不再按底色明暗推前景 —— 主题黄页上的白字不必转成深色，与其它主题色一致。
     */
    onAccent: theme.colors.brandOn,
    highlight: scope.highlight ?? theme.colors.accentRed,
  };
}

/** 排版的组合快捷方式：拉丁字用 Barlow，汉字由 <AppText> 换成思源黑体 */
export function useTypography() {
  const theme = useTheme();
  return useCallback(
    (kind: TextKind, weight?: FontWeightKey) => {
      const family = LatinFont[weight ?? fontWeightOf(kind)];
      const lh = typography.lineHeights;
      switch (kind) {
        case 'display':
          return {
            fontFamily: family,
            fontSize: theme.size(typography.display),
            lineHeight: theme.size(lh.display),
            letterSpacing: -2,
          };
        case 'xxxl':
          return {
            fontFamily: family,
            fontSize: theme.size(typography.xxxl),
            lineHeight: theme.size(lh.xxxl),
            letterSpacing: -1,
          };
        case 'xxl':
          /* 48px 档：夹在 xl(32) 与 xxxl(64) 之间（课本封面书名等） */
          return { fontFamily: family, fontSize: theme.size(typography.xxl), lineHeight: theme.size(lh.xxl) };
        case 'xl':
          return { fontFamily: family, fontSize: theme.size(typography.xl), lineHeight: theme.size(lh.xl) };
        case 'lg':
          return { fontFamily: family, fontSize: theme.size(typography.lg), lineHeight: theme.size(lh.lg) };
        case 'md':
          return { fontFamily: family, fontSize: theme.size(typography.md), lineHeight: theme.size(lh.md) };
        case 'sm':
          return { fontFamily: family, fontSize: theme.size(typography.sm), lineHeight: theme.size(lh.sm) };
        case 'body':
          return {
            fontFamily: family,
            fontSize: theme.size(typography.sm),
            lineHeight: theme.size(typography.bodyLineHeight),
          };
        case 'tiny':
          /* 二级小字档：14px —— 夹在 micro(12) 与 body(16) 之间，
             中文释义 / 译文、卡片副行、面板小节标题用它（原先靠 `fontSize: size(14)` 手写覆盖） */
          return {
            fontFamily: family,
            fontSize: theme.size(typography.tiny),
            lineHeight: theme.size(lh.tiny),
          };
        default:
          /* 小字档（micro）：12px，唯一的「小字」档 —— 原 caption(13) / bar(12) 已并入 */
          return {
            fontFamily: family,
            fontSize: theme.size(typography.micro),
            lineHeight: theme.size(lh.micro),
            letterSpacing: 0.4,
          };
      }
    },
    [theme],
  );
}
