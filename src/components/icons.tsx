import React from 'react';
import Svg, { Circle, G, Path, Polygon, Rect } from 'react-native-svg';

import type { BoardId } from '@/config/appConfig';
import { useTheme } from '@/theme/ThemeProvider';

export interface IconProps {
  size?: number;
  color?: string;
  /** 品牌红点缀色，默认取主题品牌红 `palette.brandPrimary` */
  accent?: string;
}

/** 品牌标识（viewBox 128x128） */
export function Logo({ size = 128, color, accent }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.icon;
  const a = accent ?? theme.palette.brandPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 128 128">
      <Path d="M59.47,26.35h-9.74l-10.43,38.93s9.74,36.36,9.74,36.36l20.17-75.29h-9.74Z" fill={c} />
      <Path
        d="M2,26.35l20.17,75.29h19.49L22.37,29.64c-.52-1.94-2.28-3.29-4.29-3.29H2Z"
        fill={c}
      />
      <Path
        d="M116.26,101.65h-6.35c-2,0-3.75-1.34-4.27-3.27l-9.55-35.65,9.74-36.36,20.17,75.29h-9.74Z"
        fill={a}
      />
      <Polygon points="58.78 101.65 78.96 26.35 98.45 26.35 78.27 101.65 58.78 101.65" fill={a} />
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/* 底部导航图标（BarIcon，viewBox 48x48，图源 icon_file/bar）            */
/* ------------------------------------------------------------------ */

/** 主页 Main —— Logo 缩略（含品牌红） */
export function MainBarIcon({ size = 28, color, accent }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.icon;
  const a = accent ?? theme.palette.brandPrimary;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Polygon points="46 38.43 38.27 9.57 30.8 9.57 38.53 38.43 46 38.43" fill={c} />
      <Path d="M5.73,38.43c1.87,0,3.73,0,3.73,0l4-14.92s-3.73-13.94-3.73-13.94l-7.73,28.86h3.73Z" fill={c} />
      <Path
        d="M12.56,9.57l7.7,28.76-.03.1h.05c.31,0,1.99,0,3.68,0,1.87,0,3.73,0,3.73,0h.05s-.03-.1-.03-.1l3.97-14.82s-3.73-13.94-3.73-13.94l-3.97,14.82c-1.98-7.4-3.97-14.82-3.97-14.82h-7.47Z"
        fill={a}
      />
    </Svg>
  );
}

/** 课本 Textbook */
export function TextbookBarIcon({ size = 28, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.icon;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d="M24,8c-8.84,0-16,7.16-16,16,8.84,0,16-7.16,16-16Z" fill={c} />
      <Path d="M40,24c0-8.84-7.16-16-16-16,0,8.84,7.16,16,16,16Z" fill={c} />
      <Path d="M24,40c-8.84,0-16-7.16-16-16,8.84,0,16,7.16,16,16Z" fill={c} />
      <Path d="M40,24c0,8.84-7.16,16-16,16,0-8.84,7.16-16,16-16Z" fill={c} />
    </Svg>
  );
}

/**
 * 练习 Exercise（四瓣贴角）。
 * 注意：底栏里「练习」与「更多」的图标按设计要求**互换使用** ——
 * 练习用 `MoreBarIcon`、更多用本图标，映射写在 `components/BottomBar.tsx` 的 ROUTE_META。
 */
export function ExerciseBarIcon({ size = 28, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.icon;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d="M24,24c-8.28,0-15-6.72-15-15,8.28,0,15,6.72,15,15Z" fill={c} />
      <Path d="M9,39c0-8.28,6.72-15,15-15,0,8.28-6.72,15-15,15Z" fill={c} />
      <Path d="M39,9c0,8.28-6.72,15-15,15,0-8.28,6.72-15,15-15Z" fill={c} />
      <Path d="M39,39c-8.28,0-15-6.72-15-15,8.28,0,15,6.72,15,15Z" fill={c} />
    </Svg>
  );
}

