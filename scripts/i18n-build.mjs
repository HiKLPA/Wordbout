/**
 * i18n 资源生成器。
 *
 * 用法：node scripts/i18n-build.mjs
 *
 * 产出：
 * 1. src/i18n/zhHant.generated.ts —— 收集 src 下全部含中文的字符串字面量 / JSX 文本，
 *    用 OpenCC（cn → twp）批量转成繁體中文查表，供 tr() 在 zh-Hant 时直接命中。
 * 2. .tmp/i18n-inventory.json —— 界面文案清单（app / components / config / domain / theme），
 *    供人工撰写英文词条使用。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const OpenCC = require('opencc-js');

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/;

/** 繁体用语修正（OpenCC twp 后仍想统一的少数写法） */
const OVERRIDES = {
  賬號: '帳號',
  賬戶: '帳戶',
  賬單: '帳單',
  賬本: '帳本',
  文件夾: '資料夾',
  視頻: '影片',
};

const convert = OpenCC.Converter({ from: 'cn', to: 'twp' });

function listFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    // 跳过 src/i18n：该目录是词表本身（zhHant.generated.ts 的 key、en/*.ts 的 key 都是中文），
    // 扫进来会让已删文案的条目自我复制、永远清不掉。
    if (entry.isDirectory()) {
      if (entry.name === 'i18n') continue;
      out.push(...listFiles(full));
    } else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out.sort();
}

/** 收集一个文件里所有面向界面的中文字符串 */
function collect(file, acc) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const text = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  const walk = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const v = node.text;
      if (CJK.test(v)) acc.literals.push({ file: rel, value: v });
    } else if (ts.isTemplateExpression(node)) {
      const raw = node.getText(sf);
      if (CJK.test(raw)) acc.templates.push({ file: rel, value: raw });
    } else if (ts.isJsxText(node)) {
      const v = node.text.replace(/\s+/g, ' ').trim();
      if (v && CJK.test(v)) acc.literals.push({ file: rel, value: v });
    }
    ts.forEachChild(node, walk);
  };
  walk(sf);
  return acc;
}

const files = listFiles(SRC);
const acc = { literals: [], templates: [] };
for (const f of files) collect(f, acc);

/* ---------- 1. 繁体查表 ---------- */
const unique = [...new Set(acc.literals.map((x) => x.value))].sort();
const dict = {};
for (const zh of unique) {
  let out = convert(zh);
  for (const [a, b] of Object.entries(OVERRIDES)) out = out.split(a).join(b);
  if (out !== zh) dict[zh] = out;
}

const banner = `/* 由 scripts/i18n-build.mjs 生成，请勿手改；改文案后重新运行脚本。 */\n`;
const zhtFile = path.join(SRC, 'i18n', 'zhHant.generated.ts');
fs.mkdirSync(path.dirname(zhtFile), { recursive: true });
fs.writeFileSync(
  zhtFile,
  `${banner}export const zhHant: Record<string, string> = ${JSON.stringify(dict, null, 2)};\n`,
  'utf8',
);

/* ---------- 2. 界面文案清单 ---------- */
const UI_SCOPE = /^src\/(app|components|config|domain|theme|store|lib)\//;
const ui = acc.literals.filter((x) => UI_SCOPE.test(x.file));
const byFile = {};
for (const item of ui) (byFile[item.file] ??= new Set()).add(item.value);
const tpl = {};
for (const item of acc.templates.filter((x) => UI_SCOPE.test(x.file))) (tpl[item.file] ??= new Set()).add(item.value);

fs.mkdirSync(path.join(ROOT, '.tmp'), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, '.tmp', 'i18n-inventory.json'),
  JSON.stringify(
    {
      unique: [...new Set(ui.map((x) => x.value))].sort(),
      byFile: Object.fromEntries(Object.entries(byFile).map(([k, v]) => [k, [...v].sort()])),
      templatesByFile: Object.fromEntries(Object.entries(tpl).map(([k, v]) => [k, [...v].sort()])),
    },
    null,
    2,
  ),
  'utf8',
);

console.log(`文件数 ${files.length}`);
console.log(`中文字符串（去重）${unique.length}，繁体查表条目 ${Object.keys(dict).length}`);
console.log(`界面清单 ${new Set(ui.map((x) => x.value)).size} 条，含插值模板 ${acc.templates.length} 处`);
