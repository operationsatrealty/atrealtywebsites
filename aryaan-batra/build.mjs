/**
 * Build the Aryaan Batra site (aryaan-batra.vercel.app).
 *
 *   node build.mjs             → dist/  (fetches VaultRE when credentials are set)
 *   node build.mjs --offline   → skip VaultRE, use the committed snapshot
 *
 * A per-agent copy of the levani-lumon / tom-mccartney build — kept separate on
 * purpose so changes for one agent can never affect another's site. Listings
 * and sales are baked in at BUILD time, not fetched in the browser: the VaultRE
 * key stays server-side and the property content is crawlable.
 *
 * If VaultRE can't be reached the build does NOT fail: it falls back to
 * data/listings.json, the last good snapshot. The committed seed is EMPTY, and
 * the build refuses to publish from it, so the hand-checked site stays live
 * until a build has real data.
 *
 * Per-sale prices are dropped before the snapshot is written, as on casey-green:
 * this repo is public and the snapshot is also published as /data.json. The page
 * only ever shows totals, and those are kept in the snapshot's `summary`.
 */

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { agentListings, vaultreConfigured } from "./vaultre.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AGENT_EMAIL = "aryaan.batra@raywhite.com";
const SITE_ORIGIN = "https://aryaan-batra.vercel.app";

/** How many recently settled sales the listings section shows. */
const SOLD_CARDS = 6;
/** A fallback older than this makes the build shout. */
const SNAPSHOT_MAX_AGE_DAYS = 7;

const OFFLINE = process.argv.includes("--offline");
const OUT = path.join(HERE, "dist");

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

const moneyExact = (n) => `$${n.toLocaleString("en-NZ")}`;

const NZ = { timeZone: "Pacific/Auckland" };
const MONTH_YEAR = new Intl.DateTimeFormat("en-NZ", { month: "short", year: "numeric", ...NZ });
const NZ_DAY = new Intl.DateTimeFormat("en-CA", NZ);
const AUCTION_DAY = new Intl.DateTimeFormat("en-NZ", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  ...NZ,
});
const AUCTION_SHORT = new Intl.DateTimeFormat("en-NZ", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  ...NZ,
});

/* ------------------------------------------------------------------ */
/* data                                                                */
/* ------------------------------------------------------------------ */

const snapshotPath = path.join(HERE, "data", "listings.json");

function summarise(data) {
  const sold = data.sold.filter((s) => s.settlementDate);
  const value = (list) => list.reduce((n, s) => n + (s.salePrice ?? 0), 0);

  const within = (months) => {
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    return sold.filter((s) => new Date(s.settlementDate) >= since);
  };
  const lastYear = within(12);
  const lastTwoYears = within(24);
  const lastYearPrices = lastYear.map((s) => s.salePrice).filter(Boolean);

  return {
    totalSettled: money(value(data.sold)),
    soldCount: data.sold.length,
    recent24Count: lastTwoYears.length,
    recent24Value: money(value(lastTwoYears)),
    avg12m: lastYearPrices.length ? money(Math.round(value(lastYear) / lastYearPrices.length)) : "—",
    firstYear: sold.map((s) => s.settlementDate.slice(0, 4)).sort()[0] ?? "",
  };
}

/** Odd values are reported, never silently corrected: VaultRE is the record. */
function audit(data) {
  const issues = [];
  for (const l of data.current) {
    if (l.car > 10) issues.push(`${l.address}: ${l.car} car spaces`);
    if (/\d/.test(l.displayPrice ?? "") && !l.displayPrice.includes("$")) {
      issues.push(`${l.address}: price "${l.displayPrice}" has no $ sign`);
    }
    if (!l.photo) issues.push(`${l.address}: no photo`);
    if (!l.url) issues.push(`${l.address}: no link to the listing`);
  }
  for (const s of data.sold) {
    if (s.salePrice && s.salePrice % 1) issues.push(`${s.address}: sale price ${s.salePrice} has cents`);
    if (!s.salePrice) issues.push(`${s.address}: no sale price, so it's missing from the totals`);
    if (s.settlementDate && new Date(s.settlementDate) > new Date()) {
      issues.push(`${s.address}: settlement date ${s.settlementDate} is in the future`);
    }
  }
  for (const issue of issues) console.warn(`[build] Check in VaultRE — ${issue}`);
}

