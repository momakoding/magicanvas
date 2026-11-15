import { Hono } from "hono";
import { RATIOS, SIZES, validSize } from "../shared/config";
import { GEN_ERROR_KINDS, type ApiErrorBody, type DraftRec, type GenerateBody, type GenerateResult, type NodeRec, type SettingsDTO } from "../shared/types";
import { detectModels, GenError, generateImages, type Img } from "./generate";
import { createLogger } from "./logger";
import * as store from "./store";

const log = createLogger("api");

const bad = (msg: string) => Object.assign(new Error(msg), { status: 400 });
const num = (v: unknown, name: string) => {
  if (typeof v !== "number" || !Number.isFinite(v)) throw bad(`${name} 不是有效数字`);
  return v;
};
const str = (v: unknown, name: string, max: number) => {
  if (typeof v !== "string" || !v.trim() || v.length > max) throw bad(`${name} 不合法`);
  return v;
};

const toDTO = (s: store.StoredSettings): SettingsDTO => ({
  baseUrl: s.baseUrl,
  apiKeySet: !!s.apiKey,
  models: s.models,
  defaultModel: s.defaultModel,
  defaultRatio: s.defaultRatio,
  defaultSize: s.defaultSize,
});

/** 校验并整理前端提交的节点，丢弃多余字段 */
function cleanNode(pid: string, r: any): NodeRec {
  if (!store.validId(r?.id)) throw bad("节点 id 不合法");
  if (!RATIOS.includes(r.ratio)) throw bad("画幅不合法");
  if (!validSize(r.size ?? "1K")) throw bad("尺寸不合法");
  const parents: unknown[] = Array.isArray(r.parents) ? r.parents : [];
  if (parents.length > 20 || !parents.every(store.validId)) throw bad("参考节点不合法");
  return {
    id: r.id,
    projectId: pid,
    x: num(r.x, "x"),
    y: num(r.y, "y"),
    w: num(r.w, "w"),
    h: num(r.h, "h"),
    ratio: r.ratio,
    size: r.size ?? "1K",
    model: str(r.model, "模型", 120),
    prompt: str(r.prompt, "提示词", 4000),
    parents: parents as string[],
    fav: !!r.fav,
    t: num(r.t, "t"),
    cost: Math.max(0, num(r.cost, "cost")),
    failed: typeof r.failed === "string" && r.failed ? r.failed.slice(0, 2000) : undefined,
    failKind: GEN_ERROR_KINDS.includes(r.failKind) ? r.failKind : undefined,
    failDetail: typeof r.failDetail === "string" && r.failDetail ? r.failDetail.slice(0, 20000) : undefined,
  };
}

/** 校验并整理前端提交的创作节点草稿 */
function cleanDraft(r: any): DraftRec {
  if (!store.validId(r?.id)) throw bad("草稿 id 不合法");
  const inputs: unknown[] = Array.isArray(r.inputs) ? r.inputs : [];
  if (inputs.length > 8 || !inputs.every(store.validId)) throw bad("草稿的参考图不合法");
  const s = (v: unknown, max: number, fallback: string) => (typeof v === "string" && v.length <= max ? v : fallback);
  return {
    id: r.id, x: num(r.x, "x"), y: num(r.y, "y"), inputs: inputs as string[],
    text: s(r.text, 4000, ""), model: s(r.model, 120, ""), ratio: s(r.ratio, 16, "auto"), size: s(r.size, 16, "1K"),
  };
}

const api = new Hono();
api.get("/health", (c) => c.json({ ok: true, dataDir: store.DATA_DIR }));

