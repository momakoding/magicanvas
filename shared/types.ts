export interface ModelDef { id: string; price: number }

export interface ProjectRec {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  view: { x: number; y: number; s: number };
}
export interface ProjectSummary extends ProjectRec { count: number }

export interface NodeRec {
  id: string;
  projectId: string;
  x: number; y: number; w: number; h: number;
  ratio: string;
  /** 画面尺寸档位：1K / 2K / 4K */
  size: string;
  model: string;
  prompt: string;
  /** 有序：数组顺序就是融合时的参考图顺序 */
  parents: string[];
  fav: boolean;
  t: number;
  cost: number;
  /** 图片文件名，位于项目的 images 目录；生成完成前为空 */
  file?: string;
  /** upload 表示用户上传的图片；缺省为生成的图片。只能由后端上传接口设置 */
  kind?: "upload";
  /** 已归档：离开画布，只在资料库里灰色显示；真正的删除只能在资料库里进行 */
  archived?: boolean;
  /** 没有图片的节点才有：生成失败（或被中断）的原因。保存下来是为了不丢掉用户写的提示词 */
  failed?: string;
  failKind?: GenErrorKind;
  /** 完整错误信息，点“查看详情”显示 */
  failDetail?: string;
}

/** 创作节点：多张参考图（有序）加一段文字。不属于图片节点，但随项目保存，避免写好的提示词丢失 */
export interface DraftRec { id: string; x: number; y: number; inputs: string[]; text: string; model: string; ratio: string; size: string }

/** 后端返回给前端的设置：API Key 不出后端，只告诉前端有没有设置 */
export interface SettingsDTO {
  baseUrl: string;
  apiKeySet: boolean;
  models: ModelDef[];
  defaultModel: string;
  defaultRatio: string;
  defaultSize: string;
}
/** 前端保存设置时提交的内容。apiKey 省略表示保持不变，空字符串表示清除 */
export interface SettingsInput extends Omit<SettingsDTO, "apiKeySet"> { apiKey?: string }

export interface GenerateBody {
  prompt: string;
  model: string;
  ratio: string;
  size: string;
  /** 参考图所在节点，顺序即融合顺序 */
  parentIds: string[];
  /** 要生成的节点位置，数量即张数 */
  slots: Array<Pick<NodeRec, "id" | "x" | "y" | "w" | "h">>;
}
export interface GenerateResult { nodes: NodeRec[]; mock: boolean }

/** 生成失败的归类，前端据此决定怎么显示 */
export type GenErrorKind =
  | "moderation"   // 内容审核拦截（不要原样重试）
  | "overloaded"   // 上游繁忙 502/503/504（已自动退避重试）
  | "rate_limit"   // 429 限流
  | "quota"        // 额度、余额不足
  | "auth"         // Key 无效或无权限
  | "bad_request"  // 其他 400，参数或图片有问题
  | "timeout"
  | "network"
  | "empty"        // 接口成功但没有图
  | "unknown";
export const GEN_ERROR_KINDS: readonly GenErrorKind[] = ["moderation", "overloaded", "rate_limit", "quota", "auth", "bad_request", "timeout", "network", "empty", "unknown"];
export interface ApiErrorBody { error: string; kind?: GenErrorKind; requestId?: string; attempts?: number; status?: number; detail?: string }
