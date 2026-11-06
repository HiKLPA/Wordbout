import React, { useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, View } from 'react-native';

import { CheckIcon, TrashIcon } from '@/components/icons';
import { tr } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * 行内**左滑删除**（收藏夹列表与 AI 历史面板共用一套样式与逻辑）：
 *
 * - 左滑 → 行向左移出，右端露出 32px 正圆删除按钮（垃圾桶图标）；
 * - 点第一下按钮变对号（待确认），点第二下即真的删除 —— 不弹确认框；
 * - 同一时刻只允许一行露出（`openId`），滑另一行时上一行即时归位；
 * - 滑走 / 收起 / 滑另一行都会把「待确认」清掉，不会误删。
 *
 * 用法：父级 `const swipe = useSwipeRows()`，每行
 * `<SwipeRow id={id} controller={swipe} onDelete={...}>{行内容}</SwipeRow>`，
 * 行自己的点击里先问一句 `swipe.isAnyOpen()`（有行露着时先收起，避免误入）。
 */

/** 左滑露出的删除区宽度（装得下右侧的圆形删除按钮 + 左边留白） */
export const SWIPE_W = 64;
/** 左滑露出的圆形删除按钮直径（正圆） */
const DELETE_SIZE = 32;
/** 圆形删除按钮距右端的距离 */
const DELETE_SIDE = 16;
/** 松手后的归位 / 收起时长 */
const SNAP_MS = 160;
/** 滑过多少比例算「滑开」 */
const OPEN_RATIO = 0.5;
/** 起手判定：横向超过 6 且明显大于纵向才接管（否则让给纵向滚动与行的点击） */
const GRAB_DX = 6;
const GRAB_SLOPE = 1.2;

export interface SwipeRows {
  openId: string | null;
  armedId: string | null;
  /** 驱动当前露出那行的 translateX（非 0 为负） */
  x: Animated.Value;
  isOpen: (id: string) => boolean;
  isArmed: (id: string) => boolean;
  /** 是否有行正露着删除 */
  isAnyOpen: () => boolean;
  begin: (id: string) => void;
  move: (dx: number) => void;
  end: () => void;
  /** 收起左滑，顺带取消「待确认」 */
  close: () => void;
  /** 点删除：第一下只「装填」（图标变对号），第二下才执行 `run` 并收起 */
  tapDelete: (id: string, run: () => void) => void;
}

/** 一组可左滑删除的行的共享状态（同一时刻只有一行露出删除按钮） */
export function useSwipeRows(): SwipeRows {
  /** 左滑露出的删除按钮：同一时刻只允许一行露出，openId 指向它 */
  const [openId, setOpenId] = useState<string | null>(null);
  /** 已按下第一下、等待第二下确认的那一行 */
  const [armedId, setArmedId] = useState<string | null>(null);
  const x = useRef(new Animated.Value(0)).current;
  /** 左滑当前位移与滑动起点（露出状态下继续滑动要接着算） */
  const cur = useRef(0);
  const start = useRef(0);

  return useMemo<SwipeRows>(() => {
    const close = () => {
      cur.current = 0;
      start.current = 0;
      x.setValue(0);
      setOpenId(null);
      setArmedId(null);
    };
    return {
      openId,
      armedId,
      x,
      isOpen: (id) => openId === id,
      isArmed: (id) => armedId === id,
      isAnyOpen: () => openId !== null,
      begin: (id) => {
        if (openId === id) {
          // 已经露出的行接着滑：起点就是当前位移
          start.current = -SWIPE_W;
          cur.current = -SWIPE_W;
          setOpenId(id);
          x.setValue(-SWIPE_W);
          return;
        }
        // 换一行滑：上一行即时归位（openId 一变它的 translateX 就没了），「待确认」也一并取消
        start.current = 0;
        cur.current = 0;
        x.setValue(0);
        setOpenId(id);
        setArmedId(null);
      },
      // 只允许向左（0 → -SWIPE_W），向右回滑只能回到 0
      move: (dx) => {
        const next = Math.max(-SWIPE_W, Math.min(0, start.current + dx));
        cur.current = next;
        x.setValue(next);
      },
      end: () => {
        const open = cur.current < -SWIPE_W * OPEN_RATIO;
        Animated.timing(x, {
          toValue: open ? -SWIPE_W : 0,
          duration: SNAP_MS,
          useNativeDriver: false,
        }).start(() => {
          cur.current = open ? -SWIPE_W : 0;
          start.current = cur.current;
          if (!open) {
            setOpenId(null);
            setArmedId(null);
          }
        });
      },
      close,
      tapDelete: (id, run) => {
        if (armedId !== id) {
          setArmedId(id);
          return;
        }
        run();
        close();
      },
    };
  }, [openId, armedId, x]);
}

/**
 * 一行：手势层 + 下层那枚圆形删除按钮 + 被左滑驱动的行内容。
 * `enabled = false` 的行不做左滑、也不渲染删除按钮（如不可删的内置项）。
 */
export function SwipeRow({
  id,
  controller,
  onDelete,
  enabled = true,
  children,
}: {
  id: string;
  controller: SwipeRows;
  /** 已确认（点过第二下）时执行；正常情况下由 `controller.tapDelete` 转调 */
  onDelete: () => void;
  enabled?: boolean;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  /** 手势进行中回调会换新，用 ref 取最新的一组；PanResponder 只建一次 */
  const cbs = useRef({ controller, enabled });
  cbs.current = { controller, enabled };

  const pan = useMemo(
    () =>
      PanResponder.create({
        // 起手仍让给行的点击（内容里的 Pressable）；只在横向移动足够多时抢占
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) => {
          const c = cbs.current;
          return c.enabled && Math.abs(g.dx) > GRAB_DX && Math.abs(g.dx) > Math.abs(g.dy) * GRAB_SLOPE;
        },
        // 接管后不再交还，否则滑到一半会被 ScrollView 抢走
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => cbs.current.controller.begin(id),
        onPanResponderMove: (_e, g) => cbs.current.controller.move(g.dx),
        onPanResponderRelease: () => cbs.current.controller.end(),
        onPanResponderTerminate: () => cbs.current.controller.end(),
      }),
    [id],
  );

  const armed = controller.isArmed(id);
  const open = controller.isOpen(id);

  return (
    <View {...pan.panHandlers}>
      {/* 露出来的删除按钮（在行下层，行左移后被揭开）：32px 正圆，点两次才生效 */}
      {enabled ? (
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={armed ? tr('确认删除') : tr('删除')}
          style={{
            position: 'absolute',
            right: DELETE_SIDE,
            top: 0,
            bottom: 0,
            width: DELETE_SIZE,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: DELETE_SIZE,
              height: DELETE_SIZE,
              borderRadius: DELETE_SIZE / 2,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.brand,
            }}
          >
            {armed ? (
              <CheckIcon size={18} color={theme.colors.brandOn} />
            ) : (
              <TrashIcon size={17} color={theme.colors.brandOn} />
            )}
          </View>
        </Pressable>
      ) : null}

      <Animated.View style={open ? { transform: [{ translateX: controller.x }] } : undefined}>
        {children}
      </Animated.View>
    </View>
  );
}
