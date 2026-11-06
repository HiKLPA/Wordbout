import { appConfig } from '@/config/appConfig';
import {
  chat,
  isLlmConfigured,
  LlmError,
  parseJsonObject,
  str,
  strList,
  type LlmMessage,
} from '@/data/llm';
import { aiWordCache } from '@/data/questions';
import { tightenCjkSpacing } from '@/domain/text';
import { byteSizeByPrefix, loadJSON, removeByPrefix, removeJSON, saveJSON } from '@/lib/storage';

/**
 * AI 探索（FR-M-5 / FR-X-1）。
 *
 * 这里是「AI 探索」这一个入口的唯一数据层：**先判断意图，再决定怎么答**。
 * - 用户只是要查一个英语单词 / 固定短语 → 走**词条结构**（音标 / 义项 / 词源 / 例句 / 搭配 / 近义词 / 词性变形）；
 * - 其他任何请求（找近义词、要单词表、让做背词计划、问两词区别、问语法…）→ 走**通用回答结构**
 *   （标题 + 若干块：整段说明 / 要点列表 / 词条清单），不再硬塞进词典模板。
 *
 * 支持**连续对话**：调用方把之前的轮次作为 `history` 传进来，一起发给模型（见 `chat()`），
 * 于是「再举两个例子」这类追问能接得住；历史里只放「解答成功」的那几轮，失败的轮次不污染上下文。
 *
 * 两类结果都按验收要求「同一问题重复提问不重复计费」落本地缓存（内存 + AsyncStorage）；
 * 缓存键把历史也算进去，所以同一句追问在不同上下文里不会串答案。
 * 无密钥或请求失败时，只有词条类问题能退化为内置离线词条（NFR-3），其余抛错由界面提示重试。
 */

export interface AiWordSense {
  pos: string;
  zh: string;
  en: string;
}

export interface AiWordExample {
  en: string;
  zh: string;
}

/** 该词的词形变化 / 派生形式：`pos` 词性缩写，`form` 对应形式（inspire → n. inspiration） */
export interface AiWordForm {
  pos: string;
  form: string;
}

export interface AiWordEntry {
  word: string;
  phonetic: string;
  senses: AiWordSense[];
  origin: string;
  examples: AiWordExample[];
  collocations: string[];
  synonyms: string[];
  /** 不同词性下的形式（词族），不含原词本身；查不到就是空数组 */
  forms: AiWordForm[];
}

/** 词条清单里的一项：`term` 是英文单词 / 短语，`note` 是简短中文说明 */
export interface AiTerm {
  term: string;
  note: string;
}

/**
 * 通用回答的一块（模型按需选类型）：
 * - text：一整段说明或结论；
 * - list：要点列表（每条一句话）；
 * - terms：词条清单（单词 + 中文说明，可点开查词）。
 */
export type AiAnswerBlock =
  | { type: 'text'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'terms'; items: AiTerm[] };

/** 结果来源：ai 实时 / cache 本地缓存 / offline 内置离线词条 */
export type AiSource = 'ai' | 'cache' | 'offline';

/** 一次提问的结果：词条 / 通用回答 / 问不出东西（`none`） */
export type AiExploreResult =
  | {
      kind: 'entry';
      query: string;
      entry: AiWordEntry;
      keys: string[];
      /** 围绕这个词发散出的**建议追问**（界面横排在回复下方，点了即作为新提问发出） */
      followups: string[];
      source: AiSource;
    }
  | {
      kind: 'answer';
      query: string;
      title: string;
      blocks: AiAnswerBlock[];
      keys: string[];
      /** 围绕这段回答发散出的**建议追问** */
      followups: string[];
      source: AiSource;
    }
  | { kind: 'none'; query: string; source: AiSource };

/**
 * 提示词：**先判意图、再按对应结构输出**，只吐一个 JSON 对象。
 * 情况二刻意给了三种块类型，让「列单词表」「列要点」「说一段」各有合适的落点；
 * 并明确要求不编造 —— 拼写错误 / 不存在的词一律 `{"kind":"none"}`。
 */
