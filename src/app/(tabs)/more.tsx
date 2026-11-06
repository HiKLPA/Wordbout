import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';

import { Alert, Image, Modal, Pressable, TextInput, View } from 'react-native';

import { AboutIcon, HintIcon, Logo, PrivacyIcon, ScanIcon, SettingsIcon } from '@/components/icons';
import { AppText, Card, PrimaryButton, Screen } from '@/components/ui';
import { tr } from '@/i18n';
import { trackTap } from '@/lib/analytics';
import { useFocusPlaceholder } from '@/lib/focusPlaceholder';
import { useApp } from '@/store/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { inputFont } from '@/theme/fonts';
import { layout, stroke, typography } from '@/theme/tokens';

/**
 * 更多 / More —— 对应 Figma「iPhone 16 & 17 Pro - 5」：
 * 品牌红装饰块 + 160x160 头像圆 + 昵称（TGIF）+ 编号（No.000001）+ 带 Hint 箭头的设置卡片
 * （Settings / Privacy / About）。
 *
 * 红区下方：头像与昵称（就地编辑）、以及一张面板（设置 / 账号 / 关于 / 隐私与协议）。
 * 「账号」这一行是扫码登录入口（原先是红区左上角的一枚扫码图标，现收进面板）。
 * 账号类操作收在「更多」里，不再占用主页的翻译功能按钮位（见 `components/HomeBars.tsx`）。
 *
 * 头像与昵称在本页就地编辑（FR-O-1 / FR-A-2），不跳转二级页面：
 * - 点头像 → 弹窗「保存 / 更改 / 恢复默认」，改动先存草稿，点保存才落库；
 * - 点昵称 → 就地变输入框，2-16 字符校验，保存后立即同步。
 */
