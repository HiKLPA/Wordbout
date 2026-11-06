import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import { appConfig } from '@/config/appConfig';
import type { BoardId, ExerciseTypeId } from '@/config/appConfig';
import { addDays, dateKey, todayKey } from '@/domain/date';
import { DEFAULT_FOLDER_ID, defaultFavoriteFolder, sortFoldersAlpha } from '@/domain/favorites';
import { emptyDaily, isQualified, recomputeDaily } from '@/domain/stats';
import type {
  AppSettings,
  Attempt,
  AuthMethod,
  DailyStat,
  FavoriteFolder,
  FavoriteItem,
  FavoriteSource,
  GradingResult,
  PersistedState,
  PracticeResume,
  ReadingPosition,
  SavedItem,
  UserProfile,
  WritingBookEntry,
} from '@/domain/types';
import { STORAGE_KEYS, loadJSON, removeJSON, saveJSON } from '@/lib/storage';
import { DEFAULT_FOLDER_COLOR, type FolderColor } from '@/theme/tokens';

const STATE_VERSION = 1;

function randomId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function defaultSettings(): AppSettings {
  return {
    fontScaleIndex: 1,
    colorScheme: 'system',
    highContrast: false,
    reduceMotion: false,
    locale: appConfig.i18n.defaultLocale,
    privacyAccepted: false,
    onboarded: false,
    dailyTimeThreshold: appConfig.streak.defaultTimeThreshold,
    dailyTaskThreshold: appConfig.streak.defaultTaskThreshold,
    reminderEnabled: appConfig.reminder.enabled,
    reminderHour: appConfig.reminder.defaultHour,
    reminderMinute: appConfig.reminder.defaultMinute,
  };
}

function defaultProfile(): UserProfile {
  return {
    id: 'WB-000001',
    nickname: 'TGIF',
    method: 'guest',
    signedIn: false,
  };
}

export function initialState(): PersistedState {
  return {
    version: STATE_VERSION,
    profile: defaultProfile(),
    settings: defaultSettings(),
    levelId: 'daily',
    daily: {},
    attempts: [],
    favorites: [],
    favoriteFolders: [defaultFavoriteFolder()],
    readingPositions: {},
    downloadedBookIds: ['popular-cet4'],
    writingBook: [],
    savedItems: [],
    lastPractice: null,
    lastSyncedAt: Date.now(),
    pendingSync: false,
  };
}

/**
 * 老数据补齐（收藏夹）：早期 `favorites` 没有 `folderId`、也没有 `favoriteFolders`。
 * 统一保证内置「默认」收藏夹存在，且每条收藏都落在一个真实存在的收藏夹里。
 */
function normalizeState(stored: PersistedState): PersistedState {
  const saved = Array.isArray(stored.favoriteFolders) ? stored.favoriteFolders : [];
  const folders = saved.some((f) => f.id === DEFAULT_FOLDER_ID) ? saved : [defaultFavoriteFolder(), ...saved];
  const ids = new Set(folders.map((f) => f.id));
  return {
    ...stored,
    // 列表顺序 = 数组顺序，恒为默认的 A-Z（老数据也因此一次性归到 A-Z）
    favoriteFolders: sortFoldersAlpha(folders),
    favorites: (stored.favorites ?? []).map((f) =>
      f.folderId && ids.has(f.folderId) ? f : { ...f, folderId: DEFAULT_FOLDER_ID },
    ),
    /* 早期版本只存了一串题目 id（没有收藏时间与来源）：统一补成 SavedItem，
       时间记 0（列表里归到「较早收藏」一档），来源按练习场次算 */
    savedItems:
      stored.savedItems ??
      (stored as unknown as { wrongItemIds?: string[] }).wrongItemIds?.map((itemId) => ({
        itemId,
        savedAt: 0,
        source: 'practice' as const,
      })) ??
      [],
    /* 断点续做：老数据没有这个字段，统一补成「没有进行中的练习」 */
    lastPractice: stored.lastPractice ?? null,
  };
}

