// POST /api/upload → a signed ticket so the browser can upload straight to
// Cloudinary without ever seeing the API secret.
import { json, normaliseCode, sameText, settings, uploadTicket } from "../lib/cloudinary.mjs";

export async function POST(request) {
  const s = settings();
  if (!s) {
    console.error("Cloudinary environment variables are missing");
    return json({ error: "server_not_configured" }, 500);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine
  }

  if (s.code && !sameText(normaliseCode(body?.code), s.code)) {
    return json({ error: "invalid_code" }, 401);
  }

  return json(await uploadTicket(s));
}
