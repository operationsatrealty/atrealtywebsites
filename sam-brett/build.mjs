/**
 * Build samandbrett.co.nz
 *
 *   node build.mjs             → dist/  (production: live embed, CDN photos)
 *   node build.mjs --preview   → dist-preview/  (self-contained)
 *   node build.mjs --offline   → skip VaultRE, use the committed snapshot
 */

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { agentListings, vaultreConfigured } from "./vaultre.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AGENT_EMAILS = ["sam.steel@raywhite.com", "brett.norris@raywhite.com"];
const SITE_ORIGIN = "https://samandbrett.co.nz";
const PORTRAIT_SRC_SAM = "assets/sam-portrait.jpg";
const PORTRAIT_SRC_BRETT = "assets/brett-portrait.jpg";

const argv = new Set(process.argv.slice(2));
const PREVIEW = argv.has("--preview");
const OFFLINE = argv.has("--offline");
const OUT = path.join(HERE, PREVIEW ? "dist-preview" : "dist");

/* ------------------------------------------------------------------ */
/* formatting                                                          */
/* ------------------------------------------------------------------ */

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function money(n) {
  if (!n && n !== 0) return "—";
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${m >= 10 ? m.toFixed(1) : m.toFixed(2)}m`.replace(/\.0+m$/, "m");
  }
  if (n >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${n}`;
}

const moneyExact = (n) => (n ? `$${n.toLocaleString("en-NZ")}` : "Price withheld");

const NZ_DATE = new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "short", year: "numeric" });
const shortDate = (iso) => (iso ? NZ_DATE.format(new Date(iso)) : "");

function listSuburbs(names) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/* ------------------------------------------------------------------ */
/* data                                                                */
/* ------------------------------------------------------------------ */

const snapshotPath = path.join(HERE, "data", "listings.json");

async function loadData() {
  if (!OFFLINE && vaultreConfigured()) {
    console.log(`[build] Fetching ${AGENT_EMAILS.join(", ")} from VaultRE…`);
    const results = await Promise.all(AGENT_EMAILS.map(email => agentListings(email)));

    // Merge data from both agents
    const merged = { current: [], sold: [], soldTotal: 0, offices: [] };
    const officeSet = new Set();

    for (const result of results) {
      if (result) {
        merged.current.push(...result.current);
        merged.sold.push(...result.sold);
        merged.soldTotal += result.soldTotal;
        result.offices.forEach(o => officeSet.add(o.office));
      }
    }

    merged.offices = Array.from(officeSet).map(office => ({ office }));

    if (merged.sold.length) {
      console.log(
        `[build] VaultRE ok — ${merged.current.length} current, ${merged.sold.length} settled`
      );
      await fs.writeFile(snapshotPath, JSON.stringify(merged, null, 2) + "\n");
      return { data: merged, source: "vaultre" };
    }
    console.warn("[build] VaultRE returned nothing usable — falling back to snapshot.");
  } else if (!OFFLINE) {
    console.warn("[build] VaultRE credentials not set — using snapshot.");
  }

  const data = JSON.parse(await fs.readFile(snapshotPath, "utf8"));
  console.log(`[build] Snapshot — ${data.current.length} current, ${data.sold.length} settled.`);
  return { data, source: "snapshot" };
}

function summarise(data) {
  const sold = data.sold.filter((s) => s.settlementDate);
  const prices = data.sold.map((s) => s.salePrice).filter(Boolean);
  const sorted = [...prices].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;

  const yearAgo = new Date();
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const recent = sold.filter((s) => new Date(s.settlementDate) >= yearAgo);
  const recentValue = recent.reduce((n, s) => n + (s.salePrice ?? 0), 0);

  const years = sold.map((s) => s.settlementDate.slice(0, 4)).sort();
  const counts = {};
  for (const s of data.sold) if (s.suburb) counts[s.suburb] = (counts[s.suburb] ?? 0) + 1;
  const topSuburbs = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  const firstYear = years[0] ?? "2020";

  return {
    totalSettled: money(prices.reduce((a, b) => a + b, 0)),
    soldCount: data.sold.length,
    soldTotal: data.soldTotal || data.sold.length,
    medianPrice: money(median),
    topSale: money(Math.max(...prices, 0)),
    recentCount: recent.length,
    recentValue: money(recentValue),
    firstYear,
    yearsActive: Math.max(1, new Date().getFullYear() - Number(firstYear)),
    topSuburbs: listSuburbs(topSuburbs),
  };
}

/* ------------------------------------------------------------------ */
/* fragments                                                           */
/* ------------------------------------------------------------------ */

function statusLabel(l) {
  if ((l.status ?? "").toLowerCase() === "conditional") return "Under offer";
  const method = l.method?.name ?? "";
  return /auction/i.test(method) ? "Auction" : "For sale";
}