const SYSTEM_PROMPT = [
  '你是面向中文母语者的英语学习助手，回答一律用简体中文。',
  '先判断用户这句话的意图，再按对应结构输出 —— 只输出一个 JSON 对象，不要 markdown 代码围栏，不要任何解释文字。',
  '用户可能在你上一轮回答的基础上继续追问（如「再举两个例子」「那它的近义词呢」「换成更简单的说法」）——',
  '要结合上面的对话理解这次问的是什么、延续同一个话题，不要重复上一轮已经给过的内容。',
  '排版约定：中文与英文之间一律不加空格（写「v.放弃」而不是「v. 放弃」，写「abandon这个词」而不是「abandon 这个词」）。',
  '另外单独给一份 "keys"：把这段回答里最该被记住的关键字词挑 1~3 条，**必须从你下面要写的内容里原样摘出来**',
  '（照抄那几个字，不要自己概括、不要换成同义说法；挑不出合适的就输出空数组 []）。',
  '界面会把它们在正文里出现的地方渲染成加粗红字 —— 所以不要自己在正文里加任何标记符号或星号。',
  '',
  '【情况一 · 用户只是要查一个真实存在的英语单词或固定短语】',
  '输出：',
  '{',
  '  "kind": "word",',
  '  "phonetic": "英式音标，含两侧斜杠，如 /ˈheksəɡɒn/",',
  '  "senses": [{ "pos": "n.", "zh": "中文释义", "en": "英文释义（简洁地道，不超过 12 词）" }],',
  '  "origin": "词源或词根线索，中文 1~2 句；不确定就写「词源不详」",',
  '  "examples": [{ "en": "英文例句", "zh": "中文翻译" }],',
  '  "collocations": ["常用搭配"],',
  '  "synonyms": ["近义词"],',
  '  "forms": [{ "pos": "n.", "form": "该词性下的形式" }],',
  '  "keys": ["词源或例句中文里最该强调的关键字词"],',
  '  "followups": ["接着还能问的短问题", "换个角度再问一条"]',
  '}',
  '要求：senses 1~3 条按常用度排序；**每条 sense 都必须同时给出 zh（中文释义）和 en（英文释义）**，',
  'en 用简洁地道的英文、不超过 12 词，与 zh 说的是同一个意思；不要只给中文、也不要留空；',
  'examples 2~3 条且体现常见用法；collocations 3~5 条；synonyms 3~5 条。',
  'forms = 该词在**其他词性**下的形式（词族），如 inspire → n. inspiration、adj. inspiring、adv. inspiringly；',
  '每条 pos 写的是 **form 那个词自己的词性**（n. / v. / adj. / adv.，别把原词的词性抄过来），form 写形式本身；',
  '不要写释义、不要重复原词；没有就输出空数组 []。',
  'keys 只从你写的 origin 与 examples 的中文翻译里**原样摘**字词（释义 / 英文例句 / 近义词 / 搭配 / 词性变形里不要挑，',
  '界面已经自动标出查询词）；挑不出合适的就输出空数组 []。',
  '另外给一份 "followups"：**围绕这个词**替用户想 2~3 条他接下来可能想知道的短问题（中文，每条不超过 16 字），',
  '如「它的词根是什么」「再给两个例句」「和 inspire 有什么区别」—— 这是**新写的问题**、不是从上面摘抄，',
  '角度要和上面已给的内容错开（词源 / 用法 / 辨析 / 搭配 / 例句不要重复），想不出就输出空数组 []。',
  '拼写错误、不存在的词、不是英语 —— 一律输出 {"kind": "none"}，绝不编造释义。',
  '',
  '【情况二 · 其他任何请求】例如找近义词、要单词列表、让制定背单词计划、问两个词的区别、问语法、让翻译句子。',
  '输出：',
  '{',
  '  "kind": "answer",',
  '  "title": "整段回答的标题，中文，不超过 14 字",',
  '  "blocks": [',
  '    { "type": "text", "text": "一段说明或结论，中文" },',
  '    { "type": "list", "items": ["一条要点", "一条要点"] },',
  '    { "type": "terms", "items": [{ "term": "英文单词", "note": "词性 + 简短中文说明" }] }',
  '  ],',
  '  "keys": ["上面各块正文里最该强调的关键字词"],',
  '  "followups": ["接着还能问的短问题", "换个角度再问一条"]',
  '}',
  '先写完 blocks，再从里面**原样摘** 1~3 条填进 keys（出现在哪儿就在哪儿标红）；挑不出合适的就输出空数组 []。',
  'blocks 1~3 块，**只放回答这次提问真正需要的内容**：不要为了显得完整而凑块，更不要不管问什么都在末尾补一段单词表 / 释义收尾。',
  '· 只有当用户**成批索取单词**（如六级高频词、某主题词汇、近义词清单、某类词有哪些）才用 terms：term = 英文单词，note = 词性 + 简短中文意思；不要用 list 去列单词。',
  '· 反过来：只要用户问的不是「有哪些词 / 给我一批词」，就不要用 terms —— 讲用法、讲区别、定计划、翻句子一律不用词表。',
  '· 只给要点用 list；要解释、给结论或讲步骤用 text；要定计划就按天 / 按步骤写多条 list。',
  '问区别 / 讲语法 / 讲用法 / 翻句子这类问题就按上面正常作答即可 —— 该用 text 就用 text、该用 list 就用 list；',
  '**不要因为回答里提到了几个英文词，就另外附一份「单词 + 释义」清单**，也不要给正文里出现的词逐个补释义。',
  '反例：问「has gone 和 has been 有什么区别」→ 用 text / list 讲清用法区别就够了；',
  '**不要**再用 terms 把这两个词列一遍、更不要给它们各配一条释义 —— 词在问题里已经出现了，用户要的是区别不是释义。',
  '**每块里的条目必须互不相同，同一内容不许重复出现**（否则会被判为失败）。每块 3~10 条、每条不超过 30 字，最多 3 块。',
  '最后再给一份 "followups"：**围绕这次回答**替用户想 2~3 条他接下来可能想问的短问题（中文，每条不超过 16 字），',
  '要顺着答案往前发散（如「再举两个例子」「和 XX 有什么区别」「这个具体怎么用」「换个更简单的说法」），',
  '不要重复这次回答里已经讲过的内容；想不出就输出空数组 []。',
  '示例：用户问「列出六级高频单词」→ {"kind":"answer","title":"六级高频单词","blocks":[{"type":"terms","items":[{"term":"abandon","note":"v.放弃；抛弃"},{"term":"abstract","note":"adj.抽象的 n.摘要"},{"term":"acknowledge","note":"v.承认；致谢"}]}],"keys":["放弃；抛弃"]}',
  '总量控制在 400 字以内；不要写「作为 AI」「希望对你有所帮助」这类客套话，直接给结果。',
].join('\n');

