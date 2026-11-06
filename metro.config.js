// Metro 配置：只加一项 —— 把 woff2 登记成资源扩展名。
//
// 原因：Metro 默认的资源扩展名只有 otf / ttf，`.woff2` 会被当成源码去解析而报错。
// web 端字体改用 woff2（同一份子集，体积约为 ttf 的 1/3，见 scripts/fonts-subset.py），
// 所以这里必须显式登记；原生端仍然用 ttf，不受影响。
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
if (!config.resolver.assetExts.includes('woff2')) {
  config.resolver.assetExts.push('woff2');
}

module.exports = config;
