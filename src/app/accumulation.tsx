import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, TextInput, View } from 'react-native';

import { SlideIn } from '@/components/SlideIn';
import { StageProgressBar, type ProgressStage } from '@/components/StageProgress';
import { BookmarkIcon, CheckIcon, ChevronIcon, CloseIcon, HintIcon } from '@/components/icons';
import {
  AppText,
  Badge,
  Card,
  Divider,
  EmptyState,
  FOOTER_BUTTON_HEIGHT,
  FooterBar,
  PrimaryButton,
  Screen,
} from '@/components/ui';
import { appConfig, exerciseTypeMap } from '@/config/appConfig';
import {
  ACCUMULATION_TYPE_ID,
  accumulationPool,
  accumulationQueueFromIds,
  bookForLevel,
  buildAccumulationQueue,
  toExerciseItem,
  type AccumulationItem,
} from '@/domain/accumulation';
import { formatDurationHuman } from '@/domain/date';
import { localGrade } from '@/domain/grading';
import { tr, trf } from '@/i18n';
import { useApp } from '@/store/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { inputFont } from '@/theme/fonts';
import { layout, stroke } from '@/theme/tokens';

/** count = 选积累数量；quiz = 逐题默写；result = 本次结果 */
type Step = 'count' | 'quiz' | 'result';

/** 块与块之间的垂直间距（与练习页同一口径） */
const BLOCK_GAP = 16;
/** 作答胶囊高度：与练习页听写的作答框同款（64，全圆角） */
const INPUT_HEIGHT = 64;
/** 底部固定条按钮几何：一行放下三枚，几何与单词页「上一词 / 收藏 / 下一词」同一套 */
const FOOTER_BTN = {
  flex: 1,
  minHeight: FOOTER_BUTTON_HEIGHT,
  height: FOOTER_BUTTON_HEIGHT,
  paddingHorizontal: 8,
};

/**
 * 「积累」测验（FR-E-14 的客观题口径 + 测验页签的统一评分）。
 *
 * 三步走：
 * 1. 选择积累数量——四枚整宽卡片（只有数字，样式与「选择题库」一致：先选、再按「确认」）；
 * 2. 逐词默写——题面是中文释义，作答走听写同款胶囊输入框，提交后**就地**判对错、只给正确拼写
 *    （不展示「你的作答」，也不做发音回放）；底栏 = 上一词 / 加入题集 / 下一词；
 * 3. 结果——每题等权、统一评分，给出本次得分、答对数与用时。
 *
 * 题池与统一评分见 `domain/accumulation`；测验作答与综合同一口径：
 * 只留记录（`Attempt.excluded`），不计入打卡卡片与学习统计。
 */
