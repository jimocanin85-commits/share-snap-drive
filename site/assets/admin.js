// @ts-check
import { $, applyEventName, hydrateIcons } from "./common.js";
import { ADMIN_CODE_KEY, drawQr, saveSetting, uploadUrl } from "./qr.js";

const canvas = /** @type {HTMLCanvasElement} */ ($("qr"));

applyEventName();
hydrateIcons();

// The QR code is the plain upload address, so it is the same every time.
// (If an event ever needs EVENT_CODE again, open /admin?code=… to include it.)
const code = new URLSearchParams(location.search).get("code")?.trim() || "";
saveSetting(ADMIN_CODE_KEY, code); // forget any code typed in earlier versions
const url = uploadUrl(code);
$("url").textContent = url;
drawQr(canvas, url);

$("download-btn").addEventListener("click", () => {
  const a = document.createElement("a");
  a.download = "upload-qr-kode.png";
  a.href = canvas.toDataURL("image/png");
  a.click();
});

$("print-btn").addEventListener("click", () => window.print());
