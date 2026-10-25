// @ts-check
import { CONFIG } from "./config.js";
import { $, applyEventName, callFunction, h, hydrateIcons, icon, toast } from "./common.js";

/** How many photos upload at the same time. Phones on venue Wi-Fi do best with a few. */
const PARALLEL = 3;
const CODE_KEY = "eventCode";

/**
 * @typedef {{
 *   id: number,
 *   file: File,
 *   preview: string,
 *   state: "pending" | "uploading" | "done" | "failed",
 *   progress: number,
 *   el: HTMLLIElement,
 * }} Item
 */

/** @type {Item[]} */
let items = [];
let nextId = 1;
let busy = false;

const dropzone = $("dropzone");
const input = /** @type {HTMLInputElement} */ ($("file-input"));
const selection = $("selection");
const thumbs = $("thumbs");
const uploadBtn = /** @type {HTMLButtonElement} */ ($("upload-btn"));
const uploadLabel = $("upload-label");
const progressWrap = $("progress-wrap");
const progressBar = $("progress-bar");
const progressText = $("progress-text");
const statusBox = $("status");

applyEventName();
hydrateIcons();
$("limit-hint").textContent = `Op til ${CONFIG.maxFiles} ad gangen`;

// The QR code carries the event code as ?k=…; remember it so a reload or a
// later visit from the same phone still works.
const urlCode = new URLSearchParams(location.search).get("k");
if (urlCode) safeStore(CODE_KEY, urlCode);
const eventCode = urlCode || safeLoad(CODE_KEY) || "";

// ---------- Selecting files ----------

input.addEventListener("change", () => {
  addFiles(Array.from(input.files || []));
  input.value = ""; // allow picking the same photo again after removing it
});

$("clear-btn").addEventListener("click", () => {
  if (busy) return;
  items.forEach((it) => URL.revokeObjectURL(it.preview));
  items = [];
  render();
});

// Drag and drop for desktop visitors.
["dragenter", "dragover"].forEach((type) =>
  dropzone.addEventListener(type, (e) => {
    e.preventDefault();
    dropzone.classList.add("is-dragging");
  }),
);
["dragleave", "drop"].forEach((type) =>
  dropzone.addEventListener(type, (e) => {
    e.preventDefault();
    dropzone.classList.remove("is-dragging");
  }),
);
dropzone.addEventListener("drop", (e) => {
  if (!busy) addFiles(Array.from(/** @type {DragEvent} */ (e).dataTransfer?.files || []));
});

/** @param {File} f */
function isImage(f) {
  return f.type.startsWith("image/") || /\.(heic|heif|jpe?g|png|webp|gif|avif)$/i.test(f.name);
}

/** @param {File[]} files */
function addFiles(files) {
  clearStatus();
  const known = new Set(items.map((it) => fileKey(it.file)));
  let rejected = 0;
  let duplicates = 0;
  let overLimit = 0;

  for (const file of files) {
    if (!isImage(file)) {
      rejected++;
      continue;
    }
    if (known.has(fileKey(file))) {
      duplicates++;
      continue;
    }
    if (items.length >= CONFIG.maxFiles) {
      overLimit++;
      continue;
    }
    known.add(fileKey(file));
    items.push({
      id: nextId++,
      file,
      preview: URL.createObjectURL(file),
      state: "pending",
      progress: 0,
      el: /** @type {HTMLLIElement} */ (h("li")),
    });
  }

  if (rejected) toast(`${rejected} fil${rejected > 1 ? "er" : ""} var ikke billeder og blev sprunget over`, "error");
  if (overLimit) toast(`Du kan højst sende ${CONFIG.maxFiles} billeder ad gangen. Upload disse først.`, "error", 5000);
  if (duplicates && !rejected && !overLimit) toast("Billedet er allerede valgt");
  render();
}

/** @param {File} f */
function fileKey(f) {
  return `${f.name}|${f.size}|${f.lastModified}`;
}

/** @param {Item} item */
function removeItem(item) {
  URL.revokeObjectURL(item.preview);
  items = items.filter((it) => it !== item);
  render();
}

// ---------- Rendering ----------

function render() {
  selection.hidden = items.length === 0;
  // The send button only appears once there is something to send.
  $("send").hidden = items.length === 0 && !busy;
  $("selection-count").textContent = `Valgte billeder (${items.length})`;

  // Re-use existing <li> elements so previews don't flicker or reload.
  thumbs.replaceChildren(
    ...items.map((item) => {
      if (!item.el.firstChild) buildThumb(item);
      updateThumb(item);
      return item.el;
    }),
  );

  const todo = items.filter((it) => it.state === "pending" || it.state === "failed").length;
  const anyFailed = items.some((it) => it.state === "failed");
  uploadBtn.disabled = busy || todo === 0;
  dropzone.setAttribute("aria-disabled", String(busy));
  /** @type {HTMLButtonElement} */ ($("clear-btn")).disabled = busy;

  if (busy) {
    uploadLabel.textContent = "Uploader…";
  } else if (anyFailed) {
    uploadLabel.textContent = `Prøv igen (${todo})`;
  } else {
    uploadLabel.textContent = todo ? `Upload (${todo})` : "Upload";
  }
}

