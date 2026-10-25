// GET /api/get-images → every photo for the event, newest first.
import { json, listPhotos, settings } from "../lib/cloudinary.mjs";

/**
 * Cloudinary's free plan allows ~500 Admin API calls an hour. Vercel's CDN
 * answers repeat requests for 30 s (and serves the old list while refreshing
 * for 2 more minutes), and each function instance keeps its own copy too.
 */
const CDN_CACHE = {
  "Cache-Control": "public, max-age=0, must-revalidate",
  "Vercel-CDN-Cache-Control": "max-age=30, stale-while-revalidate=120, stale-if-error=3600",
};
const MEMORY_MS = 30_000;

let cache = null; // { tag, at, images }

export async function GET() {
  const s = settings();
  if (!s) {
    console.error("Cloudinary environment variables are missing");
    return json({ error: "server_not_configured" }, 500);
  }

  if (cache && cache.tag === s.tag && Date.now() - cache.at < MEMORY_MS) {
    return json({ images: cache.images }, 200, CDN_CACHE);
  }

  try {
    const images = await listPhotos(s);
    cache = { tag: s.tag, at: Date.now(), images };
    console.log(`Listed ${images.length} photos for tag ${s.tag}`);
    return json({ images }, 200, CDN_CACHE);
  } catch (err) {
    console.error("Listing photos failed:", err instanceof Error ? err.message : err);
    // A slightly old list beats an error page.
    if (cache && cache.tag === s.tag) return json({ images: cache.images, stale: true });
    return json({ error: "list_failed" }, 502);
  }
}
