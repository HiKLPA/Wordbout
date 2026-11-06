import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DialogHost } from '@/components/AppDialog';
import { useAnalyticsRoot } from '@/lib/useAnalyticsRoot';
import { useNotificationTap, useReminderSync } from '@/lib/useReminder';
import { AppStoreProvider, useApp } from '@/store/AppStore';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { useAppFonts } from '@/theme/fonts';

void SplashScreen.preventAutoHideAsync();

/** 二级页面转场时长（ms）。原生默认 500，调小让滑入滑出更快（仅 iOS 生效，Android 由系统固定时长驱动）。 */
const TRANSITION_MS = 240;

/** 首次启动引导：未走过引导页时进入 onboarding（FR-A-1 / FR-O-3） */
function OnboardingGate() {
  const { ready, state } = useApp();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!ready) return;
    const onOnboarding = segments[0] === 'onboarding';
    if (!state.settings.onboarded && !onOnboarding) router.replace('/onboarding' as never);
  }, [ready, segments, state.settings.onboarded, router]);

  return null;
}

function ThemedStack() {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.bg },
          animation: theme.reduceMotion ? 'none' : 'slide_from_right',
          animationDuration: TRANSITION_MS,
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ animation: 'fade', animationDuration: TRANSITION_MS }} />
        <Stack.Screen name="practice/[typeId]" />
        <Stack.Screen name="accumulation" />
        <Stack.Screen name="sets/[board]" />
        <Stack.Screen name="attempt/[id]" />
        <Stack.Screen name="library/[bookId]" />
        <Stack.Screen name="favorites/[folderId]" />
        <Stack.Screen name="folders" />
        <Stack.Screen name="query-table" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="privacy-consent" />
        <Stack.Screen name="about" />
        <Stack.Screen name="stats" />
        <Stack.Screen name="practice-calendar" />
        <Stack.Screen name="analytics" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="translate" />
        <Stack.Screen name="scan" />
        <Stack.Screen name="voice" />
        <Stack.Screen name="qr-login" />
      </Stack>
      <OnboardingGate />
      {/* 全局确认 / 提示面板：web 上 Alert 是空实现，所有二次确认都走这里 */}
      <DialogHost />
    </View>
  );
}

function Root() {
  const { ready } = useApp();
  const fontsLoaded = useAppFonts();
  /** 会话 / 页面停留 / 前后台切换的埋点（NFR-6），页面侧不用再写 */
  useAnalyticsRoot();
  /** 每日练习提醒的本机排程（FR-N-1）：开关 / 时间 / 达标状态一变就重排 */
  useReminderSync();
  /** 点开提醒回到练习页 */
  useNotificationTap();

  useEffect(() => {
    if (ready && fontsLoaded) void SplashScreen.hideAsync();
  }, [ready, fontsLoaded]);

  if (!ready || !fontsLoaded) return null;

  return (
    <ThemeProvider>
      <ThemedStack />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppStoreProvider>
          <Root />
        </AppStoreProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
