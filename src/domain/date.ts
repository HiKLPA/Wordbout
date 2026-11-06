import { trf } from '@/i18n';
/**
 * 日期工具：跨天一律以设备所在时区的自然日零点为界（FR-E-1 验收标准）。
 */

export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return dateKey(new Date());
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map((v) => Number(v));
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

export function addDays(key: string, delta: number): string {
  const d = parseKey(key);
  d.setDate(d.getDate() + delta);
  return dateKey(d);
}

export function diffDays(a: string, b: string): number {
  const ms = parseKey(b).getTime() - parseKey(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** 生成 [from, to] 闭区间的日期列表 */
export function rangeKeys(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  let guard = 0;
  while (diffDays(cur, to) >= 0 && guard < 2000) {
    out.push(cur);
    cur = addDays(cur, 1);
    guard += 1;
  }
  return out;
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${`${m}`.padStart(2, '0')}:${`${sec}`.padStart(2, '0')}`;
  return `${m}:${`${sec}`.padStart(2, '0')}`;
}

export function formatDurationHuman(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return trf('{v} 秒', { v: s });
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h > 0) return m > 0 ? trf('{h} 小时 {m} 分', { h, m }) : trf('{h} 小时', { h });
  return trf('{m} 分', { m });
}

/** 简短日期：M月D日（英文为 M/D） */
export function formatDayShort(key: string): string {
  const d = parseKey(key);
  return trf('{m}月{d}日', { m: d.getMonth() + 1, d: d.getDate() });
}

/**
 * 简短日期 + 时刻（精确到分），形如 `26.10.16 10:08`。
 * 纯数字、不含语言相关的量词，所以三语共用同一串（不走词表）。
 */
export function formatDayTimeShort(ts: number): string {
  const d = new Date(ts);
  const yy = `${d.getFullYear()}`.slice(-2).padStart(2, '0');
  const mo = `${d.getMonth() + 1}`.padStart(2, '0');
  const dd = `${d.getDate()}`.padStart(2, '0');
  const hh = `${d.getHours()}`.padStart(2, '0');
  const mm = `${d.getMinutes()}`.padStart(2, '0');
  return `${yy}.${mo}.${dd} ${hh}:${mm}`;
}

export function formatDateTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')} ${`${d.getHours()}`.padStart(2, '0')}:${`${d.getMinutes()}`.padStart(2, '0')}`;
}

/** ISO 周起始（周一） */
export function weekStartKey(key: string): string {
  const d = parseKey(key);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return dateKey(d);
}

export function monthStartKey(key: string): string {
  const d = parseKey(key);
  return dateKey(new Date(d.getFullYear(), d.getMonth(), 1));
}