/** 落缓存的最小结构：三种结果各存一份自己需要的数据 */
type CachedPayload =
  | { kind: 'entry'; entry: AiWordEntry; keys?: string[]; followups?: string[] }
  | { kind: 'answer'; title: string; blocks: AiAnswerBlock[]; keys?: string[]; followups?: string[] }
  | { kind: 'none' };

interface StoredCache {
  at: number;
  /** 写入时的缓存结构版本，见 `CACHE_VERSION` */
  v: number;
  payload: CachedPayload;
}

/**
 * 缓存结构版本：**提示词或结果字段一变就 +1**，旧条目会在读到的那一刻失效（当作没命中），
 * 下次提问重新问模型并覆盖写入。否则用户会一直从缓存里读到「缺字段」的旧答案。
 * 现在 = 2（1 是只有 payload 的早期结构；再早的 `found` / `entry` 两字段版已随之一并作废）。
 */
const CACHE_VERSION = 2;

/** 缓存键的公共前缀（不含 `:`）—— 统计 / 清理按它匹配，索引键 `ai-explore-index` 也在其中 */
const CACHE_SCOPE = 'ai-explore';
const CACHE_PREFIX = `${CACHE_SCOPE}:`;
const INDEX_KEY = 'ai-explore-index';

/** 内存缓存：同一会话内重复提问直接命中，不再读存储、也不发请求 */
const memory = new Map<string, CachedPayload>();
/** 缓存索引（最新在前），用于按上限淘汰最旧的条目 */
let index: string[] | null = null;

