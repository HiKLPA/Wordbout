import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo } from '@/components/icons';
import { AppText, Card, PrimaryButton, SCREEN_TOP_GAP } from '@/components/ui';
import { privacySummary } from '@/content/legal';
import { tr } from '@/i18n';
import { useFocusPlaceholder } from '@/lib/focusPlaceholder';
import { useApp } from '@/store/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { inputFont } from '@/theme/fonts';
import { layout, stroke } from '@/theme/tokens';

/**
 * 引导页 + 隐私政策确认 + 三种进入方式（FR-A-1 / FR-O-3）。
 * 「暂不同意」可以继续使用，但拍照翻译与语音翻译保持不可用。
 */
export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { actions } = useApp();
  const [mode, setMode] = useState<'intro' | 'phone'>('intro');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  /** 两枚输入框的占位提示：聚焦后即隐（全 App 统一口径） */
  const phoneHint = useFocusPlaceholder(tr('输入手机号'));
  const codeHint = useFocusPlaceholder(tr('6 位验证码'));

  const enter = (accepted: boolean, method: 'qr' | 'phone' | 'guest', nickname?: string) => {
    actions.completeOnboarding({ accepted, method, nickname });
    router.replace('/');
  };

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + SCREEN_TOP_GAP,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: layout.pagePadding,
        gap: 20,
      }}
    >
      <View style={{ alignItems: 'center', gap: 12 }}>
        <Logo size={128} />
        <AppText kind="xl" color={theme.colors.text}>
          Wordbout
        </AppText>
        <AppText kind="micro" color={theme.colors.textSecondary} align="center">
          查 · 练 · 积 —— 每天十几分钟，完成一轮有效训练
        </AppText>
      </View>

      <Card style={{ padding: 16, gap: 10 }}>
        <AppText kind="md" color={theme.colors.text}>
          隐私政策摘要
        </AppText>
        {privacySummary.map((line) => (
          <View key={line} style={{ flexDirection: 'row', gap: 8 }}>
            <AppText kind="micro" color={theme.colors.brand}>
              ·
            </AppText>
            <AppText kind="micro" color={theme.colors.textSecondary} style={{ flex: 1 }}>
              {line}
            </AppText>
          </View>
        ))}
        <Pressable onPress={() => router.push('/privacy' as never)} accessibilityRole="link">
          <AppText kind="micro" color={theme.colors.brand}>
            阅读完整隐私政策与用户协议 →
          </AppText>
        </Pressable>
      </Card>

      {mode === 'intro' ? (
        <View style={{ gap: 12 }}>
          <PrimaryButton label="同意隐私政策并继续" onPress={() => enter(true, 'guest')} />
          <PrimaryButton label="扫码登录" tone="ghost" onPress={() => enter(true, 'qr')} />
          <PrimaryButton label="手机号验证码登录" tone="ghost" onPress={() => setMode('phone')} />
          <PrimaryButton label="游客试用（不同步记录）" tone="ghost" onPress={() => enter(false, 'guest')} />
          <AppText kind="micro" color={theme.colors.textMuted} align="center">
            选择游客试用即表示暂不同意隐私政策，拍照翻译与语音翻译在同意前不可使用。
          </AppText>
        </View>
      ) : (
        <Card style={{ padding: 16, gap: 12 }}>
          <AppText kind="md" color={theme.colors.text}>
            手机号验证码登录
          </AppText>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            {...phoneHint}
            placeholderTextColor={theme.colors.textMuted}
            accessibilityLabel={tr('手机号')}
            style={{
              borderWidth: stroke.base,
              borderColor: theme.colors.border,
              borderRadius: 999,
              // 输入框统一内边距 16
              paddingHorizontal: layout.inputPad,
              minHeight: 48,
              color: theme.colors.text,
              fontFamily: inputFont('bold'),
              fontSize: theme.size(16),
              backgroundColor: theme.colors.surface,
            }}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <TextInput
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                {...codeHint}
                placeholderTextColor={theme.colors.textMuted}
                accessibilityLabel={tr('验证码')}
                style={{
                  borderWidth: stroke.base,
                  borderColor: theme.colors.border,
                  borderRadius: 999,
                  // 输入框统一内边距 16
                  paddingHorizontal: layout.inputPad,
              minHeight: 48,
              color: theme.colors.text,
              fontFamily: inputFont('bold'),
              fontSize: theme.size(16),
              backgroundColor: theme.colors.surface,
            }}
              />
            </View>
            <PrimaryButton label={sent ? '已发送' : '获取验证码'} tone="ghost" onPress={() => setSent(true)} style={{ minHeight: 48 }} />
          </View>
          <PrimaryButton
            label="登录并继续"
            disabled={phone.length < 6 || code.length < 4}
            onPress={() => enter(true, 'phone')}
          />
          <PrimaryButton label="返回" tone="ghost" onPress={() => setMode('intro')} />
        </Card>
      )}
      </ScrollView>
    </>
  );
}
