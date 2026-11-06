import { chromium } from '@playwright/test';

/**
 * 性能测量（一次性脚本）：首屏可用时间、底栏切页耗时、主流程耗时。
 * 数字用于测试报告，也是之后优化的基线。
 */
const base = 'http://127.0.0.1:4173';
const browser = await chromium.launch(process.env.E2E_CHANNEL ? { channel: process.env.E2E_CHANNEL } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();

const now = () => Date.now();

// 1) 首屏：导航开始 → 引导页按钮可点
let t0 = now();
await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: /Accept the privacy/ }).waitFor();
const firstPaint = now() - t0;

// 2) 资源体积（传输量）
const transferred = await page.evaluate(() =>
  performance.getEntriesByType('resource').reduce((acc, r) => acc + (r.transferSize || 0), 0),
);
const jsBytes = await page.evaluate(() =>
  performance
    .getEntriesByType('resource')
    .filter((r) => r.name.endsWith('.js'))
    .reduce((acc, r) => acc + (r.transferSize || 0), 0),
);

await page.getByRole('button', { name: /Accept the privacy/ }).click();
await page.waitForTimeout(600);

// 3) 底栏切页：点击 → 目标页标志物可见
async function tabTime(name, marker) {
  const t = now();
  await page.getByRole('tab', { name }).first().click();
  await marker().waitFor({ timeout: 10_000 });
  return now() - t;
}

const timings = [];
timings.push(['主页 → 课本', await tabTime(/Textbook|课本/, () => page.getByText(/STARRED|Saved words/).first())]);
timings.push(['课本 → 练习', await tabTime(/Practice|练习/, () => page.getByRole('button', { name: /goal \d+ min/ }).first())]);
timings.push(['练习 → 探索', await tabTime(/Explore|探索/, () => page.getByText(/Explore|探索/).first())]);
timings.push(['探索 → 更多', await tabTime(/More|更多/, () => page.getByRole('button', { name: /Settings|设置/ }).first())]);

// 4) 主流程：进听写 → 提交 → 出现结果
// 拆成三段看：整页重载（web 静态导出每次 goto 都要重新解析整包） / 选题库 / 抽题进作答
t0 = now();
await page.goto(`${base}/practice/dictation`);
await page.getByRole('button', { name: /CET4/ }).waitFor();
const reload = now() - t0;

t0 = now();
await page.getByRole('button', { name: /CET4/ }).click();
await page.getByRole('button', { name: /Confirm|确认/ }).last().click();
await page.getByRole('textbox').first().waitFor();
const enterQuestion = now() - t0;

t0 = now();
await page.getByRole('textbox').first().fill('abandon');
await page.getByRole('button', { name: /Confirm|确认/ }).last().click();
await page.getByRole('button', { name: /Done|完成/ }).waitFor();
const submitToResult = now() - t0;

console.log('首屏可交互(ms):', firstPaint);
console.log('资源传输(KB):', Math.round(transferred / 1024), '其中 JS(KB):', Math.round(jsBytes / 1024));
timings.forEach(([k, v]) => console.log(`${k}(ms):`, v));
console.log('进入练习页(整页重载, ms):', reload);
console.log('选题库→作答(ms):', enterQuestion);
console.log('提交→结果(ms):', submitToResult);

await browser.close();
