/**
 * Build the Levani Lum-On site (levani-lumon.vercel.app, later
 * levanilumonrealestate.co.nz).
 *
 *   node build.mjs             → dist/  (production: live embed, CDN photos)
 *   node build.mjs --preview   → dist-preview/  (self-contained single file)
 *   node build.mjs --offline   → skip VaultRE, use the committed snapshot
 *
 * A per-agent copy of the tom-mccartney build — kept separate on purpose so
 * changes for one agent can never affect another's site. Listings and sales
 * are baked in at BUILD time, not fetched in the browser: the VaultRE key
 * stays server-side and the property content is crawlable. See
 * tom-mccartney/README.md for the full reasoning; it applies here unchanged.
 *
 * If VaultRE can't be reached the build does NOT fail: it falls back to
 * data/listings.json, the last good snapshot. The committed seed is EMPTY —
 * never deploy until a live build has refreshed it with Levani's real data.
 */

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { agentListings, vaultreConfigured } from "./vaultre.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AGENT_EMAIL = "levani.lumon@raywhite.com";
/**
 * Canonical origin — the site's domain is levanilumon.co.nz (Crazy Domains).
 * Until DNS points at the Vercel project the vercel.app URL still serves,
 * but canonical/og always name the real domain.
 */
const SITE_ORIGIN = "https://levanilumon.co.nz";
/**
 * Portrait master: 2419x2419 from Ray White's member-photo CDN (the original
 * behind his raywhite.co.nz profile), committed to the repo. The Supabase
 * agent-photos copy is only 1280x720 landscape — too soft for upright crops.
 */
const PORTRAIT_SRC = "assets/levani-portrait.jpg";
const PORTRAIT_URL =
  "https://tfksucrwafwyzxpjrtvj.supabase.co/storage/v1/object/public/agent-photos/A021/levani-lum-on.jpg";

/** How many settled sales the table lists. The full count is still stated. */
const SOLD_TABLE_ROWS = 12;

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

/** $197.8m / $815k / $3.27m — compact, for display figures. */
function money(n) {
  if (!n && n !== 0) return "—";
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${m >= 10 ? m.toFixed(1) : m.toFixed(2)}m`.replace(/\.0+m$/, "m");
  }
  if (n >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${n}`;
}

/** $1,180,000 — exact, for the sold table. */
const moneyExact = (n) => (n ? `$${n.toLocaleString("en-NZ")}` : "Price withheld");

const NZ_DATE = new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "short", year: "numeric" });
const shortDate = (iso) => (iso ? NZ_DATE.format(new Date(iso)) : "");

/** "Manurewa, Ōtara and Papatoetoe" */
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
    console.log(`[build] Fetching ${AGENT_EMAIL} from VaultRE…`);
    const live = await agentListings(AGENT_EMAIL);
    if (live && live.sold.length) {
      console.log(
        `[build] VaultRE ok — ${live.current.length} current, ${live.sold.length} settled ` +
          `(offices: ${live.offices.map((o) => o.office).join(", ")})`
      );
      // Refresh the committed snapshot so the next offline build is current.
      await fs.writeFile(snapshotPath, JSON.stringify(live, null, 2) + "\n");
      return { data: live, source: "vaultre" };
    }
    console.warn("[build] VaultRE returned nothing usable — falling back to snapshot.");
  } else if (!OFFLINE) {
    console.warn("[build] VaultRE credentials not set — using snapshot. Listings may be stale.");
  }

  const data = JSON.parse(await fs.readFile(snapshotPath, "utf8"));
  console.log(`[build] Snapshot — ${data.current.length} current, ${data.sold.length} settled.`);
  if (!data.sold.length) {
    console.error("[build] Snapshot is the empty seed — refusing to build a site with no data.");
    process.exit(1);
  }
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
      <a href="#contact">Get in touch</a> and I'll let you know what's coming.
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
    .slice(0, SOLD_TABLE_ROWS)
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
    name: "Levani Lum-On",
    jobTitle: "Licensee Salesperson",
    url: `${SITE_ORIGIN}/`,
    image: PORTRAIT_URL,
    telephone: "+64 21 525 025",
    email: "levani.lumon@raywhite.com",
    areaServed: [
      "Papatoetoe",
      "Manurewa",
      "Māngere",
      "Ōtara",
      "Mt Wellington",
      "Manukau",
      "Mount Roskill",
      "Te Atatu Peninsula",
      "Massey",
      "South Auckland",
    ],
    worksFor: { "@type": "Organization", name: "Ray White Manukau (A T Realty)" },
    address: {
      "@type": "PostalAddress",
      streetAddress: "603 Great South Road",
      addressLocality: "Manukau City",
      addressRegion: "Auckland",
      postalCode: "2104",
      addressCountry: "NZ",
    },
  });
}

