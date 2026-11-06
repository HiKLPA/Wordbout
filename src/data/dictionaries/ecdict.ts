import { ECDICT_TSV } from './ecdict.generated';

/**
 * 简明英汉词典（ECDICT 内置子集，英 → 中）。
 *
 * 数据由 `scripts/build-dictionary.mjs` 从 ECDICT 裁出，随包内置、离线可用。
 * 一行一条、制表符分隔：word / 音标 / 标签 / 词频档 / 中文释义。
 */

export interface EcdictRow {
  word: string;
  /** 音标（不带斜杠，展示时补） */
  phonetic: string;
  /** 考试 / 词表标签：ox zk gk cet4 cet6 ky toefl ielts gre c4 c5 */
  tags: string[];
  /** 词频档：1 高频（COCA/BNC 前 3000）/ 2 常用（前 8000）/ 3 一般 / 0 无数据 */
  frequency: number;
  /** 中文释义（词性标记内联在文本里，如「n. 出口；vi. 退出」） */
  translation: string;
}

let table: Map<string, EcdictRow> | null = null;

function parse(): Map<string, EcdictRow> {
  if (table) return table;
  const map = new Map<string, EcdictRow>();
  for (const line of ECDICT_TSV.split('\n')) {
    if (!line) continue;
    const [word, phonetic, tags, freq, translation] = line.split('\t');
    if (!word || !translation) continue;
    map.set(word, {
      word,
      phonetic: phonetic ?? '',
      tags: tags ? tags.split(' ') : [],
      frequency: Number(freq) || 0,
      translation,
    });
  }
  table = map;
  return map;
}

/** 常见屈折变化 → 原型候选（词典本身也收了不少变形，这层只是兜底） */
function stemVariants(word: string): string[] {
  const out: string[] = [];
  const push = (v: string) => {
    if (v.length >= 2 && !out.includes(v)) out.push(v);
  };
  if (word.endsWith("'s") || word.endsWith('’s')) push(word.slice(0, -2));
  if (word.endsWith('ies') && word.length > 4) push(`${word.slice(0, -3)}y`);
  if (word.endsWith('es') && word.length > 3) push(word.slice(0, -2));
  if (word.endsWith('s') && word.length > 3) push(word.slice(0, -1));
  if (word.endsWith('ed') && word.length > 3) {
    push(word.slice(0, -2));
    push(word.slice(0, -1));
    // stopped → stop（去掉重复的尾辅音）
    if (/([bdfglmnprt])\1ed$/.test(word)) push(word.slice(0, -3));
  }
  if (word.endsWith('ing') && word.length > 4) {
    push(word.slice(0, -3));
    push(`${word.slice(0, -3)}e`);
    if (/([bdfglmnprt])\1ing$/.test(word)) push(word.slice(0, -4));
  }
  if (word.endsWith('ly') && word.length > 4) push(word.slice(0, -2));
  if (word.endsWith('er') && word.length > 4) {
    push(word.slice(0, -2));
    push(word.slice(0, -1));
    if (/([bdfglmnprt])\1er$/.test(word)) push(word.slice(0, -3));
  }
  if (word.endsWith('est') && word.length > 5) push(word.slice(0, -3));
  return out;
}

export interface EcdictHit {
  row: EcdictRow;
  /** 命中的原型（与原词不同时才是原型，否则为 null） */
  lemma: string | null;
}

