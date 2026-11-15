import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { app } from "./app";
import { DATA_DIR } from "./store";

const PORT = Number(process.env.PORT ?? 8787);
const DIST = path.resolve("dist");

// 生产模式：同一个进程顺带托管前端构建产物，并让前端路由回退到 index.html
if (existsSync(path.join(DIST, "index.html"))) {
  app.use("/*", serveStatic({ root: "./dist" }));
  app.get("*", async c => c.html(await readFile(path.join(DIST, "index.html"), "utf8")));
}

// 只监听本机：这里保存着 API Key，不对局域网开放
serve({ fetch: app.fetch, port: PORT, hostname: "127.0.0.1" }, info => {
  console.log(`日志目录 ${DATA_DIR}/logs\nAPI 已启动  http://127.0.0.1:${info.port}   数据目录 ${DATA_DIR}`);
});
