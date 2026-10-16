// @ts-check
// Keeps a laptop's screen on (no screensaver, no sleep) while the slideshow
// runs, even though nobody touches the mouse or keyboard.
//
// Two layers, because neither works everywhere on its own:
//  1. The Screen Wake Lock API. Browsers drop the lock whenever the tab is
//     hidden or the system asks, so it is re-requested every time it's lost.
//  2. A tiny, invisible, muted video playing on a loop. Browsers keep the
//     screen on during video playback; this is the trick NoSleep.js uses, and
//     it covers browsers without Wake Lock or when the lock is refused.

/** @typedef {{ lock: boolean, video: boolean }} AwakeStatus */

/** @param {(s: AwakeStatus) => void} onChange */
export function createKeepAwake(onChange) {
  /** @type {any} */
  let lock = null;
  /** @type {HTMLVideoElement | null} */
  let video = null;
  let active = false;
  /** @type {ReturnType<typeof setInterval> | undefined} */
  let watchdog;

  // "Not paused" isn't enough: a video that failed to load also isn't paused.
  // It only counts once it has frames and has really started playing.
  let videoPlaying = false;
  const status = () => ({
    lock: Boolean(lock),
    video: Boolean(video && videoPlaying && !video.paused && video.readyState >= 2),
  });
  const report = () => onChange(status());

  async function requestLock() {
    const api = /** @type {any} */ (navigator).wakeLock;
    if (!active || lock || !api || document.visibilityState !== "visible") return;
    try {
      lock = await api.request("screen");
      lock.addEventListener("release", () => {
        lock = null;
        report();
        // Lost it (tab hidden, battery saver, system policy): try again shortly.
        if (active) setTimeout(requestLock, 1000);
      });
    } catch {
      lock = null;
    }
    report();
  }

  function startVideo() {
    if (!video) {
      video = document.createElement("video");
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.playsInline = true;
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("aria-hidden", "true");
      video.className = "keep-awake-video";
      for (const [src, type] of [
        ["/assets/keepawake.webm", "video/webm"],
        ["/assets/keepawake.mp4", "video/mp4"],
      ]) {
        const s = document.createElement("source");
        s.src = src;
        s.type = type;
        video.append(s);
      }
      video.addEventListener("playing", () => {
        videoPlaying = true;
        report();
      });
      video.addEventListener("pause", () => {
        videoPlaying = false;
        report();
        if (active) video?.play().catch(() => {});
      });
      // The last <source> failing means no video at all.
      video.lastElementChild?.addEventListener("error", () => {
        videoPlaying = false;
        report();
      });
      document.body.append(video);
    }
    video.play().catch(() => report());
  }

  function onVisible() {
    if (!active || document.visibilityState !== "visible") return;
    requestLock();
    startVideo();
  }

  return {
    /** Call from a click/keypress so browsers allow it. */
    start() {
      active = true;
      startVideo();
      requestLock();
      document.addEventListener("visibilitychange", onVisible);
      // Belt and braces: every 30 s, make sure both are still running.
      watchdog = setInterval(onVisible, 30_000);
    },
    stop() {
      active = false;
      clearInterval(watchdog);
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release?.();
      lock = null;
      video?.pause();
      report();
    },
    status,
  };
}