const withoutSalePrice = ({ salePrice, ...sale }) => sale;

async function loadData() {
  const snapshot = JSON.parse(await fs.readFile(snapshotPath, "utf8"));

  if (!OFFLINE && vaultreConfigured()) {
    console.log(`[build] Fetching ${AGENT_EMAIL} from VaultRE…`);
    const live = await agentListings(AGENT_EMAIL);
    // Settled sales only ever accumulate, so a much smaller answer than the
    // snapshot means a page or an office failed part-way. Don't publish it.
    const shrank = live && live.sold.length < snapshot.sold.length * 0.95;
    if (live && live.sold.length && !shrank) {
      console.log(
        `[build] VaultRE ok — ${live.current.length} current, ${live.sold.length} settled ` +
          `(offices: ${live.offices.map((o) => o.office).join(", ")})`
      );
      audit(live);
      const fresh = {
        ...live,
        fetchedAt: new Date().toISOString(),
        sold: live.sold.map(withoutSalePrice),
        summary: summarise(live),
      };
      // Refresh the snapshot so the next offline build is current.
      await fs.writeFile(snapshotPath, JSON.stringify(fresh, null, 2) + "\n");
      return { data: fresh, source: "vaultre" };
    }
    console.warn(
      shrank
        ? `[build] VaultRE returned ${live.sold.length} settled against ${snapshot.sold.length} in the snapshot — falling back to snapshot.`
        : "[build] VaultRE returned nothing usable — falling back to snapshot."
    );
  } else if (!OFFLINE) {
    console.warn("[build] VaultRE credentials not set — using snapshot. Listings may be stale.");
  }

  console.log(`[build] Snapshot — ${snapshot.current.length} current, ${snapshot.sold.length} settled.`);
  if (!snapshot.sold.length || !snapshot.summary) {
    console.error("[build] Snapshot is the empty seed — refusing to build a site with no data.");
    process.exit(1);
  }
  const ageDays = Math.floor((Date.now() - new Date(snapshot.fetchedAt)) / 86_400_000);
  if (ageDays > SNAPSHOT_MAX_AGE_DAYS) {
    console.warn(`[build] *** SNAPSHOT IS ${ageDays} DAYS OLD (fetched ${snapshot.fetchedAt}). Listings may be stale. ***`);
  }
  audit(snapshot);
  return { data: snapshot, source: "snapshot" };
}

/* ------------------------------------------------------------------ */
/* fragments                                                           */
/* ------------------------------------------------------------------ */

/**
 * Method of sale straight from VaultRE (methodOfSale.name), translated to
 * buyer-facing wording. "Private Treaty" is trade jargon for an advertised /
 * negotiated sale, so it renders as "For sale".
 */
const METHOD_LABELS = {
  "private treaty": "For sale",
  auction: "Auction",
  tender: "Tender",
  "set sale date": "Set sale date",
  "deadline sale": "Deadline sale",
  "deadline private treaty": "Deadline sale",
  "expressions of interest": "Expressions of interest",
};

function methodLabel(l) {
  const raw = (l.method?.name ?? "").trim();
  return METHOD_LABELS[raw.toLowerCase()] ?? (raw || "For sale");
}

const isUnderOffer = (l) => (l.status ?? "").toLowerCase() === "conditional";
const statusLabel = (l) => (isUnderOffer(l) ? "Under offer" : methodLabel(l));
const isUpcoming = (date) => Boolean(date) && new Date(date) > new Date();

