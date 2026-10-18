# Casey Green — Ray White Auckland Central

Marketing site for Casey Green, Licensee Salesperson at Ray White Auckland
Central, who sells across greater Ponsonby and the city fringe. Laid out after
[edwardpackbayleys.co.nz](https://www.edwardpackbayleys.co.nz/) (about,
listings, recent sales, testimonials, contact), branded to the Ray White
guidelines like the sister sites, plus one page per suburb for search.

A per-agent copy of the `levani-lumon` / `tom-mccartney` build — kept separate
on purpose so a change for one agent can never affect another's site.

```bash
npm install
npm run build          # → dist/   (fetches VaultRE when credentials are set)
npm run build:offline  # → dist/   (uses the data/listings.json snapshot)
```

## Pages

| Path | What it is |
|---|---|
| `/` | Hero, intro, testimonials, current listings, recent sales, areas, live Instagram, community, appraisal form |
| `/about` | Full bio, how Casey works, Bayfield School Garden to Table |
| `/listings` | Current listings (VaultRE), linking to the Ray White listing pages |
| `/recent-sales` | Every sale: VaultRE settled sales, then her Ray White Grey Lynn sales |
| `/testimonials` | Client reviews |
| `/contact` | The appraisal form, contact details and office |
| `/areas` and `/areas/<suburb>` | Herne Bay, Ponsonby, Grey Lynn, St Marys Bay, Freemans Bay, Westmere, Point Chevalier |

## Where the content comes from

| File | Source |
|---|---|
| `data/listings.json` | VaultRE snapshot, refreshed by every live build (see below). Seeded 18 Oct 2026 from her A T Realty profile, which reads the same endpoints. |
| `data/historic-sales.json` | Her 25 sales at Ray White Grey Lynn before she joined A T Realty. They aren't in our VaultRE; this is the same list raywhiteatrealty.co.nz shows. No prices or dates are published for them. |
| `data/profile.json` | Bio, community and contact details from her A T Realty profile; licence number from the Super App. |
| `data/testimonials.json` | Word for word from her homes.co.nz profile. Add new ones here; never paraphrase or invent one. |
| `data/areas.json` | The suburb pages. Descriptive copy only — no prices, medians or market statistics, which go stale and need a licensed source. |

Sale prices are never shown, as on Ray White's own pages, and the build drops
them from VaultRE's answer before the snapshot is written — this repo is public
and the snapshot is also published as `/data.json`.

### VaultRE credentials

Set in the Vercel project's **Environment Variables** (Production + Preview) —
the same values as the other agent sites:

| Variable | Needed |
|---|---|
| `VAULTRE_API_KEY` | yes |
| `VAULTRE_BEARER_TOKEN_AUCKLAND_CENTRAL` | yes — Casey's staff record is in Auckland Central |

Without them the build uses `data/listings.json` and says so in the log.
Unlike the sister sites, an empty sold list from VaultRE is normal for Casey
(her earlier sales are at another franchise), so a live answer is accepted as
long as her staff record was found. Never move VaultRE calls client-side.

### Keeping it fresh

`.github/workflows/daily-rebuild.yml` POSTs the deploy hook in the repository
secret `VERCEL_DEPLOY_HOOK_CASEY_GREEN` once a day. Until that secret exists the
step is skipped, not failed.

## The appraisal form

Casey's A T Realty marketing form, `casey-green-sales-appraisal`, embedded with
the standard loader:

```html
<script src="https://atrealtygroup.co.nz/mkt-forms-embed.js" async></script>
<div data-atr-form="casey-green-sales-appraisal"></div>
```

The script is on every page, so the "Free appraisal" buttons open the form as a
popup. The inline form at the foot of each page is written as
`data-atr-form-lazy` and handed to the loader (`ATRForms.scan()`) only when it
scrolls near the screen: the form is a whole app with its own tracking, and
loading it up front on every page cost about 400 KB before the visitor had
seen anything. Leads carry the page they came from (`atr_src`), so a lead from
`/areas/herne-bay` says so.

## Instagram — live feed

The home page's "Latest on Instagram" section shows Casey's latest nine posts,
live, once her account is connected; until then it shows a follow card. The
whole system is in `lib/instagram.mjs` (setup notes at the top), with thin
Vercel Functions in `api/instagram/`:

| Route | What it does |
|---|---|
| `/api/instagram/connect` | Status page. With the connect key: **Connect Instagram** (Casey logs in on Instagram's own screen) or **Disconnect**. |
| `/api/instagram/callback` | Instagram returns here; the code becomes a 60-day token, stored in the private Blob store. Only @caseygreen.raywhite is accepted. |
| `/api/instagram/feed` | Latest posts as JSON (links and image URLs, never the token), cached at the CDN for 15 minutes. `src/script.js` turns it into the grid. |
| `/api/instagram/refresh` | Weekly cron (`vercel.json`) that renews the token, so it never runs out. The feed also renews it if it gets within 14 days. |

Uses Meta's Instagram API with Instagram Login (the old Basic Display API was
switched off in December 2024), so Casey's account must be a **professional**
account (Business or Creator — free to switch in the Instagram app).

### One-time setup

1. **Meta app** (one app can serve every agent site): developers.facebook.com
   → Create app → use case *Manage messaging & content on Instagram* → type
   *Business*. Then Instagram → *API setup with Instagram login*:
   - copy the **Instagram app ID** and **Instagram app secret**;
   - *Set up Instagram business login* → *Business login settings* → add the
     OAuth redirect URI shown at the bottom of `/api/instagram/connect`
     (e.g. `https://casey-green.vercel.app/api/instagram/callback`; add the
     custom domain's one too when it's live);
   - App roles → Roles → add **caseygreen.raywhite** as an *Instagram Tester*.
     Casey accepts in Instagram → Settings → *Website permissions* → *Apps and
     websites* → *Tester invites* (or at instagram.com/accounts/manage_access).
2. **Vercel** (project → Storage): create a **Blob** store with **Private**
   access and connect it to this project — that adds `BLOB_READ_WRITE_TOKEN`.
3. **Vercel** (project → Settings → Environment Variables, Production +
   Preview): `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`,
   `INSTAGRAM_CONNECT_KEY` (any long password — you type it on the connect
   page) and `CRON_SECRET` (any long random string). Redeploy.

### Connecting, with Casey

Open `/api/instagram/connect` on the site, enter the connect key, press
**Connect Instagram**, and let Casey log in to Instagram and tap **Allow**.
The page confirms "Connected as @caseygreen.raywhite" and the grid appears on
the home page within about five minutes. Nothing else is needed after that;
if the connection ever breaks (she changes her password, removes the app),
the status page says so and the site quietly falls back to the follow card.

`npm test` runs the whole flow against a fake Instagram.

## SEO

- One title, description, canonical and Open Graph image per page; JSON-LD for
  the agent (`RealEstateAgent`, with every suburb as `areaServed`), breadcrumbs
  and the suburb FAQs.
- `sitemap.xml` and `robots.txt` are generated by the build.
- The canonical origin is `SITE_ORIGIN` if set, else the production domain
  Vercel exposes (`VERCEL_PROJECT_PRODUCTION_URL`), else
  `https://casey-green.vercel.app`. Adding the custom domain to the Vercel
  project is enough; the next build picks it up.
- Lighthouse (mobile), 18 Oct 2026: 99–100 for performance, accessibility,
  best practices and SEO on `/`, `/areas/ponsonby` and `/recent-sales`.

## Domain

Not decided yet. When it is, follow `../DOMAIN-SETUP.md` (apex + www on the
Vercel project) — nothing in the code needs to change.
