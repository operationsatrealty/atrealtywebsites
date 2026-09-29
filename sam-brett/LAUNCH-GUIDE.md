# Sam & Brett Website – Launch Guide

## What's been built

A modern, mobile-first website for **Sam Steel** and **Brett Norris** at **Ray White Manurewa**, with:

✅ **Hero section** with live sales stats (pulled from VaultRE at build time)  
✅ **About section** with agent bios, contact info, and their awards  
✅ **Current listings** feed (auto-updated daily)  
✅ **Sold properties** table with 12 most recent + total count  
✅ **Contact form** (A T Realty embed)  
✅ **SEO metadata** for target suburbs: Wattle Downs, Hill Park, Manurewa, Totara Park, The Gardens  
✅ **Ray White brand system** colours (yellow #FFE512, dark grey) + fonts (Lato, Playfair Display)  
✅ **Responsive design** (desktop, tablet, mobile)  
✅ **Static HTML/CSS/JS** — no Node/npm runtime needed to serve  

## How it works

### Build process

1. **VaultRE integration**: At build time, Node fetches current listings and settled sales for both agents from VaultRE
2. **Image optimization**: Property photos are resized, re-encoded, and served from your CDN
3. **Static output**: Results in plain HTML/CSS/JS in `dist/` — ready for any web host

```bash
cd sam-brett
npm install                    # First time only
npm run build                  # Production build
npm run build:offline          # Skip VaultRE (use last snapshot)
npm run preview:file           # Single HTML file for previewing
```

### File structure

```
sam-brett/
├── src/
│   ├── index.template.html      # Main page ({{PLACEHOLDERS}})
│   ├── styles.css               # Ray White design system
│   └── script.js                # Minimal client-side JS
├── build.mjs                    # Build script (fetches VaultRE, optimizes images)
├── vaultre.mjs                  # Shared VaultRE API client
├── assets/
│   ├── raywhite-logo.png        # Ray White logo
│   ├── raywhite-mark.png        # Logo mark
│   ├── sam-portrait.jpg         # TO ADD (2400x1600 min)
│   └── brett-portrait.jpg       # TO ADD (2400x1600 min)
├── data/
│   └── listings.json            # Snapshot from last build (fallback)
├── dist/                        # Generated output (Vercel serves this)
├── package.json
├── vercel.json                  # Deploy config
└── README.md
```

## Before launch

### 1. Add agent portraits

⚠️ **Current state**: Portraits are missing; build shows placeholders.

**Add these files:**
- `assets/sam-portrait.jpg` — Sam Steel headshot, 2400×1600px minimum
- `assets/brett-portrait.jpg` — Brett Norris headshot, 2400×1600px minimum

Portrait tips:
- **Format**: JPEG (72+ DPI, 2400×1600 or larger)
- **Style**: Professional headshots (head + shoulders)
- **The build script** will:
  - Crop to a 640×800 frame using smart attention-based centering
  - Optimize for web (sharp, Mozjpeg quality 82)
  - Cache locally, serve from CDN

### 2. Create the contact form in A T Realty admin

**Form details:**
- **Slug**: `sales-appraisal-sam-brett` (must match `build.mjs`)
- **Assignee**: Sam Steel or Brett Norris (or both, if the system supports it)
- **Email notifications**: Enable, send to operations.atrealty@raywhite.com
- **Fields**: Any leads will auto-populate from form fields (no manual body template needed)

The form embeds cross-origin via `<div data-atr-form="sales-appraisal-sam-brett">`, rendered on the live site only (preview blocks third-party scripts).

### 3. Set up daily rebuilds (optional but recommended)

The site pulls VaultRE data at **build time**, not in the browser. To keep listings current:

**In the atrealtywebsites repo:**
1. Create a Vercel Deploy Hook for the `sam-brett` Vercel project
   - Vercel project Settings → Git → Deploy Hooks
   - Copy the webhook URL
2. Add it to the GitHub Actions secret: `VERCEL_DEPLOY_HOOK_SAM_BRETT`
3. The daily-rebuild workflow (`.github/workflows/daily-rebuild.yml`) will trigger it at 17:00 UTC

### 4. Set up the Vercel project

You'll need to create a Vercel project for this site (or ask Hannah to do it).

**Environment variables** (in Vercel Settings → Environment Variables):
```
VAULTRE_API_KEY=<shared across all offices>
VAULTRE_BEARER_TOKEN_MANUREWA=<from Ray White admin>
```

These are pulled **only at build time** on Vercel's servers — never shipped to the browser.

**Vercel settings**:
- **Build command**: `node build.mjs`
- **Output directory**: `dist`
- **Root directory**: `atrealtywebsites/sam-brett`
- **Branch tracking**: `claude/cool-mayer-96prl5` (or whatever default branch is used)

## Content updates

### Updating about/awards text

Edit `src/index.template.html` directly — the text is hardcoded, not pulled from a database.

### Adding a blog section (future)

The template currently has no blog. To add one:
1. Create `src/blog.template.html` (see Tom/Levani for examples)
2. Use `build.mjs` to generate multiple pages
3. Add nav links in `src/index.template.html`

## Testing

### Local preview

```bash
cd sam-brett
python3 -m http.server 8000 --directory dist
# then open http://localhost:8000
```

### Offline build (no VaultRE)

```bash
npm run build:offline   # Uses data/listings.json snapshot
```

### Single-file preview (for sharing)

```bash
npm run preview:file
# Creates dist-preview/index.html — all CSS/JS/images inlined
# Perfect for emailing or testing in sandboxes that block external requests
```

## SEO

✅ Metadata in place:
- Title: "Sam Steel & Brett Norris – Ray White Manurewa Real Estate Agents"
- Description: Customized per build with live stats (sales count, settled value)
- Open Graph (og:title, og:description, og:url)
- Canonical URL
- Schema.org RealEstateAgent structured data
- robots.txt + sitemap.xml (generated at build time)

⚠️ **Not set up yet**:
- Google Search Console verification (needs DNS TXT or meta tag)
- Google Analytics (request from Hannah if needed)
- Custom domain (currently at Vercel preview URL, not samandbrett.co.nz yet)

## Next steps

1. ✅ **Design approved?** → Proceed to portraits + form setup
2. 📸 **Portraits**: Add `assets/sam-portrait.jpg` + `assets/brett-portrait.jpg`
3. 📋 **Form**: Create `sales-appraisal-sam-brett` in A T Realty admin
4. 🚀 **Deploy**: Create Vercel project, connect GitHub, set env vars
5. ⏰ **Daily builds**: Add deploy hook to GitHub Actions (optional but recommended)
6. 🌐 **Domain**: Point samandbrett.co.nz DNS to Vercel (if using custom domain)

## Questions?

- **How do I add a suburb SEO page?** → See `linda-galbraith-site/` for a working example with suburb pages + auto-blog
- **Can I use a different form provider?** → Yes, modify `src/index.template.html` and replace the form slot
- **How do I hide the stats if there's no VaultRE data?** → Edit the template to show "Coming soon" or a CTA instead
- **What if I want a blog?** → Copy the blog structure from `levani-lumon/build.mjs` and add content in Markdown

---

**Built:** 2026-09-29  
**Site type:** Static HTML/CSS/JS  
**Deploy target:** Vercel  
**VaultRE:** Both agents (sam.steel@raywhite.com, brett.norris@raywhite.com)
