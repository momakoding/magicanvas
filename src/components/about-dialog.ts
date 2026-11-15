import { createApp, h, type App } from "vue";
import AboutModal from "./AboutModal.vue";

/** 命令式「关于」弹窗：new AboutDialog().open()，关闭时卸载并移除 DOM。 */
export class AboutDialog {
  private host: HTMLElement | null = null;
  private app: App | null = null;
  private opener: Element | null = null;

  open(): Promise<void> {
    if (this.app) return Promise.resolve();
    this.opener = document.activeElement;
    this.host = document.body.appendChild(document.createElement("div"));
    return new Promise(resolve => {
      this.app = createApp({ render: () => h(AboutModal, { onClose: () => { this.close(); resolve(); } }) });
      this.app.mount(this.host!);
    });
  }

  close() {
    this.app?.unmount(); this.host?.remove();
    this.app = this.host = null;
    if (this.opener instanceof HTMLElement) this.opener.focus();
  }
}
