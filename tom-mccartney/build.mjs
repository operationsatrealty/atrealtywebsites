/**
 * Build tommccartney.co.nz.
 *
 *   node build.mjs             → dist/  (production: live embed, CDN photos)
 *   node build.mjs --preview   → dist-preview/  (self-contained single file,
 *                                photos inlined, form shown as a placeholder —
 *                                for sharing a preview where external
 *                                requests are blocked)
 *   node build.mjs --offline   → skip VaultRE, use the committed snapshot
 *
 * Listings and sales are baked in at BUILD time, not fetched in the browser.
 * Two reasons, in order of importance:
 *
 *   1. Security. This is a static site. A client-side fetch would mean
 *      shipping the VaultRE API key and bearer token in readable JavaScript.
 *      Baking at build time keeps them server-side, in Vercel's environment
 *      variables, and out of the bundle entirely.
 *   2. SEO. An agent site lives or dies on its property content being
 *      crawlable. In the HTML it is; behind a fetch it mostly isn't.
 *
 * The cost is that the data is only as fresh as the last deploy, so a
 * scheduled rebuild is what keeps it current — see README.
 *
 * If VaultRE can't be reached the build does NOT fail: it falls back to
 * data/listings.json, the last good snapshot, and says so. A CRM outage
 * must never be able to take the website down.
 */

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { agentListings, vaultreConfigured } from "./vaultre.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AGENT_EMAIL = "tom.mccartney@raywhite.com";
const SITE_ORIGIN = "https://tommccartney.co.nz";
/**
 * Portrait source. `assets/tom-portrait.jpg` is a 2400x1600 master committed
 * to the repo — a downscale of the 6000x4000 original Hannah supplied.
 *
 * It replaced the Supabase `agent-photos` copy, which is only 1280x720 and
 * capped how sharp any upright crop could be. The Supabase URL is still used
 * for og:image metadata elsewhere, and is worth updating there too so the
 * main atrealty-next profile page benefits from the better photo.
 */
const PORTRAIT_SRC = "assets/tom-portrait.jpg";
const PORTRAIT_URL =
  "https://tfksucrwafwyzxpjrtvj.supabase.co/storage/v1/object/public/agent-photos/A100/tom-mccartney.png";

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
    name: "Tom McCartney",
    jobTitle: "Licensee Salesperson",
    url: "https://tommccartney.co.nz/",
    image: PORTRAIT_URL,
    telephone: "+64 21 856 286",
    email: "tom.mccartney@raywhite.com",
    areaServed: ["Manurewa", "Ōtara", "Papatoetoe", "Papakura", "Clendon Park", "South Auckland"],
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

/* ------------------------------------------------------------------ */
/* the embedded A T Realty marketing form                              */
/* ------------------------------------------------------------------ */

/**
 * The A T Realty marketing form "Sales Appraisal - Tom McCartney",
 * assigned to tom.mccartney@raywhite.com.
 *
 * This slug and the admin must stay in step: the form previously lived at
 * `sales-appraisal-renuka-bisht-2` (it was duplicated from Renuka Bisht's
 * and kept her slug), and renaming it there immediately broke the embed
 * here. If the slug changes again, change it here too.
 */
const FORM_SLUG = "sales-appraisal-tom-mccartney";
const FORM_ORIGIN = "https://atrealtygroup.co.nz";

const formSlot = PREVIEW
  ? `<div class="formPanel__fallback">
        <strong style="color:var(--ink);font-size:1rem">Appraisal request form</strong>
        <p>The live A T Realty form (<code>${FORM_SLUG}</code>) is embedded here on the
        published site. This shared preview blocks third-party scripts, so it can't render
        in this view — it will appear on tommccartney.co.nz.</p>
      </div>`
  : `<div data-atr-form="${FORM_SLUG}"></div>`;

const formScript = PREVIEW ? "" : `<script src="${FORM_ORIGIN}/mkt-forms-embed.js" async></script>`;

/* ------------------------------------------------------------------ */
/* images                                                              */
/* ------------------------------------------------------------------ */

