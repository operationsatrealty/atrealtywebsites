# Sam Steel & Brett Norris — Ray White Manurewa

A modern, responsive marketing website for **Sam Steel** and **Brett Norris**, agents at **Ray White Manurewa** (part of the A T Realty group, South Auckland).

## Live data sources

| Item | Source |
|------|--------|
| Current & recently-sold listings | VaultRE |
| Stats: sales count, settled value, median | VaultRE data aggregated at build time |
| Office: Ray White Manurewa, 182 Great South Road | A T Realty master data |
| Contact details | Agent profiles |

## Tech

Pure static **HTML + CSS + vanilla JS**, built with Node.

```
src/
  index.template.html    # Main page template
  styles.css             # Ray White brand design
  script.js              # Minimal interactivity
build.mjs              # Fetches VaultRE data, optimizes images
vaultre.mjs            # Shared VaultRE API client
vercel.json            # Static hosting config
assets/                # Logo, portraits
data/
  listings.json        # Snapshot of last build (fallback)
```

## Build

```bash
npm install
npm run build           # Production: fetch VaultRE, serve from dist/
npm run build:offline  # Use committed snapshot
npm run preview:file   # Single self-contained HTML for sharing
```

## Local preview

```bash
python3 -m http.server 8000 --directory dist
# then open http://localhost:8000
```

## Notes

- **Portraits:** Placeholder paths — add `assets/sam-portrait.jpg` and `assets/brett-portrait.jpg` before deploying
- **Form slug:** `sales-appraisal-sam-brett` — must match the form created in A T Realty admin
- **VaultRE:** Pulls from both agents' records across all configured offices, merged daily
