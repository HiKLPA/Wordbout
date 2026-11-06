import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

/**
 * 端到端测试用的静态服务器：只服务 expo export 出来的 web 产物。
 *
 * 两条规则：
 * - 路径无扩展名时先补 `.html`（expo 静态导出把每个路由渲染成一个 html 文件）；
 * - 都找不到时回落到 `index.html`，交给客户端的 expo-router 处理（前端路由的深链接刷新）。
 * 零依赖：测试基础设施不引第三方服务器，避免再装一个包。
 *
 * 产物目录优先级：命令行参数 → `E2E_WEB_DIR` → 临时目录里最新的 `wb-e2e-web-*` → `.e2e-web`
 * （`build.mjs` 每次导到新的临时目录，这里自动跟进，不用手工改路径）。
 */
function newestBuild() {
  const base = os.tmpdir();
  const candidates = fs
    .readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith('wb-e2e-web-'))
    .map((d) => path.join(base, d.name))
    .filter((dir) => fs.existsSync(path.join(dir, 'index.html')))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return candidates[0] ?? null;
}

const fromArg = process.argv[2] ?? process.env.E2E_WEB_DIR;
const root = path.resolve(fromArg ?? newestBuild() ?? '.e2e-web');
const port = Number(process.env.E2E_PORT ?? 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
};

function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const target = path.join(root, clean);
  if (!target.startsWith(root)) return null; // 目录穿越
  const candidates = [target, `${target}.html`, path.join(target, 'index.html')];
  for (const file of candidates) {
    try {
      if (fs.statSync(file).isFile()) return file;
    } catch {
      /* 继续试下一个候选 */
    }
  }
  return null;
}

const server = http.createServer((req, res) => {
  const file = resolveFile(req.url ?? '/') ?? path.join(root, 'index.html');
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(buf);
  });
});

server.listen(port, '127.0.0.1', () => {
  // 供 playwright 的 webServer 判断就绪
  process.stdout.write(`e2e server on http://127.0.0.1:${port} (${root})\n`);
});

if (process.env.E2E_ONESHOT === '1') {
  // 自检模式：起来就走，用来验证脚本本身
  setTimeout(() => server.close(), 300);
}
