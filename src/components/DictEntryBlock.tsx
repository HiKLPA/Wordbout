import React from 'react';
import { View } from 'react-native';

import { FavoriteStar } from '@/components/FavoriteStar';
import { SPEAK_BUTTON_SIZE, SpeakButton } from '@/components/SpeakButton';
import { AppText } from '@/components/ui';
import { ExampleText } from '@/components/WordDetail';
import type { DictEntry } from '@/data/dictionaries';
import type { FavoriteSource } from '@/domain/types';
import { trf } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { stroke, typography } from '@/theme/tokens';

/* ------------------------------------------------------------------ *
 * 词条块的几何：整套数值与「单词本」的词条详解面板
 * （`components/WordDetail` 的基础释义面板）保持一致，各处观感相同。
 * ------------------------------------------------------------------ */
/**
 * 义项序号圆标：直径与朗读圆钮（`SPEAK_BUTTON_SIZE` = 20）一致。
 * 圆内填 `surfaceInvert`（与面板**相反**的那一档底色）、外圈 0.5px `border` 描边，数字走 `micro` 档（12px）。
 */
const SENSE_BADGE_SIZE = SPEAK_BUTTON_SIZE;
/** 圆标与首行英文释义（sm 档 16/22 行盒）垂直居中所需的偏移 */
const SENSE_BADGE_OFFSET = (typography.lineHeights.sm - SENSE_BADGE_SIZE) / 2;
/** 行首圆圈（序号圆标 / 音标喇叭）与其后文字的横向间距，全词条块统一这一个值 */
const SENSE_ROW_GAP = 8;
/** 次级释义的左缩进 = 圆标宽 + 横向间距，使主 / 次释义左对齐 */
const SENSE_TEXT_INDENT = SENSE_BADGE_SIZE + SENSE_ROW_GAP;
/** 词条内部行距：同一部分内部（紧密配对的两行，如 单词↔音标） */
export const PANEL_GAP_INNER = 4;
/** 词条内部行距：不同部分之间（头部 / 义项 / 例句 / 标签） */
export const PANEL_GAP_BLOCK = 8;

/** 词条里含汉字（说明查的是中文词）时按中文朗读 */
const CJK = /[\u4e00-\u9fff]/;

/** 词典标签码 → 展示文案（AppText 会按当前语言就地翻译） */
const TAG_LABEL: Record<string, string> = {
  ox: '牛津 3000',
  zk: '中考',
  gk: '高考',
  cet4: '四级',
  cet6: '六级',
  ky: '考研',
  toefl: 'TOEFL',
  ielts: 'IELTS',
  gre: 'GRE',
  c4: '柯林斯四星',
  c5: '柯林斯五星',
};

/** 词频档 → 展示文案 */
const FREQ_LABEL: Record<number, string> = {
  1: '高频词',
  2: '常用词',
  3: '一般词',
};

/** 单条释义的数据形状：`primary` 必填，`secondary` 是缩进的次级释义（可省） */
export interface SenseLine {
  /** 词性缩写（如 `adj.`），无则省略；渲染时用括号包住放在主释义之前 */
  pos?: string;
  /** 主释义（16px = sm 档，正文色） */
  primary: string;
  /** 次级释义（14px，次要色，缩进至与主释义左对齐） */
  secondary?: string;
}

/**
 * 音标行：品牌红圆形喇叭（20px）+ 14px 音标。
 * 「单词本」的词条详解面板 / 词典词条块 / AI 探索共用，三处音标行几何一致。
 */
export function PronunciationRow({
  word,
  text,
  lang,
  label = '发音',
}: {
  /** 要朗读的词 */
  word: string;
  /** 展示的音标（含斜杠，或汉英词典的拼音） */
  text: string;
  /** 朗读语言（`en-US` / `zh-CN`） */
  lang: string;
  /** 朗读按钮的无障碍名（中文原文，内部走 tr） */
  label?: string;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SENSE_ROW_GAP }}>
      <SpeakButton text={word} lang={lang} accessibilityLabel={label} />
      <AppText kind="tiny" color={theme.colors.textSecondary}>
        {text}
      </AppText>
    </View>
  );
}

/**
 * 义项列表：序号圆标（20px、surfaceInvert 实底、0.5px border 描边、数字 12px）
 * + 可选词性（括号、regular 字重，比释义轻一档）+ 16px 主释义 + 可选 14px 次级释义。
 * 「单词本」的词条详解面板 / 词典词条块 / AI 探索共用，三处义项排版一致。
 *
 * `emphasisColor` 给**主释义**换色：AI 探索传强调红（那边的口径是「凡加粗皆为红」——
 * 主释义是本档默认字重，加粗的就必须描红）；单词本与词典词条块不传，保持正文色。
 */
