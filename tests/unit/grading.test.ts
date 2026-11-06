import { describe, expect, it, vi } from 'vitest';
import { friendlyError, localGrade, requestGrading, spellingMatches } from '@/domain/grading';
import { appConfig } from '@/config/appConfig';
import { defOf, item } from './fixtures';

/**
 * 评分链路（FR-E-14 / FR-E-15）。
 * 重点不是「分数好不好看」，而是：判对判错的口径稳定、失败必须留草稿、错误码不外露。
 */
describe('拼写判定（听写 / 积累默写共用）', () => {
  it('完全一致算对', () => {
    expect(spellingMatches('abandon', 'abandon')).toBe(true);
  });

  it('忽略大小写', () => {
    expect(spellingMatches('Abandon', 'abandon')).toBe(true);
    expect(spellingMatches('ABANDON', 'abandon')).toBe(true);
  });

  it('忽略首尾空格与中间的多余空白', () => {
    expect(spellingMatches('  abandon  ', 'abandon')).toBe(true);
    expect(spellingMatches('abandon   ship', 'abandon ship')).toBe(true);
  });

  it('词数必须一致：连写不当成对', () => {
    expect(spellingMatches('abandonship', 'abandon ship')).toBe(false);
    expect(spellingMatches('abandon', 'abandon ship')).toBe(false);
  });

  it('空答案不算对', () => {
    expect(spellingMatches('', 'abandon')).toBe(false);
    expect(spellingMatches('   ', 'abandon')).toBe(false);
  });

  it('正确答案里带大写（专有名词）时要求原样大写', () => {
    expect(spellingMatches('english', 'English')).toBe(false);
    expect(spellingMatches('English', 'English')).toBe(true);
  });

  it('配置里的专有名词同样要求大写', () => {
    const original = [...appConfig.grading.keepCaseWords];
    try {
      appConfig.grading.keepCaseWords = ['IELTS'];
      expect(spellingMatches('ielts', 'IELTS')).toBe(false);
      expect(spellingMatches('IELTS', 'IELTS')).toBe(true);
    } finally {
      appConfig.grading.keepCaseWords = original;
    }
  });

  it('撇号是拼写的一部分：dont 不等于 don\'t', () => {
    expect(spellingMatches("don't", "don't")).toBe(true);
    expect(spellingMatches('dont', "don't")).toBe(false);
  });

  it('连字符不计入差异（well-known 写作 wellknown 也算对）', () => {
    expect(spellingMatches('wellknown', 'well-known')).toBe(true);
  });
});

describe('客观题与听写判分', () => {
  it('选对得满分，且不给扣分理由', () => {
    const res = localGrade(
      item({ id: 'q1', answerIndex: 2, choices: ['A', 'B', 'C'], evidence: '原文第二段', dictationAnswer: undefined }),
      defOf('comprehension'),
      '2',
      30,
    );
    expect(res.total).toBe(100);
    expect(res.issues).toHaveLength(0);
    expect(res.breakdown[0]).toMatchObject({ score: 100, max: 100 });
  });

  it('选错得 0 分，并给出正确答案与定位句', () => {
    const res = localGrade(
      item({ id: 'q1', answerIndex: 2, choices: ['A', 'B', 'C'], evidence: '原文第二段', dictationAnswer: undefined }),
      defOf('comprehension'),
      '0',
      30,
    );
    expect(res.total).toBe(0);
    expect(res.issues[0].detail).toContain('C');
    expect(res.reference).toBe('原文第二段');
    expect(res.advice.length).toBeGreaterThan(0);
  });

  it('听写错时给出正确拼写，且分数只有 0 / 100 两档', () => {
    const right = localGrade(item({ dictationAnswer: 'abandon' }), defOf('dictation'), 'abandon', 10);
    const wrong = localGrade(item({ dictationAnswer: 'abandon' }), defOf('dictation'), 'abandan', 10);
    expect(right.total).toBe(100);
    expect(wrong.total).toBe(0);
    expect(wrong.issues[0].detail).toContain('abandon');
  });
});

