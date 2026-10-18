/**
 * Casey's live Instagram feed — connect once, then it runs itself.
 *
 * Uses Meta's "Instagram API with Instagram Login" (the Basic Display API it
 * replaced was switched off in December 2024). Casey's account must be a
 * professional (Business or Creator) account, and she must be an Instagram
 * tester on the Meta app until the app is set live. Setup: README.md.
 *
 *   /api/instagram/connect   GET  status page; POST (with the connect key)
 *                                 starts the Instagram login, or disconnects
 *   /api/instagram/callback  GET  Instagram sends Casey back here; the code
 *                                 is swapped for a 60-day token and stored
 *   /api/instagram/feed      GET  her latest posts as JSON, cached at the
 *                                 CDN for 15 minutes; the home page reads it
 *   /api/instagram/refresh   GET  weekly cron (vercel.json): renews the
 *                                 token so it never reaches its 60 days
 *
 * The token lives in a PRIVATE Vercel Blob store (BLOB_READ_WRITE_TOKEN) and
 * never leaves the server: the feed returns post links and image URLs only.
 * Only @caseygreen.raywhite can be connected — a login as anyone else is
 * refused and nothing is stored.
 *
 * Every handler takes its dependencies (env, fetch, store, clock) as an
 * argument so the tests can run it against a fake Instagram; the files in
 * api/instagram/ pass the real ones.
 *
 * Environment (Vercel project → Settings → Environment Variables):
 *   INSTAGRAM_APP_ID        Meta app → Instagram → API setup with Instagram login
 *   INSTAGRAM_APP_SECRET    same page
 *   INSTAGRAM_CONNECT_KEY   any long password; asked for on the connect page
 *   CRON_SECRET             any long random string; Vercel sends it to the cron
 *   BLOB_READ_WRITE_TOKEN   added by Vercel when the Blob store is connected
 */

import crypto from "node:crypto";

export const HANDLE = "caseygreen.raywhite";
export const PROFILE_URL = `https://www.instagram.com/${HANDLE}/`;

const CONNECTION_PATH = "instagram/connection.json";
const AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
const CODE_EXCHANGE_URL = "https://api.instagram.com/oauth/access_token";
const GRAPH = "https://graph.instagram.com";
const SCOPE = "instagram_business_basic";
const STATE_COOKIE = "ig_oauth_state";

/** How many posts the feed returns (the home page shows a 3x3 grid). */
export const FEED_SIZE = 9;
/** CDN cache for the feed, and for the "not connected" answer. */
const FEED_CACHE = "public, max-age=0, s-maxage=900, stale-while-revalidate=86400";
const EMPTY_CACHE = "public, max-age=0, s-maxage=300";
/** The feed renews the token itself when it is this close to expiry. */
const RENEW_WITHIN_DAYS = 14;
/** Instagram refuses to refresh a token less than 24 hours old. */
const MIN_REFRESH_AGE_MS = 24 * 3_600_000;
const DAY_MS = 86_400_000;

/* ------------------------------------------------------------------ */
/* dependencies                                                        */
/* ------------------------------------------------------------------ */

/** The private Blob store holding the one connection record. */
function blobStore() {
  return {
    async read() {
      const { get } = await import("@vercel/blob");
      const result = await get(CONNECTION_PATH, { access: "private", useCache: false });
      if (!result || result.statusCode !== 200 || !result.stream) return null;
      return JSON.parse(await new Response(result.stream).text());
    },
    async write(record) {
      const { put } = await import("@vercel/blob");
      await put(CONNECTION_PATH, JSON.stringify(record), {
        access: "private",
        allowOverwrite: true,
        addRandomSuffix: false,
        contentType: "application/json",
        cacheControlMaxAge: 60,
      });
    },
    async remove() {
      const { del } = await import("@vercel/blob");
      await del(CONNECTION_PATH);
    },
  };
}

export function defaultDeps() {
  return { env: process.env, fetch: (...a) => globalThis.fetch(...a), store: blobStore(), now: () => new Date() };
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const json = (body, status = 200, cache = "no-store") =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache, "x-robots-tag": "noindex" },
  });

const html = (body, status = 200, extraHeaders = {}) =>
  new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
      "referrer-policy": "no-referrer",
      ...extraHeaders,
    },
  });

/** Constant-time comparison of a submitted secret with the configured one. */
function secretMatches(given, expected) {
  if (!expected) return false;
  const a = crypto.createHash("sha256").update(String(given ?? "")).digest();
  const b = crypto.createHash("sha256").update(String(expected)).digest();
  return crypto.timingSafeEqual(a, b);
}

