import { reactive, watch } from "vue";
import { AUTO, RATIOS, imageNodeSize, nodeSize, ratioWH } from "@shared";
import type { GenErrorKind, GenerateResult, NodeRec, ProjectRec, ProjectSummary, SettingsDTO, SettingsInput } from "@shared";
import { api, ApiError } from "@/api";
import { askConfirm } from "./dialogs";
import { text } from "@/texts";

/** 画布上的节点。pending 表示正在生成，还没有图片 */
export interface NodeView extends NodeRec { pending?: boolean; /** 生成失败的原因；非空表示失败 */ failed?: string; /** 失败归类，见 GenErrorKind */ failKind?: GenErrorKind; /** 完整错误信息，点“查看详情”显示 */ failDetail?: string }
type View = ProjectRec["view"];
/** 创作节点：多张参考图（有序）加一段文字，生成后的图连回这些参考图 */
export interface Draft { id: string; x: number; y: number; inputs: string[]; text: string; model: string; ratio: string; size: string }
export const DRAFT_W = 272;
/** 连线在创作节点左侧的接入点，距节点顶部的固定偏移 */
export const DRAFT_ANCHOR = 34;
export const isDraftId = (id: string) => studio.drafts.some(d => d.id === id);

const LAST_KEY = "ai-studio.project";

export const studio = reactive({
  ready: false,
  fatal: "",
  settings: null as SettingsDTO | null,
  projects: [] as ProjectSummary[],
  project: null as ProjectRec | null,
  nodes: [] as NodeView[],
  /** 选择顺序即融合顺序 */
  sel: [] as string[],
  view: { x: 0, y: 0, s: 1 } as View,
  animating: false,
  /** 正在从某个节点拖线：x/y 是光标的画布坐标，target 是当前悬停的可连接节点 */
  link: null as null | { from: string; x: number; y: number; target: string },
  libOpen: false,
  libTab: "gen" as "gen" | "upload",
  filter: "all" as "all" | "fav",
  query: "",
  seed: { open: false, sx: 0, sy: 0, at: { x: 0, y: 0 } },
  /** 画布上的创作节点草稿：随项目保存，生成后消失 */
  drafts: [] as Draft[],
  bar: { model: "", ratio: "1:1", size: "1K" },
  toastMsg: "",
  toastShow: false,
  /** 错误详情弹窗的内容；null 表示关闭 */
  failDetail: null as null | string
});

const uid = (p: string) => p + crypto.randomUUID().replace(/-/g, "").slice(0, 10);
let toastTimer = 0, viewTimer = 0, mockNoticed = false;

export function toast(msg: string) {
  studio.toastMsg = msg; studio.toastShow = true;
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => (studio.toastShow = false), 2400);
}

/* ---------- 查询 ---------- */
export const nodeById = (id: string) => studio.nodes.find(n => n.id === id);
export const lastSel = () => nodeById(studio.sel[studio.sel.length - 1]);
export const isReady = (n: NodeView) => !n.pending && !!n.file;
export const isUpload = (n: NodeView) => n.kind === "upload";
export const imageUrl = (n: NodeView) => (isReady(n) ? api.imageUrl(n) : "");
export const priceOf = (model: string) => studio.settings?.models.find(m => m.id === model)?.price ?? 0;
export const projectCost = () => studio.nodes.filter(isReady).reduce((a, n) => a + n.cost, 0);
export const isFiltering = () => !!studio.query || studio.filter === "fav";
export const matches = (n: NodeView) => (studio.filter === "all" || n.fav) && (!studio.query || n.prompt.includes(studio.query));