/** The price line: the advertised price, else the method. */
function priceLine(l) {
  if (l.displayPrice) return l.displayPrice;
  if (l.searchPrice) return moneyExact(l.searchPrice);
  const label = methodLabel(l);
  return label === "For sale" ? "Price by negotiation" : label;
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
      const media = l.photo
        ? `<img class="property__img" src="${esc(photoSrc(l.photo.url))}" alt="${esc(l.address)}, ${esc(l.suburb)}" loading="lazy" />`
        : `<div class="property__img property__img--a"></div>`;
      const open = l.url
        ? `<a class="property reveal" href="${esc(l.url)}" target="_blank" rel="noopener">`
        : `<article class="property reveal">`;
      const close = l.url ? `</a>` : `</article>`;
      const auction = isUpcoming(l.auctionDate)
        ? `<span class="property__method">Auction · ${esc(AUCTION_SHORT.format(new Date(l.auctionDate)))}</span>`
        : "";

      return `${open}
          <div class="property__media">${media}<span class="property__tag${isUnderOffer(l) ? " property__tag--offer" : ""}">${esc(statusLabel(l))}</span></div>
          <div class="property__body">
            ${auction}
            <h3 class="property__addr">${esc(l.address)}</h3>
            <p class="property__suburb">${esc(l.suburb)}</p>
            <p class="property__price">${esc(priceLine(l))}</p>
            <p class="property__meta">${specs(l)}</p>
          </div>
        ${close}`;
    })
    .join("\n");

  return `<div class="listings__grid">\n${cards}\n</div>`;
}

/** The next auction day, or nothing once the last one has passed. */
function auctionBannerHtml(listings) {
  const upcoming = listings
    .filter((l) => isUpcoming(l.auctionDate))
    .sort((a, b) => new Date(a.auctionDate) - new Date(b.auctionDate));
  if (!upcoming.length) return "";

  const next = new Date(upcoming[0].auctionDate);
  const sameDay = upcoming.filter((l) => NZ_DAY.format(new Date(l.auctionDate)) === NZ_DAY.format(next));
  const what =
    sameDay.length > 1
      ? `${sameDay.length} of my listings go under the hammer on the same day.`
      : `${esc(upcoming[0].address)}, ${esc(upcoming[0].suburb)} goes under the hammer.`;

  return `<div class="auction-banner reveal">
        <span class="auction-banner__flag">Auction day</span>
        <p><strong>${esc(AUCTION_DAY.format(next))}</strong> — ${what} Come and watch the room work.</p>
      </div>`;
}

function auctionPoint(listings) {
  const n = listings.filter((l) => methodLabel(l) === "Auction").length;
  if (!n) return "Auction specialist — a firm date, real competition and an unconditional result";
  return `Auction specialist — ${n} ${n === 1 ? "listing" : "listings"} heading to the room right now`;
}

function recentSoldHtml(sold, total) {
  const cards = sold
    .filter((s) => s.settlementDate)
    .slice(0, SOLD_CARDS)
    .map(
      (s) => `<div class="sold reveal">
          <span class="sold__badge">Settled ${esc(MONTH_YEAR.format(new Date(s.settlementDate)))}</span>
          <strong>${esc(s.address)}</strong>
          <span>${esc(s.suburb)}</span>
        </div>`
    );

  return `<h3 class="listings__subhead reveal">Recently settled</h3>
      <div class="sold__grid">
${cards.join("\n")}
      </div>
      <p class="sold__note reveal">The ${cards.length} most recent of ${total} settled sales, from Ray White's own records.</p>`;
}

/* ------------------------------------------------------------------ */
/* images                                                              */
/* ------------------------------------------------------------------ */

const IMAGE_CACHE = path.join(HERE, ".image-cache");

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
 * VaultRE serves photos at full print resolution with no resizing, so each one
 * is cut down and content-hashed for immutable caching.
 */
