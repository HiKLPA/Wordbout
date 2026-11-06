import React, { useEffect, useRef, useState } from 'react';
import { Platform, TextInput, View } from 'react-native';

import { Toggle } from '@/components/Toggle';
import { MoonIcon, SunIcon } from '@/components/icons';
import {
  AppText,
  Card,
  OptionChips,
  PageHeader,
  PrimaryButton,
  Screen,
  SectionTitle,
  useScreenScroll,
} from '@/components/ui';
import { appConfig } from '@/config/appConfig';
import { aiCacheBytes, clearAiCache } from '@/data/aiExplore';
import { tr, trf } from '@/i18n';
import { useFocusPlaceholder } from '@/lib/focusPlaceholder';
import { inputFont } from '@/theme/fonts';
import { FONT_SCALE_LABELS, layout, opacity, stroke } from '@/theme/tokens';
import { useApp } from '@/store/AppStore';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * 功能设置面板（FR-O-2）。
 * 所有设置项修改后立即全局生效、不需要重启；设置保存在账号级，换设备保持一致。
 */
export default function SettingsScreen() {
  const theme = useTheme();
  const { state, actions } = useApp();
  const s = state.settings;
  const screenScroll = useScreenScroll();
  const timeInputRef = useRef<TextInput>(null);
  /** 提醒时间输入草稿（null = 未在编辑，显示已保存值） */
  const [timeDraft, setTimeDraft] = useState<string | null>(null);
  const savedTime = formatTime(s.reminderHour, s.reminderMinute);
  const timeText = timeDraft ?? savedTime;
  /** 草稿非法时边框转品牌红，失焦自动回退到已保存值 */
  const timeValid = parseTime(timeText) !== null;
  /** 时间输入框的占位提示（08:00）：聚焦后即隐（全 App 统一口径） */
  const timeHint = useFocusPlaceholder('08:00');

  const commitTime = () => {
    const parsed = parseTime(timeText);
    if (parsed) {
      actions.updateSettings({ reminderHour: parsed.hour, reminderMinute: parsed.minute });
    }
    setTimeDraft(null);
  };

  /** 键盘弹出后把时间输入框滚到键盘上方，避免被遮挡（键盘动画结束后再补一次） */
  const keepTimeInputVisible = () => {
    const input = timeInputRef.current;
    if (!input) return;
    screenScroll?.keepVisible(input);
    setTimeout(() => screenScroll?.keepVisible(input), 260);
  };

  /** 答案缓存占用的字节数（null = 还在统计，先显示占位） */
  const [cacheBytes, setCacheBytes] = useState<number | null>(null);

  // 进页面统计一次缓存大小；异步读存储，不阻塞首屏
  useEffect(() => {
    let alive = true;
    void aiCacheBytes().then((bytes) => {
      if (alive) setCacheBytes(bytes);
    });
    return () => {
      alive = false;
    };
  }, []);

  /**
   * 清空答案缓存（AI 探索的解答结果）。学习记录与历史对话都不受影响，
   * 所以不做二次确认 —— 清完直接把显示的数归零，不必再读一次存储。
   */
  const clearCache = () => {
    void clearAiCache().then(() => setCacheBytes(0));
  };

  /**
   * 缓存大小文案（MB）。答案缓存本来就不大（几十到几百 KB），所以：
   * 空缓存固定显示 `0.0`，非零时**至少显示 0.01** —— 否则问完一句 AI 仍显示 `0.00 MB`，
   * 看起来像没生效；其余按两位小数。
   */
  const cacheSizeText =
    cacheBytes === null
      ? '--'
      : cacheBytes === 0
        ? '0.0'
        : Math.max(cacheBytes / (1024 * 1024), 0.01).toFixed(2);

  return (
    <Screen header={<PageHeader title="设置" />} contentStyle={{ gap: 20 }}>
      <View style={{ gap: 10 }}>
        <SectionTitle label="显示" />
        {/* 卡内内边距统一 16；块之间（行之间）16、行内 8 */}
        <Card style={{ padding: 16, gap: 16 }}>
          <View style={{ gap: 8 }}>
            <AppText kind="md" color={theme.colors.text}>
              字号
            </AppText>
            <OptionChips
              options={[0, 1, 2] as const}
              value={s.fontScaleIndex}
              onChange={(v) => actions.updateSettings({ fontScaleIndex: v })}
              labelOf={(v) => FONT_SCALE_LABELS[v]}
              accessibilityLabel={tr('字号档位')}
              stretch
              plainInactive
              inactiveColor={theme.colors.textSecondary}
            />
          </View>
          <View style={{ gap: 8 }}>
            <AppText kind="md" color={theme.colors.text}>
              深浅色模式
            </AppText>
            {/* 三档里「浅 / 深」用太阳 / 月亮图标代替文字（图标 22 = sm 行高，胶囊高度与文字档一致）；
                「自动」没有对应图标，仍显示文字；选中态图标转白（与选中胶囊的品牌红底同源），
                未选中态与另两组一样弱化成次级色（`textSecondary`） */}
            <OptionChips
              options={['system', 'light', 'dark'] as const}
              value={s.colorScheme}
              onChange={(v) => actions.updateSettings({ colorScheme: v })}
              labelOf={(v) => (v === 'system' ? '自动' : v === 'light' ? '浅' : '深')}
              iconOf={(v) =>
                v === 'system' ? null : v === 'light' ? (
                  <SunIcon
                    size={22}
                    color={s.colorScheme === v ? theme.colors.brandOn : theme.colors.textSecondary}
                  />
                ) : (
                  <MoonIcon
                    size={22}
                    color={s.colorScheme === v ? theme.colors.brandOn : theme.colors.textSecondary}
                  />
                )
              }
              accessibilityLabel={tr('深浅色模式')}
              stretch
              plainInactive
              inactiveColor={theme.colors.textSecondary}
            />
          </View>
          <View style={{ gap: 8 }}>
            <AppText kind="md" color={theme.colors.text}>
              语言
            </AppText>
            <OptionChips
              options={appConfig.i18n.supported}
              value={s.locale}
              onChange={(v) => actions.updateSettings({ locale: v })}
              labelOf={(v) => (v === 'en' ? 'ENG' : v === 'zh-Hans' ? '简' : '繁')}
              accessibilityLabel={tr('语言')}
              stretch
              plainInactive
              inactiveColor={theme.colors.textSecondary}
            />
          </View>
        </Card>
      </View>

      <View style={{ gap: 10 }}>
        <SectionTitle label="提醒" />
        <Card style={{ padding: 16, gap: 16 }}>
          {/* 行内不做上下内边距；行与行之间只靠卡片的 gap 8 分隔 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <AppText kind="md" color={theme.colors.text}>
                每日练习通知
              </AppText>
            </View>
            <Toggle
              value={s.reminderEnabled}
              onValueChange={(v) => actions.updateSettings({ reminderEnabled: v })}
              accessibilityLabel={tr('每日练习通知')}
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <AppText kind="md" color={theme.colors.text}>
                定时
              </AppText>
            </View>
            {/* 未开启提醒时不可编辑，视觉上同时弱化（连描边一起淡出，所以透明度放在外层） */}
            <View style={{ opacity: s.reminderEnabled ? 1 : opacity.disabled }}>
              <TextInput
                ref={timeInputRef}
                value={timeText}
                editable={s.reminderEnabled}
                // 占位提示（08:00）聚焦即隐；下面两个焦点事件自己处理，所以摊在前面、由它们覆盖
                {...timeHint}
                // 聚焦：收起占位提示（见上）+ 把输入框滚到键盘上方
                onFocus={() => {
                  timeHint.onFocus();
                  keepTimeInputVisible();
                }}
                onChangeText={(t) => setTimeDraft(t.replace(/[^\d:：]/g, '').slice(0, 5))}
                // 失焦：收起占位提示 + 提交草稿
                onBlur={() => {
                  timeHint.onBlur();
                  commitTime();
                }}
                onSubmitEditing={commitTime}
                returnKeyType="done"
                maxLength={5}
                placeholderTextColor={theme.colors.textMuted}
                keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'number-pad'}
                accessibilityLabel={tr('定时')}
                accessibilityState={{ disabled: !s.reminderEnabled }}
                style={{
                  width: 92,
                  height: 40,
                  textAlign: 'center',
                  textAlignVertical: 'center',
                  paddingVertical: 0,
                  // 输入框统一内边距 16
                  paddingHorizontal: layout.inputPad,
                  includeFontPadding: false,
                  borderWidth: stroke.base,
                  borderColor: timeValid ? theme.colors.border : theme.colors.brand,
                  borderRadius: 999,
                  color: theme.colors.text,
                  fontFamily: inputFont('extraBold'),
                  fontSize: theme.size(16),
                  backgroundColor: theme.colors.surface,
                }}
              />
            </View>
          </View>
        </Card>
      </View>

      <View style={{ gap: 10 }}>
        <SectionTitle label="无障碍" />
        <Card style={{ padding: 16, gap: 16 }}>
          {/* 两行开关之间不再画分割线，行内也不做上下内边距：只靠卡片的 gap 8 拉开 */}
          {[
            { key: 'highContrast' as const, label: '高对比度' },
            { key: 'reduceMotion' as const, label: '精简动画' },
          ].map((item) => (
            <View key={item.key}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <AppText kind="md" color={theme.colors.text}>
                    {item.label}
                  </AppText>
                </View>
                <Toggle
                  value={s[item.key]}
                  onValueChange={(v) =>
                    actions.updateSettings(
                      item.key === 'highContrast' ? { highContrast: v } : { reduceMotion: v },
                    )
                  }
                  accessibilityLabel={tr(item.label)}
                />
              </View>
            </View>
          ))}
        </Card>
      </View>

      {/* 存储：清掉可再生的答案缓存（AI 探索中已问过的问题的结果），学习记录与历史对话都不动 */}
      <View style={{ gap: 10 }}>
        <SectionTitle label="存储" />
        <PrimaryButton
          label={trf('清除缓存（{size} MB）', { size: cacheSizeText })}
          tone="danger"
          onPress={clearCache}
          accessibilityLabel={tr('清除缓存')}
        />
      </View>
    </Screen>
  );
}

/** 24 小时制显示：08:00 */
function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** 解析自定义时间：8 / 8:00 / 08:00 / 800 / 2130 / 21:30；非法返回 null */
function parseTime(text: string): { hour: number; minute: number } | null {
  const raw = text.replace(/[：:]/g, ':').replace(/\s/g, '');
  if (!raw) return null;
  const colon = raw.indexOf(':');
  let hourPart: string;
  let minutePart: string;
  if (colon >= 0) {
    hourPart = raw.slice(0, colon);
    minutePart = raw.slice(colon + 1);
  } else {
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 1 || digits.length > 4) return null;
    // 纯数字按「小时 + 两位分钟」拆分：800 → 8:00，2130 → 21:30
    if (digits.length <= 2) {
      hourPart = digits;
      minutePart = '0';
    } else {
      hourPart = digits.slice(0, digits.length - 2);
      minutePart = digits.slice(-2);
    }
  }
  if (!/^\d{1,2}$/.test(hourPart) || !/^\d{1,2}$/.test(minutePart)) return null;
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}