function cookie(request, name) {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

const redirectUri = (request) => `${new URL(request.url).origin}/api/instagram/callback`;

const NEEDS = {
  connect: ["INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET", "INSTAGRAM_CONNECT_KEY", "BLOB_READ_WRITE_TOKEN"],
  refresh: ["CRON_SECRET", "BLOB_READ_WRITE_TOKEN"],
};
const missing = (env, names) => names.filter((n) => !env[n]);

/**
 * One Instagram API call. Throws an Error carrying Instagram's own message
 * and code (190 = token expired or revoked); the token is never part of it.
 */
async function instagram(deps, url, init = {}) {
  const res = await deps.fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* not JSON */
  }
  if (!res.ok || body?.error || body?.error_type) {
    const err = new Error(body?.error?.message ?? body?.error_message ?? `Instagram answered HTTP ${res.status}`);
    err.code = body?.error?.code ?? body?.code ?? res.status;
    throw err;
  }
  return body;
}

const graph = (path, params) => `${GRAPH}${path}?${new URLSearchParams(params)}`;

async function readConnection(deps) {
  try {
    return await deps.store.read();
  } catch (err) {
    console.error(`[instagram] couldn't read the connection: ${err.message}`);
    return null;
  }
}

/** Swap the stored token for a fresh 60-day one and save it. */
async function renew(deps, record) {
  const body = await instagram(
    deps,
    graph("/refresh_access_token", { grant_type: "ig_refresh_token", access_token: record.accessToken })
  );
  const now = deps.now();
  const next = {
    ...record,
    accessToken: body.access_token,
    expiresAt: new Date(now.getTime() + Number(body.expires_in ?? 0) * 1000).toISOString(),
    refreshedAt: now.toISOString(),
  };
  await deps.store.write(next);
  return next;
}

const tokenAgeMs = (record, now) => now.getTime() - Date.parse(record.refreshedAt ?? record.connectedAt ?? 0);

/** A feed item, or null when it has nothing safe to show. */
export function toPost(m) {
  const image = m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url;
  if (typeof image !== "string" || !image.startsWith("https://")) return null;
  if (typeof m.permalink !== "string" || !m.permalink.startsWith("https://www.instagram.com/")) return null;
  return {
    id: String(m.id),
    url: m.permalink,
    image,
    type: m.media_type ?? "IMAGE",
    caption: String(m.caption ?? "").replace(/\s+/g, " ").trim().slice(0, 300),
    timestamp: m.timestamp ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* pages                                                               */
/* ------------------------------------------------------------------ */

const NZ = new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "long", year: "numeric", timeZone: "Pacific/Auckland" });
const nzDate = (iso) => (iso ? NZ.format(new Date(iso)) : "—");

function page(title, inner) {
  return `<!DOCTYPE html>
<html lang="en-NZ">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${esc(title)}</title>
  <style>
    body { margin: 0; background: #f5f2ed; color: #17181b; font: 16px/1.6 "Lato", -apple-system, "Segoe UI", Arial, sans-serif; }
    main { max-width: 620px; margin: 0 auto; padding: 48px 20px; }
    h1 { margin: 0 0 8px; font: 500 30px/1.2 Georgia, serif; }
    .card { margin: 24px 0; padding: 22px; background: #fff; border: 1px solid #e4e0d8; }
    .ok { border-left: 4px solid #2e7d32; }
    .warn { border-left: 4px solid #f2d600; }
    .bad { border-left: 4px solid #c62828; }
    label { display: block; margin-bottom: 6px; font-weight: 700; }
    input { width: 100%; box-sizing: border-box; padding: 12px; border: 1px solid #cdc8bd; font: inherit; }
    button { margin: 14px 10px 0 0; padding: 12px 20px; border: 1px solid #17181b; background: #ffe512; font: 700 14px/1 inherit; letter-spacing: .06em; text-transform: uppercase; cursor: pointer; }
    button.ghost { background: #fff; }
    code { padding: 2px 5px; background: #ebe6dd; font-size: 13px; overflow-wrap: anywhere; }
    small, .muted { color: #626469; }
    a { color: inherit; }
  </style>
</head>
<body><main>${inner}</main></body>
</html>`;
}

async function statusCard(deps) {
  const record = await readConnection(deps);
  if (!record) {
    return `<div class="card warn"><strong>Not connected.</strong> The site shows a “Follow on Instagram” card until Casey connects.</div>`;
  }
  const now = deps.now();
  if (Date.parse(record.expiresAt) <= now.getTime()) {
    return `<div class="card bad"><strong>Connection expired</strong> on ${esc(nzDate(record.expiresAt))}. Connect again with Casey.</div>`;
  }
  // A live check, so a revoked token (password change, app removed) shows here.
  try {
    await instagram(deps, graph("/me", { fields: "username", access_token: record.accessToken }));
  } catch (err) {
    return `<div class="card bad"><strong>@${esc(record.username)} is connected but Instagram refuses the token:</strong> ${esc(err.message)}<br />Connect again with Casey.</div>`;
  }
  return `<div class="card ok"><strong>Connected as @${esc(record.username)}</strong> since ${esc(nzDate(record.connectedAt))}.<br />
    <span class="muted">The token renews itself every week (current one runs to ${esc(nzDate(record.expiresAt))}).</span></div>`;
}

