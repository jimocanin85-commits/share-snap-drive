// @ts-check
// Full-screen slideshow for a projector or TV. Loops through every photo,
// shows new uploads next as they arrive, and keeps an upload QR code in the
// corner so guests can join in.
import { $, applyEventName, callFunction, hydrateIcons, icon } from "./common.js";
import { createKeepAwake } from "./keepawake.js";
import { drawQr, loadSetting, saveSetting, uploadUrl } from "./qr.js";

/** How often to look for new uploads. The server caches for 60 s anyway. */
const POLL_MS = 30_000;
const SPEED_KEY = "slideshowSeconds";
const QR_KEY = "slideshowShowQr";

/** @typedef {{ publicId: string, thumbnail: string, url: string }} Photo */

/** @type {Photo[]} */
let photos = [];
/** Photos that arrived since the show started, shown before the loop continues. */
/** @type {Photo[]} */
let fresh = [];
let position = -1; // index in `photos` of the last loop photo shown
/** @type {Photo | null} */
let showing = null;
/** Recently shown, for the "previous" button. @type {Photo[]} */
const history = [];
let started = false;
let paused = false;
let busy = false;
/** @type {ReturnType<typeof setTimeout> | undefined} */
let timer;

const slides = [$("slide-a"), $("slide-b")];
let front = 0;
const empty = $("empty");
const badge = $("badge");
const corner = $("corner");
const controls = $("controls");
const statusText = $("status");
const speed = /** @type {HTMLSelectElement} */ ($("speed"));

applyEventName();
hydrateIcons();

// ---------- Settings ----------

const savedSpeed = loadSetting(SPEED_KEY);
if (savedSpeed && [...speed.options].some((o) => o.value === savedSpeed)) speed.value = savedSpeed;
speed.addEventListener("change", () => {
  saveSetting(SPEED_KEY, speed.value);
  schedule();
});
const seconds = () => Number(speed.value) || 8;

// The QR in the corner is the plain upload address (plus ?k=… only if the
// slideshow itself was opened with one).
const code = new URLSearchParams(location.search).get("k") || "";
document.querySelectorAll("canvas[data-qr]").forEach((c) => drawQr(/** @type {HTMLCanvasElement} */ (c), uploadUrl(code), 600));

let qrVisible = loadSetting(QR_KEY) !== "0";
function applyQr() {
  corner.hidden = !qrVisible;
  saveSetting(QR_KEY, qrVisible ? "1" : "0");
}
applyQr();

// ---------- Loading photos ----------

async function refresh() {
  try {
    const data = await callFunction("get-images");
    /** @type {Photo[]} */
    const latest = Array.isArray(data?.images) ? data.images : [];
    const known = new Set(photos.map((p) => p.publicId));
    // The list comes newest first; queue new ones oldest first so they play in order.
    const arrived = latest.filter((p) => !known.has(p.publicId)).reverse();
    const firstLoad = photos.length === 0;

    // Keep the loop position on the same photo after the list changes.
    const currentId = photos[position]?.publicId;
    photos = latest.slice().reverse(); // loop oldest → newest
    position = currentId ? photos.findIndex((p) => p.publicId === currentId) : -1;

    if (!firstLoad && started) fresh.push(...arrived);
    const stillThere = new Set(latest.map((p) => p.publicId));
    fresh = fresh.filter((p) => stillThere.has(p.publicId));

    statusText.textContent = `${photos.length} billeder`;
    empty.hidden = photos.length > 0 || !started;
    if (started && !showing && photos.length) {
      // First photo on screen: the newest one, then the loop runs oldest → newest.
      position = photos.length - 2;
      advance();
    }
  } catch (err) {
    console.warn("Could not refresh photos", err);
    statusText.textContent = "Ingen forbindelse – prøver igen";
  }
}

// ---------- Showing photos ----------

function nextPhoto() {
  const f = fresh.shift();
  if (f) return { photo: f, isNew: true };
  if (!photos.length) return null;
  position = (position + 1) % photos.length;
  return { photo: photos[position], isNew: false };
}

