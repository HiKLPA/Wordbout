import { useState } from 'react';

/**
 * 输入框的**占位提示文字在聚焦后即刻隐去**（全 App 统一口径）：
 * 一旦进入输入状态，框里就只剩光标，不再与提示文字叠在一起。
 *
 * 用法：在组件里 `const hint = useFocusPlaceholder(tr('…'))`，
 * 再把返回的三个属性摊进 `TextInput`：`<TextInput {...hint} … />`。
 * 该输入框自己还要处理焦点事件时（如失焦时提交），写在自己那一侧并转调 `hint.onFocus` / `hint.onBlur`，
 * 不要直接覆盖，否则状态会一直停在「未聚焦」。
 *
 * 说明：提示文案随每次渲染取当前的 `text`，因此提示会随语言 / 状态即时变化；`undefined` 即不渲染提示。
 */
export function useFocusPlaceholder(text: string) {
  const [focused, setFocused] = useState(false);
  return {
    placeholder: focused ? undefined : text,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  };
}
