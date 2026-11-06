import { expect, test } from '@playwright/test';
import { bi, collectPageErrors, enterApp, goTab, TAB, tabButton, translateBar } from './helpers';

/**
 * 冒烟：应用能不能起来、首屏该有的入口在不在、跑一圈有没有崩。
 * 这一层出问题，后面所有用例都没有意义，所以放在最前面。
 */
test.describe('启动与首屏', () => {
  test('首次访问进入引导页，四个入口都在', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/onboarding/);

    const entries = [
      bi('Accept the privacy policy and continue', '同意隐私政策并继续'),
      bi('Sign in by QR code', '扫码登录'),
      bi('Sign in with phone & code', '手机号验证码登录'),
      bi('Guest trial (no syncing)', '游客试用（不同步记录）'),
    ];
    for (const name of entries) {
      await expect(page.getByRole('button', { name })).toBeVisible();
    }
    // 隐私摘要必须给出可点的全文入口（FR-O-3）
    await expect(page.getByRole('link', { name: /privacy policy|隐私政策/i })).toBeVisible();
  });

  test('同意后落到主页，三个查词入口可用', async ({ page }) => {
    await enterApp(page);
    await expect(page).toHaveURL(/\/$/);

    await expect(translateBar(page)).toBeVisible();
    await expect(page.getByRole('button', { name: bi('Photo translation', '拍照翻译') })).toBeVisible();
    await expect(page.getByRole('button', { name: bi('Voice translation', '语音翻译') })).toBeVisible();
  });

  test('底栏五项齐全，顺序符合信息架构（主页 / 探索 / 课本 / 练习 / 更多）', async ({ page }) => {
    await enterApp(page);
    const labels: (keyof typeof TAB)[] = ['home', 'explore', 'textbook', 'practice', 'more'];
    for (const key of labels) {
      await expect(tabButton(page, key)).toBeVisible();
    }

    // 顺序：按屏幕上的横坐标排序后应等于设计稿顺序
    const xs = await page.evaluate(
      (names) =>
        names.map((n) => {
          const el = Array.from(document.querySelectorAll('[role="tab"]')).find((e) =>
            (e.getAttribute('aria-label') ?? '').match(new RegExp(`^(${n.join('|')})$`, 'i')),
          );
          return el ? el.getBoundingClientRect().x : -1;
        }),
      [['Home', '主页'], ['Explore', '探索'], ['Textbook', '课本'], ['Practice', '练习'], ['More', '更多']],
    );
    for (let i = 1; i < xs.length; i += 1) {
      expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    }
  });

  test('跑一圈一级页面没有未捕获异常', async ({ page }) => {
    const errors = collectPageErrors(page);
    await enterApp(page);
    for (const tab of ['explore', 'textbook', 'practice', 'more', 'home'] as const) {
      await tabButton(page, tab).click();
      await page.waitForTimeout(400);
    }
    expect(errors, `页面抛错：${errors.join(' | ')}`).toEqual([]);
  });
});