/**
 * 问题 → 缓存键：把**历史 + 本次提问**拼起来归一化（小写 + 空白折叠）后取 32 位散列。
 * 用散列是因为键里会出现整句话甚至整段文本，直接当 key 又长又难读。
 * 历史也算进键里：同一句追问（如「再举两例」）在不同上下文下答案不同，不能互相命中；
 * 没有历史的第一次提问与旧版键完全一致，老缓存照旧复用。
 */
function cacheKey(query: string, history: readonly LlmMessage[]): string {
  const normalized = [...history.map((m) => m.content), query]
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  let hash = 5381;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) | 0;
  }
  return `${(hash >>> 0).toString(36)}-${normalized.length}`;
}

/**
 * 只带最近 `appConfig.ai.historyLimit` 条历史给模型（一问一答算 2 条）。
 * 截断后再丢掉开头的 assistant 消息 —— 那是一条没有对应提问的孤儿回复，
 * 让对话从「用户提问」开始更稳。
 */
function trimHistory(history: readonly LlmMessage[]): LlmMessage[] {
  const limit = Math.max(0, appConfig.ai.historyLimit);
  const recent = limit > 0 ? history.slice(-limit) : [];
  return recent[0]?.role === 'assistant' ? recent.slice(1) : recent;
}

/**
 * 已有结果 → 回灌给模型的「上文」文本（`chat` 的 assistant 轮次）。
 *
 * 直接存归一化后的结构而不是模型原始报文：既能当上下文用，又能被界面复用 / 进缓存；
 * 只保留支撑追问的要点（词条字段、标题 + 各块内容），长度可控。
 */
export function resultToHistoryText(result: AiExploreResult): string {
  if (result.kind === 'entry') {
    const { entry } = result;
    const senses = entry.senses
      .map((s, i) => `${i + 1}. ${s.pos ? `(${s.pos}) ` : ''}${s.zh}`)
      .join('；');
    const parts = [`词条 ${entry.word}${entry.phonetic ? ` ${entry.phonetic}` : ''}`, senses];
    if (entry.origin) parts.push(`词源：${entry.origin}`);
    if (entry.synonyms.length) parts.push(`近义词：${entry.synonyms.join('、')}`);
    if (entry.forms.length) {
      parts.push(`词性变形：${entry.forms.map((f) => `${f.pos} ${f.form}`.trim()).join('、')}`);
    }
    if (entry.collocations.length) parts.push(`常用搭配：${entry.collocations.join('、')}`);
    return parts.filter(Boolean).join('\n');
  }
  if (result.kind === 'answer') {
    const blocks = result.blocks.map((block) => {
      if (block.type === 'text') return block.text;
      if (block.type === 'list') return block.items.map((item) => `· ${item}`).join('\n');
      return block.items.map((t) => (t.note ? `${t.term}：${t.note}` : t.term)).join('、');
    });
    return [result.title, ...blocks].filter(Boolean).join('\n');
  }
  return '（这一轮没有找到合适的内容）';
}

/**
 * 读出缓存。**只认当前 `CACHE_VERSION` 的结构** —— 旧条目（缺 `followups` 这类新字段的）
 * 当作没命中：让它自然过期、下次提问重新问模型，用户不会读到半新半旧的答案。
 */
