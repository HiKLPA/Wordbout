import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { AppText } from '@/components/ui';
import type { WordEntry } from '@/domain/types';
import { trf } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { stroke } from '@/theme/tokens';

/**
 * 球面几何。
 * 球半径由「舞台短边 − 最外圈的圆在轮廓处占掉的宽度」推出（球 + 圆整体刚好卡进舞台，不会被切边）；
 * 透视焦点距离按球半径推算 —— 两者一起决定「球看起来多深」。
 *
 * 想调「球多大 / 圆多大」只改这几个常量：
 * - 圆多大：`explore.tsx` 的 CIRCLE_WIDTH_RATIO（参考直径）→ 本文件 BASE_SIZE_RATIO / SIZE_FALLOFF；
 * - 球多大：CAMERA_FACTOR 与 SPHERE_FILL（前者同时决定前后大小差，改动幅度别太大）。
 */
/** 球半径占可用空间的比例（半径已按「球 + 最外圈圆」精确推出，这里只再收一点，防浮点误差蹭出边） */
const SPHERE_FILL = 0.98;
/** 透视焦点距离 = 球半径 × 该倍数（越大越接近正交投影，前后大小差越小） */
const CAMERA_FACTOR = 5.2;
/**
 * 以下三个系数都由 CAMERA_FACTOR 推出（焦距 = 球半径 × CAMERA_FACTOR，球半径可以约掉），
 * 合起来回答「球加上最外圈的圆，最大能占多大」：
 * - PERSP_MAX：正对镜头那一点被放大的倍数 —— 作为 scale = 1 的基准；
 * - SILHOUETTE：球的轮廓在屏幕上比球半径再胖出多少（极值点在 sinθ = 1/C，≈ 1.019）；
 * - DOT_AT_EDGE：轮廓处的圆只剩这么多倍（相对 base/2）—— 那里离镜头更远，圆跟着缩（≈ 0.419）。
 */
const PERSP_MAX = CAMERA_FACTOR / (CAMERA_FACTOR - 1);
const SILHOUETTE =
  (Math.sqrt(1 - 1 / (CAMERA_FACTOR * CAMERA_FACTOR)) * CAMERA_FACTOR) /
  (CAMERA_FACTOR - 1 / CAMERA_FACTOR);
const DOT_AT_EDGE = CAMERA_FACTOR / (CAMERA_FACTOR - 1 / CAMERA_FACTOR) / PERSP_MAX / 2;
/** 拖动整整一个球直径（2R 像素）所转过的弧度 —— 「抓住球面拽着转」的手感基准 */
const SPIN_PER_DIAMETER = Math.PI;
/**
 * 拖动是**纯直接操作**：手指移多少，球就转多少（1:1，没有阻尼 / 缓动）；
 * 抬手也**不带惯性**，球立即停在当前朝向（缓动 / 阻尼两个特性已按要求整体删除）。
 * 想加回「松手后继续滑行」：在 `.onEnd` 里用 `withDecay({ velocity: e.velocityX * perPixel })`，
 * 加速度常数推荐 0.9965（见 reanimated `rigidDecay`：τ = 10/(1−d) 毫秒 → 约 2.9s）。
 */
/** 位移超过这么多像素才算拖动；否则把手势留给下层的圆去做点击 */
const DRAG_THRESHOLD = 4;
/** 朝向镜头的半球（旋转后 z > 0）才挂载；背面一律不渲染 */
const HORIZON = 0;
/**
 * **圆「出现 / 消失」的透明度渐变带**（按朝向镜头的深度 z 走）：
 * z 从 `HORIZON`(0，正好落在球的轮廓上、即将转去背面) 到该值之间，
 * 透明度按 smoothstep 由 0 渐显到 1 —— 轮廓处的圆本来就小、又在快速平移，
 * 这段渐隐让它的挂载 / 卸载不再「啪」地跳出来，而是顺着转动淡入淡出。
 * 调大更明显（0.3 ≈ 正面最外缘那一圈圆带一点点透明度），调小更含蓄。
 */
