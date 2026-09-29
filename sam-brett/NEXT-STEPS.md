# Sam & Brett Website – Next Steps

## ✅ What's Done

- ✅ Vercel project created
- ✅ Deploy hook generated
- ✅ GitHub Actions workflow updated (Sam & Brett step added)
- ✅ Website fully built with all assets

---

## 📋 Remaining Steps (3 items)

### STEP 1: Add GitHub Secret (2 mins)

The deploy hook needs to be stored as a **GitHub secret** so GitHub Actions can trigger daily rebuilds.

**Instructions**:

1. Go to GitHub: **operationsatrealty/atrealtywebsites** repo
2. Settings → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Name: `VERCEL_DEPLOY_HOOK_SAM_BRETT`
5. Value: Paste the webhook URL:
   ```
   https://api.vercel.com/v1/integrations/deploy/prj_Fg7h68SpFW62Mxe1ZMPUQmaV3PWS/ETH9tCfHky
   ```
6. Click **"Add secret"**

**Result**: GitHub Actions can now trigger Vercel rebuilds daily.

---

### STEP 2: Add VaultRE Environment Variables to Vercel (5 mins)

Listings need VaultRE credentials to pull live data.

**Instructions**:

1. Go to Vercel → **sam-brett project** → **Settings → Environment Variables**
2. Add two variables (both **Production** and **Preview**):

| Name | Value | From |
|------|-------|------|
| `VAULTRE_API_KEY` | `[get from Hannah]` | Ray White admin |
| `VAULTRE_BEARER_TOKEN_MANUREWA` | `[get from Hannah]` | Ray White admin |

3. **Important**: Toggle both **Production** AND **Preview** for each variable
4. Click **"Save"**

5. Trigger a rebuild:
   - Go to **Deployments**
   - Click latest deployment → **"Redeploy"**
   - Wait 2-3 mins

**Result**: Site will now show live listings & sales from VaultRE.

---

### STEP 3: Link Domain to Vercel (10 mins + 5-30 min DNS)

Point **samandbrett.co.nz** to your Vercel site.

**Instructions**:

1. In Vercel → **sam-brett project** → **Settings → Domains**
2. Click **"Add Domain"**
3. Enter: `samandbrett.co.nz`
4. Click **"Add"**
5. Vercel will show two nameservers:
   ```
   ns1.vercel-dns.com
   ns2.vercel-dns.com
   ```
6. Go to your domain registrar (Crazy Domains / GoDaddy / etc.)
7. Update **Nameservers** to Vercel's (above)
8. Save

**Wait 5-30 minutes** for DNS propagation (usually <5 mins).

9. Back in Vercel, refresh the domain page
10. Status should change from **"Not Configured"** to **"Valid Configuration"**
11. SSL certificate auto-issues (green padlock)

**Test**:
- Open https://samandbrett.co.nz
- Should load the site with green padlock (SSL)

---

## 📊 Progress

| Step | Status | Est. Time |
|------|--------|-----------|
| 1. Vercel project | ✅ Done | — |
| 2. GitHub secret | ⏳ TODO | 2 mins |
| 3. VaultRE env vars | ⏳ TODO | 5 mins |
| 4. Link domain | ⏳ TODO | 15 mins |
| **Total to live** | | **22 mins** |

---

## 🔗 Vercel Project Info

- **Project name**: sam-brett (or atrealtywebsites-sam-brett)
- **Root directory**: sam-brett
- **Build command**: `node build.mjs`
- **Output directory**: dist
- **GitHub branch**: claude/cool-mayer-96prl5
- **Deploy hook**: https://api.vercel.com/v1/integrations/deploy/prj_Fg7h68SpFW62Mxe1ZMPUQmaV3PWS/ETH9tCfHky
- **Preview URL**: https://atrealtywebsites-sam-brett.vercel.app (temporary)
- **Live URL** (after domain): https://samandbrett.co.nz

---

## 🔑 Secrets Needed from Hannah

**For Step 2 (Vercel env vars)**:
- `VAULTRE_API_KEY` (shared across all offices)
- `VAULTRE_BEARER_TOKEN_MANUREWA` (Manurewa office)

Ask Hannah for these and add them to Vercel.

---

## ✨ After Going Live

### Daily Rebuild
- GitHub Actions triggers at **17:00 UTC** (5am NZDT / 6am NZST)
- Listings auto-refresh with latest VaultRE data
- No manual action needed

### Monitor
- Check Vercel dashboard for errors
- Test form submissions
- Verify listings update daily

### Update Content
- Blog posts: Add `.md` files to `content/blog/`, push to GitHub
- Main page: Edit `src/index.template.html`, push to GitHub
- Automatic rebuild triggered on every push

---

## 📞 Need Help?

| Issue | Reference |
|-------|-----------|
| Vercel setup questions | `VERCEL-SETUP.md` |
| Domain/DNS issues | `DOMAIN-SETUP.md` |
| Blog post questions | `BLOG-GUIDE.md` |
| General troubleshooting | `VERCEL-SETUP.md` section "Troubleshooting" |

---

## 🚀 Estimated Timeline

| Time | Action |
|------|--------|
| Now | Add GitHub secret (2 mins) |
| +2 mins | Add Vercel env vars (5 mins) |
| +7 mins | Redeploy & verify listings appear |
| +12 mins | Link domain to Vercel (2 mins + wait) |
| +15–45 mins | DNS propagation (typically <5 mins) |
| **~45 mins** | **🎉 LIVE on samandbrett.co.nz** |

---

**Status**: Vercel deployed, ready for domain linkage  
**Next**: Complete Steps 1, 2, 3 above  
**Expected**: Live within 1 hour
