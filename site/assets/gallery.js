// @ts-check
import { $, applyEventName, callFunction, h, hydrateIcons, isInAppBrowser, toast } from "./common.js";

/**
 * @typedef {{
 *   publicId: string,
 *   thumbnail: string,
 *   url: string,
 *   download?: string,
 *   width?: number,
 *   height?: number,
 * }} Photo
 */

/** @type {Photo[]} */
let photos = [];
/** Index shown in the lightbox, or -1 when closed. */
let current = -1;

const grid = $("grid");
const loading = $("loading");
const empty = $("empty");
const count = $("count");
const lightbox = $("lightbox");
const lbImg = /** @type {HTMLImageElement} */ ($("lb-img"));
const lbCount = $("lb-count");
const lbLoading = $("lb-loading");

applyEventName();
hydrateIcons();

// ---------- Loading the list ----------

async function load(isRefresh = false) {
  const spinIcon = document.querySelector("#refresh-btn svg");
  spinIcon?.classList.add("spinning");
  /** @type {HTMLButtonElement} */ ($("refresh-btn")).disabled = true;
  try {
    const data = await callFunction("get-images");
    photos = Array.isArray(data?.images) ? data.images : [];
    renderGrid();
    if (isRefresh) toast(`${photos.length} billeder`, "info", 1800);
  } catch (err) {
    console.error("Could not load photos", err);
    if (!photos.length) {
      loading.hidden = true;
      empty.hidden = false;
      $("empty-title").textContent = "Kunne ikke hente billeder";
      $("empty-text").textContent = "Tjek forbindelsen, og tryk på opdater om lidt.";
      count.textContent = "Ingen forbindelse";
    } else {
      toast("Kunne ikke opdatere. Prøv igen om lidt.", "error");
    }
  } finally {
    spinIcon?.classList.remove("spinning");
    /** @type {HTMLButtonElement} */ ($("refresh-btn")).disabled = false;
  }
}

function renderGrid() {
  loading.hidden = true;
  empty.hidden = photos.length > 0;
  grid.hidden = photos.length === 0;
  count.textContent = photos.length === 1 ? "1 billede" : `${photos.length} billeder`;

  grid.replaceChildren(
    ...photos.map((p, i) => {
      const btn = h("button", { class: "tile", type: "button", "aria-label": `Åbn billede ${i + 1}` }, [
        h("img", {
          src: p.thumbnail,
          alt: "",
          loading: i < 12 ? "eager" : "lazy",
          decoding: "async",
          width: String(p.width || 400),
          height: String(p.height || 400),
        }),
      ]);
      btn.addEventListener("click", () => openAt(i));
      // Aspect ratio drives the justified-row layout in style.css.
      const ratio = p.width && p.height ? Math.min(3, Math.max(0.33, p.width / p.height)) : 1;
      return h("li", { style: `--r: ${ratio.toFixed(3)}` }, [btn]);
    }),
  );
}

$("refresh-btn").addEventListener("click", () => load(true));

// ---------- Lightbox ----------

/** @param {number} i */
function openAt(i) {
  const wasOpen = current >= 0;
  current = i;
  lightbox.hidden = false;
  document.body.style.overflow = "hidden";
  // Let the phone's back button close the viewer instead of leaving the page.
  if (!wasOpen) history.pushState({ lightbox: true }, "");
  show();
  /** @type {HTMLElement} */ ($("lb-close")).focus({ preventScroll: true });
}

function show() {
  const p = photos[current];
  lbCount.textContent = `${current + 1} / ${photos.length}`;
  lbImg.style.transform = "";
  lbImg.style.opacity = "0.25";
  lbLoading.hidden = false;
  lbImg.alt = `Billede ${current + 1}`;
  lbImg.src = p.url;
  // Warm up the neighbours so swiping feels instant.
  for (const j of [current + 1, current - 1]) {
    const n = photos[(j + photos.length) % photos.length];
    if (n) new Image().src = n.url;
  }
}

