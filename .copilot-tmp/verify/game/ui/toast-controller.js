/** 顶栏关键提示 + 侧边条队列 */
export class ToastController {
    constructor(toastElement, sideToastElement) {
        Object.defineProperty(this, "toastElement", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: toastElement
        });
        Object.defineProperty(this, "sideToastElement", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: sideToastElement
        });
        Object.defineProperty(this, "toastTimer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "sideToastLines", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
    }
    /**
     * @param critical 为 true 时用顶栏大号提示（红框）；可为顶栏单独指定滞留秒数，默认 1.65s。
     */
    show(message, critical = false, topBarHoldSeconds) {
        if (critical) {
            this.toastElement.textContent = message;
            this.toastElement.classList.add("show");
            this.toastTimer = topBarHoldSeconds ?? 1.65;
            return;
        }
        this.pushSide(message);
    }
    pushSide(message) {
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
    tick(dt) {
        if (this.toastTimer > 0) {
            this.toastTimer -= dt;
            if (this.toastTimer <= 0) {
                this.toastElement.classList.remove("show");
            }
        }
        for (let i = this.sideToastLines.length - 1; i >= 0; i--) {
            const line = this.sideToastLines[i];
            line.timer -= dt;
            if (line.timer <= 0) {
                line.el.remove();
                this.sideToastLines.splice(i, 1);
            }
        }
    }
}
