// lib/instagram.mjs against a fake Instagram and an in-memory store.
// Run: npm test

import assert from "node:assert/strict";
import { test } from "node:test";
import { callback, connectAction, connectPage, feed, HANDLE, refresh, toPost } from "../lib/instagram.mjs";

const ORIGIN = "https://casey-green.vercel.app";
const NOW = new Date("2026-10-18T05:00:00Z");
const DAY = 86_400_000;

const ENV = {
  INSTAGRAM_APP_ID: "app-123",
  INSTAGRAM_APP_SECRET: "app-secret",
  INSTAGRAM_CONNECT_KEY: "let-me-in",
  BLOB_READ_WRITE_TOKEN: "blob-token",
  CRON_SECRET: "cron-secret",
};

const MEDIA = [
  { id: "1", media_type: "IMAGE", media_url: "https://scontent.cdninstagram.com/a.jpg", permalink: "https://www.instagram.com/p/AAA/", caption: "Sold!\n\nGrey   Lynn", timestamp: "2026-10-17T01:00:00+0000" },
  { id: "2", media_type: "VIDEO", media_url: "https://scontent.cdninstagram.com/v.mp4", thumbnail_url: "https://scontent.cdninstagram.com/v.jpg", permalink: "https://www.instagram.com/reel/BBB/" },
  { id: "3", media_type: "CAROUSEL_ALBUM", media_url: "https://scontent.cdninstagram.com/c.jpg", permalink: "https://www.instagram.com/p/CCC/" },
  { id: "4", media_type: "IMAGE", media_url: "https://scontent.cdninstagram.com/x.jpg", permalink: "https://evil.example/p/DDD/" },
];

function memoryStore(record = null) {
  return {
    record,
    writes: 0,
    async read() {
      return this.record;
    },
    async write(r) {
      this.record = r;
      this.writes++;
    },
    async remove() {
      this.record = null;
    },
  };
}

/** A fake Instagram. `username` is whoever "logs in"; `mediaError` breaks the feed. */
function fakeInstagram({ username = HANDLE, shortShape = "data", mediaError = null, refreshError = null } = {}) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    const u = new URL(url);
    calls.push({ url: u, init });
    const ok = (body) => new Response(JSON.stringify(body), { status: 200 });
    const bad = (code, message) => new Response(JSON.stringify({ error: { message, type: "OAuthException", code } }), { status: 400 });

    if (u.href.startsWith("https://api.instagram.com/oauth/access_token")) {
      const short = { access_token: "SHORT", user_id: "17841", permissions: "instagram_business_basic" };
      return ok(shortShape === "data" ? { data: [short] } : short);
    }
    if (u.pathname === "/access_token") return ok({ access_token: "LONG", token_type: "bearer", expires_in: 60 * 86400 });
    if (u.pathname === "/refresh_access_token") {
      return refreshError ? bad(190, refreshError) : ok({ access_token: "RENEWED", token_type: "bearer", expires_in: 60 * 86400 });
    }
    if (u.pathname === "/me") return ok({ user_id: "17841", username });
    if (u.pathname === "/me/media") return mediaError ? bad(mediaError.code, mediaError.message) : ok({ data: MEDIA });
    return new Response("not found", { status: 404 });
  };
  return { fetch, calls };
}

const deps = (over = {}) => ({ env: ENV, now: () => NOW, store: memoryStore(), ...fakeInstagram(), ...over });

const connected = (over = {}) => ({
  username: HANDLE,
  userId: "17841",
  accessToken: "LONG",
  connectedAt: new Date(NOW - 10 * DAY).toISOString(),
  refreshedAt: new Date(NOW - 10 * DAY).toISOString(),
  expiresAt: new Date(NOW.getTime() + 50 * DAY).toISOString(),
  ...over,
});

const post = (fields) =>
  new Request(`${ORIGIN}/api/instagram/connect`, { method: "POST", body: new URLSearchParams(fields) });

/* ---------------- connect page ---------------- */

test("connect page names the missing settings and the redirect URI", async () => {
  const res = await connectPage(new Request(`${ORIGIN}/api/instagram/connect`), deps({ env: { INSTAGRAM_APP_ID: "x" } }));
  const body = await res.text();
  assert.equal(res.status, 200);
  for (const name of ["INSTAGRAM_APP_SECRET", "INSTAGRAM_CONNECT_KEY", "BLOB_READ_WRITE_TOKEN"]) assert.match(body, new RegExp(name));
  assert.doesNotMatch(body, /<code>INSTAGRAM_APP_ID<\/code>/);
  assert.match(body, /https:\/\/casey-green\.vercel\.app\/api\/instagram\/callback/);
  assert.equal(res.headers.get("x-robots-tag"), "noindex");
});

