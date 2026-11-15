import { shallowRef } from "vue";

export interface ConfirmReq { title: string; message: string; ok: string; resolve: (v: boolean) => void }

/** 当前等待用户确认的请求；null 表示没有弹窗。由 DialogHost 渲染 */
export const confirmReq = shallowRef<ConfirmReq | null>(null);

/** 替代 window.confirm：返回用户是否点了确认 */
export function askConfirm(message: string, opts: { title?: string; ok?: string } = {}): Promise<boolean> {
  settleConfirm(false);   // 上一个还没处理完就视为取消
  return new Promise(resolve => {
    confirmReq.value = { title: opts.title ?? "请确认", message, ok: opts.ok ?? "确定", resolve };
  });
}

export function settleConfirm(result: boolean) {
  const r = confirmReq.value;
  confirmReq.value = null;
  r?.resolve(result);
}
