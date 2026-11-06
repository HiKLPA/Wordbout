/**
 * 词典层的公共类型与错误定义。
 *
 * 说明（与文案本地化口径一致）：本目录属于数据层，只出现结构化的、语言无关的数据，
 * 具体的展示文案由界面层用 `tr()` 组装。所以标签用 `ox` / `cet4` 这类码，而不是中文。
 */

/** 内置 / 在线词典的标识 */
export type DictId = 'ecdict' | 'wiktionary' | 'cedict' | 'ecdict-reverse';

/** 词典支持的查询方向（按「从哪种语言查起」分类） */
export type DictFrom = 'en' | 'zh';

export interface DictSense {
  /** 词性缩写（如 `n.` / `adj.`），无则空串 */
  pos: string;
  /** 释义正文（英汉词典为中文，汉英 / 英英词典为英文） */
  text: string;
}

export interface DictEntry {
  dictId: DictId;
  /** 词条（可能是词形还原后的原型） */
  headword: string;
  /** 文本里实际命中的那个写法（可能与 headword 不同，如查询 abandoned 命中 abandon） */
  query: string;
  /** 音标，展示时自带两侧斜杠 */
  phonetic: string;
  /** 汉语拼音（带声调符号），非中文词条为空串 */
  pinyin: string;
  /** 繁体写法，与简体相同则为空串 */
  traditional: string;
  /** 标签码：ox zk gk cet4 cet6 ky toefl ielts gre c4 c5 */
  tags: string[];
  /** 词频档：1 高频 / 2 常用 / 3 一般 / 0 无数据 */
  frequency: number;
  senses: DictSense[];
  /** 例句（英文），最多 3 条 */
  examples: string[];
  /** 命中原型时填原型词，否则为 null */
  lemma: string | null;
}

export interface DictMeta {
  id: DictId;
  /** 词典名（i18n 键 = 中文原文） */
  name: string;
  /** 从哪种语言查 */
  from: DictFrom;
  /** 数据是否随包内置（否则需要联网） */
  bundled: boolean;
  /** 数据来源（纯 ASCII，直接展示） */
  source: string;
  /** 许可协议（纯 ASCII，直接展示） */
  license: string;
}

/** 查询失败原因（IF-4：只给用户可读文案，不外露原始状态码） */
export type DictErrorCode = 'network' | 'timeout' | 'bad-response';

export class DictError extends Error {
  readonly code: DictErrorCode;

  constructor(code: DictErrorCode) {
    super(code);
    this.name = 'DictError';
    this.code = code;
  }
}