test("a wrong connect key is refused and starts nothing", async () => {
  const res = await connectAction(post({ key: "nope", action: "connect" }), deps());
  assert.equal(res.status, 403);
  assert.equal(res.headers.get("location"), null);
});

test("the right key sends Casey to Instagram with a matching state cookie", async () => {
  const res = await connectAction(post({ key: "let-me-in", action: "connect" }), deps());
  assert.equal(res.status, 303);
  const to = new URL(res.headers.get("location"));
  assert.equal(to.origin + to.pathname, "https://www.instagram.com/oauth/authorize");
  assert.equal(to.searchParams.get("client_id"), "app-123");
  assert.equal(to.searchParams.get("redirect_uri"), `${ORIGIN}/api/instagram/callback`);
  assert.equal(to.searchParams.get("scope"), "instagram_business_basic");
  assert.equal(to.searchParams.get("force_reauth"), "true");
  const cookie = res.headers.get("set-cookie");
  assert.match(cookie, new RegExp(`ig_oauth_state=${to.searchParams.get("state")};`));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
});

test("disconnect needs the key and clears the stored connection", async () => {
  const d = deps({ store: memoryStore(connected()) });
  await connectAction(post({ key: "wrong", action: "disconnect" }), d);
  assert.ok(d.store.record);
  await connectAction(post({ key: "let-me-in", action: "disconnect" }), d);
  assert.equal(d.store.record, null);
});

/* ---------------- callback ---------------- */

const back = (params, state = "abc123") =>
  new Request(`${ORIGIN}/api/instagram/callback?${new URLSearchParams(params)}`, {
    headers: state ? { cookie: `other=1; ig_oauth_state=${state}` } : {},
  });

test("a callback without the matching state cookie stores nothing", async () => {
  for (const req of [back({ code: "C", state: "abc123" }, null), back({ code: "C", state: "zzz" })]) {
    const d = deps();
    const res = await callback(req, d);
    assert.equal(res.status, 400);
    assert.equal(d.store.record, null);
    assert.equal(d.calls.length, 0);
  }
});

test("a successful callback stores a 60-day token for Casey's account", async () => {
  for (const shortShape of ["data", "flat"]) {
    const d = deps(fakeInstagram({ shortShape }));
    const res = await callback(back({ code: "CODE", state: "abc123" }), d);
    const body = await res.text();
    assert.equal(res.status, 200, body);
    assert.match(res.headers.get("set-cookie"), /ig_oauth_state=;.*Max-Age=0/);
    assert.equal(d.store.record.accessToken, "LONG");
    assert.equal(d.store.record.username, HANDLE);
    assert.equal(d.store.record.expiresAt, new Date(NOW.getTime() + 60 * DAY).toISOString());
    assert.doesNotMatch(body, /LONG|SHORT/);

    const exchange = d.calls[0];
    const sent = new URLSearchParams(exchange.init.body);
    assert.equal(exchange.init.method, "POST");
    assert.equal(sent.get("code"), "CODE");
    assert.equal(sent.get("redirect_uri"), `${ORIGIN}/api/instagram/callback`);
    assert.equal(sent.get("client_secret"), "app-secret");
  }
});

test("logging in as someone else is refused and nothing is stored", async () => {
  const d = deps(fakeInstagram({ username: "someone.else" }));
  const res = await callback(back({ code: "CODE", state: "abc123" }), d);
  assert.equal(res.status, 403);
  assert.match(await res.text(), /someone\.else/);
  assert.equal(d.store.record, null);
});

test("cancelling on Instagram explains itself and stores nothing", async () => {
  const d = deps();
  const res = await callback(back({ error: "access_denied", error_description: "The user denied your request." }), d);
  assert.equal(res.status, 400);
  assert.match(await res.text(), /denied/);
  assert.equal(d.store.record, null);
});

/* ---------------- feed ---------------- */

test("not connected: an empty feed, cached briefly", async () => {
  const res = await feed(new Request(`${ORIGIN}/api/instagram/feed`), deps());
  assert.deepEqual((await res.json()).posts, []);
  assert.match(res.headers.get("cache-control"), /s-maxage=300/);
});

