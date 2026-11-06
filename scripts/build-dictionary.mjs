#!/usr/bin/env node
/**
 * 词库构建脚本：把开源词典裁成 App 内置的紧凑数据。
 *
 * 数据源（都会缓存到 `.cache/dict/`，该目录已 gitignore）：
 *   1. ECDICT（简明英汉词典）  https://github.com/skywind3000/ECDICT   MIT
 *      —— 只取高频词（按 COCA `frq` / BNC `bnc` 排名），产出「英 → 中」词条。
 *   2. CC-CEDICT（汉英词典）   https://www.mdbg.net/chinese/dictionary?page=cc-cedict
 *      CC BY-SA 4.0 —— 只取 HSK 1~6 级常用词 + 常用单字，产出「中 → 英」词条。
 *   3. HSK 1~6 词表（仅作筛选集） https://github.com/clem109/hsk-vocabulary
 *
 * 用法：
 *   node scripts/build-dictionary.mjs            # 缺数据时自动下载
 *   node scripts/build-dictionary.mjs --no-download   # 只用缓存（离线）
 *   node scripts/build-dictionary.mjs --ecdict-limit 8000 --translation-limit 80
 *
 * 产出（不要手改，重新跑本脚本覆盖）：
 *   src/data/dictionaries/ecdict.generated.ts
 *   src/data/dictionaries/cedict.generated.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, '.cache', 'dict');
const OUT_DIR = path.join(ROOT, 'src', 'data', 'dictionaries');

const argv = process.argv.slice(2);
const NO_DOWNLOAD = argv.includes('--no-download');
const argOf = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : fallback;
};
/** 英汉词典收录上限（按词频排名取前 N） */
const ECDICT_LIMIT = argOf('--ecdict-limit', 8000);
/** 额外保留的考试词数量上限（带 tag / 牛津 3000 标记） */
const ECDICT_EXTRA_LIMIT = argOf('--ecdict-extra-limit', 2000);
/** 汉英词典收录上限 */
const CEDICT_LIMIT = argOf('--cedict-limit', 9000);
/** 单条中文释义的字符上限（超长会把内置数据撑大，超出部分截断） */
const TRANSLATION_LIMIT = argOf('--translation-limit', 80);

/**
 * 直连 raw.githubusercontent 在国内只有 ~30KB/s（66MB 要跑半小时），所以默认先走加速镜像。
 * 镜像不可用时自动回落到官方源。
 */
const GH_MIRRORS = [
  (url) => `https://gh-proxy.com/${url}`,
  (url) => `https://ghfast.top/${url}`,
  (url) => url,
];

const SOURCES = {
  ecdict: {
    url: 'https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv',
    file: 'ecdict.csv',
    minSize: 60 * 1024 * 1024,
    mirrors: GH_MIRRORS,
  },
  cedict: {
    url: 'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz',
    file: 'cedict.txt.gz',
    minSize: 3 * 1024 * 1024,
  },
  hsk: [1, 2, 3, 4, 5, 6].map((level) => ({
    url: `https://raw.githubusercontent.com/clem109/hsk-vocabulary/master/hsk-vocab-json/hsk-level-${level}.json`,
    file: `hsk-${level}.json`,
    minSize: 10 * 1024,
    mirrors: GH_MIRRORS,
  })),
};

function log(...args) {
  console.log('[dict]', ...args);
}

async function download({ url, file, minSize, mirrors }) {
  const dest = path.join(CACHE, file);
  if (fs.existsSync(dest) && fs.statSync(dest).size >= minSize) {
    log(`复用缓存 ${file}（${(fs.statSync(dest).size / 1048576).toFixed(2)} MB）`);
    return dest;
  }
  if (NO_DOWNLOAD) throw new Error(`缺少 ${file} 且指定了 --no-download`);

  const candidates = (mirrors ?? [(u) => u]).map((wrap) => wrap(url));
  let lastError = '';
  for (const candidate of candidates) {
    try {
      log(`下载 ${candidate}`);
      const res = await fetch(candidate);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < minSize) throw new Error(`体积异常（${buf.length} < ${minSize}）`);
      fs.writeFileSync(dest, buf);
      log(`已保存 ${file}（${(buf.length / 1048576).toFixed(2)} MB）`);
      return dest;
    } catch (error) {
      lastError = error.message;
      log(`失败（${error.message}），换下一个源`);
    }
  }
  throw new Error(`全部镜像均失败（最后一个：${lastError}）`);
}

/* ------------------------------------------------------------------ *
 * CSV 解析（ECDICT 的字段里可能带引号包裹的逗号与真实换行）
 * ------------------------------------------------------------------ */
function* parseCsv(text) {
  let field = '';
  let row = [];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      yield row;
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field || row.length) {
    row.push(field);
    yield row;
  }
}