lbImg.addEventListener("load", () => {
  lbImg.style.opacity = "1";
  lbLoading.hidden = true;
});

function close() {
  if (current < 0) return;
  if (history.state?.lightbox) {
    history.back(); // popstate does the actual closing
  } else {
    hideLightbox();
  }
}

function hideLightbox() {
  const last = current;
  current = -1;
  lightbox.hidden = true;
  lbImg.removeAttribute("src");
  document.body.style.overflow = "";
  /** @type {HTMLElement | undefined} */ (grid.querySelectorAll(".tile")[last])?.focus({ preventScroll: false });
}

window.addEventListener("popstate", () => {
  if (current >= 0) hideLightbox();
});

/** @param {number} step */
function go(step) {
  if (current < 0 || photos.length < 2) return;
  current = (current + step + photos.length) % photos.length;
  show();
}

$("lb-close").addEventListener("click", close);
$("lb-prev").addEventListener("click", () => go(-1));
$("lb-next").addEventListener("click", () => go(1));
$("lb-download").addEventListener("click", () => save(photos[current], current));

// Click on the black background closes; clicks on the photo or buttons don't.
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) close();
});

document.addEventListener("keydown", (e) => {
  if (current < 0) return;
  if (e.key === "ArrowRight") go(1);
  else if (e.key === "ArrowLeft") go(-1);
  else if (e.key === "Escape") close();
});

// Swipe left/right on touch screens. Two-finger gestures are left alone so
// pinch-zoom still works.
/** @type {{ x: number, y: number, id: number } | null} */
let swipe = null;
let touches = 0;
lightbox.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "mouse") return;
  touches++;
  swipe = touches === 1 ? { x: e.clientX, y: e.clientY, id: e.pointerId } : null;
});
lightbox.addEventListener("pointermove", (e) => {
  if (!swipe || e.pointerId !== swipe.id) return;
  const dx = e.clientX - swipe.x;
  if (Math.abs(dx) > Math.abs(e.clientY - swipe.y)) lbImg.style.transform = `translateX(${dx}px)`;
});
const endSwipe = (/** @type {PointerEvent} */ e) => {
  if (e.pointerType === "mouse") return;
  touches = Math.max(0, touches - 1);
  if (!swipe || e.pointerId !== swipe.id) return;
  const dx = e.clientX - swipe.x;
  const dy = e.clientY - swipe.y;
  swipe = null;
  lbImg.style.transform = "";
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
  else if (dy > 120 && Math.abs(dy) > Math.abs(dx)) close(); // swipe down to close
};
lightbox.addEventListener("pointerup", endSwipe);
lightbox.addEventListener("pointercancel", endSwipe);

// ---------- Saving ----------

/**
 * On phones, open the share sheet so "Gem billede" puts the photo in the
 * camera roll. Elsewhere, download it as a JPEG file.
 * @param {Photo} p
 * @param {number} i
 */
async function save(p, i) {
  if (isInAppBrowser) {
    toast("Åbn siden i din normale browser (tryk på ••• → Åbn i browser) for at gemme billeder.", "info", 6000);
    return;
  }
  const fileUrl = p.download || p.url;
  const name = `billede-${i + 1}.jpg`;

  const canShareFiles =
    matchMedia("(hover: none)").matches &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [new File([""], name, { type: "image/jpeg" })] });

  if (canShareFiles) {
    try {
      const blob = await (await fetch(fileUrl)).blob();
      await navigator.share({ files: [new File([blob], name, { type: "image/jpeg" })] });
      return;
    } catch (err) {
      if (/** @type {any} */ (err)?.name === "AbortError") return; // user closed the sheet
      // Otherwise fall through to a normal download.
    }
  }

  // The download URL tells Cloudinary to send it as an attachment, so this
  // works even though the file is on another domain.
  const a = h("a", { href: fileUrl, download: name, rel: "noopener" });
  document.body.append(a);
  a.click();
  a.remove();
}

load();
