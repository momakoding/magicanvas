import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

/**
 * 简易日志：同时写控制台和 {DATA_DIR}/logs/server-YYYY-MM-DD.log（每行一条 JSON）。
 * 不记录 API Key 和提示词全文；写文件失败时只退回控制台，不影响请求。
 */
type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const dataDir = () => path.resolve(process.env.DATA_DIR ?? "data");
const minLevel = (): number => ORDER[(process.env.LOG_LEVEL as Level) in ORDER ? (process.env.LOG_LEVEL as Level) : "info"];

let dirReady: Promise<unknown> | null = null;
let fileFailed = false;

function write(level: Level, scope: string, msg: string, extra?: Record<string, unknown>) {
  if (ORDER[level] < minLevel()) return;
  const now = new Date();
  const rec = { time: now.toISOString(), level, scope, msg, ...extra };
  const text = `${rec.time} ${level.toUpperCase().padEnd(5)} [${scope}] ${msg}` + (extra ? " " + JSON.stringify(extra) : "");
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(text);
  if (fileFailed) return;
  const dir = path.join(dataDir(), "logs");
  dirReady ??= mkdir(dir, { recursive: true });
  const file = path.join(dir, `server-${now.toISOString().slice(0, 10)}.log`);
  dirReady
    .then(() => appendFile(file, JSON.stringify(rec) + "\n", "utf8"))
    .catch((e) => {
      fileFailed = true;
      console.error("日志文件写入失败，之后只输出到控制台：", e);
    });
}

export function createLogger(scope: string) {
  return {
    debug: (msg: string, extra?: Record<string, unknown>) => write("debug", scope, msg, extra),
    info: (msg: string, extra?: Record<string, unknown>) => write("info", scope, msg, extra),
    warn: (msg: string, extra?: Record<string, unknown>) => write("warn", scope, msg, extra),
    error: (msg: string, extra?: Record<string, unknown>) => write("error", scope, msg, extra),
  };
}
