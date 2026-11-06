import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Logo } from '@/components/icons';
import { AppText, Card, PageHeader, PrimaryButton, Screen } from '@/components/ui';
import { appConfig } from '@/config/appConfig';
import { privacySummary } from '@/content/legal';
import { listSep, trf } from '@/i18n';
import { useApp } from '@/store/AppStore';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * 隐私政策门禁页（FR-O-3）。
 * 未同意隐私政策时，拍照翻译与语音翻译不可用；点击对应功能会跳到这里。
 */
export default function PrivacyConsentScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { state, actions } = useApp();
  const accepted = state.settings.privacyAccepted;

  return (
    <Screen header={<PageHeader title="隐私政策确认" />} contentStyle={{ gap: 16 }}>

      <Card style={{ padding: 16, gap: 12, alignItems: 'center' }}>
        <Logo size={96} />
        <AppText kind="lg" color={theme.colors.text}>
          {accepted ? '已同意' : '尚未同意'}
        </AppText>
        <AppText kind="micro" color={theme.colors.textSecondary} align="center">
          {accepted
            ? '相机与麦克风相关功能已可用。'
            : trf('受限功能：{list}。确认后即可使用。', { list: appConfig.privacy.gatedFeatures.join(listSep()) })}
        </AppText>
      </Card>

      <Card style={{ padding: 16, gap: 8 }}>
        {privacySummary.map((line) => (
          <View key={line} style={{ flexDirection: 'row', gap: 6 }}>
            <AppText kind="micro" color={theme.colors.brand}>
              ·
            </AppText>
            <AppText kind="micro" color={theme.colors.textSecondary} style={{ flex: 1 }}>
              {line}
            </AppText>
          </View>
        ))}
      </Card>

      {!accepted ? (
        <PrimaryButton label="同意隐私政策" onPress={() => actions.acceptPrivacy()} />
      ) : null}
      <PrimaryButton label="阅读完整隐私政策" tone="ghost" onPress={() => router.push('/privacy' as never)} />
    </Screen>
  );
}
