import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import { appConfig } from '@/config/appConfig';
import { addDays, todayKey } from '@/domain/date';
import { tr } from '@/i18n';

/**
 * 每日练习提醒（FR-N-1）—— 本机通知，无服务端。
 *
 * 三条规则（也是这个模块的全部职责）：
 * 1. **当天未达标才发**：排程时就跳过「今天已达标」，并只排未来 `scheduleDays` 天；
 *    回到前台 / 达标 / 改时间时重排，所以「今天练够了」那一刻当天那条会被撤掉。
 * 2. **达标不发**：同上 —— 没有「到点再判断」的能力，本机通知只能在排程时判断，
 *    因此用「重排」代替「到点判断」，宁可撤掉也不误发。
 * 3. **权限被拒不反复弹窗**：系统弹窗只由用户在设置页打开开关这一动作触发，
 *    且只触发一次（`settings.reminderAsked`）；被拒后只给说明与「去系统设置」。
 */

/** 系统权限的三态 + 网页版（不支持本地通知） */
export type ReminderPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

/** Android 通知渠道 id：同一渠道的通知在系统设置里可以整体关掉 */
const CHANNEL_ID = 'daily-practice';

/** 自己排的通知在这条数据里打标：撤旧排程、点击跳转都按它认领 */
const NOTIFICATION_TAG = 'daily-reminder';

const isWeb = Platform.OS === 'web';

/**
 * 前台收到通知时也照常展示（应用正在使用时不弹横幅会让人以为提醒坏了）。
 * 只在原生端设置；web 没有通知中心，跳过。
 */
export function configureReminderHandler(): void {
  if (isWeb) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        // 提醒不该打断正在进行的练习：不响铃、不亮角标
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // 缺少原生模块（例如老的 Expo Go）时降级为「没有提醒」，不影响其它功能
  }
}

function toPermission(status: string): ReminderPermission {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

/** 读当前权限（不弹窗） */
export async function getReminderPermission(): Promise<ReminderPermission> {
  if (isWeb) return 'unsupported';
  try {
    const status = await Notifications.getPermissionsAsync();
    return toPermission(status.status);
  } catch {
    return 'unsupported';
  }
}

/**
 * 请求权限。**只应在用户主动打开提醒开关时调用一次**（见设置页），
 * 不要在启动 / 进设置页时调用 —— 那是「反复弹窗」的来源。
 */
export async function requestReminderPermission(): Promise<ReminderPermission> {
  if (isWeb) return 'unsupported';
  try {
    const status = await Notifications.requestPermissionsAsync();
    return toPermission(status.status);
  } catch {
    return 'denied';
  }
}

/** 打开系统的应用设置页（权限被拒后唯一的出路） */
export function openSystemSettings(): void {
  if (isWeb) return;
  void Linking.openSettings().catch(() => {});
}

/** 撤掉本模块排过的全部通知（别的通知不受影响） */
export async function cancelDailyReminder(): Promise<void> {
  if (isWeb) return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const mine = scheduled.filter(
      (n) => (n.content.data as { tag?: string } | null)?.tag === NOTIFICATION_TAG,
    );
    await Promise.all(
      mine.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})),
    );
  } catch {
    // 撤不掉不影响别的：下次排程会先再撤一次
  }
}

/** Android 需要先建渠道，通知才会按预期出现（无声、默认优先级） */
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: tr('每日练习通知'),
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: null,
      vibrationPattern: null,
      showBadge: false,
    });
  } catch {
    // 渠道建不出来时仍按系统默认渠道发，不阻塞排程
  }
}

export interface ReminderScheduleInput {
  enabled: boolean;
  hour: number;
  minute: number;
  /** 今天是否已达标（含进行中的会话）；已达标则不给今天排 */
  qualifiedToday: boolean;
}

/**
 * 重排未来几天的提醒（先撤后排，幂等）：
 * - 关闭提醒 → 只撤不排；
 * - 今天已达标 → 今天那条不排，从明天开始；
 * - 已经过了今天的提醒时间 → 今天那条也不排（排了也不会触发）。
 *
 * 每天都用一次性触发（不是 repeats: daily）：只有一次性触发才能被单独撤掉，
 * 「今天达标 → 撤掉今天那条」才成立。
 */
export async function syncDailyReminder(input: ReminderScheduleInput): Promise<void> {
  if (isWeb) return;
  await cancelDailyReminder();
  if (!input.enabled) return;

  await ensureChannel();

  const now = Date.now();
  const base = todayKey();
  const days = Math.max(1, appConfig.reminder.scheduleDays);

  for (let i = 0; i < days; i += 1) {
    const key = addDays(base, i);
    if (i === 0 && input.qualifiedToday) continue;

    const [y, m, d] = key.split('-').map(Number);
    const fireAt = new Date(y, m - 1, d, input.hour, input.minute, 0, 0);
    if (fireAt.getTime() <= now) continue;

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: tr('今日练习还没完成'),
          body: tr('练几分钟就算达标，现在继续。'),
          data: { tag: NOTIFICATION_TAG, url: '/exercise' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
          channelId: CHANNEL_ID,
        },
      });
    } catch {
      // 单条排不上（权限被撤、系统限额）就跳过，不影响其余日期
    }
  }
}

/** 通知被点开时跳去哪：目前只有练习提醒，统一回到练习页 */
export const REMINDER_TARGET = '/exercise';
