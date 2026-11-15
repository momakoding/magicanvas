import { hash, makeArtSvg } from "../shared/art";
import { AUTO, pixelSize } from "../shared/config";
import type { GenErrorKind } from "../shared/types";
import { createLogger } from "./logger";
import type { StoredSettings } from "./store";

const log = createLogger("generate");

export interface Img {
  buf: Buffer;
  mime: string;
}
export interface GenInput {
  prompt: string;
  model: string;
  ratio: string;
  size: string;
  n: number;
  /** 参考图，数组顺序即用户指定的融合顺序 */
  refs: Img[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 没配接口时的演示生成：延迟 1.4~2.3 秒，返回程序绘制的 SVG */
async function mockGenerate(i: GenInput): Promise<Img[]> {
  await sleep(1400 + Math.random() * 900);
  return Array.from({ length: i.n }, (_, k) => ({
    buf: Buffer.from(
      makeArtSvg(
        hash(`${i.prompt}|${i.model}|${i.ratio}|${i.refs.length}|${k}|${Math.random()}`),
        i.ratio,
      ),
    ),
    mime: "image/svg+xml",
  }));
}

async function errText(res: Response) {
  const t = (await res.text().catch(() => "")).slice(0, 300);
  return `接口返回 HTTP ${res.status}${t ? "：" + t : ""}`;
}

/** 生成失败。message 是给用户看的中文说明，detail 是上游原文，只进日志和悬停提示 */
export class GenError extends Error {
  constructor(
    public kind: GenErrorKind,
    message: string,
    public o: { status?: number; code?: string; detail?: string; requestId?: string; retryAfterMs?: number; attempts?: number } = {},
  ) {
    super(message);
  }
  get retryable() {
    return this.kind === "overloaded" || this.kind === "rate_limit" || this.kind === "network";
  }
}

const MODERATION_RE = /safety system|moderation|content[_ ]policy|safety_violations/i;

/** 把上游的非 2xx 响应归类。优先看 error.code，其次状态码，最后才看消息文字 */
async function parseHttpError(res: Response): Promise<GenError> {
  const raw = (await res.text().catch(() => "")).slice(0, 2000);
  let e: any = null;
  try { e = JSON.parse(raw)?.error; } catch { /* 不是 JSON */ }
  const code = typeof e?.code === "string" ? e.code : "",
    type = typeof e?.type === "string" ? e.type : "",
    upMsg = typeof e?.message === "string" ? e.message : raw,
    requestId = /request id:?\s*([\w-]+)/i.exec(upMsg)?.[1] ?? /req_[\w]+/.exec(upMsg)?.[0] ?? res.headers.get("x-request-id") ?? undefined,
    ra = Number(res.headers.get("retry-after")),
    o = { status: res.status, code, detail: raw, requestId, retryAfterMs: Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 30_000) : undefined };
  const s = res.status;
  if (code === "moderation_blocked" || code === "content_policy_violation" || type === "image_generation_user_error" || (s === 400 && MODERATION_RE.test(upMsg)))
    return new GenError("moderation", "内容审核拦截，请修改提示词或参考图后再试", o);
  if (s === 401 || s === 403 || code === "invalid_api_key")
    return new GenError("auth", `认证失败（HTTP ${s}），请检查 API Key 和账号权限`, o);
  if (code === "insufficient_quota" || code === "billing_hard_limit_reached" || s === 402)
    return new GenError("quota", "额度不足，请检查账户余额", o);
  if (s === 429) return new GenError("rate_limit", "请求太频繁（HTTP 429）", o);
  if (s === 502 || s === 503 || s === 504 || type === "overloaded_error" || code === "overloaded_error")
    return new GenError("overloaded", `服务繁忙（HTTP ${s}）`, o);
  if (s === 400 || s === 413 || s === 422) return new GenError("bad_request", `请求被接口拒绝（HTTP ${s}）：${upMsg.slice(0, 160)}`, o);
  return new GenError("unknown", `接口返回 HTTP ${s}${upMsg ? "：" + upMsg.slice(0, 160) : ""}`, o);
}

const RETRY_DELAYS = [2_000, 6_000, 15_000]; // 最多重试 3 次（共 4 次请求）
const jitter = (ms: number) => Math.round(ms * (0.8 + Math.random() * 0.4));

/** 对可重试的错误做指数退避（带抖动，尊重 Retry-After）。内容审核、认证、参数错误不重试 */
async function withRetry<T>(fn: () => Promise<T>, ctx: Record<string, unknown>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const e = err instanceof GenError ? err : toGenError(err);
      e.o.attempts = attempt;
      const delay = RETRY_DELAYS[attempt - 1];
      if (!e.retryable || delay === undefined) {
        log.warn("生成失败，不再重试", { ...ctx, attempt, kind: e.kind, status: e.o.status, code: e.o.code, requestId: e.o.requestId });
        throw e;
      }
      const wait = Math.max(jitter(delay), e.o.retryAfterMs ?? 0);
      log.warn("生成失败，退避后重试", { ...ctx, attempt, kind: e.kind, status: e.o.status, requestId: e.o.requestId, waitMs: wait });
      await sleep(wait);
    }
  }
}

