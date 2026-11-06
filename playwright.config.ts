import { defineConfig } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

/**
 * 产物目录放到系统临时目录：仓库里不留截图 / trace / 报告，
 * 也避免每次重跑要先清理项目内目录（沙箱对删除操作是拦的）。
 */
const ARTIFACTS = path.join(os.tmpdir(), 'wb-e2e');

/**
 * 端到端测试跑在 `expo export` 出来的 web 产物上（真机外壳之外最接近用户的一组运行环境）。
 *
 * 前置：`npm run e2e:build` 生成 web 产物（导到系统临时目录，脚本会自动挑最新的一份）；
 * `webServer` 自己起静态服务器。
 * 浏览器：默认用 Playwright 自带的 chromium；机器上只装了 Edge / Chrome 时设 `E2E_CHANNEL=msedge`
 * 或 `E2E_CHANNEL=chrome` 复用系统浏览器（CI 上仍建议 `npx playwright install chromium`）。
 */
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  /* 静态服务器只有一个、Web 端渲染较重：串行跑，测出来的时间是可用参考值 */
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  outputDir: path.join(ARTIFACTS, 'artifacts'),
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(ARTIFACTS, 'report'), open: 'never' }],
    ['json', { outputFile: path.join(ARTIFACTS, 'report.json') }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173',
    viewport: { width: 390, height: 844 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(process.env.E2E_CHANNEL ? { channel: process.env.E2E_CHANNEL } : {}),
  },
  webServer: {
    command: 'node tests/e2e/server.mjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
