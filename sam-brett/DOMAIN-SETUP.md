# Domain Setup: samandbrett.co.nz → Vercel

## Overview

The domain **samandbrett.co.nz** currently points to the old WordPress site. We need to:

1. Transfer the domain to **A T Realty's Vercel DNS account** (or keep at current registrar)
2. Update DNS nameservers to point at **Vercel**
3. Verify the domain in Vercel
4. Enable SSL/HTTPS

This guide follows the pattern from **tommccartney.co.nz** (which is live on Vercel).

---

## Step 1: Check Current Domain Status

### Find out where samandbrett.co.nz is registered

Look up the domain WHOIS:
```bash
# Terminal
whois samandbrett.co.nz
```

Or use an online tool: https://www.whois.com (search for samandbrett.co.nz)

**Common registrars**:
- Crazydomains.com (A T Realty often uses this)
- GoDaddy
- NameCheap
- Sitehost

**Note**: Write down:
- Current registrar
- Current nameservers (usually something like `ns1.parking.com`)
- WHOIS admin contact email

---

## Step 2: Add Domain to Vercel

### In Vercel Dashboard

1. Go to your **sam-brett project** → **Settings → Domains**
2. Click **"Add Domain"**
3. Enter: `samandbrett.co.nz`
4. Click **"Add"**

Vercel will check nameservers. At this point it will likely show:
```
⚠️ Not configured
  Nameservers don't point to Vercel yet
```

That's expected—we'll fix it next.

### Add both apex and www

You should configure:
- `samandbrett.co.nz` (apex/root domain)
- `www.samandbrett.co.nz` (www subdomain)

**Vercel will auto-redirect** `www` → apex, so both work.

---

## Step 3: Update DNS Nameservers

You have **two options**:

### Option A: Use Vercel's Nameservers (Recommended)

**Best for**: When you only need this domain on Vercel (no email, no other services).

In Vercel dashboard, the domain page will show:
```
Nameserver 1: ns1.vercel-dns.com
Nameserver 2: ns2.vercel-dns.com
```

Go to your **domain registrar** (Crazy Domains, etc.) and change the **nameservers** to:
- `ns1.vercel-dns.com`
- `ns2.vercel-dns.com`

**Steps** (example for Crazy Domains):
1. Log in to Crazy Domains
2. Domain Settings → **Nameservers**
3. Replace current nameservers with Vercel's
4. Save

**Wait for propagation** (~5 minutes to 48 hours, usually 5-30 mins).

### Option B: Keep Registrar Nameservers, Use DNS Records

**Best for**: If you also need email or other services on this domain.

Add DNS records at your registrar pointing to Vercel:

| Type | Name | Value |
|------|------|-------|
| `A` | `@` or blank | `76.76.19.0` |
| `CNAME` | `www` | `cname.vercel-dns.com` |

Check Vercel's domain page for the exact `A` record value (it varies).

---

## Step 4: Verify Domain in Vercel

Once nameservers propagate:

