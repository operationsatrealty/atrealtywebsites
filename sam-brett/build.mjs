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
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(post.title)} – Sam & Brett | Ray White Manurewa</title>
  <meta name="description" content="${esc(post.excerpt)}" />
  <link rel="canonical" href="${SITE_ORIGIN}/blog/${post.slug}/" />
  <link rel="stylesheet" href="../styles.css" />
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='75' font-size='75' font-weight='bold' fill='%23FFE512'>S</text></svg>" />
</head>
<body>

<header class="header">
  <div class="container">
    <div class="header__inner">
      <a href="/" class="header__logo">
        <svg class="raywhite-logo" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="100" fill="#FFE512" />
          <text x="5" y="80" font-size="24" font-weight="bold" font-family="Arial" fill="#595959">RAYWHITE</text>
        </svg>
        <span class="header__title">Sam & Brett</span>
      </a>
      <nav class="nav">
        <a href="/" class="nav__link">Home</a>
        <a href="/#about" class="nav__link">About</a>
        <a href="/blog/" class="nav__link">Blog</a>
        <a href="/#contact" class="nav__link nav__link--cta">Contact</a>
      </nav>
    </div>
  </div>
</header>

<article class="blog-post">
  <div class="container">
    <header class="blog-post__header">
      <h1 class="blog-post__title">${esc(post.title)}</h1>
      <div class="blog-post__meta">
        <time datetime="${post.date}">${shortDate(post.date)}</time>
        ${post.suburb ? `<span class="blog-post__suburb">${esc(post.suburb)}</span>` : ''}
      </div>
    </header>

    <div class="blog-post__body">
      ${convertMarkdownToHtml(post.content)}
    </div>

    <footer class="blog-post__footer">
      <div class="blog-post__cta">
        <p><strong>Need help in ${esc(post.suburb || 'South Auckland')}?</strong></p>
        <a href="/#contact" class="btn btn--primary">Get in Touch</a>
      </div>
    </footer>
  </div>
</article>

<section class="blog-related">
  <div class="container">
    <h2>More from the Blog</h2>
    <div class="blog-related__list">
      ${posts.filter(p => p.slug !== post.slug).slice(0, 3).map(p => 
        `<div class="blog-related__item">
          <a href="/blog/${p.slug}/">
            <h3>${esc(p.title)}</h3>
            <p>${esc(p.excerpt)}</p>
            <time>${shortDate(p.date)}</time>
          </a>
        </div>`
      ).join('\n')}
    </div>
  </div>
</section>

<footer class="footer">
  <div class="container">
    <div class="footer__content">
      <p>&copy; 2026–<span id="year"></span> Sam Steel & Brett Norris. Ray White Manurewa (A T Realty Group).</p>
      <div class="footer__links">
        <a href="https://www.facebook.com/samsteelrealestate">Facebook</a>
        <a href="https://www.instagram.com/samsteel_realestate/">Instagram</a>
        <a href="https://www.linkedin.com/in/brett-norris-071284245/">LinkedIn</a>
      </div>
    </div>
  </div>
</footer>

<script>document.getElementById('year').textContent = new Date().getFullYear();</script>
</body>
</html>`;

    await fs.mkdir(path.join(distBlogDir, post.slug), { recursive: true });
  await fs.writeFile(path.join(distBlogDir, post.slug, 'index.html'), html);
  }

  // Generate blog index
  const blogIndexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Blog – Sam & Brett | Ray White Manurewa</title>
  <meta name="description" content="Real estate insights for Wattle Downs, Manurewa, Hill Park, Totara Park, and The Gardens." />
  <link rel="canonical" href="${SITE_ORIGIN}/blog/" />
  <link rel="stylesheet" href="../styles.css" />
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='75' font-size='75' font-weight='bold' fill='%23FFE512'>S</text></svg>" />
</head>
<body>

<header class="header">
  <div class="container">
    <div class="header__inner">
      <a href="/" class="header__logo">
        <svg class="raywhite-logo" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="100" fill="#FFE512" />
          <text x="5" y="80" font-size="24" font-weight="bold" font-family="Arial" fill="#595959">RAYWHITE</text>
        </svg>
        <span class="header__title">Sam & Brett</span>
      </a>
      <nav class="nav">
        <a href="/" class="nav__link">Home</a>
        <a href="/#about" class="nav__link">About</a>
        <a href="/blog/" class="nav__link">Blog</a>
        <a href="/#contact" class="nav__link nav__link--cta">Contact</a>
      </nav>
    </div>
  </div>
</header>

<section class="blog-index">
  <div class="container">
    <header class="blog-index__header">
      <h1>Real Estate Insights for South Auckland</h1>
      <p>Market updates, buyer guides, and selling tips from Sam and Brett.</p>
    </header>

    <div class="blog-index__list">
      ${posts.map(p => 
        `<article class="blog-card">
          <h2><a href="/blog/${p.slug}/">${esc(p.title)}</a></h2>
          <div class="blog-card__meta">
            <time datetime="${p.date}">${shortDate(p.date)}</time>
            ${p.suburb ? `<span>${esc(p.suburb)}</span>` : ''}
          </div>
          <p>${esc(p.excerpt)}</p>
          <a href="/blog/${p.slug}/" class="blog-card__link">Read more →</a>
        </article>`
      ).join('\n')}
    </div>
  </div>
</section>

<footer class="footer">
  <div class="container">
    <div class="footer__content">
      <p>&copy; 2026–<span id="year"></span> Sam Steel & Brett Norris. Ray White Manurewa (A T Realty Group).</p>
      <div class="footer__links">
        <a href="https://www.facebook.com/samsteelrealestate">Facebook</a>
        <a href="https://www.instagram.com/samsteel_realestate/">Instagram</a>
        <a href="https://www.linkedin.com/in/brett-norris-071284245/">LinkedIn</a>
      </div>
    </div>
  </div>
</footer>

<script>document.getElementById('year').textContent = new Date().getFullYear();</script>
</body>
</html>`;

  await fs.writeFile(path.join(distBlogDir, 'index.html'), blogIndexHtml);

  console.log(`[build] Generated ${posts.length} blog posts + index`);
  return posts;
}

function convertMarkdownToHtml(md) {
  let html = md
    .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^- (.*?)$/gm, '<li>$1</li>');
  
  html = html.replace(/(<li>.*?<\/li>)/s, '<ul>$1</ul>');
  return `<p>${html}</p>`;
}

// Call buildBlog() before writing output
await buildBlog();
