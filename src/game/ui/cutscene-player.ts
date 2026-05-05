/** 全屏过场视频播放器（关卡开场 / 波次间隙） */

export interface CutsceneOptions {
  /** 视频公共 URL，如 /uploads/videos/intro.mp4 */
  url: string;
  /** 可选字幕标题，显示在视频下方 */
  title?: string;
  /** 跳过按钮文本，默认"跳过" */
  skipLabel?: string;
}

/**
 * 全屏播放一段过场视频。
 * - 右上角显示跳过按钮
 * - 视频自然结束或点击跳过后 Promise resolve
 * - 视频加载/播放出错时也会自动跳过（不中断游戏）
 */
export function playCutscene(options: CutsceneOptions): Promise<void> {
  return new Promise<void>((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "cutscene-overlay";
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "99999",
      background: "#000",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    });

    const video = document.createElement("video");
    video.src = options.url;
    video.autoplay = true;
    video.controls = false;
    video.playsInline = true;
    Object.assign(video.style, {
      width: "100%",
      height: "100%",
      objectFit: "contain",
    });

    const skipBtn = document.createElement("button");
    skipBtn.textContent = options.skipLabel ?? "跳过 ›";
    Object.assign(skipBtn.style, {
      position: "absolute",
      top: "20px",
      right: "24px",
      padding: "8px 20px",
      background: "rgba(0,0,0,0.55)",
      color: "#fff",
      border: "1px solid rgba(255,255,255,0.35)",
      borderRadius: "6px",
      cursor: "pointer",
      fontSize: "14px",
      zIndex: "1",
      backdropFilter: "blur(4px)",
    });

    let resolved = false;
    const done = () => {
      if (resolved) return;
      resolved = true;
      overlay.remove();
      resolve();
    };

    skipBtn.addEventListener("click", done);
    video.addEventListener("ended", done);
    video.addEventListener("error", done);

    overlay.appendChild(video);
    overlay.appendChild(skipBtn);

    if (options.title) {
      const titleEl = document.createElement("div");
      titleEl.textContent = options.title;
      Object.assign(titleEl.style, {
        position: "absolute",
        bottom: "60px",
        left: "50%",
        transform: "translateX(-50%)",
        color: "rgba(255,255,255,0.88)",
        fontSize: "20px",
        textShadow: "0 2px 8px #000",
        pointerEvents: "none",
        textAlign: "center",
        maxWidth: "80%",
        whiteSpace: "pre-line",
      });
      overlay.appendChild(titleEl);
    }

    document.body.appendChild(overlay);
    video.play().catch(done);
  });
}

/**
 * 如果 cutscene.url 非空则播放视频，否则立即 resolve。
 * 所有调用方均使用此函数，以便安全处理"未上传视频"情形。
 */
export function playCutsceneIfPresent(
  cutscene: { url?: string; title?: string } | undefined,
): Promise<void> {
  if (!cutscene?.url) return Promise.resolve();
  return playCutscene({ url: cutscene.url, title: cutscene.title });
}
