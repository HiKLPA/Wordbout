import { appConfig, exerciseTypeMap, type ExerciseTypeId } from '@/config/appConfig';
import type { ExerciseItem } from '@/data/questions';
import type { Attempt, DailyStat } from '@/domain/types';
import { emptyDaily } from '@/domain/stats';

/** 取题型定义（`localGrade` 需要 board 字段判断走哪一支） */
export function defOf(typeId: ExerciseTypeId) {
  const def = exerciseTypeMap[typeId];
  if (!def) throw new Error(`未知题型：${typeId}`);
  return def;
}

/** 一条作答记录：只写关心的字段，其余给稳定的默认值 */
export function attempt(patch: Partial<Attempt> & Pick<Attempt, 'typeId' | 'itemId'>): Attempt {
  const { typeId, itemId, ...rest } = patch;
  return {
    id: rest.id ?? `att-${typeId}-${itemId}`,
    typeId,
    board: exerciseTypeMap[typeId].board,
    levelId: 'cet4',
    itemId,
    promptTitle: itemId,
    prompt: '',
    answer: '',
    scoreRate: 80,
    durationSec: 60,
    status: 'succeeded',
    createdAt: 0,
    finishedAt: 0,
    ...rest,
  };
}

/** 某一天的聚合：默认「练过但没达标」 */
export function day(key: string, durationSec = 0, taskCount = 0): DailyStat {
  return { ...emptyDaily(key), durationSec, taskCount };
}

/** 达标的一天（门槛取当前配置的默认值：5 分钟 / 5 个任务） */
export function qualifiedDay(key: string): DailyStat {
  return day(key, appConfig.streak.defaultTimeThreshold * 60, appConfig.streak.defaultTaskThreshold);
}

export function thresholdDefaults() {
  return {
    timeThresholdMin: appConfig.streak.defaultTimeThreshold,
    taskThreshold: appConfig.streak.defaultTaskThreshold,
  };
}

/** 一道题：默认是听写题（走拼写判定那一支） */
export function item(patch: Partial<ExerciseItem> = {}): ExerciseItem {
  return {
    id: 'it-1',
    typeId: 'dictation',
    levelId: 'cet4',
    title: '听写',
    prompt: '听音频，写出你听到的单词',
    dictationAnswer: 'abandon',
    ...patch,
  } as ExerciseItem;
}
