# Share Snap Drive

Guests scan a QR code at the party, pick photos on their phone, and the photos
land in Cloudinary. Everyone can browse and save them from the gallery.

| Page        | Address    | For                                     |
| ----------- | ---------- | --------------------------------------- |
| Upload      | `/`        | Guests (opened from the QR code)        |
| Gallery     | `/gallery` | Everyone                                |
| QR code     | `/admin`   | The organiser: download or print the QR |

## How it's built

Plain HTML, CSS and JavaScript. There is no framework and no build step:
Vercel serves the `site/` folder as is.

```
site/                    the website (served by Vercel)
  index.html             upload page
  gallery.html           gallery
  admin.html             QR code page
  assets/config.js       ← event name and Supabase project: edit this per event
  assets/*.js / .css     page scripts and styles
supabase/functions/
  upload/                signs uploads so the Cloudinary secret stays private
  get-images/            lists the event's photos for the gallery
```

Photos go straight from the guest's phone to Cloudinary. The `upload`
function only hands out a short-lived signature, and only to visitors whose
link carries the event code.

## Setting up an event

1. **Supabase secrets** (Project → Edge Functions → Secrets):

   | Secret                  | Example              | Notes                                    |
   | ----------------------- | -------------------- | ---------------------------------------- |
   | `CLOUDINARY_CLOUD_NAME` |                      | from the Cloudinary dashboard            |
   | `CLOUDINARY_API_KEY`    |                      |                                          |
   | `CLOUDINARY_API_SECRET` |                      | never put this in `site/`                |
   | `EVENT_TAG`             | `Frivilligfest_2026` | Cloudinary folder **and** tag for photos |
   | `EVENT_CODE`            | `fest26`             | optional, but recommended (see below)    |

2. **Deploy the functions**: `supabase functions deploy upload get-images`
3. **Edit `site/assets/config.js`**: event name (and the Supabase project, if it changed).
4. **Push to GitHub**: Vercel deploys `site/` automatically.
5. **Open `/admin`**, type the same event code, and print or download the QR code.

### The event code

With `EVENT_CODE` set, the upload function refuses anyone whose link doesn't
include `?k=<code>`. The QR code on `/admin` includes it, so guests never type
anything. Without it, anyone who finds the address could fill your Cloudinary
account.

If you change the code, reprint the QR. Guests who already scanned keep
working on the same phone until the code changes.

## Running it locally

Any static file server works, for example:

```sh
npx serve site
```

Pages talk to the live Supabase functions, so uploads made locally are real.

Type-check the scripts (optional, needs TypeScript installed): `npx tsc -p jsconfig.json`