/** 探索 Explore（四角月牙瓣 + 中心圆角方。design: manual/reference/icon_file/bar/bar-04.svg） */
export function ExploreBarIcon({ size = 28, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.icon;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d="M24,13.05c-4.42-2.56-9.53-4.05-15-4.05,0,5.47,1.49,10.58,4.05,15,2.63-4.54,6.41-8.32,10.95-10.95Z" fill={c} />
      <Path d="M24,34.95c4.42,2.56,9.53,4.05,15,4.05,0-5.47-1.49-10.58-4.05-15-2.63,4.54-6.41,8.32-10.95,10.95Z" fill={c} />
      <Path d="M34.95,24c2.56-4.42,4.05-9.53,4.05-15-5.47,0-10.58,1.49-15,4.05,4.54,2.63,8.32,6.41,10.95,10.95Z" fill={c} />
      <Path d="M24,34.95c-4.54-2.63-8.32-6.41-10.95-10.95-2.56,4.42-4.05,9.53-4.05,15,5.47,0,10.58-1.49,15-4.05Z" fill={c} />
      <Path d="M27.75,27.75c.65-2.46.65-5.04,0-7.5-2.46-.65-5.04-.65-7.5,0-.65,2.46-.65,5.04,0,7.5,2.46.65,5.04.65,7.5,0Z" fill={c} />
    </Svg>
  );
}

