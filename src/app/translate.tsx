import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputContentSizeChangeEventData,
} from 'react-native';
import * as Speech from 'expo-speech';

import { appConfig } from '@/config/appConfig';
import { DictEntryBlock } from '@/components/DictEntryBlock';
import { speakButtonOffset, SpeakButton } from '@/components/SpeakButton';
import {
  AppText,
  Card,
  Divider,
  FOOTER_BUTTON_HEIGHT,
  FooterBar,
  OptionChips,
  PageHeader,
  PrimaryButton,
  Screen,
} from '@/components/ui';
import {
  collectNotes,
  dictionariesFor,
  dictionaryById,
  defaultDictionaryFor,
  ecdictSuggest,
  type DictErrorCode,
  type DictId,
} from '@/data/dictionaries';
import { detectLang, translate, type Lang, type TranslationResult } from '@/data/translate';
import { tr, trf } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { inputFont } from '@/theme/fonts';
import { layout, stroke } from '@/theme/tokens';

/** 底部固定条按钮几何：与「积累」「练习」的底栏同一套 */
const FOOTER_BTN = {
  flex: 1,
  minHeight: FOOTER_BUTTON_HEIGHT,
  height: FOOTER_BUTTON_HEIGHT,
  paddingHorizontal: 8,
};

/** 同一个释义面板里各词条之间的间距（词条之间另加一条分隔线） */
const ENTRY_GAP = 12;

/** 联想候选行的高度（每行一颗词 + 它的中文释义） */
const SUGGEST_ROW_HEIGHT = 32;

/** 相邻候选行之间的间隔（用空档分隔，不再画分隔线） */
const SUGGEST_ROW_GAP = 8;

/** 输入框左右内边距（取全 App 统一的 `layout.inputPad`；与样式里的 `paddingHorizontal` 同值） */
const INPUT_PAD = layout.inputPad;

/** 输入框最多长到几行 —— 再多就不再增高，改为框内上下滚动 */
const INPUT_MAX_LINES = 5;

const DICT_ERROR_TEXT: Record<DictErrorCode, string> = {
  network: '词库查询失败，请检查网络后重试',
  timeout: '词库查询超时，请检查网络后重试',
  'bad-response': '词库返回的内容无法解析，请重试',
};

/**
 * 中英翻译（FR-M-1）。
 *
 * - 源语言选择器在页面顶部（各档位平分主内容区宽度），标签靠 a11y 承载；
 * - 输入框直接落在页面上，样式与卡片面板同款（同圆角 / 同底色 / 同描边）；
 *   高度按内容自动增高：**一行起步、`INPUT_MAX_LINES`（5）行封顶**，超出的部分框内上下滚动；
 * - **词典切换在释义里**（跟着词条面板走，就近可换）：英 → 中方向有「简明英汉词典（ECDICT 内置）」
 *   与「Wiktionary（在线）」，中 → 英方向有「CC-CEDICT」与「简明汉英」；换的是整段查询用的词典，
 *   只重查词条注释、不重发整句翻译（避免重复计费）；
 * - 输入框下方是**前缀联想**：已输入字母 → 以它开头的英文词（内置英汉词表，离线、同步、
 *   按常用度排序），**一行一颗词 + 它的中文释义**，点一行即填进输入框并立刻翻译（FR-M-1 的输入加速）；
 *   候选栏**只在输入框被选中时出现**，发起翻译会收起键盘、它随之隐去；
 * - 整句译文优先走大模型，失败或未配置密钥时退化为词库逐词对照，未命中的句子会注明；
 * - 「翻译」固定在底栏，失败时给出重试按钮，且不清空已输入内容。
 */
