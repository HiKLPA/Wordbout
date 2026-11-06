import { appConfig } from '@/config/appConfig';
import { chat, isLlmConfigured, parseJsonObject, strList } from '@/data/llm';
import { tightenCjkSpacing } from '@/domain/text';
import { loadJSON, saveJSON } from '@/lib/storage';

/**
 * AI 探索「空态示例提问」的数据层（2026-10-16）。
 *
 * 空态（还没提问时）纵向排几张**示例提问**卡，点一条即发问 —— 让用户一眼看懂「这里能做什么」。
 * 文案不再写死：界面先用一份内置示例兜底（立即可点），同时把**用户最近的学习情况**
 * （当前等级 / 正在学的词库 / 最近学过的词 / 收藏的词 / 错过的词）交给模型，
 * 请它现编 3 条「他接下来最可能想问的」，回来把那几条兜底示例换掉。
 *
 * 这样建议才跟得上「最近在学什么」：换等级、学新词、收藏词变化都会让上下文签名变，
 * 缓存键随之改变 → 重新生成；同一上下文在 `suggestTtlMs` 内命中缓存，不重复计费（FR-M-5）。
 *
 * 失败一律吞掉、返回空数组：它只是引导，不该在空态弹错误；界面上那几条兜底示例继续用。
 */

/** 缓存结构版本：提示词或字段一改就 +1，旧条目读到即作废 */
const SUGGEST_VERSION = 1;
/**
 * 缓存键前缀。刻意挂在 `ai-explore:` 下 —— 「设置」里的**清除答案缓存**与占用统计
 * 都按这个前缀走（`data/aiExplore.ts` 的 `clearAiCache` / `aiCacheBytes`），
 * 这份建议同样是可再生的缓存，理当一起清掉、一起计入。
 */
const SUGGEST_PREFIX = 'ai-explore:suggest:';
/**
 * 单条建议的字数上限。提示词里要的是「不超过 16 字」，但实测模型常给到 20~26 字
 * （「abandon 和 abandonment 有什么区别」这种），卡在 24 会把好问题误杀，放到 28
 * （与「建议追问」同一档）—— 真写成整句话的（30 字以上）挡在外面。
 */
const SUGGEST_MAX_CHARS = 28;
/** 一条建议里至少要有一个汉字 —— 界面是中文的，整条写成英文的（模型偶尔不听话）直接丢掉 */
const CJK_CHAR = /[\u4e00-\u9fff]/;

/**
 * 生成建议时交给模型的「用户最近在学什么」。字段都可缺省 —— 新装 App 时一个都没有，
 * 这时模型给通用问题即可。
 */
export interface AiSuggestContext {
  /** 当前等级 / 题库的显示名，如 `CET6`、`日常` */
  level: string;
  /** 正在学的词库名（如 `CET6 核心词汇`） */
  book?: string;
  /** 最近学过的词（当前词库里已学到的最后几个） */
  learned?: readonly string[];
  /** 收藏的词（最近几条） */
  favorites?: readonly string[];
  /** 错过的词（最近练习 / 听写里的错词） */
  missed?: readonly string[];
}

interface StoredSuggest {
  at: number;
  v: number;
  items: string[];
}

const SYSTEM_PROMPT = [
  '你在一个面向中文母语者的英语学习 App 里，负责给「AI 探索」页面的空态想几条引导提问。',
  '用户还没提问，界面要摆 3 条他大概率想点的短问题 —— 你的任务就是猜他接下来想问什么。',
  '规则：',
  '1. 每条都是**用户口吻的提问**，**必须用简体中文写**（可以夹英文单词，但句子主体是中文），不超过 16 字；',
  '2. 3 条要覆盖**不同角度**（例如：某个生词的意思 / 两个词的辨析 / 用法与搭配 / 一批主题词 / 一个学习计划），',
  '   不要三条都是一个套路；',
  '3. 尽量用上他正在学、收藏或做错过的词（照抄原词、别改拼写）；实在没有合适的就用通用问题；',
  '4. 不要出现「根据你的学习记录」这类说明性话术，直接给一句能点的问题；',
  '5. 上下文里的等级名 / 词库名只是背景，别把它们当成要讲解的单词。',
  '示例：["abandon 这个词怎么用", "describe 和 depict 有什么区别", "给我 10 个商务场景常用词"]',
  '只输出一个 JSON 对象，不要 markdown 代码围栏，不要任何解释文字：',
  '{"suggestions": ["第一条问题", "第二条问题", "第三条问题"]}',
].join('\n');

