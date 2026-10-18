/**
 * Build the Casey Green site.
 *
 *   node build.mjs             → dist/  (fetches VaultRE when credentials are set)
 *   node build.mjs --offline   → dist/  (skips VaultRE, uses data/listings.json)
 *
 * Laid out after edwardpackbayleys.co.nz (about, listings, recent sales,
 * testimonials, contact), plus one page per suburb Casey sells in, for
 * search. Same data pipeline as the levani-lumon and tom-mccartney builds,
 * kept as a separate copy so a change for one agent can never affect
 * another's site:
 *
 * - Listings and sales are baked in at BUILD time, never fetched in the
 *   browser: the VaultRE key stays server-side and the property content is
 *   in the HTML for Google. See tom-mccartney/README.md.
 * - If VaultRE can't be reached the build does NOT fail: it falls back to
 *   data/listings.json, the last good snapshot.
 * - Sales Casey made at Ray White Grey Lynn, before she joined Auckland
 *   Central, aren't in A T Realty's VaultRE. They live in
 *   data/historic-sales.json and are listed after the VaultRE sales, the
 *   same way the A T Realty website does it (atrealty-next, our-team/[slug]).
 */

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { agentListings, vaultreConfigured } from "./vaultre.mjs";
import { renderSite, suburbKey } from "./src/render.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OFFLINE = process.argv.includes("--offline");
const OUT = path.join(HERE, "dist");

const readJson = async (rel) => JSON.parse(await fs.readFile(path.join(HERE, rel), "utf8"));

/**
 * Canonical origin. The domain isn't settled yet, so it comes from the
 * environment: SITE_ORIGIN if set, else the production domain Vercel exposes
 * to every build (VERCEL_PROJECT_PRODUCTION_URL — the custom domain once one
 * is added to the project, the vercel.app name until then).
 */
const SITE_ORIGIN = (
  process.env.SITE_ORIGIN ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
  "https://casey-green.vercel.app"
).replace(/\/+$/, "");

/** Casey's sales-appraisal form in the A T Realty marketing-forms system. */
const FORM = { slug: "casey-green-sales-appraisal", origin: "https://atrealtygroup.co.nz" };

const OFFICE = {
  brand: "Ray White Auckland Central",
  legalName: "A T Realty Limited",
  street: "Level 3, 246 Queen Street",
  locality: "Auckland Central",
  postalCode: "1010",
  address: "Level 3, 246 Queen Street, Auckland City",
  phone: "0800 002 420",
  phoneHref: "+64800002420",
  mapsUrl: "https://maps.google.com/?q=246+Queen+Street,+Auckland+Central,+1010",
};

/**
 * Photography. The portrait is the 1608x2000 original behind Casey's A T
 * Realty profile photo. The hero and band photos are from her own sold
 * campaigns (Ray White's CDN), and say so in their captions.
 */
const PORTRAIT_SRC = "assets/casey-portrait.jpg";
const HERO = {
  url: "https://cdn6.ep.dynamics.net/s3/rw-propertyimages/07e7-H3361956-161744873__1756775400-53597-1341735016-325-17photoprint.jpg",
  caption: "Sold — 45 Pompallier Terrace, Ponsonby",
};
const BAND = {
  url: "https://cdn6.ep.dynamics.net/s3/rw-propertyimages/96f7-H3290340-140820410__1742774987-42124-DSC07382.jpg",
  caption: "Sold — 31 Tutanekai Street, Grey Lynn",
  alt: "A renovated Grey Lynn villa with a pool, sold by Casey Green",
};

/* ------------------------------------------------------------------ */
/* data                                                                */
/* ------------------------------------------------------------------ */

const snapshotPath = path.join(HERE, "data", "listings.json");

async function loadData() {
  if (!OFFLINE && vaultreConfigured()) {
    console.log(`[build] Fetching ${profile.email} from VaultRE…`);
    const live = await agentListings(profile.email);
    // Unlike the sister sites, an empty sold list is normal here: Casey's
    // earlier sales are at another franchise. Finding her staff record is
    // what makes the answer trustworthy.
    if (live && live.offices.length) {
      // Sale prices are never shown, and this snapshot is committed to a
      // public repo and published as /data.json — so they're dropped here,
      // before anything can keep them (a vendor may have asked for privacy).
      live.sold = live.sold.map(({ salePrice, ...rest }) => rest);
      console.log(
        `[build] VaultRE ok — ${live.current.length} current, ${live.sold.length} settled ` +
          `(offices: ${live.offices.map((o) => o.office).join(", ")})`
      );
      await fs.writeFile(snapshotPath, JSON.stringify(live, null, 2) + "\n");
      return { data: live, source: "vaultre" };
    }
    console.warn("[build] VaultRE returned nothing usable — falling back to snapshot.");
  } else if (!OFFLINE) {
    console.warn("[build] VaultRE credentials not set — using snapshot. Listings may be stale.");
  }

  const data = await readJson("data/listings.json");
  console.log(`[build] Snapshot — ${data.current.length} current, ${data.sold.length} settled.`);
  return { data, source: "snapshot" };
}