export default function AccumulationScreen() {
  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const { state, actions } = useApp();

  /**
   * 从题集点某道题进来（`/accumulation?set=accumulation&item=<id>`）：
   * 跳过数量选择，直接把该题集的收藏题目按「点中的那道排最前」开做 —— 与练习页题集同一口径。
   */
  const params = useLocalSearchParams<{ set?: string; item?: string }>();
  const fromSet = params.set === 'accumulation';

  /** 题集来路下的初始题单：点中的题在队首，其余按收藏时间倒序接上 */
  const initialSetQueue = (): AccumulationItem[] => {
    if (!fromSet) return [];
    const ids = state.savedItems.filter((x) => x.source === 'accumulation').map((x) => x.itemId);
    if (params.item) {
      const rest = ids.filter((id) => id !== params.item);
      return accumulationQueueFromIds([params.item, ...rest]);
    }
    return accumulationQueueFromIds(ids);
  };

  const [step, setStep] = useState<Step>(fromSet ? 'quiz' : 'count');
  /** 待确认的积累数量（null = 还没选，「确认」不可用；题集来路不经过这一步） */
  const [size, setSize] = useState<number | null>(null);
  /** 本次抽定的题单 */
  const [queue, setQueue] = useState<AccumulationItem[]>(initialSetQueue);
  const [index, setIndex] = useState(0);
  /**
   * 逐题的作答与对错（下标 = 题号）——「上一词」回头看已做过的题时要原样还原，
   * 所以不再只存「当前题」这一份。空位表示该题还没提交。
   */
  const [answers, setAnswers] = useState<string[]>([]);
  const [verdicts, setVerdicts] = useState<(boolean | null)[]>([]);
  /** 本次总用时（秒），提交完最后一题时结算 */
  const [totalSec, setTotalSec] = useState(0);

  /** 当前题的作答与对错（派生）：null = 还没提交，作答框可编辑 */
  const answer = answers[index] ?? '';
  const correct = verdicts[index] ?? null;

  /** 写入当前题的作答 / 对错，其它题原样保留 */
  const setAnswer = (text: string) =>
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = text;
      return next;
    });
  const setVerdict = (value: boolean) =>
    setVerdicts((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });

  const inputRef = useRef<TextInput>(null);
  const itemStartedAt = useRef(Date.now());
  const sessionStartedAt = useRef(Date.now());

  /** 题源：当前题库对应的词库（题库没有专属词库时退回第一本） */
  const book = useMemo(() => bookForLevel(state.levelId), [state.levelId]);
  const pool = useMemo(() => accumulationPool(book.id), [book.id]);
  const item: AccumulationItem | undefined = queue[index];
  const def = exerciseTypeMap[ACCUMULATION_TYPE_ID];
  /** 当前这道题是否已在「积累」题集里（收藏开关的现状） */
  const savedNow = item ? state.savedItems.some((x) => x.itemId === item.id) : false;

  /** 加入 / 移出「积累」题集（可逆开关，与作答页同一行为） */
  const toggleSaved = () => {
    if (!item) return;
    if (savedNow) actions.removeSavedItem(item.id);
    else actions.addSavedItem(item.id, 'accumulation');
  };

  /** 进入题目后自动聚焦作答框（每题都重新聚焦，连着写不用手点） */
  useEffect(() => {
    if (step !== 'quiz' || correct !== null) return;
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [step, index, correct]);

  /**
   * 按所选数量抽题开始（题池不足所选数量时按实际数量出）。
   * 数量选择保留在 `size` 上，所以「再测一次」可以直接重抽同数量的新一批题。
   */
  const startSession = () => {
    if (size === null) return;
    const next = buildAccumulationQueue(pool, size);
    setQueue(next);
    setAnswers(next.map(() => ''));
    setVerdicts(next.map(() => null));
    setIndex(0);
    setTotalSec(0);
    sessionStartedAt.current = Date.now();
    itemStartedAt.current = Date.now();
    setStep('quiz');
  };

  /** 回到数量选择（清掉本次题单，数量选择保留，方便直接再按「确认」） */
  const backToCount = () => {
    setQueue([]);
    setAnswers([]);
    setVerdicts([]);
    setIndex(0);
    setTotalSec(0);
    setStep('count');
  };

  /** 提交本题：统一评分（客观拼写题，答对满分、答错 0 分），并就地把对错与正确拼写展开 */
  const submit = () => {
    if (!item || correct !== null || answer.trim().length === 0) return;
    const seconds = Math.max(1, Math.round((Date.now() - itemStartedAt.current) / 1000));
    const exerciseItem = toExerciseItem(item, state.levelId);
    const graded = localGrade(exerciseItem, def, answer, seconds);
    const isCorrect = graded.total >= appConfig.quiz.accumulationPointPerItem;
    // 测验作答只留记录：与综合一致，不计入打卡卡片与学习统计（见 Attempt.excluded）
    const id = actions.startAttempt({
      typeId: ACCUMULATION_TYPE_ID,
      levelId: state.levelId,
      itemId: exerciseItem.id,
      board: def.board,
      promptTitle: exerciseItem.title,
      prompt: exerciseItem.prompt,
      answer,
      durationSec: seconds,
      excluded: true,
    });
    actions.finishAttempt(id, graded, graded.total);
    setVerdict(isCorrect);
  };

  /** 下一词；最后一词提交完则进结果（顺手结算总用时） */
  const goNext = () => {
    if (index + 1 < queue.length) {
      setIndex(index + 1);
      itemStartedAt.current = Date.now();
      return;
    }
    setTotalSec(Math.max(1, Math.round((Date.now() - sessionStartedAt.current) / 1000)));
    setStep('result');
  };

  /**
   * 上一词：翻回已经做过的那一题（作答与对错按题号原样还原，可直接对答案）。
   * 已经在第一题就什么也不做（按钮同时置灰）。
   */
  const goPrev = () => {
    if (index === 0) return;
    setIndex(index - 1);
  };

  /**
   * 逐级返回：题目 → 数量 → 退出本页；结果页返回直接退出本页。
   * 页头返回箭头、Android 返回键、iOS 侧滑都走这里。
   * 从题集进来时没有「数量」这一步，题目态返回即退出本页。
   */
  const goBackStage = () => {
    if (step === 'quiz' && !fromSet) {
      backToCount();
      return;
    }
    router.back();
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'count') return false;
      goBackStage();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    // 题集来路没有「数量」这一步，题目态就是首屏，允许侧滑返回
    navigation.setOptions({ gestureEnabled: step === 'count' || fromSet });
  }, [navigation, step, fromSet]);

  /** 结果页的统计：每题等权，得分 = 答对题数 ÷ 总题数 × 每题满分 */
  const correctCount = verdicts.filter((v) => v === true).length;
  const score =
    queue.length > 0
      ? Math.round((correctCount / queue.length) * appConfig.quiz.accumulationPointPerItem)
      : 0;

  /* ---------------- 两段进度条：左「积累数量」，右「题目」 ---------------- */
  const countStage: ProgressStage = {
    label: step === 'count' ? '积累数量' : trf('{n} 词', { n: queue.length }),
    ratio: step === 'count' ? 0 : 1,
    pending: step === 'count',
    accessibilityLabel:
      step === 'count' ? tr('积累数量') : trf('{n} 词，已确认', { n: queue.length }),
  };
  const answered = step === 'count' ? 0 : Math.min(index + 1, queue.length);
  const total = queue.length;
  const progressPct = total > 0 ? Math.round((answered / total) * 100) : 0;
  const questionStage: ProgressStage = {
    label: `${answered}/${total}`,
    leading: `${progressPct}%`,
    ratio: total > 0 ? answered / total : 0,
    pending: total === 0,
    accessibilityLabel: `${tr('题目')} ${answered}/${total}，${progressPct}%`,
  };

  /* ---------------- 一：选择积累数量（样式与「选择题库」一致） ---------------- */
  const countPanel = (
    <>
      <AppText kind="lg" color={theme.colors.text} numberOfLines={1}>
        选择积累数量
      </AppText>
      <View style={{ gap: 8 }}>
        {appConfig.quiz.accumulationSizes.map((n) => {
          const current = n === size;
          // 按钮里只留数字：单位（词）由标题与进度条交代，不再重复「题」
          const name = String(n);
          return (
            <Card
              key={n}
              onPress={() => setSize(n)}
              accessibilityLabel={
                current ? trf('{name}，已选中', { name: trf('{n} 词', { n }) }) : trf('{n} 词', { n })
              }
              style={{ padding: 16 }}
              strokeColor={current ? theme.colors.brand : theme.colors.border}
            >
              <AppText kind="md" color={current ? theme.colors.brand : theme.colors.text} numberOfLines={1}>
                {name}
              </AppText>
            </Card>
          );
        })}
      </View>
    </>
  );

  /* ---------------- 二：逐题默写（中文释义 → 英文词 / 短语） ---------------- */
  const quizPanel = !item ? (
    <EmptyState title="暂无可抽的词条" hint="换一个题库后再试" />
  ) : (
    <>
      {/* 题面：中文释义。与练习页题干同号（24px，lg 档），字号是整页最大的一行 */}
      <View style={{ gap: 8 }}>
        <AppText kind="lg" color={theme.colors.text}>
          {item.promptZh}
        </AppText>
        {/* 提示行 16px（sm 档）：词条给词性（如 v. / n.）、派生词与短语各给一个来源标签（不透露答案本身） */}
        {item.kind === 'word' ? (
          item.partOfSpeech ? (
            <AppText kind="sm" color={theme.colors.textMuted}>
              {item.partOfSpeech}
            </AppText>
          ) : null
        ) : (
          <AppText kind="sm" color={theme.colors.textMuted}>
            {item.kind === 'derivative' ? '派生词' : '常用短语'}
          </AppText>
        )}
      </View>

      {/* 作答：听写同款胶囊输入框（64 / 全圆角 / 16px），对错画在胶囊内部右侧 ——
          拼对 = 品牌红描边 + 红勾，拼错 = 正文色描边 + 黑叉（与客观题选项同一套） */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          height: theme.size(INPUT_HEIGHT),
          borderWidth: stroke.base,
          borderColor:
            correct === null ? theme.colors.border : correct ? theme.colors.brand : theme.colors.text,
          borderRadius: 999,
          // 输入框统一内边距 16（内层 TextInput 清零，左右留白由此处给）
          paddingHorizontal: layout.inputPad,
          backgroundColor: theme.colors.surface,
        }}
      >
        <TextInput
          ref={inputRef}
          value={answer}
          onChangeText={setAnswer}
          editable={correct === null}
          accessibilityLabel={tr('作答输入框')}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={submit}
          style={{
            flex: 1,
            height: theme.size(INPUT_HEIGHT),
            paddingHorizontal: 0,
            paddingVertical: 0,
            includeFontPadding: false,
            textAlignVertical: 'center',
            color: theme.colors.text,
            fontFamily: inputFont('regular'),
            fontSize: theme.size(16),
            // 内层输入框自己也铺 surface（外层胶囊已有底色）：显式写上，避免平台默认底透出来
            backgroundColor: theme.colors.surface,
          }}
        />
        {correct === null ? null : correct ? (
          <CheckIcon size={18} color={theme.colors.brand} />
        ) : (
          <CloseIcon size={18} color={theme.colors.text} />
        )}
      </View>

      {/* 提交后只给正确拼写：不展示「你的作答」，也不做发音回放 */}
      {correct !== null ? (
        <Card style={{ padding: 16, gap: 8 }}>
          <AppText kind="micro" color={theme.colors.textMuted}>
            正确拼写
          </AppText>
          <AppText kind="lg" color={theme.colors.brand}>
            {item.answer}
          </AppText>
        </Card>
      ) : null}
    </>
  );

  /* ---------------- 三：本次结果（统一评分：每题等权） ---------------- */
  const resultPanel = (
    <>
      <AppText kind="lg" color={theme.colors.text} numberOfLines={1}>
        本次得分
      </AppText>
      <Card style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <AppText kind="micro" color={theme.colors.textMuted}>
              {trf('满分 {n}', { n: appConfig.quiz.accumulationPointPerItem })}
            </AppText>
            <AppText kind="xxxl" color={theme.colors.brand}>
              {String(score)}
            </AppText>
          </View>
          <Badge text={trf('用时 {v}', { v: formatDurationHuman(totalSec) })} />
        </View>
        <Divider />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppText kind="micro" color={theme.colors.textMuted}>
            答对词数
          </AppText>
          <AppText kind="sm" color={theme.colors.text}>
            {trf('{n} / {m} 词', { n: correctCount, m: queue.length })}
          </AppText>
        </View>
      </Card>
    </>
  );

  return (
    <Screen
      header={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
          <Pressable onPress={goBackStage} accessibilityRole="button" accessibilityLabel={tr('返回')} hitSlop={8}>
            <View style={{ transform: [{ rotate: '180deg' }] }}>
              <HintIcon size={16} color={theme.colors.text} />
            </View>
          </Pressable>
          <AppText kind="lg" color={theme.colors.text} numberOfLines={1} style={{ flexShrink: 1 }}>
            积累
          </AppText>
        </View>
      }
      contentStyle={{ gap: BLOCK_GAP }}
      footer={
        step === 'count' ? (
          <FooterBar>
            <PrimaryButton
              style={FOOTER_BTN}
              label="确认"
              disabled={size === null || pool.length === 0}
              onPress={startSession}
            />
          </FooterBar>
        ) : step === 'quiz' ? (
          correct === null ? (
            <FooterBar>
              <PrimaryButton
                style={FOOTER_BTN}
                label="确认"
                disabled={answer.trim().length === 0}
                onPress={submit}
              />
            </FooterBar>
          ) : (
            /* 提交后（几何与单词页「上一词 / 收藏 / 下一词」同一套）：
               左「上一词」箭头（第一题时置灰）→ 中「加入 / 移出题集」标记按钮（书签图标，可逆开关，默认不加入）
               → 右「下一词」箭头（最后一词退回结果页，无障碍名改叫「完成」）。 */
            <FooterBar>
              <PrimaryButton
                tone="ghost"
                panel
                style={FOOTER_BTN}
                disabled={index === 0}
                onPress={goPrev}
                accessibilityLabel={tr('上一词')}
                icon={<ChevronIcon size={26} direction="left" color={theme.colors.text} />}
              />
              {/* 「加入题集」走单词页「收藏」按钮同一套样式（panel 胶囊 + 居中图标），
                  只把内部的星星换成标记（书签）图标；已加入时同「收藏」激活态：黄底 + 实心图标 */}
              <PrimaryButton
                tone="ghost"
                panel
                style={[FOOTER_BTN, savedNow ? { backgroundColor: theme.colors.accentYellow } : null]}
                accessibilityLabel={savedNow ? '移出题集' : '加入题集'}
                icon={
                  <BookmarkIcon
                    size={26}
                    filled={savedNow}
                    color={savedNow ? theme.colors.brandOn : theme.colors.text}
                  />
                }
                onPress={toggleSaved}
              />
              <PrimaryButton
                style={FOOTER_BTN}
                onPress={goNext}
                accessibilityLabel={index + 1 < queue.length ? tr('下一词') : tr('完成')}
                icon={<ChevronIcon size={26} direction="right" color={theme.colors.brandOn} />}
              />
            </FooterBar>
          )
        ) : (
          /* 结果页：常规来路给「再测一次」（同数量重抽一批）；题集来路没有数量可复用，只留「完成」 */
          <FooterBar>
            {size === null ? null : (
              <PrimaryButton
                tone="ghost"
                panel
                labelKind="sm"
                style={FOOTER_BTN}
                label="再测一次"
                onPress={startSession}
              />
            )}
            <PrimaryButton labelKind="sm" style={FOOTER_BTN} label="完成" onPress={() => router.back()} />
          </FooterBar>
        )
      }
    >
      <StageProgressBar left={[countStage]} right={questionStage} />
      {/* 板块推进：新板块从右侧滑入；换题同样重播一次（提交后的就地判分不重播） */}
      <SlideIn key={`${step}-${index}`} gap={BLOCK_GAP}>
        {step === 'count' ? countPanel : step === 'quiz' ? quizPanel : resultPanel}
      </SlideIn>
    </Screen>
  );
}
