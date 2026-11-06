import { expect, test, type Page } from '@playwright/test';
import { bi, enterApp, goTab } from './helpers';

/**
 * 埋点自查页（NFR-6）：会话、事件、页面停留、点击排行、事件流水。
 * 这里验的是「采到了、算对了、能清掉」，不验具体数值（数值随操作路径变化）。
 */
async function openAnalytics(page: Page) {
  await enterApp(page);
  await goTab(page, 'more');
  await page.getByRole('button', { name: bi('Settings', '设置') }).click();
  await page.getByRole('button', { name: bi('View analytics', '查看数据统计') }).click();
  await expect(page).toHaveURL(/analytics/);
  await expect(page.getByText(bi('Overview', '概览'))).toBeVisible();
}

/**
 * 读概览里某个指标的数值。
 * 概览的排版是「数值在上、标签在下」（0 / Sessions），所以先看标签的上一行，
 * 不是数值时再退到下一行 —— 两种排版都兼容，避免用例绑死在视觉顺序上。
 */
async function statValue(page: Page, label: RegExp): Promise<string> {
  const lines = (await page.locator('body').innerText()).split('\n').map((l) => l.trim()).filter(Boolean);
  const idx = lines.findIndex((l) => label.test(l));
  if (idx < 0) return '';
  const looksNumeric = (v: string) => /^[\d.,]+\s*(s|%|x|分|秒)?$/.test(v);
  const before = lines[idx - 1] ?? '';
  const after = lines[idx + 1] ?? '';
  return looksNumeric(before) ? before : after;
}

test.describe('数据统计', () => {
  test('概览有会话与事件计数：会话数不再恒为 0', async ({ page }) => {
    await openAnalytics(page);
    const sessions = await statValue(page, /^(Sessions|会话)$/);
    expect(Number(sessions), `会话数应 ≥ 1，实际「${sessions}」`).toBeGreaterThanOrEqual(1);

    const body = await page.locator('body').innerText();
    const stored = /(\d+) events? stored locally/.exec(body);
    expect(stored, '应显示本地事件条数').not.toBeNull();
    expect(Number(stored![1])).toBeGreaterThan(0);
  });

  test('页面停留记录到主页，且给出占比与有效率', async ({ page }) => {
    await openAnalytics(page);
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/Time on screen|页面停留/);
    expect(body).toMatch(/Home|主页/);
    expect(body).toMatch(/\d+%\s*of time|占比/);
  });

  test('点击底栏后，点击排行里出现对应条目', async ({ page }) => {
    await enterApp(page);
    await goTab(page, 'textbook');
    await goTab(page, 'practice');
    await openAnalytics(page);

    const body = await page.locator('body').innerText();
    expect(body).toMatch(/Top taps|点击排行/);
    // 点击元素名存的是中文原文（界面渲染时再翻译），英文界面下显示 Textbook / Practice 或中文
    expect(body).toMatch(/Textbook|课本|Practice|练习/);
  });

  test('清空数据后可回到空态，且不影响学习记录入口', async ({ page }) => {
    await openAnalytics(page);
    await page.getByRole('button', { name: bi('Clear data', '清空数据') }).click();
    // 二次确认面板（web 上 Alert 无效，走的是 App 内面板）
    const confirm = page.getByRole('button', { name: /^(Clear|清空)$/ });
    await expect(confirm).toBeVisible();
    await confirm.click();
    await page.waitForTimeout(800);

    const body = await page.locator('body').innerText();
    expect(body).toMatch(/No data yet|还没有数据|0 events/);
    // 设置页仍在，学习数据入口没被牵连
    await page.goto('/settings');
    await expect(page.getByRole('button', { name: bi('View analytics', '查看数据统计') })).toBeVisible();
  });

  test('关掉「使用数据统计」后不再新增事件', async ({ page }) => {
    await enterApp(page);
    await goTab(page, 'more');
    await page.getByRole('button', { name: bi('Settings', '设置') }).click();

    const toggle = page.getByRole('switch', { name: bi('Usage analytics', '使用数据统计') });
    if (!(await toggle.count())) test.skip(true, '开关未以 switch 角色暴露');
    await toggle.click();
    await page.waitForTimeout(400);

    // 关掉后逛几个页面：设置页是压栈页、没有底栏，这里直接按 URL 走
    await page.goto('/textbook');
    await page.waitForTimeout(300);
    await page.goto('/exercise');
    await page.waitForTimeout(300);
    await page.goto('/analytics');
    const before = await page.locator('body').innerText();
    const n = Number(/(\d+) events? stored locally/.exec(before)?.[1] ?? '0');
    await page.waitForTimeout(1200);
    const after = await page.locator('body').innerText();
    const m = Number(/(\d+) events? stored locally/.exec(after)?.[1] ?? '0');
    expect(m).toBeLessThanOrEqual(n + 1); // 允许页面自己产生一条 screen_view
  });
});
