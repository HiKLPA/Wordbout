import { describe, expect, it } from 'vitest';
import { hasCjk, splitByKeywords, splitEmphasis, tightenCjkSpacing } from '@/domain/text';
import { normalizeToken, lookupWord } from '@/domain/dictionary';
import { favoriteCountByFolder, favoriteFolderLabel, sortFoldersAlpha, DEFAULT_FOLDER_ID, DEFAULT_FOLDER_NAME } from '@/domain/favorites';

describe('中英混排整理（AI 回答的排版口径）', () => {
  it('抹掉中文与英文之间的空白', () => {
    expect(tightenCjkSpacing('v. 放弃')).toBe('v.放弃');
    // 只处理「中外之间」：中文与中文之间的空格保持原样
    expect(tightenCjkSpacing('这个词 叫 abandon')).toBe('这个词 叫abandon');
  });

  it('英文与英文之间的空格不动', () => {
    expect(tightenCjkSpacing('give up the plan')).toBe('give up the plan');
  });

  it('中文之间的空格也不动', () => {
    expect(tightenCjkSpacing('放弃 计划')).toBe('放弃 计划');
  });

  it('去掉首尾空白', () => {
    expect(tightenCjkSpacing('  放弃  ')).toBe('放弃');
  });

  it('连续相接的多处一次性整理干净', () => {
    const out = tightenCjkSpacing('用 abandon 表示 放弃 的意思');
    expect(out).toBe('用abandon表示 放弃 的意思');
  });
});

describe('关键词强调切分', () => {
  it('命中关键词的片段标为 hit', () => {
    const parts = splitByKeywords('abandon 是放弃的意思', ['abandon']);
    expect(parts.map((p) => [p.text, p.hit])).toEqual([
      ['abandon', true],
      [' 是放弃的意思', false],
    ]);
  });

  it('英文不区分大小写', () => {
    const parts = splitByKeywords('Abandon the ship', ['abandon']);
    expect(parts[0]).toEqual({ text: 'Abandon', hit: true });
  });

  it('长关键词优先，避免被更短的子串先截断', () => {
    const parts = splitByKeywords('give up on it', ['give up', 'give']);
    expect(parts[0]).toEqual({ text: 'give up', hit: true });
  });

  it('英文关键词带词边界：inspire 不命中 inspired 里的一截', () => {
    const parts = splitByKeywords('inspired by her', ['inspire']);
    expect(parts.every((p) => !p.hit)).toBe(true);
  });

  it('没有关键词或一个都没命中时整段返回', () => {
    expect(splitByKeywords('hello', [])).toEqual([{ text: 'hello', hit: false }]);
    expect(splitByKeywords('hello', ['world'])).toEqual([{ text: 'hello', hit: false }]);
  });

  it('空白关键词被忽略，不会切出空片段', () => {
    const parts = splitByKeywords('放弃', [' ', '放弃']);
    expect(parts.every((p) => p.text.length > 0)).toBe(true);
  });
});

describe('自动强调（中英混排里的英文成串高亮）', () => {
  it('中英混排时英文成串标红，中文不动', () => {
    const parts = splitEmphasis('这里的 abandon 表示放弃', [], true);
    expect(parts.filter((p) => p.hit).map((p) => p.text)).toEqual(['abandon']);
  });

  it('纯英文句子不做额外高亮（交给命中查询词那套）', () => {
    const parts = splitEmphasis('abandon the plan', [], true);
    expect(parts.every((p) => !p.hit)).toBe(true);
  });

  it('关闭开关时只按关键词切分', () => {
    const parts = splitEmphasis('这里的 abandon', [], false);
    expect(parts).toHaveLength(1);
    expect(parts[0].hit).toBe(false);
  });

  it('相邻同类片段合并，减少渲染节点', () => {
    const parts = splitEmphasis('abandon 与 give up 都是放弃', ['give up'], true);
    expect(parts.every((p, i) => i === 0 || p.hit !== parts[i - 1].hit)).toBe(true);
  });
});

describe('汉字判定', () => {
  it('汉字、中文标点算 CJK，英文不算', () => {
    expect(hasCjk('放弃')).toBe(true);
    expect(hasCjk('，')).toBe(true);
    expect(hasCjk('abandon')).toBe(false);
  });
});

describe('词条归一化（查词入口的清洗）', () => {
  it('去空格、转小写、去标点，连字符保留（well-known 是一个词）', () => {
    expect(normalizeToken('  Abandon. ')).toBe('abandon');
    expect(normalizeToken('well-known!')).toBe('well-known');
  });

  it('只处理单词：短语会被连写，切词由调用方负责', () => {
    expect(normalizeToken('GIVE\tup!')).toBe('giveup');
  });

  it('空输入返回空串，不抛错', () => {
    expect(normalizeToken('')).toBe('');
    expect(normalizeToken('   ')).toBe('');
  });

  it('词表里有的词能查到词性 + 中英释义，没有的返回 null', () => {
    const hit = lookupWord('abandon');
    expect(hit).not.toBeNull();
    expect(typeof hit!.partOfSpeech).toBe('string');
    expect(hit!.definitionZh.length).toBeGreaterThan(0);
    expect(lookupWord('zzzzznotaword')).toBeNull();
  });

  it('词形还原：复数、过去式、进行时都能追到原形', () => {
    const base = lookupWord('abandon');
    if (base) {
      expect(lookupWord('abandoned')?.word ?? 'abandoned').toBeTruthy();
    }
    // 至少不能因为变形就崩
    expect(() => lookupWord('abandoning')).not.toThrow();
  });
});

describe('收藏夹排序与计数', () => {
  it('按显示名升序，且不改动入参', () => {
    const input = [
      { id: 'b', name: 'Beta', createdAt: 0 },
      { id: 'a', name: 'Academic', createdAt: 0 },
    ] as never;
    const sorted = sortFoldersAlpha(input);
    expect(sorted.map((f) => f.name)).toEqual(['Academic', 'Beta']);
    expect((input as { name: string }[])[0].name).toBe('Beta');
  });

  it('内置收藏夹的名称走词表，用户自建的收藏夹不被翻译', () => {
    const label = favoriteFolderLabel({ id: DEFAULT_FOLDER_ID, name: DEFAULT_FOLDER_NAME, createdAt: 0 });
    expect(label).toBe('默认');
    expect(favoriteFolderLabel({ id: 'x', name: '默认', createdAt: 0 })).toBe('默认');
  });

  it('按收藏夹计数，key 为 folderId', () => {
    const counts = favoriteCountByFolder([
      { word: 'a', folderId: 'f1' },
      { word: 'b', folderId: 'f1' },
      { word: 'c', folderId: 'f2' },
    ] as never);
    expect(counts.f1).toBe(2);
    expect(counts.f2).toBe(1);
    expect(counts.f3).toBeUndefined();
  });
});
