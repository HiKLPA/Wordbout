import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * **web 端的根 HTML**（只在构建 web 时生效，原生端不加载本文件）。
 *
 * 结构与 expo-router 内置模板保持一致（字符集 / 兼容模式 / 视口 / `ScrollViewStyleReset`），
 * 只多挂一段全局样式 —— 让**页面与输入框里的滚动条彻底不出现**（见下）。
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: scrollbarStyle }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

/**
 * web 端**全局不画浏览器滚动条**（2026-10-17）。
 *
 * 起因：中英翻译页的输入框右侧、以及页面内容右缘，会常驻一条竖条。根子是
 * **`react-native-web` 的 `ScrollView` 压根没实现 `showsVerticalScrollIndicator`**
 * （`ScrollView/index.js` 里直接写成 `overflowY: 'auto'`），`Screen` 传的 `false` 在 web 上等于没传，
 * 内容一超一屏就露出浏览器自己那条；多行输入框（`<textarea>`）同理，之前只针对它做过一次处理。
 * 这个 App 是移动端界面，浏览器那条灰条压在正文 / 输入框边上明显出戏，所以在根样式里一次收掉。
 *
 * - `scrollbar-width: none`（Firefox）与 `::-webkit-scrollbar { width/height: 0 }`（Chromium / WebKit）各管一摊；
 * - `-ms-overflow-style: none` 兜旧 Edge；
 * - 只隐藏**外观**：滚轮、触摸板、触控板滚动与程序化 `scrollTo` 全部照常，只是看不见条；
 * - 多行输入框仍保留 `overflow-y: auto`（不是 `scroll`），内容不满一屏时不会预留槽位。
 */
const scrollbarStyle = `
* {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
*::-webkit-scrollbar {
  width: 0;
  height: 0;
  background: transparent;
}
*::-webkit-scrollbar-button,
*::-webkit-scrollbar-track,
*::-webkit-scrollbar-thumb,
*::-webkit-scrollbar-corner {
  display: none;
  background: transparent;
}
textarea {
  overflow-y: auto !important;
}
`;