/** @param {Item} item */
function buildThumb(item) {
  const img = h("img", { src: item.preview, alt: item.file.name, decoding: "async" });
  const remove = h("button", {
    class: "icon-btn thumb-remove",
    type: "button",
    "aria-label": `Fjern ${item.file.name}`,
  });
  remove.innerHTML = icon("x");
  remove.addEventListener("click", () => !busy && removeItem(item));
  item.el.className = "thumb";
  item.el.append(img, remove, h("div", { class: "thumb-state" }), h("div", { class: "thumb-bar" }));
}

/** @param {Item} item */
function updateThumb(item) {
  const state = /** @type {HTMLElement} */ (item.el.querySelector(".thumb-state"));
  const bar = /** @type {HTMLElement} */ (item.el.querySelector(".thumb-bar"));
  if (item.state === "pending") {
    item.el.removeAttribute("data-state");
  } else {
    item.el.dataset.state = item.state;
  }
  const html =
    item.state === "uploading"
      ? '<div class="spinner"></div>'
      : item.state === "done"
        ? icon("check")
        : item.state === "failed"
          ? icon("alert")
          : "";
  if (state.dataset.for !== item.state) {
    state.innerHTML = html;
    state.dataset.for = item.state;
  }
  bar.style.width = item.state === "uploading" ? `${Math.round(item.progress * 100)}%` : "0";
}

function updateOverallProgress() {
  const active = items.filter((it) => it.state !== "pending");
  if (!active.length) return;
  const frac = active.reduce((sum, it) => sum + (it.state === "done" ? 1 : it.progress), 0) / active.length;
  const pct = Math.round(frac * 100);
  progressBar.style.width = `${pct}%`;
  progressBar.parentElement?.setAttribute("aria-valuenow", String(pct));
  const done = active.filter((it) => it.state === "done").length;
  progressText.textContent = `${done} af ${active.length} billeder · ${pct}%`;
}

/**
 * @param {"ok" | "err" | "warn"} kind
 * @param {string} html
 */
function showStatus(kind, html) {
  const iconName = kind === "ok" ? "check" : "alert";
  statusBox.innerHTML = `<div class="status status-${kind}">${icon(iconName)}<div>${html}</div></div>`;
}

function clearStatus() {
  statusBox.innerHTML = "";
}

// ---------- Uploading ----------

uploadBtn.addEventListener("click", startUpload);

window.addEventListener("beforeunload", (e) => {
  if (busy) e.preventDefault();
});

async function startUpload() {
  const queue = items.filter((it) => it.state === "pending" || it.state === "failed");
  if (!queue.length || busy) return;

  busy = true;
  clearStatus();
  queue.forEach((it) => {
    it.state = "uploading";
    it.progress = 0;
  });
  progressWrap.hidden = false;
  render();
  updateOverallProgress();

  /** @type {any} */
  let ticket;
  try {
    ticket = await callFunction("upload", { body: { code: eventCode } });
  } catch (err) {
    queue.forEach((it) => (it.state = "failed"));
    busy = false;
    progressWrap.hidden = true;
    render();
    if (/** @type {any} */ (err).status === 401) {
      showStatus(
        "err",
        "Linket mangler den rigtige kode. Scan QR-koden ved festen igen, så virker det.",
      );
    } else {
      showStatus("err", "Vi kunne ikke forbinde til serveren. Tjek din forbindelse og prøv igen.");
    }
    return;
  }

  // Simple worker pool: PARALLEL uploads at a time.
  let cursor = 0;
  async function worker() {
    while (cursor < queue.length) {
      const item = queue[cursor++];
      const ok = await uploadWithRetry(item, ticket);
      item.state = ok ? "done" : "failed";
      updateThumb(item);
      updateOverallProgress();
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, worker));

  busy = false;
  const done = queue.filter((it) => it.state === "done").length;
  const failed = queue.length - done;

  if (failed === 0) {
    showStatus(
      "ok",
      `Tak! ${done === 1 ? "Dit billede er" : `Dine ${done} billeder er`} modtaget. <a href="/gallery">Se alle billeder</a>`,
    );
    toast(`${done} billede${done > 1 ? "r" : ""} uploadet`, "success");
  } else if (done === 0) {
    showStatus("err", "Uploaden fejlede. Tjek din forbindelse og tryk “Prøv igen”.");
  } else {
    showStatus("warn", `${done} billede${done > 1 ? "r" : ""} uploadet, ${failed} fejlede. Tryk “Prøv igen” for resten.`);
  }

  render();

  // Clear the successful ones after a moment so the guest can add more.
  setTimeout(() => {
    if (busy) return;
    items.filter((it) => it.state === "done").forEach((it) => URL.revokeObjectURL(it.preview));
    items = items.filter((it) => it.state !== "done");
    if (!items.length) progressWrap.hidden = true;
    render();
  }, 1800);
}