async function readCache(key: string): Promise<CachedPayload | null> {
  const hit = memory.get(key);
  if (hit) return hit;

  const stored = await loadJSON<StoredCache>(CACHE_PREFIX + key);
  if (!stored || stored.v !== CACHE_VERSION || !stored.payload) return null;

  memory.set(key, stored.payload);
  return stored.payload;
}

/** 写缓存并淘汰超出上限的最旧条目 */
async function writeCache(key: string, payload: CachedPayload): Promise<void> {
  memory.set(key, payload);
  await saveJSON(CACHE_PREFIX + key, { at: Date.now(), v: CACHE_VERSION, payload } satisfies StoredCache);

  if (!index) index = (await loadJSON<string[]>(INDEX_KEY)) ?? [];
  index = [key, ...index.filter((k) => k !== key)];
  const dropped = index.slice(appConfig.ai.cacheLimit);
  index = index.slice(0, appConfig.ai.cacheLimit);
  await saveJSON(INDEX_KEY, index);
  await Promise.all(dropped.map((k) => removeJSON(CACHE_PREFIX + k)));
}

/**
 * 答案缓存当前占用的本地空间（UTF-8 字节）——「设置」里的清除缓存按钮用它显示 MB 数。
 *
 * 只算**可再生的答案缓存**（`ai-explore:*` 各条 + 索引），不含学习记录 `state` 与
 * 历史对话 `ai-chats`：前者是用户数据，后者在探索页的历史面板里可见，都不属于「缓存」。
 */
export function aiCacheBytes(): Promise<number> {
  return byteSizeByPrefix(CACHE_SCOPE);
}

/** 清空答案缓存（内存镜像 + 本地条目 + 索引），返回释放的字节数；学习记录与历史对话不受影响 */
export async function clearAiCache(): Promise<number> {
  const bytes = await byteSizeByPrefix(CACHE_SCOPE);
  memory.clear();
  index = null;
  await removeByPrefix(CACHE_SCOPE);
  return bytes;
}

/**
 * 模型给的文本 → 界面用的文本：去掉首尾空白，并抹平「中文与相邻英文之间」的空格
 * （模型常按英文习惯在英文词两侧补空格，见 `domain/text.ts`）。英文之间、中文之间的空格不受影响。
 */
function clean(value: unknown): string {
  return tightenCjkSpacing(str(value));
}

/** 模型给的关键词表（界面据此加粗描红）：空白整理 + 一条里并列多个词时拆开 + 去重限长 */
function keyList(value: unknown): string[] {
  const out: string[] = [];
  for (const item of strList(value, 6)) {
    for (const piece of clean(item).split(/[；;、，,]/)) {
      const key = piece.trim();
      if (key && !out.includes(key)) out.push(key);
    }
  }
  return out.slice(0, 6);
}

/**
 * 模型给的**建议追问**（每条是一句短问题，排在回复下方、点了即提问）：
 * 去掉列表符号与首尾空白、丢掉过长的（超过 28 字的不像「一条建议」）、
 * 去掉与本次提问重复的、去重，最多 `appConfig.ai.followUpLimit` 条。
 */
function followupList(value: unknown, query: string): string[] {
  const asked = query.trim().toLowerCase();
  const out: string[] = [];
  for (const item of strList(value, 8)) {
    const text = clean(item)
      .replace(/^[-·•*、\d.\s]+/, '')
      .trim();
    const key = text.toLowerCase();
    if (!text || text.length > FOLLOW_UP_MAX_CHARS) continue;
    if (key === asked || out.some((x) => x.toLowerCase() === key)) continue;
    out.push(text);
    if (out.length >= Math.max(0, appConfig.ai.followUpLimit)) break;
  }
  return out;
}

/** 一条建议追问的字数上限（模型偶尔会写成整段话，那样的不适合做成按钮） */
const FOLLOW_UP_MAX_CHARS = 28;