export default function TranslateScreen() {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [sourceLang, setSourceLang] = useState<Lang>('auto');
  const [dictChoice, setDictChoice] = useState<DictId | null>(null);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  /** 输入框是否处于选中（聚焦）状态 —— 候选栏只在这时露出来 */
  const [inputFocused, setInputFocused] = useState(false);
  /** 输入框里文本的实测高度 —— 框按它撑高，不靠固定 minHeight（量法见 `measureInput`） */
  const [inputContentH, setInputContentH] = useState(0);

  /** 输入框本体：web 端要手动量它的真实内容高（见 `measureInput`） */
  const inputRef = useRef<TextInput>(null);

  /**
   * 把实测到的文本高度回填给 `inputContentH`。**只在原生端使用**，web 端走 `measureInput`。
   *
   * 原生端的 `contentSize` 是文本的真实尺寸，增减都跟得上，直接用即可。而在这里固定引用是必须的：
   * `react-native-web` 的 `TextInput` 内部用 `useCallback(fn, [multiline, onContentSizeChange])` 生成
   * 尺寸处理函数，再交给 `useMemo` 造出 `<textarea>` 的 `ref`，最后经 `useMergeRefs` 合并 ——
   * 回调一换引用，合并出来的 ref 每轮 render 都是新的，React 每次 commit 都要对节点 detach / attach
   * 一遍，而挂上去时会**同步**回调一次。于是这次回写会落进 commit 期，与盒高互相追值时一路嵌套，
   * 直到 React 抛 `Maximum update depth exceeded`。另外叠 1px 容差吸收纯圆整噪声（真实的行数变化是
   * 24px 的整数倍，不会被它吞掉）。
   */
  const handleContentSizeChange = useCallback(
    (e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
      const h = e.nativeEvent.contentSize.height;
      setInputContentH((prev) => (Math.abs(prev - h) <= 1 ? prev : h));
    },
    [],
  );

  /**
   * web 端的量高：把输入框的高度样式**临时归零**再读 `scrollHeight`，读到的才是纯内容高。
   *
   * 不能直接采信 `onContentSizeChange` 那边给的 `scrollHeight` —— 内容不满一屏时它等于**客户端高度
   * 本身**，也就是说框一旦被撑高，此后逐行删字量到的永远是「当时那个盒高」，高度只会涨、不会缩
   * （要一路删到内容比盒子还高才会跳回一档）。高度归零后 `scrollHeight` 只由文本决定，长高变矮都
   * 跟得上；改动与还原都在同一个任务里完成，浏览器不会中途绘制，看不出跳动。
   */
  const measureInput = useCallback(() => {
    const el = inputRef.current as unknown as HTMLTextAreaElement | null;
    if (!el || typeof el.scrollHeight !== 'number') return;
    const prevHeight = el.style.height;
    el.style.height = '0px';
    const h = el.scrollHeight;
    el.style.height = prevHeight;
    setInputContentH((prev) => (Math.abs(prev - h) <= 1 ? prev : h));
  }, []);

  /**
   * 文本一落地就重量一次（web）。
   *
   * 挂在**布局副作用**上而不是 `onChangeText` 里，是因为输入框是受控的：事件回调执行时 React 还没把
   * 新文本写进 DOM，量到的仍是旧值；而 `setText` 除了用户敲键，还有「候选词回填」这类程序化路径，
   * 挂在 `[text]` 上一并覆盖。布局副作用在 DOM 更新之后、浏览器绘制之前执行，高度当帧就调好，
   * 不会晚一帧跳一下；里面回写 `inputContentH` 只多触发一次渲染，`text` 没变就不会再进这个副作用，
   * 不存在自激。
   */
  useLayoutEffect(() => {
    if (Platform.OS === 'web') measureInput();
  }, [text, measureInput]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      Speech.stop();
    },
    [],
  );

  /** 当前查询方向：源语言选「自动识别」时按输入内容实时判定 */
  const from = sourceLang === 'auto' ? detectLang(text) : sourceLang;
  /** 生效词典：手选的和当前方向不符时回落到该方向默认词典 */
  const available = dictionariesFor(from);
  const dict: DictId =
    dictChoice && dictionaryById(dictChoice)?.from === from ? dictChoice : defaultDictionaryFor(from);

  /**
   * 输入框高度 = 文本高度（**一行起步、`INPUT_MAX_LINES` 行封顶**）+ 上下内边距 + 描边。
   *
   * 内容由 `onContentSizeChange` 实测回填：一行以内永远是一行高（框不发胖），
   * 超出的部分才逐行长高；到 `INPUT_MAX_LINES` 行就不再长，剩下的交给输入框自己上下滚动。
   *
   * **默认（空框 / 一行）盒高 = `layout.pillHeight`（48），与主页翻译条完全一致**（2026-10-17）：
   * 18px 的字放在 48 的胶囊里，上下自然各留 (48 − 行高 24 − 描边 1) / 2 = 11.5，
   * 所以竖向内边距由「目标高度」反推，而不是直接套左右那档 16（16 上下会把单行框顶到 57，比首页高一头）。
   *
   * web 的 `contentSize` 是 `scrollHeight` 口径、**已含内边距**，原生不含 —— 各自补回差额，
   * 两个平台的最终盒高才是同一个数。
   */
  const inputLineH = theme.size(24);
  /** 竖向内边距 = 主页翻译条高与「一行字 + 描边」的差额对半分（字号可缩放，故不能写成常量） */
  const inputPadV = (layout.pillHeight - inputLineH - stroke.base * 2) / 2;
  const inputHeight =
    Math.min(
      Math.max(inputContentH - (Platform.OS === 'web' ? inputPadV * 2 : 0), inputLineH),
      inputLineH * INPUT_MAX_LINES,
    ) +
    inputPadV * 2 +
    stroke.base * 2;

  /** 只占一行（空态或一行文字）时为 true —— 这一档取**胶囊**圆角，与主页翻译条同形 */
  const inputIsPill = inputHeight <= inputLineH + inputPadV * 2 + stroke.base * 2;

  const run = async (override?: string) => {
    const source = (override ?? text).trim();
    if (!source || loading) return;
    // 发起翻译就收起键盘：输入框随之失焦，候选栏一并收起来（点候选进来时也一样）
    Keyboard.dismiss();
    setLoading(true);
    setError(null);
    try {
      setResult(await translate(source, sourceLang, dict));
    } catch {
      setError('翻译服务暂时不可用，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 前缀联想的输入前缀：**只认单个英文词**（`a…z` 开头，后面是字母 / 撇号 / 连字符），
   * 且达到配置的最少字母数 —— 中文、多词、空串一律不联想。
   */
  const suggestPrefix = useMemo(() => {
    const value = text.trim().toLowerCase();
    if (value.length < appConfig.translation.suggestMinChars) return '';
    return /^[a-z][a-z'-]*$/.test(value) ? value : '';
  }, [text]);

  /** 联想候选（内置英汉词表，同步、离线），按常用度排序；`suggestLimit` 配 0 即整体关闭 */
  const suggestions = useMemo(
    () =>
      suggestPrefix && appConfig.translation.suggestLimit > 0
        ? ecdictSuggest(suggestPrefix, appConfig.translation.suggestLimit)
        : [],
    [suggestPrefix],
  );

  /**
   * 点联想候选：填进输入框并**立刻翻译**。
   * `setText` 要等下一次渲染才生效，所以把词直接传给 `run`（否则会翻上一个词的旧文本）；
   * 收键盘 / 隐去候选栏由 `run` 统一负责。
   */
  const pickSuggestion = (word: string) => {
    setText(word);
    void run(word);
  };

  /** 换词典只重查词条注释（不重发整句翻译，避免重复计费） */
  const changeDict = async (next: DictId) => {
    setDictChoice(next);
    if (!result || !text.trim()) return;
    setNotesLoading(true);
    try {
      const { entries, error: dictError } = await collectNotes(from, text, next);
      setResult((prev) =>
        prev ? { ...prev, dictId: next, notes: entries, dictError: dictError?.code ?? null } : prev,
      );
    } finally {
      setNotesLoading(false);
    }
  };

  /**
   * 词典切换器（摆在**释义里**、词条面板之上）：换的是本次查询用的那本词典。
   * 两档平分整行宽；未选中档不铺底不描边、文字弱化一档（`textSecondary`），
   * 与设置页那几组「只靠颜色区分」的档位同一口径。
   * 重查期间，**转圈直接显示在刚切到的那一档胶囊里**（不再在下方单起一行「查询中…」），
   * 查完自动换回词典名。
   * 只有一本可选（`available.length <= 1`）时整块不渲染，不留空行。
   */
  const dictSwitch =
    available.length > 1 ? (
      <OptionChips
        stretch
        plainInactive
        inactiveColor={theme.colors.textSecondary}
        options={available.map((meta) => meta.id)}
        value={dict}
        onChange={changeDict}
        labelOf={(id) => dictionaryById(id)?.name ?? id}
        accessibilityLabel={tr('词典')}
        loadingValue={notesLoading ? dict : undefined}
      />
    ) : null;

  return (
    <Screen
      header={<PageHeader title="中英翻译" />}
      contentStyle={{ gap: 16 }}
      footer={
        <FooterBar>
          <PrimaryButton
            style={FOOTER_BTN}
            label={loading ? '翻译中…' : '翻译'}
            onPress={() => void run()}
            disabled={!text.trim() || loading}
          />
        </FooterBar>
      }
    >
      <OptionChips
        stretch
        plainInactive
        options={['auto', 'zh', 'en'] as const}
        value={sourceLang}
        onChange={setSourceLang}
        labelOf={(v) => (v === 'auto' ? '自动识别' : v === 'zh' ? '中文' : 'ENG')}
        accessibilityLabel={tr('源语言')}
      />

      <TextInput
        ref={inputRef}
        value={text}
        onChangeText={(next) => {
          setText(next);
          // 输入一变，上一次的译文与释义就跟当前文本对不上了 —— 立刻抹掉，
          // 下方只留按新输入重算出来的联想行（避免「旧释义 + 新输入」并存的错觉）
          setResult(null);
          setError(null);
          // 高度不在这里量：此时 DOM 里还是旧文本，交给下面那个看 `text` 的布局副作用统一处理
        }}
        // 候选栏只在输入框被选中（聚焦、正在编辑）时展示：翻译完收起键盘就不再挂着候选
        onFocus={() => setInputFocused(true)}
        onBlur={() => setInputFocused(false)}
        // 同理，选中输入框之后框里就不再留提示文字（全 App 统一口径），只留光标
        // 实测文本高度 → 驱动上面的 `inputHeight`（一行起步、5 行封顶）。
        // **原生端专属**：web 端那份 `scrollHeight` 量不出「变矮」，改由 `measureInput` 在输入事件里量
        onContentSizeChange={Platform.OS === 'web' ? undefined : handleContentSizeChange}
        multiline
        /* 框内不画竖向滚动条（web 靠 `+html.tsx` 的全局 textarea 样式；原生端本来就只有跟手的一闪，
           内容超到 5 行封顶后仍可滚动，只是不露常驻条） */
        placeholder={inputFocused ? undefined : tr('输入文本以翻译')}
        placeholderTextColor={theme.colors.textMuted}
        accessibilityLabel={tr('待翻译文本')}
        style={{
          // 高度跟着内容走（见 `inputHeight`）：默认一行（与主页翻译条同高 48），到 5 行封顶后框内滚动
          height: inputHeight,
          paddingHorizontal: INPUT_PAD,
          paddingVertical: inputPadV,
          borderWidth: stroke.base,
          borderColor: theme.colors.border,
          // 一行高（空态 / 一行文字）时是**胶囊**，与主页翻译条同形；长到第二行起回到卡片圆角
          borderRadius: inputIsPill ? 999 : layout.cardRadius,
          backgroundColor: theme.colors.surface,
          color: theme.colors.text,
          fontFamily: inputFont('regular'),
          // 与联想行同档字号（18 / 行高 24）：输入框里的字和它下方建议里的字一样大
          fontSize: theme.size(18),
          lineHeight: inputLineH,
          textAlignVertical: 'top',
        }}
      />

      {/* 前缀联想：**光标在输入框里时**才在它正下方逐行列出以已输入部分开头的英文词与它的中文释义，
          点一行就填进去并立刻翻译（发起翻译会收起键盘 → 候选栏随之收起，翻完不会再挂着候选）。
          只在「单个英文词」且够长时出现（见 `suggestPrefix`），走内置词表、同步、不联网；
          没有候选时整块不渲染，输入框下方不会留一块空档。
          不套面板、不做胶囊：一行一颗词（左侧 18px、已输入的那截标品牌红）+ 一条释义
          （右侧次级色、右对齐、单行省略），行与行之间留 8px 空档。 */}
      {inputFocused && suggestions.length ? (
        // 整块宽度对齐**底栏条带**：底栏左右各留 `layout.barSideMargin`，比页面内容区（`pagePadding`）
        // 再内缩一档 —— 这里按 (barSideMargin − pagePadding) 收边，于是候选栏与底栏同宽
        <View
          style={{
            marginHorizontal: layout.barSideMargin - layout.pagePadding,
            gap: SUGGEST_ROW_GAP,
          }}
        >
          {suggestions.map((item) => (
            <Pressable
              key={item.word}
              onPress={() => pickSuggestion(item.word)}
              accessibilityRole="button"
              accessibilityLabel={trf('翻译 {word}', { word: item.word })}
              style={{
                minHeight: SUGGEST_ROW_HEIGHT,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <View style={{ flexDirection: 'row' }}>
                {/* 与输入框里已敲的部分同色的那截标品牌红：一眼看出「这个词是我这几个字母拼出来的」 */}
                <AppText kind="md" color={theme.colors.brand}>
                  {item.word.slice(0, suggestPrefix.length)}
                </AppText>
                {/* 已输入的就是整颗词时（完整命中，候选首位）不再补一段空文字 */}
                {item.word.length > suggestPrefix.length ? (
                  <AppText kind="md" color={theme.colors.text}>
                    {item.word.slice(suggestPrefix.length)}
                  </AppText>
                ) : null}
              </View>
              <AppText
                kind="tiny"
                color={theme.colors.textSecondary}
                align="right"
                numberOfLines={1}
                style={{ flex: 1 }}
              >
                {item.translation}
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : null}

      {error ? (
        <Card style={{ padding: 16, gap: 10 }}>
          <AppText kind="md" color={theme.colors.brand}>
            {error}
          </AppText>
          <AppText kind="micro" color={theme.colors.textSecondary}>
            已输入的内容不会被清空，可以直接重试。
          </AppText>
          <PrimaryButton label="重试" onPress={() => void run()} />
        </Card>
      ) : null}

      {result ? (
        <>
          {/* 译文不套面板，直接落在页面上（每句一行）；只展示译文，不再展示原句与语言方向。
              发音钮放在句子**左侧**，与首行中线对齐 */}
          <View style={{ gap: 10 }}>
            {result.lines.map((line, i) => (
              <View
                key={`${line.source}-${i}`}
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}
              >
                {line.target ? (
                  <SpeakButton
                    text={line.target}
                    lang={result.targetLang === 'zh' ? 'zh-CN' : 'en-US'}
                    accessibilityLabel={result.targetLang === 'en' ? '朗读' : '原声'}
                    style={{ marginTop: theme.size(speakButtonOffset('body')) }}
                  />
                ) : null}
                <AppText kind="body" color={theme.colors.text} style={{ flex: 1 }}>
                  {line.target || (result.engine === 'dict' ? '该句未命中词库' : '')}
                </AppText>
              </View>
            ))}
          </View>
          {result.tooLong ? (
            <AppText kind="micro" color={theme.colors.textMuted}>
              {trf('文本已超过 {n} 字符，建议分段翻译', { n: 500 })}
            </AppText>
          ) : null}

          {/* 单词释义：词典切换器 + 全部词条放在同一个面板里，词条之间用分隔线切开。
              重查期间面板本身不动（旧词条照旧留着），「正在查」只体现在那枚词典胶囊里的转圈上 */}
          {result.notes.length ? (
            <Card style={{ padding: 16, gap: ENTRY_GAP }}>
              {dictSwitch}
              {result.notes.map((entry, index) => (
                <React.Fragment key={`${entry.dictId}-${entry.headword}-${entry.query}`}>
                  {index > 0 ? <Divider /> : null}
                  <DictEntryBlock entry={entry} />
                </React.Fragment>
              ))}
            </Card>
          ) : (
            <Card style={{ padding: 16, gap: 8 }}>
              {dictSwitch}
              {/* 重查期间先不下「未收录」的结论，等查完再出，免得这一行闪一下 */}
              {notesLoading ? null : (
                <>
                  <AppText kind="micro" color={theme.colors.textSecondary}>
                    该词典未收录本段中的词
                  </AppText>
                  {result.dictError ? (
                    <AppText kind="micro" color={theme.colors.brand}>
                      {DICT_ERROR_TEXT[result.dictError]}
                    </AppText>
                  ) : null}
                </>
              )}
            </Card>
          )}
        </>
      ) : null}
    </Screen>
  );
}