export function SenseRows({
  senses,
  emphasisColor,
}: {
  senses: SenseLine[];
  /** 主释义用色；不传则用正文色 */
  emphasisColor?: string;
}) {
  const theme = useTheme();
  /** 面板内 14px 小字（次级释义）统一字号与行高，与单词本一致 */

  if (senses.length === 0) return null;

  return (
    /* 各义项属于同一部分 → 纵向用部分内间隔 PANEL_GAP_INNER(4) */
    <View style={{ gap: PANEL_GAP_INNER }}>
      {senses.map((sense, index) => (
        <View key={`sense-${index}`} style={{ gap: PANEL_GAP_INNER }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SENSE_ROW_GAP }}>
            {/* 序号圆标：surfaceInvert 实底圆（0.5px border 描边），数字 12px（micro） */}
            <View
              style={{
                width: SENSE_BADGE_SIZE,
                height: SENSE_BADGE_SIZE,
                borderRadius: 999,
                backgroundColor: theme.colors.surfaceInvert,
                borderWidth: stroke.base,
                borderColor: theme.colors.border,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: SENSE_BADGE_OFFSET,
              }}
            >
              <AppText
                kind="micro"
                color={theme.colors.surfaceInvertOn}
                style={{ fontSize: theme.size(typography.micro), lineHeight: theme.size(typography.micro) }}
              >
                {String(index + 1)}
              </AppText>
            </View>
            {/* 词性 + 释义：词性同字号但**字重低一档**（regular 500，释义是 bold 600），
                用括号括起、与释义间隔 4 —— 一眼能分清「这是词性、这才是意思」。
                两截各占一枚 AppText 并排（AppText 的 children 会走脚本分流，不能嵌套） */}
            <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
              {sense.pos ? (
                <AppText kind="sm" weight="regular" color={theme.colors.text}>
                  {`(${sense.pos})`}
                </AppText>
              ) : null}
              <AppText
                kind="sm"
                color={emphasisColor ?? theme.colors.text}
                style={{ flex: 1 }}
              >
                {sense.primary}
              </AppText>
            </View>
          </View>
          {sense.secondary ? (
            <AppText
              kind="tiny"
              color={theme.colors.textSecondary}
              style={{ marginLeft: SENSE_TEXT_INDENT }}
            >
              {sense.secondary}
            </AppText>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/**
 * 单条词典词条块：中英翻译的「分单词释义」与语音翻译的「关键词释义」共用这一份实现，
 * 样式整套对齐「单词本」的词条详解面板（`components/WordDetail` 基础释义面板）——
 * 单词 32px 品牌红、音标行前置 20px 品牌红圆形喇叭、义项用 20px 序号圆标 + 16px 释义、
 * 例句用同款 `ExampleText`（英文整句加粗、命中词标红）、**右上角收藏星标**（`FavoriteStar`：
 * 32×32 透明热区 + 空心 / 实心星，点按打开收藏夹选择弹窗，多选，全不选 = 取消收藏）。
 *
 * 多个词条放进同一个面板时，调用方在块之间插 `<Divider />`（词库详情页每词一块的观感）。
 */
export function DictEntryBlock({
  entry,
  source = 'translate',
}: {
  entry: DictEntry;
  /** 收藏来源标记（语音翻译里也归到 `translate`，它本身就是翻译能力的一部分） */
  source?: FavoriteSource;
}) {
  const theme = useTheme();

  const firstSense = entry.senses[0]?.text ?? '';
  /** 中文词条念中文，英文词条念英文 */
  const speakLang = CJK.test(entry.headword) ? 'zh-CN' : 'en-US';
  /** 音标位：英汉词典给音标、汉英词典给拼音，共用同一条发音行 */
  const pron = entry.phonetic || entry.pinyin;
  /** 面板内 14px 小字（补充信息）统一字号与行高，与单词本一致 */
  const metaLine = [
    entry.traditional ? trf('繁体 {word}', { word: entry.traditional }) : '',
    entry.lemma ? trf('原型 {word}', { word: entry.lemma }) : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const tags = [
    ...entry.tags.map((tag) => TAG_LABEL[tag]).filter(Boolean),
    FREQ_LABEL[entry.frequency] ?? '',
  ].filter(Boolean);

  return (
    <View style={{ gap: PANEL_GAP_BLOCK }}>
      {/* 头部：左侧单词 + 音标 + 补充信息，右上角为收藏按钮 */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1, gap: PANEL_GAP_INNER }}>
          <AppText kind="xl" color={theme.colors.brand}>
            {entry.headword}
          </AppText>
          {pron ? (
            <PronunciationRow word={entry.headword} text={pron} lang={speakLang} />
          ) : null}
          {metaLine ? (
            <AppText kind="tiny" color={theme.colors.textSecondary}>
              {metaLine}
            </AppText>
          ) : null}
        </View>
        <FavoriteStar word={entry.headword} definition={firstSense} source={source} />
      </View>

      {/* 义项：序号圆标 + 16px 释义（词性写进括号，与单词本同款） */}
      <SenseRows senses={entry.senses.map((s) => ({ pos: s.pos, primary: s.text }))} />

      {/* 例句：单词本同款——英文整句 18px 加粗，命中的词标品牌红 */}
      {entry.examples.map((example) => (
        <ExampleText
          key={example}
          text={example}
          term={entry.headword}
          highlight={theme.colors.accentRed}
        />
      ))}

      {/* 词表 / 词频标签 */}
      {tags.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {tags.map((tag) => (
            <AppText key={tag} kind="micro" color={theme.colors.textMuted}>
              {tag}
            </AppText>
          ))}
        </View>
      ) : null}
    </View>
  );
}
