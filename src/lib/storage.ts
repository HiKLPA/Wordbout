import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 本地持久化（DR-2 ~ DR-4）。
 * 初始开发阶段使用 AsyncStorage 存一份 JSON；正式版替换为 SQLite + 服务端同步即可。
 */

const KEY_PREFIX = 'wordbout:v1:';

/**
 * 读一份 JSON。解析失败时**不静默丢数据**：把原始字符串另存到 `<key>:corrupt`，
 * 再按「没有数据」返回（界面回落到首次启动，不会崩，也留了一次人工捞回的机会）。
 */
export async function loadJSON<T>(key: string): Promise<T | null> {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(KEY_PREFIX + key);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    try {
      await AsyncStorage.setItem(KEY_PREFIX + key + ':corrupt', raw);
    } catch {
      // 备份也失败就没什么可做的了，别把启动带崩
    }
    return null;
  }
}

export async function saveJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_PREFIX + key, JSON.stringify(value));
  } catch {
    // 写失败不阻塞交互；下次变更会重试
  }
}

export async function removeJSON(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY_PREFIX + key);
  } catch {
    // ignore
  }
}

/** 列出已存在的键（**去掉全局前缀**后的键名），只保留 `prefix` 开头的那批 */
export async function listKeys(prefix = ''): Promise<string[]> {
  try {
    const all = await AsyncStorage.getAllKeys();
    return all
      .filter((k) => k.startsWith(KEY_PREFIX))
      .map((k) => k.slice(KEY_PREFIX.length))
      .filter((k) => k.startsWith(prefix));
  } catch {
    return [];
  }
}

/** 按前缀统计占用（UTF-8 字节）——「更多-设置」里的缓存大小 */
export async function byteSizeByPrefix(prefix: string): Promise<number> {
  const keys = await listKeys(prefix);
  if (!keys.length) return 0;
  try {
    const pairs = await AsyncStorage.multiGet(keys.map((k) => KEY_PREFIX + k));
    return pairs.reduce((sum, [, value]) => sum + (value ? utf8Length(value) : 0), 0);
  } catch {
    return 0;
  }
}

/** 按前缀批量删除，返回删除的条数 */
export async function removeByPrefix(prefix: string): Promise<number> {
  const keys = await listKeys(prefix);
  if (!keys.length) return 0;
  try {
    await AsyncStorage.multiRemove(keys.map((k) => KEY_PREFIX + k));
    return keys.length;
  } catch {
    return 0;
  }
}

/**
 * 字符串的 UTF-8 字节数。
 * 手写而不用 `TextEncoder` / `Blob`，是为了在原生端（Hermes）与 web 上都不依赖全局对象。
 */
export function utf8Length(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      // 代理对（emoji 等）按 4 字节算，并跳过紧随的低位代理
      bytes += 4;
      i += 1;
    } else bytes += 3;
  }
  return bytes;
}

export const STORAGE_KEYS = {
  state: 'state',
} as const;
