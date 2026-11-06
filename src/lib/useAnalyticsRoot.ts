import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import {
  endSession,
  ensureSession,
  initAnalytics,
  resumeSession,
  screenLabelOf,
  setAnalyticsEnabled,
  startSession,
  trackScreen,
} from '@/lib/analytics';
import { useApp } from '@/store/AppStore';

/**
 * 根级埋点：会话、页面停留、前后台切换（NFR-6）。
 *
 * 挂在 `_layout` 的 Root 里，页面自己不用再写一行代码就有：
 * - 冷启动一段会话（`app_open`，带版本 / 平台 / 语言）；
 * - 每次切页成对写 `screen_view` / `screen_leave`，停留时长由这两条配对算出；
 * - 切到后台结算当前页并落盘，回到前台重新开始计时。
 *
 * 采集受两道开关约束：用户设置里的「使用数据统计」+ 是否已同意隐私政策。
 */
export function useAnalyticsRoot(): void {
  const pathname = usePathname();
  const { state } = useApp();
  const { analyticsEnabled, privacyAccepted, locale } = state.settings;

  /** 用 ref 拿最新的路径与语言，避免把挂载期的初始化逻辑绑到它们的每次变化上 */
  const pathRef = useRef(pathname);
  const localeRef = useRef(locale);
  pathRef.current = pathname;
  localeRef.current = locale;

  /**
   * 开关：未同意隐私政策时一律不采（与相机 / 麦克风的门槛同一口径，NFR-5）。
   * 打开时补一段会话 —— 冷启动那一刻开关还是关的，`app_open` 已经被丢掉，
   * 不补的话概览里「会话数 / 平均会话」会一直是 0。
   */
  useEffect(() => {
    const on = analyticsEnabled && privacyAccepted;
    setAnalyticsEnabled(on);
    if (on) ensureSession(localeRef.current);
  }, [analyticsEnabled, privacyAccepted]);

  // 冷启动：读回上次队列 → 开一段会话；退出时结算最后一段停留
  useEffect(() => {
    void initAnalytics();
    startSession(localeRef.current);

    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        // 回到前台：重新开始计前台时间，并重新开一段当前页的停留
        resumeSession();
        trackScreen(screenLabelOf(pathRef.current));
      } else {
        endSession();
      }
    });
    return () => {
      sub.remove();
      endSession();
    };
  }, []);

  // 切页：同一个页面重复触发是空操作（见 trackScreen 的去重）
  useEffect(() => {
    trackScreen(screenLabelOf(pathname));
  }, [pathname]);
}