/* ---- 设置 ---- */
api.get("/settings", async (c) => c.json(toDTO(await store.loadSettings())));
api.put("/settings", async (c) => {
  const body: any = await c.req.json().catch(() => null);
  if (!body) throw bad("请求体不是 JSON");
  const cur = await store.loadSettings();
  const base = String(body.baseUrl ?? "").trim();
  if (base && !/^https?:\/\//i.test(base)) throw bad("基地址需要以 http:// 或 https:// 开头");
  if (!Array.isArray(body.models) || !body.models.length) throw bad("至少需要一个模型");
  const next = store.normalizeSettings({
    ...body,
    apiKey: typeof body.apiKey === "string" ? body.apiKey : cur.apiKey,
  });
  return c.json(toDTO(await store.saveSettings(next)));
});
api.post("/models/detect", async (c) => {
  const body: any = await c.req.json().catch(() => ({}));
  const cur = await store.loadSettings();
  const baseUrl =
    typeof body.baseUrl === "string" && body.baseUrl.trim() ? body.baseUrl : cur.baseUrl;
  const apiKey = typeof body.apiKey === "string" && body.apiKey.trim() ? body.apiKey : cur.apiKey;
  try {
    return c.json({ models: await detectModels(baseUrl, apiKey) });
  } catch (e) {
    throw bad(e instanceof Error ? e.message : String(e));
  }
});

/* ---- 项目 ---- */
api.get("/projects", async (c) => c.json(await store.listProjects()));
api.post("/projects", async (c) => {
  const body: any = await c.req.json().catch(() => ({}));
  return c.json(await store.createProject(str(body.name ?? "未命名项目", "项目名", 60).trim()));
});

/** 之后所有 /projects/:id/* 都要求项目存在，id 同时防止路径穿越 */
api.use("/projects/:id/*", async (c, next) => {
  const id = c.req.param("id");
  if (!store.validId(id) || !(await store.getProject(id)))
    return c.json({ error: "项目不存在" }, 404);
  await next();
});
api.get("/projects/:id", async (c) => {
  const id = c.req.param("id");
  if (!store.validId(id)) return c.json({ error: "项目不存在" }, 404);
  const project = await store.getProject(id);
  if (!project) return c.json({ error: "项目不存在" }, 404);
  // 没有图片但带着失败原因的节点也要返回：它们保存着用户写的提示词
  return c.json({ project, nodes: (await store.listNodes(id)).filter((n) => n.file || n.failed), drafts: await store.listDrafts(id) });
});
api.patch("/projects/:id", async (c) => {
  const id = c.req.param("id"),
    body: any = await c.req.json().catch(() => ({}));
  if (!store.validId(id)) return c.json({ error: "项目不存在" }, 404);
  const patch: { name?: string; view?: { x: number; y: number; s: number } } = {};
  if (body.name !== undefined) patch.name = str(body.name, "项目名", 60).trim();
  if (body.view)
    patch.view = { x: num(body.view.x, "x"), y: num(body.view.y, "y"), s: num(body.view.s, "s") };
  const p = await store.updateProject(id, patch);
  return p ? c.json(p) : c.json({ error: "项目不存在" }, 404);
});
api.delete("/projects/:id", async (c) => {
  const id = c.req.param("id");
  if (!store.validId(id)) return c.json({ error: "项目不存在" }, 404);
  await store.deleteProject(id);
  return c.json({ ok: true });
});

/* ---- 节点与图片 ---- */
api.put("/projects/:id/nodes", async (c) => {
  const id = c.req.param("id"),
    body: any = await c.req.json().catch(() => null);
  if (!Array.isArray(body) || body.length > 200) throw bad("请求体需要是节点数组（最多 200 个）");
  await store.upsertNodes(
    id,
    body.map((r) => cleanNode(id, r)),
  );
  return c.json({ ok: true });
});
api.put("/projects/:id/drafts", async (c) => {
  const id = c.req.param("id"),
    body: any = await c.req.json().catch(() => null);
  if (!Array.isArray(body) || body.length > 50) throw bad("请求体需要是草稿数组（最多 50 个）");
  await store.saveDrafts(id, body.map(cleanDraft));
  return c.json({ ok: true });
});
api.post("/projects/:id/nodes/delete", async (c) => {
  const id = c.req.param("id"),
    body: any = await c.req.json().catch(() => null);
  if (!Array.isArray(body?.ids) || !body.ids.every(store.validId)) throw bad("ids 不合法");
  await store.deleteNodes(id, body.ids);
  return c.json({ ok: true });
});
/* ---- 上传 ---- */
const MAX_UPLOAD = 20 * 1024 * 1024;
/** 按文件头判断类型，不信任浏览器给的 MIME；只接受 PNG / JPEG / WebP */
function sniffMime(b: Buffer): string | null {
  if (b.length > 12 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}
api.post("/projects/:id/uploads", async (c) => {
  const pid = c.req.param("id");
  if (Number(c.req.header("content-length") ?? 0) > MAX_UPLOAD + 64 * 1024) throw Object.assign(new Error("图片不能超过 20 MB"), { status: 413 });
  const form = await c.req.parseBody().catch(() => null);
  const file = form?.file;
  if (!form || !(file instanceof File)) throw bad("缺少图片文件");
  if (file.size > MAX_UPLOAD) throw Object.assign(new Error("图片不能超过 20 MB"), { status: 413 });
  const buf = Buffer.from(await file.arrayBuffer()), mime = sniffMime(buf);
  if (!mime) throw bad("只支持 PNG、JPEG、WebP 图片");

  const id = String(form.id ?? "");
  if (!store.validId(id)) throw bad("节点 id 不合法");
  const ratio = String(form.ratio ?? "");
  const size = String(form.size ?? "1K");
  if (!RATIOS.includes(ratio)) throw bad("画幅不合法");
  if (!SIZES.includes(size)) throw bad("尺寸不合法");
  const name = String(form.name ?? "").replace(/\.[^.]{1,5}$/, "").trim().slice(0, 120) || "用户图片";
  const rec: NodeRec = {
    id, projectId: pid,
    x: num(Number(form.x), "x"), y: num(Number(form.y), "y"), w: num(Number(form.w), "w"), h: num(Number(form.h), "h"),
    ratio, size, model: "upload", prompt: name, parents: [], fav: false, t: Date.now(), cost: 0, kind: "upload",
    file: await store.saveImage(pid, id, buf, mime),
  };
  await store.upsertNodes(pid, [rec], true);
  return c.json(rec);
});
api.get("/projects/:id/images/:nid", async (c) => {
  const id = c.req.param("id"),
    nid = c.req.param("nid");
  if (!store.validId(nid)) return c.json({ error: "图片不存在" }, 404);
  const img = await store.readImage(id, nid);
  if (!img) return c.json({ error: "图片不存在" }, 404);
  return new Response(new Uint8Array(img.buf), {
    headers: { "Content-Type": img.mime, "Cache-Control": "private, max-age=31536000, immutable" },
  });
});

/* ---- 生成 ---- */
api.post("/projects/:id/generate", async (c) => {
  const pid = c.req.param("id"),
    b: GenerateBody | null = await c.req.json().catch(() => null);
  if (!b) throw bad("请求体不是 JSON");
  const prompt = str(b.prompt, "提示词", 4000),
    model = str(b.model, "模型", 120);
  if (!RATIOS.includes(b.ratio)) throw bad("画幅不合法");
  if (!validSize(b.size)) throw bad("尺寸不合法");
  if (!Array.isArray(b.slots) || b.slots.length < 1 || b.slots.length > 4)
    throw bad("张数需在 1 到 4 之间");
  if (!Array.isArray(b.parentIds) || b.parentIds.length > 8 || !b.parentIds.every(store.validId))
    throw bad("参考节点不合法");
  const slots = b.slots.map((s) => ({
    id: s.id,
    x: num(s.x, "x"),
    y: num(s.y, "y"),
    w: num(s.w, "w"),
    h: num(s.h, "h"),
  }));
  if (!slots.every((s) => store.validId(s.id))) throw bad("节点 id 不合法");

  const cfg = await store.loadSettings();
  const refs: Img[] = [];
  for (const p of b.parentIds) {
    const img = await store.readImage(pid, p);
    if (img) refs.push(img);
  } // 保持传入顺序

  let result;
  try {
    result = await generateImages(cfg, {
      prompt,
      model,
      ratio: b.ratio,
      size: b.size,
      n: slots.length,
      refs,
    });
  } catch (e) {
    const g = e instanceof GenError ? e : new GenError("unknown", e instanceof Error ? e.message : String(e));
    log.error("生成失败", {
      project: pid, model, kind: g.kind, upstreamStatus: g.o.status, code: g.o.code,
      requestId: g.o.requestId, attempts: g.o.attempts ?? 1, detail: g.o.detail?.slice(0, 500),
    });
    const status = g.kind === "moderation" ? 422 : 502;
    return c.json({ error: g.message, kind: g.kind, requestId: g.o.requestId, attempts: g.o.attempts, status: g.o.status, detail: g.o.detail } satisfies ApiErrorBody, status);
  }

  const price = cfg.models.find((m) => m.id === model)?.price ?? 0,
    now = Date.now(),
    nodes: NodeRec[] = [];
  for (let i = 0; i < slots.length && i < result.images.length; i++) {
    const s = slots[i],
      img = result.images[i];
    nodes.push({
      ...s,
      projectId: pid,
      ratio: b.ratio,
      size: b.size,
      model,
      prompt,
      parents: b.parentIds,
      fav: false,
      t: now,
      cost: price,
      file: await store.saveImage(pid, s.id, img.buf, img.mime),
    });
  }
  await store.upsertNodes(pid, nodes, true);
  return c.json({ nodes, mock: result.mock } satisfies GenerateResult);
});

export const app = new Hono();
app.onError((e, c) => {
  const status = (e as { status?: number }).status ?? 500;
  if (status >= 500) log.error("未处理的服务端错误", { path: c.req.path, err: e.stack ?? String(e) });
  return c.json({ error: e.message }, status as 400 | 500);
});
app.route("/api", api);