const HORIZON_FADE = 0.3;
/** 圆的基础直径 = 参考直径 × 该系数 × 词数修正（词越多画得越小，球面上才不会糊成一片） */
const BASE_SIZE_RATIO = 0.88;
const SIZE_PIVOT = 12;
const SIZE_FALLOFF = 0.22;
/** 黄金角：斐波那契球面分布，让任意 N 个点都尽量均匀铺满整个球面 */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
/** 可见集合用位掩码表示，超过 31 个词就退化成「全部挂载」（配置里最多 30 个词） */
const MASK_ALL = -1;
const MASK_BITS = 31;

/** 球面上的单位方向向量（与屏幕无关，只跟词数有关） */
type Dir = { x: number; y: number; z: number };

/**
 * 把球面上的单位方向向量按当前 (yaw, pitch) 旋转后，投影成屏幕坐标 + 透视缩放。
 * - 先绕屏幕竖轴转 yaw（左右拖动），再绕屏幕横轴转 pitch（上下拖动）；
 * - 相机在 +z 方向朝原点看，所以点的 z 越大离眼睛越近 → 越大；
 * - 返回的 y 已按屏幕坐标取反（屏幕 y 向下、世界 y 向上）；z 是旋转后的深度（> 0 = 朝向镜头）。
 * - s 是「相对最靠前那颗圆」的缩放（最前 = 1，轮廓处 ≈ 0.81）。
 *
 * 标了 'worklet'：它在 UI 线程上被每一颗圆的动画样式直接调用，不走 JS 线程。
 */
function projectPoint(dir: Dir, radius: number, yaw: number, pitch: number) {
  'worklet';
  const cosA = Math.cos(yaw);
  const sinA = Math.sin(yaw);
  const cosB = Math.cos(pitch);
  const sinB = Math.sin(pitch);
  // 绕屏幕竖轴（yaw）
  const x1 = dir.x * cosA + dir.z * sinA;
  const z1 = -dir.x * sinA + dir.z * cosA;
  const y1 = dir.y;
  // 绕屏幕横轴（pitch）
  const y2 = y1 * cosB - z1 * sinB;
  const z2 = y1 * sinB + z1 * cosB;
  // 相机在 +z、距球心 CAMERA_FACTOR × 球半径 → 透视系数里球半径正好约掉，只跟深度 z2 有关
  const persp = CAMERA_FACTOR / (CAMERA_FACTOR - z2);
  return {
    x: x1 * radius * persp,
    y: -y2 * radius * persp,
    s: persp / PERSP_MAX,
    z: z2,
  };
}

/** 当前朝向下「朝向镜头」的那批圆的位掩码（UI 线程上用，结果变了才回传 JS） */
function maskOf(dirs: readonly Dir[], radius: number, yaw: number, pitch: number) {
  'worklet';
  if (radius <= 0) return 0;
  if (dirs.length > MASK_BITS) return MASK_ALL;
  let mask = 0;
  for (let i = 0; i < dirs.length; i += 1) {
    if (projectPoint(dirs[i], radius, yaw, pitch).z > HORIZON) mask |= 1 << i;
  }
  return mask;
}

/**
 * 单颗圆：位置、大小与透明度全部由球面旋转推出来。
 * 动画样式在 UI 线程上求值（useAnimatedStyle），所以拖动时不经过 JS 线程，也不会触发 React 重渲染。
 * 背面（z ≤ 0）的圆由父组件直接不挂载，所以挂出来的一律朝向镜头；
 * 但越靠近轮廓的圆越淡（见 HORIZON_FADE），正好在 z→0 处透明度归零 ——
 * 于是「转出画面 / 转进画面」是淡出淡入，而不是硬生生地出现或消失。
 *
 * 形状是**宽度贴合单词长度的胶囊**（内边距统一 16、内文 16px）：
 * 外层的方盒只负责「落在球面投影点上」与作为 `scale` 的缩放原点，
 * 胶囊按内容撑开、在方盒里居中（短词窄、长词宽），横向超出方盒时对称溢出、中心仍在投影点上。
 *
 * 点它 → 这颗胶囊的**展开态**（详解）由 explore.tsx 按同一落点撑开，
 * 所以这里把自己隐形让位（见 `selected`）：球面上看到的就是「同一颗胶囊长大」。
 */
