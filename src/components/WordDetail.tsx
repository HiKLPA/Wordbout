import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { FavoriteStar } from '@/components/FavoriteStar';
import { SpeakButton, SPEAK_BUTTON_SIZE } from '@/components/SpeakButton';
import { CheckIcon, ChevronIcon, StarIcon } from '@/components/icons';
import { AppText, Card, FOOTER_BUTTON_HEIGHT, FooterBar, PrimaryButton } from '@/components/ui';
import type { FavoriteSource, WordEntry, WordPhonetic } from '@/domain/types';
import { tr, trf } from '@/i18n';
import { useAccent, useTheme, type TextKind } from '@/theme/ThemeProvider';
import { LatinFont, type FontWeightKey } from '@/theme/fonts';
import { stroke, typography } from '@/theme/tokens';

/** 例句默认展示条数；词库中不足此数时按实际数量展示 */
const EXAMPLE_LIMIT = 3;
/** 常用短语默认展示个数；词库中不足此数时按实际数量展示 */
const PHRASE_LIMIT = 3;
/**
 * 释义序号圆标：直径与朗读圆钮（`SPEAK_BUTTON_SIZE` = 20）一致。
 * 圆内填 `surfaceInvert`（与面板**相反**的那一档底色）、外圈 0.5px `border` 描边，
 * 数字走 `micro` 档（12px）、色 `surfaceInvertOn`（反向底上的字）。
 */
const SENSE_BADGE_SIZE = SPEAK_BUTTON_SIZE;
/** 圆标与首行英文释义（sm 档 16/22 行盒）垂直居中所需的偏移 */
const SENSE_BADGE_OFFSET = (typography.lineHeights.sm - SENSE_BADGE_SIZE) / 2;
/** 行首圆圈（释义序号圆标 / 音标喇叭）与其后文字的横向间距，面板内统一这一个值 */
const SENSE_ROW_GAP = 8;
/** 中文释义的左缩进 = 圆标宽 + 横向间距，使中英释义左对齐 */
const SENSE_TEXT_INDENT = SENSE_BADGE_SIZE + SENSE_ROW_GAP;
/** 单词卡片内部行距：同一部分内部（紧密配对的两行，如 单词↔音标、英式↔美式、英↔中） */
const PANEL_GAP_INNER = 4;
/** 面板内部行距：不同部分之间（头部 / 释义，以及同一面板内各条之间） */
const PANEL_GAP_BLOCK = 8;
/** 详解各面板之间的间距（词库详情页与收藏夹详解视图共用） */
export const WORD_DETAIL_GAP = 16;

/** 词条里含汉字时按字面子串匹配（中文没有词边界，`\b` 不成立） */
const CJK_CHAR = /[\u4e00-\u9fff]/;

/**
 * 收藏时记下的那条释义：`(词性) 中文释义` —— 与课本详情页底栏收藏、收藏夹里已有记录的写法一致，
 * 这样同一个词无论从哪个入口收藏，列表里显示的注释都相同。
 */
function favoriteDefinition(word: WordEntry): string {
  const sense = word.senses[0];
  return sense ? `(${sense.partOfSpeech}) ${sense.definitionZh}` : '';
}

/** 转义正则里的元字符 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 单个词的匹配片段：英文走词干 + 词边界，中文走字面子串 */
function termPattern(term: string): string {
  if (CJK_CHAR.test(term)) return escapeRegExp(term);
  /** 词干候选：原词 + 常见变形词干；长子串在前，避免被短候选提前截断 */
  const stems = new Set<string>([term]);
  if (/y$/i.test(term)) stems.add(`${term.slice(0, -1)}i`);
  if (/e$/i.test(term)) stems.add(term.slice(0, -1));
  const alt = [...stems].map(escapeRegExp).sort((a, b) => b.length - a.length).join('|');
  return `\\b(?:${alt})\\w*`;
}

/**
 * 把例句/短语按当前词切成若干段，命中项标记为 hit。
 * 可传多个词（语音翻译的识别句要按关键词一起标红）。
 * 英文匹配大小写不敏感，并覆盖常见词形变化：
 * 直接加后缀（abandon → abandoned）、y→i（identify → identified）、去 e（tolerate → tolerating）；
 * 中文按字面子串匹配。
 */
