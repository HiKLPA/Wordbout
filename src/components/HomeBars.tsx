import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { CameraIcon, RecordIcon } from '@/components/icons';
import { tr } from '@/i18n';
import { useApp } from '@/store/AppStore';
import { inputFont } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, opacity, stroke } from '@/theme/tokens';

/**
 * 主页中英翻译输入条 —— 对应 Figma「TranslateBar」：
 * 339x48，圆角 999，fill #F9F9F9，品牌红描边（2026-09-29 由统一白描边改为红），
 * 左侧占位文字「输入…」（ENG 18）。
 */
export function TranslateBar() {
  const theme = useTheme();
  const router = useRouter();
  const [text, setText] = React.useState('');
  const placeholder = tr('输入…');
  return (
    <Pressable
      onPress={() => router.push('/translate')}
      accessibilityRole="button"
      accessibilityLabel={tr('中英翻译，输入要翻译的文本')}
      style={{
        minHeight: layout.pillHeight,
        borderRadius: 999,
        borderWidth: stroke.base,
        borderColor: theme.colors.brand,
        backgroundColor: theme.colors.surface,
        overflow: 'hidden',
        // 输入框统一内边距 16（内层 TextInput 清零，左右留白由此处给）
        paddingHorizontal: layout.inputPad,
        justifyContent: 'center',
      }}
    >
      <View pointerEvents="none">
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textSecondary}
          editable={false}
          style={{
            /* 空框时按占位文字（中文）选字体，避免汉字落到 Barlow 上 */
            fontFamily: inputFont('bold'),
            fontSize: theme.size(18),
            color: theme.colors.text,
            padding: 0,
            backgroundColor: theme.colors.surface,
          }}
          accessibilityElementsHidden
        />
      </View>
    </Pressable>
  );
}

type ToolbarKind = 'camera' | 'record';

/**
 * 主页功能按钮（两个：拍照翻译 / 语音翻译）。
 * 「扫码登录」已从首页撤掉，改挂在**更多页右上角**（`app/(tabs)/more.tsx`）——它属于账号入口，
 * 待在「更多」里比摆在主页翻译区更合位置。
 */
const TOOLBAR_META: { kind: ToolbarKind; label: string; hint: string; route: string; Icon: typeof CameraIcon }[] = [
  { kind: 'camera', label: 'Camera', hint: '拍照翻译', route: '/scan', Icon: CameraIcon },
  { kind: 'record', label: 'Record', hint: '语音翻译', route: '/voice', Icon: RecordIcon },
];

/**
 * 单个功能按钮：**胶囊**（圆角 999）、与同排按钮等宽平分、高度取 `layout.pillHeight`
 * （与探索页 AI 输入胶囊同高）。图标固定在品牌色底上取 on-brand 前景色（浅色主题下即白色）。
 *
 * ⚠️ 这里**刻意不做按下反馈**（全 App 口径本来也是「按下不做透明度变化，只留 disabled 与装饰 Logo」）：
 * 曾经用过 `onPressIn/onPressOut` + `useState` 驱动 `transform: scale(0.94)`，结果在 Android 真机
 * （Expo Go / SDK 54 / 新架构 Fabric）上**点红色按钮会直接退出 App，且没有红屏**——原因是松手这一帧里
 * `setPressed(false)` 的重渲染和 `router.push` 挤进同一次提交，原生 Stack（react-native-screens）正在做
 * 推入转场时对页头里这块视图写入属性，原生层直接崩掉。翻译条（只有 onPress、无 state）走同一条 push
 * 路径却正常，就是这个差异。要恢复按下反馈，也必须走「不触发 React 重渲染」的原生通道
 * （如 Android `android_ripple`），不要再挂回 onPressIn/onPressOut + setState。
 */
function ToolbarButton({
  hint,
  blocked,
  Icon,
  onPress,
}: {
  hint: string;
  blocked: boolean;
  Icon: typeof CameraIcon;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${tr(hint)}${blocked ? tr('（需先同意隐私政策）') : ''}`}
      style={{
        flex: 1,
        height: layout.pillHeight,
        borderRadius: 999,
        borderWidth: stroke.base,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.brand,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: blocked ? opacity.muted : 1,
      }}
    >
      <Icon size={32} color={theme.colors.brandOn} />
    </Pressable>
  );
}

/**
 * 主页功能按钮 —— 对应 Figma「Toolbar」组件，现渲染成**一排等宽胶囊**（当前两个）：
 * fill Brand Primary #BE4B3E、圆角 999、高度 `layout.pillHeight`（与探索页 AI 输入胶囊同高）、
 * 图标 ENG 32（品牌色底上统一取 brandOn，浅色下为白）。
 *
 * 整排的几何落在**底栏正上方 16px**（左右各 32、按钮间 8），由调用方的 `FooterBar` 给；
 * 这里只输出按钮本身，各 `flex: 1` 自动平分 —— **含间隔在内的总宽度与底部导航条完全一致**。
 * （原第 4 个「AI 单词解析」已并入探索页第一个板块「AI 探索」，见 `app/(tabs)/explore.tsx`；
 * 原「扫码登录」已移到更多页右上角，见 `app/(tabs)/more.tsx`。）
 */
export function ToolbarButtons() {
  const router = useRouter();
  const { state } = useApp();
  const gated = !state.settings.privacyAccepted;
  const go = (href: string) => router.push(href as never);

  return (
    <>
      {TOOLBAR_META.map(({ kind, hint, route, Icon }) => {
        const blocked = gated && (kind === 'camera' || kind === 'record');
        return (
          <ToolbarButton
            key={kind}
            hint={hint}
            blocked={blocked}
            Icon={Icon}
            onPress={() => go(blocked ? '/privacy-consent' : route)}
          />
        );
      })}
    </>
  );
}
