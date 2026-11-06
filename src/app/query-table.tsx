import React from 'react';

import { CapabilityTrend } from '@/components/CapabilityTrend';

/**
 * 能力趋势路由页（入口：更多 → 学习统计 →「打开能力趋势」）。
 *
 * 实现整块在 `components/CapabilityTrend`：练习页顶部第 4 个页签「能力趋势」**就地内嵌**
 * 同一份内容（传 `embedded`，不铺自己的 Screen），只有这里是走路由的二级页（页头带返回箭头）。
 */
export default function QueryTableScreen() {
  return <CapabilityTrend />;
}