/**
 * 结果 → 界面用的建议列表：去掉列表符号与首尾空白、丢掉过长的、**丢掉整句不含汉字的**
 * （界面文案是中文，模型偶尔会整条写成英文 —— 与其在中文界面上摆一句英文问题，不如少一条）、
 * 去重，最多 `appConfig.ai.suggestLimit` 条（3 条）。清不出来就返回空数组，由界面继续用兜底示例。
 */
function cleanSuggestions(value: unknown, limit: number): string[] {
  const out: string[] = [];
  for (const item of strList(value, 8)) {
    const text = tightenCjkSpacing(item)
      .replace(/^[-·•*、\d.\s]+/, '')
      .trim();
    if (!text || text.length > SUGGEST_MAX_CHARS) continue;
    if (!CJK_CHAR.test(text)) continue;
    if (out.some((x) => x.toLowerCase() === text.toLowerCase())) continue;
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

/** 上下文 → 交给模型的正文（只写有的那几行，别拿「暂无」把提示词撑满） */
function contextText(ctx: AiSuggestContext): string {
  const lines = [`当前等级：${ctx.level}`];
  if (ctx.book) lines.push(`正在学的词库：${ctx.book}`);
  if (ctx.learned?.length) lines.push(`最近学过：${ctx.learned.join('、')}`);
  if (ctx.favorites?.length) lines.push(`收藏的词：${ctx.favorites.join('、')}`);
  if (ctx.missed?.length) lines.push(`做错过的词：${ctx.missed.join('、')}`);
  return lines.join('\n');
}

/**
 * 上下文签名 → 缓存键。上下文一样就读同一份缓存（不再请求模型），
 * 学新词 / 换等级 / 收藏变了就自动变成新键，重新生成。
 */
function suggestKey(ctx: AiSuggestContext): string {
  const normalized = [
    ctx.level,
    ctx.book ?? '',
    (ctx.learned ?? []).join(','),
    (ctx.favorites ?? []).join(','),
    (ctx.missed ?? []).join(','),
  ]
    .join('|')
    .toLowerCase();
  let hash = 5381;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) | 0;
  }
  return `${SUGGEST_PREFIX}${(hash >>> 0).toString(36)}-${normalized.length}`;
}

/**
 * 按最近的学习情况生成空态示例提问（3 条）。
 * 没配置密钥、请求失败、超时、模型没给出可用内容 —— 一律返回空数组，界面保留兜底示例。
 */
export async function aiSuggestExamples(ctx: AiSuggestContext): Promise<string[]> {
  const limit = Math.max(0, appConfig.ai.suggestLimit);
  if (limit === 0 || !isLlmConfigured()) return [];

  const key = suggestKey(ctx);
  const stored = await loadJSON<StoredSuggest>(key);
  if (
    stored &&
    stored.v === SUGGEST_VERSION &&
    Array.isArray(stored.items) &&
    Date.now() - stored.at < appConfig.ai.suggestTtlMs
  ) {
    return cleanSuggestions(stored.items, limit);
  }

  try {
    const raw = parseJsonObject(
      await chat(contextText(ctx), SYSTEM_PROMPT, appConfig.ai.suggestTimeoutMs),
    );
    const items = cleanSuggestions(raw.suggestions, limit);
    if (items.length === 0) return [];
    await saveJSON(key, { at: Date.now(), v: SUGGEST_VERSION, items } satisfies StoredSuggest);
    return items;
  } catch {
    return [];
  }
}
