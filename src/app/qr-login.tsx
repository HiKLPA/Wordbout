import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import {
  AppText,
  FOOTER_BUTTON_HEIGHT,
  FooterBar,
  PageHeader,
  PrimaryButton,
  Screen,
} from '@/components/ui';
import { tr } from '@/i18n';
import { useApp } from '@/store/AppStore';
import { useTheme } from '@/theme/ThemeProvider';

const TTL_SECONDS = 120;
const SIZE = 21;
/** 双击判定窗口：两次点击间隔小于它才算一次「双击刷新」 */
const DOUBLE_TAP_MS = 300;

/** 底部固定条按钮几何：与「积累」「练习」的底栏同一套 */
const FOOTER_BTN = {
  flex: 1,
  minHeight: FOOTER_BUTTON_HEIGHT,
  height: FOOTER_BUTTON_HEIGHT,
  paddingHorizontal: 8,
};

/** 由 token 生成确定性点阵（正式版替换为真实二维码编码库） */
function matrixFrom(token: string): boolean[][] {
  const rows: boolean[][] = [];
  let seed = 0;
  for (let i = 0; i < token.length; i += 1) seed = (seed * 31 + token.charCodeAt(i)) >>> 0;
  let state = seed || 1;
  for (let y = 0; y < SIZE; y += 1) {
    const row: boolean[] = [];
    for (let x = 0; x < SIZE; x += 1) {
      state = (state * 1103515245 + 12345) >>> 0;
      row.push(((state >>> 16) & 1) === 1);
    }
    rows.push(row);
  }
  // 三个定位角
  const corner = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        const edge = x === 0 || y === 0 || x === 6 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        rows[oy + y][ox + x] = edge || core;
      }
    }
  };
  corner(0, 0);
  corner(SIZE - 7, 0);
  corner(0, SIZE - 7);
  return rows;
}

/**
 * 账号 / 扫码登录（FR-M-2 / FR-A-1）—— 从「更多」的「账号」这一行进入。
 * 二维码直接落在页面上（白底留白区是二维码自身的一部分，不是面板），下方给出有效期；
 * 过期后自动刷新，**双击二维码本身**也能立刻刷新（原先底栏那枚「刷新」按钮已撤掉，
 * 底栏改放账号操作）。底栏两枚按钮平分宽度，**退出登录固定在最右侧**。
 */
export default function QrLoginScreen() {
  const theme = useTheme();
  const { state, actions } = useApp();
  const [token, setToken] = useState(() => Math.random().toString(36).slice(2, 10).toUpperCase());
  const [left, setLeft] = useState(TTL_SECONDS);
  /** 上一次点击二维码的时间戳：两次间隔小于 `DOUBLE_TAP_MS` 判为双击 */
  const lastTapRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          // 二维码过期自动刷新
          setToken(Math.random().toString(36).slice(2, 10).toUpperCase());
          return TTL_SECONDS;
        }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const matrix = useMemo(() => matrixFrom(token), [token]);
  const cell = 240 / SIZE;

  /** 刷新：换 token 并把有效期重置回 120 秒 */
  const refresh = useCallback(() => {
    setToken(Math.random().toString(36).slice(2, 10).toUpperCase());
    setLeft(TTL_SECONDS);
  }, []);

  /** 双击二维码刷新。`Pressable` 没有 onDoublePress，自己用时间戳判：单击不做事。 */
  const onQrPress = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      lastTapRef.current = 0;
      refresh();
    } else {
      lastTapRef.current = now;
    }
  }, [refresh]);

  return (
    <Screen
      header={<PageHeader title="账号" />}
      contentStyle={{ flexGrow: 1, gap: 16 }}
      footer={
        <FooterBar>
          {/* 左：注销账号；右：退出登录（未登录时该位置改为「登录并同步记录」） */}
          <PrimaryButton
            style={FOOTER_BTN}
            label="注销账号"
            tone="danger"
            labelKind="md"
            onPress={() =>
              Alert.alert(tr('注销账号'), tr('账号与全部学习记录都会被删除，且不可恢复。确定继续吗？'), [
                { text: tr('取消'), style: 'cancel' },
                {
                  text: tr('注销'),
                  style: 'destructive',
                  onPress: () => {
                    actions.resetLearningData();
                    actions.signOut(false);
                  },
                },
              ])
            }
          />
          {state.profile.signedIn ? (
            <PrimaryButton
              style={FOOTER_BTN}
              label="退出登录"
              tone="ghost"
              panel
              labelKind="md"
              onPress={() =>
                Alert.alert(tr('退出登录'), tr('请选择本地学习记录的处理方式。'), [
                  { text: tr('取消'), style: 'cancel' },
                  { text: tr('保留本地记录'), onPress: () => actions.signOut(true) },
                  { text: tr('同时清空本地记录'), style: 'destructive', onPress: () => actions.signOut(false) },
                ])
              }
            />
          ) : (
            <PrimaryButton
              style={FOOTER_BTN}
              label="登录并同步记录"
              labelKind="sm"
              onPress={() => actions.signIn('phone', state.profile.nickname)}
            />
          )}
        </FooterBar>
      }
    >
      {/* 二维码固定在页面竖直中间：这一块吃掉底栏以上的全部剩余高度后居中，
          所以不同屏高、有没有页头都停在同一位置（底栏按钮不参与居中）。 */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Pressable
          onPress={onQrPress}
          accessibilityRole="button"
          accessibilityLabel={tr('双击二维码可刷新')}
          onAccessibilityTap={refresh}
          style={{ padding: 12, borderRadius: 16, backgroundColor: '#FFFFFF' }}
        >
          <Svg width={240} height={240} viewBox={`0 0 ${240} ${240}`}>
            {matrix.map((row, y) =>
              row.map((on, x) =>
                on ? (
                  <Rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill="#2D2D2D" />
                ) : null,
              ),
            )}
          </Svg>
        </Pressable>
        <AppText kind="micro" color={theme.colors.textSecondary} align="center">
          有效期 {Math.floor(left / 60)} 分 {left % 60} 秒，过期后自动刷新
        </AppText>
      </View>
    </Screen>
  );
}