const SphereDot = React.memo(function SphereDot({
  word,
  size,
  dir,
  radius,
  yaw,
  pitch,
  selected,
  marked,
  onPick,
}: {
  word: WordEntry;
  /** 基础直径（未缩放） */
  size: number;
  /** 该词在球面上的单位坐标 */
  dir: Dir;
  radius: number;
  /** 当前朝向（共享值：拖动 / 惯性都由 UI 线程直接写，不重渲染） */
  yaw: SharedValue<number>;
  pitch: SharedValue<number>;
  /** 详解正打开在这颗词上：这颗胶囊本体已长成详解面板，所以自身隐形 + 退出命中 */
  selected: boolean;
  /** 这颗词**点过**（红标记一直留着，与详解是否打开无关）—— 决定描边与文字的颜色 */
  marked: boolean;
  /** 点中时连同**这颗胶囊在屏幕上的落点**（相对球心）一起回传：详解面板要以它为锚原地展开 */
  onPick: (id: string, anchor: { x: number; y: number }) => void;
}) {
  const theme = useTheme();

  const animStyle = useAnimatedStyle(() => {
    const p = projectPoint(dir, radius, yaw.value, pitch.value);
    // 轮廓附近渐隐：z ≤ 0 → 全透明（此刻正好被卸载），z ≥ HORIZON_FADE → 完全不透明
    const t = Math.min(1, Math.max(0, p.z / HORIZON_FADE));
    return {
      // 这颗词正展开详解：它的胶囊本体已经「长」成了详解面板（见 explore.tsx 的展开层），
      // 自身先隐形，免得面板被夹到舞台边上时从后面露出一颗小胶囊
      opacity: selected ? 0 : t * t * (3 - 2 * t), // smoothstep，两端都平缓，看不出「起点」
      transform: [{ translateX: p.x }, { translateY: p.y }, { scale: p.s }],
    };
  }, [dir, radius, selected]);

  /**
   * 点这颗胶囊：先按当前朝向算出它在屏幕上的投影点（相对球心，即舞台中心），
   * 一并交给调用方 —— 详解面板就落在这个点上「原地展开」，而不是另开一张居中的浮层。
   */
  const handlePress = useCallback(() => {
    const p = projectPoint(dir, radius, yaw.value, pitch.value);
    onPick(word.id, { x: p.x, y: p.y });
  }, [dir, radius, yaw, pitch, onPick, word.id]);

  return (
    <Animated.View
      /* 展开详解的那颗已经不显示了：顺手退出命中，别让它继续抢点击 */
      pointerEvents={selected ? 'none' : 'auto'}
      style={[
        {
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: size,
          height: size,
          marginLeft: -size / 2,
          marginTop: -size / 2,
          /* 方盒只作定位与缩放原点：把里面的胶囊居中（它按内容撑开，可以比方盒宽 / 窄） */
          alignItems: 'center',
          justifyContent: 'center',
        },
        animStyle,
      ]}
    >
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={trf('查看 {word} 的详解', { word: word.word })}
        style={{
          /* 胶囊面板：宽度贴合单词长度（不再撑满方盒），内边距四边统一 16 */
          padding: 16,
          borderRadius: 999,
          backgroundColor: theme.colors.surface,
          borderWidth: stroke.base,
          // 点过的胶囊：描边与文字一起转品牌红（线宽仍统一 0.5px，不加粗）；红标记一直留着
          borderColor: marked ? theme.colors.brand : theme.colors.border,
        }}
      >
        <AppText
          kind="sm"
          color={marked ? theme.colors.brand : theme.colors.text}
          numberOfLines={1}
          align="center"
        >
          {word.word}
        </AppText>
      </Pressable>
    </Animated.View>
  );
});

