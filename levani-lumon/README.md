# Levani Lum-On — Ray White Manukau

Marketing site for **levanilumon.co.nz** (currently serving at
levani-lumon.vercel.app until the Crazy Domains DNS cutover). A per-agent copy
of the `tom-mccartney` build — kept separate on purpose so a change for one
agent can never affect another's site.

```bash
npm install
npm run build          # → dist/   (fetches VaultRE; needs credentials)
npm run build:offline  # → dist/   (uses data/listings.json snapshot)
npm run preview:file   # → dist-preview/index.html, one self-contained file
```

## Where the numbers come from

Everything in the stat rows, listings and sold table is Levani's real data from
**VaultRE**, fetched at build time by `vaultre.mjs` (same client as Tom's site).
Levani holds staff records in **two offices — Manukau AND Manurewa** — both are
fetched and merged. As at 24 Sep 2026 that's 301 settled sales, $212m.

The Vercel project needs these environment variables for live builds (values
are the group's shared VaultRE credentials, marked Sensitive on the
`tom-mccartney` and `atrealty-next` projects — copy them in the dashboard):

| Variable | Needed |
|---|---|
| `VAULTRE_API_KEY` | yes |
| `VAULTRE_BEARER_TOKEN_MANUKAU` | yes |
| `VAULTRE_BEARER_TOKEN_MANUREWA` | yes — second staff record lives here |

**Until they're added**, builds fall back to `data/listings.json`, the last
good snapshot (currently the 24 Sep 2026 harvest). The build refuses to run if
the snapshot is the empty seed. Never move VaultRE calls client-side.

## Keeping it fresh

- **Daily rebuild**: `.github/workflows/daily-rebuild.yml` POSTs the Vercel
  deploy hook (secret `VERCEL_DEPLOY_HOOK_LEVANI_LUMON`, already set) at
  5–6am NZ. With the env vars above in place this re-fetches VaultRE daily.
- **Git**: the `levani-lumon` Vercel project is connected to this repo
  (root directory `levani-lumon`, production branch `claude/cool-mayer-96prl5`),
  so every push also redeploys.
- **Market news**: posts live in `data/market-news.json` and are rendered to
  `/blog` at build time. Refreshing the page is a data edit + push, no code.
  The build warns loudly when `updatedAt` is over 45 days old. A monthly
  scheduled refresh keeps it current — if the warning appears, the schedule
  has stopped.
  `paragraphs` entries are trusted HTML (they may contain `<strong>` links
  etc.); `bullets` and `sources` are escaped.

## The appraisal panel

The A T Realty marketing form for Levani **does not exist yet** — checked
24 Sep 2026, both plausible slugs 404 on atrealtygroup.co.nz. Until it's
created, the contact panel renders direct actions: email (to
levani.lumon@raywhite.com, **cc rachel.lumon@raywhite.com** — a standing rule
for Levani's enquiries) and phone.

To switch to the embedded form: duplicate "Sales Appraisal - Tom McCartney" in
the marketing-forms admin, name it "Sales Appraisal - Levani Lum-On", assignee
`levani.lumon@raywhite.com`, **add an email notification row (cc Rachel)** —
then set `FORM_READY = true` in `build.mjs`, confirm `FORM_SLUG`, redeploy.

## Portrait

`assets/levani-portrait.jpg` is the 2419×2419 original behind his
raywhite.co.nz profile photo (Ray White member-photo CDN), committed as the
master. The Supabase agent-photos copy is only 1280×720 landscape — worth
replacing in the bucket too, the main site still uses it.

## Domain

`levanilumon.co.nz` at Crazy Domains. Cutover per `../DOMAIN-SETUP.md`: add
apex + www to the `levani-lumon` Vercel project, A `76.76.21.21`, CNAME
`cname.vercel-dns.com`. Canonical/og URLs already point at the domain.