/* ------------------------------------------------------------------ */
/* images                                                              */
/* ------------------------------------------------------------------ */

const IMAGE_CACHE = path.join(HERE, ".image-cache");
const IMAGE_OUT = path.join(OUT, "assets", "img");

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

const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Resize (and optionally crop) one image into dist/assets/img and return
 * { src, width, height } — plus srcset when more than one width is asked
 * for. A source that can't be fetched falls back to its original URL, so a
 * flaky CDN costs page weight, never the build.
 *
 *   widths   output widths, largest first; the largest is `src`
 *   ratio    width/height to crop to (attention-cropped), else keep aspect
 *   extract  { left, top, width, height } as fractions of the source, applied first
 */
async function image(url, { name, widths, ratio, extract, quality = 74 }) {
  let src;
  try {
    src = await fetchBuffer(url);
  } catch (err) {
    console.warn(`[build]   ${name}: couldn't fetch (${err.message}) — linking original.`);
    return { src: url, width: widths[0], height: Math.round(widths[0] / (ratio ?? 1.5)) };
  }

  const meta = await sharp(src).rotate().metadata();
  const out = [];
  for (const w of widths) {
    let pipe = sharp(src).rotate();
    if (extract) {
      pipe = pipe.extract({
        left: Math.round(extract.left * meta.width),
        top: Math.round(extract.top * meta.height),
        width: Math.round(extract.width * meta.width),
        height: Math.round(extract.height * meta.height),
      });
    }
    pipe = pipe.resize({
      width: w,
      height: ratio ? Math.round(w / ratio) : undefined,
      fit: ratio ? "cover" : "inside",
      position: ratio ? sharp.strategy.attention : undefined,
      withoutEnlargement: !ratio,
    });
    const buf = await pipe.flatten({ background: "#ffffff" }).jpeg({ quality, mozjpeg: true }).toBuffer();
    const info = await sharp(buf).metadata();
    const hash = crypto.createHash("sha1").update(buf).digest("hex").slice(0, 10);
    const file = `${name}-${info.width}-${hash}.jpg`;
    await fs.writeFile(path.join(IMAGE_OUT, file), buf);
    out.push({ src: `/assets/img/${file}`, width: info.width, height: info.height, bytes: buf.byteLength });
  }

  const [main] = out;
  console.log(
    `[build]   ${name}: ${(src.byteLength / 1e6).toFixed(1)}MB → ` +
      out.map((o) => `${o.width}w ${(o.bytes / 1024).toFixed(0)}KB`).join(", ")
  );
  return {
    src: main.src,
    width: main.width,
    height: main.height,
    srcset: out.length > 1 ? out.map((o) => `${o.src} ${o.width}w`).join(", ") : undefined,
  };
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

const profile = await readJson("data/profile.json");
const historic = await readJson("data/historic-sales.json");
const testimonialData = await readJson("data/testimonials.json");
const { areas } = await readJson("data/areas.json");
const instagram = await readJson("data/instagram.json");

const { data, source } = await loadData();

/**
 * VaultRE's settled sales first (newest first, with real dates), then the
 * Ray White Grey Lynn ones, which carry no date or price. Negative ids can't
 * collide with a VaultRE property id.
 */
const historicSold = historic.items.map((h, i) => ({
  id: -(i + 1),
  address: h.address,
  suburb: h.suburb,
  salePrice: null,
  settlementDate: null,
  bed: h.bed,
  bath: h.bath,
  car: h.car,
  photo: h.photo ? { url: h.photo } : null,
  url: h.url,
}));
const current = data.current;
const sold = [...data.sold, ...historicSold];

if (!current.length && !sold.length) {
  console.error("[build] No listings and no sales — refusing to build an empty site.");
  process.exit(1);
}

const soldBySuburb = {};
for (const s of sold) if (s.suburb) soldBySuburb[s.suburb] = (soldBySuburb[s.suburb] ?? 0) + 1;
const byArea = {};
for (const a of areas) {
  const key = suburbKey(a.name);
  const here = (l) => suburbKey(l.suburb) === key;
  byArea[a.slug] = { listed: current.filter(here).length, sold: sold.filter(here).length };
}

const stats = {
  soldCount: (data.soldTotal || data.sold.length) + historicSold.length,
  soldBySuburb,
  byArea,
};

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(IMAGE_OUT, { recursive: true });
await fs.mkdir(path.join(OUT, "areas"), { recursive: true });

console.log("[build] Optimising images…");

const images = {
  hero: { ...(await image(HERO.url, { name: "hero", widths: [2200, 1400, 820], quality: 70 })), caption: HERO.caption },
  band: { ...(await image(BAND.url, { name: "band", widths: [2000, 1200, 760], quality: 70 })), caption: BAND.caption, alt: BAND.alt },
  portrait: await image(PORTRAIT_SRC, { name: "casey-green", widths: [960, 600], ratio: 4 / 5, quality: 80 }),
  // Square crop around Casey's face for the Instagram panel.
  avatar: await image(PORTRAIT_SRC, {
    name: "casey-green-avatar",
    widths: [240],
    extract: { left: 0.2, top: 0.1, width: 0.62, height: 0.5 },
    ratio: 1,
    quality: 82,
  }),
  // 1200x630 for link previews (Facebook, LinkedIn, iMessage).
  og: await image(PORTRAIT_SRC, {
    name: "casey-green-og",
    widths: [1200],
    extract: { left: 0, top: 0.06, width: 1, height: 0.62 },
    ratio: 1200 / 630,
    quality: 80,
  }),
  community: await image("assets/bayfield-garden-to-table.png", { name: "bayfield-garden-to-table", widths: [440], quality: 86 }),
};

const cards = new Map();
for (const l of [...current, ...sold]) {
  if (!l.photo?.url || cards.has(l.photo.url)) continue;
  cards.set(
    l.photo.url,
    await image(l.photo.url, { name: slug(`${l.address} ${l.suburb}`), widths: [900, 560], ratio: 4 / 3, quality: 72 })
  );
}

const builtAt = new Date();
const pages = renderSite({
  agent: profile,
  office: OFFICE,
  form: FORM,
  origin: SITE_ORIGIN,
  images,
  stats,
  current,
  sold,
  areas,
  instagram,
  testimonials: testimonialData.items,
  testimonialSource: "Testimonials from Casey’s client reviews on homes.co.nz.",
  historicNote: historicSold.length ? historic.note : null,
  builtLabel: new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "long", year: "numeric", timeZone: "Pacific/Auckland" }).format(builtAt),
  cardImage: (l) => (l.photo?.url ? cards.get(l.photo.url) : null),
});

