import type { Entry } from './index';
import { enCommon } from './en/common';
import { enHome } from './en/home';
import { enStudy } from './en/study';
import { enTools } from './en/tools';

/**
 * 英文词表：键为简体中文原文（可含 `{}` 命名占位符或 `#` 数字通配符）。
 * 未收录的句子回退简体中文，不会露出 key。
 */
export const en: Record<string, Entry> = {
  ...enCommon,
  ...enHome,
  ...enStudy,
  ...enTools,
};