/**
 * @param {Item} item
 * @param {any} ticket
 */
async function uploadWithRetry(item, ticket) {
  updateThumb(item);
  let file;
  try {
    file = await shrinkIfHuge(item.file);
  } catch {
    file = item.file;
  }
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await uploadOne(file, ticket, (p) => {
        item.progress = p;
        updateThumb(item);
        updateOverallProgress();
      });
      return true;
    } catch (err) {
      const status = /** @type {any} */ (err).status;
      console.warn(`Upload of ${item.file.name} failed (attempt ${attempt})`, err);
      // 4xx means Cloudinary rejected the file itself; retrying won't help.
      if (status >= 400 && status < 500) return false;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1200));
    }
  }
  return false;
}

/**
 * Upload straight to Cloudinary with a signed ticket. Uses XHR because fetch
 * can't report upload progress.
 * @param {Blob} file
 * @param {any} t
 * @param {(fraction: number) => void} onProgress
 */
function uploadOne(file, t, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    form.append("api_key", t.apiKey);
    form.append("timestamp", String(t.timestamp));
    form.append("signature", t.signature);
    for (const [k, v] of Object.entries(t.params || {})) form.append(k, String(v));

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${t.cloudName}/image/upload`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.min(0.99, e.loaded / e.total));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve(undefined);
      } else {
        const err = new Error(xhr.responseText || `HTTP ${xhr.status}`);
        /** @type {any} */ (err).status = xhr.status;
        reject(err);
      }
    };
    xhr.onerror = () => reject(new Error("network"));
    xhr.ontimeout = () => reject(new Error("timeout"));
    xhr.timeout = 5 * 60 * 1000;
    xhr.send(form);
  });
}

/**
 * Cloudinary's free plan rejects images over 10 MB. Shrink those in the
 * browser; everything else goes up untouched at full quality.
 * @param {File} file
 * @returns {Promise<Blob>}
 */
async function shrinkIfHuge(file) {
  const limit = CONFIG.maxUploadMB * 1024 * 1024;
  if (file.size <= limit) return file;

  const bitmap = await createImageBitmap(file); // honours EXIF rotation
  for (const [edge, quality] of [
    [4096, 0.9],
    [3200, 0.85],
    [2400, 0.82],
  ]) {
    const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
    if (blob && blob.size <= limit) {
      bitmap.close();
      return blob;
    }
  }
  bitmap.close();
  return file; // let Cloudinary decide
}

// ---------- Storage helpers (private mode can throw) ----------

/** @param {string} k @param {string} v */
function safeStore(k, v) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
}

/** @param {string} k */
function safeLoad(k) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

// ---------- Photo wall behind the title ----------

/** Smaller copies for the wall, so it costs little mobile data. @param {string} url */
function wallThumb(url) {
  return url.replace(/\bh_\d+/, "h_240").replace(/\bw_\d+/, "w_400");
}

async function loadWall() {
  /** @type {any} */
  let data;
  try {
    data = await callFunction("get-images");
  } catch {
    return; // the page works fine without it
  }
  /** @type {{ thumbnail: string }[]} */
  const photos = Array.isArray(data?.images) ? data.images : [];
  if (photos.length < 3) return;

  const wall = $("wall");
  const latest = photos.slice(0, 24);
  for (const offset of [0, 1]) {
    let row = latest.filter((_, i) => i % 2 === offset);
    if (!row.length) row = latest;
    while (row.length < 8) row = row.concat(row); // wide enough to cover big screens
    const el = h("div", { class: "wall-row" });
    // The row appears twice so the drift loops without a jump.
    for (const p of [...row, ...row]) el.append(h("img", { src: wallThumb(p.thumbnail), alt: "", decoding: "async" }));
    wall.append(el);
  }
  await Promise.allSettled([...wall.querySelectorAll("img")].slice(0, 8).map((img) => /** @type {HTMLImageElement} */ (img).decode()));
  wall.classList.add("is-ready");
}

render();
loadWall();