1. Return to Vercel dashboard
2. Go to **Settings → Domains**
3. Click on `samandbrett.co.nz`
4. Status should change from **"Not Configured"** to **"Valid Configuration"**
5. Vercel will auto-issue an **SSL certificate** (via Let's Encrypt)

**You'll see**:
- ✅ DNS Configured
- ✅ SSL Certificate Active
- ✅ HSTS Enabled (Strict Transport Security)

---

## Step 5: Test the Domain

Once verified:

1. Open **https://samandbrett.co.nz** in your browser
2. Verify:
   - ✅ Page loads (no SSL errors)
   - ✅ Correct site displays (Sam & Brett homepage)
   - ✅ Blog section works (`/blog/`)
   - ✅ Form loads (in #contact section)
   - ✅ Listings display (if VaultRE env vars set)

3. Test subdomains:
   - **https://www.samandbrett.co.nz** → Should redirect to apex
   - **https://samandbrett.co.nz/blog/** → Should load blog

---

## Step 6: Preserve Email (If Needed)

⚠️ **Important**: If the old WordPress site had email on this domain (like `contact@samandbrett.co.nz`), you need to **preserve MX records**.

### Before switching nameservers:

1. Write down the **current MX records** (from old registrar or email provider)
2. In Vercel dashboard → **Settings → Domains → samandbrett.co.nz**
3. Look for **DNS Records** section
4. Add the **MX records** before/after nameserver change

**Example MX records** (replace with YOUR actual MX records):
```
MX record: mail.example.com (Priority: 10)
```

If you don't know your MX records:
- Ask Hannah/operations team
- Check the old WordPress hosting account
- Look at Supabase or other email provider settings

---

## Step 7: Cleanup (Optional)

Once the domain is live on Vercel for **1-2 days**:

1. **Cancel old hosting** (old WordPress site)
   - Log in to old hosting provider (Hostinger, etc.)
   - Cancel the hosting account (keep domain registration)
   
2. **Update WHOIS** (optional but good for security)
   - Registrar → Change WHOIS admin contact email to operations.atrealty@raywhite.com

---

## Troubleshooting

### Domain shows "Not Configured" after 30 mins

**Cause**: Nameserver propagation is slow.  
**Fix**: Wait 1-2 hours. Check status with:
```bash
dig samandbrett.co.nz NS
```

Should show Vercel nameservers (ns1/ns2.vercel-dns.com).

### SSL Certificate error ("NET::ERR_CERT_AUTHORITY_INVALID")

**Cause**: Certificate hasn't been issued yet (usually takes <5 mins after verification).  
**Fix**: Wait 5-10 minutes, then do a hard refresh (Cmd+Shift+R).

### Domain works but blog/subpaths 404

**Cause**: Vercel project's `vercel.json` doesn't have clean URL config.  
**Fix**: Ensure `vercel.json` has:
```json
{
  "cleanUrls": true,
  "trailingSlash": false,
  "rewrites": []
}
```

Then redeploy in Vercel.

### Email stops working after DNS change

**Cause**: MX records were overwritten.  
**Fix**: 
1. In Vercel → Settings → Domains → samandbrett.co.nz → DNS Records
2. Add back the **MX records** from your email provider
3. Wait 15-30 mins for propagation

---

## Rollback (If Something Goes Wrong)

If the new site isn't working and you need to quickly revert:

1. Go to your **domain registrar**
2. Change nameservers back to the **old values** (see Step 1 notes)
3. Wait 15-30 mins for propagation
4. Old site will be live again

Then troubleshoot the Vercel setup with Hannah before trying again.

---

## Verification Checklist

After domain is live, confirm:

- [ ] **https://samandbrett.co.nz** loads (no SSL warnings)
- [ ] **https://www.samandbrett.co.nz** redirects to apex
- [ ] **/blog/** loads the blog homepage
- [ ] **/blog/wattle-downs-market-update/** loads a post
- [ ] Form loads in #contact section
- [ ] Listings visible (if VaultRE data available)
- [ ] Sold properties table visible
- [ ] Mobile responsive (test on phone)
- [ ] Email still works (if applicable)

---

## Timeline

| Step | Typical Time |
|------|--------------|
| Add domain to Vercel | Immediate |
| Change nameservers at registrar | 5-30 mins |
| DNS propagation globally | 5 mins–48 hrs (usually <1 hr) |
| SSL certificate issuance | <5 mins after domain verified |
| **Total to live** | **~30 mins (often <5 mins)** |

---

## Support

If anything goes wrong:

1. Check **Vercel dashboard → Deployments → Logs** for build/deploy errors
2. Run local test: `npm run build && npm run preview:file`
3. Reach out to Hannah with:
   - Domain name
   - Registrar name
   - Current error/issue
   - Vercel project ID

---

**Domain**: samandbrett.co.nz  
**Registrar**: (see Step 1)  
**Vercel Nameservers**: ns1.vercel-dns.com, ns2.vercel-dns.com  
**SSL**: Auto-issued by Let's Encrypt via Vercel
