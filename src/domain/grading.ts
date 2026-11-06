import { appConfig } from '@/config/appConfig';
import type { ExerciseTypeDef } from '@/config/appConfig';
import type { ExerciseItem } from '@/data/questions';
import type { AnswerBreakdownItem, GradingIssue, GradingResult } from '@/domain/types';
import { sentenceSep, tr, trf } from '@/i18n';

/**
 * AI 评分链路（FR-E-14 / FR-E-15）。
 * 初始开发阶段使用本地启发式评分引擎，接口形态与真实大模型一致：
 * 只要把 `localGrade` 换成远端调用即可，上层状态机与 UI 不用改。
 */

export type GradingPhase = 'idle' | 'soft-pending' | 'grading' | 'failed' | 'succeeded';

export interface GradingFeedback {
  phase: GradingPhase;
  /** 面向用户的文案，禁止直接展示原始错误码（IF-4） */
  message: string;
}

const FRIENDLY_ERROR = '评分失败，请稍后重试';

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function sentences(text: string): string[] {
  return text
    .split(/[.!?。！？]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

function isMeaningless(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  const letters = (t.match(/[a-zA-Z\u4e00-\u9fa5]/g) ?? []).length;
  if (letters < t.length * 0.4) return true;
  const ws = words(t);
  if (ws.length >= 6 && new Set(ws).size / ws.length < 0.35) return true;
  return false;
}

/**
 * 拼写判定的词单元切分：撇号属于拼写本身，连字符等其余标点去掉、空白压缩成单空格、忽略首尾空格。
 * `abandon ship` → ['abandon', 'ship']；`well-known` → ['wellknown']；`don't` → ["don't"]。
 * 撇号必须留着，否则 `dont` 会被判成 `don't`（拼写题上这是两个答案）。
 */
function spellingUnits(text: string): string[] {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^A-Za-z0-9'\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** 这个词是否必须原样大写：正确答案里写了大写，或落在配置的「专有名词」名单里 */
function mustKeepCase(word: string): boolean {
  if (/[A-Z]/.test(word)) return true;
  const lower = word.toLowerCase();
  return appConfig.grading.keepCaseWords.some((w) => w.toLowerCase() === lower);
}

/**
 * 拼写判对（听写与「积累」默写共用这一条口径）：
 * - 忽略大小写（除非该词是专有名词，见 `mustKeepCase`）；
 * - 忽略开头 / 末尾不小心多打的空格与多余空白（`abandon  ship` = `abandon ship`）；
 * - 但**词数必须一致**，所以 `abandon ship` 与 `abandonship` 不会互相判对。
 */
export function spellingMatches(input: string, expected: string): boolean {
  const a = spellingUnits(input);
  const e = spellingUnits(expected);
  if (e.length === 0 || a.length !== e.length) return false;
  return e.every((w, i) => (mustKeepCase(w) ? a[i] === w : a[i].toLowerCase() === w.toLowerCase()));
}

/** 与「上一个等长区间」无关的本地评分：输入题干与作答，输出四要素结果 */
export function localGrade(item: ExerciseItem, def: ExerciseTypeDef, answer: string, seconds: number): GradingResult {
  const now = Date.now();
  const text = answer.trim();

  // 客观题：选择 / 听写
  if (item.answerIndex !== undefined) {
    const correct = answer === String(item.answerIndex);
    const issues: GradingIssue[] = correct
      ? []
      : [
          {
            where: '第 1 题',
            kind: '理解',
            detail: trf('正确答案是「{a}」，定位句：{e}', { a: item.choices?.[item.answerIndex] ?? '', e: item.evidence ?? tr('见原文') }),
          },
        ];
    return {
      total: correct ? 100 : 0,
      breakdown: [{ label: '理解准确度', score: correct ? 100 : 0, max: 100 }],
      issues,
      advice: correct ? ['保持这个节奏，继续下一题。'] : ['回到定位句，逐句划出与选项对应的关键词。'],
      reference: item.evidence,
      gradedAt: now,
    };
  }

  if (item.dictationAnswer) {
    // 两侧同一套判定：忽略大小写与首尾 / 多余空格，专有名词仍要求原样大写
    const correct = spellingMatches(text, item.dictationAnswer);
    return {
      total: correct ? 100 : 0,
      breakdown: [{ label: '拼写准确', score: correct ? 100 : 0, max: 100 }],
      issues: correct
        ? []
        : [{ where: '本词', kind: '拼写', detail: trf('正确拼写是 {w}', { w: item.dictationAnswer }) }],
      advice: correct ? ['拼写正确，继续下一题。'] : [trf('把 {w} 加入错题队列，今天再拼一遍。', { w: item.dictationAnswer })],
      gradedAt: now,
    };
  }

  const ws = words(text);
  const wordCount = ws.length;
  const sents = sentences(text);

  // 无意义字符 / 字数不足：必须给出扣分理由，而不是直接给高分（FR-E-7 验收标准）
  if (isMeaningless(text) || wordCount < 6) {
    const breakdown: AnswerBreakdownItem[] = [
      { label: '内容', score: 8, max: 100 },
      { label: '语言', score: 10, max: 100 },
    ];
    return {
      total: 12,
      breakdown,
      issues: [
        { where: '整篇', kind: '内容', detail: '作答过短或缺少有效内容，无法体现题目要点。' },
        { where: '整篇', kind: '语言', detail: '未形成完整的句子结构。' },
      ],
      advice: ['先按题目要点列出 2-3 个关键信息，再逐句展开。', '保证每句话都有主语和谓语。'],
      reference: item.reference,
      gradedAt: now,
    };
  }

  if (def.board === 'writing') {
    const target = item.wordRange?.[0] ?? 80;
    const lenScore = clamp(40 + (wordCount / target) * 60);
    const unique = new Set(ws).size / wordCount;
    const avgLen = wordCount / Math.max(1, sents.length);
    const pointHits = (item.points ?? []).filter((p) => {
      const kw = words(p);
      return kw.length > 0 && kw.some((k) => text.toLowerCase().includes(k));
    }).length;
    const pointScore = item.points?.length ? clamp((pointHits / item.points.length) * 60 + 40) : 78;
    const structure = clamp(50 + Math.min(sents.length, 6) * 8);
    const language = clamp(55 + (unique - 0.55) * 90);
    const coherence = clamp(60 + Math.min(avgLen, 18) * 1.4);

    const breakdown: AnswerBreakdownItem[] = [
      { label: '内容', score: Math.round(lenScore * 0.4 + pointScore * 0.6), max: 100 },
      { label: '结构', score: Math.round(structure), max: 100 },
      { label: '语言', score: Math.round(language), max: 100 },
      { label: '连贯', score: Math.round(coherence), max: 100 },
    ];
    const total = Math.round(breakdown.reduce((s, b) => s + b.score * 0.25, 0));
    const issues: GradingIssue[] = [];
    if (wordCount < target) {
      issues.push({ where: '整篇', kind: '内容', detail: trf('字数 {n}，低于题目要求的 {t} 词，展开不足。', { n: wordCount, t: target }) });
    }
    if (unique < 0.6) {
      issues.push({ where: '全篇用词', kind: '语言', detail: '重复用词较多，可换用同义词提升表达层次。' });
    }
    if (avgLen > 26) {
      issues.push({ where: '句子长度', kind: '连贯', detail: '平均句长偏长，建议拆句或加入连接词。' });
    }
    if (pointHits < (item.points?.length ?? 0)) {
      const missing = (item.points ?? []).filter((p) => !words(p).some((k) => text.toLowerCase().includes(k)));
      if (missing.length) issues.push({ where: '要点覆盖', kind: '内容', detail: trf('未覆盖要点：{list}', { list: missing.join(sentenceSep()) }) });
    }
    return {
      total,
      breakdown,
      issues,
      advice: [
        issues.length ? '按上面的问题定位逐条改写，再提交一次对比分数变化。' : '结构清晰，可以把重点放在句式变化上。',
        `参考范文已给出，重点看它如何用连接词串起段落。`,
      ],
      reference: item.reference,
      gradedAt: now,
    };
  }

  if (def.board === 'translating') {
    const src = item.sourceText ?? '';
    const srcWords = words(src).length;
    const ratio = srcWords > 0 ? wordCount / srcWords : 1;
    const lenScore = clamp(100 - Math.abs(ratio - 1) * 70);
    const unique = new Set(ws).size / wordCount;
    const breakdown: AnswerBreakdownItem[] = [
      { label: '用词', score: Math.round(clamp(58 + (unique - 0.6) * 80)), max: 100 },
      { label: '语法', score: Math.round(clamp(70 + Math.min(sents.length, 4) * 4)), max: 100 },
      { label: '语序', score: Math.round(clamp(lenScore)), max: 100 },
      { label: '地道度', score: Math.round(clamp(62 + (unique - 0.6) * 70)), max: 100 },
    ];
    const total = Math.round(breakdown.reduce((s, b) => s + b.score * 0.25, 0));
    const issues: GradingIssue[] = [];
    if (ratio < 0.75) issues.push({ where: '整段', kind: '用词', detail: '译文明显短于原文，可能漏译了信息。' });
    if (ratio > 1.35) issues.push({ where: '整段', kind: '地道度', detail: '译文偏长，中文原意可用更简洁的英文表达。' });
    if (sents.length <= 1) issues.push({ where: '整段', kind: '语序', detail: '建议按原句结构分句，避免一句到底。' });
    return {
      total,
      breakdown,
      issues,
      advice: [
        '同义但正确的表达不会被判为错误，优先保证信息完整。',
        '对照参考译文，挑 1-2 处替换成更地道的搭配。',
      ],
      reference: item.reference,
      gradedAt: now,
    };
  }

  // 口语类：以录音时长与文本长度近似估计（正式版替换为语音评测服务）
  const expected = Math.max(1, words(item.speakText ?? '').length);
  const fluency = clamp(60 + (words(text).length / expected) * 40);
  const breakdown: AnswerBreakdownItem[] = [
    { label: '重音', score: Math.round(clamp(fluency - 6)), max: 100 },
    { label: '流利度', score: Math.round(clamp(fluency)), max: 100 },
    ...(def.id === 'speaking-word' ? [] : [{ label: '语调', score: Math.round(clamp(fluency - 3)), max: 100 }]),
  ];
  const total = Math.round(breakdown.reduce((s, b) => s + b.score, 0) / breakdown.length);
  return {
    total,
    breakdown,
    issues: [
      { where: '重音位置', kind: '重音', detail: '注意重读实词，弱读虚词；本次重音位置基本正确。' },
      { where: '句子停顿', kind: '流利度', detail: '停顿略多，建议跟着示范朗读连读两遍。' },
    ],
    advice: ['回放自己的录音，与示范朗读逐句对比。', '把长句拆成意群，按意群换气。'],
    reference: item.speakText,
    gradedAt: now,
  };
}

export interface GradeOptions {
  attemptId: string;
  item: ExerciseItem;
  def: ExerciseTypeDef;
  answer: string;
  seconds: number;
  /** 模拟远端不可用，用于验证 FR-E-15 兜底 */
  forceFailure?: boolean;
  onFeedback?: (f: GradingFeedback) => void;
  /** 模拟网络延迟，默认 1.4s */
  latencyMs?: number;
}

/** 模拟远端往返：正式版这里是真实的评分接口 */
const DEFAULT_GRADING_LATENCY_MS = 1400;

/**
 * 客观题（选择题、听写）的判分不依赖模型：答案对错在本地就能判死，
 * 所以不该陪着主观题一起等模拟网络延迟（实测白等 1.9s）。
 */
export function isLocallyDecidable(item: ExerciseItem): boolean {
  return item.answerIndex !== undefined || Boolean(item.dictationAnswer);
}

/**
 * 提交评分：20s 提示「正在评分」并保留页面；30s 或报错转「评分失败，请稍后重试」（FR-E-15）。
 * 返回 null 表示评分失败，调用方必须保留草稿。
 *
 * 客观题同步出分（不发 `grading` 阶段，按钮不转圈）；显式传 `latencyMs` 时按传入值走，
 * 这条留给「模拟网络/超时」的测试。
 */
export async function requestGrading(opts: GradeOptions): Promise<GradingResult | null> {
  const { softTimeoutMs, hardTimeoutMs } = appConfig.grading;
  const instant = opts.latencyMs === undefined && isLocallyDecidable(opts.item);
  const latency = opts.latencyMs ?? (instant ? 0 : DEFAULT_GRADING_LATENCY_MS);
  const started = Date.now();

  if (!instant) opts.onFeedback?.({ phase: 'grading', message: '正在评分…' });

  const softTimer = instant
    ? null
    : setTimeout(() => {
        opts.onFeedback?.({ phase: 'soft-pending', message: '正在评分，请勿离开本页，草稿已保留' });
      }, Math.min(softTimeoutMs, Math.max(0, latency)));

  try {
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        if (opts.forceFailure) reject(new Error('UPSTREAM_UNAVAILABLE'));
        else resolve(null);
      }, latency);
      setTimeout(() => {
        clearTimeout(t);
        reject(new Error('TIMEOUT'));
      }, hardTimeoutMs);
    });
    if (softTimer) clearTimeout(softTimer);
    const elapsed = Date.now() - started;
    if (elapsed > hardTimeoutMs) throw new Error('TIMEOUT');
    const result = localGrade(opts.item, opts.def, opts.answer, opts.seconds);
    opts.onFeedback?.({ phase: 'succeeded', message: '评分完成' });
    return result;
  } catch {
    if (softTimer) clearTimeout(softTimer);
    opts.onFeedback?.({ phase: 'failed', message: FRIENDLY_ERROR });
    return null;
  }
}

/** 把接口错误映射为可读文案，禁止把原始错误码直接展示给用户（IF-4） */
export function friendlyError(code: string): string {
  const table: Record<string, string> = {
    TIMEOUT: '评分超时，请检查网络后重试',
    UPSTREAM_UNAVAILABLE: 'AI 服务暂时不可用，请稍后重试',
    UNAUTHORIZED: '登录状态已失效，请重新登录后再评分',
    RATE_LIMITED: '请求过于频繁，请稍候再试',
  };
  return table[code] ?? FRIENDLY_ERROR;
}
