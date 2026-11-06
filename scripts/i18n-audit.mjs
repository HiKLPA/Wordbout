/**
 * QA：列出界面里「不经过 tr() 的纯 ASCII 文案」与「未收录英文词条的中文文案」。
 *
 * 纯 ASCII 文案（如 'Main'、'KEEP IT UP!'）永远不可能命中以中文原文为键的词表，
 * 也就永远不会本地化；这类必须改成中文原文键 + en 词条。
 *
 * 用法：node scripts/i18n-audit.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');
const UI_SCOPE = /^src\/(app|components|config|domain|theme|store|lib)\//;
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/;
/** 品牌名 / 语言名 / 考试代号 / 纯符号：本就不翻译 */
const ALLOW = [/^[\s\d\W_]*$/, /Wordbout/, /^(English|CET4|CET6|IELTS|TOEFL|SAT|GRE)$/];

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

/** 语言自名 / 品牌名：tr() 原样返回，不算「缺英文词条」（单一来源见 src/i18n/fixed.ts） */
const FIXED = Object.values(loadPart(path.join(ROOT, 'src/i18n/fixed.ts')))[0];

function listFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'i18n') continue;
      out.push(...listFiles(full));
    } else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out.sort();
}

/** 只有这些属性会渲染成文字（其余如 kind / tone / name / accessibilityRole 是内部枚举） */
const TEXT_ATTRS = new Set([
  'label',
  'title',
  'subtitle',
  'placeholder',
  'accessibilityLabel',
  'hint',
  'message',
  'description',
  'confirmLabel',
  'cancelLabel',
  'unit',
]);

const ascii = [];
const missingEn = [];

for (const file of listFiles(SRC)) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  if (!UI_SCOPE.test(rel)) continue;
  const text = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const lineOf = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

  const record = (value, node, where) => {
    const v = value.trim();
    if (!v || ALLOW.some((re) => re.test(v)) || FIXED.has(v)) return;
    if (CJK.test(v)) {
      if (!(v in dict)) missingEn.push({ rel, line: lineOf(node), where, v });
      return;
    }
    if (/[A-Za-z]{2,}/.test(v)) ascii.push({ rel, line: lineOf(node), where, v });
  };

  const walk = (node) => {
    if (ts.isJsxText(node)) {
      record(node.text.replace(/\s+/g, ' '), node, 'jsx-text');
    } else if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const attr = node.name.getText(sf);
      if (TEXT_ATTRS.has(attr)) record(node.initializer.text, node, `attr:${attr}`);
    }
    ts.forEachChild(node, walk);
  };
  walk(sf);
}

const dedupe = (rows) => {
  const seen = new Set();
  return rows.filter((r) => {
    const k = `${r.rel}:${r.where}:${r.v}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

const A = dedupe(ascii);
const M = dedupe(missingEn);
console.log(`未本地化的纯 ASCII 文案 ${A.length} 处：`);
for (const r of A) console.log(`  ${r.rel}:${r.line} [${r.where}] ${r.v}`);
console.log(`缺英文词条的中文文案 ${M.length} 处：`);
for (const r of M) console.log(`  ${r.rel}:${r.line} [${r.where}] ${r.v}`);