function specs(l) {
  const bits = [];
  if (l.bed) bits.push(`${l.bed} bed`);
  if (l.bath) bits.push(`${l.bath} bath`);
  if (l.car) bits.push(`${l.car} car`);
  return bits.map((b) => `<span>${esc(b)}</span>`).join("");
}

function currentListingsHtml(listings, photoSrc) {
  if (!listings.length) {
    return `<p class="listings__empty">
      Nothing on the market at this moment — new campaigns launch regularly.
      <a href="#contact">Get in touch</a> and we'll let you know what's coming.
    </p>`;
  }

  const cards = listings
    .map((l) => {
      const tag = statusLabel(l);
      const media = l.photo
        ? `<img src="${esc(photoSrc(l.photo.url))}" alt="${esc(l.address)}, ${esc(l.suburb)}" loading="lazy" />`
        : "";
      const open = l.url ? `<a class="card" href="${esc(l.url)}" target="_blank" rel="noopener">` : `<div class="card">`;
      const close = l.url ? `</a>` : `</div>`;

      return `${open}
          <div class="card__media">
            ${media}
            <span class="card__tag">${esc(tag)}</span>
          </div>
          <div class="card__body">
            <span class="card__addr">${esc(l.address)}</span>
            <span class="card__suburb">${esc(l.suburb)}</span>
            <span class="card__price">${esc(l.displayPrice || "Price by negotiation")}</span>
            <span class="card__specs">${specs(l)}</span>
          </div>
        ${close}`;
    })
    .join("\n");

  return `<div class="listings__grid">\n${cards}\n</div>`;
}

function soldRowsHtml(sold) {
  return sold
    .slice(0, 12)
    .map(
      (s) => `<tr>
          <td><span class="sold__addr">${esc(s.address)}</span></td>
          <td class="sold__suburb">${esc(s.suburb)}</td>
          <td>${esc(moneyExact(s.salePrice))}</td>
        </tr>`
    )
    .join("\n");
}

function schema(stats) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: "Sam Steel & Brett Norris",
    url: "https://samandbrett.co.nz/",
    telephone: "+64 21 026 2945",
    email: "sam.steel@raywhite.com",
    areaServed: ["Wattle Downs", "Hill Park", "Manurewa", "Totara Park", "The Gardens"],
    worksFor: { "@type": "Organization", name: "Ray White Manurewa (A T Realty)" },
    address: {
      "@type": "PostalAddress",
      streetAddress: "182 Great South Road",
      addressLocality: "Manurewa",
      addressRegion: "Auckland",
      postalCode: "2102",
      addressCountry: "NZ",
    },
  });
}

const FORM_SLUG = "sam-and-brett-appraisal";
const FORM_ORIGIN = "https://atrealtygroup.co.nz";

const formSlot = PREVIEW
  ? `<div class="formPanel__fallback">
        <strong style="color:var(--ink);font-size:1rem">Appraisal request form</strong>
        <p>The live A T Realty form is embedded here on the published site.</p>
      </div>`
  : `<div data-atr-form="${FORM_SLUG}"></div>`;

const formScript = PREVIEW ? "" : `<script src="${FORM_ORIGIN}/mkt-forms-embed.js" async></script>`;

/* ------------------------------------------------------------------ */
/* images                                                              */
/* ------------------------------------------------------------------ */

const IMAGE_CACHE = path.join(HERE, ".image-cache");
const derived = new Map();

