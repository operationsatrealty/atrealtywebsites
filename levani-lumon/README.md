# Levani Lum-On — Ray White Manukau

Agent marketing website for **Levani Lum-On**, Licensee Salesperson at **Ray White Manukau**
(A T Realty group). Built from the Tom McCartney template in this repo, to Ray White brand
guidelines. Pure static HTML + CSS + vanilla JS, no build step.

## Real data sources (as at 15 July 2026)

| Item | Source |
|------|--------|
| Profile photo | A T Realty Supabase `agent-photos` bucket (`A021/levani-lum-on.jpg`) |
| Contact: `021 525 025`, `levani.lumon@raywhite.com`, Licence `10001803` | `salespersons` / `profiles` tables |
| Office: Ray White Manukau, 603 Great South Road, Manukau City 2104, (09) 213 3621 | raywhite.co.nz profile |
| Bio ("complicated sales" positioning, over 20 years, Executive Performer) | Official raywhite.co.nz bio, July 2026 |
| 223 career sales / $157.6M | homes.co.nz confirmed record, verified 15 Jul 2026 |
| 5.0 rating / 50 verified reviews | RateMyAgent (levani-lum-on-ad083) |
| Awards (Executive Performer 2025/26 etc.) | raywhite.co.nz awards list |
| Current listings (Pah Rd, Cherrington Rd, Kimpton Rd, Coombe Ave) | realestate.co.nz + OneRoof, verified 15 Jul 2026 |
| Recently sold + days-on-market | `realty_sale_method_listings` table |

Deliberate choices from the July 2026 digital audit: a single consistent **over 20 years**
experience claim, no "400 properties" team figure, no Instagram link (account not live),
Facebook + LinkedIn + RateMyAgent in the footer.

## Contact form

Opens the visitor's email client addressed to **levani.lumon@raywhite.com**,
cc **rachel.lumon@raywhite.com** (see `script.js`).

## Deployment

Static Vercel project rooted at this folder (`levani-lumon/`). Domain plan: point
`levanilumonrealestate.co.nz` (Crazy Domains) at it per `../DOMAIN-SETUP.md`, replacing the
old Realbase site.