export default function MoreScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { state, actions } = useApp();

  const [avatarOpen, setAvatarOpen] = useState(false);
  /** 头像草稿：null = 恢复默认（无头像） */
  const [avatarDraft, setAvatarDraft] = useState<string | null>(null);
  const [nameEditing, setNameEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(state.profile.nickname);
  /** 昵称输入框的占位提示：聚焦后即隐（全 App 统一口径） */
  const nameHint = useFocusPlaceholder(tr('昵称'));

  const initials = state.profile.nickname.slice(0, 2).toUpperCase();
  const nameValid = nameDraft.trim().length >= 1 && nameDraft.trim().length <= 12;
  const avatarPreview = avatarOpen ? avatarDraft : (state.profile.avatarUri ?? null);

  /** 打开头像弹窗：只切显示状态（弹窗没有弹出动画，点开即整块呈现） */
  const openAvatarSheet = () => {
    setAvatarDraft(state.profile.avatarUri ?? null);
    setAvatarOpen(true);
  };

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        tr('需要相册权限'),
        tr('请在系统设置中允许 Wordbout 访问相册，用于选择头像。'),
      );
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) setAvatarDraft(res.assets[0].uri);
  };

  /**
   * 关闭头像弹窗：先执行 `after`（例如「保存」落库），再关掉。
   * 面板外空白、系统返回、「保存」都走它。**没有收回动画**（2026-10-17 删除），关即消失。
   */
  const closeAvatar = (after?: () => void) => {
    after?.();
    setAvatarOpen(false);
  };

  const commitAvatar = () => {
    actions.updateProfile({ avatarUri: avatarDraft ?? undefined });
  };

  const startEditName = () => {
    setNameDraft(state.profile.nickname);
    setNameEditing(true);
  };

  /** 点击输入框外任意区域即落库：有效则保存新昵称，无效则保留原昵称，随后退出编辑态 */
  const commitName = () => {
    const next = nameDraft.trim();
    if (next.length >= 1 && next.length <= 12) actions.updateProfile({ nickname: next });
    setNameEditing(false);
  };

  /**
   * 二级页面入口。`label` 既是这里显示的行文字，也是点进去后页头左上角的标题
   * —— 各二级页面的 <PageHeader title> 用同一个中文原文键（NFR-8），三种界面语言下都一致。
   */
  const rows = [
    {
      key: 'settings',
      label: '设置',
      Icon: SettingsIcon,
      href: '/settings',
    },
    {
      // 账号（原先是红区左上角一枚扫码图标，现收进面板、紧挨「设置」下方）
      key: 'account',
      label: '账号',
      Icon: ScanIcon,
      href: '/qr-login',
    },
    {
      key: 'about',
      label: '关于',
      Icon: AboutIcon,
      href: '/about',
    },
    {
      key: 'privacy',
      label: '隐私与协议',
      Icon: PrivacyIcon,
      href: '/privacy',
    },
  ];

  return (
    <Screen padded={false}>
      {/* 品牌红装饰 + 头像 */}
      <View style={{ height: 225, backgroundColor: theme.colors.brand, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', right: -20, bottom: -30, opacity: 0.28 }}>
          <Logo size={280} color={theme.palette.invert} accent={theme.palette.invert} />
        </View>
      </View>

      <View style={{ alignItems: 'center', marginTop: -80 }}>
        <Pressable
          onPress={openAvatarSheet}
          accessibilityRole="button"
          accessibilityLabel={tr('编辑头像')}
          style={{
            width: 160,
            height: 160,
            borderRadius: 999,
            borderWidth: stroke.base,
            borderColor: theme.colors.border,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.surface,
          }}
        >
          {state.profile.avatarUri ? (
            <Image
              source={{ uri: state.profile.avatarUri }}
              accessibilityIgnoresInvertColors
              style={{ width: 160, height: 160, borderRadius: 999 }}
            />
          ) : (
            <AppText
              kind="display"
              color={theme.colors.brand}
              style={{ fontSize: theme.size(104), lineHeight: theme.size(114) }}
            >
              {initials}
            </AppText>
          )}
        </Pressable>
      </View>

      {/* 昵称区：编辑态只是把名字换成等高输入框，编号与整体排版保持不变。
          「头像 → 姓名与编号」间距 8；内部（姓名 ↔ 编号）间距 2。 */}
      <View style={{ alignItems: 'center', gap: 2, marginTop: 8, zIndex: 20 }}>
        {nameEditing ? (
          <TextInput
            value={nameDraft}
            onChangeText={setNameDraft}
            autoFocus
            maxLength={12}
            {...nameHint}
            placeholderTextColor={theme.colors.textMuted}
            accessibilityLabel={tr('昵称')}
            onSubmitEditing={commitName}
            // 失焦：先收起占位提示（聚焦即隐那套状态），再提交昵称
            onBlur={() => {
              nameHint.onBlur();
              commitName();
            }}
            style={{
              width: 220,
              height: theme.size(42),
              textAlign: 'center',
              textAlignVertical: 'center',
              borderWidth: stroke.base,
              borderColor: nameValid ? theme.colors.border : theme.colors.brand,
              borderRadius: 999,
              // 输入框统一内边距 16
              paddingHorizontal: layout.inputPad,
              paddingVertical: 0,
              includeFontPadding: false,
              color: theme.colors.text,
              fontFamily: inputFont('extraBold'),
              fontSize: theme.size(32),
              backgroundColor: theme.colors.surface,
            }}
          />
        ) : (
          <Pressable
            onPress={startEditName}
            accessibilityRole="button"
            accessibilityLabel={tr('编辑昵称')}
          >
            <AppText kind="xl" color={theme.colors.text}>
              {state.profile.nickname}
            </AppText>
          </Pressable>
        )}
        {/* 编号：字号取 tiny 档的 14px，行高仍沿用 micro 的 17（比 tiny 的 19 紧一档） */}
        <AppText
          kind="micro"
          color={theme.colors.textSecondary}
          style={{ fontSize: theme.size(typography.tiny) }}
        >
          {`No.${state.profile.id.replace(/^WB-/, '')}`}
        </AppText>
      </View>

      {/* 卡片区：「姓名与编号 → 面板」这一段间距 32；
          左右沿用主内容区边距（`layout.pagePadding`，与其它页面一致）；卡内内边距统一 16、行无上下内边距、行间 16 */}
      <View style={{ paddingHorizontal: layout.pagePadding, marginTop: 32, gap: 8 }}>
        <Card style={{ padding: 16, gap: 16 }}>
          {/* 行内不做上下内边距；行与行之间只靠卡片的 gap 8 分隔（分割线已删） */}
          {rows.map((row) => (
            <View key={row.key}>
              <Pressable
                onPress={() => {
                  trackTap(row.label, { kind: 'menu' });
                  router.push(row.href as never);
                }}
                accessibilityRole="button"
                accessibilityLabel={tr(row.label)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                  <row.Icon size={28} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText kind="md" color={theme.colors.text}>
                    {row.label}
                  </AppText>
                </View>
                <HintIcon size={18} color={theme.colors.textMain} />
              </Pressable>
            </View>
          ))}
        </Card>
      </View>

      {/* 编辑昵称时：点击输入框以外的任意区域（含头像、卡片、空白）直接保存并退出编辑态 */}
      {nameEditing ? (
        <Pressable
          onPress={commitName}
          accessibilityRole="button"
          accessibilityLabel={tr('保存昵称')}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }}
        />
      ) : null}

      <Modal
        visible={avatarOpen}
        transparent
        animationType="none"
        onRequestClose={() => closeAvatar()}
      >
        {/* 无遮罩：面板直接浮在页面之上，外部只剩一层透明热区（点它关闭弹窗） */}
        <View style={{ flex: 1 }}>
          <Pressable
            onPress={() => closeAvatar()}
            accessibilityLabel={tr('关闭')}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              /* 弹窗左右留白 = 主内容区（`pagePadding` 18），与 `DialogPanel` 同一口径 */
              paddingHorizontal: layout.pagePadding,
              paddingVertical: 24,
            }}
          >
            {/* 面板层：与 `DialogPanel` 同宽同圆角，不做位移 / 形变 / 淡入（2026-10-17 删除弹入动画） */}
            <View style={{ width: '100%' }}>
              <Pressable
                onPress={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  /* 与弹窗面板（DialogPanel）同圆角：统一取卡片 / 面板 token `layout.cardRadius` = 32 */
                  borderRadius: layout.cardRadius,
                  borderWidth: stroke.base,
                  borderColor: theme.colors.border,
                  /* 面板底色 = 页面底色（`bg`），与 `DialogPanel` 同一口径 */
                  backgroundColor: theme.colors.bg,
                  overflow: 'hidden',
                  /* 面板内边距四边 16（与 `DialogPanel` 同一口径） */
                  padding: 16,
                  gap: 14,
                  alignItems: 'center',
                }}
              >
                <View
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 999,
                    overflow: 'hidden',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {avatarPreview ? (
                    <Image
                      source={{ uri: avatarPreview }}
                      accessibilityIgnoresInvertColors
                      style={{ width: 96, height: 96, borderRadius: 999 }}
                    />
                  ) : (
                    <AppText kind="lg" color={theme.colors.brand}>
                      {initials}
                    </AppText>
                  )}
                </View>

                <View style={{ width: '100%', gap: 10 }}>
                  {/* 保存 = 落库 + 关弹窗 */}
                  <PrimaryButton label="保存" onPress={() => closeAvatar(commitAvatar)} />
                  <PrimaryButton label="更改" tone="ghost" onPress={pickAvatar} />
                  <PrimaryButton label="恢复默认" tone="ghost" onPress={() => setAvatarDraft(null)} />
                </View>
              </Pressable>
            </View>
          </Pressable>
        </View>
      </Modal>
    </Screen>
  );
}
