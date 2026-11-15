import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { DEFAULT_MODELS, RATIOS, SIZES } from "../shared/config";
import type { DraftRec, ModelDef, NodeRec, ProjectRec, ProjectSummary } from "../shared/types";

/*
 * 落盘结构（DATA_DIR 默认是仓库下的 data/）：
 *   settings.json                      接口地址、API Key、模型列表、默认值
 *   projects/<id>/project.json         项目名与画布视角
 *   projects/<id>/nodes.json           节点元数据（位置、提示词、父子顺序……；失败的节点也在这里，带失败原因）
 *   projects/<id>/drafts.json          创作节点草稿
 *   projects/<id>/images/<nodeId>.<ext> 图片文件
 */
export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? "data");
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
export const validId = (s: unknown): s is string => typeof s === "string" && ID_RE.test(s);

/* ---------- 基础：原子写入与串行化 ---------- */
const chains = new Map<string, Promise<unknown>>();
/** 同一个 key 的操作排队执行，避免并发写 JSON 互相覆盖 */
export function serial<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const next = (chains.get(key) ?? Promise.resolve()).catch(() => undefined).then(fn);
  chains.set(key, next);
  return next;
}
async function readJson<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await readFile(file, "utf8")) as T; }
  catch (e: any) { if (e?.code === "ENOENT") return fallback; throw e; }
}
async function writeJson(file: string, data: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2));
  await rename(tmp, file);
}

/* ---------- 设置 ---------- */
export interface StoredSettings {
  baseUrl: string; apiKey: string; models: ModelDef[];
  defaultModel: string; defaultRatio: string; defaultSize: string;
}
const settingsFile = () => path.join(DATA_DIR, "settings.json");

export function normalizeSettings(s: Partial<StoredSettings>): StoredSettings {
  const models = (Array.isArray(s.models) ? s.models : [])
    .filter(m => m && typeof m.id === "string" && m.id.trim() && m.id.length <= 120)
    .map(m => ({ id: m.id.trim(), price: Number.isFinite(Number(m.price)) && Number(m.price) >= 0 ? Number(m.price) : 0 }));
  const unique = models.filter((m, i) => models.findIndex(x => x.id === m.id) === i);
  const list = unique.length ? unique : DEFAULT_MODELS.map(m => ({ ...m }));
  return {
    baseUrl: typeof s.baseUrl === "string" ? s.baseUrl.trim().replace(/\/+$/, "") : "",
    apiKey: typeof s.apiKey === "string" ? s.apiKey.trim() : "",
    models: list,
    defaultModel: list.some(m => m.id === s.defaultModel) ? s.defaultModel! : list[0].id,
    defaultRatio: RATIOS.includes(s.defaultRatio ?? "") ? s.defaultRatio! : "1:1",
    defaultSize: SIZES.includes(s.defaultSize ?? "") ? s.defaultSize! : "1K"
  };
}
export const loadSettings = async () => normalizeSettings(await readJson<Partial<StoredSettings>>(settingsFile(), {}));
export const saveSettings = (s: StoredSettings) => serial("settings", async () => { await writeJson(settingsFile(), s); return s; });

/* ---------- 项目 ---------- */
const projDir = (id: string) => path.join(DATA_DIR, "projects", id);
const projFile = (id: string) => path.join(projDir(id), "project.json");
const nodesFile = (id: string) => path.join(projDir(id), "nodes.json");
const imgDir = (id: string) => path.join(projDir(id), "images");