/** 词性变形归一化：丢掉空项、重复项与「原词本身」，最多保留 5 条 */
function normalizeForms(raw: unknown, word: string): AiWordForm[] {
  if (!Array.isArray(raw)) return [];

  const self = word.trim().toLowerCase();
  const seen = new Set<string>();
  const out: AiWordForm[] = [];
  for (const item of raw.slice(0, 8)) {
    const o = (item ?? {}) as Record<string, unknown>;
    const form = clean(o.form);
    const key = form.toLowerCase();
    // 原词本身不算「变形」（模型偶尔会把它也列进来），重复形式只留第一条
    if (!form || key === self || seen.has(key)) continue;
    seen.add(key);
    out.push({ pos: clean(o.pos), form });
    if (out.length >= 5) break;
  }
  return out;
}

/** 词条结构归一化（容错：字段缺失、类型不符、数组超长都安全） */
function normalizeEntry(raw: Record<string, unknown>, word: string): AiWordEntry {
  const sensesRaw = Array.isArray(raw.senses) ? raw.senses : [];
  const examplesRaw = Array.isArray(raw.examples) ? raw.examples : [];

  return {
    word,
    phonetic: str(raw.phonetic),
    senses: sensesRaw
      .slice(0, 4)
      .map((item) => {
        const o = (item ?? {}) as Record<string, unknown>;
        return { pos: clean(o.pos), zh: clean(o.zh), en: clean(o.en) };
      })
      .filter((s) => s.zh.length > 0 || s.en.length > 0),
    origin: clean(raw.origin),
    examples: examplesRaw
      .slice(0, 4)
      .map((item) => {
        const o = (item ?? {}) as Record<string, unknown>;
        return { en: clean(o.en), zh: clean(o.zh) };
      })
      .filter((e) => e.en.length > 0),
    collocations: strList(raw.collocations, 6).map(clean),
    synonyms: strList(raw.synonyms, 8).map(clean),
    forms: normalizeForms(raw.forms, word),
  };
}

/** 通用回答归一化：逐块判类型，空块 / 未知类型直接丢掉 */
function normalizeBlocks(raw: unknown): AiAnswerBlock[] {
  if (!Array.isArray(raw)) return [];

  const blocks: AiAnswerBlock[] = [];
  for (const item of raw.slice(0, 6)) {
    const o = (item ?? {}) as Record<string, unknown>;
    const type = str(o.type);

    if (type === 'text') {
      const text = clean(o.text);
      if (text) blocks.push({ type: 'text', text });
      continue;
    }
    if (type === 'list') {
      const items = strList(o.items, 12).map(clean);
      if (items.length) blocks.push({ type: 'list', items });
      continue;
    }
    if (type === 'terms') {
      const itemsRaw = Array.isArray(o.items) ? o.items : [];
      const items: AiTerm[] = [];
      const seen = new Set<string>();
      for (const entry of itemsRaw.slice(0, 20)) {
        const t = (entry ?? {}) as Record<string, unknown>;
        const term = clean(t.term);
        // 弱模型偶尔会把同一项重复刷满整块 —— 这里按 term 去重，重复项直接丢掉
        const key = term.toLowerCase();
        if (!term || seen.has(key)) continue;
        seen.add(key);
        items.push({ term, note: clean(t.note) });
      }
      if (items.length) blocks.push({ type: 'terms', items });
    }
  }
  return blocks;
}

/** 合法的块类型 —— 模型把唯一那个块提到顶层时，用它判断这个 `kind` 算不算一个块 */
const TOP_LEVEL_BLOCK_TYPES = new Set(['text', 'list', 'terms']);

/**
 * 「用户是不是在成批索取单词」—— 只有这类提问，回答里才该出现**词条清单**块。
 * 模型习惯在回答末尾附一段「单词 + 释义」收尾（问区别、讲语法时也一样），
 * 而按设计那只有在用户要一批词时才有意义（见 `pruneTerms`）。
 */
