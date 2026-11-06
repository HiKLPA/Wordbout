/**
 * i18n 冒烟测试：把 src/i18n 下的 TS 转成 CJS 直接跑，检查三种语言的实际输出。
 * 用法：node scripts/i18n-smoke.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const ROOT = path.resolve(import.meta.dirname, '..');

const cache = new Map();
function load(file) {
  let abs = file;
  if (!abs.endsWith('.ts')) {
    abs = fs.existsSync(`${abs}.ts`) ? `${abs}.ts` : path.join(abs, 'index.ts');
  }
  if (cache.has(abs)) return cache.get(abs).exports;
  const mod = { exports: {} };
  cache.set(abs, mod);
  const js = ts.transpileModule(fs.readFileSync(abs, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const dir = path.dirname(abs);
  const localRequire = (id) => {
    if (id.startsWith('@/')) return load(path.join(ROOT, 'src', id.slice(2)));
    return id.startsWith('.') ? load(path.resolve(dir, id)) : require(id);
  };
  new Function('exports', 'require', 'module', js)(mod.exports, localRequire, mod);
  return mod.exports;
}

const i18n = load(path.join(ROOT, 'src/i18n/index.ts'));

const samples = [
  ['设置', undefined],
  ['今日打卡', undefined],
  ['连续天数', undefined],
  ['已达标', undefined],
  ['个', undefined],
  ['天', undefined],
  ['用时 {v}', { v: '3 s' }],
  ['门槛：时长 {t} 分钟或任务数 {n} 个，任一达标即计入连续练习天数', { t: 5, n: 5 }],
  ['错题队列共 {n} 个：{list}', { n: 3, list: 'apple, pear' }],
  ['结果 {n} 条', { n: 12 }],
  ['得分率 {v}%', { v: '87.5' }],
  ['正确答案是「{a}」，定位句：{e}', { a: 'B', e: 'see the passage' }],
  ['第 1 题', undefined],
  /* 区块标题 / 练习页标语 / 文体名：中英必须成对 */
  ['今天', undefined],
  ['星标', undefined],
  ['热门', undefined],
  ['推荐', undefined],
  ['总览', undefined],
  ['按题型', undefined],
  ['全部', undefined],
  ['进阶', undefined],
  ['测验', undefined],
  ['已连续', undefined],
  ['{n} 天', { n: 12 }],
  ['继续保持！', undefined],
  ['记叙文', undefined],
  ['学术论文', undefined],
  ['听写 · 第 1 套', undefined],
  ['账号与全部学习记录都会被删除，且不可恢复。确定继续吗？', undefined],
  ['Wordbout', undefined],
  ['简体中文', undefined],
  ['some raw English content', undefined],
];

/* 真实函数输出（含域层格式化） */
function functional(locale) {
  const date = load(path.join(ROOT, 'src/domain/date.ts'));
  const stats = load(path.join(ROOT, 'src/domain/stats.ts'));
  return [
    ['formatDurationHuman(200)', date.formatDurationHuman(200)],
    ['formatDurationHuman(45)', date.formatDurationHuman(45)],
    ['formatDurationHuman(3900)', date.formatDurationHuman(3900)],
    ['formatDayShort', date.formatDayShort('2026-09-28')],
    ['levelOf(88)', typeof stats.levelOf === 'function' ? JSON.stringify(stats.levelOf(88)) : 'n/a'],
  ];
}

for (const locale of ['zh-Hans', 'zh-Hant', 'en']) {
  i18n.setLocale(locale);
  console.log(`\n=== ${locale} ===`);
  for (const [text, vars] of samples) {
    console.log(`  ${text}  →  ${vars ? i18n.trf(text, vars) : i18n.tr(text)}`);
  }
  for (const [label, value] of functional(locale)) {
    console.log(`  [fn] ${label}  →  ${value}`);
  }
}
