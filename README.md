# Wordbout

面向中文母语备考人群的英语学习应用。查词翻译、九种题型的练习、大模型评分、能力趋势放在同一条链路上，用户不必在词典、背词、写作批改、数据统计四个工具之间搬数据。

Expo SDK 54 · React Native 0.81 · React 19 · TypeScript 5.9 · expo-router 6

## 功能

- 五个一级页面：主页、探索、课本、练习、更多。
- 九种题型：听写、听力理解、作句、作文、词与短语、句与段、短文、阅读理解、翻译，覆盖听、写、说、读、译五个板块。
- 五档题库：日常、CET4、CET6、IELTS、TOEFL。
- 中英互译：内置 ECDICT 与 CC-CEDICT 离线词典，整句译文走大模型，另有 Wiktionary 在线英英。
- 大模型评分：给出总分、分项得分、问题定位与可执行建议四块内容，20 秒提示、30 秒兜底。
- 能力趋势：今日、近 7 天、近 30 天、近 3 月四档，按日、周、月聚合，含当前水平分档。
- 收藏与题集、写作本、断点续做、三语界面（英文、简体中文、繁体中文）。
- 使用数据统计：会话、页面停留（平均 / 占比 / 有效停留率）、点击排行与事件流水，默认只存本机，可一键复制 JSON。
- 每日练习提醒：本机通知，当天已达标就不发；权限被拒只在设置页给说明，不反复弹窗。
- 练习日历：本周 / 本月 / 今年三档打卡标记，可对漏掉的日期补签（每周 1 次免费额度）。

## 运行

```bash
npm install
cp .env.example .env     # 填入大模型密钥（可选，缺省走离线词条）
npm start                # Expo Go 扫码；或 npm run web
```

## 目录

| 路径 | 职责 |
| --- | --- |
| `src/app` | 路由与页面，文件即路由（24 个页面路由） |
| `src/components` | 展示组件与图表 |
| `src/domain` | 纯逻辑：统计口径、评分、日期、收藏 |
| `src/data` | 词库题库、四部词典、大模型与翻译调用 |
| `src/config` | 配置中心：题库、门槛、超时、模型名 |
| `src/theme` | 设计令牌、字阶、中英混排字体分流 |
| `src/i18n` | 三语词表与漏译审计 |
| `src/lib` | 本地持久化、埋点采集与队列、本机通知排程 |
| `src/store` | 全局状态与领域动作 |
| `tests/unit` | 领域逻辑单元测试（Vitest） |
| `tests/e2e` | 浏览器端到端、性能测量与测试服务器（Playwright） |
| `docs` | 需求规格说明书、测试过程记录 |
| `output` | PRD 源文件与项目复盘 |

## 工程规范

```bash
npm run typecheck    # 类型检查
npm run lint         # 代码规范
npm run i18n:check   # 词条构建与漏译审计，未收录应为 0
npm run dict:build   # 重建词典数据（源数据约 30 MB，--no-download 走缓存）
npm run fonts:subset # 字体子集化，同时产出原生用的 ttf 与 web 用的 woff2
```

本地化以中文原文为键，英文词表在 `src/i18n/en`，繁体由 OpenCC 生成不手改。词库、题库、门槛、超时与模型名集中在 `src/config/appConfig.ts`，改参数不需要发版。

## 测试

```bash
npm run test:unit                          # 领域逻辑单测，120 条，约 3s
npm run e2e:build                          # 导出 web 产物到临时目录
E2E_CHANNEL=msedge npm run test:e2e        # 浏览器端到端，38 条，约 50s
E2E_CHANNEL=msedge node tests/e2e/perf.mjs # 性能快照（首屏、传输量、切页、提交）
```

单元测试用 Vitest 直接验证 `src/domain` 的纯函数；端到端用 Playwright 跑在 `expo export --platform web` 的产物上，选择器只用可访问名，文案匹配同时接受中英文。机器上没装 Playwright 自带 chromium 时用 `E2E_CHANNEL=msedge` 复用系统 Edge。完整测试过程、缺陷清单与优化对比见 `docs/testing.md`。

## 文档

- `docs/SRS.md` 需求规格说明书全文，九章，每条功能含验收标准。
- `docs/testing.md` 测试过程、缺陷清单与性能优化记录。
- `output/prd-wordbout` 产品需求文档的 HTML 源文件与排版脚本。
- `output/interview-doc` 项目成熟度复盘与面试准备手册。

## 已知限制

- 数据仅保存在设备本地，暂无服务端同步，跨设备不通用。
- 大模型密钥通过构建期环境变量注入，正式发布应下沉到服务端做转发、限流与审计。
- 原生端（iOS / Android）尚无自动化测试，端到端只覆盖 web 产物；持续集成未接入。
- 评分仍是本地启发式引擎，接口形态与大模型一致但分数只能看趋势，不作权威判分。
- 埋点默认只写本机（`appConfig.analytics.endpoint` 为空即不上报），没有服务端看板。
- 提醒是本机通知，排程在客户端重算：一次只排未来 7 天，回到前台或状态变化时重排；网页版不支持本地通知。
- 补签只补签到记录，不补练习时长与任务数，学习统计仍以作答明细为准。
- 适配 iOS 13 及以上、Android 8.0 及以上。
