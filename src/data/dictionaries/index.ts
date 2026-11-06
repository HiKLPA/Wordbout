import { appConfig } from '@/config/appConfig';

import { cedictLookup, cedictScan, pinyinWithTones } from './cedict';
import { ecdictLookup, ecdictReverse, ecdictReverseScan } from './ecdict';
import { wiktionaryLookup } from './wiktionary';
import {
  DictError,
  type DictEntry,
  type DictFrom,
  type DictId,
  type DictMeta,
  type DictSense,
} from './types';

export { DictError } from './types';
export type { DictEntry, DictErrorCode, DictFrom, DictId, DictMeta, DictSense } from './types';

/**
 * 前缀联想（英 → 中）：已输入的字母 → 以它开头的词，按常用度排序。
 * 「中英翻译」输入框下方的候选就是它（纯本地，唯一下线也不受影响）。
 */
export { ecdictSuggest } from './ecdict';
export type { EcdictSuggestion } from './ecdict';

/**
 * 词典注册表（FR-M-1 / FR-M-3 / FR-M-4）。
 *
 * 四本词典、两个查询方向，每个方向都有至少两本可切换：
 *   - 英 → 中：简明英汉词典（ECDICT 内置，离线）/ Wiktionary（在线，英英释义）
 *   - 中 → 英：CC-CEDICT 汉英词典（内置）/ 简明汉英（ECDICT 反向索引，内置）
 * 全部来自开源数据（见每本的 `source` / `license`）。**CC BY-SA 4.0 要求署名**，
 * 而翻译页按设计已不再展示来源行 —— 署名目前全 App 无处承载，待补（建议放「关于」页
 * 的开源致谢区，用 `source` / `license` 两个字段生成，勿丢许可信息）。
 */
export const DICTIONARIES: DictMeta[] = [
  {
    id: 'ecdict',
    name: '简明英汉词典',
    from: 'en',
    bundled: true,
    source: 'ECDICT',
    license: 'MIT',
  },
  {
    id: 'wiktionary',
    name: 'Wiktionary',
    from: 'en',
    bundled: false,
    source: 'Wiktionary',
    license: 'CC BY-SA 4.0',
  },
  {
    id: 'cedict',
    name: 'CC-CEDICT 汉英词典',
    from: 'zh',
    bundled: true,
    source: 'CC-CEDICT',
    license: 'CC BY-SA 4.0',
  },
  {
    id: 'ecdict-reverse',
    name: '简明汉英',
    from: 'zh',
    bundled: true,
    source: 'ECDICT',
    license: 'MIT',
  },
];

const BY_ID = new Map<DictId, DictMeta>(DICTIONARIES.map((meta) => [meta.id, meta]));

export function dictionaryById(id: string): DictMeta | undefined {
  return BY_ID.get(id as DictId);
}

/** 某个方向可用的词典（顺序即界面上的推荐顺序） */
export function dictionariesFor(from: DictFrom): DictMeta[] {
  return DICTIONARIES.filter((meta) => meta.from === from);
}

/** 方向默认词典；配置里的 `defaultDictionary` 不匹配该方向时回落第一个可用项 */
export function defaultDictionaryFor(from: DictFrom): DictId {
  const available = dictionariesFor(from);
  const configured = available.find((meta) => meta.id === appConfig.translation.defaultDictionary);
  return (configured ?? available[0]).id;
}

/* ------------------------------------------------------------------ *
 * 词条归一化
 * ------------------------------------------------------------------ */
/** 词性前缀：`n.` / `adj.` / `vt.` …（ECDICT 把词性写进释义正文） */
const POS_PREFIX = /^([a-z]{1,6}\.)\s*/i;

/** 把「n. 出口, 退场；vi. 退出」这类释义拆成「词性 + 正文」的义项列表 */
function splitSenses(text: string, separator: RegExp, limit = 5): DictSense[] {
  const out: DictSense[] = [];
  for (const chunk of text.split(separator)) {
    const piece = chunk.trim();
    if (!piece) continue;
    const match = POS_PREFIX.exec(piece);
    out.push({
      pos: match ? match[1] : '',
      text: match ? piece.slice(match[0].length) : piece,
    });
    if (out.length >= limit) break;
  }
  return out;
}

function ecdictEntry(id: DictId, word: string): DictEntry[] {
  const hit = ecdictLookup(word);
  if (!hit) return [];
  return [
    {
      dictId: id,
      headword: hit.row.word,
      query: hit.lemma ? word.trim().toLowerCase() : hit.row.word,
      phonetic: hit.row.phonetic ? `/${hit.row.phonetic}/` : '',
      pinyin: '',
      traditional: '',
      tags: hit.row.tags,
      frequency: hit.row.frequency,
      senses: splitSenses(hit.row.translation, /[；;]/, 5),
      examples: [],
      lemma: hit.lemma,
    },
  ];
}

function cedictEntry(id: DictId, word: string): DictEntry[] {
  const row = cedictLookup(word);
  if (!row) return [];
  return [
    {
      dictId: id,
      headword: row.simplified,
      query: row.simplified,
      phonetic: '',
      pinyin: pinyinWithTones(row.pinyin),
      traditional: row.traditional,
      tags: [],
      frequency: 0,
      senses: splitSenses(row.gloss, /[；;]/, 5),
      examples: [],
      lemma: null,
    },
  ];
}

