import { expect, test } from '@playwright/test';
import { bi, collectPageErrors, enterApp, goTab, tabButton } from './helpers';

/**
 * 鲁棒性：坏输入、坏存储、越权直达、连点。
 * 这一组用例对应的都是「用户不会故意做，但一定会发生」的场景。
 */
test.describe('异常输入与异常状态', () => {
  test('本地存储被写坏（非法 JSON）时仍能启动', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('wordbout:v1:state', '{ this is not json'));
    const errors = collectPageErrors(page);

    await page.goto('/');
    await expect(page).toHaveURL(/onboarding/);
    await expect(page.getByRole('button', { name: bi('Accept the privacy policy and continue', '同意隐私政策并继续') })).toBeVisible();
    expect(errors.filter((e) => /JSON|parse/i.test(e))).toEqual([]);
  });

  test('存储被写坏时原文留档，不静默丢弃', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('wordbout:v1:state', '{ broken payload'));
    await page.goto('/');
    await expect(page).toHaveURL(/onboarding/);
    // 解析失败不能只剩「从头开始」：坏掉的原文另存一份，才有可能人工捞回
    const backup = await page.evaluate(() => window.localStorage.getItem('wordbout:v1:state:corrupt'));
    expect(backup).toBe('{ broken payload');
  });

  test('存储里是数组 / 字符串等错误形状时不崩', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('wordbout:v1:state', '[]'));
    const errors = collectPageErrors(page);
    await page.goto('/');
    await expect(page).toHaveURL(/onboarding/);
    expect(errors).toEqual([]);
  });

  test('旧版本数据缺字段时按默认值补齐（迁移可重入）', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'wordbout:v1:state',
        JSON.stringify({ version: 0, settings: { onboarded: true, privacyAccepted: true } }),
      );
    });
    await page.goto('/');
    await expect(tabButton(page, 'practice')).toBeVisible();
    // 缺 streak.makeup 时不应崩（补签额度按配置兜底）
    await page.goto('/practice-calendar');
    await expect(page.getByText(bi('Check-in calendar', '打卡日历'))).toBeVisible();
  });

  test('未走引导直接访问二级页会被拉回引导页', async ({ page }) => {
    await page.goto('/analytics');
    await expect(page).toHaveURL(/onboarding/);
  });

  test('超长输入不崩，输入框内容不被截断显示异常', async ({ page }) => {
    const errors = collectPageErrors(page);
    await enterApp(page);
    await page.goto('/translate');
    const box = page.getByRole('textbox').first();
    await box.fill('a'.repeat(800));
    await expect(box).toHaveValue('a'.repeat(800));
    expect(errors).toEqual([]);
  });

  test('连点「同意」两次不会重复导航或抛错', async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto('/onboarding');
    const accept = page.getByRole('button', { name: bi('Accept the privacy policy and continue', '同意隐私政策并继续') });
    await accept.click();
    await accept.click({ force: true, timeout: 1500 }).catch(() => {});
    await expect(tabButton(page, 'home')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('反复进出同一二级页不残留（十次往返仍在设置页）', async ({ page }) => {
    await enterApp(page);
    for (let i = 0; i < 10; i += 1) {
      await page.goto('/settings');
      await expect(page).toHaveURL(/settings/);
      await page.getByRole('button', { name: bi('Back', '返回') }).last().click();
      await expect(page).not.toHaveURL(/settings/);
      await goTab(page, 'more');
    }
  });
});