test("connected: posts mapped for the page, token never exposed", async () => {
  const d = deps({ store: memoryStore(connected()) });
  const res = await feed(new Request(`${ORIGIN}/api/instagram/feed`), d);
  const text = await res.text();
  const body = JSON.parse(text);
  assert.equal(res.status, 200);
  assert.equal(body.connected, true);
  assert.deepEqual(
    body.posts.map((p) => [p.id, p.image]),
    [
      ["1", "https://scontent.cdninstagram.com/a.jpg"],
      ["2", "https://scontent.cdninstagram.com/v.jpg"], // video → its thumbnail
      ["3", "https://scontent.cdninstagram.com/c.jpg"],
    ] // 4 has a non-Instagram permalink and is dropped
  );
  assert.equal(body.posts[0].caption, "Sold! Grey Lynn");
  assert.doesNotMatch(text, /LONG/);
  assert.match(res.headers.get("cache-control"), /s-maxage=900/);
  assert.equal(d.store.writes, 0); // 50 days left: no renewal
});

test("an expired or revoked token reads as not connected", async () => {
  const d = deps({ store: memoryStore(connected()), ...fakeInstagram({ mediaError: { code: 190, message: "Error validating access token" } }) });
  const res = await feed(new Request(`${ORIGIN}/api/instagram/feed`), d);
  const body = await res.json();
  assert.equal(body.connected, false);
  assert.deepEqual(body.posts, []);
});

test("the feed renews a token that is close to expiry", async () => {
  const d = deps({ store: memoryStore(connected({ expiresAt: new Date(NOW.getTime() + 5 * DAY).toISOString() })) });
  await feed(new Request(`${ORIGIN}/api/instagram/feed`), d);
  assert.equal(d.store.record.accessToken, "RENEWED");
  assert.equal(d.store.record.refreshedAt, NOW.toISOString());
});

test("toPost rejects anything that isn't an https image and an Instagram link", () => {
  assert.equal(toPost({ id: 1, media_type: "IMAGE", media_url: "http://x/a.jpg", permalink: "https://www.instagram.com/p/A/" }), null);
  assert.equal(toPost({ id: 1, media_type: "VIDEO", media_url: "https://x/v.mp4", permalink: "https://www.instagram.com/p/A/" }), null);
  assert.equal(toPost({ id: 1, media_type: "IMAGE", media_url: "https://x/a.jpg", permalink: "javascript:alert(1)" }), null);
});

/* ---------------- refresh (cron) ---------------- */

const cron = (auth) => new Request(`${ORIGIN}/api/instagram/refresh`, { headers: auth ? { authorization: auth } : {} });

test("the cron needs CRON_SECRET, and the right bearer", async () => {
  const unset = await refresh(cron("Bearer cron-secret"), deps({ env: { ...ENV, CRON_SECRET: "" } }));
  assert.equal(unset.status, 500);
  for (const auth of [null, "Bearer wrong", "cron-secret"]) {
    const d = deps({ store: memoryStore(connected()) });
    const res = await refresh(cron(auth), d);
    assert.equal(res.status, 401);
    assert.equal(d.store.writes, 0);
  }
});

test("the cron renews the token, but not one under a day old", async () => {
  const d = deps({ store: memoryStore(connected()) });
  const res = await refresh(cron("Bearer cron-secret"), d);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).refreshed, true);
  assert.equal(d.store.record.accessToken, "RENEWED");
  assert.equal(d.store.record.expiresAt, new Date(NOW.getTime() + 60 * DAY).toISOString());

  const fresh = deps({ store: memoryStore(connected({ refreshedAt: new Date(NOW - 3_600_000).toISOString() })) });
  const skipped = await refresh(cron("Bearer cron-secret"), fresh);
  assert.equal((await skipped.json()).refreshed, false);
  assert.equal(fresh.store.writes, 0);
});

test("a failed renewal is reported, and the stored token is kept", async () => {
  const d = deps({ store: memoryStore(connected()), ...fakeInstagram({ refreshError: "Session has expired" }) });
  const res = await refresh(cron("Bearer cron-secret"), d);
  assert.equal(res.status, 502);
  assert.match((await res.json()).error, /expired/);
  assert.equal(d.store.record.accessToken, "LONG");
});
