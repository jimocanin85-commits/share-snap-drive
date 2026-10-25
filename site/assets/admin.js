// @ts-check
import { $, applyEventName, hydrateIcons } from "./common.js";
import { ADMIN_CODE_KEY, drawQr, loadSetting, saveSetting, uploadUrl } from "./qr.js";

const input = /** @type {HTMLInputElement} */ ($("code"));
const canvas = /** @type {HTMLCanvasElement} */ ($("qr"));
const urlBox = $("url");
const hint = $("code-hint");

applyEventName();
hydrateIcons();

// Pre-fill from /admin?code=… or what was typed last time on this computer.
input.value = new URLSearchParams(location.search).get("code") || loadSetting(ADMIN_CODE_KEY) || "";
input.addEventListener("input", update);

function update() {
  const code = input.value.trim();
  saveSetting(ADMIN_CODE_KEY, code);
  const url = uploadUrl(code);
  urlBox.textContent = url;
  hint.textContent = code
    ? "Koden er med i QR-koden, så gæster skal ikke taste noget."
    : "Uden kode virker uploads kun, hvis EVENT_CODE ikke er sat i Vercel.";
  drawQr(canvas, url);
}

$("download-btn").addEventListener("click", () => {
  const a = document.createElement("a");
  a.download = "upload-qr-kode.png";
  a.href = canvas.toDataURL("image/png");
  a.click();
});

$("print-btn").addEventListener("click", () => window.print());

update();