export interface SubmitAttemptInput {
  typeId: ExerciseTypeId;
  levelId: string;
  itemId: string;
  board: BoardId;
  promptTitle: string;
  prompt: string;
  answer: string;
  durationSec: number;
  /** 客观题直接给分；主观题传 null，等待评分 */
  scoreRate: number | null;
  result?: GradingResult;
  status?: Attempt['status'];
  wrongWords?: string[];
  /** 测验作答：记录保留，但不计入打卡与统计（见 Attempt.excluded） */
  excluded?: boolean;
}

export interface AppActions {
  signIn: (method: AuthMethod, nickname?: string) => void;
  signOut: (keepLocalData: boolean) => void;
  updateProfile: (patch: Partial<UserProfile>) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  setLevel: (levelId: string) => void;
  acceptPrivacy: () => void;
  completeOnboarding: (opts: { accepted: boolean; method: AuthMethod; nickname?: string }) => void;
  /** 后台超过 30 秒后回前台，只结算前 30 秒（FR-E-2） */
  startAttempt: (input: Omit<SubmitAttemptInput, 'scoreRate' | 'result'>) => string;
  finishAttempt: (attemptId: string, result: GradingResult | null, scoreRate: number | null) => void;
  /** 收藏 / 取消收藏（不带 folderId 时落到内置「默认」收藏夹；取消时该单词从所有夹移除） */
  toggleFavorite: (item: { word: string; definition: string; source: FavoriteSource; folderId?: string }) => void;
  /**
   * 多选保存（FR-T-1）：把单词所在的收藏夹一次性设成给定集合 —— 缺的补上、取消勾选的移除，
   * 传空数组等于取消收藏。集合与现状一致时不改动 state。
   */
  setFavoriteFolders: (
    item: { word: string; definition: string; source: FavoriteSource },
    folderIds: string[],
  ) => void;
  /** 新建收藏夹（可选封面颜色，缺省品牌红），返回新收藏夹 id */
  addFavoriteFolder: (name: string, color?: FolderColor) => string;
  /** 删除收藏夹：夹内单词一并取消收藏；内置「默认」收藏夹不可删除 */
  removeFavoriteFolder: (folderId: string) => void;
  setReadingPosition: (pos: ReadingPosition) => void;
  /** 加入错题本（幂等）：同一道题重复加入不产生重复记录 */
  addSavedItem: (itemId: string, source: SavedItem['source']) => void;
  /** 移出错题本（幂等）：不在本里时不动 state */
  removeSavedItem: (itemId: string) => void;
  /**
   * 记下本次练习的断点（练习页「最近练习」据此续做）：题型 / 题库 / 本次队列 / 停在第几题。
   * 只在真的变了时才改 state —— 练习页每换一题都会调它。断点一旦存在就留着不主动清
   * （退出练习页退到哪一层都还能续），只有下次抽定新队列时才被覆盖。
   */
  savePracticeResume: (resume: PracticeResume) => void;
  resetLearningData: () => void;
  removeAttempt: (attemptId: string) => void;
  exportData: (format: 'csv' | 'json') => string;
}

interface AppContextValue {
  ready: boolean;
  state: PersistedState;
  today: DailyStat;
  streak: number;
  todayQualified: boolean;
  /** 今日已累计练习秒数（不含进行中的本次会话） */
  todayDurationSec: number;
  todayTaskCount: number;
  actions: AppActions;
}

const AppContext = createContext<AppContextValue | null>(null);

/** 独立计时上下文：避免每秒回流导致整棵树重渲染 */
interface TimerValue {
  /** 今日累计秒数（含进行中的会话） */
  seconds: number;
  running: boolean;
  start: () => void;
  stop: () => void;
}

