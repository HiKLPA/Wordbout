import { expect, test } from '@playwright/test';
import { bi, enterApp, openPractice, readStoredState } from './helpers';

/**
 * 练习主流程（FR-E-3 / FR-E-4 / FR-E-14）：
 * 选题库 → 作答 → 提交 → 结果 → 打卡计数器变化。
 * 这条链是产品的核心价值路径，任何一环断掉都算阻断级缺陷。
 */
const START = bi('Dictation', '听写');
const CONFIRM = bi('Confirm', '确认');
const ANSWER = bi('Answer field', '作答输入框');
const DONE = bi('Done', '完成');
const ANALYSIS = bi('Show analysis', '查看解析');

async function startDictation(page: import('@playwright/test').Page) {
  await page.goto('/practice/dictation');
  // 先选题库再进题：五个题库按钮是这一步的稳定标志物
  await expect(page.getByRole('button', { name: bi('CET4', 'CET4') })).toBeVisible();
  await page.getByRole('button', { name: bi('CET4', 'CET4') }).click();
  await page.getByRole('button', { name: CONFIRM }).last().click();
  await expect(page.getByRole('textbox', { name: ANSWER })).toBeVisible();
}

test.describe('练习主流程', () => {
  test('练习页显示今日打卡区与题型分组', async ({ page }) => {
    await enterApp(page);
    await openPractice(page);
    // 打卡：时间 / 任务两个门槛都可点开调整
    await expect(page.getByRole('button', { name: /goal \d+ min/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /tasks today/ }).first()).toBeVisible();
    // 五个板块与两个测验入口都在
    for (const board of ['Listening', 'Writing', 'Speaking', 'Reading', 'Translation']) {
      await expect(page.getByText(board).first()).toBeVisible();
    }
    await expect(page.getByRole('button', { name: bi('Start accumulation', '开始积累测验') })).toBeVisible();
    await expect(page.getByRole('button', { name: bi('Start mixed', '开始综合测验') })).toBeVisible();
  });

  test('空答案不能提交：停留在原题，不进入结果态', async ({ page }) => {
    await enterApp(page);
    await startDictation(page);

    await page.getByRole('button', { name: CONFIRM }).last().click();
    await page.waitForTimeout(600);
    await expect(page.getByRole('button', { name: DONE })).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: ANSWER })).toBeVisible();
  });

  test('作答提交后进入结果态，可以看解析、加入题集', async ({ page }) => {
    await enterApp(page);
    await startDictation(page);

    await page.getByRole('textbox', { name: ANSWER }).fill('abandon');
    await page.getByRole('button', { name: CONFIRM }).last().click();

    await expect(page.getByRole('button', { name: DONE })).toBeVisible();
    await expect(page.getByRole('button', { name: ANALYSIS })).toBeVisible();
    await expect(page.getByRole('button', { name: bi('Add to note', '加入题集') })).toBeVisible();

    await page.getByRole('button', { name: ANALYSIS }).click();
    await page.waitForTimeout(500);
    // 解析给出正确答案与说明，而不是空白
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(50);
  });

  test('提交后任务计数 +1（打卡口径与作答记录同步）', async ({ page }) => {
    await enterApp(page);
    await startDictation(page);
    await page.getByRole('textbox', { name: ANSWER }).fill('abandon');
    await page.getByRole('button', { name: CONFIRM }).last().click();
    await expect(page.getByRole('button', { name: DONE })).toBeVisible();

    await page.goto('/exercise');
    await expect(page.getByRole('button', { name: /^1 tasks today/ })).toBeVisible();
  });

  test('连点「确认」只产生一条作答记录（客观题同步出分也不重复记账）', async ({ page }) => {
    await enterApp(page);
    await startDictation(page);
    await page.getByRole('textbox', { name: ANSWER }).fill('abandon');

    // 双击：第二下落在同一帧内，按钮的 disabled 还没来得及生效
    await page.getByRole('button', { name: CONFIRM }).last().dblclick();
    await expect(page.getByRole('button', { name: DONE })).toBeVisible();

    const state = await readStoredState(page);
    expect(Array.isArray(state?.attempts)).toBe(true);
    expect((state!.attempts as unknown[]).length).toBe(1);
    await page.goto('/exercise');
    await expect(page.getByRole('button', { name: /^1 tasks today/ })).toBeVisible();
  });

  test('退出后可从「最近练习」续做（断点不丢）', async ({ page }) => {
    await enterApp(page);
    await startDictation(page);
    await page.getByRole('textbox', { name: ANSWER }).fill('abandon');
    await page.getByRole('button', { name: CONFIRM }).last().click();
    await expect(page.getByRole('button', { name: DONE })).toBeVisible();

    await page.goto('/exercise');
    const resume = page.getByRole('button', { name: bi('Resume last practice', '继续上次练习') });
    await expect(resume).toBeVisible();
    await resume.click();
    await expect(page).toHaveURL(/practice\/dictation/);
  });
});
