import { WORD_GLOSSARY } from '@/data/dictionary';
import { findWordEntry } from '@/data/wordbooks';

/**
 * 阅读理解点词翻译：把原文里的一个词形还原成「词性 + 中文释义」（FR-E-12）。
 *
 * 数据来源按优先级：
 * 1. 内置词库词条（`data/wordbooks` 的反查索引）—— 词条最完整，取首个义项；
 * 2. 内置小词典（`data/dictionary`）—— 补上短文中出现、但不在词库种子里的词。
 * 都查不到时返回 null，界面给出「暂无释义」而不是编造内容。
 */
export interface WordGloss {
  /** 命中的原形（小写） */
  word: string;
  /** 词性，如 `v.` / `n.` / `adj.` */
  partOfSpeech: string;
  /** 英文释义（课本释义面板的第一行，与词库义项同结构） */
  definition: string;
  /** 该词性的中文释义 */
  definitionZh: string;
}

/** 不规则变形 → 原形（规则变形由 `candidates` 还原，这里只列不规则的） */
const IRREGULAR: Record<string, string> = {
  am: 'be',
  is: 'be',
  are: 'be',
  was: 'be',
  were: 'be',
  been: 'be',
  has: 'have',
  had: 'have',
  met: 'meet',
  written: 'write',
  wrote: 'write',
  memorises: 'memorise',
  memorizes: 'memorize',
  easier: 'easy',
  easiest: 'easy',
};

/** 只留字母与连字符（去掉标点），转小写 */
export function normalizeToken(raw: string): string {
  return raw.replace(/[^a-zA-Z-]/g, '').toLowerCase();
}

/** 词形还原候选：先原样，再依次按常见后缀回退（命中即止） */
function candidates(token: string): string[] {
  const out = [token];
  const push = (s: string) => {
    if (s.length >= 2 && !out.includes(s)) out.push(s);
  };
  const irregular = IRREGULAR[token];
  if (irregular) push(irregular);
  if (/ies$/.test(token)) push(`${token.slice(0, -3)}y`);
  if (/ied$/.test(token)) push(`${token.slice(0, -3)}y`);
  if (/ier$/.test(token)) push(`${token.slice(0, -3)}y`);
  if (/iest$/.test(token)) push(`${token.slice(0, -4)}y`);
  if (/es$/.test(token)) push(token.slice(0, -2));
  if (/s$/.test(token)) push(token.slice(0, -1));
  if (/ed$/.test(token)) {
    push(token.slice(0, -2));
    push(token.slice(0, -1));
  }
  if (/ing$/.test(token)) {
    push(token.slice(0, -3));
    push(`${token.slice(0, -3)}e`);
  }
  if (/ly$/.test(token)) push(token.slice(0, -2));
  // 双写辅音还原：stopped → stop、flipping → flip
  const doubled = /^(.+?)([bcdfglmnprstz])\2(ed|ing)$/.exec(token);
  if (doubled) push(`${doubled[1]}${doubled[2]}`);
  return out;
}

/**
 * 查一个词形：命中返回「词性 + 英文释义 + 中文释义」，查不到返回 null。
 * 英文释义可能为空串（词库个别义项没写英文），界面按有 / 无分别渲染。
 */
export function lookupWord(raw: string): WordGloss | null {
  const token = normalizeToken(raw);
  if (!token) return null;
  const forms = candidates(token);
  for (const form of forms) {
    const entry = findWordEntry(form);
    const sense = entry?.senses[0];
    if (entry && sense) {
      return {
        word: form,
        partOfSpeech: sense.partOfSpeech,
        definition: sense.definition,
        definitionZh: sense.definitionZh,
      };
    }
  }
  for (const form of forms) {
    const hit = WORD_GLOSSARY[form];
    if (hit) return { word: form, partOfSpeech: hit[0], definition: hit[1], definitionZh: hit[2] };
  }
  return null;
}
