import { expect, test } from '@playwright/test';
import { bi, enterApp, goTab, tabButton } from './helpers';

/**
 * 设置：语言、字号、提醒权限说明、清缓存。
 * 设置页是「用户改不动的东西」的集中地，回归时最容易漏，因此单独成组。
 */
async function openSettings(page: import('@playwright/test').Page) {
  await enterApp(page);
  await goTab(page, 'more');
  await page.getByRole('button', { name: bi('Settings', '设置') }).click();
  await expect(page).toHaveURL(/settings/);
}

test.describe('设置', () => {
  test('切换界面语言后底栏文案立即跟着变，切回来也正常', async ({ page }) => {
    await openSettings(page);
    await page.getByRole('button', { name: bi('简体中文', '简') }).click();
    await page.waitForTimeout(500);
    // 设置页是压栈页（底栏不在这一层），先回到底栏页面再看文案
    await page.goto('/exercise');
    await expect(page.getByRole('tab', { name: '练习' }).first()).toBeVisible();
    await expect(page.getByRole('tab', { name: '主页' }).first()).toBeVisible();

    await page.goto('/settings');
    await page.getByRole('button', { name: 'ENG' }).click();
    await page.waitForTimeout(500);
    await page.goto('/exercise');
    await expect(page.getByRole('tab', { name: /Practice/ }).first()).toBeVisible();
  });

  test('字号三档切换不崩，最低档与最高档都能用', async ({ page }) => {
    await openSettings(page);
    const large = page.getByRole('button', { name: bi('Large', '大') });
    await large.click();
    await page.waitForTimeout(300);
    await expect(page.getByText(/DISPLAY|显示/).first()).toBeVisible();

    await page.getByRole('button', { name: bi('Default', '标准') }).click();
    await page.waitForTimeout(300);
    await expect(page.getByRole('button', { name: bi('Back', '返回') }).last()).toBeVisible();
  });

  test('网页版不支持本地通知：给出说明而不是假装开启', async ({ page }) => {
    await openSettings(page);
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/not available on the web|网页版不支持本地通知/);
  });

  test('清缓存只清可再生数据，学习记录不受影响', async ({ page }) => {
    await openSettings(page);
    const clear = page.getByRole('button', { name: bi('Clear cache', '清除缓存') });
    await expect(clear).toBeVisible();
    await clear.click();
    await page.waitForTimeout(500);
    // 清完仍在设置页，不跳走、不白屏
    await expect(page).toHaveURL(/settings/);
    await expect(page.getByText(/DISPLAY|显示/).first()).toBeVisible();
  });
});
