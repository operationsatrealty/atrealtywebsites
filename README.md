# Tom McCartney — Ray White Manurewa

A modern, single-page marketing website for **Tom McCartney**, Licensee Salesperson &
Branch Manager at **Ray White Manurewa** (part of the A T Realty group, South & Central
Auckland).

The design mirrors the structure of the sister site
[patlapalapagroup.co.nz](https://patlapalapagroup.co.nz) (hero → stats → about → network
data → services → why → listings → reviews → contact) and is built strictly to the official
**Ray White brand guidelines**.

## Brand system

Pulled directly from Ray White's *"Brand in brief"* guideline document:

| Token        | Value     | Use                                   |
|--------------|-----------|---------------------------------------|
| Yellow       | `#FFE512` | Primary accent, buttons, highlights   |
| Dark Grey    | `#595959` | Body text                             |
| Light Grey   | `#EBEBEC` | Borders, soft backgrounds             |
| White        | `#FFFFFF` | Base background                       |

**Typography:** [Lato](https://fonts.google.com/specimen/Lato) (primary — body & headings)
and [Playfair Display](https://fonts.google.com/specimen/Playfair+Display) (secondary —
major headings, used sparingly), loaded via Google Fonts. Tone of voice is energetic,
approachable and sentence-case, per the guidelines.

## Tech

Pure static **HTML + CSS + vanilla JS** — no build step, no dependencies. Deploys anywhere.

```
index.html      # markup & content
styles.css      # full brand design system
script.js       # mobile nav, scroll reveals, counters, form
assets/
  raywhite-logo.svg         # horizontal logo (dark text)
  raywhite-logo-white.svg   # reversed logo for dark footer
  favicon.svg               # iconic yellow square
  tom-portrait.svg          # portrait PLACEHOLDER (see below)
vercel.json     # static hosting config
```

### Local preview

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## ⚠️ Before going live — items to replace

A few pieces use placeholders because the live source data could not be retrieved from this
sandboxed environment (outbound access is restricted to Google services). Swap them in:

1. **Tom's photo.** `assets/tom-portrait.svg` is a branded placeholder. Drop in a real
   outdoor lifestyle headshot (Ray White guidelines require an outdoor, colour, landscape/
   portrait lifestyle photo) — e.g. add `assets/tom.jpg` and update the two `<img>` `src`
   references in `index.html` (hero + about). The og:image meta tag too.
2. **Logo.** The Ray White logo here is a faithful SVG reproduction. For production, replace
   `assets/raywhite-logo*.svg` with the official asset from
   [Whiteboard / Brand Central](https://whiteboard.raywhite.com) to stay compliant with the
   trademark guidelines.
3. **Contact details.** Phone `09 263 7100` and email `tom.mccartney@raywhite.com` are the
   Ray White Manurewa office defaults — confirm Tom's direct line/mobile.
4. **Listings.** The three property cards are representative samples (marked with a code
   comment). Connect a live feed or replace with current listings.
5. **Reviews.** Testimonials are representative, based on the documented quality themes from
   Tom's RateMyAgent reviews (well prepared, honest, reliable, local expert, clear
   communicator, dedicated, friendly). Replace with verified client quotes.
6. **Contact form.** `script.js` shows a front-end success state only. Wire the form to a
   real handler (Formspree, Netlify Forms, or a serverless route) to deliver enquiries.

## Sourced content (real)

- **Bio:** ex-professional rugby (hooker; Auckland & the Blues for 8 years, then Connacht in
  Ireland), 5+ years in real estate, $100m+ settled sales, bought first home at 22, active
  South Auckland investor/builder, expert in yield/multi-income/land-banking/development.
- **A T Realty group data** (from the group's Brand Knowledge collateral): $19.8m record
  sale, 15,549 customers served annually, 2,248 sales p.a., 1,793 properties under
  management, 5 offices across South & Central Auckland.
