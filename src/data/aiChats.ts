import { appConfig } from '@/config/appConfig';
import type { AiExploreResult, LlmErrorCode } from '@/data/aiExplore';
import { loadJSON, removeJSON, saveJSON } from '@/lib/storage';

/**
 * 「AI 探索」历史对话的本地存储（底部历史面板的数据源）。
 *
 * 与 `aiExplore.ts` 的答案缓存同一套做法：单独一条 key 存整个数组，**不进 `PersistedState`**
 * （它不是学习记录，也不参与打卡 / 统计 / 同步）。只保留最近 `appConfig.ai.chatLimit` 段。
 */

/** 历史里的一条消息：用户提问 / AI 回复（回复带原始结果，载回时原样渲染） */
export type AiChatMessage =
  | { role: 'user'; text: string }
  | {
      role: 'ai';
      question: string;
      /** 只落「有结果」的三种终态；`loading` 不落盘 */
      status: 'done' | 'none' | 'error';
      result: AiExploreResult | null;
      error: LlmErrorCode | null;
    };

/** 一段对话：面板按 `updatedAt` 倒序列出，标题取第一条用户提问 */
export interface AiChatRecord {
  id: string;
  /** 上次对话截止的时间（最后一次真有新内容的时刻）：排序与面板上的「日期 + 时刻」都用它 */
  updatedAt: number;
  messages: AiChatMessage[];
}

const KEY = 'ai-chats';

/** 内存镜像：面板反复开关不必重复读存储 */
let memory: AiChatRecord[] | null = null;

/** 新对话的 id（与 store 里 `randomId` 同一套写法） */
export function newChatId(): string {
  return `chat_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** 一段对话的一句话标题：第一条用户提问，没有就返回空串（由界面给兜底文案） */
export function chatTitle(record: AiChatRecord): string {
  const first = record.messages.find((m) => m.role === 'user');
  return first && first.role === 'user' ? first.text : '';
}

/** 结构校验：只认形状对得上的条目，坏数据直接丢掉（存储可能被外部改坏） */
function isRecord(value: unknown): value is AiChatRecord {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<AiChatRecord>;
  return typeof v.id === 'string' && typeof v.updatedAt === 'number' && Array.isArray(v.messages);
}

/** 读全部历史（倒序：最近在前） */
export async function listAiChats(): Promise<AiChatRecord[]> {
  if (memory) return memory;
  const stored = await loadJSON<AiChatRecord[]>(KEY);
  memory = Array.isArray(stored)
    ? stored.filter(isRecord).sort((a, b) => b.updatedAt - a.updatedAt)
    : [];
  return memory;
}

/**
 * 写入一段对话（同 id 覆盖、否则插到最前），返回写完后的列表。
 * 超出 `appConfig.ai.chatLimit` 时按最近活动时间淘汰最旧的。
 */
export async function saveAiChat(record: AiChatRecord): Promise<AiChatRecord[]> {
  const list = await listAiChats();
  const next = [record, ...list.filter((c) => c.id !== record.id)]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, Math.max(1, appConfig.ai.chatLimit));
  memory = next;
  void saveJSON(KEY, next);
  return next;
}

/**
 * 删掉一段对话（历史面板行内左滑删除），返回删完后的列表。
 * 删的是**历史记录**这一份：正在对话区里的那段内容由界面自己决定去留（见探索页）。
 */
export async function deleteAiChat(id: string): Promise<AiChatRecord[]> {
  const list = await listAiChats();
  const next = list.filter((c) => c.id !== id);
  memory = next;
  void saveJSON(KEY, next);
  return next;
}

/** 清空全部历史（存储损坏时也走它复位） */
export async function clearAiChats(): Promise<void> {
  memory = [];
  await removeJSON(KEY);
}