/** GET /api/instagram/connect */
export async function connectPage(request, deps, notice = "") {
  const gaps = missing(deps.env, NEEDS.connect);
  const setup = gaps.length
    ? `<div class="card bad"><strong>Setup isn’t finished.</strong> Add these in Vercel → Settings → Environment Variables, then redeploy:<br />${gaps.map((g) => `<code>${esc(g)}</code>`).join(" ")}</div>`
    : "";
  return html(
    page(
      "Connect Instagram — Casey Green",
      `<h1>Casey’s Instagram feed</h1>
  <p class="muted">Connect @${esc(HANDLE)} so her latest posts appear on the website.</p>
  ${notice}
  ${setup}
  ${await statusCard(deps)}
  <form class="card" method="post" action="/api/instagram/connect">
    <label for="key">Connect key</label>
    <input id="key" name="key" type="password" autocomplete="current-password" required />
    <button type="submit" name="action" value="connect">Connect Instagram</button>
    <button class="ghost" type="submit" name="action" value="disconnect">Disconnect</button>
    <p><small>Casey logs in on the Instagram screen that follows and taps <em>Allow</em>. Only @${esc(HANDLE)} is accepted.</small></p>
  </form>
  <p><small>Redirect URI to register in the Meta app: <code>${esc(redirectUri(request))}</code></small></p>`
    )
  );
}

