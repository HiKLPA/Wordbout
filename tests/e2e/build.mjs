import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * 构建端到端测试用的 web 产物。
 *
 * 为什么不用固定的 `.e2e-web`：`expo export` 每次运行前都会把输出目录整个删掉，
 * 而 60+ 个文件的一次性删除会被沙箱的批量删除保护拦下（也容易误删别的东西）。
 * 所以每次导出到一个**全新的临时目录**，`server.mjs` 自动认最新的那一份：
 *
 *     node tests/e2e/build.mjs      # 导出
 *     node tests/e2e/server.mjs     # 起服务（自动挑最新产物）
 *
 * 需要指定目录时传参或给 `E2E_WEB_DIR`，两边行为一致。
 */
const explicit = process.argv[2] ?? process.env.E2E_WEB_DIR;
const outDir = explicit
  ? path.resolve(explicit)
  : path.join(os.tmpdir(), `wb-e2e-web-${Date.now().toString(36)}`);

const cli = path.join(process.cwd(), 'node_modules', 'expo', 'bin', 'cli');
if (!fs.existsSync(cli)) {
  console.error(`找不到 expo cli：${cli}（先 npm install）`);
  process.exit(1);
}

console.log(`导出到 ${outDir}`);
const run = spawnSync(process.execPath, [cli, 'export', '--platform', 'web', '--output-dir', outDir], {
  stdio: 'inherit',
});

if (run.status !== 0) process.exit(run.status ?? 1);
console.log(`\n产物就绪：E2E_WEB_DIR=${outDir}`);