for (const p of pages) {
  const html = p.html;
  const leftover = html.match(/\$\{|\{\{[A-Z_]+\}\}|undefined|\[object Object\]|NaN/);
  if (leftover) {
    console.error(`[build] ${p.file}: rendered "${leftover[0]}" — a value is missing.`);
    process.exit(1);
  }
  await fs.writeFile(path.join(OUT, p.file), html);
}

await fs.copyFile(path.join(HERE, "src", "styles.css"), path.join(OUT, "styles.css"));
await fs.copyFile(path.join(HERE, "src", "script.js"), path.join(OUT, "script.js"));
for (const name of ["raywhite-logo.png", "raywhite-mark.png", "favicon.png", "favicon.svg"]) {
  await fs.copyFile(path.join(HERE, "assets", name), path.join(OUT, "assets", name));
}

/* robots.txt + sitemap.xml. cleanUrls is on, so pages are listed without
   .html. Listing and sales pages change with every build; the rest only
   when their copy does, so they carry no lastmod. */
const today = builtAt.toISOString().slice(0, 10);
const dataPages = new Set(["/", "/listings", "/recent-sales"]);
const sitemap =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  pages
    .filter((p) => p.path)
    .map((p) => `  <url><loc>${SITE_ORIGIN}${p.path}</loc>${dataPages.has(p.path) ? `<lastmod>${today}</lastmod>` : ""}</url>`)
    .join("\n") +
  `\n</urlset>\n`;
await fs.writeFile(path.join(OUT, "sitemap.xml"), sitemap);
await fs.writeFile(path.join(OUT, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /data.json\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`);

// The snapshot ships beside the site (same public data the pages show), so a
// machine without VaultRE credentials can pull a fresh one from any build.
await fs.copyFile(snapshotPath, path.join(OUT, "data.json"));

console.log(
  `[build] Wrote ${pages.length} pages to ${path.relative(HERE, OUT)}/ — origin ${SITE_ORIGIN}, ` +
    `data source: ${source}, ${current.length} current, ${stats.soldCount} sales (${historicSold.length} from Ray White Grey Lynn).`
);