export async function getProject(id: string): Promise<ProjectRec | null> {
  return readJson<ProjectRec | null>(projFile(id), null);
}
export async function listProjects(): Promise<ProjectSummary[]> {
  let ids: string[] = [];
  try { ids = (await readdir(path.join(DATA_DIR, "projects"), { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name); }
  catch (e: any) { if (e?.code !== "ENOENT") throw e; }
  const out: ProjectSummary[] = [];
  for (const id of ids) {
    const p = await getProject(id); if (!p) continue;
    out.push({ ...p, count: (await readJson<NodeRec[]>(nodesFile(id), [])).filter(n => n.file).length });
  }
  return out.sort((a, b) => a.createdAt - b.createdAt);
}
export function createProject(name: string): Promise<ProjectRec> {
  const id = "p" + randomBytes(5).toString("hex"), now = Date.now();
  const p: ProjectRec = { id, name, createdAt: now, updatedAt: now, view: { x: 0, y: 0, s: 0 } };
  return serial("proj:" + id, async () => { await writeJson(projFile(id), p); return p; });
}
export function updateProject(id: string, patch: { name?: string; view?: ProjectRec["view"] }) {
  return serial("proj:" + id, async () => {
    const p = await getProject(id); if (!p) return null;
    if (patch.name) p.name = patch.name;
    if (patch.view) p.view = patch.view;
    p.updatedAt = Date.now();
    await writeJson(projFile(id), p); return p;
  });
}
export function deleteProject(id: string) {
  return serial("proj:" + id, () => rm(projDir(id), { recursive: true, force: true }));
}

/* ---------- 节点与图片 ---------- */
export const listNodes = (pid: string) => readJson<NodeRec[]>(nodesFile(pid), []);

const FILE_RE = /^[A-Za-z0-9_-]+\.(png|jpg|webp|svg)$/;
/** trusted 仅供生成流程使用：来自前端的请求不能指定 file，否则可借此读取任意路径 */
export function upsertNodes(pid: string, recs: NodeRec[], trusted = false) {
  return serial("nodes:" + pid, async () => {
    const all = await listNodes(pid), byId = new Map(all.map(n => [n.id, n]));
    for (const r of recs) {
      const old = byId.get(r.id), file = trusted ? r.file : old?.file, kind = trusted ? r.kind : old?.kind;
      // 重新生成会换掉图片：扩展名不同时，旧文件不能留着
      if (trusted && old?.file && file && old.file !== file) await rm(path.join(imgDir(pid), old.file), { force: true });
      byId.set(r.id, { ...r, projectId: pid, file: file && FILE_RE.test(file) ? file : undefined, kind });
    }
    await writeJson(nodesFile(pid), [...byId.values()]);
  });
}
export function deleteNodes(pid: string, ids: string[]) {
  return serial("nodes:" + pid, async () => {
    const all = await listNodes(pid), gone = new Set(ids);
    for (const n of all) if (gone.has(n.id) && n.file) await rm(path.join(imgDir(pid), n.file), { force: true });
    // 子节点的参考链里去掉被删节点
    const rest = all.filter(n => !gone.has(n.id)).map(n => n.parents.some(p => gone.has(p)) ? { ...n, parents: n.parents.filter(p => !gone.has(p)) } : n);
    await writeJson(nodesFile(pid), rest);
  });
}
/* ---------- 创作节点草稿 ---------- */
const draftsFile = (id: string) => path.join(projDir(id), "drafts.json");
export const listDrafts = (pid: string) => readJson<DraftRec[]>(draftsFile(pid), []);
export const saveDrafts = (pid: string, drafts: DraftRec[]) => serial("drafts:" + pid, () => writeJson(draftsFile(pid), drafts));

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };
export const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml" };

/** 写入图片文件，返回文件名 */
export async function saveImage(pid: string, nid: string, buf: Buffer, mime: string): Promise<string> {
  const file = `${nid}.${EXT[mime] ?? "png"}`;
  await mkdir(imgDir(pid), { recursive: true });
  await writeFile(path.join(imgDir(pid), file), buf);
  return file;
}
export async function readImage(pid: string, nid: string): Promise<{ buf: Buffer; mime: string } | null> {
  const n = (await listNodes(pid)).find(x => x.id === nid);
  if (!n?.file || !FILE_RE.test(n.file)) return null;
  try {
    const buf = await readFile(path.join(imgDir(pid), n.file));
    return { buf, mime: MIME[n.file.split(".").pop()!] ?? "application/octet-stream" };
  } catch { return null; }
}
