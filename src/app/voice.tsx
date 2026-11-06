import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import * as Speech from 'expo-speech';

import { MicIcon } from '@/components/icons';
import { DictEntryBlock } from '@/components/DictEntryBlock';
import { speakButtonOffset, SpeakButton } from '@/components/SpeakButton';
import { ExampleText } from '@/components/WordDetail';
import {
  AppText,
  Card,
  Divider,
  FOOTER_BUTTON_HEIGHT,
  FooterBar,
  PageHeader,
  PrimaryButton,
  Screen,
} from '@/components/ui';
import { translate, voicePhrases, type TranslationResult } from '@/data/translate';
import { tr } from '@/i18n';
import { useApp } from '@/store/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { stroke } from '@/theme/tokens';

/** 同一个面板里各词条块之间的间距（块之间另加一条分隔线） */
const ENTRY_GAP = 12;

/** 录音时长显示为 mm:ss（录不满一小时，不做小时档） */
function clockText(totalSeconds: number): string {
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * 语音翻译（FR-M-4）。
 * 点一次麦克风开始录音，再点一次停止，随后开始识别与翻译。
 * 结果三段（前两段在面板外单独成行）：识别原文（关键词标红）→ 原句译文 → 关键词词条面板
 * （样式与翻译页释义面板同款）。
 * 译文走大模型整句翻译；拿不到大模型译文时**不展示**词库逐词对照拼出的
 * 「原词（释义），原词（释义）…」长串（用户明确不要，它与逐条词条重复）。
 * 无麦克风权限时给出引导跳转设置的提示。未同意隐私政策时不可用（FR-O-3）。
 * 空态（尚未录音 / 尚无结果）与「识别中 / 翻译中」共用一条**居中**提示（不套面板）；
 * 录音期间不占位，反馈由底栏红色按钮的 mm:ss 承担。
 */
export default function VoiceScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { state, actions } = useApp();
  const [holding, setHolding] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [status, setStatus] = useState<string>('');
  const [result, setResult] = useState<{ source: string; translation: TranslationResult } | null>(null);
  const [micDenied, setMicDenied] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const failTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 组件卸载后不要再写 state（大模型翻译可能还在路上） */
  const aliveRef = useRef(true);

  const gated = !state.settings.privacyAccepted;

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (tickRef.current) clearInterval(tickRef.current);
      if (failTimer.current) clearTimeout(failTimer.current);
      Speech.stop();
    };
  }, []);

  const startRecording = async () => {
    if (gated) return;
    let granted = false;
    try {
      const perm = await import('expo-audio').then((m) => m.requestRecordingPermissionsAsync());
      granted = perm.granted;
    } catch {
      // 初始开发阶段：未接入录音模块时按已授权处理，仅做交互演示
      granted = true;
    }
    if (!granted) {
      setMicDenied(true);
      return;
    }
    setMicDenied(false);
    setResult(null);
    /* 录音中的反馈由按钮本体承担（红底 + 时长），状态行留给识别阶段 */
    setStatus('');
    setHolding(true);
    setSeconds(0);
    tickRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  /** 识别 + 翻译：识别是本地模拟，译文走大模型整句翻译（异步，可能几秒到十几秒） */
  const runTranslation = async (spoken: string) => {
    setStatus('翻译中…');
    const translation = await translate(spoken, 'en');
    if (!aliveRef.current) return;
    setResult({ source: spoken, translation });
    setStatus('');
  };

  const stopRecording = () => {
    if (!holding) return;
    setHolding(false);
    if (tickRef.current) clearInterval(tickRef.current);
    const duration = Math.max(1, seconds);
    setStatus('识别中…');

    failTimer.current = setTimeout(() => {
      const picked = voicePhrases[duration % voicePhrases.length];
      void runTranslation(picked);
    }, 700);
  };

  return (
    <Screen
      header={<PageHeader title="语音翻译" />}
      contentStyle={{ flexGrow: 1, gap: 16 }}
      footer={
        gated ? undefined : (
          <FooterBar>
            {/* 点按录音：胶囊按钮固定在底栏、占满整行，常态即品牌红（主操作），
                录音中保持红底并把内容换成录音时长。
                按钮上只留「麦克风图标 / 录音时长」，操作说明走无障碍名 */}
            <Pressable
              onPress={() => (holding ? stopRecording() : startRecording())}
              accessibilityRole="button"
              accessibilityLabel={holding ? tr('录音中，点击停止') : tr('点击开始录音')}
              style={{
                flex: 1,
                height: FOOTER_BUTTON_HEIGHT,
                borderRadius: 999,
                borderWidth: stroke.base,
                borderColor: theme.colors.brand,
                backgroundColor: theme.colors.brand,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {holding ? (
                <AppText kind="md" color={theme.colors.brandOn}>
                  {clockText(seconds)}
                </AppText>
              ) : (
                <MicIcon size={22} color={theme.colors.brandOn} />
              )}
            </Pressable>
          </FooterBar>
        )
      }
    >
      {gated ? (
        <Card style={{ padding: 16, gap: 10 }}>
          <AppText kind="md" color={theme.colors.brand}>
            需先同意隐私政策
          </AppText>
          <AppText kind="micro" color={theme.colors.textSecondary}>
            语音翻译涉及麦克风权限。未确认隐私政策前不可使用。
          </AppText>
          <PrimaryButton label="去确认隐私政策" onPress={() => router.push('/privacy' as never)} />
          <PrimaryButton label="直接同意并启用" tone="ghost" onPress={() => actions.acceptPrivacy()} />
        </Card>
      ) : (
        <>
          {micDenied ? (
            <Card style={{ padding: 16, gap: 10 }}>
              <AppText kind="md" color={theme.colors.brand}>
                没有麦克风权限
              </AppText>
              <AppText kind="micro" color={theme.colors.textSecondary}>
                请在系统设置中允许 Wordbout 使用麦克风。权限只在使用期间生效，用后不驻留。
              </AppText>
              <PrimaryButton
                label="去系统设置"
                onPress={() => {
                  Speech.stop();
                  Linking.openSettings();
                }}
              />
              <PrimaryButton label="重试授权" tone="ghost" onPress={startRecording} />
            </Card>
          ) : null}

          {/* 提示区：不套面板，居中落在正文区（与 AI 探索页同款）。
              识别 / 翻译中显示状态文案，空闲时给操作提示；录音中不占位——反馈在底栏按钮上 */}
          {!micDenied && !result ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              {holding ? null : (
                <AppText
                  kind="micro"
                  color={theme.colors.textSecondary}
                  style={{ textAlign: 'center' }}
                >
                  {status || '点击下方按钮开始录音，再次点击即可结束'}
                </AppText>
              )}
            </View>
          ) : null}

          {result ? (
            <>
              {/* 识别结果：面板外单独一行；发音钮在句子**左侧**，关键词在原句里标红 */}
              <View style={{ gap: 6 }}>
                <AppText kind="micro" color={theme.colors.textMuted}>
                  {tr('识别原文')}
                </AppText>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                  <SpeakButton
                    text={result.source}
                    lang={result.translation.sourceLang === 'zh' ? 'zh-CN' : 'en-US'}
                    accessibilityLabel="朗读"
                    style={{ marginTop: theme.size(speakButtonOffset('body')) }}
                  />
                  <View style={{ flex: 1 }}>
                    <ExampleText
                      text={result.source}
                      term={result.translation.notes.map((n) => n.headword)}
                      kind="body"
                      highlight={theme.colors.accentRed}
                    />
                  </View>
                </View>
              </View>

              {/* 原句译文：面板外单独一行，排在关键词之前；发音钮同样在句子左侧。
                  只在拿到大模型整句译文时显示；词库逐词对照拼出的
                  「原词（释义），原词（释义）…」不展示（见文件头注释） */}
              {result.translation.engine === 'ai' && result.translation.target ? (
                <View style={{ gap: 6 }}>
                  <AppText kind="micro" color={theme.colors.textMuted}>
                    {tr('译文')}
                  </AppText>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <SpeakButton
                      text={result.translation.target}
                      lang={result.translation.targetLang === 'zh' ? 'zh-CN' : 'en-US'}
                      accessibilityLabel="朗读"
                      style={{ marginTop: theme.size(speakButtonOffset('md')) }}
                    />
                    <AppText kind="md" color={theme.colors.text} style={{ flex: 1 }}>
                      {result.translation.target}
                    </AppText>
                  </View>
                </View>
              ) : null}

              {/* 关键词释义面板：与翻译页的释义面板同款，逐条展开词条
                  （词 / 音标 + 朗读钮 / 序号义项 / 例句 / 词表词频标签） */}
              {result.translation.notes.length ? (
                <Card style={{ padding: 16, gap: ENTRY_GAP }}>
                  <AppText kind="micro" color={theme.colors.textMuted}>
                    {tr('本句重点词')}
                  </AppText>
                  {result.translation.notes.map((n, index) => (
                    <React.Fragment key={`${n.dictId}-${n.headword}-${n.query}`}>
                      {index > 0 ? <Divider /> : null}
                      <DictEntryBlock entry={n} />
                    </React.Fragment>
                  ))}
                </Card>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}
