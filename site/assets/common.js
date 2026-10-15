// @ts-check
import { CONFIG } from "./config.js";

/**
 * Call one of the Supabase edge functions.
 * @param {string} name
 * @param {{ method?: string, body?: unknown }} [opts]
 * @returns {Promise<any>}
 */
export async function callFunction(name, opts = {}) {
  const res = await fetch(`${CONFIG.supabaseUrl}/functions/v1/${name}`, {
    method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
    headers: {
      apikey: CONFIG.supabaseKey,
      Authorization: `Bearer ${CONFIG.supabaseKey}`,
      ...(opts.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  /** @type {any} */
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    /** @type {any} */ (err).status = res.status;
    throw err;
  }
  return data;
}

/**
 * Find an element by id, failing loudly if the HTML and JS drift apart.
 * @template {HTMLElement} T
 * @param {string} id
 * @returns {T}
 */
export function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return /** @type {T} */ (el);
}

/**
 * Create an element with attributes and children.
 * @param {string} tag
 * @param {Record<string, string>} [attrs]
 * @param {(Node | string)[]} [children]
 */
export function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(...children);
  return el;
}

/** Inline SVG icons (paths from the Lucide set, ISC licence). */
export const ICONS = {
  camera:
    '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  upload:
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert:
    '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  download:
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  images:
    '<path d="M18 22H4a2 2 0 0 1-2-2V6"/><path d="m22 13-1.296-1.296a2.41 2.41 0 0 0-3.408 0L11 18"/><circle cx="12" cy="8" r="2"/><rect width="16" height="16" x="6" y="2" rx="2"/>',
  refresh:
    '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  printer:
    '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>',
};

/**
 * @param {keyof typeof ICONS} name
 * @param {string} [cls]
 */
export function icon(name, cls = "icon") {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

/** Fill every `<span data-icon="name">` placeholder in the page. */
export function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => {
    el.outerHTML = icon(
      /** @type {keyof typeof ICONS} */ (el.getAttribute("data-icon")),
      el.getAttribute("class") || "icon",
    );
  });
}

/**
 * Small toast message at the bottom of the screen.
 * @param {string} message
 * @param {"info" | "success" | "error"} [kind]
 * @param {number} [ms]
 */
export function toast(message, kind = "info", ms = 3500) {
  let box = document.getElementById("toasts");
  if (!box) {
    box = h("div", { id: "toasts", role: "status", "aria-live": "polite" });
    document.body.append(box);
  }
  const t = h("div", { class: `toast toast-${kind}` }, [message]);
  box.append(t);
  setTimeout(() => {
    t.classList.add("toast-out");
    setTimeout(() => t.remove(), 300);
  }, ms);
}

/** Facebook / Instagram / Messenger in-app browsers can't save files. */
export const isInAppBrowser = /FBAN|FBAV|FB_IAB|Instagram|Messenger/i.test(navigator.userAgent);

/** Put the event name into every `[data-event-name]` element and the title. */
export function applyEventName() {
  document.querySelectorAll("[data-event-name]").forEach((el) => {
    el.textContent = CONFIG.eventName;
  });
  document.title = document.title.replace("{event}", CONFIG.eventName);
}