/* ------------------------------------------------------------------ */
/* the appraisal panel                                                 */
/* ------------------------------------------------------------------ */

/**
 * The A T Realty marketing form for Levani does NOT exist yet — both
 * sales-appraisal-levani-lum-on and -levani-lumon return "Form not found"
 * on atrealtygroup.co.nz (checked 24 Sep 2026). Until one is created in the
 * marketing-forms admin (duplicate Tom's "Sales Appraisal - Tom McCartney",
 * assignee levani.lumon@raywhite.com, ADD AN EMAIL NOTIFICATION ROW), the
 * panel renders direct contact actions instead of a broken embed.
 *
 * When the form exists: set FORM_READY = true, confirm FORM_SLUG matches the
 * admin, and redeploy. Enquiries must reach Levani with Rachel copied —
 * rachel.lumon@raywhite.com — whichever path is live.
 */
const FORM_READY = false;
const FORM_SLUG = "sales-appraisal-levani-lum-on";
const FORM_ORIGIN = "https://atrealtygroup.co.nz";

const MAILTO =
  "mailto:levani.lumon@raywhite.com" +
  "?cc=rachel.lumon@raywhite.com" +
  "&subject=" + encodeURIComponent("Appraisal request — from levanilumon.co.nz") +
  "&body=" + encodeURIComponent(
    "Hi Levani,\n\nI'd like a free appraisal.\n\nProperty address:\nBest phone number:\nAnything else you should know:\n"
  );

const contactPanel = `<div class="formPanel__direct">
        <strong>Request your free appraisal</strong>
        <p>No obligation, no pressure — an honest number and a clear plan. Email me a line
        about your property, or call or text and I'll pick up.</p>
        <a class="btn btn--primary" href="${MAILTO}">Email Levani</a>
        <a class="btn btn--ghost" href="tel:+6421525025">Call or text 021 525 025</a>
      </div>`;

const formSlot = FORM_READY && !PREVIEW ? `<div data-atr-form="${FORM_SLUG}"></div>` : contactPanel;
const formScript = FORM_READY && !PREVIEW ? `<script src="${FORM_ORIGIN}/mkt-forms-embed.js" async></script>` : "";

/* ------------------------------------------------------------------ */
/* images                                                              */
/* ------------------------------------------------------------------ */

const IMAGE_CACHE = path.join(HERE, ".image-cache");
const derived = new Map();

async function fetchBuffer(url) {
  // Local path (a committed asset) rather than a remote URL.
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

// The 2419x2419 master supports genuine upright crops; attention keeps the
// frame on Levani.
const portraitHero = await image(PORTRAIT_SRC, {
  width: 900,
  height: 1125,
  quality: 82,
  name: "levani-hero",
});
const portraitAbout = await image(PORTRAIT_SRC, {
  width: 640,
  height: 800,
  quality: 82,
  name: "levani-about",
});

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

/* ------------------------------------------------------------------ */
/* market news                                                         */
/* ------------------------------------------------------------------ */

/**
 * Posts live in data/market-news.json so refreshing the page is a data
 * commit, not a code change. Each post: { tag, date, title, paragraphs[],
 * bullets[]?, sources[{label,url}] }. The file's updatedAt drives the
 * "last reviewed" line; a stale file makes the build shout, because market
 * commentary quietly going out of date is worse than none at all.
 */
const news = JSON.parse(await fs.readFile(path.join(HERE, "data", "market-news.json"), "utf8"));
const newsAgeDays = Math.floor((Date.now() - new Date(news.updatedAt)) / 86_400_000);
if (newsAgeDays > 45) {
  console.warn(
    `[build] *** MARKET NEWS IS ${newsAgeDays} DAYS OLD (updated ${news.updatedAt}). ` +
      `Refresh data/market-news.json — the monthly refresh task may have stopped. ***`
  );
}

function postsHtml(posts) {
  return posts
    .map((p) => {
      const paragraphs = p.paragraphs.map((t) => `<p>${t}</p>`).join("\n");
      const bullets = p.bullets?.length
        ? `<ul>${p.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
        : "";
      const sources = p.sources
        .map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`)
        .join(" · ");
      return `<article class="post">
          <div class="post__meta">
            <span class="post__tag">${esc(p.tag)}</span>
            <span class="post__date">${esc(p.date)}</span>
          </div>
          <h2>${esc(p.title)}</h2>
          ${paragraphs}
          ${bullets}
          <p class="post__sources">Sources: ${sources}</p>
        </article>`;
    })
    .join("\n");
}