/** @param {{ photo: Photo, isNew: boolean } | null} [pick] */
async function advance(pick = nextPhoto()) {
  if (busy || !pick) return;
  busy = true;
  clearTimeout(timer);
  const ok = await display(pick.photo);
  busy = false;
  if (ok) {
    if (showing && showing !== pick.photo) history.push(showing);
    if (history.length > 50) history.shift();
    showing = pick.photo;
    badge.hidden = !pick.isNew;
  }
  // A photo that fails to load is skipped quickly instead of stalling the show.
  schedule(ok ? undefined : 500);
}

/** Load the photo off-screen, then cross-fade to it. @param {Photo} photo */
async function display(photo) {
  const next = slides[1 - front];
  const fg = /** @type {HTMLImageElement} */ (next.querySelector(".show-fg"));
  const bg = /** @type {HTMLImageElement} */ (next.querySelector(".show-bg"));
  try {
    fg.src = photo.url;
    bg.src = photo.thumbnail; // small and blurred: fills the sides of portrait photos
    await fg.decode();
  } catch {
    return false;
  }
  next.classList.remove("is-active");
  void next.offsetWidth; // restart the slow zoom animation
  next.style.setProperty("--slide-seconds", `${seconds() + 2}s`);
  next.classList.add("is-active");
  slides[front].classList.remove("is-active");
  front = 1 - front;
  return true;
}

/** @param {number} [ms] */
function schedule(ms) {
  clearTimeout(timer);
  if (!started || paused) return;
  timer = setTimeout(() => advance(), ms ?? seconds() * 1000);
}

function previous() {
  const prev = history.pop();
  if (!prev) return;
  const idx = photos.indexOf(prev);
  if (idx >= 0) position = idx;
  showing = null; // don't push the current one back onto history
  advance({ photo: prev, isNew: false });
}

function togglePause() {
  paused = !paused;
  $("play-btn").innerHTML = icon(paused ? "play" : "pause");
  $("play-btn").setAttribute("aria-label", paused ? "Afspil (mellemrum)" : "Pause (mellemrum)");
  statusText.textContent = paused ? "Pause" : `${photos.length} billeder`;
  schedule();
}

// ---------- Full screen & keeping the screen awake ----------

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen?.().catch(() => {});
}

const awakeWarn = $("awake-warn");
const awakeState = $("awake-state");
const awake = createKeepAwake(({ lock, video }) => {
  const ok = lock || video;
  awakeState.textContent = ok ? "Skærmen holdes tændt" : "Skærmen kan slukke!";
  // Give the browser a moment before warning; the video can take a second to start.
  clearTimeout(warnTimer);
  if (ok) awakeWarn.hidden = true;
  else warnTimer = setTimeout(() => (awakeWarn.hidden = awake.status().lock || awake.status().video), 4000);
});
/** @type {ReturnType<typeof setTimeout> | undefined} */
let warnTimer;

// ---------- Controls ----------

$("start-btn").addEventListener("click", async () => {
  toggleFullscreen();
  awake.start();
  $("start").hidden = true;
  started = true;
  await refresh();
  setInterval(refresh, POLL_MS);
  wakeControls();
});

$("prev-btn").addEventListener("click", previous);
$("next-btn").addEventListener("click", () => advance());
$("play-btn").addEventListener("click", togglePause);
$("fs-btn").addEventListener("click", toggleFullscreen);
$("qr-btn").addEventListener("click", () => {
  qrVisible = !qrVisible;
  applyQr();
});

document.addEventListener("keydown", (e) => {
  if (!started || e.target instanceof HTMLSelectElement) return;
  if (e.key === " ") {
    e.preventDefault();
    togglePause();
  } else if (e.key === "ArrowRight") advance();
  else if (e.key === "ArrowLeft") previous();
  else if (e.key === "f" || e.key === "F") toggleFullscreen();
  else if (e.key === "q" || e.key === "Q") {
    qrVisible = !qrVisible;
    applyQr();
  } else return;
  wakeControls();
});

// Controls and mouse pointer appear on movement and fade after 3 seconds.
/** @type {ReturnType<typeof setTimeout> | undefined} */
let idleTimer;
function wakeControls() {
  if (!started) return;
  document.body.classList.add("show-awake");
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!controls.matches(":hover")) document.body.classList.remove("show-awake");
  }, 3000);
}
document.addEventListener("mousemove", wakeControls);
document.addEventListener("touchstart", wakeControls, { passive: true });

// Load the list straight away so the count is ready when Start is pressed.
refresh();
