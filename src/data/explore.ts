import type { ExploreModeId } from '@/config/appConfig';
import type { ExploreResultItem } from '@/domain/types';

/**
 * 探索数据（FR-X-1 / FR-X-2）。
 * 初始开发阶段使用本地词源知识库 + 模板兜底，保证「即使是生僻词也不返回空白页」；
 * 真的没有该维度内容时，由调用方展示「该词暂无此维度内容」。
 */

interface Knowledge {
  word: string;
  etymology: string;
  root: string;
  rootMeaning: string;
  family: { word: string; meaning: string }[];
  synonyms: { word: string; note: string }[];
  antonyms: { word: string; note: string }[];
  collocations: string[];
}

const knowledge: Knowledge[] = [
  {
    word: 'substantial',
    etymology:
      '来自拉丁语 substantia（实体、本质）。sub-（在下面）+ stare（站立），字面是「站在下面支撑着的东西」，所以引申为「实在的、可观的」。',
    root: 'st- / sta-（站立、稳定）',
    rootMeaning: '站立、稳定',
    family: [
      { word: 'substance', meaning: 'n. 物质；实质' },
      { word: 'substantiate', meaning: 'v. 证实' },
      { word: 'substantive', meaning: 'adj. 实质性的' },
      { word: 'stable', meaning: 'adj. 稳定的' },
      { word: 'statue', meaning: 'n. 雕像' },
      { word: 'establish', meaning: 'v. 建立' },
    ],
    synonyms: [
      { word: 'considerable', note: '偏「数量大」，与 substantial 最接近' },
      { word: 'significant', note: '偏「重要、显著」' },
      { word: 'sizeable', note: '偏「体积/规模大」' },
      { word: 'appreciable', note: '偏「可感知到的」' },
    ],
    antonyms: [
      { word: 'insignificant', note: '微不足道的' },
      { word: 'negligible', note: '可忽略的' },
      { word: 'trivial', note: '琐碎不重要的' },
    ],
    collocations: [
      'a substantial amount of',
      'substantial progress',
      'substantial evidence',
      'substantial increase',
      'substantial part of',
    ],
  },
  {
    word: 'genuine',
    etymology:
      '来自拉丁语 genuinus（天生的、本来的），与 gignere（产生、生育）同源，后来引申为「天生的 → 真的、真诚的」。',
    root: '-gen-（产生、出生）',
    rootMeaning: '产生、出生',
    family: [
      { word: 'generate', meaning: 'v. 产生' },
      { word: 'genesis', meaning: 'n. 起源' },
      { word: 'generous', meaning: 'adj. 慷慨的' },
      { word: 'genetic', meaning: 'adj. 基因的' },
      { word: 'ingenious', meaning: 'adj. 巧妙的' },
    ],
    synonyms: [
      { word: 'authentic', note: '强调「不是仿制品」' },
      { word: 'sincere', note: '强调「感情真诚」' },
      { word: 'real', note: '最口语，范围最广' },
    ],
    antonyms: [
      { word: 'fake', note: '假的' },
      { word: 'counterfeit', note: '伪造的' },
      { word: 'insincere', note: '不真诚的' },
    ],
    collocations: [
      'genuine interest',
      'genuine concern',
      'a genuine attempt',
      'genuine leather',
      'genuine smile',
    ],
  },
  {
    word: 'abandon',
    etymology:
      '源自古法语 abandoner，意为「把某物置于他人支配之下」。a-（向）+ bandon（支配权），从「交出支配权」演变为「放弃、抛弃」。',
    root: 'ban-（宣告、支配）',
    rootMeaning: '宣告、支配',
    family: [
      { word: 'abandonment', meaning: 'n. 放弃；遗弃' },
      { word: 'bandit', meaning: 'n. 强盗（原义「被放逐者」）' },
      { word: 'ban', meaning: 'v./n. 禁止' },
    ],
    synonyms: [
      { word: 'desert', note: '强调「抛下应负责任的人」' },
      { word: 'forsake', note: '正式，强调「彻底断绝」' },
      { word: 'quit', note: '口语，强调「停止做」' },
    ],
    antonyms: [
      { word: 'retain', note: '保留' },
      { word: 'maintain', note: '维持' },
      { word: 'persist', note: '坚持' },
    ],
    collocations: ['abandon a plan', 'abandon ship', 'with abandon', 'abandon oneself to'],
  },
];

function generic(mode: ExploreModeId, word: string): ExploreResultItem[] {
  const base = word.trim();
  switch (mode) {
    case 'etymology':
      return [
        {
          id: `${mode}-${base}-0`,
          title: `${base} 的词源线索`,
          detail: `该词暂未收录完整词源。可以先拆前缀与后缀：常见前缀 dis-/re-/pre-/sub- 分别表示「分开 / 再 / 前 / 下」，后缀 -tion/-ment/-ive 分别表示「名词 / 名词 / 形容词」。`,
          extra: '词源资料持续补录中',
        },
      ];
    case 'roots':
      return [
        {
          id: `${mode}-${base}-0`,
          title: `${base} 的同根词思路`,
          detail: `把 ${base} 去掉后缀得到词干，再找同词干的名词、动词、形容词形式，重点记「同一个词干的词性家族」。`,
          extra: '同一词干按词性成组记忆效率最高',
        },
      ];
    case 'synonyms':
      return [
        {
          id: `${mode}-${base}-0`,
          title: `${base} 的近义词检索`,
          detail: `该词暂无内置近义词表。可以在翻译页输入 ${base}，结果区会给出候选近义词与例句。`,
        },
      ];
    case 'antonyms':
      return [
        {
          id: `${mode}-${base}-0`,
          title: `${base} 的反义词检索`,
          detail: `该词暂无内置反义词表。多数形容词通过加 un-/in-/im-/dis- 构成反义，可先试这几个前缀。`,
        },
      ];
    default:
      return [
        {
          id: `${mode}-${base}-0`,
          title: `${base} 的常用搭配`,
          detail: `该词暂无内置搭配表。建议在阅读练习中标记该词出现的前后两个词，连续标记三次即可得到稳定搭配。`,
        },
      ];
  }
}

export function buildExploreResults(mode: ExploreModeId, word: string): ExploreResultItem[] {
  const key = word.trim().toLowerCase();
  if (!key) return [];
  const hit = knowledge.find((k) => k.word === key);
  if (!hit) return generic(mode, word);

  let items: ExploreResultItem[] = [];
  switch (mode) {
    case 'etymology':
      items = [{ id: `${mode}-${key}`, title: `${hit.word} 的词源故事`, detail: hit.etymology }];
      break;
    case 'roots':
      items = [
        {
          id: `${mode}-${key}`,
          title: `词根 ${hit.root}`,
          detail: `含义：${hit.rootMeaning}`,
        },
        ...hit.family.map((f, i) => ({
          id: `${mode}-${key}-${i}`,
          title: f.word,
          detail: f.meaning,
        })),
      ];
      break;
    case 'synonyms':
      items = hit.synonyms.map((s, i) => ({ id: `${mode}-${key}-${i}`, title: s.word, detail: s.note }));
      break;
    case 'antonyms':
      items = hit.antonyms.map((s, i) => ({ id: `${mode}-${key}-${i}`, title: s.word, detail: s.note }));
      break;
    default:
      items = hit.collocations.map((c, i) => ({
        id: `${mode}-${key}-${i}`,
        title: c,
      }));
      break;
  }
  return items;
}
