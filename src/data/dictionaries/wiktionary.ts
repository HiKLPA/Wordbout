import { appConfig } from '@/config/appConfig';
import { DictError, type DictSense } from './types';

/**
 * Wiktionary 英语释义（英 → 英，在线）。
 *
 * 走免费、免密钥的 `dictionaryapi.dev`（数据来自 Wiktionary，CC BY-SA 4.0），
 * 所以这本词典不随包内置、必须联网；失败时抛 `DictError` 由界面提示。
 * 与内置的「简明英汉词典」是两套完全不同的数据源，切换后看到的释义体系不同。
 */

const POS_SHORT: Record<string, string> = {
  noun: 'n.',
  verb: 'v.',
  adjective: 'adj.',
  adverb: 'adv.',
  pronoun: 'pron.',
  preposition: 'prep.',
  conjunction: 'conj.',
  interjection: 'int.',
  determiner: 'det.',
  numeral: 'num.',
  article: 'art.',
  abbreviation: 'abbr.',
  prefix: 'pref.',
  suffix: 'suf.',
};

interface ApiDefinition {
  definition?: unknown;
  example?: unknown;
}

interface ApiMeaning {
  partOfSpeech?: unknown;
  definitions?: unknown;
}

interface ApiPhonetic {
  text?: unknown;
}

interface ApiEntry {
  word?: unknown;
  phonetic?: unknown;
  phonetics?: unknown;
  meanings?: unknown;
}

export interface WiktionaryResult {
  headword: string;
  phonetic: string;
  senses: DictSense[];
  examples: string[];
}

const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** 把 API 返回的条目数组压成界面要的一句话释义列表 */
function normalize(raw: ApiEntry, fallbackWord: string): WiktionaryResult | null {
  const headword = asString(raw.word) || fallbackWord;
  const phonetics = Array.isArray(raw.phonetics) ? (raw.phonetics as ApiPhonetic[]) : [];
  const phonetic =
    asString(raw.phonetic) ||
    phonetics.map((p) => asString(p?.text)).find((text) => text.length > 0) ||
    '';

  const senses: DictSense[] = [];
  const examples: string[] = [];
  const meanings = Array.isArray(raw.meanings) ? (raw.meanings as ApiMeaning[]) : [];
  for (const meaning of meanings) {
    const pos = POS_SHORT[asString(meaning?.partOfSpeech)] ?? asString(meaning?.partOfSpeech);
    const definitions = Array.isArray(meaning?.definitions)
      ? (meaning.definitions as ApiDefinition[])
      : [];
    for (const item of definitions) {
      const text = asString(item?.definition);
      if (text && senses.length < 8) senses.push({ pos, text });
      const example = asString(item?.example);
      if (example && examples.length < 3 && !examples.includes(example)) examples.push(example);
    }
  }
  if (!senses.length) return null;
  return { headword, phonetic, senses, examples };
}

/** 查询一个英文词；词典里没有这个词返回 null，网络 / 响应异常抛 `DictError` */
export async function wiktionaryLookup(word: string): Promise<WiktionaryResult | null> {
  const query = word.trim().toLowerCase();
  if (!query) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), appConfig.translation.onlineTimeoutMs);
  try {
    const res = await fetch(
      `${appConfig.translation.wiktionaryUrl}/${encodeURIComponent(query)}`,
      { signal: controller.signal },
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new DictError('network');

    const data: unknown = await res.json();
    if (!Array.isArray(data) || !data.length) return null;
    return normalize(data[0] as ApiEntry, query);
  } catch (error) {
    if (error instanceof DictError) throw error;
    if (error instanceof Error && error.name === 'AbortError') throw new DictError('timeout');
    throw new DictError('network');
  } finally {
    clearTimeout(timer);
  }
}