/* ------------------------------------------------------------------ *
 * 文本清洗
 * ------------------------------------------------------------------ */
/** ECDICT 用西里尔字母 `ә`(U+04D9) 当央元音，界面上要换成真正的 `ə`(U+0259) */
const PHONETIC_FIX = [
  [/ә/g, 'ə'],
  [/ɑ/g, 'ɑ'],
  [/ɡ/g, 'g'],
  [/ˈ|ˋ/g, 'ˈ'],
  [/ː{2,}/g, 'ː'],
];

function cleanPhonetic(raw) {
  let s = (raw ?? '').trim();
  if (!s) return '';
  for (const [re, to] of PHONETIC_FIX) s = s.replace(re, to);
  return s;
}

const CJK = /[\u3400-\u9fff]/;

/**
 * ECDICT 的 `translation` 用**字面量** `\n` 分行，每行常带 `[网络]`/`[医]` 这类领域标记。
 * 这里压成单行：去掉领域标记、按 `；` 连接、截断过长内容。
 */
function cleanEcdictTranslation(raw, limit = TRANSLATION_LIMIT) {
  const parts = String(raw ?? '')
    .split('\\n')
    .map((line) =>
      line
        .replace(/^\s*\[[^\]]{1,6}\]\s*/, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);
  const joined = [...new Set(parts)].join('；');
  return joined.length > limit ? `${joined.slice(0, limit)}…` : joined;
}

/** 只保留 App 认得的考试标签，顺序固定 */
const TAG_ORDER = ['zk', 'gk', 'cet4', 'cet6', 'ky', 'toefl', 'ielts', 'gre'];
function cleanTags(tag, oxford, collins) {
  const set = new Set(String(tag ?? '').split(/\s+/).filter((t) => TAG_ORDER.includes(t)));
  const out = TAG_ORDER.filter((t) => set.has(t));
  if (oxford === '1') out.unshift('ox');
  if (Number(collins) >= 4) out.push(`c${collins}`);
  return out.join(' ');
}

/** 收录的英文词条：小写单词或短语，不含数字与其它符号 */
const HEADWORD_OK = /^[a-z][a-z'’\- ]{0,23}$/;

/** 词频粗档：1 = 高频（COCA / BNC 前 3000），2 = 常用（前 8000），3 = 一般，空 = 无词频数据 */
function freqBucket(rank) {
  if (!rank) return '';
  if (rank <= 3000) return '1';
  if (rank <= 8000) return '2';
  return '3';
}

/* ------------------------------------------------------------------ *
 * ECDICT → 英汉词库
 * ------------------------------------------------------------------ */
function buildEcdict(csvPath) {
  const text = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCsv(text);
  const header = rows.next().value;
  const col = Object.fromEntries(header.map((name, i) => [name.trim(), i]));
  log('ECDICT 列：', header.join(','));

  const ranked = [];
  const tagged = [];
  let total = 0;
  let skippedHeadword = 0;

  for (const row of rows) {
    total += 1;
    const word = (row[col.word] ?? '').trim();
    if (!HEADWORD_OK.test(word)) {
      skippedHeadword += 1;
      continue;
    }
    const translation = cleanEcdictTranslation(row[col.translation]);
    if (!translation || !CJK.test(translation)) continue;

    const frq = Number(row[col.frq]) || 0;
    const bnc = Number(row[col.bnc]) || 0;
    const rank = Math.min(frq > 0 ? frq : Infinity, bnc > 0 ? bnc : Infinity);
    const tags = cleanTags(row[col.tag], (row[col.oxford] ?? '').trim(), row[col.collins]);
    const entry = {
      word,
      phonetic: cleanPhonetic(row[col.phonetic]),
      tags,
      rank: Number.isFinite(rank) ? rank : 0,
      translation,
    };

    if (Number.isFinite(rank)) ranked.push(entry);
    else if (tags) tagged.push(entry);
  }
  log(`ECDICT 总行 ${total}，表头不合规跳过 ${skippedHeadword}，有词频 ${ranked.length}，仅标签 ${tagged.length}`);

  ranked.sort((a, b) => a.rank - b.rank);
  const picked = ranked.slice(0, ECDICT_LIMIT);
  const seen = new Set(picked.map((e) => e.word));
  // 考试/牛津词即使词频靠后也补进来，保证「四级词汇」这类查询有结果
  let extra = 0;
  for (const e of ranked.slice(ECDICT_LIMIT)) {
    if (extra >= ECDICT_EXTRA_LIMIT) break;
    if (!e.tags || seen.has(e.word)) continue;
    seen.add(e.word);
    picked.push(e);
    extra += 1;
  }
  for (const e of tagged) {
    if (extra >= ECDICT_EXTRA_LIMIT) break;
    if (seen.has(e.word)) continue;
    seen.add(e.word);
    picked.push(e);
    extra += 1;
  }
  log(`ECDICT 收录 ${picked.length} 条（词频 ${ECDICT_LIMIT} + 补充 ${extra}）`);
  return picked;
}

/* ------------------------------------------------------------------ *
 * CC-CEDICT → 汉英词库
 * ------------------------------------------------------------------ */
const CEDICT_LINE = /^(\S+)\s+(\S+)\s+\[([^\]]*)\]\s+\/(.+)\/$/;

