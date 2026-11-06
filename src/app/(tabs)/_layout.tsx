import { Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { BottomBar } from '@/components/BottomBar';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * 五个一级页面：主页 / 探索 / 课本 / 练习 / 更多（IF-1），从左到右即下方声明顺序。
 * 底部悬浮 BAR 为自定义 tab bar，视觉与 Figma「BAR」组件一致。
 */
export default function TabsLayout() {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: theme.colors.bg },
          /** 一级页面切换为硬切，不做水平位移过渡 */
          animation: 'none',
        }}
        tabBar={(props) => <BottomBar {...props} />}
      >
        <Tabs.Screen name="index" options={{ title: '主页' }} />
        <Tabs.Screen name="explore" options={{ title: '探索' }} />
        <Tabs.Screen name="textbook" options={{ title: '课本' }} />
        <Tabs.Screen name="exercise" options={{ title: '练习' }} />
        <Tabs.Screen name="more" options={{ title: '更多' }} />
      </Tabs>
    </View>
  );
}