/** POST /api/instagram/connect — action=connect | disconnect */
export async function connectAction(request, deps) {
  const form = await request.formData().catch(() => null);
  const action = form?.get("action");
  if (!secretMatches(form?.get("key"), deps.env.INSTAGRAM_CONNECT_KEY)) {
    await new Promise((r) => setTimeout(r, 600)); // slows guessing
    return connectPage(request, deps, `<div class="card bad"><strong>That connect key isn’t right.</strong></div>`).then(
      (res) => new Response(res.body, { status: 403, headers: res.headers })
    );
  }

  if (action === "disconnect") {
    try {
      await deps.store.remove();
    } catch (err) {
      console.error(`[instagram] disconnect failed: ${err.message}`);
    }
    return connectPage(request, deps, `<div class="card ok"><strong>Disconnected.</strong> The site is back to the follow card.</div>`);
  }

  const gaps = missing(deps.env, NEEDS.connect);
  if (gaps.length) return connectPage(request, deps);

  const state = crypto.randomBytes(24).toString("hex");
  const authorize = `${AUTHORIZE_URL}?${new URLSearchParams({
    force_reauth: "true", // always ask who is logging in, never reuse a session
    client_id: deps.env.INSTAGRAM_APP_ID,
    redirect_uri: redirectUri(request),
    response_type: "code",
    scope: SCOPE,
    state,
  })}`;
  return new Response(null, {
    status: 303,
    headers: {
      location: authorize,
      "cache-control": "no-store",
      "set-cookie": `${STATE_COOKIE}=${state}; Path=/api/instagram; Max-Age=900; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}

/** GET /api/instagram/callback — Instagram sends Casey back here. */
export async function callback(request, deps) {
  const url = new URL(request.url);
  const clearState = { "set-cookie": `${STATE_COOKIE}=; Path=/api/instagram; Max-Age=0; HttpOnly; Secure; SameSite=Lax` };
  const fail = (msg, status = 400) =>
    html(
      page(
        "Instagram not connected",
        `<h1>Not connected</h1><div class="card bad">${msg}</div><p><a href="/api/instagram/connect">Back to the connect page</a></p>`
      ),
      status,
      clearState
    );

  if (url.searchParams.get("error")) {
    return fail(`Instagram said: ${esc(url.searchParams.get("error_description") || url.searchParams.get("error"))}`);
  }
  const state = url.searchParams.get("state");
  const expected = cookie(request, STATE_COOKIE);
  if (!state || !expected || !secretMatches(state, expected)) {
    return fail("This sign-in link has expired or was started in another browser. Start again from the connect page.");
  }
  const code = url.searchParams.get("code");
  if (!code) return fail("Instagram didn’t send a sign-in code. Start again from the connect page.");
  const gaps = missing(deps.env, NEEDS.connect);
  if (gaps.length) return fail(`Setup isn’t finished: ${gaps.map(esc).join(", ")}.`, 500);

  try {
    // 1. code → short-lived token (one hour)
    const short = await instagram(deps, CODE_EXCHANGE_URL, {
      method: "POST",
      body: new URLSearchParams({
        client_id: deps.env.INSTAGRAM_APP_ID,
        client_secret: deps.env.INSTAGRAM_APP_SECRET,
        grant_type: "authorization_code",
        redirect_uri: redirectUri(request),
        code,
      }),
    });
    const shortToken = short.data?.[0]?.access_token ?? short.access_token;
    if (!shortToken) throw new Error("Instagram didn’t return a token.");

    // 2. short-lived → long-lived (60 days)
    const long = await instagram(
      deps,
      graph("/access_token", { grant_type: "ig_exchange_token", client_secret: deps.env.INSTAGRAM_APP_SECRET, access_token: shortToken })
    );

    // 3. whose account is it?
    const me = await instagram(deps, graph("/me", { fields: "user_id,username", access_token: long.access_token }));
    if (String(me.username ?? "").toLowerCase() !== HANDLE) {
      return fail(
        `That was <strong>@${esc(me.username)}</strong>, but this site is for <strong>@${esc(HANDLE)}</strong>. ` +
          `Log out of Instagram in this browser and connect again with Casey’s account.`,
        403
      );
    }

    const now = deps.now();
    await deps.store.write({
      username: me.username,
      userId: String(me.user_id ?? short.data?.[0]?.user_id ?? short.user_id ?? ""),
      accessToken: long.access_token,
      expiresAt: new Date(now.getTime() + Number(long.expires_in ?? 0) * 1000).toISOString(),
      connectedAt: now.toISOString(),
      refreshedAt: now.toISOString(),
    });
  } catch (err) {
    console.error(`[instagram] connect failed: ${err.message}`);
    return fail(`Instagram refused the connection: ${esc(err.message)}`, 502);
  }

  return html(
    page(
      "Instagram connected",
      `<h1>Connected</h1>
  <div class="card ok"><strong>@${esc(HANDLE)} is connected.</strong> Her latest posts will show on the home page within about five minutes, and the connection renews itself from here on.</div>
  <p><a href="/">View the website</a> · <a href="/api/instagram/connect">Connect page</a></p>`
    ),
    200,
    clearState
  );
}

/** GET /api/instagram/feed — what the home page reads. Never exposes the token. */
export async function feed(request, deps) {
  let record = await readConnection(deps);
  if (!record) return json({ connected: false, profile: PROFILE_URL, posts: [] }, 200, EMPTY_CACHE);

  const now = deps.now();
  if (Date.parse(record.expiresAt) - now.getTime() < RENEW_WITHIN_DAYS * DAY_MS && tokenAgeMs(record, now) > MIN_REFRESH_AGE_MS) {
    // Backstop for a cron that hasn't run: renew while the token still works.
    try {
      record = await renew(deps, record);
    } catch (err) {
      console.error(`[instagram] renewal from the feed failed: ${err.message}`);
    }
  }

  try {
    const body = await instagram(
      deps,
      graph("/me/media", {
        fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp",
        limit: String(FEED_SIZE + 3),
        access_token: record.accessToken,
      })
    );
    const posts = (body.data ?? []).map(toPost).filter(Boolean).slice(0, FEED_SIZE);
    return json({ connected: true, username: record.username, profile: PROFILE_URL, posts }, 200, FEED_CACHE);
  } catch (err) {
    console.error(`[instagram] feed failed (${err.code}): ${err.message}`);
    const expired = err.code === 190;
    return json({ connected: !expired, profile: PROFILE_URL, posts: [] }, expired ? 200 : 502, EMPTY_CACHE);
  }
}

/** GET /api/instagram/refresh — the weekly cron in vercel.json. */
export async function refresh(request, deps) {
  const gaps = missing(deps.env, NEEDS.refresh);
  if (gaps.length) return json({ refreshed: false, error: `Missing ${gaps.join(", ")}` }, 500);
  if (!secretMatches(request.headers.get("authorization"), `Bearer ${deps.env.CRON_SECRET}`)) {
    return json({ refreshed: false, error: "Unauthorized" }, 401);
  }

  const record = await readConnection(deps);
  if (!record) return json({ refreshed: false, reason: "not connected" });
  const now = deps.now();
  if (tokenAgeMs(record, now) < MIN_REFRESH_AGE_MS) return json({ refreshed: false, reason: "token is less than a day old" });

  try {
    const next = await renew(deps, record);
    return json({ refreshed: true, expiresAt: next.expiresAt });
  } catch (err) {
    console.error(`[instagram] refresh failed (${err.code}): ${err.message}`);
    return json({ refreshed: false, error: err.message }, 502);
  }
}