/** 更多 More（四瓣贴边）。底栏里与「练习」互换使用，见上方 `ExerciseBarIcon` 的说明 */
export function MoreBarIcon({ size = 28, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.icon;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d="M24,24c0-8.28-6.72-15-15-15,0,8.28,6.72,15,15,15Z" fill={c} />
      <Path d="M39,9c-8.28,0-15,6.72-15,15,8.28,0,15-6.72,15-15Z" fill={c} />
      <Path d="M9,24c0,8.28,6.72,15,15,15,0-8.28-6.72-15-15-15Z" fill={c} />
      <Path d="M24,39c8.28,0,15-6.72,15-15-8.28,0-15,6.72-15,15Z" fill={c} />
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/* Toolbar 图标（主页四个功能按钮，图源 icon_file/toolbar）             */
/* ------------------------------------------------------------------ */

export function CameraIcon({ size = 32, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.icon;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Circle cx="38.59" cy="9.41" r="1.41" fill={c} />
      <Path d="M24,8c-8.84,0-16,7.16-16,16s7.16,16,16,16,16-7.16,16-16-7.16-16-16-16ZM24,36c-6.63,0-12-5.37-12-12s5.37-12,12-12,12,5.37,12,12-5.37,12-12,12Z" fill={c} />
      <Path d="M24,14c-5.52,0-10,4.48-10,10s4.48,10,10,10,10-4.48,10-10-4.48-10-10-10ZM24,32.75c-4.83,0-8.75-3.92-8.75-8.75s3.92-8.75,8.75-8.75,8.75,3.92,8.75,8.75-3.92,8.75-8.75,8.75Z" fill={c} />
    </Svg>
  );
}

export function RecordIcon({ size = 32, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.icon;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Rect x="22.5" y="7" width="3" height="34" rx="1.5" ry="1.5" fill={c} />
      <Rect x="14.75" y="11.5" width="3" height="25" rx="1.5" ry="1.5" fill={c} />
      <Rect x="30.25" y="15" width="3" height="18" rx="1.5" ry="1.5" fill={c} />
      <Rect x="6.92" y="19.5" width="3" height="9" rx="1.5" ry="1.5" fill={c} />
      <Rect x="38.08" y="18" width="3" height="12" rx="1.5" ry="1.5" fill={c} />
    </Svg>
  );
}

/**
 * 扫码 / 扫描：四角是 **1/4 圆**（不是直角折线），正中一条横线。
 * 四个角都从「直角 L 形」改成半径 6 的圆弧，端点仍落在 (10|38, 16|32)，
 * 所以图标的外接范围与旧版完全一致，换到列表行里（28）不会变大变小。
 */
export function ScanIcon({ size = 32, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.icon;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Rect x="22.5" y="10" width="3" height="28" rx="1.5" ry="1.5" transform="rotate(90 24 24)" fill={c} />
      <G stroke={c} strokeWidth={3} strokeLinecap="round" fill="none">
        {/* 左上 / 右上 / 左下 / 右下：半径 6 的 1/4 圆，弧朝外侧的角鼓出 */}
        <Path d="M10 16A6 6 0 0 1 16 10" />
        <Path d="M38 16A6 6 0 0 0 32 10" />
        <Path d="M10 32A6 6 0 0 0 16 38" />
        <Path d="M38 32A6 6 0 0 1 32 38" />
      </G>
    </Svg>
  );
}

export function AiIcon({ size = 32, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.icon;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d="M36.32,26.04c-.09-1.36-.09-2.72,0-4.08-4.14-2.61-7.66-6.13-10.27-10.26-.68.04-1.36.07-2.05.07s-1.37-.03-2.05-.07c-2.61,4.14-6.13,7.66-10.27,10.26.09,1.36.09,2.72,0,4.08,4.14,2.61,7.66,6.13,10.27,10.26.68-.04,1.36-.07,2.05-.07s1.37.03,2.05.07c2.61-4.14,6.13-7.66,10.27-10.26ZM24,27.91c-1.62-.94-2.97-2.29-3.91-3.91.94-1.62,2.29-2.97,3.91-3.91,1.62.94,2.97,2.29,3.91,3.91-.94,1.62-2.29,2.97-3.91,3.91Z" fill={c} />
      <Path d="M36.71,18.71c.56-3.32,1.66-6.57,3.29-9.58l-1.13-1.13c-2.99,1.62-6.23,2.73-9.58,3.3,2.01,2.89,4.52,5.4,7.41,7.41Z" fill={c} />
      <Path d="M18.71,11.3c-3.35-.58-6.59-1.68-9.58-3.3l-1.13,1.13c1.64,3.02,2.73,6.26,3.29,9.58,2.89-2.01,5.4-4.52,7.41-7.41Z" fill={c} />
      <Path d="M11.29,29.29c-.56,3.32-1.66,6.57-3.29,9.58l1.13,1.13c2.99-1.62,6.23-2.73,9.58-3.3-2.01-2.89-4.52-5.4-7.41-7.41Z" fill={c} />
      <Path d="M29.29,36.7c3.35.58,6.59,1.68,9.58,3.3l1.13-1.13c-1.64-3.02-2.73-6.26-3.29-9.58-2.89,2.01-5.4,4.52-7.41,7.41Z" fill={c} />
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/* 更多页图标（图源 icon_file/more）                                    */
/* ------------------------------------------------------------------ */

/** 设置（Customize） */
export function SettingsIcon({ size = 24, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.icon;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Rect x="22.5" y="19.33" width="3" height="10" rx="1.5" ry="1.5" fill={c} />
      <Rect x="28.51" y="19.33" width="3" height="10" rx="1.5" ry="1.5" fill={c} />
      <Rect x="16.5" y="19.33" width="3" height="10" rx="1.5" ry="1.5" fill={c} />
      <Path d="M33.6,16.8c1.79,2.39,2.72,5.46,2.3,8.76-.68,5.41-5.09,9.75-10.51,10.36-7.25.81-13.39-4.84-13.39-11.92,0-2.74.92-5.26,2.46-7.28.57-.74.46-1.79-.19-2.45l-.14-.14c-.82-.82-2.17-.72-2.87.21-2.23,2.94-3.47,6.68-3.22,10.71.51,8.03,7.15,14.56,15.19,14.94,9.19.44,16.78-6.89,16.78-15.98,0-3.62-1.21-6.97-3.24-9.65-.71-.93-2.06-1.05-2.88-.23l-.14.14c-.69.69-.72,1.76-.13,2.54Z" fill={c} />
      <Rect x="21.75" y="8" width="4.5" height="4.5" rx="2.25" ry="2.25" fill={c} />
    </Svg>
  );
}

/** 隐私（Privacy） */
export function PrivacyIcon({ size = 24, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.icon;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d="M24,40c-8.84,0-16-7.16-16-16,8.84,0,16,7.16,16,16Z" fill={c} />
      <Path d="M40,24c0,8.84-7.16,16-16,16,0-8.84,7.16-16,16-16Z" fill={c} />
      <Circle cx="24" cy="16" r="8" fill={c} />
    </Svg>
  );
}

/** 关于（About） */
export function AboutIcon({ size = 24, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.icon;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d="M14.4,16.8c-1.79,2.39-2.72,5.46-2.3,8.76.68,5.41,5.09,9.75,10.51,10.36,7.25.81,13.39-4.84,13.39-11.92,0-2.74-.92-5.26-2.46-7.28-.57-.74-.46-1.79.19-2.45l.14-.14c.82-.82,2.17-.72,2.87.21,2.23,2.94,3.47,6.68,3.22,10.71-.51,8.03-7.15,14.56-15.19,14.94-9.19.44-16.78-6.89-16.78-15.98,0-3.62,1.21-6.97,3.24-9.65.71-.93,2.06-1.05,2.88-.23l.14.14c.69.69.72,1.76.13,2.54Z" fill={c} />
      <Rect x="22" y="17" width="4" height="14.5" rx="2" ry="2" fill={c} />
      <Rect x="21.75" y="8" width="4.5" height="4.5" rx="2.25" ry="2.25" fill={c} />
    </Svg>
  );
}

/** 收藏夹（Folder）：课本页星标区的收藏夹卡片与收藏夹列表用 */
export function FolderIcon({ size = 24, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.icon;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        d="M7 18.4a3.4 3.4 0 0 1 3.4-3.4h7.02c.94 0 1.83.39 2.48 1.07l1.6 1.7h15.1A3.4 3.4 0 0 1 40 21.17v14.03a3.4 3.4 0 0 1-3.4 3.4H10.4A3.4 3.4 0 0 1 7 35.2V18.4Z"
        fill={c}
      />
    </Svg>
  );
}

/** 箭头指向 → 绕图形中心（24,24）的旋转角：图形本朝右 */
const HINT_ROTATION: Record<'right' | 'up' | 'left' | 'down', number> = {
  right: 0,
  up: -90,
  left: 180,
  down: 90,
};

/**
 * 行末提示箭头（Hint/State3）：实心双片箭头，行末跳转提示用（更多 / 课本 / 练习页各处 size 18）。
 * `direction` 指箭头指向（默认向右）；字形本身只朝右画一份，其余三向由 `G` 绕中心旋转得到。
 */
export function HintIcon({
  size = 18,
  color,
  direction = 'right',
}: IconProps & { direction?: 'right' | 'up' | 'left' | 'down' }) {
  const theme = useTheme();
  const c = color ?? theme.colors.textMain;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <G transform={`rotate(${HINT_ROTATION[direction]} 24 24)`}>
        <Path d="M8.57,13.86v4.14l16.54,4.43s15.46-4.14,15.46-4.14L8.57,9.72v4.14Z" fill={c} />
        <Polygon points="8.57 38.28 40.57 29.71 40.57 21.43 8.57 30 8.57 38.28" fill={c} />
      </G>
    </Svg>
  );
}

/** 五角星顶点（外半径 10、内半径 4.2，几何中心 12,12.95 使字形在 24x24 框内上下居中） */
const STAR_POINTS =
  '12,2.95 14.47,9.55 21.51,9.86 15.99,14.25 17.88,21.04 12,17.15 6.12,21.04 8.01,14.25 2.49,9.86 9.53,9.55';

/** 收藏星标：filled=false 空心（未收藏）、true 实心（已收藏） */
export function StarIcon({ size = 24, color, filled = false }: IconProps & { filled?: boolean }) {
  const theme = useTheme();
  const c = color ?? theme.colors.textMain;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Polygon
        points={STAR_POINTS}
        fill={filled ? c : 'none'}
        stroke={c}
        strokeWidth={filled ? 0 : 1.7}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** 标记（书签）：filled=false 空心（未加入）、true 实心（已加入）——与 StarIcon 同一套开关语义 */
export function BookmarkIcon({ size = 24, color, filled = false }: IconProps & { filled?: boolean }) {
  const theme = useTheme();
  const c = color ?? theme.colors.textMain;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M6 3h12v18l-6-3.6L6 21V3z"
        fill={filled ? c : 'none'}
        stroke={c}
        strokeWidth={filled ? 0 : 1.8}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** 眼睛轮廓路径（杏形），眼白 / 瞳孔共用 */
const EYE_OUTLINE = 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z';

/** 眼睛：查看 / 展开（「查看解析」这类需要展开内容看的动作） */
export function EyeIcon({ size = 24, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.textMain;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={EYE_OUTLINE} fill="none" stroke={c} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx="12" cy="12" r="3.1" fill="none" stroke={c} strokeWidth={1.8} />
    </Svg>
  );
}

/** 闭眼：收起 / 隐藏（与 EyeIcon 成对，表示「收起解析」） */
export function EyeOffIcon({ size = 24, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.textMain;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={EYE_OUTLINE} fill="none" stroke={c} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx="12" cy="12" r="3.1" fill="none" stroke={c} strokeWidth={1.8} />
      <Path d="M4 4l16 16" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

/** 四个方向共用的路径（同一支尖括号，只是朝向不同；上下向与左右向按同一比例绘制） */
const CHEVRON_PATH: Record<'left' | 'right' | 'up' | 'down', string> = {
  right: 'M9 5l7 7-7 7',
  left: 'M15 5l-7 7 7 7',
  down: 'M5 9l7 7 7-7',
  up: 'M5 15l7-7 7 7',
};

/**
 * 尖括号箭头：direction 指箭头指向。
 * - left / right：「上一个 / 下一个」这类纯图标按钮
 * - down / up：面板的「展开 / 收起」开关（down = 还能展开，up = 已展开可收起）
 */
export function ChevronIcon({
  size = 24,
  color,
  direction = 'right',
}: IconProps & { direction?: 'left' | 'right' | 'up' | 'down' }) {
  const theme = useTheme();
  const c = color ?? theme.colors.textMain;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={CHEVRON_PATH[direction]}
        fill="none"
        stroke={c}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** 删除（垃圾桶）：用于「删除词库包」这类破坏性动作按钮 */
export function TrashIcon({ size = 24, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.textMain;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4 6.5h16M9.5 6.5V4h5v2.5M6.5 6.5l1 13h9l1-13M10 10.5v6M14 10.5v6"
        fill="none"
        stroke={c}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** 播放（实心三角）：专注计时开始 */
export function PlayIcon({ size = 24, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.textMain;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M7.5 4.6l12 7.4-12 7.4z" fill={c} />
    </Svg>
  );
}

/** 暂停（两条竖条）：专注计时暂停 */
export function PauseIcon({ size = 24, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.textMain;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="6.5" y="4.8" width="4" height="14.4" rx="1.6" fill={c} />
      <Rect x="13.5" y="4.8" width="4" height="14.4" rx="1.6" fill={c} />
    </Svg>
  );
}

/** 加号：新建 / 新增入口（收藏夹列表末的 dashed 卡等） */
export function PlusIcon({ size = 24, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.textMain;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 5v14M5 12h14" fill="none" stroke={c} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

/** 对号：多选列表 / 勾选框里的已勾选标记（颜色由调用方给） */
export function CheckIcon({ size = 24, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.textMain;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M5 12.6l4.7 4.6L19 6.8"
        fill="none"
        stroke={c}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** 双勾：多选列表的「全选」（与 CheckIcon / PlusIcon 同一套线宽与圆头，颜色由调用方给） */
export function SelectAllIcon({ size = 24, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.textMain;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M2.6 12.9l3.9 3.9L13.9 9.4"
        fill="none"
        stroke={c}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10.4 15.6l1.6 1.6L21.4 8.4"
        fill="none"
        stroke={c}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** 叉号：错误标记（选择题判错时的记号；与 CheckIcon 同粗细同尺寸，颜色由调用方给） */
export function CloseIcon({ size = 24, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.textMain;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6" fill="none" stroke={c} strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
  );
}

/** 省略号（竖向三个点）：与横版同一个「更多」含义，用于 32×32 正圆按钮内 */
export function EllipsisVerticalIcon({ size = 24, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.textMain;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="5.5" r="1.8" fill={c} />
      <Circle cx="12" cy="12" r="1.8" fill={c} />
      <Circle cx="12" cy="18.5" r="1.8" fill={c} />
    </Svg>
  );
}

/** 声音（喇叭 + 声波）：用于「朗读」这类发音按钮 */
export function SoundIcon({ size = 24, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.textMain;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4 9.5h3.2L11 6.2v11.6L7.2 14.5H4z"
        fill="none"
        stroke={c}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14.6 9.2a4.2 4.2 0 010 5.6M17.4 6.6a7.8 7.8 0 010 10.8"
        fill="none"
        stroke={c}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** 麦克风：口语跟读的「按住说话」按钮（与 SoundIcon 同一套线宽与线帽） */
export function MicIcon({ size = 24, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.textMain;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="9" y="3" width="6" height="10.4" rx="3" fill="none" stroke={c} strokeWidth={1.9} />
      <Path
        d="M6.2 11.4a5.8 5.8 0 0011.6 0M12 17.2v3.2M9.4 20.4h5.2"
        fill="none"
        stroke={c}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** 表格：用于「能力趋势」入口（打卡区右上角图标按钮） */
export function TableIcon({ size = 24, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.textMain;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="3" y="4.5" width="18" height="15" rx="2.5" fill="none" stroke={c} strokeWidth={1.8} />
      <Path d="M3 9.8h18M9.6 9.8v9.7" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

/** 秒表：专注计时器的「计时」档 */
export function StopwatchIcon({ size = 24, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.textMain;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="9.6" y="2.2" width="4.8" height="2" rx="1" fill={c} />
      <Path d="M12 4.2v2.6" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx="12" cy="14" r="7.4" fill="none" stroke={c} strokeWidth={1.8} />
      <Path
        d="M12 10.2V14l2.9 1.7"
        fill="none"
        stroke={c}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** 计数器：专注计时器的「计数」档（五计数标记） */
export function CounterIcon({ size = 24, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.textMain;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M6.8 5.5v13M10.4 5.5v13M14 5.5v13M17.6 5.5v13"
        fill="none"
        stroke={c}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Path d="M4.9 17.9L18.9 6.1" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

/** 下载（下箭头 + 托盘）：线性图标，与其它图标同线宽 1.8（2026-10-14 起课本封面已不再显示该角标） */
export function DownloadIcon({ size = 24, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.textMain;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 4v10M8 10.5l4 4 4-4M5 19.5h14"
        fill="none"
        stroke={c}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** 循环箭头：探索页「换一批」重抽用（与其它线性图标同线宽 1.8） */
export function RefreshIcon({ size = 24, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.textMain;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"
        fill="none"
        stroke={c}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M23 4v6h-6"
        fill="none"
        stroke={c}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** 历史对话：开口圆环 + 左上方指针 + 时针，AI 探索输入行左侧的历史按钮用（线宽同其它线性图标 1.8） */
export function HistoryIcon({ size = 24, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.textMain;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M3.51 15a9 9 0 1 0 2.12-9.36L1 10"
        fill="none"
        stroke={c}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M1 4v6h6"
        fill="none"
        stroke={c}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 7.4v5.2l3.6 2.1"
        fill="none"
        stroke={c}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/* 板块图标（听 / 写 / 说 / 读 / 译）：区块标题左侧 32×32，线宽 1.8      */
/* ------------------------------------------------------------------ */
/** 耳朵：板块「听」 */
export function EarIcon({ size = 24, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.textMain;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M5.5 8.6a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 0 1-7 0"
        fill="none"
        stroke={c}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14.5 8.6a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4"
        fill="none"
        stroke={c}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** 笔：板块「写」 */
export function PenIcon({ size = 24, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.textMain;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4.2 19.8l.9-3.7L16.4 4.8a2.2 2.2 0 0 1 3.1 3.1L8.2 19.2l-4 .6z"
        fill="none"
        stroke={c}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M14.9 6.3l3 3" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

/** 题卷：板块「读」 */
export function PaperIcon({ size = 24, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.textMain;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="5" y="3" width="14" height="18" rx="2.5" fill="none" stroke={c} strokeWidth={1.8} />
      <Path
        d="M8.6 9h6.8M8.6 13h6.8M8.6 17h3.8"
        fill="none"
        stroke={c}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** 翻译（「文」+「A」）：板块「译」 */
export function TranslateIcon({ size = 24, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.textMain;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M2.6 5.4h9.8M7.5 3.2v2.2M10.4 5.4c-.5 2.7-2.2 5.2-4.9 7M5.6 9.2c.9 1.9 2.6 3.4 4.6 4.4"
        fill="none"
        stroke={c}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M21.4 21.4l-4.5-9-4.5 9M14.4 17.5h5"
        fill="none"
        stroke={c}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/* 测验图标（积累 / 综合）：区块标题左侧 32×32、题集卡封面 72，线宽 1.8   */
/* ------------------------------------------------------------------ */

/** 叠层：测验「积累」（选定数量后按中文释义写英文词，一层层攒起来） */
export function StackIcon({ size = 24, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.textMain;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 3.2 3.6 7.4 12 11.6l8.4-4.2L12 3.2z"
        fill="none"
        stroke={c}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3.6 12 12 16.2 20.4 12"
        fill="none"
        stroke={c}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3.6 16.6 12 20.8 20.4 16.6"
        fill="none"
        stroke={c}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** 交叉双箭头：测验「综合」（跨五个板块随机抽题，打乱重排） */
export function ShuffleIcon({ size = 24, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.textMain;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M3.6 6.8h3.3c1.3 0 2.5.6 3.2 1.7l3.8 5.5c.7 1.1 1.9 1.7 3.2 1.7h3.3"
        fill="none"
        stroke={c}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3.6 17.2h3.3c1.3 0 2.5-.6 3.2-1.7l3.8-5.5c.7-1.1 1.9-1.7 3.2-1.7h3.3"
        fill="none"
        stroke={c}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M17.9 5.9 20.4 8.3 17.9 10.7"
        fill="none"
        stroke={c}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M17.9 13.3 20.4 15.7 17.9 18.1"
        fill="none"
        stroke={c}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/* 深浅色模式档位（设置页）：太阳 = 浅色，月亮 = 深色，线宽 1.8          */
/* ------------------------------------------------------------------ */

/** 太阳：设置页「深浅色模式」的浅色档。射线画到 r=8.8（整体外接 ≈17.6/24），
 *  与月亮月牙的视觉体量对齐 —— 铺满 24 会让它显得比月亮大一号。 */
export function SunIcon({ size = 24, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.textMain;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="4.2" fill="none" stroke={c} strokeWidth={1.8} />
      <Path
        d="M12 3.2v1.8M12 19v1.8M3.2 12h1.8M19 12h1.8M5.78 5.78l1.27 1.27M18.22 5.78l-1.27 1.27M5.78 18.22l1.27-1.27M18.22 18.22l-1.27-1.27"
        fill="none"
        stroke={c}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** 月亮：设置页「深浅色模式」的深色档 */
export function MoonIcon({ size = 24, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.textMain;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"
        fill="none"
        stroke={c}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/* 随机探索的显示方式档位（探索页底栏浮层）：矩形滑动区 / A-Z 列表，线宽 1.8 */
/* ------------------------------------------------------------------ */

/** 矩形滑动区：随机探索的「矩形」显示方式（圆角矩形框 + 框内一枚左右双箭头，表示可左右循环滑动） */
export function BoardIcon({ size = 24, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.textMain;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect
        x="2.6"
        y="5.4"
        width="18.8"
        height="13.2"
        rx="3.4"
        fill="none"
        stroke={c}
        strokeWidth={1.8}
      />
      <Path d="M16.4 12H7.6" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
      <Path
        d="M10 9.4 7.4 12 10 14.6"
        fill="none"
        stroke={c}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14 9.4 16.6 12 14 14.6"
        fill="none"
        stroke={c}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** 列表：随机探索的「A-Z 列表」显示方式（三条带前导点的行） */
export function ListIcon({ size = 24, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.textMain;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="4.7" cy="6.6" r="1.15" fill={c} />
      <Circle cx="4.7" cy="12" r="1.15" fill={c} />
      <Circle cx="4.7" cy="17.4" r="1.15" fill={c} />
      <Path
        d="M8.6 6.6h11M8.6 12h11M8.6 17.4h11"
        fill="none"
        stroke={c}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * 板块 → 图标（听 = 耳朵 / 写 = 笔 / 说 = 麦克风 / 读 = 题卷 / 译 = 文 A）。
 * 所有「按板块取图标」的地方共用这一份映射（练习页板块分区标题、能力趋势的板块筛选……），
 * 不要再各写一份。尺寸由调用方按场景给 —— 分区标题 32、筛选胶囊 20。
 */
export const BOARD_ICONS: Record<BoardId, React.ComponentType<IconProps>> = {
  listening: EarIcon,
  writing: PenIcon,
  speaking: MicIcon,
  reading: PaperIcon,
  translating: TranslateIcon,
};
