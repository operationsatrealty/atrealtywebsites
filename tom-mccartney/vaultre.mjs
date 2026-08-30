/**
 * VaultRE (A T Realty's CRM) — one agent's current listings and settled sales.
 *
 * A trimmed port of atrealty-next/src/lib/vaultre.ts. Same base URL, same
 * endpoints, same auth and the same field mapping, so this static site and
 * the Next.js site can never disagree about an agent's numbers.
 *
 * Auth needs two headers:
 *   X-Api-Key      — one value, shared across the whole A T Realty group
 *   Authorization  — Bearer, DIFFERENT per office (each office is its own
 *                    VaultRE account)
 *
 * Credentials come from the environment and are only ever read at BUILD
 * time, on the server. Nothing here is shipped to the browser — see
 * build.mjs. Never move these calls client-side: the key would be readable
 * by anyone viewing source.
 *
 *   VAULTRE_API_KEY
 *   VAULTRE_BEARER_TOKEN_MANUKAU
 *   VAULTRE_BEARER_TOKEN_AUCKLAND_CENTRAL
 *   VAULTRE_BEARER_TOKEN_MANUREWA
 *   VAULTRE_BEARER_TOKEN_MANGERE_BRIDGE
 *
 * An agent can hold a separate staff record — with separate listings — in
 * more than one office's account, so every configured office is checked and
 * the results merged. Tom is a live example of this: he has records in both
 * Manukau and Manurewa, and checking only one would hide part of his history.
 */

const API_BASE = "https://ap-southeast-2.api.vaultre.com.au/api/v1.3";

const BEARER_TOKEN_ENV = {
  manukau: "VAULTRE_BEARER_TOKEN_MANUKAU",
  "auckland-central": "VAULTRE_BEARER_TOKEN_AUCKLAND_CENTRAL",
  manurewa: "VAULTRE_BEARER_TOKEN_MANUREWA",
  "mangere-bridge": "VAULTRE_BEARER_TOKEN_MANGERE_BRIDGE",
};

const OFFICE_SITE_HOST = {
  manukau: "rwmanukau.co.nz",
  "auckland-central": "rwaucklandcentral.co.nz",
  manurewa: "rwmanurewa.co.nz",
  "mangere-bridge": "rwmangerebridge.co.nz",
};

/** Suburb names VaultRE stores without macrons. */
const MACRONS = {
  Otara: "Ōtara",
  Otahuhu: "Ōtāhuhu",
  Manukau: "Manukau",
  Mangere: "Māngere",
  "Mangere East": "Māngere East",
  "Mangere Bridge": "Māngere Bridge",
};

export const macrons = (s) => MACRONS[s] ?? s;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function credentials() {
  const apiKey = process.env.VAULTRE_API_KEY;
  const bearer = {};
  for (const [office, envVar] of Object.entries(BEARER_TOKEN_ENV)) {
    if (process.env[envVar]) bearer[office] = process.env[envVar];
  }
  return { apiKey, bearer, offices: Object.keys(bearer) };
}

export function vaultreConfigured() {
  const { apiKey, offices } = credentials();
  return Boolean(apiKey) && offices.length > 0;
}

/**
 * One request, with backoff. Returns null rather than throwing on a
 * persistent failure: VaultRE being briefly unreachable must never be able
 * to fail the deploy — build.mjs falls back to the committed snapshot.
 */
async function api(creds, office, path, params = {}) {
  const url = new URL(API_BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }

  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "X-Api-Key": creds.apiKey,
          Authorization: `Bearer ${creds.bearer[office]}`,
          Accept: "application/json",
        },
      });
      if (res.ok) return res.json();
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("retry-after")) * 1000;
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 400 * 2 ** (attempt - 1);
        await sleep(Math.min(wait + Math.random() * 400, 15000));
        continue;
      }
      console.warn(`[vaultre] ${office} ${path} → HTTP ${res.status}`);
      return null;
    } catch {
      await sleep(Math.min(400 * 2 ** (attempt - 1) + Math.random() * 400, 15000));
    }
  }
  console.warn(`[vaultre] ${office} ${path} → gave up after 6 attempts`);
  return null;
}