const WORD_LIST_ASK =
  /列出|列举|有哪些单词|有哪些词|有哪些表达|有哪些说法|哪些单词|哪些词|一批|一组|给我.{0,4}词|单词表|词汇表|词表|高频词|核心词|常用词|常用表达|常用短语|近义词|同义词|反义词|短语|固定搭配|搭配|\bwords?\b|vocabulary|synonyms?|antonyms?|phrases?|expressions?|collocations?/i;

/**
 * 词条清单块的两道过滤（2026-10-16 按设计）：
 * 1. 提问里已经出现的词不算「新词」，从清单里摘掉 —— 模型常把问句里的词（has gone / has been）
 *    连词带释义再列一遍，而用户要的是解释，不是这两个词的释义；
 * 2. 用户不是在成批索取单词时（问区别 / 讲语法 / 讲用法 / 翻句子…），整块摘掉 ——
 *    只要回答里还有正文（`text` / `list`）。
 * 两道都不删干净时保持原样：万一模型只给了词表（没有正文），留着也比交一张空面板强。
 */
function pruneTerms(query: string, blocks: AiAnswerBlock[]): AiAnswerBlock[] {
  const asked = query.toLowerCase();
  const kept: AiAnswerBlock[] = [];
  for (const block of blocks) {
    if (block.type !== 'terms') {
      kept.push(block);
      continue;
    }
    const items = block.items.filter((t) => !asked.includes(t.term.toLowerCase()));
    if (items.length) kept.push({ type: 'terms', items });
  }
  if (!kept.length) return blocks;

  if (WORD_LIST_ASK.test(query)) return kept;
  const rest = kept.filter((b) => b.type !== 'terms');
  return rest.length ? rest : kept;
}

/**
 * 问一次模型：把返回的 JSON 落成三种结果之一。
 * 模型说 `kind: "word"` 但字段全空 → 按「问不出东西」处理，避免界面出现空卡片。
 * `history` 是之前成功的那几轮（连续对话）。
 */
async function fetchFromModel(query: string, history: readonly LlmMessage[]): Promise<CachedPayload> {
  const raw = parseJsonObject(
    await chat(query, SYSTEM_PROMPT, appConfig.ai.answerTimeoutMs, history),
  );
  const kind = str(raw.kind);
  /** 模型自己辨析出的关键词 —— 界面据此把正文里这些字词加粗描红 */
  const keys = keyList(raw.keys);
  /** 围绕这次回答发散出的建议追问（界面横排在回复下方） */
  const followups = followupList(raw.followups, query);

  if (kind === 'word') {
    const entry = normalizeEntry(raw, query);
    if (!entry.phonetic && entry.senses.length === 0 && entry.examples.length === 0) {
      return { kind: 'none' };
    }
    return { kind: 'entry', entry, keys, followups };
  }
  if (kind === 'none') return { kind: 'none' };

  const title = clean(raw.title);
  /**
   * 模型偶尔会把唯一的那个块**提到顶层**：直接吐 `{"kind":"terms","items":[...]}` 而不是
   * `{"kind":"answer","blocks":[...]}`（「列出六级高频单词」实测三次里就会出现）。这时
   * 没有 `title` 也没有 `blocks`，但 `items` 是完整的 —— 按「只有一个该类型的块」收下，
   * 否则整条回答会被判成「没找到内容」。
   */
  const rawBlocks =
    raw.blocks ??
    (TOP_LEVEL_BLOCK_TYPES.has(kind) && Array.isArray(raw.items)
      ? [{ type: kind, items: raw.items }]
      : undefined);
  const blocks = pruneTerms(query, normalizeBlocks(rawBlocks));
  if (!title && blocks.length === 0) return { kind: 'none' };
  return { kind: 'answer', title, blocks, keys, followups };
}

/** 内置离线词条兜底（NFR-3：无网时仍可查看已收录词条）——只覆盖「查单词」这一类问题 */
function offlinePayload(query: string): CachedPayload | null {
  if (!appConfig.ai.offlineFallback) return null;
  const preset = aiWordCache[query.trim().toLowerCase()];
  if (!preset) return null;
  return {
    kind: 'entry',
    entry: {
      word: query,
      phonetic: preset.phonetic,
      senses: preset.senses,
      origin: preset.origin,
      examples: preset.examples,
      collocations: preset.collocations,
      synonyms: preset.synonyms,
      forms: preset.forms,
    },
  };
}

