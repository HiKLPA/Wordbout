import React, { useMemo, useState } from 'react';
import { Pressable, View, type TextStyle } from 'react-native';

import { AppText, Card, PrimaryButton } from '@/components/ui';
import { lookupWord } from '@/domain/dictionary';
import { trf } from '@/i18n';
import { useApp } from '@/store/AppStore';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * 阅读理解原文（FR-E-12）：点词即查，但不再「点一下就收藏」。
 *
 * 交互：
 * 1. 点原文里的任意单词 → 该词**变红**（选中态，同屏只保留一个），
 *    原文下方展开两个按钮：「收入默认收藏夹」「翻译」（中间不加分隔线）；
 * 2. 点「收入默认收藏夹」→ 收进内置「默认」收藏夹（FR-T-1），按钮变为「移出默认收藏夹」，
 *    再点一次即取消收入；
 * 3. 点「翻译」→ 在按钮下方给出该词的释义，版式与课本「单词详解」一致但**不带义项编号**
 *    （`(词性) 英文释义` 16px + 中文释义 14px，均常规字重），不再重复当前单词；
 *    查不到时给「暂无释义」，不编造。
 *
 * 颜色不是唯一通道（NFR-7）：选中态另有无障碍状态与按钮文案变化，释义本身是文字。
 */

/** 查不到释义时记进收藏夹的兜底说明（与旧的阅读标记生词同一句） */
const FALLBACK_DEFINITION = '来自阅读理解标记的生词';

/** 两个操作按钮的几何：并排放下两枚，文字放不下时由 flexWrap 自动改竖排 */
const TOOL_BTN = { flexGrow: 1, flexBasis: 132, minHeight: 44, paddingHorizontal: 12 };

/**
 * 释义排布沿用课本「单词详解」（`components/WordDetail.tsx`）的两行结构：
 * `(词性) 英文释义` 16px + 中文释义 14px。
 * 已去掉义项序号圆标（这里只有一个义项，编号没有信息量）。
 */
/** 同一义项内部的行距（课本 PANEL_GAP_INNER 同值） */
const SENSE_INNER_GAP = 4;

/** 释义两行统一右对齐：短释义不铺满整行，右侧与正文文字右缘对齐 */
const ALIGN_RIGHT: TextStyle = { textAlign: 'right' };

export function ReadingPassage({ text }: { text: string }) {
  const theme = useTheme();
  const { state, actions } = useApp();
  /** 释义区的中文释义统一 14px / 行高 19（与课本「单词详解」同一档） */
  /** 当前选中的词在 `words` 中的下标（null = 没有选中） */
  const [selected, setSelected] = useState<number | null>(null);
  /** 是否已经点过「翻译」（换词时复位） */
  const [translated, setTranslated] = useState(false);

  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);
  const raw = selected === null ? '' : (words[selected] ?? '');
  const token = raw.replace(/[^a-zA-Z-]/g, '');
  const gloss = useMemo(() => lookupWord(token), [token]);
  /** 收藏用的词条名：查到原形就存原形，否则存原文里的词形 */
  const savedWord = gloss?.word ?? token;
  const saved = savedWord.length > 0 && state.favorites.some((f) => f.word === savedWord);

  const pick = (index: number) => {
    setSelected(index);
    setTranslated(false);
  };

  const toggleSaved = () =>
    actions.toggleFavorite({
      word: savedWord,
      definition: gloss ? `${gloss.partOfSpeech} ${gloss.definitionZh}` : FALLBACK_DEFINITION,
      source: 'exercise',
    });

  return (
    <Card style={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {words.map((w, i) => {
          const active = i === selected;
          return (
            <Pressable
              key={`${w}-${i}`}
              onPress={() => pick(i)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={active ? trf('{w}，已选中', { w }) : trf('查询 {w}', { w })}
            >
              <AppText
                kind="md"
                weight="regular"
                color={active ? theme.colors.brand : theme.colors.text}
              >
                {w}{' '}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {/* 选中一个词后才展开：收入默认收藏夹（再点一次即移出）/ 翻译 */}
      {selected !== null && token.length > 0 ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <PrimaryButton
              label={saved ? '移出默认收藏夹' : '收入默认收藏夹'}
              tone="ghost"
              panel
              labelKind="sm"
              style={TOOL_BTN}
              onPress={toggleSaved}
            />
            <PrimaryButton
              label="翻译"
              labelKind="sm"
              style={TOOL_BTN}
              onPress={() => setTranslated(true)}
            />
          </View>
          {/* 译文：不再重复当前单词（原文里已标红），也不给义项编号，只按课本样式给出释义 */}
          {translated ? (
            gloss ? (
              <View style={{ gap: SENSE_INNER_GAP }}>
                {/* 英文释义在前：16px（sm 档）常规字重（与正文、选项同属常规，整块不加粗），
                    词性用英文括号置于释义之前；释义整体右对齐（不铺满整行） */}
                <AppText
                  kind="sm"
                  weight="regular"
                  color={theme.colors.text}
                  style={ALIGN_RIGHT}
                >
                  {gloss.definition
                    ? `(${gloss.partOfSpeech}) ${gloss.definition}`
                    : `(${gloss.partOfSpeech})`}
                </AppText>
                {/* 中文释义在后：tiny 档 14px，与英文释义同为右对齐 */}
                <AppText
                  kind="tiny"
                  color={theme.colors.textSecondary}
                  style={ALIGN_RIGHT}
                >
                  {gloss.definitionZh}
                </AppText>
              </View>
            ) : (
              <AppText kind="tiny" color={theme.colors.textSecondary}>
                暂无释义
              </AppText>
            )
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
