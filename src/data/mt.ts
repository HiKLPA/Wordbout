import { appConfig } from '@/config/appConfig';
import { chat, LlmError, parseJsonObject, str } from '@/data/llm';

/**
 * 整句机器翻译（FR-M-1 的「译文」部分）。
 *
 * 词典只能给词条级释义，整句译文交给已接入的大模型（IF-3）。
 * 与 `data/llm.ts` 的约定一致：只走 OpenAI 兼容接口、失败统一抛 `LlmError`，
 * 由调用方决定是「提示重试」还是「退化成词库逐词对照」。
 */

const SYSTEM_PROMPT = [
  '你是专业的中英互译引擎，面向中文母语学习者。',
  '只输出一个 JSON 对象，不要 markdown 代码围栏，不要任何解释文字。',
  'JSON 结构：{"lines":[{"target":"该句译文"}]}',
  '输入是一个 JSON 对象：{"from":"zh|en","to":"zh|en","sentences":["原句1","原句2"]}。',
  '要求：',
  '1) lines 数组的长度必须与 sentences 完全相同、顺序一一对应；',
  '2) 译文自然通顺，符合目标语言的表达习惯，不要逐字硬译；',
  '3) 不增删信息、不做解释、不加引号；',
  '4) sentences 里只有一句时 lines 也只有一条。',
].join('\n');

/** 把模型返回的 lines 归一化成纯字符串数组 */
function extractLines(raw: Record<string, unknown>): string[] {
  const list = raw.lines;
  if (!Array.isArray(list)) return [];
  return list.map((item) => {
    if (typeof item === 'string') return item.trim();
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      return str(obj.target ?? obj.translation ?? obj.text);
    }
    return '';
  });
}

/**
 * 逐句翻译。
 * 返回数组与入参 `sentences` 等长；模型少给或多给句子时按最短对齐，缺失的句子留空串。
 */
export async function translateSentences(
  sentences: string[],
  from: 'zh' | 'en',
  to: 'zh' | 'en',
): Promise<string[]> {
  if (!sentences.length) return [];
  const payload = JSON.stringify({ from, to, sentences });
  const text = await chat(payload, SYSTEM_PROMPT);
  const raw = parseJsonObject(text);
  const lines = extractLines(raw);

  if (!lines.length) throw new LlmError('bad-response');
  const out = sentences.map((_, index) => lines[index] ?? '');
  if (!out.some((line) => line.length > 0)) throw new LlmError('bad-response');
  return out;
}

/** 字符数超过阈值时提示分段（FR-M-1，阈值走 `appConfig.translation.suggestSplitChars`） */
export function isTooLong(text: string): boolean {
  return text.length > appConfig.translation.suggestSplitChars;
}
