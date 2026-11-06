import { collectNotes, collectNotesSync, defaultDictionaryFor, dictionaryById } from '@/data/dictionaries';
import type { DictEntry, DictErrorCode, DictId } from '@/data/dictionaries';
import { isLlmConfigured } from '@/data/llm';
import { isTooLong, translateSentences } from '@/data/mt';

/**
 * 中英翻译（FR-M-1 / FR-M-3 / FR-M-4）。
 *
 * 两条腿分工：
 *   1. **整句译文** —— 走已接入的大模型（`data/mt.ts`，IF-3）。未配置密钥或请求失败时，
 *      退化为「词库逐词对照」，并在结果里标明引擎，不编造译文。
 *   2. **词条注释** —— 走开源词库（`data/dictionaries`，ECDICT / CC-CEDICT / Wiktionary），
 *      用户可切换词典；未收录就如实显示，不再输出「（演示译文）」这类占位内容。
 */

export type Lang = 'auto' | 'zh' | 'en';

export interface TranslationLine {
  source: string;
  target: string;
}

/** 整句译文由谁产出：`ai` 大模型 / `dict` 词库逐词对照 */
export type TranslationEngine = 'ai' | 'dict';

export interface TranslationResult {
  sourceLang: 'zh' | 'en';
  targetLang: 'zh' | 'en';
  /** 整段译文（逐句拼接） */
  target: string;
  /** 分层显示：逐句原文 / 译文 */
  lines: TranslationLine[];
  engine: TranslationEngine;
  /** 本次使用的词典 */
  dictId: DictId;
  /** 词条注释（来自所选词典，已按词典收录情况过滤） */
  notes: DictEntry[];
  /** 在线词典查询失败的原因；内置词典恒为 null */
  dictError: DictErrorCode | null;
  /** 超过 `appConfig.translation.suggestSplitChars` 时提示分段（FR-M-1） */
  tooLong: boolean;
  latencyMs: number;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?？。！])\s*|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 把查询语言映射到该方向真正可用的词典：传入的词典与方向不符时回落该方向默认词典 */
function resolveDict(from: 'zh' | 'en', id?: DictId): DictId {
  if (id) {
    const meta = dictionaryById(id);
    if (meta && meta.from === from) return id;
  }
  return defaultDictionaryFor(from);
}

/**
 * 词库逐词对照：把句子里命中的词条拼成一行。
 * 中文侧输出「原词（释义）」，英文侧只给词条本身；一个都没命中就返回空串，由界面提示未收录。
 */
function glossSentence(sentence: string, entries: DictEntry[], to: 'zh' | 'en'): string {
  const haystack = to === 'zh' ? sentence.toLowerCase() : sentence;
  const parts: string[] = [];
  for (const entry of entries) {
    if (!entry.query) continue;
    const needle = to === 'zh' ? entry.query.toLowerCase() : entry.query;
    if (!needle || !haystack.includes(needle)) continue;
    if (to === 'zh') {
      const meaning = entry.senses[0]?.text;
      if (!meaning) continue;
      const label = `${entry.query}（${meaning}）`;
      if (!parts.includes(label)) parts.push(label);
    } else {
      const label = entry.headword;
      if (label && !parts.includes(label)) parts.push(label);
    }
  }
  return parts.join(to === 'zh' ? '，' : ' ');
}

function assemble(
  sentences: string[],
  targets: string[],
  sourceLang: 'zh' | 'en',
): { lines: TranslationLine[]; target: string } {
  const lines = sentences.map((source, index) => ({ source, target: targets[index] ?? '' }));
  const target = lines
    .map((line) => line.target)
    .filter(Boolean)
    .join(sourceLang === 'zh' ? ' ' : '');
  return { lines, target };
}

/**
 * 词库版翻译（同步、离线、零成本）：只用内置词典，供拍照 / 语音页即时出结果。
 * 在线词典（Wiktionary）不支持这条路径，会被忽略。
 */
export function translateWithDictionary(
  text: string,
  sourceLang: Lang = 'auto',
  dictId?: DictId,
): TranslationResult {
  const started = Date.now();
  const src = sourceLang === 'auto' ? detectLang(text) : sourceLang;
  const target = src === 'zh' ? 'en' : 'zh';
  const dict = resolveDict(src, dictId);
  const sentences = splitSentences(text);
  const list = sentences.length ? sentences : [text];
  const notes = collectNotesSync(src, text, dict);
  const targets = list.map((sentence) => glossSentence(sentence, notes, target));
  const { lines, target: whole } = assemble(list, targets, src);

  return {
    sourceLang: src,
    targetLang: target,
    target: whole,
    lines,
    engine: 'dict',
    dictId: dict,
    notes,
    dictError: null,
    tooLong: isTooLong(text),
    latencyMs: Date.now() - started,
  };
}

/**
 * 完整翻译（异步）：优先用大模型出整句译文，失败或未配置密钥时退回词库逐词对照。
 * 词条注释按所选词典给出；在线词典失败只记录原因，不影响译文。
 */
export async function translate(
  text: string,
  sourceLang: Lang = 'auto',
  dictId?: DictId,
): Promise<TranslationResult> {
  const started = Date.now();
  const src = sourceLang === 'auto' ? detectLang(text) : sourceLang;
  const target = src === 'zh' ? 'en' : 'zh';
  const dict = resolveDict(src, dictId);
  const sentences = splitSentences(text);
  const list = sentences.length ? sentences : [text];

  const { entries, error } = await collectNotes(src, text, dict);

  let engine: TranslationEngine = 'dict';
  let targets: string[];
  if (isLlmConfigured()) {
    try {
      targets = await translateSentences(list, src, target);
      engine = 'ai';
    } catch {
      // 大模型不可用（未配置 / 网络 / 超时 / 返回异常）时降级，不清空用户输入
      targets = list.map((sentence) => glossSentence(sentence, entries, target));
    }
  } else {
    targets = list.map((sentence) => glossSentence(sentence, entries, target));
  }

  const { lines, target: whole } = assemble(list, targets, src);

  return {
    sourceLang: src,
    targetLang: target,
    target: whole,
    lines,
    engine,
    dictId: dict,
    notes: entries,
    dictError: error?.code ?? null,
    tooLong: isTooLong(text),
    latencyMs: Date.now() - started,
  };
}

/** 源语言识别：汉字数 ≥ 字母数即判为中文 */
export function detectLang(text: string): 'zh' | 'en' {
  const zh = (text.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const en = (text.match(/[a-zA-Z]/g) ?? []).length;
  return zh >= en ? 'zh' : 'en';
}

/** 拍照 / 语音翻译用的（本地）识别结果模拟，正式版由 OCR / ASR 服务返回 */
export function recognizeTextFromImage(seed: string): { lines: string[]; failed: boolean } {
  const ok = seed.length % 7 !== 0;
  if (!ok) return { lines: [], failed: true };
  return {
    lines: ['EXIT / 出口', 'Please keep your ticket until you leave.', 'Mind the gap between the train and the platform.'],
    failed: false,
  };
}

export const voicePhrases = [
  'Where is the nearest subway station?',
  'Could I have the bill, please?',
  'I would like to book a table for two.',
];