function splitByTerm(text: string, term: string | string[]): { text: string; hit: boolean }[] {
  const terms = (Array.isArray(term) ? term : [term]).map((t) => t.trim()).filter(Boolean);
  if (terms.length === 0) return [{ text, hit: false }];
  /** 长候选在前，避免被短候选提前截断 */
  const re = new RegExp(
    terms
      .map(termPattern)
      .sort((a, b) => b.length - a.length)
      .join('|'),
    'gi',
  );
  const parts: { text: string; hit: boolean }[] = [];
  let last = 0;
  let match = re.exec(text);
  while (match) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index), hit: false });
    parts.push({ text: match[0], hit: true });
    last = match.index + match[0].length;
    match = re.exec(text);
  }
  if (parts.length === 0) return [{ text, hit: false }];
  if (last < text.length) parts.push({ text: text.slice(last), hit: false });
  return parts;
}

/**
 * 「常用短语 / 例句」面板标题行右端的展开 / 收起开关：强调色上下箭头，
 * 取代原来的「显示全部 n 个 / n 句」文字按钮。
 * 未展开朝下（点一下露出更多）、已展开朝上（点一下收起）；数量信息保留在无障碍名里。
 * 义项面板不用它 —— 释义默认全部展示（2026-10-17）。
 */
function ExpandToggle({
  expanded,
  accessibilityLabel,
  onPress,
}: {
  expanded: boolean;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const { accent } = useAccent();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={10}
      style={{ padding: 2 }}
    >
      <ChevronIcon
        size={24}
        direction={expanded ? 'up' : 'down'}
        color={accent}
      />
    </Pressable>
  );
}

/** 音标行：英式 / 美式各一行，各自按对应口音朗读（en-GB / en-US） */
function accentRows(phonetics: WordPhonetic) {
  return [
    { key: 'uk', label: '英', a11y: '朗读英式音标', phonetic: phonetics.uk, lang: 'en-GB' },
    { key: 'us', label: '美', a11y: '朗读美式音标', phonetic: phonetics.us, lang: 'en-US' },
  ];
}

/**
 * 句子里的命中词标红渲染（默认整句加粗：`md` = 18px / 行高 24 / Barlow 600）。
 * 命中部分只用品牌红标出（不加下划线——用户明确不要），`kind` 可换档（语音翻译的识别句用 `body`）。
 * `weight` 可把**基准字重**压回 regular —— AI 回答里正文不加粗、只有命中词保持加粗描红；
 * `align` 供正文左右对齐。
 * 词库详情页 / 收藏夹详解 / 翻译页的词典例句，以及语音翻译识别句的关键词标红，共用这一套（已导出）。
 */
export function ExampleText({
  text,
  term,
  highlight,
  kind = 'md',
  weight,
  align,
}: {
  text: string;
  /** 要高亮的词：单个词，或一组词（语音翻译的识别句传关键词列表） */
  term: string | string[];
  highlight: string;
  /** 文字档位；默认与词库详情页的例句一致（`md`） */
  kind?: TextKind;
  /** 基准字重；不传则用该档默认（`md` 即 600）。AI 回答传 `regular`，只让命中词加粗 */
  weight?: FontWeightKey;
  /** 文字对齐；AI 回答正文传 `justify` 走左右对齐 */
  align?: 'left' | 'center' | 'right' | 'justify';
}) {
  return (
    <AppText kind={kind} weight={weight} align={align}>
      {splitByTerm(text, term).map((part, i) =>
        part.hit ? (
          <Text key={i} style={{ color: highlight, fontFamily: LatinFont.bold }}>
            {part.text}
          </Text>
        ) : (
          part.text
        ),
      )}
    </AppText>
  );
}

/**
 * 单词详解面板组（FR-T-2 / FR-T-3）：单词 + 音标 + 义项 → 派生词 → 常用短语 → 例句。
 * 第一个面板（单词 + 音标 + 义项）用页面强调色描边（默认品牌红；词库详情页整页换品牌黄）；
 * 派生词 / 短语 / 例句为空时整块不渲染。
 * 词库详情页 / 收藏夹详解 / 探索页三种入口共用这一套，观感一致。
 *
 * **面板右上角默认有收藏按钮**（`FavoriteStar`：32×32 透明热区 + 空心 / 实心星，点按开收藏夹选择弹窗），
 * 它是这一行唯一的内容 —— 义项**默认全部展示**，不再挂展开 / 收起箭头（2026-10-17）。
 * 来源标记由 `favoriteSource` 给（课本 / 收藏夹默认 `wordbook`，探索页传 `explore`）。
 * 底栏已经有专属收藏按钮的页面（课本详情 / 收藏夹详解，底栏是 `WordNavFooter`）传 `hideFavorite`
 * 隐去它 —— 同一屏里两枚收藏按钮重复且指向同一动作。
 *
 * `basicOnly` 只渲染第一个面板；配合 `hideWord` 可隐去面板里的单词（保留音标与义项）。
 *
 * 查不到完整词条时（收藏夹里来自翻译 / 探索 / 练习错词的单词不在词库中）退回
 * 「单词 + 收藏时记下的那条释义」，同样带收藏按钮，至少保证有东西可看、可改归属。
 *
 * 展开状态（仅下方「常用短语 / 例句」两面板）是组件内部状态：切换单词时由调用方传 `key` 重挂载，不需要手动重置。
 */