/** 查词：先精确命中，再按屈折变化回退到原型 */
export function ecdictLookup(raw: string): EcdictHit | null {
  const map = parse();
  const word = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!word) return null;

  const exact = map.get(word);
  if (exact) return { row: exact, lemma: null };

  for (const candidate of stemVariants(word)) {
    const hit = map.get(candidate);
    if (hit) return { row: hit, lemma: candidate };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * 前缀联想：已输入的字母 → 以它开头的词（「中英翻译」输入框下方的候选）
 * ------------------------------------------------------------------ */
/** 词频档归一化：「无数据」与「一般」同档，避免 0 排到 1 前面 */
function freqRank(row: EcdictRow): number {
  return row.frequency === 0 ? 4 : row.frequency;
}

/** 候选词排序：常用词优先 → 词表覆盖多的优先 → 短词优先（更基础）→ 字母序 */
function compareSuggest(a: EcdictRow, b: EcdictRow): number {
  return (
    freqRank(a) - freqRank(b) ||
    b.tags.length - a.tags.length ||
    a.word.length - b.word.length ||
    a.word.localeCompare(b.word)
  );
}

let ranked: EcdictRow[] | null = null;

/** 全表按「常用度」排一次（首次使用时构建）：扫描时取到的前 n 个命中即是最好的 n 个 */
function rankedRows(): EcdictRow[] {
  if (ranked) return ranked;
  ranked = [...parse().values()].sort(compareSuggest);
  return ranked;
}

/** 义项分隔（`；` / 半角分号 / 数据里的换行，含生成时被转义成字面的 `\r` `\n`） */
const SENSE_BREAK = /\\[rn]|\r|\n/g;

/** 释义摘要：取第一条义项，过长截断 —— 联想行只有一行地方，给太多字会被省略号吃掉 */
function senseSummary(translation: string, maxLen = 28): string {
  const flat = translation.replace(SENSE_BREAK, '；');
  const first = flat
    .split(/[；;]/)
    .map((part) => part.trim())
    .find((part) => part.length > 0);
  if (!first) return '';
  return first.length > maxLen ? `${first.slice(0, maxLen)}…` : first;
}

export interface EcdictSuggestion {
  word: string;
  /** 中文释义摘要（首条义项，已去掉换行；供联想行右侧一行显示） */
  translation: string;
}

/**
 * 前缀联想：返回以 `prefix` 开头的词（带中文释义摘要），按常用度排序（最多 `limit` 个）。
 *
 * - 只认**单个英文词**的前缀（字母 + `'` / `-`）；空串、中文、带空格的多词输入一律返回空；
 * - **已经是一个完整收录词时，它自己排在第一位**（与常见输入法一致）：如输入 `type`
 *   首位就是 `type`，点一下即可直接翻译它；其余候选按常用度跟在后面，不会把它重复列出；
 * - 词表一万条上下，直接扫排好序的全表、凑够 `limit` 就停，不额外建索引；
 * - 同步、纯本地，不联网（离线可用）。
 */
export function ecdictSuggest(prefix: string, limit = 8): EcdictSuggestion[] {
  const query = prefix.trim().toLowerCase();
  if (!query || !/^[a-z][a-z'-]*$/.test(query)) return [];

  const out: EcdictSuggestion[] = [];

  // 输入本身就是一个完整收录词 → 放首位（「候选里第一条就是它」的输入法手感）
  const exact = parse().get(query);
  if (exact) out.push({ word: exact.word, translation: senseSummary(exact.translation) });

  for (const row of rankedRows()) {
    // 与首位重复的那条跳过（已收录的完整词刚才已经给过）
    if (row.word === query || !row.word.startsWith(query)) continue;
    out.push({ word: row.word, translation: senseSummary(row.translation) });
    if (out.length >= limit) break;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 反查索引：中文片段 → 英文词（「简明汉英」用的就是它）
 * ------------------------------------------------------------------ */
const CJK = /[\u3400-\u9fff]/;
/** 词性前缀：n. / vt. / adj. …（释义里内联的词性标记） */
const POS_PREFIX = /^[a-z]{1,6}\.\s*/i;

/** 把一条中文释义切成可反查的片段：`n. 出口, 退场(戏院)` → ['出口', '退场'] */
function fragmentsOf(translation: string): string[] {
  const out: string[] = [];
  for (const raw of translation.split(/[；;，,、]/)) {
    const piece = raw
      .replace(POS_PREFIX, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/（[^）]*）/g, '')
      .trim();
    if (!piece || piece.length > 8) continue;
    if (!CJK.test(piece)) continue;
    if (piece.includes('…') || piece.includes('...')) continue;
    if (!out.includes(piece)) out.push(piece);
  }
  return out.slice(0, 6);
}

/** 索引槽位：记录该片段出现在这个词释义里的第几个位置（越靠前越是核心义项） */
interface ReverseSlot {
  word: string;
  position: number;
  /** 该词命中的考试 / 词表标签数（越多越核心，用来压住 col 这类冷僻词） */
  tags: number;
  /** 词频档（归一化后，「无数据」与「一般」同为 4） */
  frequency: number;
}

let reverse: Map<string, ReverseSlot[]> | null = null;

/** 反查索引：中文片段 → 词（带片段位置，首次使用时才构建） */
function reverseIndex(): Map<string, ReverseSlot[]> {
  if (reverse) return reverse;
  const index = new Map<string, ReverseSlot[]>();
  for (const row of parse().values()) {
    const slot: Omit<ReverseSlot, 'position'> = {
      word: row.word,
      tags: row.tags.length,
      frequency: row.frequency === 0 ? 4 : row.frequency,
    };
    fragmentsOf(row.translation).forEach((fragment, position) => {
      const bucket = index.get(fragment);
      if (!bucket) index.set(fragment, [{ ...slot, position }]);
      else if (bucket.length < 16 && !bucket.some((item) => item.word === row.word)) {
        bucket.push({ ...slot, position });
      }
    });
  }
  reverse = index;
  return index;
}

/**
 * 候选词排序：先看片段是不是核心义项，再看词表覆盖与词频，最后看词长（短词通常更基础）。
 *
 * 词表覆盖必须排在词长之前：`出口` 的 pos=0 候选里有 exit / outlet / col，
 * 只按词长排会让词典里释义为「出口, 山坳」的三字母冷僻词 col 挤掉真正该给的 exit。
 */
function compareSlots(a: ReverseSlot, b: ReverseSlot): number {
  return (
    a.position - b.position ||
    b.tags - a.tags ||
    a.frequency - b.frequency ||
    a.word.length - b.word.length ||
    a.word.localeCompare(b.word)
  );
}

export interface ReverseHit {
  word: string;
  /** 该英文词里命中中文查询的片段 */
  fragments: string[];
}

/**
 * 中文 → 英文反查。
 * 先精确命中片段，再退化为「包含查询」的片段（按片段长度排序，越接近查询词越靠前）。
 */
export function ecdictReverse(raw: string, limit = 8): ReverseHit[] {
  const query = raw.trim();
  if (!query) return [];
  const index = reverseIndex();

  const exact = index.get(query);
  if (exact) {
    return [...exact]
      .sort(compareSlots)
      .slice(0, limit)
      .map((slot) => ({ word: slot.word, fragments: [query] }));
  }

  // 模糊：片段里包含查询词，优先更短的片段（更贴近查询本身）
  const matches: { fragment: string; slots: ReverseSlot[] }[] = [];
  for (const [fragment, slots] of index) {
    if (fragment.includes(query)) matches.push({ fragment, slots });
  }
  matches.sort((a, b) => a.fragment.length - b.fragment.length);

  const seen = new Set<string>();
  const out: ReverseHit[] = [];
  for (const match of matches) {
    for (const slot of [...match.slots].sort(compareSlots)) {
      if (seen.has(slot.word)) continue;
      seen.add(slot.word);
      out.push({ word: slot.word, fragments: [match.fragment] });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/**
 * 中文文本的「反查扫描」：找出文本里出现过的中文片段，各配一个英文词。
 * 中文没有词边界，所以按「片段出现在文本里」来判断，按出现位置排序、长片段优先。
 */
export function ecdictReverseScan(
  text: string,
  limit = 6,
): { fragment: string; word: string }[] {
  const index = reverseIndex();
  const found: { fragment: string; at: number; slot: ReverseSlot }[] = [];
  for (const [fragment, slots] of index) {
    if (!slots.length) continue;
    const at = text.indexOf(fragment);
    if (at < 0) continue;
    // 同一片段可能对应多个词，取排位最高的那个
    const best = [...slots].sort(compareSlots)[0];
    found.push({ fragment, at, slot: best });
  }
  // 选词按「长片段优先」，用来挤掉「图书馆」里的「图」这种碎片
  found.sort((a, b) => b.fragment.length - a.fragment.length || a.at - b.at);

  const taken: [number, number][] = [];
  const picked: { fragment: string; at: number; slot: ReverseSlot }[] = [];
  for (const item of found) {
    const start = item.at;
    const end = start + item.fragment.length;
    // 与已选片段重叠的一律丢掉，避免单字噪声
    if (taken.some(([s, e]) => start < e && end > s)) continue;
    taken.push([start, end]);
    picked.push(item);
    if (picked.length >= limit) break;
  }
  // 展示顺序仍按原文出现位置
  picked.sort((a, b) => a.at - b.at);
  return picked.map((item) => ({ fragment: item.fragment, word: item.slot.word }));
}