const template = await fs.readFile(path.join(HERE, "src", "index.template.html"), "utf8");

const replacements = {
  PORTRAIT_HERO: portraitHero,
  PORTRAIT_ABOUT: portraitAbout,
  PORTRAIT: PREVIEW ? PORTRAIT_URL : `${SITE_ORIGIN}/${portraitHero}`,
  CURRENT_LISTINGS: currentListingsHtml(data.current, photoSrc),
  SOLD_ROWS: soldRowsHtml(data.sold),
  SOLD_SHOWN: String(Math.min(SOLD_TABLE_ROWS, data.sold.length)),
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

/* market news page */
const blogTemplate = await fs.readFile(path.join(HERE, "src", "blog.template.html"), "utf8");
let blogHtml = blogTemplate
  .replaceAll("{{POSTS}}", postsHtml(news.posts))
  .replaceAll("{{NEWS_UPDATED}}", NZ_DATE.format(new Date(news.updatedAt)))
  .replaceAll("{{PORTRAIT}}", PREVIEW ? PORTRAIT_URL : `${SITE_ORIGIN}/${portraitHero}`);

const blogUnresolved = [...blogHtml.matchAll(/\{\{([A-Z_]+)\}\}/g)].map((m) => m[1]);
if (blogUnresolved.length) {
  console.error(`[build] Unresolved blog placeholders: ${[...new Set(blogUnresolved)].join(", ")}`);
  process.exit(1);
}

/* write output */
if (PREVIEW) {
  const css = await fs.readFile(path.join(HERE, "src", "styles.css"), "utf8");
  const js = await fs.readFile(path.join(HERE, "src", "script.js"), "utf8");
  html = html
    .replace('<link rel="stylesheet" href="styles.css" />', `<style>\n${css}\n</style>`)
    .replace('<script src="script.js" defer></script>', `<script>\n${js}\n</script>`);

  for (const name of ["raywhite-logo.png", "raywhite-mark.png"]) {
    const buf = await fs.readFile(path.join(HERE, "assets", name));
    html = html.replaceAll(`assets/${name}`, `data:image/png;base64,${buf.toString("base64")}`);
  }
  html = html.replace(/<link rel="icon"[^>]*>\s*/g, "");

  await fs.writeFile(path.join(OUT, "index.html"), html);
} else {
  await fs.writeFile(path.join(OUT, "index.html"), html);
  await fs.writeFile(path.join(OUT, "blog.html"), blogHtml);
  await fs.copyFile(path.join(HERE, "src", "styles.css"), path.join(OUT, "styles.css"));
  await fs.copyFile(path.join(HERE, "src", "script.js"), path.join(OUT, "script.js"));
  for (const name of await fs.readdir(path.join(HERE, "assets"))) {
    await fs.copyFile(path.join(HERE, "assets", name), path.join(OUT, "assets", name));
  }
}

// Expose the (just-refreshed) snapshot alongside the site. It's the same
// public listing data the page shows, and it lets a machine without VaultRE
// credentials pull a fresh snapshot from any successful build.
await fs.copyFile(snapshotPath, path.join(OUT, "data.json"));

const bytes = (await fs.stat(path.join(OUT, "index.html"))).size;
console.log(
  `[build] Wrote ${path.relative(HERE, OUT)}/index.html (${(bytes / 1024).toFixed(0)} KB) ` +
    `— data source: ${source}, ${stats.soldCount} sales, ${stats.totalSettled} settled.`
);
