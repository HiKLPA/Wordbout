import React, { useEffect, useState } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { notifyUser } from '@/components/AppDialog';
import { CounterIcon, PauseIcon, PlayIcon, RefreshIcon, StopwatchIcon } from '@/components/icons';
import { AppText, Card } from '@/components/ui';
import { appConfig } from '@/config/appConfig';
import { tr, trf } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { stroke } from '@/theme/tokens';

type FocusMode = 'time' | 'count';

/** 两档模式：秒表（计时）/ 计数器（计数） */
const MODES: FocusMode[] = ['time', 'count'];

/**
 * 分页面板卡片统一高度：打卡区与计时器两张卡等高。
 * 打卡卡内容 = 进度环 80 + 环与标签间距 6 + 标签行高 17（micro）= 103，加卡片上下内边距 32 = 135，
 * 取 138 留 3px 余量（两卡内容各自在卡内居中，多一点富余不会让谁先溢出）。
 */
export const PANEL_CARD_HEIGHT = 138;

/** 圆形图标按钮尺寸：模式切换与主操作同尺寸 */
const ROUND_BUTTON = 32;
/** 圆形按钮内图标尺寸 */
const ROUND_ICON = 18;

/** 预设按钮圆角 */
const FIELD_RADIUS = 12;
/** 四枚预设按钮之间的间距 */
const FIELD_GAP = 8;
/** 设定区与下方操作行之间的间距 */
const ROW_GAP = 16;
/**
 * 操作行正中「读数底衬」（品牌红半透明底）的固定尺寸：**长 96 × 高 32 的胶囊**。
 * 两个值都写死，是为了让读数底衬**不随文字长度变胖变瘦** —— 计时是 `mm:ss`（5 字）、
 * 计数是「已完成 / 目标」（如 `3 / 10`、`10 / 40`，7~8 字），
 * 若由内容撑宽，两种模式来回切换时底下那块红会一格一格地跳。
 */
const DISPLAY_BADGE_W = 96;
const DISPLAY_BADGE_H = 32;
/** 操作行右侧两枚圆钮（重新 / 开始·暂停）之间的间距，与左侧模式钮的 8 对齐 */
const ACTION_GAP = 8;

