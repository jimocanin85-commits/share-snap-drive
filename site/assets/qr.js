// @ts-check
import { CONFIG } from "./config.js";
// Vendored from https://github.com/kazuhikoarase/qrcode-generator (MIT).
import qrcode from "./qrcode.mjs";

/** Where the organiser's code is remembered on this computer (set on /admin). */
export const ADMIN_CODE_KEY = "adminEventCode";

/**
 * The address guests open from the QR code, with the event code attached.
 * @param {string} code
 */
export function uploadUrl(code) {
  const base = new URL(CONFIG.publicUploadUrl || "/", location.origin);
  if (code.trim()) base.searchParams.set("k", code.trim());
  return base.toString();
}

/**
 * Draw a QR code onto a canvas, with the standard white border.
 * @param {HTMLCanvasElement} canvas
 * @param {string} text
 * @param {number} [pixels] approximate size in pixels
 */
export function drawQr(canvas, text, pixels = 1000) {
  const qr = qrcode(0, "M");
  qr.addData(text, "Byte");
  qr.make();
  const modules = qr.getModuleCount();
  const quiet = 4;
  const total = modules + quiet * 2;
  const cell = Math.max(1, Math.floor(pixels / total));
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

/** Read from localStorage without throwing in private mode. @param {string} k */
export function loadSetting(k) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

/** @param {string} k @param {string} v */
export function saveSetting(k, v) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode */
  }
}
