# Tom McCartney — Ray White Manurewa

A modern, responsive marketing website for **Tom McCartney**, Licensee Salesperson at
**Ray White Manurewa** (part of the A T Realty group, South & Central Auckland).

Structured to mirror [patlapalapagroup.co.nz](https://patlapalapagroup.co.nz) and built to the
official **Ray White brand guidelines**.

## Real data sources

Almost everything on the page is real, pulled from authoritative sources:

| Item | Source |
|------|--------|
| Tom's profile photo | A T Realty Supabase `agent-photos` public bucket (`A100/tom-mccartney.png`) |
| Contact: `021 856 286`, `tom.mccartney@raywhite.com`, Licence `20113399` | `salespersons` / `profiles` tables |
| Office: Ray White Manurewa, 182 Great South Road, Manurewa 2102, (09) 269 0636 | `office_spaces` table |
| Current & recently-sold listings (real addresses, methods, days-on-market) | `realty_sale_method_listings` table |
| Track-record stats ($100m+, 29 listings this year, 90+ sales/3yrs) | `salespersons` + public bio |
| A T Realty group data ($19.8m record, 15,549 customers, etc.) | Brand Knowledge collateral |
| Ray White logo | Extracted from the official Ray White *Brand in brief* PDF |
| Brand palette & fonts | Ray White *Brand in brief* guidelines |

## Brand system

| Token | Value | Use |
|-------|-------|-----|
| Yellow | `#FFE512` | Primary accent, buttons, highlights |
| Dark Grey | `#595959` | Body text |
| Light Grey | `#EBEBEC` | Borders, soft backgrounds |
| White | `#FFFFFF` | Base background |

**Typography:** [Lato](https://fonts.google.com/specimen/Lato) (body & headings) +
[Playfair Display](https://fonts.google.com/specimen/Playfair+Display) (major headings),
via Google Fonts.

## Tech

Pure static **HTML + CSS + vanilla JS** — no build step, no dependencies.

```
index.html      # markup & content
styles.css      # full brand design system
script.js       # mobile nav, scroll reveals, animated counters, contact form
assets/
  raywhite-logo.png   # official Ray White logo (from brand book)
  raywhite-mark.png   # logo mark for dark footer
  favicon.png
  tom-portrait.svg    # fallback shown only if the photo URL can't load
vercel.json     # static hosting config
```

### Local preview

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## The contact form

Submitting opens the visitor's email client pre-addressed to
**tom.mccartney@raywhite.com**, cc **hannah.williams@raywhite.com**, with the form fields in
the body (see `script.js`). To send entirely server-side (no email client), POST the fields
to a serverless route or a form service (Formspree / Resend) keeping the same To/Cc.

## Notes / to confirm before going live

- **Reviews:** RateMyAgent reviews aren't available via the data backend, so the Reviews
  section links to Tom's verified [RateMyAgent profile](https://www.ratemyagent.co.nz/real-estate-agent/tom-mccartney-ar184/sales/overview)
  and shows the documented quality themes rather than inventing quotes. Embed live reviews if desired.
- **Listing photos / ad copy:** the live property photos and marketing blurbs live on the
  TradeMe / realestate.co.nz / Ray White feed (not in the data backend), so listing cards show
  real address, method, status and days-on-market. Wire a listings feed to add photos.
- **Logo:** the bundled logo is extracted from the official Ray White brand PDF; for production
  you may swap in the vector asset from Whiteboard / Brand Central.
