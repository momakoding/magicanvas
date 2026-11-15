import { createApp, h, type App } from "vue";
import { TooltipProvider } from "reka-ui";
import SettingsModal from "./SettingsModal.vue";

/**
 * 命令式设置弹窗：
 *   new SettingsDialog().open()
 * open() 时才创建挂载点和 Vue 实例，关闭时卸载并移除 DOM，返回的 Promise 在关闭后 resolve。
 */
export class SettingsDialog {
  private host: HTMLElement | null = null;
  private app: App | null = null;
  private opener: Element | null = null;

  open(): Promise<void> {
    if (this.app) return Promise.resolve();
    this.opener = document.activeElement;
    this.host = document.body.appendChild(document.createElement("div"));
    return new Promise(resolve => {
      this.app = createApp({ render: () => h(TooltipProvider, null, () => h(SettingsModal, { onClose: () => { this.close(); resolve(); } })) });
      this.app.mount(this.host!);
    });
  }

  close() {
    this.app?.unmount(); this.host?.remove();
    this.app = this.host = null;
    if (this.opener instanceof HTMLElement) this.opener.focus();
  }
}
