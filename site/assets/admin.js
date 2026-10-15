// @ts-check
import { CONFIG } from "./config.js";
import { $, applyEventName, hydrateIcons } from "./common.js";
// Vendored from https://github.com/kazuhikoarase/qrcode-generator (MIT).
import qrcode from "./qrcode.mjs";

const CODE_KEY = "adminEventCode";

const input = /** @type {HTMLInputElement} */ ($("code"));
const canvas = /** @type {HTMLCanvasElement} */ ($("qr"));
const urlBox = $("url");
const hint = $("code-hint");

applyEventName();
hydrateIcons();

// Pre-fill from /admin?code=… or what was typed last time on this computer.
input.value = new URLSearchParams(location.search).get("code") || load() || "";
input.addEventListener("input", update);

function uploadUrl() {
  const base = new URL(CONFIG.publicUploadUrl || "/", location.origin);
  const code = input.value.trim();
  if (code) base.searchParams.set("k", code);
  return base.toString();
}

function update() {
  const code = input.value.trim();
  save(code);
  const url = uploadUrl();
  urlBox.textContent = url;
  hint.textContent = code
    ? "Koden er med i QR-koden, så gæster skal ikke taste noget."
    : "Uden kode virker uploads kun, hvis EVENT_CODE ikke er sat i Supabase.";
  draw(url);
}

/** @param {string} text */
function draw(text) {
  const qr = qrcode(0, "M");
  qr.addData(text, "Byte");
  qr.make();
  const modules = qr.getModuleCount();
  const quiet = 4; // standard white border, in modules
  const total = modules + quiet * 2;
  const cell = Math.floor(1000 / total);
  const size = cell * total;
  canvas.width = canvas.height = size;
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#000";
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
    }
  }
}

$("download-btn").addEventListener("click", () => {
  const a = document.createElement("a");
  a.download = "upload-qr-kode.png";
  a.href = canvas.toDataURL("image/png");
  a.click();
});

$("print-btn").addEventListener("click", () => window.print());

/** @param {string} v */
function save(v) {
  try {
    localStorage.setItem(CODE_KEY, v);
  } catch {
    /* private mode */
  }
}

function load() {
  try {
    return localStorage.getItem(CODE_KEY);
  } catch {
    return null;
  }
}

update();
