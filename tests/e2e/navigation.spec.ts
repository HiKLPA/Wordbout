import { expect, test } from '@playwright/test';
import { bi, enterApp, goTab, tabButton, translateBar } from './helpers';

/**
 * 信息架构：底栏切换、二级页进入与返回、未知路由的兜底。
 * 一级页面之间是横向平级，二级页是纵向压栈，两件事分开验。
 */
test.describe('一级页面切换', () => {
  test('五个页面各自可达，URL 与页面标志物都对得上', async ({ page }) => {
    await enterApp(page);

    await goTab(page, 'textbook');
    await expect(page).toHaveURL(/textbook/);
    await expect(page.getByText(/STARRED|Saved words|已收藏/).first()).toBeVisible();

    await goTab(page, 'practice');
    await expect(page).toHaveURL(/exercise/);
    await expect(page.getByRole('button', { name: /goal \d+ min/ }).first()).toBeVisible();

    await goTab(page, 'more');
    await expect(page).toHaveURL(/more/);
    await expect(page.getByRole('button', { name: bi('Settings', '设置') })).toBeVisible();

    await goTab(page, 'home');
    await expect(page).toHaveURL(/\/$/);
    await expect(translateBar(page)).toBeVisible();
  });

  test('反复切换不产生重复压栈（再回主页仍只有一个底栏）', async ({ page }) => {
    await enterApp(page);
    for (let i = 0; i < 3; i += 1) {
      await goTab(page, 'textbook');
      await goTab(page, 'home');
    }
    await expect(tabButton(page, 'home')).toHaveCount(1);
  });
});

test.describe('二级页进入与返回', () => {
  test('更多 → 设置 → 返回，回到更多', async ({ page }) => {
    await enterApp(page);
    await goTab(page, 'more');
    await page.getByRole('button', { name: bi('Settings', '设置') }).click();
    await expect(page).toHaveURL(/settings/);
    await expect(page.getByText(/DISPLAY|显示/).first()).toBeVisible();

    await page.getByRole('button', { name: bi('Back', '返回') }).last().click();
    await expect(page).toHaveURL(/more/);
  });

  test('直达二级页链接可用（深链接刷新不白屏）', async ({ page }) => {
    await enterApp(page);
    await page.goto('/practice-calendar');
    await expect(page).toHaveURL(/practice-calendar/);
    await expect(page.getByText(/Check-in calendar|打卡日历/)).toBeVisible();
  });

  test('未知路由给出兜底页，而不是空白', async ({ page }) => {
    await enterApp(page);
    await page.goto('/this-route-does-not-exist');
    const body = await page.locator('body').innerText();
    expect(body.trim().length).toBeGreaterThan(0);
    expect(body).toMatch(/Unmatched Route|could not be found|页面不存在/i);
  });
});
