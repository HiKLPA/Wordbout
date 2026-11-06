/**
 * 模型生成文本的排版整理（「AI 回答」这类内容由大模型写的文本用得上）。
 *
 * 两件事：
 * 1. **中英之间的空白**：中文母语者的排版里，中文与英文相接处不加空格（写「v.放弃」而不是
 *    「v. 放弃」）。大模型常按英文习惯在英文词两侧补空格，看起来像英文被孤立出来。这里提供
 *    一个「抹掉中文与相邻英文之间的空白」的工具，供数据层在解析模型结果时统一调用。
 * 2. **该强调的片段**：界面要把「关键词 / 关键句」加粗描红，切分来源有两路 ——
 *    ① 大模型在结果里一并给的关键词（见 `data/aiExplore.ts` 的 `keys`）在文中原样出现处；
 *    ② 中英混排的正文里成串的英文（中文句子里的英文就是要学的那几个词，本地就能认出来）。
 *    两者由 `splitEmphasis` 合并后交给 `components/EmphasisText` 渲染。
 */

/** 汉字、中文标点、全角字母数字 —— 与 `theme/script.ts` 的 CJK 判定同一套区段 */
const CJK =
  '\\u2e80-\\u2eff\\u3000-\\u303f\\u31c0-\\u31ef\\u3200-\\u33ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff\\ufe10-\\ufe4f\\uff00-\\uffef';
/** 含汉字 / 中文标点（判断「是不是中英混排」） */
const CJK_PATTERN = new RegExp(`[${CJK}]`);
/** 英文单词字母与数字 */
const LATIN = 'A-Za-z0-9';
/** 英文一侧的整词：字母/数字开头，可续撇号、连字符、句点（`v.` / `e-mail` / `it's` / `Anki.`） */
const LATIN_WORD = `[${LATIN}][A-Za-z0-9.'\\u2019\\-]*`;
/** 中文 ↔ 英文之间的空白：半角空格 / 制表符 / 全角空格 */
const CJK_LATIN_GAP = new RegExp(
  `([${CJK}])[ \\t\\u3000]+(${LATIN_WORD})|(${LATIN_WORD})[ \\t\\u3000]+([${CJK}])`,
  'g',
);

/**
 * 抹掉「汉字 / 中文标点」与相邻「英文 / 数字」之间的空白，并去掉首尾空白。
 *
 * 英文与英文之间的空格**不动**（那是有意义的词间空格），中文与中文之间的空格也不动。
 * 删掉一处空格会让原本隔开的字符变邻（如 `a 中 文 b`），所以循环到不再变化为止（最多 4 轮兜底）。
 */
export function tightenCjkSpacing(text: string): string {
  let out = text.trim();
  for (let round = 0; round < 4; round += 1) {
    const next = out.replace(
      CJK_LATIN_GAP,
      (_match: string, cjkLeft: string, latinRight: string, latinLeft: string, cjkRight: string) =>
        cjkLeft ? `${cjkLeft}${latinRight}` : `${latinLeft}${cjkRight}`,
    );
    if (next === out) break;
    out = next;
  }
  return out;
}

/** 正则元字符转义 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 成串的英文（字母开头，数字 / 撇号 / 连字符可续）—— 中文句子里的英文通常就是要学的那几个词 */
const LATIN_RUN = /[A-Za-z][A-Za-z0-9'’\-]*/g;

export interface EmphasisPart {
  text: string;
  /** true = 要加粗描红的部分 */
  hit: boolean;
}

/**
 * 把一段文字按「关键词」切成若干段，命中项标记为 `hit`（供界面加粗描红）。
 *
 * 关键词来自模型（关键词语可以是一整个短语甚至关键句），长关键词在前，避免被它的子串提前截断；
 * 英文不区分大小写，中文按字面子串匹配。关键词为空、或一个都没命中时返回整段（`hit: false`）。
 */
export function splitByKeywords(text: string, keywords: readonly string[]): EmphasisPart[] {
  const keys = keywords.map((key) => key.trim()).filter(Boolean);
  if (keys.length === 0) return [{ text, hit: false }];

  const pattern = keys
    .map(keyPattern)
    .sort((a, b) => b.length - a.length)
    .join('|');
  const re = new RegExp(pattern, 'gi');
  return scan(text, re);
}

/** 单个关键词的匹配片段：纯英文/数字的词加词边界，避免 `inspire` 命中 `inspired` 里的一截 */
function keyPattern(key: string): string {
  const escaped = escapeRegExp(key);
  const wordLike = /^[A-Za-z0-9]/.test(key) && /[A-Za-z0-9]$/.test(key);
  return wordLike ? `\\b${escaped}\\b` : escaped;
}

/**
 * 一段文字里「该被强调」的片段 —— 两路来源合并：
 * 1. **模型给的关键词**（`keys`）在文中原样出现的地方；
 * 2. `markLatin` 打开、且这段文字本身是中英混排时，其中**成串的英文**：
 *    中文句子里出现的英文就是要学的那几个词，不需要模型再叮嘱一遍，本地就能认出来
 *    （纯英文的句子不适用 —— 例句里的英文由「命中查询词」那套负责）。
 */
export function splitEmphasis(
  text: string,
  keywords: readonly string[] = [],
  markLatin = false,
): EmphasisPart[] {
  const parts = splitByKeywords(text, keywords);
  if (!markLatin || !hasCjk(text)) return merge(parts);

  const out: EmphasisPart[] = [];
  for (const part of parts) {
    if (part.hit) {
      out.push(part);
      continue;
    }
    let last = 0;
    const re = new RegExp(LATIN_RUN.source, 'g');
    let match = re.exec(part.text);
    while (match) {
      if (match.index > last) out.push({ text: part.text.slice(last, match.index), hit: false });
      out.push({ text: match[0], hit: true });
      last = match.index + match[0].length;
      match = re.exec(part.text);
    }
    if (last < part.text.length) out.push({ text: part.text.slice(last), hit: false });
  }
  return merge(out);
}

/** 用一条正则把文字切成片段（命中 / 未命中） */
function scan(text: string, re: RegExp): EmphasisPart[] {
  const parts: EmphasisPart[] = [];
  let last = 0;
  let match = re.exec(text);
  while (match) {
    if (match[0].length === 0) {
      re.lastIndex += 1;
      match = re.exec(text);
      continue;
    }
    if (match.index > last) parts.push({ text: text.slice(last, match.index), hit: false });
    parts.push({ text: match[0], hit: true });
    last = match.index + match[0].length;
    match = re.exec(text);
  }
  if (parts.length === 0) return [{ text, hit: false }];
  if (last < text.length) parts.push({ text: text.slice(last), hit: false });
  return parts;
}

/** 合并相邻的同类型片段（渲染时少几个节点） */
function merge(parts: EmphasisPart[]): EmphasisPart[] {
  const out: EmphasisPart[] = [];
  for (const part of parts) {
    if (!part.text) continue;
    const last = out[out.length - 1];
    if (last && last.hit === part.hit) last.text += part.text;
    else out.push({ ...part });
  }
  return out;
}

/** 这段文字里是否含汉字 / 中文标点（判断「是不是中英混排」） */
export function hasCjk(text: string): boolean {
  return CJK_PATTERN.test(text);
}