async function listingPhoto(url, name) {
  try {
    const src = await fetchBuffer(url);
    const jpeg = await sharp(src)
      .rotate()
      .resize({ width: 1000, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 72, mozjpeg: true })
      .toBuffer();
    const hash = crypto.createHash("sha1").update(jpeg).digest("hex").slice(0, 10);
    const file = `${name}-${hash}.jpg`;
    await fs.mkdir(path.join(OUT, "assets", "listings"), { recursive: true });
    await fs.writeFile(path.join(OUT, "assets", "listings", file), jpeg);
    console.log(`[build]   ${name}: ${(src.byteLength / 1e6).toFixed(1)}MB → ${(jpeg.byteLength / 1024).toFixed(0)}KB`);
    return `assets/listings/${file}`;
  } catch (err) {
    console.warn(`[build]   ${name}: couldn't optimise (${err.message}) — linking original.`);
    return url;
  }
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

const { data, source } = await loadData();
const stats = data.summary;

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(path.join(OUT, "assets"), { recursive: true });

console.log("[build] Optimising images…");
const photoMap = new Map();
for (const [i, l] of data.current.entries()) {
  if (!l.photo) continue;
  const name = (l.address || `listing-${i}`).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  photoMap.set(l.photo.url, await listingPhoto(l.photo.url, name));
}
const photoSrc = (u) => photoMap.get(u) ?? u;

const replacements = {
  TOTAL_SETTLED: stats.totalSettled,
  SOLD_COUNT: String(stats.soldCount),
  RECENT24_COUNT: String(stats.recent24Count),
  RECENT24_VALUE: stats.recent24Value,
  AVG_12M: stats.avg12m,
  FIRST_YEAR: stats.firstYear,
  CURRENT_COUNT: String(data.current.length),
  AUCTION_POINT: esc(auctionPoint(data.current)),
  AUCTION_BANNER: auctionBannerHtml(data.current),
  CURRENT_LISTINGS: currentListingsHtml(data.current, photoSrc),
  RECENT_SOLD: recentSoldHtml(data.sold, stats.soldCount),
};

let html = await fs.readFile(path.join(HERE, "src", "index.template.html"), "utf8");
for (const [key, value] of Object.entries(replacements)) {
  html = html.replaceAll(`{{${key}}}`, value);
}

const unresolved = [...html.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map((m) => m[1]);
if (unresolved.length) {
  console.error(`[build] Unresolved placeholders: ${[...new Set(unresolved)].join(", ")}`);
  process.exit(1);
}

await fs.writeFile(path.join(OUT, "index.html"), html);
// blog.html stays at the folder root: the market-news-refresh task edits it there.
await fs.copyFile(path.join(HERE, "blog.html"), path.join(OUT, "blog.html"));
await fs.copyFile(path.join(HERE, "src", "styles.css"), path.join(OUT, "styles.css"));
await fs.copyFile(path.join(HERE, "src", "script.js"), path.join(OUT, "script.js"));
for (const name of await fs.readdir(path.join(HERE, "assets"))) {
  await fs.copyFile(path.join(HERE, "assets", name), path.join(OUT, "assets", name));
}

await fs.writeFile(
  path.join(OUT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `  <url><loc>${SITE_ORIGIN}/</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>\n` +
    `  <url><loc>${SITE_ORIGIN}/blog</loc></url>\n` +
    `</urlset>\n`
);
await fs.writeFile(
  path.join(OUT, "robots.txt"),
  `User-agent: *\nAllow: /\nDisallow: /data.json\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`
);

// Expose the snapshot alongside the site: no per-sale prices in it, and it lets
// a machine without VaultRE credentials pull a fresh copy from any live build.
await fs.copyFile(snapshotPath, path.join(OUT, "data.json"));

console.log(
  `[build] Wrote ${path.relative(HERE, OUT)}/index.html — data source: ${source}, ` +
    `${data.current.length} current, ${stats.soldCount} sales, ${stats.totalSettled} settled.`
);