/**
 * 缓存 / 模型的结果 → 界面用的结果（补上原始问题和来源）。
 *
 * 这是所有结果（实时 / 缓存 / 离线词条）流向界面的**唯一出口**，所以文本整理也放这里：
 * 老缓存里存的是「中文与英文之间有空格」的旧格式，可能还没有 `keys` / `forms` 字段 ——
 * 统一过一遍空白整理与缺省补齐，界面不必自己兜底，也不会出现「同一个词条两副面孔」。
 */
function toResult(payload: CachedPayload, query: string, source: AiSource): AiExploreResult {
  const keys = payload.kind === 'none' ? [] : keyList(payload.keys);
  /** 建议追问：老缓存 / 离线兜底都没有这个字段，统一在这里补成空数组（界面「有才渲染」） */
  const followups = payload.kind === 'none' ? [] : followupList(payload.followups, query);

  if (payload.kind === 'entry') {
    const e = payload.entry;
    return {
      kind: 'entry',
      query,
      entry: {
        ...e,
        // 旧版缓存（无 `forms` 字段）读出来补成空数组：界面是「有才渲染」，缺了会直接报错
        forms: (e.forms ?? []).map((f) => ({ pos: clean(f.pos), form: clean(f.form) })),
        senses: e.senses.map((s) => ({ pos: clean(s.pos), zh: clean(s.zh), en: clean(s.en) })),
        origin: clean(e.origin),
        examples: e.examples.map((x) => ({ en: clean(x.en), zh: clean(x.zh) })),
        collocations: e.collocations.map(clean),
        synonyms: e.synonyms.map(clean),
      },
      keys,
      followups,
      source,
    };
  }
  if (payload.kind === 'answer') {
    return {
      kind: 'answer',
      query,
      title: clean(payload.title),
      blocks: pruneTerms(
        query,
        payload.blocks.map((block) => {
          if (block.type === 'text') return { type: 'text' as const, text: clean(block.text) };
          if (block.type === 'list') return { type: 'list' as const, items: block.items.map(clean) };
          return {
            type: 'terms' as const,
            items: block.items.map((t) => ({ term: clean(t.term), note: clean(t.note) })),
          };
        }),
      ),
      keys,
      followups,
      source,
    };
  }
  return { kind: 'none', query, source };
}

/**
 * 提问一次（AI 探索的主入口）。
 * 优先级：本地缓存 → 大模型实时 → 内置离线词条；都拿不到时抛 `LlmError`，由界面提示重试。
 * `history` = 本次提问之前的成功轮次（连续对话用），只取最近 `appConfig.ai.historyLimit` 条。
 */
export async function aiExplore(
  input: string,
  history: readonly LlmMessage[] = [],
): Promise<AiExploreResult> {
  const query = input.trim();
  if (!query) return { kind: 'none', query, source: 'offline' };

  const context = trimHistory(history);
  const key = cacheKey(query, context);
  const cached = await readCache(key);
  if (cached) return toResult(cached, query, 'cache');

  if (isLlmConfigured()) {
    try {
      const payload = await fetchFromModel(query, context);
      await writeCache(key, payload);
      return toResult(payload, query, 'ai');
    } catch (error) {
      const offline = offlinePayload(query);
      if (offline) return toResult(offline, query, 'offline');
      throw error;
    }
  }

  const offline = offlinePayload(query);
  if (offline) return toResult(offline, query, 'offline');
  throw new LlmError('not-configured');
}

/** 供界面提示用：当前是否已配置大模型密钥 */
export { isLlmConfigured };
export type { LlmErrorCode } from '@/data/llm';
export type { LlmMessage } from '@/data/llm';
export { LlmError } from '@/data/llm';