function toGenError(err: unknown): GenError {
  if (err instanceof GenError) return err;
  const n = (err as any)?.name;
  if (n === "TimeoutError" || n === "AbortError") return new GenError("timeout", "请求超时（5 分钟），接口没有响应");
  const cause = (err as any)?.cause?.code ?? (err as any)?.cause?.message ?? (err as any)?.message;
  return new GenError("network", "连接接口失败，请检查基地址和网络", { detail: String(cause ?? err) });
}

/**
 * 按 OpenAI 兼容格式调用：
 *   无参考图 → POST {base}/images/generations（JSON）
 *   有参考图 → POST {base}/images/edits（multipart，参考图按顺序放进 image[]）
 * 返回里 b64_json 和 url 两种都处理。不同中转站细节可能不同，需要用真实接口再核对。
 */
async function remoteGenerate(cfg: StoredSettings, i: GenInput): Promise<Img[]> {
  const [w, h] = pixelSize(i.ratio, i.size),
    size = i.size === AUTO ? AUTO : `${w}x${h}`;
  const headers: Record<string, string> = { Authorization: `Bearer ${cfg.apiKey}` };
  const endpoint = i.refs.length ? "images/edits" : "images/generations";
  const ctx = { endpoint, model: i.model, size, n: i.n, refs: i.refs.length, promptLen: i.prompt.length };

  const call = async (): Promise<any> => {
    const t0 = Date.now();
    let res: Response;
    try {
      if (i.refs.length) {
        const fd = new FormData();
        fd.set("model", i.model);
        fd.set("prompt", i.prompt);
        fd.set("n", String(i.n));
        fd.set("size", size);
        i.refs.forEach((r, k) =>
          fd.append(
            "image[]",
            new Blob([new Uint8Array(r.buf)], { type: r.mime }),
            `ref-${k + 1}.${r.mime.split("/")[1] ?? "png"}`,
          ),
        );
        res = await fetch(`${cfg.baseUrl}/${endpoint}`, {
          method: "POST",
          headers,
          body: fd,
          signal: AbortSignal.timeout(300_000),
        });
      } else {
        res = await fetch(`${cfg.baseUrl}/${endpoint}`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ model: i.model, prompt: i.prompt, n: i.n, size }),
          signal: AbortSignal.timeout(300_000),
        });
      }
    } catch (err) {
      throw toGenError(err);
    }
    if (!res.ok) throw await parseHttpError(res);
    const body = await res.json().catch(() => null);
    log.info("上游请求成功", { ...ctx, status: res.status, ms: Date.now() - t0 });
    return body;
  };

  const j: any = await withRetry(call, ctx);
  const data: any[] = Array.isArray(j?.data) ? j.data : [];
  const out: Img[] = [];
  for (const d of data) {
    if (d?.b64_json) out.push({ buf: Buffer.from(d.b64_json, "base64"), mime: "image/png" });
    else if (typeof d?.url === "string") {
      const r = await fetch(d.url, { signal: AbortSignal.timeout(120_000) });
      if (!r.ok) throw new GenError("unknown", `下载生成的图片失败（HTTP ${r.status}）`, { status: r.status });
      out.push({
        buf: Buffer.from(await r.arrayBuffer()),
        mime: r.headers.get("content-type")?.split(";")[0] || "image/png",
      });
    }
  }
  if (!out.length) throw new GenError("empty", "接口返回成功，但没有可用的图片数据", { detail: JSON.stringify(j)?.slice(0, 500) });
  return out.slice(0, i.n);
}

export async function generateImages(
  cfg: StoredSettings,
  input: GenInput,
): Promise<{ images: Img[]; mock: boolean }> {
  const mock = !cfg.baseUrl || !cfg.apiKey;
  return { images: mock ? await mockGenerate(input) : await remoteGenerate(cfg, input), mock };
}

/**
 * 检测接口上的模型。兼容两种常见返回：
 *  - OpenAI 风格：GET {base}/models → { data: [{ id }] }
 *  - Gemini 风格：{ models: [{ name: "models/xxx" }] }
 */
export async function detectModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const base = baseUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) throw new Error("基地址需要以 http:// 或 https:// 开头");
  let res: Response;
  try {
    res = await fetch(base + "/models", {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e: any) {
    throw new Error(
      e?.name === "TimeoutError" ? "请求超时（15 秒）" : "无法连接到该地址，请检查基地址和网络",
    );
  }
  if (!res.ok)
    throw new Error(
      res.status === 401 || res.status === 403
        ? `认证失败（HTTP ${res.status}），请检查 API Key`
        : await errText(res),
    );
  const j: any = await res.json().catch(() => null);
  const ids: string[] = Array.isArray(j?.data)
    ? j.data.map((m: any) => String(m.id))
    : Array.isArray(j?.models)
      ? j.models.map((m: any) => String(m.name ?? m.id).replace(/^models\//, ""))
      : [];
  if (!ids.length) throw new Error("接口有响应，但没有识别到模型列表");
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}
