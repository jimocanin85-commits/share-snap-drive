# Share Snap Drive

Guests scan a QR code at the party, pick photos on their phone, and the photos
land in Cloudinary. Everyone can browse and save them from the gallery.

| Page        | Address    | For                                     |
| ----------- | ---------- | --------------------------------------- |
| Upload      | `/`        | Guests (opened from the QR code)        |
| Gallery     | `/gallery` | Everyone                                |
| QR code     | `/admin`   | The organiser: download or print the QR |
| Slideshow   | `/slideshow` | A projector or TV at the party        |

## How it's built

Plain HTML, CSS and JavaScript, hosted entirely on Vercel. There is no
framework, no build step and no dependencies: Vercel serves the `site/` folder
as is and runs the two small functions in `api/`.

```
site/                    the website (served by Vercel)
  index.html             upload page
  gallery.html           gallery
  admin.html             QR code page
  slideshow.html         full-screen slideshow for a projector
  assets/config.js       ← event name: edit this per event
  assets/*.js / .css     page scripts and styles
  assets/fonts/          Big Shoulders Display + Figtree (OFL, self-hosted)
api/                     Vercel Functions
  upload.mjs             signs uploads so the Cloudinary secret stays private
  get-images.mjs         lists the event's photos for the gallery and slideshow
lib/cloudinary.mjs       shared Cloudinary code for the two functions
```

Photos go straight from the guest's phone to Cloudinary. The `upload`
function only hands out a short-lived signature, and only to visitors whose
link carries the event code.

## Setting up an event

1. **Vercel environment variables** (Project → Settings → Environment Variables,
   tick Production, Preview and Development):

   | Variable                | Example              | Notes                                         |
   | ----------------------- | -------------------- | --------------------------------------------- |
   | `CLOUDINARY_CLOUD_NAME` |                      | Cloudinary → Settings → API Keys              |
   | `CLOUDINARY_API_KEY`    |                      |                                               |
   | `CLOUDINARY_API_SECRET` |                      | never put this in `site/`                     |
   | `EVENT_TAG`             | `Frivilligfest_2027` | optional; Cloudinary folder **and** tag       |
   | `EVENT_CODE`            | `fest27`             | optional, but recommended (see below)         |

   Vercel only applies changed variables to new deployments: after editing
   them, redeploy (Deployments → ⋯ → Redeploy).
2. **Edit `site/assets/config.js`**: the event name.
3. **Push to GitHub**: Vercel deploys automatically.
4. **Open `/admin`**, type the same event code, and print or download the QR code.

### Showing photos on a projector

Connect the laptop to the projector with HDMI and open `/slideshow` (there's a
button on `/admin`). If the projector extends the screen rather than
mirroring it, drag the browser window onto the projector first, then press
**Start**. The page goes full screen, keeps the laptop from sleeping, shows
each photo for 8 seconds (adjustable), and puts new uploads on screen within
about a minute. A QR code in the corner lets guests join in. It uses the event
code typed on `/admin` on the same laptop.

Keys: space pauses, ← → skip, F toggles full screen, Q hides the QR code.
Moving the mouse shows the controls.

### The event code

With `EVENT_CODE` set, the upload function refuses anyone whose link doesn't
include `?k=<code>`. The QR code on `/admin` includes it, so guests never type
anything. Without it, anyone who finds the address could fill your Cloudinary
account.

If you change the code, reprint the QR. Guests who already scanned keep
working on the same phone until the code changes.

## Running it locally

With the [Vercel CLI](https://vercel.com/docs/cli), which also runs `api/`:

```sh
npx vercel link       # once
npx vercel env pull   # copies the variables into .env.local
npx vercel dev
```

Uploads made locally go to the real Cloudinary account.

Type-check the scripts (optional, needs TypeScript installed): `npx tsc -p jsconfig.json`
