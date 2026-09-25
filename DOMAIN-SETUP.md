# Domain setup — `tommccartney.co.nz`

Everything needed to (1) bring the domain into **Crazy Domains** and (2) point it at this
website. Hand this to whoever manages the domain.

---

## Step 1 — Transfer the domain into Crazy Domains

`.nz` domains transfer via a **UDAI** (the auth/transfer key) — there is no losing-registrar
approval email; whoever holds the UDAI controls the move.

1. **Authorisation:** the current registrant (Tom, or the web developer holding it for him)
   must agree to the transfer.
2. **Get the UDAI:** the registrant requests the UDAI from the **current** registrar
   (control panel, or ask the developer who set the site up — likely the "ThreeSix…" dev
   agency, given the `tommccartney.threesixdev.com` staging URL).
3. **Start the transfer:** in Crazy Domains → **Domains → Transfer a Domain** → enter
   `tommccartney.co.nz` → paste the **UDAI**. `.nz` transfers are normally free and complete
   in minutes–hours (no 60-day lock like `.com`).
4. **Secure it:** set the registrant/admin contact to AT Realty operations and enable
   registrar-lock.

> ⚠️ **Before you switch anything, check for existing email.** If `tommccartney.co.nz` is
> used for email, note the current **MX** records first and re-create them at the new DNS so
> mail keeps flowing. Transferring the registrar alone won't break DNS, but changing
> nameservers/zone will.

---

## Step 2 — Point the domain at this website

This site is a static build intended for **Vercel** (see `vercel.json`). Two parts:

### A. Add the domain in Vercel
In the Vercel project → **Settings → Domains** → add **both**:
- `tommccartney.co.nz`
- `www.tommccartney.co.nz`

Vercel will then display the exact records to create. They are normally:

| Host / Name | Type  | Value                     | Notes                    |
|-------------|-------|---------------------------|--------------------------|
| `@` (apex)  | A     | `76.76.21.21`             | the root domain          |
| `www`       | CNAME | `cname.vercel-dns.com`    | the www subdomain        |

> Always use the values Vercel shows you at the time — the table above is Vercel's standard,
> but confirm against the dashboard in case they've changed.

### B. Create those records in Crazy Domains
Crazy Domains → **Manage** the domain → **DNS / Manage DNS (Zone records)** → add the A and
CNAME records above. Keep any existing **MX** (email) records.

DNS propagation is usually minutes, up to a few hours.

### C. Redirect + HTTPS
- Pick a primary (recommended: apex `tommccartney.co.nz`) and set the other (`www`) to
  redirect to it — Vercel does this automatically once both are added.
- **HTTPS:** Vercel auto-provisions a Let's Encrypt certificate once DNS resolves — nothing
  to configure.

---

## Alternative — use Crazy Domains' own nameservers/hosting
If the site will live on Crazy Domains hosting instead of Vercel, point the apex `A` record at
that hosting's IP and `www` `CNAME` at its hostname (from your Crazy Domains hosting panel),
or leave Crazy Domains' default nameservers in place and just add the A/CNAME in the zone.

---

## Quick checklist
- [ ] Registrant authorises the transfer
- [ ] UDAI obtained from current registrar
- [ ] Existing MX/email records recorded
- [ ] Transfer initiated in Crazy Domains (UDAI pasted)
- [ ] Domain added in Vercel (apex + www)
- [ ] A + CNAME records created in Crazy Domains DNS
- [ ] MX records re-created (if email is used)
- [ ] HTTPS green + `www` redirect working