const TimerContext = createContext<TimerValue>({
  seconds: 0,
  running: false,
  start: () => {},
  stop: () => {},
});

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<PersistedState>(initialState);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const sessionRef = useRef(0);
  const backgroundAt = useRef<number | null>(null);

  /* ---------- 载入 / 持久化 ---------- */
  useEffect(() => {
    (async () => {
      const stored = await loadJSON<PersistedState>(STORAGE_KEYS.state);
      if (stored && stored.version === STATE_VERSION) {
        const normalized = normalizeState(stored);
        setState({ ...initialState(), ...normalized, settings: { ...defaultSettings(), ...normalized.settings } });
      } else {
        // 首次启动：清理历史版本键
        await removeJSON(STORAGE_KEYS.state);
      }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    void saveJSON(STORAGE_KEYS.state, state);
  }, [ready, state]);

  /* ---------- 计时器（FR-E-2） ---------- */
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      sessionRef.current += 1;
      setSessionSeconds(sessionRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background' || next === 'inactive') {
        if (backgroundAt.current === null) backgroundAt.current = Date.now();
      } else if (next === 'active' && backgroundAt.current !== null) {
        const away = Math.round((Date.now() - backgroundAt.current) / 1000);
        backgroundAt.current = null;
        // 切后台超过 30 秒暂停计时：只结算前 30 秒
        const countable = Math.min(away, 30);
        if (countable > 0) {
          sessionRef.current += countable;
          setSessionSeconds(sessionRef.current);
        }
      }
    });
    return () => sub.remove();
  }, []);

  /** 把会话计时结算进当日聚合 */
  const flushSession = useCallback((extraSeconds = 0) => {
    const total = sessionRef.current + extraSeconds;
    sessionRef.current = 0;
    setSessionSeconds(0);
    if (total <= 0) return;
    setState((prev) => {
      const key = todayKey();
      const day = prev.daily[key] ?? emptyDaily(key);
      const nextDay: DailyStat = { ...day, durationSec: day.durationSec + total };
      nextDay.qualified = isQualified(
        nextDay.durationSec,
        nextDay.taskCount,
        prev.settings.dailyTimeThreshold,
        prev.settings.dailyTaskThreshold,
      );
      return { ...prev, daily: { ...prev.daily, [key]: nextDay }, pendingSync: true };
    });
  }, []);

  const actions = useMemo<AppActions>(() => {
    const patchSettings = (patch: Partial<AppSettings>) =>
      setState((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));

    return {
      signIn: (method, nickname) =>
        setState((prev) => ({
          ...prev,
          profile: {
            ...prev.profile,
            method,
            signedIn: method !== 'guest',
            nickname: nickname ?? prev.profile.nickname,
          },
          lastSyncedAt: Date.now(),
        })),
      signOut: (keepLocalData) =>
        setState((prev) => {
          const base = { ...prev, profile: { ...defaultProfile(), settings: { ...prev.settings } } };
          if (keepLocalData) return { ...base, lastSyncedAt: Date.now() };
          return { ...initialState(), profile: { ...defaultProfile(), settings: prev.settings } };
        }),
      updateProfile: (patch) => setState((prev) => ({ ...prev, profile: { ...prev.profile, ...patch } })),
      updateSettings: patchSettings,
      setLevel: (levelId) => setState((prev) => ({ ...prev, levelId })),
      acceptPrivacy: () => patchSettings({ privacyAccepted: true }),
      completeOnboarding: ({ accepted, method, nickname }) =>
        setState((prev) => ({
          ...prev,
          profile: {
            ...prev.profile,
            method,
            signedIn: method !== 'guest',
            nickname: nickname ?? prev.profile.nickname,
          },
          settings: { ...prev.settings, onboarded: true, privacyAccepted: accepted },
          lastSyncedAt: Date.now(),
        })),
      startAttempt: (input) => {
        const id = randomId('att');
        const now = Date.now();
        const attempt: Attempt = {
          ...input,
          id,
          scoreRate: null,
          status: 'draft',
          createdAt: now,
          finishedAt: now,
        };
        setState((prev) => ({ ...prev, attempts: [attempt, ...prev.attempts], pendingSync: true }));
        return id;
      },
      finishAttempt: (attemptId, result, scoreRate) => {
        setState((prev) => {
          const now = Date.now();
          const idx = prev.attempts.findIndex((a) => a.id === attemptId);
          if (idx < 0) return prev;
          const attempts = [...prev.attempts];
          const target = attempts[idx];
          const status: Attempt['status'] = result ? 'succeeded' : 'failed';
          attempts[idx] = {
            ...target,
            result: result ?? target.result,
            scoreRate,
            status,
            finishedAt: now,
          };

          // 只有评分成功才计入当日任务数与题型得分（FR-E-3 / DR-3）；
          // 测验（错题重做 / 综合）的作答只更新记录本身，不进打卡与统计
          if (!result || target.excluded) return { ...prev, attempts, pendingSync: true };

          const key = todayKey();
          const day = prev.daily[key] ?? emptyDaily(key);
          const alreadyCounted = day.completedItemIds.includes(target.itemId);
          const prevType = day.byType[target.typeId] ?? { count: 0, durationSec: 0, scoreSum: 0, scoreMax: 0 };
          const prevLevel = day.byLevel[target.levelId] ?? { count: 0, durationSec: 0 };
          const safeScore = scoreRate ?? 0;
          const nextDay: DailyStat = {
            ...day,
            durationSec: day.durationSec + (alreadyCounted ? 0 : target.durationSec),
            taskCount: day.taskCount + (alreadyCounted ? 0 : 1),
            completedItemIds: alreadyCounted ? day.completedItemIds : [...day.completedItemIds, target.itemId],
            byType: {
              ...day.byType,
              [target.typeId]: {
                count: prevType.count + (alreadyCounted ? 0 : 1),
                durationSec: prevType.durationSec + (alreadyCounted ? 0 : target.durationSec),
                scoreSum: prevType.scoreSum + safeScore,
                scoreMax: prevType.scoreMax + 100,
              },
            },
            byLevel: {
              ...day.byLevel,
              [target.levelId]: {
                count: prevLevel.count + (alreadyCounted ? 0 : 1),
                durationSec: prevLevel.durationSec + (alreadyCounted ? 0 : target.durationSec),
              },
            },
          };
          nextDay.qualified = isQualified(
            nextDay.durationSec,
            nextDay.taskCount,
            prev.settings.dailyTimeThreshold,
            prev.settings.dailyTaskThreshold,
          );

          // 写作本（FR-E-8）：同标题多次评分保留分数变化
          let writingBook = prev.writingBook;
          if (target.typeId === 'writing-passage') {
            const existing = writingBook.find((w) => w.title === target.promptTitle);
            const history = { attemptId, scoreRate: safeScore, gradedAt: now };
            if (existing) {
              writingBook = writingBook.map((w) =>
                w.title === target.promptTitle
                  ? { ...w, text: target.answer, attempts: [...w.attempts, history] }
                  : w,
              );
            } else {
              const entry: WritingBookEntry = {
                id: randomId('wb'),
                title: target.promptTitle,
                text: target.answer,
                attempts: [history],
              };
              writingBook = [entry, ...writingBook];
            }
          }

          return { ...prev, attempts, daily: { ...prev.daily, [key]: nextDay }, writingBook, pendingSync: true };
        });
      },
      toggleFavorite: (item) =>
        setState((prev) => {
          // 同一个单词可能被收藏在多个夹里，取消时一次全部移除
          const hit = prev.favorites.some((f) => f.word === item.word);
          if (hit) {
            return {
              ...prev,
              favorites: prev.favorites.filter((f) => f.word !== item.word),
              pendingSync: true,
            };
          }
          const fav: FavoriteItem = {
            id: randomId('fav'),
            word: item.word,
            definition: item.definition,
            source: item.source,
            folderId: item.folderId ?? DEFAULT_FOLDER_ID,
            createdAt: Date.now(),
          };
          return { ...prev, favorites: [fav, ...prev.favorites], pendingSync: true };
        }),
      setFavoriteFolders: (item, folderIds) =>
        setState((prev) => {
          // 收藏夹可能刚被删掉：只认仍然存在的那几个
          const valid = new Set(prev.favoriteFolders.map((f) => f.id));
          const wanted = folderIds.filter((id) => valid.has(id));
          const existing = prev.favorites.filter((f) => f.word === item.word);
          const rest = prev.favorites.filter((f) => f.word !== item.word);
          // 已在该夹里的沿用原记录（保住 id 与收藏时间），缺的新建
          const next = wanted.map(
            (folderId) =>
              existing.find((f) => f.folderId === folderId) ?? {
                id: randomId('fav'),
                word: item.word,
                definition: item.definition,
                source: item.source,
                folderId,
                createdAt: Date.now(),
              },
          );
          // 勾选结果与现状一致就不动 state，避免无意义的重渲染与同步标记
          if (
            next.length === existing.length &&
            next.every((f) => existing.some((e) => e.id === f.id))
          ) {
            return prev;
          }
          return { ...prev, favorites: [...next, ...rest], pendingSync: true };
        }),
      addFavoriteFolder: (name, color) => {
        const folder: FavoriteFolder = {
          id: randomId('folder'),
          name: name.trim(),
          createdAt: Date.now(),
          color: color ?? DEFAULT_FOLDER_COLOR,
        };
        setState((prev) => ({
          ...prev,
          // 数组顺序即列表顺序：按显示名 A-Z 插进去（FR-T-1）
          favoriteFolders: sortFoldersAlpha([...prev.favoriteFolders, folder]),
          pendingSync: true,
        }));
        return folder.id;
      },
      removeFavoriteFolder: (folderId) => {
        if (folderId === DEFAULT_FOLDER_ID) return;
        setState((prev) => ({
          ...prev,
          favoriteFolders: prev.favoriteFolders.filter((f) => f.id !== folderId),
          // 删收藏夹 = 连夹内单词一起取消收藏
          favorites: prev.favorites.filter((f) => f.folderId !== folderId),
          pendingSync: true,
        }));
      },
      setReadingPosition: (pos) =>
        setState((prev) => ({
          ...prev,
          readingPositions: { ...prev.readingPositions, [pos.bookId]: pos },
          pendingSync: true,
        })),
      addSavedItem: (itemId, source) =>
        setState((prev) =>
          prev.savedItems.some((x) => x.itemId === itemId)
            ? prev
            : {
                ...prev,
                savedItems: [{ itemId, savedAt: Date.now(), source }, ...prev.savedItems],
                pendingSync: true,
              },
        ),
      removeSavedItem: (itemId) =>
        setState((prev) =>
          prev.savedItems.some((x) => x.itemId === itemId)
            ? { ...prev, savedItems: prev.savedItems.filter((x) => x.itemId !== itemId), pendingSync: true }
            : prev,
        ),
      savePracticeResume: (resume) =>
        setState((prev) => {
          const cur = prev.lastPractice;
          const same = Boolean(
            cur &&
              cur.typeId === resume.typeId &&
              cur.levelId === resume.levelId &&
              cur.mode === resume.mode &&
              cur.set === resume.set &&
              cur.index === resume.index &&
              cur.itemIds.length === resume.itemIds.length &&
              cur.itemIds.every((id, i) => id === resume.itemIds[i]) &&
              /* 作答现场也要比：确认后回写一次（attemptId / 解析是否展开 / 是否已加入题集） */
              JSON.stringify(cur.draft ?? null) === JSON.stringify(resume.draft ?? null),
          );
          /** 断点只服务本机续做，不参与云同步，所以不动 pendingSync */
          return same ? prev : { ...prev, lastPractice: resume };
        }),
      resetLearningData: () =>
        setState((prev) => ({
          ...prev,
          daily: {},
          attempts: [],
          writingBook: [],
          /* 学习数据清空后没有「上次练习」可续，断点一并清掉 */
          lastPractice: null,
          pendingSync: true,
        })),
      removeAttempt: (attemptId) =>
        setState((prev) => {
          const attempts = prev.attempts.filter((a) => a.id !== attemptId);
          return {
            ...prev,
            attempts,
            writingBook: prev.writingBook
              .map((w) => ({ ...w, attempts: w.attempts.filter((x) => x.attemptId !== attemptId) }))
              .filter((w) => w.attempts.length > 0),
            // 明细被删除时按明细重建聚合，保证口径一致（DR-3 / FR-E-20）
            daily: recomputeDaily(attempts, {
              timeThresholdMin: prev.settings.dailyTimeThreshold,
              taskThreshold: prev.settings.dailyTaskThreshold,
            }),
            pendingSync: true,
          };
        }),
      exportData: (format) => buildExport(state, format),
    };
  }, [state]);

  const flushRef = useRef(flushSession);
  flushRef.current = flushSession;

  const start = useCallback(() => {
    sessionRef.current = 0;
    setSessionSeconds(0);
    setRunning(true);
  }, []);
  const stop = useCallback(() => {
    setRunning(false);
    flushRef.current();
  }, []);

  useEffect(() => () => flushRef.current(), []);

  const today = useMemo(() => {
    const key = todayKey();
    const raw = state.daily[key];
    const base = raw ?? emptyDaily(key);
    return {
      ...base,
      durationSec: base.durationSec + sessionSeconds,
    };
  }, [state.daily, sessionSeconds]);

  const { streak, todayQualified } = useMemo(() => {
    const key = todayKey();
    const qualified = (k: string) => {
      const d = state.daily[k];
      if (!d) return false;
      return isQualified(
        d.durationSec,
        d.taskCount,
        state.settings.dailyTimeThreshold,
        state.settings.dailyTaskThreshold,
      );
    };
    const tq = qualified(key) || todayQualifiedFrom(today, state);
    let count = 0;
    let cur = tq ? key : addDays(key, -1);
    let guard = 0;
    while (qualified(cur) && guard < 3650) {
      count += 1;
      cur = addDays(cur, -1);
      guard += 1;
    }
    return { streak: count, todayQualified: tq };
  }, [state.daily, state.settings, today]);

  const stateValue = useMemo<AppContextValue>(
    () => ({
      ready,
      state,
      today,
      streak,
      todayQualified,
      todayDurationSec: today.durationSec,
      todayTaskCount: today.taskCount,
      actions,
    }),
    [ready, state, today, streak, todayQualified, actions],
  );

  const timerValue = useMemo<TimerValue>(
    () => ({ seconds: today.durationSec, running, start, stop }),
    [today.durationSec, running, start, stop],
  );

  return (
    <AppContext.Provider value={stateValue}>
      <TimerContext.Provider value={timerValue}>{children}</TimerContext.Provider>
    </AppContext.Provider>
  );
}

