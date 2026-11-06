import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * 单元测试只测领域层与纯函数：不加载 React Native 运行时、不碰网络。
 * `@` 别名与 tsconfig 的 paths 保持一致，被测代码不用为测试改导入方式。
 */
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(process.cwd(), 'src') },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    reporters: ['default'],
    // 领域层没有共享可变状态，但个别用例会临时改 appConfig 的档位，串行更稳
    pool: 'forks',
    fileParallelism: false,
  },
});
