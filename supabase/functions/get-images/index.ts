// Lists every photo uploaded for this event, newest first.
//
// Photos are found by their tag (EVENT_TAG, the same value the upload
// function stamps on each photo), which works whatever folder mode the
// Cloudinary account uses.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

/** Cloudinary's free plan allows ~500 Admin API calls an hour, so cache briefly. */
const CACHE_MS = 60_000;
const MAX_PAGES = 20; // 20 × 500 = 10,000 photos

type CloudinaryResource = {
  public_id: string;
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

async function fetchAll(cloudName: string, auth: string, tag: string) {
  const all: CloudinaryResource[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(
      `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/tags/${encodeURIComponent(tag)}`,
    );
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
