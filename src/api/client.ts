import type { DraftRec, GenErrorKind, GenerateBody, GenerateResult, NodeRec, ProjectRec, ProjectSummary, SettingsDTO, SettingsInput } from "@shared";

async function req<T>(method: string, url: string, body?: unknown, keepalive = false): Promise<T> {
  let res: Response;
  try {
    res = await fetch("/api" + url, {
      method, keepalive,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new Error("无法连接后端，请确认已用 pnpm dev 或 pnpm start 启动");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.error ?? `请求失败（HTTP ${res.status}）`, data?.kind, data?.requestId, data?.attempts, data?.status, data?.detail);
  return data as T;
}

/** 后端返回的错误，kind 是后端对失败原因的归类 */
export class ApiError extends Error {
  constructor(message: string, public kind?: GenErrorKind, public requestId?: string, public attempts?: number, public status?: number, public detail?: string) { super(message); }
}

export const api = {
  settings: () => req<SettingsDTO>("GET", "/settings"),
  saveSettings: (s: SettingsInput) => req<SettingsDTO>("PUT", "/settings", s),
  detectModels: (b: { baseUrl?: string; apiKey?: string }) => req<{ models: string[] }>("POST", "/models/detect", b),

  projects: () => req<ProjectSummary[]>("GET", "/projects"),
  createProject: (name: string) => req<ProjectRec>("POST", "/projects", { name }),
  project: (id: string) => req<{ project: ProjectRec; nodes: NodeRec[]; drafts: DraftRec[] }>("GET", `/projects/${id}`),
  updateProject: (id: string, patch: { name?: string; view?: ProjectRec["view"] }) => req<ProjectRec>("PATCH", `/projects/${id}`, patch),
  deleteProject: (id: string) => req<{ ok: true }>("DELETE", `/projects/${id}`),

  upload: async (pid: string, file: File, meta: Record<string, string | number>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(meta)) fd.set(k, String(v));
    fd.set("file", file);
    let res: Response;
    try { res = await fetch(`/api/projects/${pid}/uploads`, { method: "POST", body: fd }); }
    catch { throw new Error("无法连接后端"); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? `上传失败（HTTP ${res.status}）`);
    return data as NodeRec;
  },
  putNodes: (pid: string, nodes: NodeRec[]) => req<{ ok: true }>("PUT", `/projects/${pid}/nodes`, nodes),
  /** keepalive 用于页面关闭时的最后一次保存 */
  putDrafts: (pid: string, drafts: DraftRec[], keepalive = false) => req<{ ok: true }>("PUT", `/projects/${pid}/drafts`, drafts, keepalive),
  deleteNodes: (pid: string, ids: string[]) => req<{ ok: true }>("POST", `/projects/${pid}/nodes/delete`, { ids }),
  generate: (pid: string, body: GenerateBody) => req<GenerateResult>("POST", `/projects/${pid}/generate`, body),

  imageUrl: (n: Pick<NodeRec, "projectId" | "id" | "file" | "t">) => `/api/projects/${n.projectId}/images/${n.id}?v=${n.file ?? ""}-${n.t}`
};
