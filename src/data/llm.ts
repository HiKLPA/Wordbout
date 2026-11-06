import { appConfig } from '@/config/appConfig';

/**
 * 大模型调用（IF-3「大模型评分与单词解析服务」，IF-4：HTTPS + 用户可读文案）。
 *
 * 只依赖 OpenAI 兼容的 `POST {baseUrl}/chat/completions`，所以换服务商不用改业务代码：
 * 智谱 GLM-4-Flash（默认，免费额度）、硅基流动、DeepSeek、OpenRouter 等都能直接用。
 * 密钥走构建期注入的环境变量（`EXPO_PUBLIC_AI_API_KEY`），用法见项目根 `.env.example`。
 */

/**
 * 构建期注入的配置。
 * 注意：Metro 只替换 `process.env.EXPO_PUBLIC_*` **字面量**，不能改成 `process.env[name]` 这种动态取值。
 */
const ENV_API_KEY = process.env.EXPO_PUBLIC_AI_API_KEY ?? '';
const ENV_BASE_URL = process.env.EXPO_PUBLIC_AI_BASE_URL ?? '';
const ENV_MODEL = process.env.EXPO_PUBLIC_AI_MODEL ?? '';

export interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

/** 当前生效的大模型配置：环境变量优先，缺省回落到 appConfig.ai（NFR-6 配置化） */
export function llmConfig(): LlmConfig {
  return {
    apiKey: ENV_API_KEY.trim(),
    baseUrl: (ENV_BASE_URL.trim() || appConfig.ai.baseUrl).replace(/\/+$/, ''),
    model: ENV_MODEL.trim() || appConfig.ai.model,
  };
}

/** 是否已配置密钥；未配置时调用方应直接走离线兜底，不发请求 */
export function isLlmConfigured(): boolean {
  return llmConfig().apiKey.length > 0;
}

/** 失败原因（IF-4：只给用户可读文案，不把原始状态码 / 报文抛到界面上） */
export type LlmErrorCode = 'not-configured' | 'network' | 'timeout' | 'bad-response';

export class LlmError extends Error {
  readonly code: LlmErrorCode;

  constructor(code: LlmErrorCode) {
    super(code);
    this.name = 'LlmError';
    this.code = code;
  }
}

interface ChatResponse {
  choices?: { message?: { content?: unknown } }[];
}

/**
 * 一轮对话里的历史消息（`chat()` 的 `history`）。
 * 只有 `user` / `assistant` 两种角色，`system` 由 `chat()` 自己拼在最前面。
 */
export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * 请求一次对话补全，返回模型输出的纯文本；失败统一抛 `LlmError`。
 * `timeoutMs` 可覆盖默认超时（默认取 `appConfig.ai.timeoutMs`）——
 * 「AI 探索」那种要生成一长串内容的请求会单独放宽，评分仍走默认值（FR-E-15 的兜底时长不变）。
 * `history` 为之前的轮次（不含本次提问），用来做**连续对话**：
 * 拼成 system → 历史 → 本次提问，模型据此理解「再举两个例子」这类追问。
 */
export async function chat(
  prompt: string,
  system: string,
  timeoutMs = appConfig.ai.timeoutMs,
  history: readonly LlmMessage[] = [],
): Promise<string> {
  const { apiKey, baseUrl, model } = llmConfig();
  if (!apiKey) throw new LlmError('not-configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: appConfig.ai.temperature,
        messages: [
          { role: 'system', content: system },
          ...history.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: prompt },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new LlmError('network');

    const data = (await res.json()) as ChatResponse;
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) throw new LlmError('bad-response');
    return text;
  } catch (error) {
    if (error instanceof LlmError) throw error;
    if (error instanceof Error && error.name === 'AbortError') throw new LlmError('timeout');
    throw new LlmError('network');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 从模型输出里抠出 JSON 对象。
 * 大模型常把 JSON 包进 ``` 围栏、或在前后多写一句话，这里做容错：先剥围栏，再取第一个 `{` 到最后一个 `}`。
 * 解析不出对象时抛 `LlmError('bad-response')`。
 */
export function parseJsonObject(text: string): Record<string, unknown> {
  const cleaned = text
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;

  let value: unknown;
  try {
    value = JSON.parse(slice) as unknown;
  } catch {
    throw new LlmError('bad-response');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new LlmError('bad-response');
  return value as Record<string, unknown>;
}

/** 取字符串字段并去首尾空白；非字符串或空串一律回落到 fallback */
export function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

/** 取字符串数组：过滤空项、去重、限长 */
export function strList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const text = str(item);
    if (text && !out.includes(text)) out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}
