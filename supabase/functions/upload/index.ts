// Hands out a signed "ticket" so the browser can upload straight to
// Cloudinary without ever seeing the API secret.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET  (required)
//   EVENT_TAG   Cloudinary folder + tag for this event (default Frivilligfest_2026)
//   EVENT_CODE  If set, uploads need ?k=<code> in the link (the QR code carries it)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Only real photo formats; Cloudinary rejects anything else. */
const ALLOWED_FORMATS = "jpg,jpeg,png,heic,heif,webp,gif,avif,tif,tiff";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function sha1Hex(text: string) {
  const hash = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Cloudinary signature: params sorted by name, joined, then the secret appended. */
function sign(params: Record<string, string | number>, secret: string) {
  const payload = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return sha1Hex(payload + secret);
}

/** Compare without leaking how many characters matched. */
function sameText(a: string, b: string) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const cloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME");
  const apiKey = Deno.env.get("CLOUDINARY_API_KEY");
  const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET");
  if (!cloudName || !apiKey || !apiSecret) {
    console.error("Missing Cloudinary secrets");
    return json({ error: "server_not_configured" }, 500);
  }

  const tag = Deno.env.get("EVENT_TAG")?.trim() || "Frivilligfest_2026";
  const requiredCode = Deno.env.get("EVENT_CODE")?.trim();

  let body: { code?: unknown; fileCount?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }

  if (requiredCode && !sameText(String(body.code ?? "").trim(), requiredCode)) {
    return json({ error: "invalid_code" }, 401);
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const params = { allowed_formats: ALLOWED_FORMATS, folder: tag, tags: tag };
  const ticket: Record<string, unknown> = {
    cloudName,
    apiKey,
    timestamp,
    params,
    signature: await sign({ ...params, timestamp }, apiSecret),
  };

  // Compatibility with the old React site (still live until Vercel redeploys):
  // it asks for one signature per file and doesn't send allowed_formats.
  const legacyCount = Number(body.fileCount);
  if (Number.isFinite(legacyCount) && legacyCount > 0) {
    const legacySig = await sign({ folder: tag, tags: tag, timestamp }, apiSecret);
    ticket.signatures = Array.from({ length: Math.min(10, Math.floor(legacyCount)) }, () => ({
      timestamp,
      signature: legacySig,
      folder: tag,
      tags: tag,
      cloudName,
      apiKey,
    }));
  }

  return json(ticket);
});
