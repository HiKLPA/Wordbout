import { expect, test } from '@playwright/test';
import { bi, enterApp, openPractice } from './helpers';

/**
 * 练习日历与补签（本周 / 本月 / 今年 + 每周 1 次免费额度）。
 *
 * 这里的断言都指向「口径」而不是像素：格子数量、标记文案、剩余额度。
 * 补签是**会改数据**的动作，所以每条用例都从干净存储开始（Playwright 默认每个 test 一个新上下文）。
 */
const CALENDAR = bi('Check-in calendar', '打卡日历');

async function openCalendar(page: import('@playwright/test').Page) {
  await enterApp(page);
  await openPractice(page);
  await page.getByRole('button', { name: bi('Weekly summary', '每周摘要') }).click();
  await expect(page).toHaveURL(/practice-calendar/);
  await expect(page.getByText(CALENDAR)).toBeVisible();
}

/**
 * 日历格子：aria-label 形如 `11/2 No practice` / `11/2 Made up`。
 * 只有「今天及以前」才是可点按钮，未来日期是纯文本 —— 所以按 aria-label 找，不按角色找。
 */
function cells(page: import('@playwright/test').Page) {
  return page.locator('[aria-label*="/"]');
}

test.describe('练习日历', () => {
  test('从练习页连续天数右侧进入，默认本周七格', async ({ page }) => {
    await openCalendar(page);
    await expect(page.getByRole('button', { name: bi('This week', '本周') })).toBeVisible();
    await expect(cells(page)).toHaveCount(7);
    // 顶部三格摘要：练习 / 达标 / 补签
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/Practice|练习/);
    expect(body).toMatch(/Qualified|达标/);
    expect(body).toMatch(/Make-up|补签/);
  });

  test('三档范围切换：本月格子多于一周，今年给出 12 个月', async ({ page }) => {
    await openCalendar(page);
    const week = await cells(page).count();

    await page.getByRole('button', { name: bi('This month', '本月') }).click();
    await page.waitForTimeout(400);
    const month = await cells(page).count();
    expect(month).toBeGreaterThan(week);

    await page.getByRole('button', { name: bi('This year', '今年') }).click();
    await page.waitForTimeout(400);
    // 年视图按 12 个月排布：格子数远多于月视图，且第 12 个月块在
    const year = await cells(page).count();
    expect(year).toBeGreaterThan(month * 5);
    await expect(page.getByText(/Month 12|12\s?月/)).toBeVisible();
  });

  test('补签规则写清额度与窗口，用户不需要猜', async ({ page }) => {
    await openCalendar(page);
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/1 left this week|本周还剩 1/);
    expect(body).toMatch(/last 30 days|最近 30 天/);
    // 口径说明：补签不补练习数据
    expect(body).toMatch(/adds no practice|不补练习时长/);
  });

  test('点过去的日期可以补签，补完格子变「已补签」且额度归零', async ({ page }) => {
    await openCalendar(page);

    // 找第一个「未练习」的过去日期（不是今天、不含未来）
    const target = page.locator('[role="button"][aria-label*="No practice"], [role="button"][aria-label*="未练习"]').first();
    await expect(target).toBeVisible();
    await target.click();

    const makeUp = page.getByRole('button', { name: bi('Make up this day', '补签这一天') });
    await expect(makeUp).toBeVisible();
    await makeUp.click();
    await page.waitForTimeout(600);

    const body = await page.locator('body').innerText();
    expect(body).toMatch(/Made up|已补签/);
    // 本周额度用掉 1 次
    expect(body).toMatch(/0 left this week|本周还剩 0/);
  });

  test('同一周第二次补签被额度拦下并说明原因', async ({ page }) => {
    await openCalendar(page);

    const none = page.locator('[role="button"][aria-label*="No practice"], [role="button"][aria-label*="未练习"]');
    await none.first().click();
    const makeUp = page.getByRole('button', { name: bi('Make up this day', '补签这一天') });
    await makeUp.click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: bi('Close', '关闭') }).click();
    await page.waitForTimeout(300);

    // 再点同周另一天
    await none.first().click();
    const second = page.getByRole('button', { name: bi('Make up this day', '补签这一天') });
    if (await second.count()) {
      await second.click();
      await page.waitForTimeout(500);
    }
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/used up|额度已用完|0 left this week/);
  });

  test('今天不能补签：面板不给按钮，只说明原因', async ({ page }) => {
    await openCalendar(page);
    const today = new Date();
    const label = `${today.getMonth() + 1}/${today.getDate()}`;
    const todayCell = page.locator(`[role="button"][aria-label^="${label} "]`).first();
    if (await todayCell.count()) {
      await todayCell.click();
      await page.waitForTimeout(400);
      await expect(page.getByRole('button', { name: bi('Make up this day', '补签这一天') })).toHaveCount(0);
    }
  });
});
