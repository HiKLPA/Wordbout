import type { ExerciseTypeId } from '@/config/appConfig';
import type { ExerciseItem } from '@/data/questions';
import { getBookWords, wordbooks } from '@/data/wordbooks';
import type { Wordbook } from '@/domain/types';

/**
 * 「积累」测验（练习页「测验」页签下的第一个测验）。
 *
 * 玩法：给出中文释义，写出对应的英文词 / 短语，提交后**统一评分** ——
 * 每题等权、答对得满分、答错 0 分，走练习页听写那一支的客观拼写口径
 * （`domain/grading.localGrade`），不做主观给分。
 *
 * 题池：当前题库对应词库里的 词条 + 派生词 + 常用短语（按答案去重）。
 * 只出词条的话题量撑不起 20/40/60/80 四档，而词库里的短语（如 abandon hope）本身
 * 就是「积累」要练的东西，因此一并入池、统一按中文释义默写。
 *
 * 记录与评分复用听写那一支（`typeId`），它们本身是客观拼写题：
 * 测验作答仍按 `Attempt.excluded` 只留记录，不计入打卡卡片与学习统计。
 */

/** 积累测验在记录与评分链路里复用的题型（客观拼写题） */
export const ACCUMULATION_TYPE_ID: ExerciseTypeId = 'dictation';

export type AccumulationKind = 'word' | 'derivative' | 'phrase';

export interface AccumulationItem {
  id: string;
  /** 题面：中文释义 */
  promptZh: string;
  /** 正确答案：英文词 / 短语 */
  answer: string;
  /** 来源：词条 / 派生词 / 常用短语 */
  kind: AccumulationKind;
  /** 词性（词条与派生词有，短语没有） */
  partOfSpeech?: string;
}

/**
 * 当前题库对应的词库：优先取同题库包（`levelId` 相符）；
 * 「日常」这类没有专属词库的题库退回第一本，保证永远有题可抽。
 */
export function bookForLevel(levelId: string): Wordbook {
  return wordbooks.find((b) => b.levelId === levelId) ?? wordbooks[0];
}

/** 词库 → 题池（同一答案只出一次，中文释义为空的条目丢弃） */
export function accumulationPool(bookId: string): AccumulationItem[] {
  const seen = new Set<string>();
  const out: AccumulationItem[] = [];
  const push = (item: AccumulationItem) => {
    const key = item.answer.trim().toLowerCase();
    if (!item.promptZh.trim() || !key || seen.has(key)) return;
    seen.add(key);
    out.push(item);
  };

  getBookWords(bookId).forEach((entry) => {
    const sense = entry.senses[0];
    push({
      id: `acc-word-${entry.id}`,
      promptZh: sense?.definitionZh ?? '',
      answer: entry.word,
      kind: 'word',
      partOfSpeech: sense?.partOfSpeech,
    });
    entry.derivatives.forEach((d) =>
      push({
        id: `acc-deriv-${entry.id}-${d.word}`,
        promptZh: d.definitionZh,
        answer: d.word,
        kind: 'derivative',
        partOfSpeech: d.partOfSpeech,
      }),
    );
    entry.phrases.forEach((p, i) =>
      push({ id: `acc-phrase-${entry.id}-${i}`, promptZh: p.zh, answer: p.en, kind: 'phrase' }),
    );
  });

  return out;
}

/**
 * 全库题池索引（题集页按 id 反查题目用）。
 * 题目 id 带词库前缀（`acc-word-<bookId>-<n>` 等），跨库不冲突；
 * 建一次缓存，之后按 id 直接取，不必每次遍历全部词库。
 */
let poolIndexCache: Map<string, AccumulationItem> | null = null;
function poolIndex(): Map<string, AccumulationItem> {
  if (!poolIndexCache) {
    poolIndexCache = new Map();
    for (const book of wordbooks) {
      for (const item of accumulationPool(book.id)) {
        // 同一答案可能在多本书里各有一条，先到先得即可（题面一致）
        if (!poolIndexCache.has(item.id)) poolIndexCache.set(item.id, item);
      }
    }
  }
  return poolIndexCache;
}

/** 按题目 id 反查积累题目（跨全部词库）；已下架 / 找不到时返回 undefined */
export function findAccumulationItem(id: string): AccumulationItem | undefined {
  return poolIndex().get(id);
}

/**
 * 题集重做：把收藏的题目按「点中的那道排最前、其余按收藏时间倒序」组成题单。
 * 与练习页题集同一口径 —— 队首就是点的那道题，接着做同一题集里其余的题。
 */
export function accumulationQueueFromIds(ids: string[]): AccumulationItem[] {
  const out: AccumulationItem[] = [];
  for (const id of ids) {
    const item = findAccumulationItem(id);
    if (item) out.push(item);
  }
  return out;
}

/**
 * 抽定本次的题单：洗牌后取前 `size` 道（Fisher–Yates，不改动原数组）；
 * 题池不足所选数量时按实际数量全出，不用重复题凑数。
 */
export function buildAccumulationQueue(pool: AccumulationItem[], size: number): AccumulationItem[] {
  const out = [...pool];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, Math.max(0, Math.min(size, out.length)));
}

/**
 * 转成评分 / 记录链路认识的题目对象：填 `dictationAnswer` 即走「客观拼写题」那一支，
 * 于是 `localGrade` 给出统一的 100 / 0 分与同款的对错理由、改进建议。
 */
export function toExerciseItem(item: AccumulationItem, levelId: string): ExerciseItem {
  return {
    id: item.id,
    typeId: ACCUMULATION_TYPE_ID,
    levelId,
    title: item.answer,
    prompt: item.promptZh,
    audioText: item.answer,
    dictationAnswer: item.answer,
  };
}