/* ---------- 视角 ---------- */
export function setView(view: View, save = true) {
  studio.view = view;
  if (!save) return;
  clearTimeout(viewTimer);
  viewTimer = window.setTimeout(flushView, 500);
}
async function flushView() {
  clearTimeout(viewTimer);
  if (studio.project) await api.updateProject(studio.project.id, { view: { ...studio.view } }).catch(() => undefined);
}
export function animateTo(view: View) {
  studio.animating = true; setView(view);
  setTimeout(() => (studio.animating = false), 480);
}
/** 视图变换矩阵：画布坐标 → 屏幕坐标 = 平移 + 缩放 */
const viewMatrix = (v: View = studio.view) => new DOMMatrix().translate(v.x, v.y).scale(v.s);
/** 屏幕坐标 → 画布坐标 */
export function toWorld(px: number, py: number, v: View = studio.view) {
  const p = viewMatrix(v).inverse().transformPoint(new DOMPoint(px, py));
  return { x: p.x, y: p.y };
}
/** 画布坐标 → 屏幕坐标 */
export function toScreen(wx: number, wy: number, v: View = studio.view) {
  const p = viewMatrix(v).transformPoint(new DOMPoint(wx, wy));
  return { x: p.x, y: p.y };
}
/** 返回一个新视图：把画布上的 (wx, wy) 摆到屏幕中心，offX/offY 再做像素级偏移 */
export function centerOn(wx: number, wy: number, s: number, offX = 0, offY = 0): View {
  return { s, x: innerWidth / 2 + offX - wx * s, y: innerHeight / 2 + offY - wy * s };
}
export function fit() {
  if (!studio.nodes.length) return animateTo({ x: innerWidth / 2, y: innerHeight / 2, s: 1 });
  // 一次遍历求所有节点的包围盒
  const box = studio.nodes.reduce((b, n) => ({
    x0: Math.min(b.x0, n.x), y0: Math.min(b.y0, n.y),
    x1: Math.max(b.x1, n.x + n.w), y1: Math.max(b.y1, n.y + n.h)
  }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
  const pad = 130, s = Math.min(1.2, (innerWidth - pad * 2) / (box.x1 - box.x0), (innerHeight - pad * 2 - 80) / (box.y1 - box.y0));
  animateTo(centerOn((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, s, 0, -10));
}
export function focusNode(n: NodeView) {
  const s = Math.max(studio.view.s, 0.9);
  animateTo(centerOn(n.x + n.w / 2, n.y + n.h / 2, s, studio.libOpen ? -180 : 0, -40));
}

/* ---------- 选择 ---------- */
export function resetBar() {
  const first = nodeById(studio.sel[0]), settings = studio.settings!;
  studio.bar.model = settings.defaultModel;
  if (studio.bar.ratio !== "auto") studio.bar.ratio = first ? first.ratio : settings.defaultRatio;   // 选了「自动」就一直保持
  studio.bar.size = first?.size && first.size !== AUTO ? first.size : settings.defaultSize;
}
export function setSel(ids: string[]) {
  studio.sel = ids.filter(id => { const n = nodeById(id); return n && isReady(n); });
  resetBar();
}

/* ---------- 项目 ---------- */
async function refreshProjects() { studio.projects = await api.projects(); }

export async function init() {
  try {
    studio.settings = await api.settings();
    await refreshProjects();
    if (!studio.projects.length) await api.createProject("我的第一个项目");
    await refreshProjects();
    const last = localStorage.getItem(LAST_KEY);
    await openProject(studio.projects.find(p => p.id === last)?.id ?? studio.projects[0].id);
    studio.ready = true;
  } catch (e) {
    studio.fatal = e instanceof Error ? e.message : String(e);
  }
}

/* ---------- 创作节点草稿：随项目保存，刷新或切换项目都不会丢 ---------- */
let draftsPid = "", draftsSaved = "[]", draftTimer = 0;
const draftRecs = (): Draft[] => studio.drafts.map(d => ({ ...d, inputs: [...d.inputs] }));
export async function flushDrafts(keepalive = false) {
  clearTimeout(draftTimer);
  if (!draftsPid) return;
  const list = draftRecs(), snap = JSON.stringify(list);
  if (snap === draftsSaved) return;
  try { await api.putDrafts(draftsPid, list, keepalive); draftsSaved = snap; }
  catch (e) { toast("草稿保存失败：" + (e as Error).message); }
}
watch(() => JSON.stringify(studio.drafts), () => {
  clearTimeout(draftTimer);
  draftTimer = window.setTimeout(() => void flushDrafts(), 400);
});
addEventListener("pagehide", () => void flushDrafts(true));

export async function openProject(id: string) {
  await flushView(); await flushDrafts();
  const { project, nodes, drafts } = await api.project(id);
  studio.project = project; localStorage.setItem(LAST_KEY, id);
  studio.nodes = nodes;
  studio.sel = []; resetBar();
  // 草稿里引用的参考图如果已被删除，就去掉那一项
  const validIds = new Set(nodes.filter(n => n.file).map(n => n.id));
  studio.drafts = drafts.map(d => ({ ...d, inputs: d.inputs.filter(i => validIds.has(i)) }));
  draftsPid = project.id; draftsSaved = JSON.stringify(draftRecs());
  if (project.view.s > 0) studio.view = { ...project.view };
  else { studio.view = { x: innerWidth / 2, y: innerHeight / 2, s: 1 }; if (nodes.length) fit(); }
}
export async function newProject() {
  const p = await api.createProject(`项目 ${studio.projects.length + 1}`);
  await refreshProjects(); await openProject(p.id);
}
export async function renameProject(id: string, name: string) {
  const p = await api.updateProject(id, { name });
  if (studio.project?.id === id) studio.project = p;
  await refreshProjects();
}
export async function removeProject(id: string) {
  if (draftsPid === id) { clearTimeout(draftTimer); draftsPid = ""; }   // 项目都删了，不必再保存它的草稿
  await api.deleteProject(id);
  await refreshProjects();
  if (!studio.projects.length) { await api.createProject("项目 1"); await refreshProjects(); }
  if (studio.project?.id === id) await openProject(studio.projects[0].id);
}

/* ---------- 节点 ---------- */
/** 保存时去掉只在前端用的 pending；失败原因只对没有图片的节点保留 */
const strip = (n: NodeView): NodeRec => {
  const { pending: _p, failed, failKind, failDetail, ...rec } = n;
  return { ...rec, parents: [...n.parents], ...(isReady(n) ? {} : { failed, failKind, failDetail }) };
};
/** 生成中的节点还不能算失败，但刷新页面后它就没了：先按「被中断」存一份，结果出来后会被图片替换 */
const INTERRUPTED = "上次生成没有完成（页面被刷新或关闭）。结果可能仍在后台生成，稍后刷新可以看到；也可以直接重试。";
export async function persistNodes(list: NodeView[]) {
  // 失败的节点也要保存：它带着用户写的提示词和参考图
  const saved = list.filter(n => isReady(n) || (!n.pending && n.failed)).map(strip);
  if (!saved.length || !studio.project) return;
  try { await api.putNodes(studio.project.id, saved); } catch (e) { toast("保存失败：" + (e as Error).message); }
}
async function persistPlaceholders(list: NodeView[]) {
  if (!studio.project) return;
  try { await api.putNodes(studio.project.id, list.map(n => ({ ...strip(n), failed: INTERRUPTED }))); }
  catch (e) { toast("保存失败：" + (e as Error).message); }
}
function overlaps(x: number, y: number, w: number, h: number) {
  return studio.nodes.some(n => x < n.x + n.w + 24 && x + w + 24 > n.x && y < n.y + n.h + 24 && y + h + 24 > n.y);
}

export interface SpawnOpts { parents: NodeView[]; prompt: string; at?: { x: number; y: number }; /** 严格放在 at 指定的位置，不再为避开其他节点而下移 */ exact?: boolean; model: string; ratio: string; size: string; n: number }
export async function spawn(o: SpawnOpts) {
  const pid = studio.project!.id, [w, h] = nodeSize(o.ratio), parents = o.parents;
  let x: number, y: number;
  if (o.at) { x = o.at.x - w / 2; y = o.at.y - h / 2; }
  else if (parents.length) {
    x = Math.max(...parents.map(p => p.x + p.w)) + 120;
    y = parents.reduce((a, p) => a + p.y + p.h / 2, 0) / parents.length - (o.n * h + (o.n - 1) * 24) / 2;
  } else { x = 0; y = 0; }

  const slots: NodeView[] = [];
  for (let i = 0; i < o.n; i++) {
    const slotX = parents.length ? x : x + i * (w + 28);
    let slotY = parents.length ? y + i * (h + 24) : y;
    for (let attempt = 0; !o.exact && attempt < 60 && overlaps(slotX, slotY, w, h); attempt++) slotY += 30;
    const slot = reactive<NodeView>({
      id: uid("n"), projectId: pid, x: slotX, y: slotY, w, h, ratio: o.ratio, size: o.size, model: o.model, prompt: o.prompt,
      parents: parents.map(p => p.id), fav: false, t: Date.now(), cost: priceOf(o.model), pending: true
    });
    slots.push(slot); studio.nodes.push(slot);
  }
  await persistPlaceholders(slots);
  await runSlots(slots, parents.map(p => p.id));
}

/** 点“查看详情”时展示的完整内容：简版原因、重试次数、请求 ID 和接口原文 */
function errorDetail(e: unknown, n: NodeView) {
  const lines = ["原因：" + (e instanceof Error ? e.message : String(e))];
  if (e instanceof ApiError) {
    if (e.kind) lines.push("分类：" + e.kind);
    if (e.status) lines.push("接口状态码：HTTP " + e.status);
    if (e.attempts) lines.push("请求次数：" + e.attempts + (e.attempts > 1 ? "（含自动退避重试）" : ""));
    if (e.requestId) lines.push("请求 ID：" + e.requestId);
  }
  lines.push("模型：" + n.model, "时间：" + new Date().toLocaleString());
  if (e instanceof ApiError && e.detail) lines.push("", "接口返回原文：", e.detail);
  return lines.join("\n");
}
/**
 * 生成期间切走又切回来时，studio.nodes 是重新从后端读的，原来的占位对象已不在其中：
 * 结果要写到画布上现存的对象；对象找不到就把它补回画布，否则要刷新页面才会出现。
 */
function liveSlot(slot: NodeView) {
  const cur = studio.nodes.find(n => n.id === slot.id);
  if (cur) return cur;
  studio.nodes.push(slot);
  return studio.nodes[studio.nodes.length - 1];
}

/** 请求成功：把每张结果回填到画布上的节点，接口没返回的槽位标记为失败 */
function applyResults(slots: NodeView[], parentIds: string[], res: GenerateResult) {
  const settled: NodeView[] = [];
  res.nodes.forEach(rec => {
    const slot = slots.find(s => s.id === rec.id);
    if (!slot) return;
    const target = liveSlot(slot);
    Object.assign(target, rec, { pending: false, failed: "", failKind: undefined, failDetail: undefined });
    settled.push(target);
  });
  slots.forEach(slot => {
    if (!slot.pending) return;
    slot.pending = false; slot.failed = "接口没有返回这张图"; liveSlot(slot);
  });
  const alive = settled.filter(s => isReady(s));
  if (!alive.length) return;
  // 用户在等待期间换去选了别的图，就不抢他的选择
  if (!studio.sel.length || studio.sel.every(id => parentIds.includes(id))) setSel([alive[0].id]);
  const last = alive[alive.length - 1], { x: sx, y: sy } = toScreen(last.x, last.y);
  if (sx > innerWidth - 200 || sy > innerHeight - 200 || sx < 0 || sy < 0) focusNode(last);
  if (res.mock && !mockNoticed) { mockNoticed = true; toast("还没配置接口，当前生成的是演示图。可在「设置」里填写基地址和 Key"); }
}

/** 请求失败：没拿到图的槽位标记失败并落盘；正在重新生成时原图还在（成功后才会被替换），保留原图只提示 */
function markFailed(slots: NodeView[], e: unknown) {
  const kind = e instanceof ApiError ? e.kind : undefined;
  const msg = e instanceof Error ? e.message : String(e), detail = errorDetail(e, slots[0]);
  const failed: NodeView[] = [];
  slots.forEach(slot => {
    // 生成期间切走又切回来时，画布上是重新载入的节点对象，结果要写到它身上
    const cur = studio.nodes.find(n => n.id === slot.id) ?? slot;
    cur.pending = false;
    if (cur.file) return;
    Object.assign(cur, { failed: msg, failKind: kind, failDetail: detail });
    if (studio.project?.id === slots[0].projectId && !studio.nodes.includes(cur)) studio.nodes.push(cur);
    failed.push(cur);
  });
  // 失败的节点连同提示词一起保存，刷新页面或切换项目后仍然在
  if (failed.length) api.putNodes(slots[0].projectId, failed.map(strip)).catch(err => toast("保存失败：" + (err as Error).message));
  toast(kind === "moderation" ? text("moderationBlocked") : "生成失败：" + msg);
}

/** 生成槽位里的图。失败时节点保留，标记为失败，可以重试或手动删除 */
async function runSlots(slots: NodeView[], parentIds: string[]) {
  const first = slots[0], pid = first.projectId;
  slots.forEach(s => { s.pending = true; s.failed = ""; s.failKind = undefined; s.failDetail = undefined; });
  try {
    const res = await api.generate(pid, {
      prompt: first.prompt, model: first.model, ratio: first.ratio, size: first.size, parentIds,
      slots: slots.map(s => ({ id: s.id, x: s.x, y: s.y, w: s.w, h: s.h }))
    });
    refreshProjects().catch(() => undefined);
    if (studio.project?.id !== pid) return;       // 生成期间切走了项目，结果已由后端落盘
    applyResults(slots, parentIds, res);
  } catch (e) {
    markFailed(slots, e);
  }
}
/**
 * 图片加载完成后，按它的实际宽高比校正节点：面积不变，中心不动，画幅记为最接近的预设值。
 * 由 <img @load> 触发，所以新生成的、重新打开项目时的旧节点都会被校正。
 */
export function fitToImage(n: NodeView, pw: number, ph: number) {
  if (!pw || !ph || !isReady(n)) return;
  if (Math.abs(Math.log(pw / ph) - Math.log(n.w / n.h)) < 0.03) return;   // 比例已经一致（节点尺寸取整有误差）
  const [w, h] = imageNodeSize(pw, ph);
  n.x += (n.w - w) / 2; n.y += (n.h - h) / 2; n.w = w; n.h = h; n.ratio = nearestRatio(pw, ph);
  void persistNodes([n]);
}
/** 再来一版：确认后丢弃当前图片，按同样的输入在原位置重新生成；失败则保留原图 */
export async function regenerate(n: NodeView) {
  if (!isReady(n)) return;
  if (!await askConfirm("再来一版会删除当前这张图片，并按同样的输入重新生成。继续吗？", { title: "再来一版", ok: "继续" })) return;
  setSel([]);
  void runSlots([n], n.parents.filter(p => nodeById(p)));
}
export function retryNode(n: NodeView) {
  if (n.pending) return;
  void runSlots([n], n.parents.filter(p => nodeById(p)));
}
/** 失败节点“返回编辑”：在原位置换成创作节点，带回提示词、参考图和参数，改完再生成 */
export function editNode(n: NodeView) {
  if (isReady(n) || n.pending) return;
  const parentIds = n.parents.filter(p => { const parent = nodeById(p); return !!parent && isReady(parent); });
  const draft = createDraft({ x: n.x, y: n.y + DRAFT_ANCHOR }, parentIds);
  draft.text = n.prompt; draft.model = n.model; draft.ratio = n.size === AUTO ? AUTO : n.ratio; draft.size = n.size;
  studio.nodes = studio.nodes.filter(other => other !== n);
  setSel([]);
  // 先把草稿存稳，再删掉失败节点，中途出问题也不会两边都没有
  const pid = n.projectId;
  void flushDrafts().then(() => api.deleteNodes(pid, [n.id])).catch(e => toast("保存失败：" + (e as Error).message));
}
/** 删除没有图片的失败节点。它保存着提示词，所以先确认 */
export async function discardNode(n: NodeView) {
  if (isReady(n) || n.pending) return;
  if (!await askConfirm("删除这个失败的节点？它的提示词也会一起删除。", { title: "删除节点", ok: "删除" })) return;
  studio.nodes = studio.nodes.filter(other => other !== n);
  api.deleteNodes(n.projectId, [n.id]).catch(e => toast("删除失败：" + (e as Error).message));
}
/* ---------- 连线 ---------- */
/** from 的所有祖先（沿 parents 往上） */
function ancestors(id: string) {
  const seen = new Set<string>(), stack = [id];
  while (stack.length) for (const p of nodeById(stack.pop()!)?.parents ?? []) if (!seen.has(p)) { seen.add(p); stack.push(p); }
  return seen;
}
/** 从 fromId 连一条线到 toId：fromId 成为 toId 的参考来源 */
export function addLink(fromId: string, toId: string) {
  const from = nodeById(fromId), to = nodeById(toId);
  if (!from || !to || from === to || !isReady(from) || !isReady(to)) return;
  if (to.parents.includes(fromId)) return toast("这两张图已经连着了");
  if (ancestors(fromId).has(toId)) return toast("不能连成环：目标图是起点的上游");
  if (to.parents.length >= 20) return toast("一张图最多连 20 条线");
  to.parents = [...to.parents, fromId];
  void persistNodes([to]);
}
export function createDraft(at: { x: number; y: number }, inputs: string[] = []) {
  const settings = studio.settings!, draft = reactive<Draft>({
    id: uid("d"), x: at.x, y: at.y - DRAFT_ANCHOR, inputs: [...inputs], text: "",
    model: settings.defaultModel, ratio: "auto", size: settings.defaultSize
  });
  studio.drafts.push(draft);
  return draft;
}
export const removeDraft = (id: string) => { studio.drafts = studio.drafts.filter(d => d.id !== id); };
/** 把节点接入创作节点的参考图列表末尾 */
export function addDraftInput(draftId: string, nodeId: string) {
  const draft = studio.drafts.find(d => d.id === draftId), node = nodeById(nodeId);
  if (!draft || !node || !isReady(node)) return;
  if (draft.inputs.includes(nodeId)) return toast("这张图已经接入了");
  if (draft.inputs.length >= 8) return toast("最多接入 8 张参考图");
  draft.inputs.push(nodeId);
}
export function removeLink(parentId: string, childId: string) {
  const draft = studio.drafts.find(d => d.id === childId);
  if (draft) { draft.inputs = draft.inputs.filter(i => i !== parentId); return; }
  const child = nodeById(childId); if (!child) return;
  child.parents = child.parents.filter(p => p !== parentId);
  void persistNodes([child]);
}

/* ---------- 上传 ---------- */
const UPLOAD_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_UPLOAD = 20 * 1024 * 1024;

/** 取最接近原图宽高比的预设画幅，作为这张图后续生成的默认画幅 */
function nearestRatio(pw: number, ph: number) {
  const actual = Math.log(pw / ph);
  return RATIOS.reduce((best, cur) => {
    const [cw, ch] = ratioWH(cur), [bw, bh] = ratioWH(best);
    return Math.abs(Math.log(cw / ch) - actual) < Math.abs(Math.log(bw / bh) - actual) ? cur : best;
  });
}

/** 上传图片到当前项目。at 是画布坐标（图片中心），省略则放在当前视野中心 */
export async function uploadImages(files: File[], at?: { x: number; y: number }) {
  const project = studio.project; if (!project || !files.length) return;
  const center = at ?? toWorld(innerWidth / 2, innerHeight / 2);
  const done: NodeView[] = [];
  let failed = 0;
  for (const file of files) {
    if (!UPLOAD_TYPES.includes(file.type)) { toast(`「${file.name}」不是 PNG、JPEG 或 WebP 图片`); failed++; continue; }
    if (file.size > MAX_UPLOAD) { toast(`「${file.name}」超过 20 MB`); failed++; continue; }
    try {
      const bmp = await createImageBitmap(file), pw = bmp.width, ph = bmp.height; bmp.close();
      const [w, h] = imageNodeSize(pw, ph);
      let x = center.x - w / 2 + done.length * 28, y = center.y - h / 2;
      for (let attempt = 0; attempt < 60 && overlaps(x, y, w, h); attempt++) y += 30;
      const rec = await api.upload(project.id, file, {
        id: uid("n"), x, y, w, h, ratio: nearestRatio(pw, ph), size: studio.settings?.defaultSize ?? "1K", name: file.name
      });
      if (studio.project?.id !== project.id) return;   // 上传期间切走了项目
      const node = reactive<NodeView>(rec); studio.nodes.push(node); done.push(node);
    } catch (e) { failed++; toast("上传失败：" + (e instanceof Error ? e.message : String(e))); }
  }
  if (!done.length) return;
  setSel([done[done.length - 1].id]);
  refreshProjects().catch(() => undefined);
  if (!failed) toast(`已上传 ${done.length} 张图片`);
}

export async function deleteSel() {
  const ids = [...studio.sel]; if (!ids.length || !studio.project) return;
  if (!await askConfirm(ids.length > 1 ? `删除选中的 ${ids.length} 张图片？此操作不可恢复。` : "删除这张图片？此操作不可恢复。", { title: "删除图片", ok: "删除" })) return;
  const pid = studio.project.id;
  studio.nodes = studio.nodes.filter(n => !ids.includes(n.id));
  studio.nodes.forEach(n => (n.parents = n.parents.filter(p => !ids.includes(p))));
  studio.sel = [];
  try { await api.deleteNodes(pid, ids); await refreshProjects(); } catch (e) { toast("删除失败：" + (e as Error).message); }
}
export function toggleFav(list: NodeView[]) {
  const to = !list.every(n => n.fav);
  list.forEach(n => (n.fav = to));
  persistNodes(list);
}
export function download(n: NodeView) {
  if (!isReady(n)) return;
  const a = document.createElement("a");
  a.href = imageUrl(n); a.download = `${studio.project?.name ?? "image"}-${n.id}.${n.file!.split(".").pop()}`; a.click();
}

/* ---------- 设置 ---------- */
export async function applySettings(input: SettingsInput) {
  const dto = await api.saveSettings(input);
  studio.settings = dto;
  if (!dto.models.some(m => m.id === studio.bar.model)) studio.bar.model = dto.defaultModel;
  toast("设置已保存");
}
