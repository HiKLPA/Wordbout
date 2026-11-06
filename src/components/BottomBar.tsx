import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ExerciseBarIcon,
  ExploreBarIcon,
  MainBarIcon,
  MoreBarIcon,
  TextbookBarIcon,
} from '@/components/icons';
import { AppText } from '@/components/ui';
import { tr } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, stroke } from '@/theme/tokens';

/**
 * 自定义 tab bar 的 props 契约。
 * 只声明本组件真正用到的字段，避免依赖 @react-navigation/bottom-tabs 的类型包。
 */
export interface BottomBarProps {
  state: {
    index?: number;
    routes: { key: string; name: string }[];
  };
  descriptors: Record<string, { options: { tabBarAccessibilityLabel?: string } }>;
  navigation: {
    emit: (event: { type: 'tabPress'; target?: string; canPreventDefault: true }) => {
      defaultPrevented?: boolean;
    };
    navigate: (name: string) => void;
  };
}

/**
 * 底部悬浮导航条 —— 对应 Figma「BAR」组件：
 * 圆角 9999，fill Surface Content **不透明实底**（`tokens.semanticColors.*.barBackground`，
 * 无背景模糊、无半透明），0.5px 描边（tokens 的 colors.border，浅 #FFFFFF / 深 #3A3A3A），无投影 / 无外发光。
 * 条带高 64，内含 5 个 BarIcon（单元高 64 满铺：28x28 图标 + 2 间距 + 12px 标签，行高 17，内容居中）。
 * 五个一级页面在此一次操作互达（IF-1）。
 * 宽度跟随屏宽自适应，左右各留 BAR_SIDE_MARGIN。
 */
const BAR_SIDE_MARGIN = layout.barSideMargin;
/** 条带内边距：首个/末个图标距条带边框的距离 */
const BAR_PADDING = 16;

/**
 * 底栏五项：标签 + 图标。
 * 「练习」与「更多」的图标**互相交换**：练习用 `MoreBarIcon`（四瓣贴边），更多用 `ExerciseBarIcon`（四瓣贴角）。
 * 只换这两个的图标，标签、顺序与其余三项都不动。
 */
const ROUTE_META: Record<string, { label: string; Icon: typeof MainBarIcon }> = {
  index: { label: '主页', Icon: MainBarIcon },
  exercise: { label: '练习', Icon: MoreBarIcon },
  textbook: { label: '课本', Icon: TextbookBarIcon },
  explore: { label: '探索', Icon: ExploreBarIcon },
  more: { label: '更多', Icon: ExerciseBarIcon },
};

export function BottomBar({ state, descriptors, navigation }: BottomBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 8) + 16;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom,
        paddingHorizontal: BAR_SIDE_MARGIN,
      }}
    >
      <View
        accessibilityRole="tablist"
        style={{
          height: layout.barHeight,
          borderRadius: layout.barRadius,
          // 条带底 = 不透明实底：无背景模糊、无半透明（模糊只影响背景，这里直接不用）
          backgroundColor: theme.colors.barBackground,
          borderWidth: stroke.base,
          borderColor: theme.colors.border,
          flexDirection: 'row',
          /** tab 单元与条带等高（64）：居中对齐，让 64 的单元在 63 的内容盒里上下各让 0.5px，不被底边裁掉 */
          alignItems: 'center',
          paddingHorizontal: BAR_PADDING,
        }}
      >
        {state.routes.map((route, index) => {
          const meta = ROUTE_META[route.name];
          if (!meta) return null;
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          const color = focused ? theme.colors.brand : theme.colors.icon;
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? tr(meta.label)}
              style={{
                // flex:1 让 5 个项平分条带内可用宽度（条带自身已留 16px 内边距，避免固定宽度溢出屏幕）
                flex: 1,
                height: layout.barItemHeight,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                borderRadius: 16,
              }}
            >
              <meta.Icon size={layout.barIconSize} color={color} />
              {/* 标签 12px / 行高 17（`micro` 档，字重 500）—— 12px 下最宽的英文 `Textbook` ≈50px，
                  远小于每格可用宽（402pt 屏 ≈61px），不会省略，无需自动缩字 */}
              <AppText kind="micro" color={color} numberOfLines={1}>
                {meta.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
