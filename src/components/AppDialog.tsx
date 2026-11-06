import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui';
import { tr } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, SCRIM, stroke } from '@/theme/tokens';

/**
 * 全局确认 / 提示面板。
 *
 * 为什么不用 `Alert`：`react-native` 的 `Alert` 在 **web 上是空实现**，
 * 于是「清空学习记录」「清空埋点」「注销账号」这类必须二次确认的动作在网页版点了没有任何反应 ——
 * 动作没执行、用户也没被告知，是最难查的一类缺陷（端到端用例就是这么发现它的）。
 *
 * 这里改成自绘面板，三端行为一致，且元素带可访问名，能直接被端到端用例断言。
 * 用法：
 *   const id = await askDialog({ title, message, actions: [...] });  // 返回所选动作 id，取消为 null
 *   await notifyUser('已复制', '……');
 */

export type DialogActionTone = 'default' | 'danger' | 'cancel';

export interface DialogAction {
  id: string;
  label: string;
  tone?: DialogActionTone;
}

export interface DialogRequest {
  title: string;
  message?: string;
  actions: DialogAction[];
}

interface PendingDialog extends DialogRequest {
  resolve: (id: string | null) => void;
}

type ShowFn = (dialog: PendingDialog) => void;

let present: ShowFn | null = null;

/** 打开一个确认面板，返回被点中动作的 id（取消 / 遮罩关闭返回 null） */
export function askDialog(request: DialogRequest): Promise<string | null> {
  return new Promise((resolve) => {
    if (!present) {
      // 面板还没挂载（极早期调用）：直接按取消处理，绝不挂起 Promise
      resolve(null);
      return;
    }
    present({ ...request, resolve });
  });
}

/** 只有一个「好」的提示面板 */
export function notifyUser(title: string, message?: string): Promise<string | null> {
  return askDialog({ title, message, actions: [{ id: 'ok', label: tr('好') }] });
}

/** 挂在根布局里，全局只有一个 */
export function DialogHost() {
  const theme = useTheme();
  const [dialog, setDialog] = useState<PendingDialog | null>(null);

  useEffect(() => {
    present = (next) => setDialog(next);
    return () => {
      present = null;
    };
  }, []);

  if (!dialog) return null;

  const close = (id: string | null) => {
    dialog.resolve(id);
    setDialog(null);
  };

  const colorOf = (tone: DialogActionTone | undefined) =>
    tone === 'danger' ? theme.colors.accentRed : tone === 'cancel' ? theme.colors.textSecondary : theme.colors.brand;

  return (
    <View
      accessibilityViewIsModal
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 1000,
        alignItems: 'center',
        justifyContent: 'center',
        padding: layout.pagePadding,
      }}
    >
      {/* 遮罩：点空白处等于取消，和系统弹窗的习惯一致 */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr('关闭')}
        onPress={() => close(null)}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: SCRIM }}
      />
      <View
        style={{
          width: '100%',
          maxWidth: 420,
          backgroundColor: theme.colors.surface,
          borderRadius: layout.cardRadius,
          borderWidth: stroke.base,
          borderColor: theme.colors.border,
          padding: 20,
          gap: 12,
        }}
      >
        <AppText kind="md" color={theme.colors.text}>
          {dialog.title}
        </AppText>
        {dialog.message ? (
          <AppText kind="micro" color={theme.colors.textSecondary}>
            {dialog.message}
          </AppText>
        ) : null}
        <View style={{ gap: 8, marginTop: 4 }}>
          {dialog.actions.map((action) => (
            <Pressable
              key={action.id}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={() => close(action.id)}
              style={{
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 999,
                borderWidth: stroke.base,
                borderColor: theme.colors.border,
              }}
            >
              <AppText kind="sm" color={colorOf(action.tone)} weight="bold">
                {action.label}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}