describe('主观题判分（写作 / 翻译 / 口语）', () => {
  it('作答过短必须给低分并说明理由，不能白拿高分', () => {
    const res = localGrade(item({ id: 'w1', dictationAnswer: undefined }), defOf('writing-passage'), 'too short', 20);
    expect(res.total).toBeLessThanOrEqual(20);
    expect(res.issues.length).toBeGreaterThanOrEqual(2);
    expect(res.advice.length).toBeGreaterThan(0);
  });

  it('字数不足时明确指出差距', () => {
    const text =
      'The debate over online learning has lasted for years. Some students enjoy the freedom to arrange their own schedule. ' +
      'Others miss the direct feedback of a classroom. In my view the two formats can work together. ' +
      'A short lecture recorded in advance saves commuting time. A weekly seminar then keeps the discussion alive.';
    const res = localGrade(
      item({ id: 'w2', dictationAnswer: undefined, points: ['优点', '缺点', '结论'], wordRange: [120, 180], reference: '范文' }),
      defOf('writing-passage'),
      text,
      120,
    );
    expect(res.total).toBeGreaterThanOrEqual(0);
    expect(res.total).toBeLessThanOrEqual(100);
    expect(res.breakdown).toHaveLength(4);
    expect(res.issues.some((i) => i.detail.includes('字数'))).toBe(true);
  });

  it('翻译明显偏短时提示可能漏译', () => {
    const res = localGrade(
      item({
        id: 't1',
        dictationAnswer: undefined,
        sourceText: 'The quick brown fox jumps over the lazy dog every single morning',
        reference: '参考译文',
      }),
      defOf('translating-genre'),
      'The fox jumps over the dog.',
      60,
    );
    expect(res.issues.some((i) => i.detail.includes('漏译'))).toBe(true);
  });

  it('口语题的分数落在 0~100，且分项不超过三项', () => {
    const res = localGrade(
      item({ id: 's1', dictationAnswer: undefined, speakText: 'Good morning everyone' }),
      defOf('speaking-sentence'),
      'good morning everyone',
      5,
    );
    expect(res.total).toBeGreaterThanOrEqual(0);
    expect(res.total).toBeLessThanOrEqual(100);
    expect(res.breakdown.length).toBeLessThanOrEqual(3);
  });
});

describe('提交链路（FR-E-14 / FR-E-15）', () => {
  it('客观题同步出分：不发「正在评分」中间态，也不走模拟延迟', async () => {
    const feedback: string[] = [];
    const t0 = Date.now();
    const res = await requestGrading({
      attemptId: 'a0',
      item: item({ dictationAnswer: 'abandon' }),
      def: defOf('dictation'),
      answer: 'abandon',
      seconds: 6,
      onFeedback: (f) => feedback.push(f.phase),
    });
    expect(res!.total).toBe(100);
    // 起点就是终态：界面不会出现转圈或「正在评分…」
    expect(feedback).toEqual(['succeeded']);
    expect(Date.now() - t0).toBeLessThan(100);
  });

  it('走远端链路（主观题或显式指定延迟）时才有 grading 中间态', async () => {
    const feedback: string[] = [];
    const res = await requestGrading({
      attemptId: 'a0b',
      item: item({ dictationAnswer: 'abandon' }),
      def: defOf('dictation'),
      answer: 'abandon',
      seconds: 6,
      latencyMs: 1,
      onFeedback: (f) => feedback.push(f.phase),
    });
    expect(res!.total).toBe(100);
    expect(feedback[0]).toBe('grading');
    expect(feedback[feedback.length - 1]).toBe('succeeded');
  });

  it('评分成功返回四要素（总分 / 分项 / 问题 / 建议）', async () => {
    const feedback: string[] = [];
    const res = await requestGrading({
      attemptId: 'a1',
      item: item({ dictationAnswer: 'abandon' }),
      def: defOf('dictation'),
      answer: 'abandon',
      seconds: 12,
      latencyMs: 1,
      onFeedback: (f) => feedback.push(f.phase),
    });
    expect(res).not.toBeNull();
    expect(res!.total).toBe(100);
    expect(Array.isArray(res!.breakdown)).toBe(true);
    expect(feedback[0]).toBe('grading');
    expect(feedback[feedback.length - 1]).toBe('succeeded');
  });

  it('上游不可用时返回 null（调用方据此保留草稿），文案不暴露错误码', async () => {
    const feedback: string[] = [];
    const res = await requestGrading({
      attemptId: 'a2',
      item: item(),
      def: defOf('dictation'),
      answer: 'abandon',
      seconds: 1,
      latencyMs: 1,
      forceFailure: true,
      onFeedback: (f) => feedback.push(f.message),
    });
    expect(res).toBeNull();
    expect(feedback.some((m) => m.includes('UPSTREAM_UNAVAILABLE'))).toBe(false);
  });

  it('超过硬超时返回 null，不抛异常到界面', async () => {
    const original = appConfig.grading.hardTimeoutMs;
    try {
      appConfig.grading.hardTimeoutMs = 10;
      const res = await requestGrading({
        attemptId: 'a3',
        item: item(),
        def: defOf('dictation'),
        answer: 'abandon',
        seconds: 1,
        latencyMs: 50,
      });
      expect(res).toBeNull();
    } finally {
      appConfig.grading.hardTimeoutMs = original;
    }
  });

  it('错误码映射成可读文案，未知码给兜底文案', () => {
    expect(friendlyError('TIMEOUT')).toContain('超时');
    expect(friendlyError('RATE_LIMITED')).toContain('频繁');
    expect(friendlyError('WHATEVER_500')).toBe('评分失败，请稍后重试');
  });
});