/**
 * VaultRE serves property photos at full print resolution — 4500x3000,
 * 3.5–4.6MB each — and its CDN ignores every resize parameter we tried, so
 * linking straight to it would put ~12MB of images on the page. They are
 * downloaded, resized and re-encoded here instead, then served from our own
 * /assets/listings/. Same for the portrait (a 2.4MB PNG).
 *
 * Output is content-hashed so it can be cached immutably, and the fetch is
 * wrapped: a photo that won't download falls back to the original URL rather
 * than failing the build.
 */
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

/**
 * Resize `url` to `width` (and optionally `height`) and return either a path
 * under assets/listings/ (normal build) or a data: URI (preview build, so the
 * file stands alone).
 *
 * When a height is given the crop uses sharp's `attention` strategy, which
 * picks the most salient region rather than the centre. That matters for the
 * portrait: the only headshot in the Supabase agent-photos bucket is
 * 1280x720 **landscape**, so any upright frame is a heavy crop, and a plain
 * centre crop puts Tom off to one side. Attention finds him.
 *
 * That 1280x720 source is also the ceiling on portrait sharpness here — the
 * largest square it can yield is 720x720. A higher-resolution portrait
 * uploaded to the bucket would improve this with no code change.
 */
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

// Output directory is created first — optimised images are written into it
// as they're produced.
await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(path.join(OUT, "assets"), { recursive: true });

console.log("[build] Optimising images…");

// Two portrait derivatives. The 2400x1600 master has enough resolution for a
// genuine upright crop, so the hero is a 4:5 portrait rather than the square
// the old 1280x720 source forced. Both are cropped with sharp's attention
// strategy so they centre on Tom, not the middle of the greenery.
const portraitHero = await image(PORTRAIT_SRC, {
  width: 900,
  height: 1125,
  quality: 82,
  name: "tom-hero",
});
const portraitAbout = await image(PORTRAIT_SRC, {
  width: 640,
  height: 800,
  quality: 82,
  name: "tom-about",
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

const template = await fs.readFile(path.join(HERE, "src", "index.template.html"), "utf8");

const replacements = {
  PORTRAIT_HERO: portraitHero,
  PORTRAIT_ABOUT: portraitAbout,
  // og:image must be an absolute URL, and should not be the 2.4MB
  // original — social scrapers reject or time out on large files.
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

/* write output */
if (PREVIEW) {
  // One self-contained file: fold the stylesheet and script inline.
  const css = await fs.readFile(path.join(HERE, "src", "styles.css"), "utf8");
  const js = await fs.readFile(path.join(HERE, "src", "script.js"), "utf8");
  html = html
    .replace('<link rel="stylesheet" href="styles.css" />', `<style>\n${css}\n</style>`)
    .replace('<script src="script.js" defer></script>', `<script>\n${js}\n</script>`);

  // Local brand assets → data URIs, so nothing is left to request.
  for (const name of ["raywhite-logo.png", "raywhite-mark.png"]) {
    const buf = await fs.readFile(path.join(HERE, "assets", name));
    html = html.replaceAll(`assets/${name}`, `data:image/png;base64,${buf.toString("base64")}`);
  }
  html = html.replace(/<link rel="icon"[^>]*>\s*/g, "");

  await fs.writeFile(path.join(OUT, "index.html"), html);
} else {
  await fs.writeFile(path.join(OUT, "index.html"), html);
  await fs.copyFile(path.join(HERE, "src", "styles.css"), path.join(OUT, "styles.css"));
  await fs.copyFile(path.join(HERE, "src", "script.js"), path.join(OUT, "script.js"));
  for (const name of await fs.readdir(path.join(HERE, "assets"))) {
    await fs.copyFile(path.join(HERE, "assets", name), path.join(OUT, "assets", name));
  }
}

const bytes = (await fs.stat(path.join(OUT, "index.html"))).size;
console.log(
  `[build] Wrote ${path.relative(HERE, OUT)}/index.html (${(bytes / 1024).toFixed(0)} KB) ` +
    `— data source: ${source}, ${stats.soldCount} sales, ${stats.totalSettled} settled.`
);
