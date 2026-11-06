import { CEDICT_TSV } from './cedict.generated';

/**
 * CC-CEDICT 汉英词典（内置子集，中 → 英）。
 *
 * 数据由 `scripts/build-dictionary.mjs` 从 CC-CEDICT 裁出（HSK 1~6 常用词 + 常用单字），
 * 随包内置、离线可用。一行一条、制表符分隔：简体 / 拼音（数字声调） / 繁体 / 英文释义。
 * 数据来源：https://cc-cedict.org/ ，CC BY-SA 4.0。
 */

export interface CedictRow {
  simplified: string;
  /** 声调数字拼音，如 `chu1 kou3` */
  pinyin: string;
  /** 繁体写法（与简体相同则为空串） */
  traditional: string;
  /** 英文释义，多条用「；」连接 */
  gloss: string;
}

let table: Map<string, CedictRow> | null = null;

function parse(): Map<string, CedictRow> {
  if (table) return table;
  const map = new Map<string, CedictRow>();
  for (const line of CEDICT_TSV.split('\n')) {
    if (!line) continue;
    const [simplified, pinyin, traditional, gloss] = line.split('\t');
    if (!simplified || !gloss) continue;
    map.set(simplified, {
      simplified,
      pinyin: pinyin ?? '',
      traditional: traditional ?? '',
      gloss,
    });
  }
  table = map;
  return map;
}

export function cedictLookup(raw: string): CedictRow | null {
  const word = raw.trim();
  if (!word) return null;
  return parse().get(word) ?? null;
}

/**
 * 长词优先扫描：中文没有词边界，所以按「词典收录的词出现在文本里」来挑注释词。
 * 一次遍历全部词条（几千条），成本可忽略；
 * 结果按出现位置排序、长词优先，并丢掉与已选词**区间重叠**的碎片
 * （否则「图书馆」会连带把「图」也挑出来）。
 */
export function cedictScan(text: string, limit = 6): CedictRow[] {
  const found: { row: CedictRow; at: number }[] = [];
  for (const row of parse().values()) {
    const at = text.indexOf(row.simplified);
    if (at >= 0) found.push({ row, at });
  }
  // 选词按「长词优先」——中文里长词承载的信息更多，也该挤掉它内部包含的单字
  found.sort(
    (a, b) => b.row.simplified.length - a.row.simplified.length || a.at - b.at,
  );

  const taken: [number, number][] = [];
  const picked: { row: CedictRow; at: number }[] = [];
  for (const item of found) {
    const start = item.at;
    const end = start + item.row.simplified.length;
    if (taken.some(([s, e]) => start < e && end > s)) continue;
    taken.push([start, end]);
    picked.push(item);
    if (picked.length >= limit) break;
  }
  // 展示顺序仍按原文出现位置
  picked.sort((a, b) => a.at - b.at);
  return picked.map((item) => item.row);
}

/* ------------------------------------------------------------------ *
 * 拼音：`chu1 kou3` → `chū kǒu`
 * ------------------------------------------------------------------ */
const TONE_MARKS: Record<string, string[]> = {
  a: ['ā', 'á', 'ǎ', 'à'],
  o: ['ō', 'ó', 'ǒ', 'ò'],
  e: ['ē', 'é', 'ě', 'è'],
  i: ['ī', 'í', 'ǐ', 'ì'],
  u: ['ū', 'ú', 'ǔ', 'ù'],
  'ü': ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
};

/** 按「a o e 优先，iu/ui 标在后一个，否则标最后一个元音」定位声调符号 */
function toneTarget(syllable: string): { index: number; vowel: string } | null {
  const lower = syllable.toLowerCase();
  const order = ['a', 'o', 'e'];
  for (const vowel of order) {
    const index = lower.indexOf(vowel);
    if (index >= 0) return { index, vowel };
  }
  const iu = lower.indexOf('iu');
  if (iu >= 0) return { index: iu + 1, vowel: 'u' };
  const ui = lower.indexOf('ui');
  if (ui >= 0) return { index: ui + 1, vowel: 'i' };
  for (let i = lower.length - 1; i >= 0; i -= 1) {
    const vowel = lower[i];
    if (vowel === 'i' || vowel === 'u' || vowel === 'ü') return { index: i, vowel };
  }
  return null;
}

function accentSyllable(syllable: string): string {
  const match = /^([a-zA-Zü:]+)([1-5])$/.exec(syllable);
  if (!match) return syllable.replace('u:', 'ü');
  const [, bodyRaw, toneDigit] = match;
  const tone = Number(toneDigit);
  const body = bodyRaw.replace(/u:/g, 'ü').replace(/v/g, 'ü');
  if (tone === 5) return body;

  const target = toneTarget(body);
  if (!target) return body;
  const marks = TONE_MARKS[target.vowel];
  if (!marks) return body;
  const replacement = marks[tone - 1];
  return `${body.slice(0, target.index)}${replacement}${body.slice(target.index + 1)}`;
}

/** `chu1 kou3` → `chū kǒu`；已经带声调符号或格式异常时原样返回 */
export function pinyinWithTones(pinyin: string): string {
  const trimmed = pinyin.trim();
  if (!trimmed) return '';
  return trimmed
    .split(/\s+/)
    .map(accentSyllable)
    .join(' ');
}
