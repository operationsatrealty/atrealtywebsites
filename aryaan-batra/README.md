# Aryaan Batra — Ray White Manukau

Marketing site, live at aryaan-batra.vercel.app. A per-agent copy of the
`levani-lumon` / `tom-mccartney` build — kept separate on purpose so a change for
one agent can never affect another's site.

```bash
npm install
npm run build          # → dist/   (fetches VaultRE when credentials are set)
npm run build:offline  # → dist/   (uses the data/listings.json snapshot)
```

## Where the numbers come from

Every sales figure, the current listings, the auction banner and the recently
settled cards come from **VaultRE**, fetched at build time by `vaultre.mjs` (same
client as the sister sites). Nothing is hand-typed. Group figures in the "power
behind your sale" band and review counts are not VaultRE data and are still
written in `src/index.template.html`.

The figures replace the 17 Aug 2026 homes.co.nz numbers (149 sales, $137.3m), so
they count **settled sales in A T Realty's VaultRE only**. If Aryaan has sales
that aren't in VaultRE, they won't be in the totals.

Set these in the Vercel project's **Environment Variables** (Production +
Preview):

| Variable | Needed |
|---|---|
| `VAULTRE_API_KEY` | yes |
| `VAULTRE_BEARER_TOKEN_MANUKAU` | yes |
| `VAULTRE_BEARER_TOKEN_MANUREWA` | to find a second staff record, if he has one |
| `VAULTRE_BEARER_TOKEN_AUCKLAND_CENTRAL` | as above |
| `VAULTRE_BEARER_TOKEN_MANGERE_BRIDGE` | as above |

An agent can hold staff records in more than one office, and checking one office
silently drops the rest of their history. Never move VaultRE calls client-side.

**Until the credentials are in, the build stops** rather than publish an empty
site: the committed seed is empty, and Vercel keeps the last good deployment
live when a build fails. After the first live build, commit its `/data.json` as
`data/listings.json` so the fallback has real data.

If VaultRE is down, or returns far fewer sales than the snapshot, the build uses
the snapshot and says so in the log. Odd values (a price with no $ sign, 21 car
spaces) are logged as `Check in VaultRE`, and left as they are for someone to fix
at the source.

## Sale prices

Per-address sale prices aren't shown, as on Ray White's own pages and on
`casey-green`, and they are dropped before the snapshot is written because this
repo is public and the snapshot is published as `/data.json`. Only totals are kept,
in `summary`. `levani-lumon` and `tom-mccartney` do show them.

## Keeping it fresh

`.github/workflows/daily-rebuild.yml` already has a step for this site, which
skips until the secret `VERCEL_DEPLOY_HOOK_ARYAAN_BATRA` exists. Deploy hooks need
the Vercel project connected to this repo (root directory `aryaan-batra`,
production branch `claude/cool-mayer-96prl5`); it was deployed from the CLI until
now. Without a daily rebuild, listings freeze at the last deploy.

## Market news

`blog.html` is still a static page at the folder root, not in `src/`: the
`market-news-refresh` scheduled task rewrites it in place each month and then
deploys this folder.

## Files

```
src/index.template.html   markup, with {{PLACEHOLDER}} slots
src/styles.css            the styles
src/script.js             nav, reveals, video, FAQ, contact form
build.mjs                 fetch → optimise images → render → dist/
vaultre.mjs               VaultRE client (build-time only)
data/listings.json        last good snapshot; the offline fallback
blog.html                 Market news (static)
```
