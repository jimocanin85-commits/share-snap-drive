# Share Snap Drive

Billeddeling til Frivilligfesten. Gæsterne scanner en QR-kode, vælger billeder
på telefonen, og billederne lander i Cloudinary. Alle kan se og gemme dem i
galleriet, og de vises løbende på storskærmen.

Live: <https://share-snap-drive.vercel.app>

| Side          | Adresse      | Til                                       |
| ------------- | ------------ | ----------------------------------------- |
| Upload        | `/`          | Gæsterne (åbnes fra QR-koden)             |
| Galleri       | `/gallery`   | Alle                                      |
| QR-kode       | `/admin`     | Arrangøren: download eller print QR-koden |
| Lysbilledshow | `/slideshow` | Projektor eller storskærm til festen      |

## Sådan er det bygget

Almindelig HTML, CSS og JavaScript, som kører på Vercel. Der er intet
framework, intet byggetrin og ingen pakker: Vercel viser mappen `site/`, som
den er, og kører de to små funktioner i `api/`.

```
site/                    hjemmesiden
  index.html             uploadside
  gallery.html           galleri
  admin.html             QR-kode
  slideshow.html         lysbilledshow til projektor
  404.html               "siden findes ikke"
  assets/config.js       ← festens navn: ret her til næste fest
  assets/*.js / .css     sidernes kode og udseende
  assets/fonts/          Big Shoulders Display + Figtree (OFL-licens, ligger lokalt)
api/                     Vercel-funktioner
  upload.mjs             giver en kortvarig upload-tilladelse, så Cloudinary-nøglen forbliver hemmelig
  get-images.mjs         henter festens billeder til galleri og lysbilledshow
lib/cloudinary.mjs       fælles Cloudinary-kode til de to funktioner
```

Billederne sendes direkte fra gæstens telefon til Cloudinary. Billeder over
10 MB gøres mindre på telefonen først (grænsen på Cloudinarys gratis plan).

Galleriet og lysbilledshowet viser alle billeder i festens mappe, nyeste
først, også billeder lagt direkte ind i Cloudinary. Listen gemmes i op til et
halvt minut ad gangen, så nye billeder dukker op inden for cirka et minut.

## Opsætning

1. **Miljøvariabler i Vercel** (projekt → Settings → Environment Variables,
   sæt flueben ved Production, Preview og Development):

   | Variabel                | Værdi                                | Bemærkning                                 |
   | ----------------------- | ------------------------------------ | ------------------------------------------ |
   | `CLOUDINARY_CLOUD_NAME` | fra Cloudinary → Settings → API Keys |                                            |
   | `CLOUDINARY_API_KEY`    | samme sted                           |                                            |
   | `CLOUDINARY_API_SECRET` | samme sted                           | må aldrig stå i `site/`                    |
   | `EVENT_TAG`             | fx `Frivilligfest_2028`              | valgfri; standard er `Frivilligfest_2027`  |
   | `EVENT_CODE`            |                                      | valgfri, bruges ikke (se nedenfor)         |

   Vercel bruger først ændrede variabler ved næste udgivelse: tryk
   Deployments → ⋯ → **Redeploy** efter en ændring.
2. **Push til GitHub.** Vercel udgiver automatisk fra `main`.
3. **Åbn `/admin`**, og download eller print QR-koden. Den er bare sidens
   adresse, så den er den samme hver gang.

### Til næste fest

1. Ret `eventName` i `site/assets/config.js`, fx til `Frivilligfesten 2028`.
2. Opret en ny mappe i Cloudinary, og sæt `EVENT_TAG` i Vercel til mappens
   navn. Så starter galleriet forfra, og sidste års billeder bliver liggende
   i deres egen mappe.
3. Redeploy i Vercel.

### Lysbilledshow på projektor

Slut laptoppen til projektoren med HDMI, og åbn `/slideshow` (der er en knap
på `/admin`). Hvis projektoren er en udvidet skærm, så træk først vinduet over
på projektoren. Tryk **Start**. Siden går i fuld skærm og holder selv
skærmen tændt, også uden at nogen rører mus eller tastatur. Hold alligevel
laptoppen til strøm, for på batteri kan strømspareindstillinger overrule
browseren. Hvert billede vises i 8 sekunder (kan ændres), nye billeder vises
først, og en QR-kode i hjørnet lader gæsterne være med.

Taster: mellemrum pause, ← → skift billede, F fuld skærm, Q vis/skjul QR-kode.
Kontrollerne vises, når musen flyttes.

### Event-kode (valgfri)

Frivilligfesten bruger ingen kode, fordi linket ikke deles uden for festen.
Alle med adressen kan uploade.

Skal en anden fest have en kode, så sæt `EVENT_CODE` i Vercel og åbn
`/admin?code=<koden>`. Koden kommer så med i QR-koden, gæsterne taster stadig
intet, og uploads uden koden afvises. Mellemrum og store/små bogstaver er
ligegyldige.

## Kør lokalt

Med [Vercel CLI](https://vercel.com/docs/cli), som også kører `api/`:

```sh
npx vercel link       # første gang
npx vercel env pull   # henter variablerne til .env.local
npx vercel dev
```

Uploads lavet lokalt havner i den rigtige Cloudinary-konto.

Tjek koden for fejl (valgfrit, kræver TypeScript): `npx tsc -p jsconfig.json`