async function fetchBuffer(url) {
  if (!/^https?:\/\//.test(url)) return fs.readFile(path.join(HERE, url));

  const key = crypto.createHash("sha1").update(url).digest("hex");
  const cached = path.join(IMAGE_CACHE, key);
  try {
    return await fs.readFile(cached);
  } catch {
    /* not cached yet */
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(IMAGE_CACHE, { recursive: true });
  await fs.writeFile(cached, buf);
  return buf;
}

async function image(url, { width, height, quality = 72, name }) {
  const cacheKey = `${url}|${width}x${height ?? "auto"}|${quality}|${PREVIEW}`;
  if (derived.has(cacheKey)) return derived.get(cacheKey);

  let out;
  try {
    const src = await fetchBuffer(url);
    const jpeg = await sharp(src)
      .rotate()
      .resize({
        width,
        height,
        fit: height ? "cover" : "inside",
        position: height ? sharp.strategy.attention : undefined,
        withoutEnlargement: true,
      })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    if (PREVIEW) {
      out = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
    } else {
      const hash = crypto.createHash("sha1").update(jpeg).digest("hex").slice(0, 10);
      const file = `${name}-${hash}.jpg`;
      await fs.mkdir(path.join(OUT, "assets", "listings"), { recursive: true });
      await fs.writeFile(path.join(OUT, "assets", "listings", file), jpeg);
      out = `assets/listings/${file}`;
    }

    console.log(
      `[build]   ${name}: ${(src.byteLength / 1e6).toFixed(1)}MB → ${(jpeg.byteLength / 1024).toFixed(0)}KB @ ${width}px`
    );
  } catch (err) {
    console.warn(`[build]   ${name}: couldn't optimise (${err.message}) — linking original.`);
    out = url;
  }

  derived.set(cacheKey, out);
  return out;
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

const { data, source } = await loadData();
const stats = summarise(data);

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(path.join(OUT, "assets"), { recursive: true });

console.log("[build] Optimising images…");

// Sam portrait (use placeholder if file doesn't exist yet)
const portraitSam = path.join(HERE, PORTRAIT_SRC_SAM);
let samPhoto = "";
try {
  await fs.stat(portraitSam);
  samPhoto = await image(PORTRAIT_SRC_SAM, {
    width: 640,
    height: 800,
    quality: 82,
    name: "sam-portrait",
  });
} catch {
  console.warn("[build]   sam-portrait: file not found — will use placeholder");
  samPhoto = "/assets/sam-portrait-placeholder.jpg";
}

// Brett portrait
const portraitBrett = path.join(HERE, PORTRAIT_SRC_BRETT);
let brettPhoto = "";
try {
  await fs.stat(portraitBrett);
  brettPhoto = await image(PORTRAIT_SRC_BRETT, {
    width: 640,
    height: 800,
    quality: 82,
    name: "brett-portrait",
  });
} catch {
  console.warn("[build]   brett-portrait: file not found — will use placeholder");
  brettPhoto = "/assets/brett-portrait-placeholder.jpg";
}

const photoMap = new Map();
for (const [i, l] of data.current.entries()) {
  if (!l.photo) continue;
  photoMap.set(
    l.photo.url,
    await image(l.photo.url, {
      width: 1000,
      name: (l.address || `listing-${i}`).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    })
  );
}
const photoSrc = (u) => photoMap.get(u) ?? u;

const template = await fs.readFile(path.join(HERE, "src", "index.template.html"), "utf8");

const replacements = {
  PORTRAIT_SAM: samPhoto,
  PORTRAIT_BRETT: brettPhoto,
  CURRENT_LISTINGS: currentListingsHtml(data.current, photoSrc),
  SOLD_ROWS: soldRowsHtml(data.sold),
  SOLD_SHOWN: String(Math.min(12, data.sold.length)),
  SOLD_COUNT: String(stats.soldCount),
  TOTAL_SETTLED: stats.totalSettled,
  MEDIAN_PRICE: stats.medianPrice,
  TOP_SALE: stats.topSale,
  RECENT_COUNT: String(stats.recentCount),
  RECENT_VALUE: stats.recentValue,
  FIRST_YEAR: stats.firstYear,
  YEARS_ACTIVE: String(stats.yearsActive),
  TOP_SUBURBS: stats.topSuburbs,
  SCHEMA: schema(stats),
  FORM_SLOT: formSlot,
  FORM_SCRIPT: formScript,
};

let html = template;
for (const [key, value] of Object.entries(replacements)) {
  html = html.replaceAll(`{{${key}}}`, value);
}

const unresolved = [...html.matchAll(/\{\{([A-Z_]+)\}\}/g)].map((m) => m[1]);
if (unresolved.length) {
  console.error(`[build] Unresolved placeholders: ${[...new Set(unresolved)].join(", ")}`);
  process.exit(1);
}

if (PREVIEW) {
  const css = await fs.readFile(path.join(HERE, "src", "styles.css"), "utf8");
  const js = await fs.readFile(path.join(HERE, "src", "script.js"), "utf8");
  html = html
    .replace('<link rel="stylesheet" href="styles.css" />', `<style>\n${css}\n</style>`)
    .replace('<script src="script.js" defer></script>', `<script>\n${js}\n</script>`);

  for (const name of ["raywhite-logo.png", "raywhite-mark.png"]) {
    try {
      const buf = await fs.readFile(path.join(HERE, "assets", name));
      html = html.replaceAll(`assets/${name}`, `data:image/png;base64,${buf.toString("base64")}`);
    } catch {
      console.warn(`[build] Asset ${name} not found`);
    }
  }
  html = html.replace(/<link rel="icon"[^>]*>\s*/g, "");

  await fs.writeFile(path.join(OUT, "index.html"), html);
} else {
  await fs.writeFile(path.join(OUT, "index.html"), html);
  await fs.copyFile(path.join(HERE, "src", "styles.css"), path.join(OUT, "styles.css"));
  await fs.copyFile(path.join(HERE, "src", "script.js"), path.join(OUT, "script.js"));
  for (const name of await fs.readdir(path.join(HERE, "assets"))) {
    try {
      await fs.copyFile(path.join(HERE, "assets", name), path.join(OUT, "assets", name));
    } catch {
      // skip if file doesn't exist
    }
  }
}

if (!PREVIEW) {
  await fs.writeFile(
    path.join(OUT, "robots.txt"),
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`
  );

  const lastmod = new Date().toISOString().slice(0, 10);
  await fs.writeFile(
    path.join(OUT, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      `  <url>\n` +
      `    <loc>${SITE_ORIGIN}/</loc>\n` +
      `    <lastmod>${lastmod}</lastmod>\n` +
      `    <changefreq>daily</changefreq>\n` +
      `    <priority>1.0</priority>\n` +
      `  </url>\n` +
      `</urlset>\n`
  );
  console.log("[build] Wrote robots.txt and sitemap.xml");
}

const bytes = (await fs.stat(path.join(OUT, "index.html"))).size;
console.log(
  `[build] Wrote ${path.relative(HERE, OUT)}/index.html (${(bytes / 1024).toFixed(0)} KB) ` +
    `— data source: ${source}, ${stats.soldCount} sales, ${stats.totalSettled} settled.`
);


/* ------------------------------------------------------------------ */
/* blog: markdown → html                                              */
/* ------------------------------------------------------------------ */

async function buildBlog() {
  const blogDir = path.join(HERE, "content", "blog");
  const distBlogDir = path.join(OUT, "blog");
  
  try {
    await fs.mkdir(distBlogDir, { recursive: true });
  } catch {
    // dir may already exist
  }

  // Read all markdown files
  const files = await fs.readdir(blogDir);
  const posts = [];

  for (const file of files.filter(f => f.endsWith('.md'))) {
    const content = await fs.readFile(path.join(blogDir, file), 'utf8');
    
    // Parse frontmatter
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) continue;
    
    const frontmatter = {};
    const meta = match[1];
    for (const line of meta.split('\n')) {
      const [k, ...v] = line.split(':');
      if (k && v) frontmatter[k.trim()] = v.join(':').trim().replace(/^["']|["']$/g, '');
    }
    
    const markdown = match[2];
    const slug = file.replace(/\.md$/, '');
    
    posts.push({
      slug,
      title: frontmatter.title || 'Untitled',
      date: frontmatter.date || '',
      suburb: frontmatter.suburb || '',
      excerpt: frontmatter.excerpt || '',
      content: markdown,
    });
  }

  // Sort by date descending
  posts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // Generate individual post pages
  for (const post of posts) {
    const html = `<!DOCTYPE html>
<html lang="en-NZ">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(post.title)} | Sam Steel &amp; Brett Norris · Ray White Manurewa</title>
<meta name="description" content="${esc(post.excerpt)}">
<link rel="canonical" href="${SITE_ORIGIN}/blog/${post.slug}/">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(post.title)}">
<meta property="og:description" content="${esc(post.excerpt)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700;900&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../../styles.css">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23FFE512'/><text x='50' y='68' font-family='Georgia,serif' font-size='58' font-weight='700' text-anchor='middle' fill='%23595959'>S</text></svg>">
<style>
.page-hero{position:relative;color:#fff;padding-top:88px;overflow:hidden;background:var(--near-black)}
.page-hero__media{position:absolute;inset:0;z-index:0}
.page-hero__media img{width:100%;height:100%;object-fit:cover;opacity:.5}
.page-hero::after{content:"";position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,rgba(14,14,16,.5) 0%,rgba(14,14,16,.35) 45%,rgba(14,14,16,.86) 100%)}
.page-hero .wrap{position:relative;z-index:2}
.post-hero{padding-bottom:56px}
.post-hero .cat{display:inline-block;font-family:var(--sans);font-weight:700;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#fff;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.3);padding:7px 15px;border-radius:100px;margin-bottom:26px}
.page-hero h1{color:#fff;font-weight:500;font-size:clamp(30px,4.5vw,56px);line-height:1.08;max-width:22ch}
.post-hero .meta{display:flex;flex-wrap:wrap;gap:10px 22px;align-items:center;margin-top:28px;color:rgba(255,255,255,.85);font-family:var(--sans);font-size:14px;letter-spacing:.02em}
.post-hero .meta .dot{width:4px;height:4px;border-radius:50%;background:var(--yellow)}
.article{padding-block:clamp(48px,6vw,84px)}
.article .col{max-width:720px;margin:0 auto}
.article p,.article ul,.article ol{font-size:18px;line-height:1.85;color:var(--body);margin:0 0 26px}
.article h1{font-size:clamp(26px,3.4vw,38px);font-weight:500;margin:52px 0 20px;line-height:1.15}
.article h2{font-family:var(--serif);font-size:clamp(24px,3vw,34px);font-weight:500;color:var(--ink);margin:48px 0 18px;line-height:1.15}
.article h3{font-family:var(--sans);font-size:clamp(20px,2.4vw,24px);font-weight:600;letter-spacing:-.01em;color:var(--ink);margin:36px 0 14px}
.article ul,.article ol{padding-left:24px}
.article li{margin-bottom:12px}
.article li::marker{color:var(--muted)}
.article a{color:var(--ink);text-decoration:underline;text-decoration-color:var(--yellow);text-underline-offset:4px;text-decoration-thickness:2px}
.article a:hover{color:#000}
.article blockquote{margin:36px 0;padding:6px 0 6px 28px;border-left:3px solid var(--yellow);font-family:var(--serif);font-style:italic;font-size:clamp(20px,2.4vw,26px);line-height:1.45;color:var(--ink)}
.article strong{font-weight:700;color:var(--ink)}
.article .table-wrap{overflow-x:auto;margin:0 0 32px}
.article table{width:100%;border-collapse:collapse;font-size:15px;line-height:1.5}
.article th{font-family:var(--sans);font-weight:700;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);text-align:left;padding:12px 16px;border-bottom:2px solid var(--hairline)}
.article td{padding:12px 16px;border-bottom:1px solid var(--hairline);color:var(--body)}
.article tr:last-child td{border-bottom:none}
.article tbody tr:hover{background:var(--paper)}
.post-cta{background:var(--near-black);color:#fff;text-align:center;padding-block:clamp(56px,7vw,96px)}
.post-cta h2{color:#fff;font-family:var(--serif);font-size:clamp(28px,3.6vw,44px);font-weight:500;max-width:20ch;margin:0 auto 18px}
.post-cta h2 em{font-style:italic}
.post-cta>p{color:rgba(255,255,255,.8);max-width:50ch;margin:0 auto 34px}
.related{padding-block:clamp(56px,7vw,88px);background:var(--paper)}
.related h2{font-size:clamp(26px,3.2vw,38px);margin-bottom:40px}
.related__grid{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}
.rpost{display:flex;flex-direction:column;background:#fff;border:1px solid var(--hairline);border-radius:3px;overflow:hidden;padding:28px 26px 30px;transition:transform .4s var(--ease),box-shadow .4s var(--ease)}
.rpost:hover{transform:translateY(-4px);box-shadow:0 18px 44px rgba(0,0,0,.08)}
.rpost .cat{font-family:var(--sans);font-weight:700;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.rpost h3{font-family:var(--serif);font-size:20px;font-weight:500;color:var(--ink);margin:12px 0 12px;line-height:1.22}
.rpost p{font-size:14.5px;color:var(--body);margin:0 0 18px;flex:1;line-height:1.65}
.rpost .date{font-family:var(--sans);font-size:12.5px;letter-spacing:.06em;color:var(--muted);display:flex;align-items:center;gap:10px}
.rpost .date::before{content:"";width:16px;height:2px;background:var(--yellow)}
.nav a.active::after{width:100%}
@media(max-width:768px){
  .page-hero h1{font-size:28px}
  .related__grid{grid-template-columns:1fr;max-width:480px;margin-inline:auto}
}
</style>
</head>
<body>
<a id="top"></a>

<nav class="mnav" id="mnav" aria-label="Mobile">
  <button class="mnav__close" id="mclose" aria-label="Close menu">&times;</button>
  <a href="/">Home</a>
  <a href="/#about">About</a>
  <a href="/#listings">For Sale</a>
  <a href="/#sold">Sold</a>
  <a href="/blog/">Blog</a>
  <a href="/#contact">Contact</a>
  <a href="tel:+642102262945" class="mnav__phone">021 026 2945</a>
</nav>

<header class="site-header scrolled" id="header">
  <div class="wrap">
    <a href="/" class="brand" aria-label="Sam Steel &amp; Brett Norris, Ray White Manurewa">
      <img class="brand-logo" src="../../assets/raywhite-logo.png" alt="Ray White">
      <span class="brand-txt">
        <span class="name">Sam Steel &amp; Brett Norris</span>
        <span class="sub">Ray White Manurewa</span>
      </span>
    </a>
    <nav class="nav" aria-label="Primary">
      <a href="/#about">About</a>
      <a href="/#listings">For Sale</a>
      <a href="/#sold">Sold</a>
      <a href="/blog/" class="active">Blog</a>
      <a href="/#contact" class="nav-cta">Get in Touch</a>
    </nav>
    <button class="burger" id="burger" aria-label="Open menu"><span></span><span></span><span></span></button>
  </div>
</header>

<section class="page-hero post-hero">
  <div class="page-hero__media"><img src="../../assets/website-hero.jpg" alt="${esc(post.title)}"></div>
  <div class="wrap">
    ${post.suburb ? `<span class="cat">${esc(post.suburb)}</span>` : ''}
    <h1>${esc(post.title)}</h1>
    <div class="meta">
      <span>Sam Steel &amp; Brett Norris</span>
      <span class="dot"></span>
      <time datetime="${post.date}">${shortDate(post.date)}</time>
      ${post.suburb ? `<span class="dot"></span><span>${esc(post.suburb)}</span>` : ''}
    </div>
  </div>
</section>

<article class="article">
  <div class="wrap"><div class="col">
    ${convertMarkdownToHtml(post.content)}
  </div></div>
</article>

<section class="post-cta">
  <div class="wrap">
    <p class="eyebrow" style="justify-content:center;color:rgba(255,255,255,.75)">Get in touch</p>
    <h2>Thinking about your <em>next move?</em></h2>
    <p>Sam and Brett offer honest, obligation-free appraisals across Wattle Downs, Manurewa, Hill Park, and South Auckland.</p>
    <a href="/#contact" class="btn" style="background:var(--yellow);color:var(--near-black);border-color:var(--yellow)">Request an appraisal</a>
  </div>
</section>

${posts.filter(p => p.slug !== post.slug).length ? `<section class="related">
  <div class="wrap">
    <p class="eyebrow">More insights</p>
    <h2>Keep reading</h2>
    <div class="related__grid">
      ${posts.filter(p => p.slug !== post.slug).slice(0, 3).map(p =>
        `<a class="rpost" href="/blog/${p.slug}/">
          <span class="cat">${esc(p.suburb)}</span>
          <h3>${esc(p.title)}</h3>
          <p>${esc(p.excerpt)}</p>
          <span class="date"><time datetime="${p.date}">${shortDate(p.date)}</time></span>
        </a>`
      ).join('\n      ')}
    </div>
  </div>
</section>` : ''}

<footer class="footer">
  <div class="wrap">
    <p>&copy; <span id="year">2026</span> Sam Steel &amp; Brett Norris, Ray White Manurewa. All rights reserved.</p>
    <nav>
      <a href="/">Home</a>
      <a href="/blog/">Blog</a>
      <a href="/#contact">Contact</a>
    </nav>
  </div>
</footer>

<script>
document.getElementById('year').textContent=new Date().getFullYear();
document.getElementById('burger').addEventListener('click',function(){document.getElementById('mnav').classList.add('open')});
document.getElementById('mclose').addEventListener('click',function(){document.getElementById('mnav').classList.remove('open')});
document.querySelectorAll('.mnav a').forEach(function(a){a.addEventListener('click',function(){document.getElementById('mnav').classList.remove('open')})});
</script>
</body>
</html>`;

    await fs.mkdir(path.join(distBlogDir, post.slug), { recursive: true });
  await fs.writeFile(path.join(distBlogDir, post.slug, 'index.html'), html);
  }

  // Generate blog index
  const blogIndexHtml = `<!DOCTYPE html>
<html lang="en-NZ">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Market Insights | Sam Steel &amp; Brett Norris · Ray White Manurewa</title>
<meta name="description" content="Real estate insights for Wattle Downs, Manurewa, Hill Park, Totara Park, and The Gardens — market updates, buyer guides and selling tips.">
<link rel="canonical" href="${SITE_ORIGIN}/blog/">
<meta property="og:type" content="website">
<meta property="og:title" content="Market Insights — Sam Steel &amp; Brett Norris">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700;900&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../styles.css">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23FFE512'/><text x='50' y='68' font-family='Georgia,serif' font-size='58' font-weight='700' text-anchor='middle' fill='%23595959'>S</text></svg>">
<style>
.page-hero{position:relative;color:#fff;padding-top:88px;overflow:hidden;background:var(--near-black)}
.page-hero__media{position:absolute;inset:0;z-index:0}
.page-hero__media img{width:100%;height:100%;object-fit:cover;opacity:.5}
.page-hero::after{content:"";position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,rgba(14,14,16,.5) 0%,rgba(14,14,16,.35) 45%,rgba(14,14,16,.86) 100%)}
.page-hero .wrap{position:relative;z-index:2}
.page-hero.index{min-height:clamp(340px,48vh,520px);display:flex;align-items:flex-end;padding-bottom:60px}
.page-hero .kick{font-family:var(--sans);font-weight:700;font-size:12.5px;letter-spacing:.26em;text-transform:uppercase;color:rgba(255,255,255,.9);margin:0 0 22px}
.page-hero h1{color:#fff;font-weight:500;font-size:clamp(34px,5vw,64px);line-height:1.06;max-width:20ch}
.page-hero .tag{max-width:54ch;color:rgba(255,255,255,.85);font-size:clamp(16px,1.7vw,19px);margin:22px 0 0;font-weight:300;line-height:1.6}
.blog-list{padding-block:clamp(56px,7vw,100px)}
.featured{display:grid;grid-template-columns:1.15fr 1fr;gap:clamp(28px,4vw,56px);align-items:center;margin-bottom:64px;padding-bottom:64px;border-bottom:1px solid var(--hairline)}
.featured .cat{font-family:var(--sans);font-weight:700;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted)}
.featured h2{font-family:var(--serif);font-size:clamp(26px,3.4vw,42px);font-weight:500;color:var(--ink);margin:14px 0 16px;line-height:1.12}
.featured p{color:var(--body);margin:0 0 20px;max-width:48ch;line-height:1.65}
.featured .thumb{aspect-ratio:4/3;border-radius:4px;overflow:hidden;background:var(--light-grey)}
.featured .thumb img{width:100%;height:100%;object-fit:cover;transition:transform .9s var(--ease)}
.featured:hover .thumb img{transform:scale(1.04)}
.featured .date{font-family:var(--sans);font-size:13px;color:var(--muted);display:flex;align-items:center;gap:10px}
.featured .date::before{content:"";width:18px;height:2px;background:var(--yellow)}
.posts{display:grid;grid-template-columns:repeat(3,1fr);gap:30px}
.post{display:flex;flex-direction:column;background:#fff;border:1px solid var(--hairline);border-radius:3px;overflow:hidden;transition:transform .4s var(--ease),box-shadow .4s var(--ease)}
.post:hover{transform:translateY(-5px);box-shadow:0 22px 50px rgba(0,0,0,.09)}
.post .c{padding:26px 26px 30px;display:flex;flex-direction:column;flex:1}
.post .cat{font-family:var(--sans);font-weight:700;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.post h3{font-family:var(--serif);font-size:21px;font-weight:500;color:var(--ink);margin:12px 0 12px;line-height:1.22}
.post p{font-size:14.5px;color:var(--body);margin:0 0 20px;flex:1;line-height:1.65}
.post .date{font-family:var(--sans);font-size:12.5px;letter-spacing:.06em;color:var(--muted);display:flex;align-items:center;gap:10px}
.post .date::before{content:"";width:16px;height:2px;background:var(--yellow)}
.post-cta{background:var(--near-black);color:#fff;text-align:center;padding-block:clamp(56px,7vw,96px)}
.post-cta h2{color:#fff;font-family:var(--serif);font-size:clamp(28px,3.6vw,44px);font-weight:500;max-width:20ch;margin:0 auto 18px}
.post-cta h2 em{font-style:italic}
.post-cta>p{color:rgba(255,255,255,.8);max-width:50ch;margin:0 auto 34px}
.nav a.active::after{width:100%}
@media(max-width:768px){
  .featured{grid-template-columns:1fr;gap:24px}
  .posts{grid-template-columns:1fr;max-width:520px;margin-inline:auto}
  .page-hero h1{font-size:30px}
}
</style>
</head>
<body>
<a id="top"></a>

<nav class="mnav" id="mnav" aria-label="Mobile">
  <button class="mnav__close" id="mclose" aria-label="Close menu">&times;</button>
  <a href="/">Home</a>
  <a href="/#about">About</a>
  <a href="/#listings">For Sale</a>
  <a href="/#sold">Sold</a>
  <a href="/blog/">Blog</a>
  <a href="/#contact">Contact</a>
  <a href="tel:+642102262945" class="mnav__phone">021 026 2945</a>
</nav>

<header class="site-header scrolled" id="header">
  <div class="wrap">
    <a href="/" class="brand" aria-label="Sam Steel &amp; Brett Norris, Ray White Manurewa">
      <img class="brand-logo" src="../assets/raywhite-logo.png" alt="Ray White">
      <span class="brand-txt">
        <span class="name">Sam Steel &amp; Brett Norris</span>
        <span class="sub">Ray White Manurewa</span>
      </span>
    </a>
    <nav class="nav" aria-label="Primary">
      <a href="/#about">About</a>
      <a href="/#listings">For Sale</a>
      <a href="/#sold">Sold</a>
      <a href="/blog/" class="active">Blog</a>
      <a href="/#contact" class="nav-cta">Get in Touch</a>
    </nav>
    <button class="burger" id="burger" aria-label="Open menu"><span></span><span></span><span></span></button>
  </div>
</header>

<section class="page-hero index">
  <div class="page-hero__media"><img src="../assets/website-hero.jpg" alt="South Auckland property insights"></div>
  <div class="wrap">
    <p class="kick">Market Insights</p>
    <h1>Local knowledge, worth reading.</h1>
    <p class="tag">Market updates, buyer guides and selling tips from Sam and Brett — helping you make confident property decisions across South Auckland.</p>
  </div>
</section>

<section class="blog-list">
  <div class="wrap">
    ${posts.length ? `<a class="featured" href="/blog/${posts[0].slug}/">
      <div class="thumb"><img src="../assets/website-hero.jpg" alt="${esc(posts[0].title)}"></div>
      <div>
        <span class="cat">Featured &middot; ${esc(posts[0].suburb)}</span>
        <h2>${esc(posts[0].title)}</h2>
        <p>${esc(posts[0].excerpt)}</p>
        <span class="date"><time datetime="${posts[0].date}">${shortDate(posts[0].date)}</time></span>
      </div>
    </a>` : ''}
    ${posts.length > 1 ? `<div class="posts">
      ${posts.slice(1).map(p =>
        `<a class="post" href="/blog/${p.slug}/">
          <div class="c">
            <span class="cat">${esc(p.suburb)}</span>
            <h3>${esc(p.title)}</h3>
            <p>${esc(p.excerpt)}</p>
            <span class="date"><time datetime="${p.date}">${shortDate(p.date)}</time></span>
          </div>
        </a>`
      ).join('\n      ')}
    </div>` : ''}
  </div>
</section>

<section class="post-cta">
  <div class="wrap">
    <p class="eyebrow" style="justify-content:center;color:rgba(255,255,255,.75)">Get in touch</p>
    <h2>Thinking about your <em>next move?</em></h2>
    <p>Sam and Brett offer honest, obligation-free appraisals across Wattle Downs, Manurewa, Hill Park, and South Auckland.</p>
    <a href="/#contact" class="btn" style="background:var(--yellow);color:var(--near-black);border-color:var(--yellow)">Request an appraisal</a>
  </div>
</section>

<footer class="footer">
  <div class="wrap">
    <p>&copy; <span id="year">2026</span> Sam Steel &amp; Brett Norris, Ray White Manurewa. All rights reserved.</p>
    <nav>
      <a href="/">Home</a>
      <a href="/blog/">Blog</a>
      <a href="/#contact">Contact</a>
    </nav>
  </div>
</footer>

<script>
document.getElementById('year').textContent=new Date().getFullYear();
document.getElementById('burger').addEventListener('click',function(){document.getElementById('mnav').classList.add('open')});
document.getElementById('mclose').addEventListener('click',function(){document.getElementById('mnav').classList.remove('open')});
document.querySelectorAll('.mnav a').forEach(function(a){a.addEventListener('click',function(){document.getElementById('mnav').classList.remove('open')})});
</script>
</body>
</html>`;

  await fs.writeFile(path.join(distBlogDir, 'index.html'), blogIndexHtml);

  console.log(`[build] Generated ${posts.length} blog posts + index`);
  return posts;
}

function convertMarkdownToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line
    if (!line.trim()) { i++; continue; }

    // Headings
    if (/^### (.+)/.test(line)) { out.push(`<h3>${inline(line.slice(4))}</h3>`); i++; continue; }
    if (/^## (.+)/.test(line)) { out.push(`<h2>${inline(line.slice(3))}</h2>`); i++; continue; }
    if (/^# (.+)/.test(line)) { out.push(`<h1>${inline(line.slice(2))}</h1>`); i++; continue; }

    // Table
    if (line.includes('|') && lines[i + 1] && /^\|[\s-:|]+\|$/.test(lines[i + 1].trim())) {
      const headers = line.split('|').filter(c => c.trim()).map(c => `<th>${inline(c.trim())}</th>`);
      i += 2; // skip header + separator
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim().startsWith('|')) {
        const cells = lines[i].split('|').filter(c => c.trim()).map(c => `<td>${inline(c.trim())}</td>`);
        rows.push(`<tr>${cells.join('')}</tr>`);
        i++;
      }
      out.push(`<div class="table-wrap"><table><thead><tr>${headers.join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`);
      continue;
    }

    // Unordered list
    if (/^[-*] /.test(line.trim())) {
      const items = [];
      while (i < lines.length && /^[-*] /.test(lines[i].trim())) {
        items.push(`<li>${inline(lines[i].trim().slice(2))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\. /.test(line.trim())) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i].trim())) {
        items.push(`<li>${inline(lines[i].trim().replace(/^\d+\.\s*/, ''))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    // Paragraph (collect contiguous non-blank lines)
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^#{1,3} /.test(lines[i]) && !/^[-*] /.test(lines[i].trim()) && !/^\d+\. /.test(lines[i].trim()) && !(lines[i].includes('|') && lines[i + 1] && /^\|[\s-:|]+\|$/.test((lines[i + 1] || '').trim()))) {
      para.push(lines[i]);
      i++;
    }
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }

  return out.join('\n');

  function inline(s) {
    return s
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }
}

// Call buildBlog() before writing output
await buildBlog();
