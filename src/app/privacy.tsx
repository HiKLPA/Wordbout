import React from 'react';
import { View } from 'react-native';

import { AppText, Card, PageHeader, Screen, SectionTitle } from '@/components/ui';
import { privacyPolicy, userAgreement } from '@/content/legal';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * 隐私政策与用户协议（FR-O-3）。
 * 仅展示正文；同意入口在引导页与首次使用受限功能（拍照翻译 / 语音翻译）时。
 */
export default function PrivacyScreen() {
  const theme = useTheme();

  return (
    <Screen header={<PageHeader title="隐私与协议" />} contentStyle={{ gap: 18 }}>
      <View style={{ gap: 8 }}>
        <SectionTitle label="隐私政策条款" />
        <Card style={{ padding: 16, gap: 8 }}>
          {privacyPolicy.map((sec) => (
            <View key={sec.title} style={{ gap: 4 }}>
              <AppText kind="sm" color={theme.colors.text}>
                {sec.title}
              </AppText>
              <AppText kind="micro" color={theme.colors.textSecondary}>
                {sec.body}
              </AppText>
            </View>
          ))}
        </Card>
      </View>

      <View style={{ gap: 8 }}>
        <SectionTitle label="用户协议条款" />
        <Card style={{ padding: 16, gap: 8 }}>
          {userAgreement.map((sec) => (
            <View key={sec.title} style={{ gap: 4 }}>
              <AppText kind="sm" color={theme.colors.text}>
                {sec.title}
              </AppText>
              <AppText kind="micro" color={theme.colors.textSecondary}>
                {sec.body}
              </AppText>
            </View>
          ))}
        </Card>
      </View>
    </Screen>
  );
}
