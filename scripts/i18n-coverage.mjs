/**
 * QA：列出界面清单里尚未收录进英文词表的句子。
 * 用法：node scripts/i18n-coverage.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const ROOT = path.resolve(import.meta.dirname, '..');

function loadPart(file) {
  const src = fs.readFileSync(file, 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  const req = (id) => (id.endsWith('index') ? {} : require(id));
  new Function('exports', 'require', 'module', js)(mod.exports, req, mod);
  return mod.exports;
}

const dict = {};
for (const name of ['common', 'home', 'study', 'tools']) {
  Object.assign(dict, Object.values(loadPart(path.join(ROOT, 'src/i18n/en', `${name}.ts`)))[0]);
}

/** 语言自名 / 品牌名：tr() 直接原样返回，本来就不该进词表（单一来源见 src/i18n/fixed.ts） */
const FIXED = Object.values(loadPart(path.join(ROOT, 'src/i18n/fixed.ts')))[0];

/**
 * 与 tr() 一致的数字通配：形如「第 1 题」的原文在运行时会被抽成「第 # 题」再查表，
 * 所以校对时也必须先做同样的归一化，否则会误报「未收录」。
 */
const NUM = /[+\-]?\d[\d.,:]*%?/g;
const shapeOf = (text) => text.replace(NUM, '#');

const inv = JSON.parse(fs.readFileSync(path.join(ROOT, '.tmp/i18n-inventory.json'), 'utf8'));
const missing = inv.unique.filter((s) => !FIXED.has(s) && !(s in dict) && !(shapeOf(s) in dict));
console.log(`清单 ${inv.unique.length} 条 · 词表 ${Object.keys(dict).length} 条 · 未收录 ${missing.length} 条`);
for (const m of missing) console.log('  ' + m);
