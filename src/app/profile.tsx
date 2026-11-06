import React, { useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';

import { AppText, Card, Divider, PageHeader, PrimaryButton, Screen, SectionTitle } from '@/components/ui';
import { levels } from '@/config/appConfig';
import { tr, trf } from '@/i18n';
import { useFocusPlaceholder } from '@/lib/focusPlaceholder';
import { useApp } from '@/store/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { inputFont } from '@/theme/fonts';
import { layout, stroke } from '@/theme/tokens';

/**
 * 个人资料（FR-O-1 / FR-A-2）。
 * ID 由系统生成、不可修改，提供复制按钮；昵称 2-16 字符，允许中英文与数字；头像可从相册选择。
 * 修改后立即保存并同步到其他设备；昵称重复时允许保存。
 */
export default function ProfileScreen() {
  const theme = useTheme();
  const { state, actions } = useApp();
  const [nickname, setNickname] = useState(state.profile.nickname);
  const nicknameValid = nickname.trim().length >= 2 && nickname.trim().length <= 16;
  /** 昵称输入框的占位提示：聚焦后即隐（全 App 统一口径） */
  const nicknameHint = useFocusPlaceholder(tr('输入昵称'));

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(tr('需要相册权限'), tr('请在系统设置中允许 Wordbout 访问相册，用于选择头像。'));
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) {
      actions.updateProfile({ avatarUri: res.assets[0].uri });
    }
  };

  return (
    <Screen header={<PageHeader title="个人资料" />} contentStyle={{ gap: 18 }}>
      <Card style={{ padding: 16, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 999,
              backgroundColor: theme.colors.surfaceSunken,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AppText kind="lg" color={theme.colors.brand}>
              {state.profile.nickname.slice(0, 2).toUpperCase()}
            </AppText>
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <AppText kind="micro" color={theme.colors.textMuted}>
              头像
            </AppText>
            <PrimaryButton label="从相册选择" tone="ghost" onPress={pickAvatar} style={{ minHeight: 40 }} />
            {state.profile.avatarUri ? (
              <AppText kind="micro" color={theme.colors.textMuted} numberOfLines={1}>
                {state.profile.avatarUri}
              </AppText>
            ) : null}
          </View>
        </View>
        <Divider />
        <View style={{ gap: 6 }}>
          <AppText kind="micro" color={theme.colors.textMuted}>
            昵称（2 - 16 个字符，允许中英文与数字）
          </AppText>
          <TextInput
            value={nickname}
            onChangeText={setNickname}
            {...nicknameHint}
            placeholderTextColor={theme.colors.textMuted}
            accessibilityLabel={tr('昵称')}
            style={{
              borderWidth: stroke.base,
              borderColor: nicknameValid ? theme.colors.border : theme.colors.brand,
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
          <AppText kind="micro" color={nicknameValid ? theme.colors.textMuted : theme.colors.brand}>
            {nicknameValid ? trf('{n} / 16 字符', { n: nickname.trim().length }) : '昵称需 2-16 个字符'}
          </AppText>
          <PrimaryButton
            label="保存昵称"
            disabled={!nicknameValid || nickname === state.profile.nickname}
            onPress={() => actions.updateProfile({ nickname: nickname.trim() })}
          />
        </View>
      </Card>

      <View style={{ gap: 10 }}>
        <SectionTitle label="账号" />
        <Card style={{ padding: 16, gap: 16 }}>
          <View style={{ gap: 6 }}>
            <AppText kind="micro" color={theme.colors.textMuted}>
              唯一 ID（只读）
            </AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <AppText kind="md" color={theme.colors.text}>
                {state.profile.id}
              </AppText>
              <PrimaryButton
                label="复制"
                tone="ghost"
                onPress={async () => {
                  await Clipboard.setStringAsync(state.profile.id);
                  Alert.alert(tr('已复制'), state.profile.id);
                }}
                style={{ minHeight: 34, paddingHorizontal: 14 }}
              />
            </View>
          </View>
          <Divider />
          <View style={{ gap: 6 }}>
            <AppText kind="micro" color={theme.colors.textMuted}>
              当前训练题库
            </AppText>
            <AppText kind="sm" color={theme.colors.text}>
              {levels.find((l) => l.id === state.levelId)?.labelZh ?? state.levelId}
            </AppText>
          </View>
        </Card>
      </View>
    </Screen>
  );
}
