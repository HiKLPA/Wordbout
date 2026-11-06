/**
 * 文字脚本判定（中文 vs 英文/数字）。
 *
 * 排版规则：汉字与中文标点统一用思源黑体（Noto Sans SC，与思源黑体同一套字形），
 * 英文、数字统一用 Barlow。混排句子由 <AppText> 按脚本拆成多个 run 分别套字体，
 * 因为 React Native 不支持 fontFamily 回退列表。
 */

/** 汉字、中文标点、全角字母数字（含康熙部首/注音/带圈字符等常用中文区段） */
const CJK_PATTERN =
  /[\u2e80-\u2eff\u3000-\u303f\u31c0-\u31ef\u3200-\u33ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\ufe10-\ufe4f\uff00-\uffef]/;

export interface ScriptRun {
  text: string;
  /** true = 中文（思源黑体），false = 英文/数字/其他符号（Barlow） */
  cjk: boolean;
}

/** 是否包含汉字或中文标点 */
export function hasCjk(text: string): boolean {
  return CJK_PATTERN.test(text);
}

/** 按脚本把字符串切成连续片段，供混排字体使用 */
export function splitScriptRuns(text: string): ScriptRun[] {
  const runs: ScriptRun[] = [];
  for (const char of text) {
    const cjk = CJK_PATTERN.test(char);
    const last = runs[runs.length - 1];
    if (last && last.cjk === cjk) last.text += char;
    else runs.push({ text: char, cjk });
  }
  return runs;
}
