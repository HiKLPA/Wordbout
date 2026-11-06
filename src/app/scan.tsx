import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';

import { askDialog } from '@/components/AppDialog';
import {
  AppText,
  Card,
  Divider,
  EmptyState,
  FOOTER_BUTTON_HEIGHT,
  FooterBar,
  PageHeader,
  PrimaryButton,
  Screen,
} from '@/components/ui';
import { recognizeTextFromImage, translateWithDictionary, type TranslationResult } from '@/data/translate';
import { useApp } from '@/store/AppStore';
import { useTheme } from '@/theme/ThemeProvider';

/** 底部固定条按钮几何：一行放下两枚，与「积累」「练习」的底栏同一套（等宽、等高） */
const FOOTER_BTN = {
  flex: 1,
  minHeight: FOOTER_BUTTON_HEIGHT,
  height: FOOTER_BUTTON_HEIGHT,
  paddingHorizontal: 8,
};

/**
 * 拍照翻译（FR-M-3）。
 * 调用系统相机拍摄，也支持从相册选择；先做文字识别再翻译，原文与译文分层显示。
 * 照片不上传云端、不保存到本地（只留内存引用，退出本页即丢弃）；未同意隐私政策时不可用。
 * 操作按钮固定在底栏：未同意政策时是两枚授权按钮，否则是「从相册选择 / 拍照」。
 * 还没拿到照片时，页面正中给出空态提示（没有可滚动内容，所以居中而不是贴顶）。
 */
export default function ScanScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { state, actions } = useApp();
  const [original, setOriginal] = useState<string[]>([]);
  const [results, setResults] = useState<TranslationResult[]>([]);
  const [failed, setFailed] = useState(false);

  const gated = !state.settings.privacyAccepted;

  // 原图默认不保存到本地：离开页面即丢弃引用，并停掉可能还在播的朗读
  useEffect(() => () => {
    Speech.stop();
  }, []);

  const run = (seed: string) => {
    const { lines, failed: fail } = recognizeTextFromImage(seed);
    setFailed(fail);
    setOriginal(lines);
    setResults(lines.map((l) => translateWithDictionary(l, 'en')));
  };

  const pick = async (from: 'camera' | 'library') => {
    const perm =
      from === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      void askDialog({
        title: from === 'camera' ? '需要相机权限' : '需要相册权限',
        message: '拍照翻译需要在使用时授权。你可以在系统设置中开启，授权只在使用期间生效，不会驻留。',
        actions: [
          { id: 'later', label: '稍后再说', tone: 'cancel' },
          { id: 'settings', label: '去设置' },
        ],
      }).then((picked) => {
        if (picked === 'settings') void Linking.openSettings();
      });
      return;
    }
    const res =
      from === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (res.canceled || !res.assets[0]) return;
    run(res.assets[0].uri);
  };

  return (
    <Screen
      header={<PageHeader title="拍照翻译" />}
      contentStyle={{ flexGrow: 1, gap: 16 }}
      footer={
        gated ? (
          <FooterBar>
            <PrimaryButton
              style={FOOTER_BTN}
              label="去确认隐私政策"
              onPress={() => router.push('/privacy' as never)}
            />
            <PrimaryButton
              style={FOOTER_BTN}
              label="直接同意并启用"
              tone="ghost"
              onPress={() => actions.acceptPrivacy()}
            />
          </FooterBar>
        ) : (
          <FooterBar>
            <PrimaryButton
              style={FOOTER_BTN}
              label="从相册选择"
              tone="ghost"
              onPress={() => pick('library')}
            />
            <PrimaryButton style={FOOTER_BTN} label="拍照" onPress={() => pick('camera')} />
          </FooterBar>
        )
      }
    >
      {gated ? (
        <Card style={{ padding: 16, gap: 10 }}>
          <AppText kind="md" color={theme.colors.brand}>
            需先同意隐私政策
          </AppText>
          <AppText kind="micro" color={theme.colors.textSecondary}>
            拍照翻译涉及相机权限。未确认隐私政策前，本功能与语音翻译不可使用；其余功能不受影响。
          </AppText>
        </Card>
      ) : failed ? (
        <Card style={{ padding: 16, gap: 10 }}>
          <AppText kind="md" color={theme.colors.brand}>
            识别失败，请重拍
          </AppText>
          <AppText kind="micro" color={theme.colors.textSecondary}>
            未能识别出文字区域。请保证光线充足、文字清晰、正对拍摄，或换一张照片。
          </AppText>
        </Card>
      ) : original.length > 0 ? (
        <Card style={{ padding: 16, gap: 12 }}>
          <AppText kind="micro" color={theme.colors.textMuted}>
            原文与译文分层
          </AppText>
          {original.map((line, i) => {
            const r = results[i];
            return (
              <View key={`${line}-${i}`} style={{ gap: 4 }}>
                {i > 0 ? <Divider /> : null}
                <AppText kind="micro" color={theme.colors.textMuted}>
                  {line}
                </AppText>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <AppText kind="body" color={theme.colors.text} style={{ flex: 1 }}>
                    {r?.target ?? ''}
                  </AppText>
                  <PrimaryButton
                    label="朗读"
                    tone="ghost"
                    onPress={() => Speech.speak(line, { language: 'en-US', rate: 0.95 })}
                    style={{ minHeight: 30, paddingHorizontal: 10 }}
                  />
                </View>
              </View>
            );
          })}
        </Card>
      ) : (
        /* 空态：还没有照片，页面正中提示可以从哪里取图（提示本身不可点，操作仍在底栏） */
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState title="暂无照片" hint="可选择拍照 / 从相册选择" />
        </View>
      )}
    </Screen>
  );
}