/**
 * 随机探索的「词球」：把所有词铺在一个球面上（斐波那契均匀分布）。
 * - 任意方向拖动 → 球跟着转，可以一直转下去（yaw / pitch 都不封顶，360° 无死角）；
 *   **纯 1:1 直接操作**：手指移多少球就转多少，没有阻尼 / 缓动；抬手也不带惯性，立即停在当前朝向；
 * - 每颗圆的大小由透视决定（越靠前越大）；越靠近球的轮廓越淡（HORIZON_FADE），
 *   转为背面时正好淡到 0 再卸载 —— 出现 / 消失都是渐隐，不会「啪」地跳出；
 *   背对镜头的那半球**不挂载**，所以既省渲染，也不会出现「看不见的圆抢走点击」。
 * - **点过的圆一直保持品牌红**（`markedIds`，由调用方累加、只增不减）：描边与文字一起变红，
 *   详解收起后依然红着，方便一眼认出「这批里哪些已经看过」。
 *
 * 实现要点（性能）：
 * - 朝向存在 reanimated 共享值里，每颗圆的位移 / 缩放由 `useAnimatedStyle` 在 **UI 线程** 求值，
 *   拖动过程完全不经过 JS 线程、也不触发 React 重渲染；
 * - 手势交给 gesture-handler 的 `Gesture.Pan`（worklet，同样在 UI 线程），
 *   位移超过 DRAG_THRESHOLD 才激活 → 轻点仍然点得到圆；
 * - 可见集合（位掩码）在 UI 线程算，只有「哪几颗朝向镜头」真的变了才 runOnJS 通知 React 增删节点，
 *   静止时零开销。
 */