export function WordDetail({
  word,
  fallback,
  basicOnly,
  hideWord,
  hideFavorite,
  strokeColor,
  favoriteSource = 'wordbook',
}: {
  /** 完整词条；查不到时省略，改传 fallback */
  word?: WordEntry;
  /** 词条缺失时的兜底内容（单词 + 一句释义） */
  fallback?: { word: string; definition: string };
  /** 只渲染「基础释义」面板（单词 + 音标 + 义项），不渲染派生词 / 短语 / 例句 */
  basicOnly?: boolean;
  /** 隐去基础释义面板里的单词本身（调用方已在别处展示该词时用，如探索页的起点词输入框） */
  hideWord?: boolean;
  /** 隐去面板右上角的收藏按钮（底栏已有专属收藏按钮的页面用，见上） */
  hideFavorite?: boolean;
  /** 基础释义面板的描边色。默认品牌红（词库详情 / 收藏夹详解）；探索页要普通灰描边，传 colors.border */
  strokeColor?: string;
  /** 面板右上角收藏按钮的来源标记（课本详情 / 收藏夹详解传 `wordbook`，探索页传 `explore`） */
  favoriteSource?: FavoriteSource;
}) {
  const theme = useTheme();
  /** 页面强调色（默认品牌红；词库详情页整页换品牌黄）与正文高亮色（例句 / 短语里的命中词） */
  const { accent, highlight } = useAccent();
  /** 常用短语是否展开显示全部（默认只展示前 PHRASE_LIMIT 个） */
  const [phrasesExpanded, setPhrasesExpanded] = useState(false);
  /** 例句是否展开显示全部（默认只展示前 EXAMPLE_LIMIT 句） */
  const [examplesExpanded, setExamplesExpanded] = useState(false);

  /** 面板内 14px 小字（中文释义 / 短语释义 / 区块标题）统一字号与行高 */

  if (!word) {
    return (
      <Card style={{ padding: 16, gap: PANEL_GAP_BLOCK }} strokeColor={accent}>
        {/* 头部：左侧单词，右上角收藏按钮（与完整词条那版同款，只是没有音标与义项；hideFavorite 时隐去） */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <AppText kind="xl" color={accent} style={{ flex: 1 }}>
            {fallback?.word ?? ''}
          </AppText>
          {fallback?.word && !hideFavorite ? (
            <FavoriteStar
              word={fallback.word}
              definition={fallback.definition ?? ''}
              source={favoriteSource}
            />
          ) : null}
        </View>
        {fallback?.definition ? (
          <AppText kind="body" color={theme.colors.text}>
            {fallback.definition}
          </AppText>
        ) : null}
      </Card>
    );
  }

  /**
   * 第一个面板（单词 + 音标 + 义项）默认用品牌红描边，与下方派生词 / 短语 / 例句的常规描边（colors.border）区分；
   * 调用方传 `strokeColor` 时（探索页）改用它。
   * 探索页的「基础释义」只要这一块，所以先抽成变量，再按 basicOnly 决定是否继续渲染后面的面板。
   */
  const basicPanel = (
    <Card
      style={{ padding: 16, gap: PANEL_GAP_BLOCK }}
      strokeColor={strokeColor ?? accent}
    >
      {/* 头部：左侧单词 + 音标，右上角为收藏按钮（义项默认全展示，不再有展开 / 收起箭头） */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1, gap: PANEL_GAP_INNER }}>
          {/* 单词：页面强调色，32px（xl 档，ExtraBold）；hideWord 时隐去（调用方已在别处展示该词） */}
          {hideWord ? null : (
            <AppText kind="xl" color={accent}>
              {word.word}
            </AppText>
          )}
          {/* 音标：英式 / 美式各一行；标志在喇叭按钮之后 */}
          {accentRows(word.phonetics).map((p) => (
            <View
              key={p.key}
              style={{ flexDirection: 'row', alignItems: 'center', gap: SENSE_ROW_GAP }}
            >
              <SpeakButton text={word.word} lang={p.lang} accessibilityLabel={p.a11y} />
              <AppText kind="tiny" color={theme.colors.textSecondary}>
                {p.label}
              </AppText>
              <AppText kind="tiny" color={theme.colors.textSecondary}>
                {p.phonetic}
              </AppText>
            </View>
          ))}
        </View>
        {/* 收藏按钮恒在最右（`hideFavorite` 时隐去）；释义默认全展示，头部不再挂展开箭头 */}
        {hideFavorite ? null : (
          <FavoriteStar
            word={word.word}
            definition={favoriteDefinition(word)}
            source={favoriteSource}
          />
        )}
      </View>
      {/* 释义：紧接音标下方，**全部义项按字典顺序铺开**（2026-10-17 起不再只露前 3 条、也不再有展开箭头）；
          各义项属于**同一部分**，纵向用部分内间隔 PANEL_GAP_INNER(4) */}
      <View style={{ gap: PANEL_GAP_INNER }}>
        {word.senses.map((sense, i) => (
          <View key={`${word.id}-sense-${i}`} style={{ gap: PANEL_GAP_INNER }}>
            {/* 英文释义在前（词性用英文括号单独括起、字重比释义轻一档，置于释义之前）：16px（sm 档，SemiBold） */}
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
                  {String(i + 1)}
                </AppText>
              </View>
              {/* 词性 + 英文释义：词性同字号但**字重低一档**（regular 500，释义是 bold 600），
                  两截各占一枚 AppText 并排（AppText 的 children 会走脚本分流，不能嵌套） */}
              <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
                {sense.partOfSpeech ? (
                  <AppText kind="sm" weight="regular" color={theme.colors.text}>
                    {`(${sense.partOfSpeech})`}
                  </AppText>
                ) : null}
                <AppText kind="sm" color={theme.colors.text} style={{ flex: 1 }}>
                  {sense.definition}
                </AppText>
              </View>
            </View>
            {/* 中文释义在后：tiny 档 14px，缩进至与英文释义左对齐 */}
            <AppText
              kind="tiny"
              color={theme.colors.textSecondary}
              style={{ marginLeft: SENSE_TEXT_INDENT }}
            >
              {sense.definitionZh}
            </AppText>
          </View>
        ))}
      </View>
    </Card>
  );

  if (basicOnly) return basicPanel;

  return (
    <>
      {basicPanel}

      {/* 派生词：同一词族的其它词形（accurate → accuracy / inaccurate / accurately）；没有派生词时不渲染该面板 */}
      {word.derivatives.length > 0 ? (
        <Card style={{ padding: 16, gap: PANEL_GAP_BLOCK }}>
          <AppText kind="tiny" color={theme.colors.textMuted}>
            派生词
          </AppText>
          {word.derivatives.map((d, i) => (
            <View key={`${word.id}-dv-${i}`} style={{ gap: PANEL_GAP_INNER }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6 }}>
                <AppText kind="md" color={accent}>
                  {d.word}
                </AppText>
                <AppText kind="sm" color={theme.colors.text}>
                  {`(${d.partOfSpeech}) ${d.definition}`}
                </AppText>
              </View>
              <AppText kind="tiny" color={theme.colors.textSecondary}>
                {d.definitionZh}
              </AppText>
            </View>
          ))}
        </Card>
      ) : null}

      {/* 常用短语及释义：默认展示前 PHRASE_LIMIT 个 */}
      {word.phrases.length > 0 ? (
        <Card style={{ padding: 16, gap: PANEL_GAP_BLOCK }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <AppText kind="tiny" color={theme.colors.textMuted}>
              常用短语
            </AppText>
            {word.phrases.length > PHRASE_LIMIT ? (
              <ExpandToggle
                expanded={phrasesExpanded}
                accessibilityLabel={
                  phrasesExpanded ? tr('收起') : trf('显示全部 {n} 个', { n: word.phrases.length })
                }
                onPress={() => setPhrasesExpanded((v) => !v)}
              />
            ) : null}
          </View>
          {(phrasesExpanded ? word.phrases : word.phrases.slice(0, PHRASE_LIMIT)).map((ph, i) => (
            <View key={`${word.id}-ph-${i}`} style={{ gap: PANEL_GAP_INNER }}>
              <ExampleText text={ph.en} term={word.word} highlight={highlight} />
              <AppText kind="tiny" color={theme.colors.textSecondary}>
                {ph.zh}
              </AppText>
            </View>
          ))}
        </Card>
      ) : null}

      {/* 例句：独立面板，排在常用短语之后；默认展示前 EXAMPLE_LIMIT 句 */}
      {word.examples.length > 0 ? (
        <Card style={{ padding: 16, gap: PANEL_GAP_BLOCK }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <AppText kind="tiny" color={theme.colors.textMuted}>
              例句
            </AppText>
            {word.examples.length > EXAMPLE_LIMIT ? (
              <ExpandToggle
                expanded={examplesExpanded}
                accessibilityLabel={
                  examplesExpanded ? tr('收起') : trf('显示全部 {n} 句', { n: word.examples.length })
                }
                onPress={() => setExamplesExpanded((v) => !v)}
              />
            ) : null}
          </View>
          {(examplesExpanded ? word.examples : word.examples.slice(0, EXAMPLE_LIMIT)).map((ex, i) => (
            <View key={`${word.id}-ex-${i}`} style={{ gap: PANEL_GAP_INNER }}>
              <ExampleText text={ex.en} term={word.word} highlight={highlight} />
              {/* 例句中文翻译：14px */}
              <AppText kind="tiny" color={theme.colors.textSecondary}>
                {ex.zh}
              </AppText>
            </View>
          ))}
        </Card>
      ) : null}
    </>
  );
}

/**
 * 底部悬浮操作条：上一词 / 收藏 / 下一词（FR-T-2）。
 * 容器几何见 ui 的 `FooterBar`；「下一词」是**页面强调色实底**按钮（默认品牌红，词库详情页换品牌黄时
 * 箭头自动转深色）；收藏按钮已收藏时同样取**页面强调色实底 + 配套前景色**的实心星
 * （2026-10-17 由固定「黄底 + 反白星」改，描边仍保持默认灰），
 * 点按由调用方决定（弹收藏夹选择）。
 *
 * 翻到**最后一个词**时（`finished`），最右那颗按钮换成**勾勾的「完成」**：
 * 不再置灰、点它交回调用方（一般是退回上一级页面），学习 / 练习到此收尾。
 */
export function WordNavFooter({
  saved,
  prevDisabled,
  nextDisabled,
  prevLabel,
  nextLabel,
  finished = false,
  onPrev,
  onNext,
  onFinish,
  onStar,
}: {
  /** 当前单词是否已收藏 */
  saved: boolean;
  prevDisabled: boolean;
  nextDisabled: boolean;
  /** 无障碍名（上一词 / 下一词在两个页面含义不同，由调用方给） */
  prevLabel: string;
  nextLabel: string;
  /** 已经是最后一个词：最右按钮变「完成」（勾勾），无视 `nextDisabled` */
  finished?: boolean;
  onPrev: () => void;
  onNext: () => void;
  /** 「完成」的动作，一般是退回上一级页面；不传则退化成 `onNext` */
  onFinish?: () => void;
  onStar: () => void;
}) {
  const theme = useTheme();
  /** 已收藏 / 「下一词」都取页面强调色实底，其上的前景色用与之配套的那一档（黄底 → 深色，红/蓝底 → 反白） */
  const { accent, onAccent } = useAccent();
  const btn = { flex: 1, minHeight: FOOTER_BUTTON_HEIGHT, height: FOOTER_BUTTON_HEIGHT };

  return (
    <FooterBar>
      <PrimaryButton
        tone="ghost"
        panel
        style={btn}
        disabled={prevDisabled}
        onPress={onPrev}
        accessibilityLabel={prevLabel}
        icon={<ChevronIcon size={26} direction="left" color={theme.colors.text} />}
      />
      {/* 收藏按钮的激活态：描边恒为默认灰（不变色），靠**页面强调色实底 + 配套前景色实心星**表达已收藏 */}
      <PrimaryButton
        tone="ghost"
        panel
        // 已收藏的强调色底直接覆盖 `style` 的 backgroundColor（不透明实心底，不再有罩色 / 模糊层）
        style={[btn, saved ? { backgroundColor: accent } : null]}
        onPress={onStar}
        accessibilityLabel={saved ? tr('已收藏') : tr('收藏')}
        icon={
          <StarIcon
            size={26}
            filled={saved}
            color={saved ? onAccent : theme.colors.text}
          />
        }
      />
      <PrimaryButton
        style={btn}
        disabled={finished ? false : nextDisabled}
        onPress={finished ? (onFinish ?? onNext) : onNext}
        accessibilityLabel={finished ? tr('完成') : nextLabel}
        icon={
          finished ? (
            <CheckIcon size={26} color={onAccent} />
          ) : (
            <ChevronIcon size={26} direction="right" color={onAccent} />
          )
        }
      />
    </FooterBar>
  );
}
