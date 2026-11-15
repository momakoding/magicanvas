/** 指针拖拽期间的回调；up 只在正常松手时触发，cancel 在 pointercancel 时只做清理 */
export interface DragHandlers {
  move: (ev: PointerEvent) => void;
  up?: (ev: PointerEvent) => void;
  cancel?: (ev: PointerEvent) => void;
}

/**
 * 统一的拖拽骨架：绑定 pointermove/pointerup/pointercancel，结束（松手或取消）后自动解绑。
 * target 传元素时会 setPointerCapture；传 window 则只靠全局监听（跨元素拖线用）。
 */
export function dragPointer(e: PointerEvent, target: HTMLElement | Window, h: DragHandlers) {
  if (target !== window) (target as HTMLElement).setPointerCapture(e.pointerId);
  const onMove = (ev: PointerEvent) => h.move(ev);
  const finish = (ev: PointerEvent) => {
    bind("pointermove", onMove, false); bind("pointerup", finish, false); bind("pointercancel", finish, false);
    if (ev.type === "pointerup") h.up?.(ev); else h.cancel?.(ev);
  };
  const bind = (type: string, fn: (ev: PointerEvent) => void, add: boolean) => {
    const listener = fn as EventListener;
    if (add) target.addEventListener(type, listener); else target.removeEventListener(type, listener);
  };
  bind("pointermove", onMove, true); bind("pointerup", finish, true); bind("pointercancel", finish, true);
}
