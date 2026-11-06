import { expect, type Page } from '@playwright/test';

/**
 * 端到端测试的公共动作。
 *
 * 两条约定：
 * - **选择器只用可访问名**（`getByRole` + `aria-label`），不碰 class 与 DOM 结构 ——
 *   RN Web 的类名是编译产物，改一次样式就全变；
 * - **文案用双语正则**：界面默认英文，但用例里同时接受中文，避免「换个默认语言全红」。
 */
export function bi(en: string, zh: string): RegExp {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${esc(en)}|${esc(zh)}`);
}

/** 一层级页面的入口（底栏五项） */
export const TAB = {
  home: bi('Home', '主页'),
  explore: bi('Explore', '探索'),
  textbook: bi('Textbook', '课本'),
  practice: bi('Practice', '练习'),
  more: bi('More', '更多'),
};

/** 走完引导页（同意隐私政策 + 游客身份），落到主页 */
export async function enterApp(page: Page): Promise<void> {
  await page.goto('/onboarding');
  const accept = page.getByRole('button', { name: bi('Accept the privacy policy and continue', '同意隐私政策并继续') });
  await expect(accept).toBeVisible();
  await accept.click();
  await expect(tabButton(page, 'practice')).toBeVisible();
}

/** 底栏一项（语义角色是 tab，不是 button —— 断言别退化成按文字找） */
export function tabButton(page: Page, tab: keyof typeof TAB) {
  return page.getByRole('tab', { name: TAB[tab] }).first();
}

/** 点底栏切页 */
export async function goTab(page: Page, tab: keyof typeof TAB): Promise<void> {
  await tabButton(page, tab).click();
}

/** 首页翻译条（一级页面「主页」的标志物） */
export function translateBar(page: Page) {
  return page.getByRole('button', { name: /English ⇄ Chinese|translate/i }).first();
}

/** 进入练习页（底栏第四项） */
export async function openPractice(page: Page): Promise<void> {
  await goTab(page, 'practice');
  await expect(page.getByRole('button', { name: /goal \d+ min/ }).first()).toBeVisible();
}

/** 收页面上的未捕获异常，用于「流程跑完没有崩」这类断言 */
export function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/**
 * 读取 localStorage 里的持久化状态。
 * 真实键名带命名空间（`lib/storage` 里的前缀 + STORAGE_KEYS.state），
 * 早期用例按裸 `state` 写，测出来的「迁移」其实是空场景 —— 记录在此避免再踩。
 */
export const STATE_KEY = 'wordbout:v1:state';

/** 读取持久化状态 */
export async function readStoredState(page: Page): Promise<Record<string, unknown> | null> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('wordbout:v1:state');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  });
}
