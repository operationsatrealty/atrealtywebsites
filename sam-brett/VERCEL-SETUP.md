# Vercel Deployment Setup

## Step 1: Create Vercel Project

### Option A: Via Vercel Dashboard (Recommended)

1. Go to **vercel.com** and sign in (or create an account if needed)
2. Click **"New Project"** → **"Import Git Repository"**
3. Select the **operationsatrealty/atrealtywebsites** repository
4. When prompted for **"Which folder?"** — enter: `sam-brett`
5. Click **"Deploy"**

Vercel will:
- Detect `vercel.json` and `package.json`
- Run `npm install` + `npm run build`
- Deploy to **atrealtywebsites-sam-brett.vercel.app** (or similar)

### Option B: Via Vercel CLI (if you prefer command line)

```bash
cd atrealtywebsites/sam-brett
npm install -g vercel
vercel
```

Follow the prompts to connect your GitHub account and deploy.

---

## Step 2: Configure Environment Variables

**VaultRE credentials** (needed for live listings/sales):

1. In Vercel dashboard, go to **Settings → Environment Variables**
2. Add these two variables (both **Production** and **Preview**):

| Variable | Value | Where to get it |
|----------|-------|-----------------|
| `VAULTRE_API_KEY` | The shared API key | Hannah (Ray White admin) |
| `VAULTRE_BEARER_TOKEN_MANUREWA` | Manurewa office bearer token | Hannah (Ray White admin) |

**Why both Production AND Preview?**
- Production = live site on vercel.app and custom domain
- Preview = pull request previews (so you can test changes before merging)

If env vars are missing, the build will fall back to the snapshot (`data/listings.json`), so it still works—but listings will be stale.

---

## Step 3: Configure Build Settings

These should be **auto-detected** from `vercel.json`, but verify:

**Settings → General:**
- **Build Command**: `node build.mjs`
- **Output Directory**: `dist`
- **Root Directory**: `sam-brett` ← **Important!**

**Settings → Git:**
- **Production Branch**: `claude/cool-mayer-96prl5` (the default branch for atrealtywebsites)

---

## Step 4: Set Up Daily Auto-Rebuild (Optional but Recommended)

Listings refresh at **build time**, so you need a daily rebuild to keep them current.

### Create a Vercel Deploy Hook

1. Go to **Settings → Git → Deploy Hooks**
2. Click **"Create Hook"**
3. Name: `sam-brett-daily-rebuild`
4. Branch: `claude/cool-mayer-96prl5`
5. Copy the webhook URL (looks like `https://api.vercel.com/v1/integrations/deploy/...`)

### Add Deploy Hook to GitHub Actions

In the repo's `.github/workflows/daily-rebuild.yml`, add a new section:

```yaml
      - name: Sam & Brett
        env:
          HOOK: ${{ secrets.VERCEL_DEPLOY_HOOK_SAM_BRETT }}
        run: |
          if [ -z "$HOOK" ]; then
            echo "::notice::No deploy hook set for Sam & Brett — skipping."
            exit 0
          fi
          code=$(curl -sS -X POST -o /dev/null -w "%{http_code}" "$HOOK")
          echo "Deploy hook responded $code"
          [ "$code" = "201" ] || [ "$code" = "200" ]
```

Then add the secret to GitHub:

1. Go to repo **Settings → Secrets and variables → Actions**
2. New repository secret: `VERCEL_DEPLOY_HOOK_SAM_BRETT`
3. Paste the webhook URL from step 5 above
4. Save

The workflow will now rebuild at **17:00 UTC daily** (5am NZDT / 6am NZST).

---

## Step 5: Test the Build

Push a small change to verify the deploy:

```bash
cd atrealtywebsites/sam-brett
echo "# Tested on $(date)" >> test.txt
git add test.txt
git commit -m "Test Vercel deploy"
git push origin claude/cool-mayer-96prl5
```

Watch the Vercel dashboard — the build should trigger and complete in ~2 minutes.

---

## Step 6: Verify Live Build

Once deployed, visit:
```
https://atrealtywebsites-sam-brett.vercel.app
```

You should see:
- ✅ Main page with hero, about, listings, sold, blog, contact
- ✅ Blog section at `/blog/`
- ✅ Sam & Brett's profiles + logo loaded correctly
- ✅ Contact form embedded (if form is live in A T Realty admin)

---

## Troubleshooting

### Build fails with "Cannot find module 'sharp'"
**Fix**: Delete `node_modules/` and `package-lock.json`, then commit:
```bash
rm -rf node_modules package-lock.json
git add . && git commit -m "Clear node_modules" && git push
```

### Form embed not showing
**Check**:
1. Is the form `sam-and-brett-appraisal` created in A T Realty admin?
2. Is it assigned to Sam or Brett?
3. Refresh the page (hard refresh: Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)

### Listings showing as $0 or empty
**Cause**: VaultRE env vars not set or credentials incorrect.  
**Fix**: 
1. Verify `VAULTRE_API_KEY` and `VAULTRE_BEARER_TOKEN_MANUREWA` are set in Vercel
2. Redeploy: Deployments → click on latest → "Redeploy"

### Blog posts not showing
**Cause**: Markdown files in `content/blog/` not committed.  
**Fix**: `git add content/blog/*.md && git commit && git push`

---

## Next: Link Custom Domain

Once the Vercel project is live and tested, proceed to **DOMAIN-SETUP.md** to point **samandbrett.co.nz** at your Vercel site.

---

**Vercel Project ID**: (will show in Vercel dashboard → Settings → General)  
**Preview URL**: https://atrealtywebsites-sam-brett.vercel.app (temporary until domain is linked)
