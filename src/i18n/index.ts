/**
 * 轻量本地化（gettext 风格：以简体中文原文为键）。
 *
 * - 简体中文：原文即译文，缺条目也不会露出 key；
 * - English：查 en 词表，未收录则回退简体中文（占位符用 `{}`，通配符 `#` 匹配数字）；
 * - 繁體中文：查由 scripts/i18n-build.mjs 生成的 OpenCC 查表，未收录则回退简体中文。
 *
 * 界面文字统一经 `tr()`（见 components/ui.tsx 的 AppText 自动本地化），
 * 非文本节点（Alert / placeholder / 无障碍标签）需显式包一层。
 */
import { en } from './en';
import { FIXED } from './fixed';
import { zhHant } from './zhHant.generated';

export type LocaleName = 'en' | 'zh-Hans' | 'zh-Hant';

const FALLBACK: LocaleName = 'zh-Hans';

export type Vars = Record<string, string | number>;
export type Entry = string | ((vars: Vars, nums: string[]) => string);

let current: LocaleName = FALLBACK;

export function setLocale(locale: string | undefined | null): void {
  current = locale === 'en' || locale === 'zh-Hant' || locale === 'zh-Hans' ? locale : FALLBACK;
}

export function getLocale(): LocaleName {
  return current;
}

/** 语言名称与品牌名以本语言书写，永不翻译（清单见 ./fixed.ts） */
export { FIXED };

/** 数字（含正负号、小数、千分位、时间冒号、百分号）抽成通配符，让插值后的整句也能命中词表 */
const NUM = /[+\-]?\d[\d.,:]*%?/g;

function shapeOf(text: string): { key: string; nums: string[] } {
  const nums: string[] = [];
  const key = text.replace(NUM, (m) => {
    nums.push(m);
    return '#';
  });
  return { key, nums };
}

function fill(tpl: string, vars: Vars, nums: string[]): string {
  let i = 0;
  return tpl.replace(/#|\{(\w+)\}/g, (m, name: string | undefined) => {
    if (m === '#') {
      const v = nums[i++];
      return v === undefined ? '#' : v;
    }
    const v = name ? vars[name] : undefined;
    return v === undefined ? m : String(v);
  });
}

/** 翻译一句界面文案；vars 用于 `{}` 占位符 */
export function tr(text: string, vars?: Vars): string {
  if (!text || FIXED.has(text)) return text;
  const v = vars ?? {};
  if (current === 'zh-Hans') return fill(text, v, []);

  const table = current === 'en' ? en : zhHant;
  const direct = table[text];
  if (typeof direct === 'string') return fill(direct, v, []);
  if (typeof direct === 'function') return direct(v, []);

  const { key, nums } = shapeOf(text);
  if (key !== text) {
    const shaped = table[key];
    if (typeof shaped === 'string') return fill(shaped, v, nums);
    if (typeof shaped === 'function') return shaped(v, nums);
  }
  return fill(text, v, []);
}

/** 直接用 `{name}` 占位符调用，等价于 tr(text, vars) */
export function trf(text: string, vars: Vars): string {
  return tr(text, vars);
}

/** 列表连接符：中文用顿号，英文用逗号 */
export function listSep(): string {
  return current === 'en' ? ', ' : '、';
}

/** 逗号/分号等标点的语言适配 */
export function sentenceSep(): string {
  return current === 'en' ? '; ' : '；';
}

/** React 文本节点本地化：字符串逐句翻译，其余节点原样返回 */
export function localize(node: React.ReactNode): React.ReactNode {
  if (typeof node === 'string') return tr(node);
  if (Array.isArray(node)) return node.map((child) => localize(child));
  return node;
}

export { en, zhHant };