export function WordRing({
  words,
  size,
  selectedId,
  markedIds,
  onPick,
}: {
  words: readonly WordEntry[];
  /** 参考直径（未缩放）；实际直径会按词数再收一档 */
  size: number;
  /** 详解当前打开在这颗词上（null = 没有打开）：这颗隐形让位，同时锁住转动 */
  selectedId: string | null;
  /** 点过的词集合：这些圆一直保持品牌红（描边 + 文字） */
  markedIds: ReadonlySet<string>;
  /** 点中某颗词（第二个参数见 `SphereDot.onPick`） */
  onPick: (id: string, anchor: { x: number; y: number }) => void;
}) {
  /** 舞台尺寸：球半径、投影与圆的落点都按它算，所以要实测 */
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const count = words.length;

  const base = Math.round(
    size * BASE_SIZE_RATIO * Math.min(1, Math.pow(SIZE_PIVOT / Math.max(count, 1), SIZE_FALLOFF)),
  );
  /**
   * 球半径 = 能塞进舞台的最大值：
   * 最外圈的圆落在球的轮廓上，那里的屏幕半径是 `base/2 × DOT_AT_EDGE`，
   * 而轮廓本身又比球半径凸出 `SILHOUETTE` 倍 —— 两者相加正好等于「舞台短边的一半」。
   * 所以先扣掉圆的占地，再把凸出除回来；球与圆整体卡进舞台，谁都不会被切边。
   */
  const radius =
    Math.max(0, (Math.min(stage.w, stage.h) / 2 - base * DOT_AT_EDGE) / SILHOUETTE) * SPHERE_FILL;
  const ready = radius > 0 && count > 0;

  /** 每个词的球面单位坐标（只跟词数与序号有关，与屏幕无关） */
  const dirs = useMemo<Dir[]>(
    () =>
      words.map((_, i) => {
        const y = 1 - ((i + 0.5) * 2) / Math.max(count, 1);
        const ring = Math.sqrt(Math.max(0, 1 - y * y));
        const phi = i * GOLDEN_ANGLE;
        return { x: ring * Math.cos(phi), y, z: ring * Math.sin(phi) };
      }),
    [words, count],
  );

  /** 当前朝向（弧度）：yaw 绕屏幕竖轴、pitch 绕屏幕横轴 */
  const yaw = useSharedValue(0);
  const pitch = useSharedValue(0);
  /** 起手时的朝向快照（拖动按「相对位移」累加，不会因为丢帧跑偏） */
  const baseYaw = useSharedValue(0);
  const basePitch = useSharedValue(0);
  /** 上一次回传给 JS 的可见集合（位掩码）：初值取一个不可能的值，保证首次必然同步一次 */
  const lastMask = useSharedValue(-2);

  /** 首次渲染时先在 JS 侧按当前朝向算一遍掩码，避免 UI 线程回传之前有一帧空球 */
  const initialMask = useMemo(() => maskOf(dirs, radius, 0, 0), [dirs, radius]);
  /** UI 线程回传的掩码；为 null 时用 initialMask 顶上 */
  const [maskFromUi, setMaskFromUi] = useState<number | null>(null);
  const visibleMask = maskFromUi ?? initialMask;

  /**
   * 在 UI 线程盯着朝向：算出「哪些圆朝向镜头」，只在集合真的变了才通知 React 挂载 / 卸载节点。
   * 静止时掩码不变 → 一次 runOnJS 都没有。
   */
  useAnimatedReaction(
    () => maskOf(dirs, radius, yaw.value, pitch.value),
    (cur) => {
      if (cur === lastMask.value) return;
      lastMask.value = cur;
      runOnJS(setMaskFromUi)(cur);
    },
    [dirs, radius],
  );

  /** 需要挂载的圆：朝向镜头的那半球（超过位掩码容量时全部挂载） */
  const visibleIndexes = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < count; i += 1) {
      if (visibleMask === MASK_ALL || (visibleMask & (1 << i)) !== 0) out.push(i);
    }
    return out;
  }, [count, visibleMask]);

  /** 像素 → 弧度：拖过一个球直径正好转 180° */
  const perPixel = SPIN_PER_DIAMETER / (2 * Math.max(radius, 1));

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // 位移超过阈值才激活 → 轻点仍然落到下层的圆上（圆自己处理 onPress）
        .minDistance(DRAG_THRESHOLD)
        // 有详解展开时不转球：那颗胶囊的展开态是钉在屏幕上的（球一转它就跑了）
        .enabled(ready && !selectedId)
        .onBegin(() => {
          // 记下起手朝向：拖动按「起手朝向 + 累计位移」算，不会因为丢帧跑偏
          baseYaw.value = yaw.value;
          basePitch.value = pitch.value;
        })
        .onUpdate((e) => {
          // 1:1 跟手：朝向 = 起手朝向 + 累计位移 × 灵敏度（无阻尼、无缓动）
          yaw.value = baseYaw.value + e.translationX * perPixel;
          pitch.value = basePitch.value + e.translationY * perPixel;
        }),
    [basePitch, baseYaw, perPixel, pitch, ready, selectedId, yaw],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setStage((prev) => (Math.abs(prev.w - w) > 0.5 || Math.abs(prev.h - h) > 0.5 ? { w, h } : prev));
  };

  return (
    <GestureDetector gesture={pan}>
      {/* collapsable={false}：别让 Android 把这个手势宿主视图优化掉 */}
      <View style={{ flex: 1, overflow: 'hidden' }} onLayout={onLayout} collapsable={false}>
        {ready
          ? visibleIndexes.map((i) => (
              <SphereDot
                key={words[i].id}
                word={words[i]}
                size={base}
                dir={dirs[i]}
                radius={radius}
                yaw={yaw}
                pitch={pitch}
                selected={words[i].id === selectedId}
                marked={markedIds.has(words[i].id)}
                onPick={onPick}
              />
            ))
          : null}
      </View>
    </GestureDetector>
  );
}