/** 两字补零，倒计时展示 mm:ss */
function mmss(seconds: number): string {
  const s = Math.max(0, seconds);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * 专注计时器（练习页打卡区右侧面板，与打卡区同一行横向滑动相邻显示）。
 *
 * 卡片固定 PANEL_CARD_HEIGHT(138) 高（与打卡卡等高），两块内容分别上下贴住内边距、中间隔 ROW_GAP(16)：
 * - 上块：设定区（flex 1，吃满剩余高度）—— 四枚快捷预设按钮**等分卡片内宽**（各 flex 1）：
 *   计时 10 / 25 / 30 / 45 分钟，计数 10 / 20 / 30 / 40 个任务；
 * - 下块：操作行（32 高）—— 左下角 秒表 / 计数器 模式切换（32×32 正圆）、
 *   居中 倒计时 mm:ss 或「已完成 / 目标」（底下那层品牌红底衬**长 96 × 高 32 的胶囊**，
 *   见 `DISPLAY_BADGE_W` / `DISPLAY_BADGE_H`，不随文字长度变化）、右下角 重新计时 / 计数（白底圆钮）+ 开始 / 暂停（32×32 正圆，两档通用）。
 *
 * 达到目标后弹窗提醒，关闭弹窗即回到待开始态。预设值走
 * `appConfig.focus`（NFR-6：门槛类参数配置化）。
 */
export function FocusTimer({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const [mode, setMode] = useState<FocusMode>('time');
  const [minutes, setMinutes] = useState(appConfig.focus.timePresets[1] ?? appConfig.focus.timePresets[0]);
  const [taskTarget, setTaskTarget] = useState(appConfig.focus.taskPresets[1] ?? appConfig.focus.taskPresets[0]);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(0);
  const [running, setRunning] = useState(false);

  const total = mode === 'time' ? minutes : taskTarget;
  const presets = mode === 'time' ? appConfig.focus.timePresets : appConfig.focus.taskPresets;
  const finished = mode === 'time' ? elapsed >= minutes * 60 : done >= taskTarget;
  const display = mode === 'time' ? mmss(minutes * 60 - elapsed) : `${done} / ${taskTarget}`;

  /** 计时模式每秒累加；暂停 / 切模式 / 达标即停 */
  useEffect(() => {
    if (mode !== 'time' || !running) return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [mode, running]);

  /** 达标：弹窗提醒，关闭后回到待开始态 */
  useEffect(() => {
    if (!finished) return;
    setRunning(false);
    const reset = () => {
      setElapsed(0);
      setDone(0);
    };
    void notifyUser(
      mode === 'time' ? tr('专注完成') : tr('任务完成'),
      mode === 'time' ? trf('已完成 {n} 分钟专注。', { n: minutes }) : trf('已完成 {n} 个任务。', { n: taskTarget }),
    ).then(() => reset());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  /** 落定设定值：清零进度（不自动开始，开始 / 暂停由右下角按钮决定） */
  const applyValue = (value: number) => {
    if (mode === 'time') {
      setMinutes(value);
      setElapsed(0);
      setRunning(false);
    } else {
      setTaskTarget(value);
      setDone(0);
    }
  };

  const switchMode = (next: FocusMode) => {
    if (next === mode) return;
    setMode(next);
    setRunning(false);
    setElapsed(0);
    setDone(0);
  };

  const onPrimary = () => setRunning((r) => !r);

  /**
   * 重新计时 / 重新计数：把读数清零（`running` 不动 —— 正在计时时按它就是从 0 接着跑，
   * 相当于秒表回零重计；待开始态按它只是清零）。
   */
  const onReset = () => {
    setElapsed(0);
    setDone(0);
  };

  return (
    <Card style={[{ padding: 16, height: PANEL_CARD_HEIGHT, gap: ROW_GAP }, style]}>
      {/* 上块：设定区（四枚快捷预设等分卡片内宽，彼此隔 FIELD_GAP；数字 24px = lg 档，
          与打卡环内数值同口径） */}
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'stretch', gap: FIELD_GAP }}>
        {presets.map((value) => {
          const active = value === total;
          return (
            <Pressable
              key={value}
              onPress={() => applyValue(value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={mode === 'time' ? trf('{n} 分钟', { n: value }) : trf('{n} 个任务', { n: value })}
              style={{
                flex: 1,
                minWidth: 0,
                borderRadius: FIELD_RADIUS,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? theme.colors.brand : theme.colors.surface,
                borderWidth: stroke.base,
                borderColor: active ? theme.colors.brand : theme.colors.border,
              }}
            >
              <AppText kind="lg" color={active ? theme.colors.brandOn : theme.colors.text}>
                {String(value)}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {/* 下块：操作行（贴下内边距；两侧绝对定位不参与撑高） */}
      <View style={{ height: ROUND_BUTTON }}>
        {/* 左下角：秒表（计时）/ 计数器（计数） */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {MODES.map((key) => {
            const active = key === mode;
            const ModeIcon = key === 'time' ? StopwatchIcon : CounterIcon;
            return (
              <Pressable
                key={key}
                onPress={() => switchMode(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={key === 'time' ? tr('计时模式') : tr('计数模式')}
                style={{
                  width: ROUND_BUTTON,
                  height: ROUND_BUTTON,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? theme.colors.brand : 'transparent',
                  borderWidth: stroke.base,
                  borderColor: active ? theme.colors.brand : theme.colors.border,
                }}
              >
                <ModeIcon size={ROUND_ICON} color={active ? theme.colors.brandOn : theme.colors.textMuted} />
              </Pressable>
            );
          })}
        </View>

        {/* 居中：时间 / 计数 */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: DISPLAY_BADGE_W,
              height: DISPLAY_BADGE_H,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 999,
              backgroundColor: `${theme.colors.brand}2E`,
            }}
          >
            <AppText kind="lg" color={theme.colors.brand}>
              {display}
            </AppText>
          </View>
        </View>

        {/* 右下角：重新计时 / 重新计数（白底圆钮）+ 主操作（红底圆钮，两档通用 —— 开始 / 暂停） */}
        <View
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            flexDirection: 'row',
            alignItems: 'center',
            gap: ACTION_GAP,
          }}
        >
          <Pressable
            onPress={onReset}
            accessibilityRole="button"
            accessibilityLabel={mode === 'time' ? tr('重新计时') : tr('重新计数')}
            style={{
              width: ROUND_BUTTON,
              height: ROUND_BUTTON,
              borderRadius: 999,
              /* 白色实底：浅色主题下比卡片底（#EFEFEF）亮一档，深色主题取同级的抬升面 */
              backgroundColor: theme.colors.surfaceRaised,
              borderWidth: stroke.base,
              borderColor: theme.colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RefreshIcon size={ROUND_ICON} color={theme.colors.brand} />
          </Pressable>
          <Pressable
            onPress={onPrimary}
            accessibilityRole="button"
            accessibilityLabel={
              mode === 'time' ? (running ? tr('暂停计时') : tr('开始计时')) : running ? tr('暂停') : tr('开始')
            }
            style={{
              width: ROUND_BUTTON,
              height: ROUND_BUTTON,
              borderRadius: 999,
              backgroundColor: theme.colors.brand,
              borderWidth: stroke.base,
              borderColor: theme.colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {running ? (
              <PauseIcon size={ROUND_ICON - 3} color={theme.colors.brandOn} />
            ) : (
              <PlayIcon size={ROUND_ICON - 3} color={theme.colors.brandOn} />
            )}
          </Pressable>
        </View>
      </View>
    </Card>
  );
}