async function allPages(creds, office, path, params = {}, limit = Infinity) {
  const items = [];
  let page = 1;
  let total = 0;

  while (items.length < limit) {
    const body = await api(creds, office, path, { ...params, page, pagesize: 100 });
    if (!body) break;
    const batch = body.items ?? body.results ?? (Array.isArray(body) ? body : []);
    total = body.totalItems ?? body.total ?? total;
    if (!batch.length) break;
    items.push(...batch);
    if (batch.length < 100) break;
    page++;
  }

  return {
    items: Number.isFinite(limit) ? items.slice(0, limit) : items,
    total: total || items.length,
  };
}

function address(p) {
  const a = p.address ?? {};
  return [a.unitNumber ? `${a.unitNumber}/` : "", a.streetNumber, a.street]
    .filter(Boolean)
    .join(" ")
    .replace(/\/\s+/, "/")
    .trim();
}

function primaryPhoto(p) {
  const photo = (p.photos ?? []).find((x) => x.url);
  return photo ? { url: photo.url, width: photo.width ?? 0, height: photo.height ?? 0 } : null;
}

function listingUrl(p, office) {
  const webId = p.webId ?? p.saleDetails?.webId;
  return webId ? `https://${OFFICE_SITE_HOST[office]}/${webId}` : null;
}

async function staffId(creds, office, email) {
  const { items } = await allPages(creds, office, "/account/users");
  const hit = items.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
  return hit ? hit.id : null;
}

/**
 * Everything the page needs for one agent, merged across every office they
 * hold a staff record in. Returns null when nothing is configured, so the
 * caller can fall back to the snapshot.
 */
export async function agentListings(email, { currentLimit = 60, soldLimit = 500 } = {}) {
  const creds = credentials();
  if (!creds.apiKey || creds.offices.length === 0) {
    console.warn("[vaultre] Not configured — need VAULTRE_API_KEY plus at least one office bearer token.");
    return null;
  }

  const result = { email, current: [], sold: [], soldTotal: 0, offices: [] };

  for (const office of creds.offices) {
    const id = await staffId(creds, office, email);
    if (!id) continue;
    result.offices.push({ office, vaultreId: id });

    const [cur, sold] = await Promise.all([
      allPages(
        creds,
        office,
        "/properties/residential/sale/available",
        { contactStaff: id, published: true, sort: "modified", sortOrder: "desc" },
        currentLimit
      ),
      allPages(
        creds,
        office,
        "/properties/residential/sale/sold",
        { contactStaff: id, status: "settled", sort: "settlement", sortOrder: "desc" },
        soldLimit
      ),
    ]);

    result.current.push(
      ...cur.items.map((p) => ({
        id: p.id,
        address: address(p),
        suburb: macrons(p.address?.suburb?.name ?? ""),
        displayPrice: p.displayPrice ?? "",
        bed: p.bed ?? null,
        bath: p.bath ?? null,
        car: p.garages ?? null,
        status: p.status ?? "listing",
        method: p.saleDetails?.methodOfSale ?? p.methodOfSale ?? null,
        photo: primaryPhoto(p),
        url: listingUrl(p, office),
        modified: p.modified ?? null,
        office,
      }))
    );

    result.sold.push(
      ...sold.items.map((p) => ({
        id: p.id,
        address: address(p),
        suburb: macrons(p.address?.suburb?.name ?? ""),
        salePrice: p.saleDetails?.salePrice ?? null,
        settlementDate: p.saleDetails?.settlement ?? null,
        bed: p.bed ?? null,
        bath: p.bath ?? null,
        car: p.garages ?? null,
        photo: primaryPhoto(p),
        url: listingUrl(p, office),
        office,
      }))
    );

    result.soldTotal += sold.total;
  }

  if (result.offices.length === 0) {
    console.warn(`[vaultre] No staff record found for ${email} in any configured office.`);
    return null;
  }

  result.current.sort((a, b) => (b.modified ?? "").localeCompare(a.modified ?? ""));
  result.sold.sort((a, b) => (b.settlementDate ?? "").localeCompare(a.settlementDate ?? ""));

  return result;
}