async function wiktionaryEntry(id: DictId, word: string): Promise<DictEntry[]> {
  const result = await wiktionaryLookup(word);
  if (!result) return [];
  return [
    {
      dictId: id,
      headword: result.headword,
      query: word.trim().toLowerCase(),
      phonetic: result.phonetic,
      pinyin: '',
      traditional: '',
      tags: [],
      frequency: 0,
      senses: result.senses,
      examples: result.examples,
      lemma: null,
    },
  ];
}

/** 用「英文词 + 命中的中文片段」拼一条反查词条 */
function reverseEntry(id: DictId, word: string, fragment: string): DictEntry | null {
  const hit = ecdictLookup(word);
  if (!hit) return null;
  return {
    dictId: id,
    headword: hit.row.word,
    query: fragment,
    phonetic: hit.row.phonetic ? `/${hit.row.phonetic}/` : '',
    pinyin: '',
    traditional: '',
    tags: hit.row.tags,
    frequency: hit.row.frequency,
    senses: [{ pos: '', text: fragment }],
    examples: [],
    lemma: null,
  };
}

/**
 * 用指定词典查一个词。
 * 命中返回词条列表（反查词典一次可能给多个候选），未收录返回空数组；
 * 在线词典网络异常时抛 `DictError`。
 */
export async function lookupIn(id: DictId, word: string): Promise<DictEntry[]> {
  const query = word.trim();
  if (!query) return [];
  switch (id) {
    case 'ecdict':
      return ecdictEntry(id, query);
    case 'cedict':
      return cedictEntry(id, query);
    case 'wiktionary':
      return wiktionaryEntry(id, query);
    case 'ecdict-reverse':
      return ecdictReverse(query, 6)
        .map((hit) => reverseEntry(id, hit.word, hit.fragments[0] ?? query))
        .filter((entry): entry is DictEntry => entry !== null);
    default:
      return [];
  }
}

/* ------------------------------------------------------------------ *
 * 从一段文本里挑出值得注释的词
 * ------------------------------------------------------------------ */
/** 高频虚词不单独做注释，否则注释区会被 the / of / is 占满 */
const EN_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'of', 'to', 'in', 'on', 'at', 'for', 'with',
  'from', 'by', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am', 'do', 'does',
  'did', 'have', 'has', 'had', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you',
  'he', 'she', 'we', 'they', 'them', 'his', 'her', 'their', 'our', 'my', 'your', 'not', 'no',
  'so', 'than', 'then', 'there', 'here', 'when', 'where', 'what', 'which', 'who', 'how',
  'why', 'will', 'would', 'can', 'could', 'shall', 'should', 'may', 'might', 'must', 'very',
  'too', 'also', 'just', 'only', 'more', 'most', 'some', 'any', 'all', 'one', 'two', 'about',
]);

/** 英文文本里的实词（去重、保序、过滤虚词） */
function englishWords(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const match of text.toLowerCase().matchAll(/[a-z][a-z'’-]{2,}/g)) {
    const word = match[0].replace(/['’-]+$/, '');
    if (word.length < 3 || EN_STOPWORDS.has(word) || seen.has(word)) continue;
    seen.add(word);
    out.push(word);
  }
  return out;
}

/**
 * 只走**内置**词典的同步版本：拍照 / 语音页用，不联网、不阻塞。
 * 在线词典（Wiktionary）在这里返回空数组。
 */
export function collectNotesSync(
  from: DictFrom,
  text: string,
  id: DictId,
  limit = appConfig.translation.maxNotes,
): DictEntry[] {
  const meta = dictionaryById(id);
  if (!meta || meta.from !== from || !meta.bundled) return [];

  if (from === 'en') {
    const out: DictEntry[] = [];
    for (const word of englishWords(text)) {
      if (out.length >= limit) break;
      out.push(...ecdictEntry(id, word));
    }
    return out.slice(0, limit);
  }

  if (id === 'cedict') {
    const out: DictEntry[] = [];
    for (const row of cedictScan(text, limit)) {
      if (out.length >= limit) break;
      out.push(...cedictEntry(id, row.simplified));
    }
    return out.slice(0, limit);
  }

  const out: DictEntry[] = [];
  for (const hit of ecdictReverseScan(text, limit)) {
    if (out.length >= limit) break;
    const entry = reverseEntry(id, hit.word, hit.fragment);
    if (entry) out.push(entry);
  }
  return out;
}

/**
 * 收集词条注释（带联网能力）。
 * 在线词典每词一次请求，所以只取前 `appConfig.translation.onlineMaxLookups` 个候选词**并发**查询；
 * 只要拿到至少一条注释就不报错（免费服务对生僻词经常慢或直接 522，不该因此打扰用户），
 * 一条都没拿到时把首次失败原因带回界面。
 */
export async function collectNotes(
  from: DictFrom,
  text: string,
  id: DictId,
  limit = appConfig.translation.maxNotes,
): Promise<{ entries: DictEntry[]; error: DictError | null }> {
  const meta = dictionaryById(id);
  if (!meta || meta.from !== from) return { entries: [], error: null };
  if (meta.bundled) return { entries: collectNotesSync(from, text, id, limit), error: null };

  const words = englishWords(text).slice(0, appConfig.translation.onlineMaxLookups);
  const settled = await Promise.allSettled(words.map((word) => wiktionaryEntry(id, word)));

  const entries: DictEntry[] = [];
  let error: DictError | null = null;
  for (const result of settled) {
    if (result.status === 'fulfilled') entries.push(...result.value);
    else error ??= result.reason instanceof DictError ? result.reason : new DictError('network');
  }
  return { entries: entries.slice(0, limit), error: entries.length ? null : error };
}
