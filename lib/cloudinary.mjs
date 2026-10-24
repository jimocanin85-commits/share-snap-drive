// Shared server code for the two Vercel Functions in /api.
//
// Environment variables (Vercel → Project → Settings → Environment Variables):
//   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET  (required)
//   EVENT_TAG   Cloudinary folder + tag for this event (default Frivilligfest_2026)
//   EVENT_CODE  If set, uploads need ?k=<code> in the link (the QR code carries it)

export const DEFAULT_TAG = "Frivilligfest_2026";

/** Only real photo formats; Cloudinary rejects anything else. */
export const ALLOWED_FORMATS = "jpg,jpeg,png,heic,heif,webp,gif,avif,tif,tiff";

/** Read settings from the environment. Returns null when Cloudinary isn't set up. */
export function settings(env = process.env) {
  const cloudName = env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) return null;
  return {
    cloudName,
    apiKey,
    apiSecret,
    tag: env.EVENT_TAG?.trim() || DEFAULT_TAG,
    code: env.EVENT_CODE?.trim() || "",
  };
}

/** JSON response. `cache` is a full set of extra headers, if any. */
export function json(body, status = 200, cache = { "Cache-Control": "no-store" }) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cache },
  });
}

async function sha1Hex(text) {
  const hash = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Cloudinary signature: params sorted by name, joined, then the secret appended. */
export function sign(params, secret) {
  const payload = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return sha1Hex(payload + secret);
}

/** Compare without leaking how many characters matched. */
export function sameText(a, b) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** A signed "ticket" the browser uses to upload straight to Cloudinary. */
export async function uploadTicket(s, now = Date.now()) {
  const timestamp = Math.floor(now / 1000);
  const params = { allowed_formats: ALLOWED_FORMATS, folder: s.tag, tags: s.tag };
  return {
    cloudName: s.cloudName,
    apiKey: s.apiKey,
    timestamp,
    params,
    signature: await sign({ ...params, timestamp }, s.apiSecret),
  };
}

// ---------- Listing photos ----------

const MAX_PAGES = 40; // per lookup: 40 × 500 = 20,000 photos

/** Insert a Cloudinary transformation into a delivery URL. */
function withTransform(url, t) {
  return url.replace("/image/upload/", `/image/upload/${t}/`);
}

/** Page through one Admin API listing. */
async function fetchListing(base, auth) {
  const all = [];
  let cursor;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(base);
    url.searchParams.set("max_results", "500");
    if (cursor) url.searchParams.set("next_cursor", cursor);
    const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
    if (!res.ok) throw new Error(`Cloudinary ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    all.push(...(data.resources ?? []));
    cursor = data.next_cursor;
    if (!cursor) break;
  }
  return all;
}

/**
 * Every photo for the event, newest first. A photo counts if it has the event
 * tag (stamped by the upload page) OR sits in the event folder (e.g. added by
 * hand in the Cloudinary console), whichever folder mode the account uses.
 */
export async function listPhotos(s) {
  const api = `https://api.cloudinary.com/v1_1/${s.cloudName}`;
  const byTag = new URL(`${api}/resources/image/tags/${encodeURIComponent(s.tag)}`);
  // Fixed folder mode: the folder is part of the public ID.
  const byPrefix = new URL(`${api}/resources/image/upload`);
  byPrefix.searchParams.set("prefix", `${s.tag}/`);
  // Dynamic folder mode: the folder is a separate "asset folder".
  const byAssetFolder = new URL(`${api}/resources/by_asset_folder`);
  byAssetFolder.searchParams.set("asset_folder", s.tag);

  const auth = btoa(`${s.apiKey}:${s.apiSecret}`);
  const results = await Promise.allSettled([byTag, byPrefix, byAssetFolder].map((u) => fetchListing(u, auth)));
  const ok = results.filter((r) => r.status === "fulfilled");
  // One lookup failing is normal (e.g. asset folders on a fixed-mode account);
  // all failing means Cloudinary is unreachable or the keys are wrong.
  if (!ok.length) throw results[0].reason;

  const merged = new Map();
  for (const r of ok) {
    for (const res of r.value) {
      if (res.resource_type && res.resource_type !== "image") continue;
      merged.set(res.public_id, res);
    }
  }

  return [...merged.values()]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
    .map((r) => ({
      publicId: r.public_id,
      // Gallery tile: keeps the photo's own shape (rows are laid out by aspect ratio).
      thumbnail: withTransform(r.secure_url, "c_limit,w_800,h_480,q_auto,f_auto"),
      // Full-screen view: sharp but not the multi-MB original.
      url: withTransform(r.secure_url, "c_limit,w_2400,h_2400,q_auto:good,f_auto"),
      // "Save" button: full resolution as a normal JPEG, sent as a download.
      download: withTransform(r.secure_url, "fl_attachment,f_jpg,q_auto:best"),
      width: r.width,
      height: r.height,
    }));
}
