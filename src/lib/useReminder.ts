import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { todayKey } from '@/domain/date';
import {
  configureReminderHandler,
  getReminderPermission,
  REMINDER_TARGET,
  syncDailyReminder,
  type ReminderPermission,
} from '@/lib/reminder';
import { useApp } from '@/store/AppStore';

/**
 * 根级提醒排程：把「开关 / 时间 / 今天是否达标 / 语言」的变化同步成本机通知。
 *
 * 排程是幂等的（先撤后排），所以调用次数多一点没关系；
 * 关键是**达标那一刻要重排一次**，这样才能撤掉今天那条（规则 2）。
 */
export function useReminderSync(): void {
  const { ready, state, todayQualified } = useApp();
  const { reminderEnabled, reminderHour, reminderMinute, locale } = state.settings;

  /** 前台事件里要拿到最新值，用 ref 兜住，避免反复重建监听 */
  const latest = useRef({ ready, reminderEnabled, reminderHour, reminderMinute, todayQualified });
  latest.current = { ready, reminderEnabled, reminderHour, reminderMinute, todayQualified };

  /** 上一次 sync 时的日期：跨天以后，store 里的 `todayQualified` 还是昨天的，不能拿来用 */
  const syncedDay = useRef(todayKey());

  const sync = useCallback(() => {
    const s = latest.current;
    if (!s.ready) return;
    const today = todayKey();
    const staleDay = syncedDay.current !== today;
    syncedDay.current = today;
    void syncDailyReminder({
      enabled: s.reminderEnabled,
      hour: s.reminderHour,
      minute: s.reminderMinute,
      /* 跨天时按「今天还没达标」处理：状态要是真达标了，等它下次变化会再排一次（宁可多排一条） */
      qualifiedToday: staleDay ? false : s.todayQualified,
    });
  }, []);

  useEffect(() => {
    configureReminderHandler();
  }, []);

  // 依赖变化即重排：开关、时间、是否达标、界面语言（通知文案跟着变）
  useEffect(() => {
    sync();
  }, [sync, ready, reminderEnabled, reminderHour, reminderMinute, todayQualified, locale]);

  /**
   * 回到前台再排一次：可能已跨天（昨天的「已达标」不能压住今天的提醒），
   * 也可能用户在系统设置里刚把权限关掉 / 打开。
   */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') sync();
    });
    return () => sub.remove();
  }, [sync]);
}

/** 设置页用：读系统通知权限（不弹窗），回前台时自动刷新 */
export function useReminderPermission(): {
  permission: ReminderPermission | null;
  refresh: () => void;
} {
  const [permission, setPermission] = useState<ReminderPermission | null>(null);

  const refresh = useCallback(() => {
    void getReminderPermission().then(setPermission);
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return { permission, refresh };
}

/**
 * 点开通知 → 回到练习页（本机通知的唯一去向）。
 * 冷启动时点通知也会走到这里：`expo-router` 已经就绪，直接 push 即可。
 */
export function useNotificationTap(): void {
  const router = useRouter();
  /** 冷启动的那一次响应会同时从「上一次响应」与「监听器」两个入口进来，用 id 去重 */
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const go = (id: string | undefined) => {
      if (!id || handled.current === id) return;
      handled.current = id;
      router.push(REMINDER_TARGET as never);
    };

    try {
      // 被通知拉起（进程原本不在）：响应在监听器挂上之前就到了，只能回头取一次
      void Notifications.getLastNotificationResponseAsync()
        .then((response) => go(response?.notification.request.identifier))
        .catch(() => {});

      const sub = Notifications.addNotificationResponseReceivedListener((response) => {
        go(response.notification.request.identifier);
      });
      return () => sub.remove();
    } catch {
      // 没有原生模块时静默跳过：点通知不跳转，其它功能不受影响
      return undefined;
    }
  }, [router]);
}