function buildCedict(gzPath, allowedWords) {
  const lines = zlib.gunzipSync(fs.readFileSync(gzPath)).toString('utf8').split('\n');
  const out = [];
  const seen = new Set();
  let total = 0;

  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    total += 1;
    const m = CEDICT_LINE.exec(line.trim());
    if (!m) continue;
    const [, traditional, simplified, pinyin, glossRaw] = m;
    if (!allowedWords.has(simplified)) continue;
    if (seen.has(simplified)) continue;
    seen.add(simplified);

    const glosses = glossRaw
      .split('/')
      .map((g) => g.trim())
      .filter((g) => g && !/^(CL|variant of|old variant of|see |abbr\. for|surname )/i.test(g));
    if (!glosses.length) continue;

    const joined = glosses.join('；');
    out.push({
      simplified,
      pinyin: pinyin.trim(),
      traditional: traditional === simplified ? '' : traditional,
      gloss: joined.length > 160 ? `${joined.slice(0, 160)}…` : joined,
    });
  }
  log(`CC-CEDICT 总词条 ${total}，命中筛选集 ${out.length}`);
  out.sort((a, b) => a.simplified.length - b.simplified.length || a.simplified.localeCompare(b.simplified));
  return out.slice(0, CEDICT_LIMIT);
}

/* ------------------------------------------------------------------ *
 * 产出
 * ------------------------------------------------------------------ */
function tsString(value) {
  // 安全地塞进模板字面量：转义反斜杠、反引号与 `${`
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
  return `\`${escaped}\``;
}

function writeFile(file, header, varName, tsv) {
  const body = `${header}\nexport const ${varName} = ${tsString(tsv)};\n`;
  fs.writeFileSync(path.join(OUT_DIR, file), body, 'utf8');
  const kb = (Buffer.byteLength(body, 'utf8') / 1024).toFixed(0);
  log(`写出 ${file} · ${tsv.split('\n').length} 条 · ${kb} KB`);
}

async function main() {
  fs.mkdirSync(CACHE, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const hskFiles = [];
  for (const s of SOURCES.hsk) hskFiles.push(await download(s));

  const allowed = new Set();
  const chars = new Set();
  for (const file of hskFiles) {
    const list = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const item of list) {
      const word = String(item?.hanzi ?? '').trim();
      if (!word) continue;
      allowed.add(word);
      // 「词表里出现过的字」也算常用字，用来把单字条目一并收进汉英词典
      for (const ch of word) if (CJK.test(ch)) chars.add(ch);
    }
  }
  for (const ch of chars) allowed.add(ch);
  log(`HSK 1~6 筛选集 ${allowed.size} 条（${chars.size} 个常用单字在内）`);

  const ecdictCsv = await download(SOURCES.ecdict);
  const cedictGz = await download(SOURCES.cedict);

  const ecdict = buildEcdict(ecdictCsv);
  const cedict = buildCedict(cedictGz, allowed);

  writeFile(
    'ecdict.generated.ts',
    `/**
 * 简明英汉词典 · 内置子集（英 → 中）。
 *
 * 由 \`scripts/build-dictionary.mjs\` 生成，请勿手改；重新生成：\`npm run dict:build\`。
 * 数据来源：ECDICT（https://github.com/skywind3000/ECDICT），MIT License。
 * 字段（制表符分隔，一行一条）：word / 音标 / 标签 / 词频档 / 中文释义
 */`,
    'ECDICT_TSV',
    ecdict.map((e) => [e.word, e.phonetic, e.tags, freqBucket(e.rank), e.translation].join('\t')).join('\n'),
  );

  writeFile(
    'cedict.generated.ts',
    `/**
 * CC-CEDICT 汉英词典 · 内置子集（中 → 英）。
 *
 * 由 \`scripts/build-dictionary.mjs\` 生成，请勿手改；重新生成：\`npm run dict:build\`。
 * 数据来源：CC-CEDICT（https://cc-cedict.org/），CC BY-SA 4.0。
 * 字段（制表符分隔，一行一条）：简体 / 拼音（数字声调） / 繁体（与简体相同则空） / 英文释义
 */`,
    'CEDICT_TSV',
    cedict.map((e) => [e.simplified, e.pinyin, e.traditional, e.gloss].join('\t')).join('\n'),
  );
}

main().catch((error) => {
  console.error('[dict] 构建失败：', error.message);
  process.exit(1);
});
