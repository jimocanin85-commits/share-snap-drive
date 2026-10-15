// Lists every photo for this event, newest first.
//
// A photo counts if it has the event tag (EVENT_TAG, stamped by the upload
// page) OR sits in the event's folder (e.g. added by hand in the Cloudinary
// console). Both lookups are merged, so no photo is left out whichever folder
// mode the Cloudinary account uses.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

/** Cloudinary's free plan allows ~500 Admin API calls an hour, so cache briefly. */
const CACHE_MS = 60_000;
const MAX_PAGES = 40; // per lookup: 40 × 500 = 20,000 photos

type CloudinaryResource = {
  public_id: string;
  resource_type?: string;
  secure_url: string;
  created_at: string;
  width?: number;
  height?: number;
};

type Photo = {
  publicId: string;
  thumbnail: string;
  url: string;
  download: string;
  width?: number;
  height?: number;
};

let cache: { tag: string; at: number; images: Photo[] } | null = null;

function json(body: unknown, status = 200, maxAge = 0) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": maxAge ? `public, max-age=${maxAge}` : "no-store",
    },
  });
}

/** Insert a Cloudinary transformation into a delivery URL. */
function withTransform(url: string, t: string) {
  return url.replace("/image/upload/", `/image/upload/${t}/`);
}

/** Page through one Admin API listing. */
async function fetchListing(base: URL, auth: string) {
  const all: CloudinaryResource[] = [];
  let cursor: string | undefined;
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

async function fetchAll(cloudName: string, auth: string, tag: string) {
  const api = `https://api.cloudinary.com/v1_1/${cloudName}`;
  const byTag = new URL(`${api}/resources/image/tags/${encodeURIComponent(tag)}`);
  // Fixed folder mode: the folder is part of the public ID.
  const byPrefix = new URL(`${api}/resources/image/upload`);
  byPrefix.searchParams.set("prefix", `${tag}/`);
  // Dynamic folder mode: the folder is a separate "asset folder".
  const byAssetFolder = new URL(`${api}/resources/by_asset_folder`);
  byAssetFolder.searchParams.set("asset_folder", tag);

  const results = await Promise.allSettled([byTag, byPrefix, byAssetFolder].map((u) => fetchListing(u, auth)));
  const ok = results.filter((r) => r.status === "fulfilled");
  // One lookup failing is normal (e.g. asset folders on a fixed-mode account);
  // all failing means Cloudinary is unreachable.
  if (!ok.length) throw (results[0] as PromiseRejectedResult).reason;

  const merged = new Map<string, CloudinaryResource>();
  for (const r of ok) {
    for (const res of (r as PromiseFulfilledResult<CloudinaryResource[]>).value) {
      if (res.resource_type && res.resource_type !== "image") continue;
      merged.set(res.public_id, res);
    }
  }
  return [...merged.values()];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const cloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME");
  const apiKey = Deno.env.get("CLOUDINARY_API_KEY");
  const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET");
  if (!cloudName || !apiKey || !apiSecret) {
    console.error("Missing Cloudinary secrets");
    return json({ error: "server_not_configured" }, 500);
  }
  const tag = Deno.env.get("EVENT_TAG")?.trim() || "Frivilligfest_2026";

  if (cache && cache.tag === tag && Date.now() - cache.at < CACHE_MS) {
    return json({ images: cache.images }, 200, 30);
  }

  try {
    const resources = await fetchAll(cloudName, btoa(`${apiKey}:${apiSecret}`), tag);
    resources.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));

    const images: Photo[] = resources.map((r) => ({
      publicId: r.public_id,
      // Square grid tile, cropped around the most interesting part.
      thumbnail: withTransform(r.secure_url, "c_fill,g_auto,w_400,h_400,q_auto,f_auto"),
      // Full-screen view: sharp but not the multi-MB original.
      url: withTransform(r.secure_url, "c_limit,w_2400,h_2400,q_auto:good,f_auto"),
      // "Save" button: full resolution as a normal JPEG, sent as a download.
      download: withTransform(r.secure_url, "fl_attachment,f_jpg,q_auto:best"),
      width: r.width,
      height: r.height,
    }));

    cache = { tag, at: Date.now(), images };
    console.log(`Listed ${images.length} photos for tag ${tag}`);
    return json({ images }, 200, 30);
  } catch (err) {
    console.error("Listing photos failed:", err instanceof Error ? err.message : err);
    // A slightly old list beats an error page.
    if (cache && cache.tag === tag) return json({ images: cache.images, stale: true }, 200, 10);
    return json({ error: "list_failed" }, 502);
  }
});
