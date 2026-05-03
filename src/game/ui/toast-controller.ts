/** 顶栏关键提示 + 侧边条队列 */
export class ToastController {
  private toastTimer = 0;
  private readonly sideToastLines: { el: HTMLElement; timer: number }[] = [];

  constructor(
    private readonly toastElement: HTMLElement,
    private readonly sideToastElement: HTMLElement,
  ) {}

  show(message: string, critical = false): void {
    if (critical) {
      this.toastElement.textContent = message;
      this.toastElement.classList.add("show");
      this.toastTimer = 1.65;
      return;
    }
    this.pushSide(message);
  }

  private pushSide(message: string): void {
    const el = document.createElement("div");
    el.className = "toast-side-item";
    el.setAttribute("role", "status");
    el.textContent = message;
    this.sideToastElement.prepend(el);
    this.sideToastLines.unshift({ el, timer: 2.15 });
    while (this.sideToastLines.length > 5) {
      const dropped = this.sideToastLines.pop();
      dropped?.el.remove();
    }
    requestAnimationFrame(() => {
      el.classList.add("toast-side-item--in");
    });
  }

  tick(dt: number): void {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) {
        this.toastElement.classList.remove("show");
      }
    }
    for (let i = this.sideToastLines.length - 1; i >= 0; i--) {
      const line = this.sideToastLines[i]!;
      line.timer -= dt;
      if (line.timer <= 0) {
        line.el.remove();
        this.sideToastLines.splice(i, 1);
      }
    }
  }
}