function todayQualifiedFrom(day: DailyStat, state: PersistedState): boolean {
  return isQualified(
    day.durationSec,
    day.taskCount,
    state.settings.dailyTimeThreshold,
    state.settings.dailyTaskThreshold,
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp 必须在 AppStoreProvider 内使用');
  return ctx;
}

export function usePracticeTimer(): TimerValue {
  return useContext(TimerContext);
}

/** 数据导出（FR-O-4：格式为可读文本，例如 CSV 或 JSON） */
export function buildExport(state: PersistedState, format: 'csv' | 'json'): string {
  if (format === 'json') {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        profile: { id: state.profile.id, nickname: state.profile.nickname },
        daily: state.daily,
        attempts: state.attempts,
        favorites: state.favorites,
        favoriteFolders: state.favoriteFolders,
        writingBook: state.writingBook,
      },
      null,
      2,
    );
  }
  const head = [
    'attempt_id',
    'date',
    'board',
    'type',
    'level',
    'title',
    'duration_sec',
    'score',
    'status',
  ].join(',');
  const rows = state.attempts.map((a) =>
    [
      a.id,
      dateKey(new Date(a.finishedAt)),
      a.board,
      a.typeId,
      a.levelId,
      `"${a.promptTitle.replace(/"/g, '""')}"`,
      a.durationSec,
      a.scoreRate === null ? '' : a.scoreRate.toFixed(1),
      a.status,
    ].join(','),
  );
  return [head, ...rows].join('\n');
}

export { AsyncStorage };
