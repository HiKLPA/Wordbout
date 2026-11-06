import React from 'react';
import { Text } from 'react-native';

import { splitScriptRuns } from '@/theme/script';

/**
 * 中文/英文混排的字体分流。
 *
 * React Native 的 fontFamily 不接受回退列表，所以把一段文案按字符脚本切成若干 run：
 * 汉字与中文标点套思源黑体，英文/数字套 Barlow（父级已设 Barlow，故英文 run 可省略）。
 * 嵌套 <Text> 会继承父级的字号、颜色、行高与字距，这里只需要覆盖 fontFamily。
 */
export function ScriptRuns({ text, latin, cjk }: { text: string; latin: string; cjk: string }) {
  const runs = splitScriptRuns(text);
  if (runs.length === 0) return null;
  if (runs.length === 1) {
    // 纯英文/数字：父级字体已是 Barlow，不加多余节点；纯汉字：换成思源黑体
    return runs[0].cjk ? <Text style={{ fontFamily: cjk }}>{runs[0].text}</Text> : <>{runs[0].text}</>;
  }
  return (
    <>
      {runs.map((run, index) => (
        <Text key={index} style={{ fontFamily: run.cjk ? cjk : latin }}>
          {run.text}
        </Text>
      ))}
    </>
  );
}

/** 递归处理 AppText 的子节点：字符串/数字按脚本拆 run，其他节点原样透传（继承父级字体） */
export function renderScriptChildren(
  node: React.ReactNode,
  latin: string,
  cjk: string,
): React.ReactNode {
  if (typeof node === 'string') return <ScriptRuns text={node} latin={latin} cjk={cjk} />;
  if (typeof node === 'number') return <ScriptRuns text={String(node)} latin={latin} cjk={cjk} />;
  if (Array.isArray(node)) {
    return node.map((child, index) => (
      <React.Fragment key={index}>{renderScriptChildren(child, latin, cjk)}</React.Fragment>
    ));
  }
  return node;
}
