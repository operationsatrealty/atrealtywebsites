# Sam & Brett Website – GO-LIVE CHECKLIST

## ✅ What's Ready

- ✅ Website code (static HTML/CSS/JS)
- ✅ Sam & Brett profiles, team photo, logo loaded
- ✅ Blog section (3 posts + auto-generation system)
- ✅ Contact form configured (`sam-and-brett-appraisal`)
- ✅ VaultRE integration (awaiting env vars)
- ✅ All source files committed to GitHub

---

## 📋 To Go Live – Follow These Steps

### STEP 1: Create Vercel Project (5 mins)
**See**: `VERCEL-SETUP.md` → Section 1

1. Go to vercel.com
2. New Project → Import `operationsatrealty/atrealtywebsites`
3. Root directory: `sam-brett`
4. Click Deploy

**Result**: Site live at `atrealtywebsites-sam-brett.vercel.app`

---

### STEP 2: Add VaultRE Credentials (5 mins)
**See**: `VERCEL-SETUP.md` → Section 2

In Vercel Settings → Environment Variables, add:

```
VAULTRE_API_KEY = [ask Hannah]
VAULTRE_BEARER_TOKEN_MANUREWA = [ask Hannah]
```

**Both for Production AND Preview environments.**

Then redeploy. Live listings will appear.

---

### STEP 3: Set Up Daily Auto-Rebuild (10 mins)
**See**: `VERCEL-SETUP.md` → Section 4

1. Create Vercel Deploy Hook
2. Add secret to GitHub: `VERCEL_DEPLOY_HOOK_SAM_BRETT`
3. Update `.github/workflows/daily-rebuild.yml`

**Result**: Listings auto-refresh daily at 17:00 UTC.

---

### STEP 4: Link Domain (10 mins)
**See**: `DOMAIN-SETUP.md`

1. Add `samandbrett.co.nz` to Vercel project
2. Change domain registrar's nameservers to Vercel's
3. Wait 5-30 mins for propagation
4. Verify in Vercel dashboard

**Result**: samandbrett.co.nz → Vercel site (SSL auto-enabled).

---

## ⏱️ Total Time

- **Setup**: ~30 mins (mostly waiting for DNS propagation)
- **Live**: Usually 5-15 mins after nameserver change

---

## 🔗 Quick Links

| Step | Document |
|------|----------|
| Vercel project + env vars + auto-rebuild | `VERCEL-SETUP.md` |
| Domain nameservers + DNS | `DOMAIN-SETUP.md` |
| Blog post writing + management | `BLOG-GUIDE.md` |
| General launch prep | `LAUNCH-GUIDE.md` |
| Complete feature list | `COMPLETED.md` |

---

## 📞 Need VaultRE Credentials?

Ask **Hannah** for:
- `VAULTRE_API_KEY` (shared across all offices)
- `VAULTRE_BEARER_TOKEN_MANUREWA` (Manurewa office)

These enable live listings. Without them, the site still works but shows empty listing section.

---

## ✨ After Launch

### Monitor
- Check Vercel dashboard for errors
- Verify listings update daily (at 17:00 UTC)
- Test form submissions reach operations.atrealty@raywhite.com

### Write Blog Posts
- Add `.md` files to `content/blog/`
- Rebuild: `npm run build`
- Commit & push (auto-deploys via Vercel)
- See `BLOG-GUIDE.md` for details

### Update Content
- Main page (about, awards, etc.): Edit `src/index.template.html`
- Styling: Edit `src/styles.css`
- Rebuild & push

---

## 📋 Pre-Launch Verification Checklist

**Before linking domain, verify**:

- [ ] Vercel project deployed
- [ ] Site loads at vercel.app URL
- [ ] Homepage displays correctly
- [ ] Blog loads (`/blog/`, individual posts)
- [ ] Sam & Brett profiles visible + portraits load
- [ ] Logo visible in header
- [ ] Team photo visible
- [ ] Form embed shows in #contact
- [ ] Mobile responsive (test on phone)
- [ ] Analytics/tracking (if needed)
- [ ] Redirects working (old URLs → new site)

**After domain linked**:

- [ ] samandbrett.co.nz loads
- [ ] SSL certificate active (green padlock)
- [ ] www.samandbrett.co.nz redirects to apex
- [ ] All URLs working (/blog/, /blog/[post-slug]/, #contact, etc.)
- [ ] Form submission works
- [ ] Old WordPress site still accessible (for reference)

---

## 🎯 Timeline Example

| Time | Action | Duration |
|------|--------|----------|
| 9:00am | Create Vercel project | 5 mins |
| 9:05am | Add env vars, redeploy | 5 mins |
| 9:10am | Set up GitHub Actions | 10 mins |
| 9:20am | Change DNS nameservers | 2 mins |
| 9:20am–9:50am | Wait for DNS propagation | 30 mins (usually 5-15) |
| 9:50am | Verify domain works | 5 mins |
| **10:00am** | **🚀 LIVE** | — |

---

## 🚨 Rollback Plan

If something goes wrong:

1. Revert nameservers at registrar (back to old values)
2. Wait 15-30 mins
3. Old WordPress site live again
4. Troubleshoot with Hannah
5. Try again

No data loss. You can try multiple times.

---

## 📞 Support

**Questions?**
- Vercel issues: See `VERCEL-SETUP.md` troubleshooting
- Domain issues: See `DOMAIN-SETUP.md` troubleshooting
- Blog issues: See `BLOG-GUIDE.md`
- General: Reach out to Hannah

---

**Website Status**: ✅ **Ready to deploy**  
**Next Action**: Follow STEP 1 in this checklist  
**Expected Live**: Within 1 hour of starting
