/**
 * Page templates for the Casey Green site.
 *
 * The sister sites keep one HTML template per page with {{PLACEHOLDERS}}.
 * This site has fourteen pages sharing one header, footer and head, so the
 * pages are plain functions over the data instead: the shared parts exist
 * once, and every value that came from VaultRE or a data file goes through
 * esc() on its way in. Nothing here fetches anything; build.mjs hands over
 * the data and the optimised image paths.
 *
 * All internal links are root-relative ("/about", "/assets/..."): vercel.json
 * has cleanUrls, and pages live at two depths (/about, /areas/ponsonby).
 */

export const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/* ------------------------------------------------------------------ */
/* small formatting helpers                                            */
/* ------------------------------------------------------------------ */

const NZ_MONTH = new Intl.DateTimeFormat("en-NZ", { month: "short", year: "numeric", timeZone: "Pacific/Auckland" });
const NZ_DAY = new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "short", timeZone: "Pacific/Auckland" });

const moneyExact = (n) => (n ? `$${n.toLocaleString("en-NZ")}` : "");

/** "Herne Bay, Ponsonby and Grey Lynn" */
export function listNames(names) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * VaultRE and the Ray White site don't always spell a suburb the same way
 * ("St Marys Bay" / "Saint Marys Bay", "Pt Chevalier"), so suburbs are
 * compared on a normalised key.
 */
export const suburbKey = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/\bsaint\b/g, "st")
    .replace(/\bpoint\b/g, "pt")
    .replace(/[^a-z]/g, "");

/**
 * Method of sale, in buyer-facing words. "Private Treaty" is trade jargon
 * for an advertised, negotiated sale, so it reads "For sale" (same table as
 * the sister sites).
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

function statusLabel(l) {
  if ((l.status ?? "").toLowerCase() === "conditional") return "Under offer";
  return methodLabel(l);
}

function priceLine(l) {
  if (l.displayPrice) return l.displayPrice;
  if (l.searchPrice) return moneyExact(l.searchPrice);
  const label = methodLabel(l);
  if (/auction/i.test(label) && l.auctionDate) return `Auction ${NZ_DAY.format(new Date(l.auctionDate))}`;
  return label === "For sale" ? "Price by negotiation" : label;
}

function specs(l) {
  const bits = [];
  if (l.bed) bits.push(`${l.bed} bed`);
  if (l.bath) bits.push(`${l.bath} bath`);
  if (l.car) bits.push(`${l.car} car`);
  return bits.map((b) => `<span>${esc(b)}</span>`).join("");
}

/* ------------------------------------------------------------------ */
/* icons                                                               */
/* ------------------------------------------------------------------ */

const ICON_INSTAGRAM = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"/></svg>`;
const ARROW = `<span class="area__arrow" aria-hidden="true">&rarr;</span>`;

/** Loaded without blocking first paint; display=swap shows the fallback font meanwhile. */
const FONTS =
  "https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&amp;family=Playfair+Display:ital,wght@0,500;1,500&amp;display=swap";

/* ------------------------------------------------------------------ */
/* the site                                                            */
/* ------------------------------------------------------------------ */

/**
 * @param ctx everything the pages need — see build.mjs, where it is built.
 * @returns the pages, each { file, path, title, html }.
 */
export function renderSite(ctx) {
  const { agent, office, form, origin, images, stats, testimonials, areas, instagram } = ctx;
  const current = ctx.current;
  const sold = ctx.sold;

  const NAV = [
    { path: "/about", label: "About" },
    { path: "/listings", label: "Listings" },
    { path: "/recent-sales", label: "Recent Sales" },
    { path: "/areas", label: "Areas" },
    { path: "/testimonials", label: "Testimonials" },
    { path: "/contact", label: "Contact" },
  ];

  /* ---------------- structured data ---------------- */

  const agentId = `${origin}/#casey-green`;
  const agentSchema = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "@id": agentId,
    name: agent.name,
    description: agent.seoDescription,
    url: `${origin}/`,
    image: `${origin}${images.og.src}`,
    logo: `${origin}/assets/raywhite-logo.png`,
    telephone: agent.phoneHref,
    email: agent.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: office.street,
      addressLocality: office.locality,
      addressRegion: "Auckland",
      postalCode: office.postalCode,
      addressCountry: "NZ",
    },
    areaServed: areas.map((a) => ({
      "@type": "Place",
      name: `${a.name}, Auckland`,
      url: `${origin}/areas/${a.slug}`,
    })),
    sameAs: [instagram.url, agent.linkedin, agent.companyProfile],
    parentOrganization: {
      "@type": "RealEstateAgent",
      name: office.brand,
      legalName: office.legalName,
      telephone: office.phoneHref,
    },
  };

  const crumbs = (trail) => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Home", path: "/" }, ...trail].map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${origin}${c.path === "/" ? "/" : c.path}`,
    })),
  });

  const crumbNav = (trail) =>
    `<nav aria-label="Breadcrumb"><ol class="crumbs">${[{ name: "Home", path: "/" }, ...trail]
      .map((c, i, all) =>
        i === all.length - 1
          ? `<li aria-current="page">${esc(c.name)}</li>`
          : `<li><a href="${c.path}">${esc(c.name)}</a></li>`
      )
      .join("")}</ol></nav>`;

  /* ---------------- shared chrome ---------------- */

  function head({ title, description, path, schema = [], ogImage = images.og, preload = null }) {
    const canonical = path ? `${origin}${path}` : null;
    const ld = schema.map((s) => `<script type="application/ld+json">${JSON.stringify(s).replace(/</g, "\\u003c")}</script>`).join("\n  ");
    return `<!DOCTYPE html>
<html lang="en-NZ">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  ${canonical ? `<link rel="canonical" href="${esc(canonical)}" />` : `<meta name="robots" content="noindex" />`}
  <meta name="theme-color" content="#17181b" />
  <meta name="author" content="${esc(agent.name)}" />
  <meta name="geo.region" content="NZ-AUK" />
  <meta name="geo.placename" content="Ponsonby, Auckland" />

  <meta property="og:type" content="website" />
  <meta property="og:locale" content="en_NZ" />
  <meta property="og:site_name" content="${esc(agent.name)} · Ray White" />
  ${canonical ? `<meta property="og:url" content="${esc(canonical)}" />` : ""}
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:image" content="${esc(origin + ogImage.src)}" />
  <meta property="og:image:width" content="${ogImage.width}" />
  <meta property="og:image:height" content="${ogImage.height}" />
  <meta name="twitter:card" content="summary_large_image" />

  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
  <link rel="icon" href="/assets/favicon.png" type="image/png" />
  <link rel="apple-touch-icon" href="/assets/favicon.png" />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="preload" as="style" href="${FONTS}" onload="this.onload=null;this.rel='stylesheet'" />
  <noscript><link rel="stylesheet" href="${FONTS}" /></noscript>
  <link rel="preconnect" href="${esc(form.origin)}" />
  ${preload ? `<link rel="preload" as="image" href="${esc(preload.src)}" imagesrcset="${esc(preload.srcset)}" imagesizes="100vw" fetchpriority="high" />` : ""}
  <link rel="stylesheet" href="/styles.css" />
  <script>document.documentElement.classList.add("js")</script>
  ${ld}
</head>`;
  }

  function header(active) {
    const items = NAV.map(
      (n) =>
        `<li><a class="nav__link" href="${n.path}"${n.path === active ? ' aria-current="page"' : ""}>${esc(n.label)}</a></li>`
    ).join("\n          ");
    // The CTA opens the appraisal form as a popup (mkt-forms-embed.js); the
    // href is where it goes if the script hasn't loaded.
    const cta =
      active === "/contact"
        ? `<a class="btn btn--ghost btn--small nav__cta" href="#appraisal">Free appraisal</a>`
        : `<a class="btn btn--ghost btn--small nav__cta" href="/contact#appraisal" data-atr-form-popup="${esc(form.slug)}">Free appraisal</a>`;
    return `<body>
  <a class="skip" href="#main">Skip to content</a>

  <header class="header" id="header">
    <div class="shell header__inner">
      <a class="brand" href="/" aria-label="${esc(agent.name)}, Ray White Auckland Central — home">
        <span>
          <span class="brand__name">${esc(agent.name)}</span>
          <span class="brand__role">Residential Sales · Ray White</span>
        </span>
        <span class="brand__logo"><img src="/assets/raywhite-logo.png" alt="" width="38" height="38" /></span>
      </a>

      <nav class="nav" aria-label="Main">
        <ul class="nav__list" id="navList">
          ${items}
        </ul>
        <a class="nav__social" href="${esc(instagram.url)}" target="_blank" rel="noopener" aria-label="${esc(agent.firstName)} on Instagram (@${esc(instagram.handle)})">${ICON_INSTAGRAM}</a>
        ${cta}
        <button class="nav__toggle" id="navToggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="navList"><span></span></button>
      </nav>
    </div>
  </header>
`;
  }

  function footer() {
    const explore = NAV.map((n) => `<li><a href="${n.path}">${esc(n.label)}</a></li>`).join("");
    const areaLinks = areas.map((a) => `<li><a href="/areas/${a.slug}">${esc(a.name)} real estate</a></li>`).join("");
    return `
  <footer class="footer">
    <div class="shell">
      <div class="footer__top">
        <div class="footer__brand">
          <span class="brand__name">${esc(agent.name)}</span>
          <span class="brand__role">Residential Sales · Ray White</span>
          <p class="footer__about">
            Licensee Salesperson with Ray White Auckland Central, selling homes across
            ${esc(listNames(areas.map((a) => a.name)))}.
          </p>
          <img class="footer__mark" src="/assets/raywhite-mark.png" alt="Ray White" width="46" height="46" loading="lazy" />
        </div>

        <div>
          <h2>Explore</h2>
          <ul>${explore}</ul>
        </div>

        <div>
          <h2>Areas</h2>
          <ul>${areaLinks}</ul>
        </div>

        <div>
          <h2>Contact</h2>
          <ul>
            <li><a href="tel:${esc(agent.phoneHref)}">${esc(agent.phone)}</a></li>
            <li><a href="mailto:${esc(agent.email)}">${esc(agent.email)}</a></li>
            <li><a href="${esc(instagram.url)}" target="_blank" rel="noopener">Instagram @${esc(instagram.handle)}</a></li>
            <li><a href="${esc(agent.linkedin)}" target="_blank" rel="noopener">LinkedIn</a></li>
            <li>${esc(office.brand)}<br />${esc(office.address)}</li>
          </ul>
        </div>
      </div>

      <div class="footer__bar">
        <span>&copy; <span id="year">${new Date().getFullYear()}</span> ${esc(agent.name)} · Licensee Salesperson, licence ${esc(agent.licence)}</span>
        <span>${esc(office.brand)} · ${esc(office.legalName)}, Licensed REAA 2008</span>
      </div>
    </div>
  </footer>

  <div class="callbar">
    <a href="tel:${esc(agent.phoneHref)}">Call ${esc(agent.firstName)}</a>
    <a href="/contact#appraisal" data-atr-form-popup="${esc(form.slug)}">Free appraisal</a>
  </div>

  <script src="/script.js" defer></script>
  <script src="${esc(form.origin)}/mkt-forms-embed.js" async></script>
</body>
</html>
`;
  }

  const page = (meta, active, body) => `${head(meta)}\n${header(active)}\n  <main id="main">\n${body}\n  </main>\n${footer()}`;

  function pagehead({ eyebrow, h1, lede, trail }) {
    return `
    <section class="pagehead">
      <div class="shell pagehead__inner">
        ${trail ? crumbNav(trail) : ""}
        ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ""}
        <h1>${h1}</h1>
        ${lede ? `<p class="lede">${lede}</p>` : ""}
      </div>
    </section>`;
  }

  /* ---------------- cards ---------------- */

  function img(image, alt, { sizes = "(max-width: 560px) 100vw, (max-width: 960px) 50vw, 400px", eager = false } = {}) {
    if (!image) return "";
    const srcset = image.srcset ? ` srcset="${esc(image.srcset)}" sizes="${esc(sizes)}"` : "";
    const position = image.position ? ` style="object-position:${esc(image.position)}"` : "";
    return `<img src="${esc(image.src)}"${srcset} alt="${esc(alt)}" width="${image.width}" height="${image.height}"${position}${eager ? ' fetchpriority="high"' : ' loading="lazy" decoding="async"'} />`;
  }

  function cardWrap(url, inner) {
    return url
      ? `<a class="card" href="${esc(url)}" target="_blank" rel="noopener">${inner}</a>`
      : `<div class="card">${inner}</div>`;
  }

  function currentCard(l) {
    const inner = `
          <div class="card__media">
            ${img(ctx.cardImage(l), `${l.address}, ${l.suburb}`)}
            <span class="ribbon ribbon--dark">${esc(statusLabel(l))}</span>
          </div>
          <div class="card__body">
            <span class="card__addr">${esc(l.address)}</span>
            <span class="card__suburb">${esc(l.suburb)}</span>
            <span class="card__price">${esc(priceLine(l))}</span>
            <span class="card__specs">${specs(l)}</span>
          </div>`;
    return `<li>${cardWrap(l.url, inner)}</li>`;
  }

  /** Sale prices are left off on purpose, as on Ray White's own pages. */
  function soldCard(s) {
    const when = s.settlementDate ? `<span class="card__price">Sold ${esc(NZ_MONTH.format(new Date(s.settlementDate)))}</span>` : "";
    const inner = `
          <div class="card__media">
            ${img(ctx.cardImage(s), `${s.address}, ${s.suburb} — sold by ${agent.name}`)}
            <span class="ribbon">Sold</span>
          </div>
          <div class="card__body">
            <span class="card__addr">${esc(s.address)}</span>
            <span class="card__suburb">${esc(s.suburb)}</span>
            ${when}
            <span class="card__specs">${specs(s)}</span>
          </div>`;
    return `<li>${cardWrap(s.url, inner)}</li>`;
  }

  const emptyListings = `<p class="empty">${esc(agent.firstName)} has nothing on the market this week — new homes come up regularly.
          <a href="/contact">Get in touch</a> to hear about them first.</p>`;

  const currentGrid = (list, cls = "grid") =>
    list.length ? `<ul class="${cls}">${list.map(currentCard).join("")}</ul>` : emptyListings;
  const soldGrid = (list, cls = "grid") => `<ul class="${cls}">${list.map(soldCard).join("")}</ul>`;

  /* ---------------- shared blocks ---------------- */

  function appraisalBlock({ heading = "What’s your home worth?", lede, stone = true } = {}) {
    return `
    <section class="section${stone ? " section--stone" : ""}" id="appraisal">
      <div class="shell">
        <div class="section__head">
          <p class="eyebrow">Free appraisal</p>
          <h2 class="h2">${esc(heading)}</h2>
          <p class="lede">${esc(
            lede ??
              `Thinking about selling, or just want to know where you stand? ${agent.firstName} will give you an honest, no-obligation appraisal based on real local sales.`
          )}</p>
        </div>

        <div class="contact">
          <ul class="details">
            <li><span class="details__label">Call or text</span><span class="details__value"><a href="tel:${esc(agent.phoneHref)}">${esc(agent.phone)}</a></span></li>
            <li><span class="details__label">Email</span><span class="details__value"><a href="mailto:${esc(agent.email)}">${esc(agent.email)}</a></span></li>
            <li><span class="details__label">Office</span><span class="details__value">${esc(office.brand)}<br />${esc(office.address)}<br /><a href="tel:${esc(office.phoneHref)}">${esc(office.phone)}</a></span></li>
            <li><span class="details__label">Follow</span><span class="details__value"><a href="${esc(instagram.url)}" target="_blank" rel="noopener">@${esc(instagram.handle)}</a></span></li>
          </ul>

          <div class="formPanel">
            <div data-atr-form-lazy="${esc(form.slug)}"></div>
            <noscript><p class="formPanel__fallback">The appraisal form needs JavaScript. Call <a href="tel:${esc(agent.phoneHref)}">${esc(agent.phone)}</a> or email <a href="mailto:${esc(agent.email)}">${esc(agent.email)}</a> and ${esc(agent.firstName)} will come back to you.</p></noscript>
          </div>
        </div>
      </div>
    </section>`;
  }

  /** "Jen Randell · Buyer", or just "Seller" when the review carries no name. */
  function cite(t) {
    if (t.name) return `<cite>${esc(t.name)}${t.context ? ` <span>· ${esc(t.context)}</span>` : ""}</cite>`;
    return `<cite>${esc(t.context || "Client")}</cite>`;
  }

  /**
   * The follow card, which script.js swaps for Casey's latest posts once
   * /api/instagram/feed answers with some (lib/instagram.mjs). Until Instagram
   * is connected — or if the feed is down — the card is what stays.
   */
  function instagramBlock() {
    return `<div data-instagram-feed>
          <div class="insta">
            <img class="insta__avatar" src="${esc(images.avatar.src)}" alt="${esc(agent.name)}" width="${images.avatar.width}" height="${images.avatar.height}" loading="lazy" />
            <div>
              <a class="insta__handle" href="${esc(instagram.url)}" target="_blank" rel="noopener">${ICON_INSTAGRAM}@${esc(instagram.handle)}</a>
              <p>New listings, open homes, sold results and life around Ponsonby, Herne Bay and Grey Lynn — follow along on Instagram.</p>
              <a class="btn btn--primary" href="${esc(instagram.url)}" target="_blank" rel="noopener">Follow on Instagram</a>
            </div>
          </div>
        </div>`;
  }

  function areasList(wide = false) {
    return `<ul class="areas${wide ? " areas--wide" : ""}">${areas
      .map((a) => {
        const { listed = 0, sold: n = 0 } = stats.byArea[a.slug] ?? {};
        const counts = [listed && `${listed} for sale`, n && `${n} recent ${n === 1 ? "sale" : "sales"}`].filter(Boolean);
        const note = counts.length ? `${a.tagline} ${counts.join(" · ")}.` : a.tagline;
        return `<li class="area"><a href="/areas/${a.slug}"><span><span class="area__name">${esc(a.name)}</span><span class="area__note">${esc(note)}</span></span>${ARROW}</a></li>`;
      })
      .join("")}</ul>`;
  }

  /* ================================================================== */
  /* pages                                                               */
  /* ================================================================== */

  const pages = [];
  const add = (file, path, title, html) => pages.push({ file, path, title, html });

  /* ---------------- home ---------------- */
  {
    const recent = sold.slice(0, 6);
    const stat4 = current.length
      ? { num: String(current.length), label: current.length === 1 ? "Home for sale now" : "Homes for sale now" }
      : { num: "Free", label: "No-obligation appraisals" };
    const slides = testimonials
      .map((t, i) => `<blockquote class="slide"${i ? " hidden" : ""}><p>“${esc(t.quote)}”</p>${cite(t)}</blockquote>`)
      .join("\n            ");
    const dots = testimonials
      .map((t, i) => `<button class="slider__dot" type="button" aria-label="Show testimonial ${i + 1}" aria-current="${i ? "false" : "true"}"></button>`)
      .join("");

    const title = "Casey Green | Ponsonby & Herne Bay Real Estate Agent | Ray White";
    const description = `Casey Green, Ray White Auckland Central — real estate agent for Herne Bay, Ponsonby, Grey Lynn, St Marys Bay and Freemans Bay. Free, no-obligation appraisals.`;

    const body = `
    <section class="hero">
      <div class="hero__media">
        <img src="${esc(images.hero.src)}" srcset="${esc(images.hero.srcset)}" sizes="100vw" alt="${esc(images.hero.alt)}" width="${images.hero.width}" height="${images.hero.height}" style="object-position:${esc(images.hero.position ?? "50% 50%")}" fetchpriority="high" />
      </div>
      <div class="shell hero__content">
        <p class="eyebrow">${esc(agent.name)} · Herne Bay, Ponsonby &amp; Grey Lynn real estate</p>
        <h1 class="hero__title"><span>Know the area.</span> <span>Know the people.</span> <span>Know the market.</span> <em>Let’s Talk</em></h1>
        <p class="hero__lede">More than two decades calling greater Ponsonby home. A data-led, people-first approach to selling the city fringe’s most loved streets.</p>
        <div class="hero__actions">
          <a class="btn btn--primary" href="/contact#appraisal" data-atr-form-popup="${esc(form.slug)}">Book a free appraisal</a>
          <a class="btn btn--light" href="/listings">View listings</a>
        </div>
      </div>
      <p class="hero__caption">${esc(images.hero.caption)}</p>
    </section>

    <section class="section">
      <div class="shell">
        <p class="quote reveal">Local authority isn’t acquired in a season. It’s built street by street, over years.</p>

        <div class="intro">
          <div class="intro__body reveal">
            <p class="eyebrow">Meet Casey</p>
            <h2 class="h2">Your local agent for Auckland’s Inner-West.</h2>
            <p style="margin-top:1.25rem">${esc(agent.bio[0])}</p>
            <p>${esc(agent.bio[2])}</p>
            <div class="links">
              <a class="link" href="/about">Learn more about me</a>
              <span class="links__sep" aria-hidden="true"></span>
              <a class="link" href="/contact">Get in touch</a>
            </div>
          </div>
          <figure class="intro__photo reveal" style="margin:0">
            ${img(images.intro, images.intro.alt, { sizes: "(max-width: 900px) 460px, 600px" })}
          </figure>
        </div>

        <div class="stats" style="margin-top:clamp(3.5rem,7vw,5.5rem)">
          <div class="stat"><div class="stat__num">20+</div><div class="stat__label">Years living in greater Ponsonby</div></div>
          <div class="stat"><div class="stat__num">${stats.soldCount}</div><div class="stat__label">Recent Ray White sales</div></div>
          <div class="stat"><div class="stat__num">${areas.length}</div><div class="stat__label">Core suburbs, Herne Bay to Point Chevalier</div></div>
          <div class="stat"><div class="stat__num">${esc(stat4.num)}</div><div class="stat__label">${esc(stat4.label)}</div></div>
        </div>
      </div>
    </section>

    <section class="section section--stone">
      <div class="shell split">
        <div class="split__head">
          <h2 class="h2">Testimonials</h2>
          <a class="link" href="/testimonials">View all</a>
        </div>
        <div class="slider" data-slider>
          ${slides}
          <div class="slider__controls">${dots}</div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="shell split">
        <div class="split__head">
          <h2 class="h2">Current Listings</h2>
          <a class="link" href="/listings">View all</a>
        </div>
        <div>${currentGrid(current.slice(0, 4), "grid grid--two")}</div>
      </div>
    </section>

    <div class="band">
      ${img(images.band, images.band.alt, { sizes: "100vw" })}
      ${images.band.caption ? `<p class="band__caption">${esc(images.band.caption)}</p>` : ""}
    </div>

    <section class="section">
      <div class="shell split">
        <div class="split__head">
          <h2 class="h2">Recent Sales</h2>
          <a class="link" href="/recent-sales">View all ${stats.soldCount}</a>
        </div>
        <div>${soldGrid(recent, "grid grid--two")}</div>
      </div>
    </section>

    <section class="section section--stone">
      <div class="shell split">
        <div class="split__head">
          <h2 class="h2">Where I sell</h2>
          <p>Greater Ponsonby and the city fringe — the streets I live in, and know.</p>
          <a class="link" href="/areas">All areas</a>
        </div>
        ${areasList()}
      </div>
    </section>

    <section class="section">
      <div class="shell split">
        <div class="split__head">
          <h2 class="h2">Latest on Instagram</h2>
          <a class="link" href="${esc(instagram.url)}" target="_blank" rel="noopener">@${esc(instagram.handle)}</a>
        </div>
        ${instagramBlock()}
      </div>
    </section>

    <section class="section section--tight">
      <div class="shell split">
        <div class="split__head">
          <p class="eyebrow">In the community</p>
          <h2 class="h2">${esc(agent.community.name)}</h2>
        </div>
        <div class="community">
          <div>
            ${agent.community.body.map((p) => `<p>${esc(p)}</p>`).join("\n            ")}
            <p><a class="link" href="${esc(agent.community.url)}" target="_blank" rel="noopener">About Garden to Table</a></p>
          </div>
          <img src="${esc(images.community.src)}" alt="${esc(agent.community.logoAlt)}" width="${images.community.width}" height="${images.community.height}" loading="lazy" />
        </div>
      </div>
    </section>
${appraisalBlock()}`;

    add(
      "index.html",
      "/",
      title,
      page(
        {
          title,
          description,
          path: "/",
          preload: images.hero,
          schema: [
            agentSchema,
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: `${agent.name} · Ray White`,
              url: `${origin}/`,
              publisher: { "@id": agentId },
            },
          ],
        },
        "/",
        body
      )
    );
  }

  /* ---------------- about ---------------- */
  {
    const title = "About Casey Green | Ray White Auckland Central";
    const description =
      "Casey Green has called greater Ponsonby home for more than two decades. Meet the Ray White Auckland Central salesperson behind your sale.";
    const trail = [{ name: "About", path: "/about" }];
    const body = `${pagehead({
      eyebrow: `${agent.role} · ${office.brand}`,
      h1: `About ${esc(agent.name)}`,
      lede: "Two decades calling greater Ponsonby home, and an analytical, people-first approach to selling it.",
      trail,
    })}

    <section class="section">
      <div class="shell profile">
        <div class="profile__photo">
          ${img(images.about, images.about.alt, { sizes: "(max-width: 900px) 460px, 480px" })}
          <dl class="profile__card">
            <dt>Role</dt><dd>${esc(agent.role)}</dd>
            <dt>Office</dt><dd>${esc(office.brand)}, ${esc(office.address)}</dd>
            <dt>Licence</dt><dd>${esc(agent.licence)} (REAA 2008)</dd>
            <dt>Mobile</dt><dd><a href="tel:${esc(agent.phoneHref)}">${esc(agent.phone)}</a></dd>
            <dt>Email</dt><dd><a href="mailto:${esc(agent.email)}">${esc(agent.email)}</a></dd>
            <dt>Social</dt><dd><a href="${esc(instagram.url)}" target="_blank" rel="noopener">Instagram</a> · <a href="${esc(agent.linkedin)}" target="_blank" rel="noopener">LinkedIn</a></dd>
          </dl>
        </div>

        <div class="prose">
          <h2>Local knowledge, built over years</h2>
          ${agent.bio.map((p) => `<p>${esc(p)}</p>`).join("\n          ")}
          <div class="links">
            <a class="btn btn--primary" href="/contact#appraisal" data-atr-form-popup="${esc(form.slug)}">Book a free appraisal</a>
            <a class="btn btn--ghost" href="/recent-sales">See recent sales</a>
          </div>
        </div>
      </div>
    </section>

    <section class="section section--stone">
      <div class="shell">
        <div class="section__head">
          <p class="eyebrow">How Casey works</p>
          <h2 class="h2">Strategy, communication and competition.</h2>
        </div>
        <ul class="pillars">
          <li class="pillar reveal">
            <h3>Local authority</h3>
            <p>Two decades in greater Ponsonby give Casey the insight to position a home precisely, and the judgement to know what buyers here will actually pay for.</p>
          </li>
          <li class="pillar reveal">
            <h3>Data-led positioning</h3>
            <p>Sales data, current market dynamics and a working understanding of buyer psychology, brought together to price and present each home for maximum value.</p>
          </li>
          <li class="pillar reveal">
            <h3>Competition that lifts the price</h3>
            <p>Strong local networks and genuine enthusiasm bring multiple buyers to the table, with clear, calm communication through every negotiation.</p>
          </li>
        </ul>
      </div>
    </section>

    <section class="section">
      <div class="shell split">
        <div class="split__head">
          <p class="eyebrow">In the community</p>
          <h2 class="h2">${esc(agent.community.name)}</h2>
        </div>
        <div class="community">
          <div>
            ${agent.community.body.map((p) => `<p>${esc(p)}</p>`).join("\n            ")}
            <p><a class="link" href="${esc(agent.community.url)}" target="_blank" rel="noopener">About Garden to Table</a></p>
          </div>
          <img src="${esc(images.community.src)}" alt="${esc(agent.community.logoAlt)}" width="${images.community.width}" height="${images.community.height}" loading="lazy" />
        </div>
      </div>
    </section>

    <section class="section section--stone">
      <div class="shell split">
        <div class="split__head">
          <h2 class="h2">What clients say</h2>
          <a class="link" href="/testimonials">All testimonials</a>
        </div>
        <ul class="tlist">
          ${testimonials
            .slice(0, 2)
            .map((t) => `<li><blockquote class="tcard"><p>${esc(t.quote)}</p>${cite(t)}</blockquote></li>`)
            .join("\n          ")}
        </ul>
      </div>
    </section>
${appraisalBlock()}`;
    add("about.html", "/about", title, page({ title, description, path: "/about", schema: [agentSchema, crumbs(trail)] }, "/about", body));
  }

  /* ---------------- listings ---------------- */
  {
    const title = "Homes for Sale in Ponsonby & the City Fringe | Casey Green";
    const description = `Current listings from Casey Green, Ray White Auckland Central — homes for sale in ${listNames(
      areas.slice(0, 5).map((a) => a.name)
    )} and nearby.`;
    const trail = [{ name: "Listings", path: "/listings" }];
    const body = `${pagehead({
      eyebrow: "On the market",
      h1: "Current Listings",
      lede: `Homes ${esc(agent.firstName)} is marketing right now. Tap through for photos, floor plans and open-home times on Ray White.`,
      trail,
    })}

    <section class="section">
      <div class="shell">
        <nav class="tabs" aria-label="Listings or sales">
          <a href="/listings" aria-current="page">Current Listings (${current.length})</a>
          <a href="/recent-sales">Recent Sales (${stats.soldCount})</a>
        </nav>
        ${currentGrid(current)}
        <div class="after">
          <a class="btn btn--ghost" href="${esc(agent.listingsUrl)}" target="_blank" rel="noopener">${esc(agent.firstName)} on Ray White</a>
          <a class="btn btn--primary" href="/contact#appraisal" data-atr-form-popup="${esc(form.slug)}">Thinking of selling?</a>
        </div>
        <p class="footnote">Listings update every day from Ray White’s systems. Last updated ${esc(ctx.builtLabel)}.</p>
      </div>
    </section>

    <section class="section section--stone">
      <div class="shell split">
        <div class="split__head">
          <h2 class="h2">Recently sold</h2>
          <a class="link" href="/recent-sales">View all ${stats.soldCount}</a>
        </div>
        ${soldGrid(sold.slice(0, 4), "grid grid--two")}
      </div>
    </section>`;
    add("listings.html", "/listings", title, page({ title, description, path: "/listings", schema: [crumbs(trail)] }, "/listings", body));
  }

  /* ---------------- recent sales ---------------- */
  {
    const top = Object.entries(stats.soldBySuburb)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k);
    const title = `Recent Sales — ${top.slice(0, 2).join(" & ")} | Casey Green`;
    const description = `${stats.soldCount} recent Ray White sales by Casey Green across ${listNames(top)} and the inner west of Auckland.`;
    const trail = [{ name: "Recent Sales", path: "/recent-sales" }];
    const body = `${pagehead({
      eyebrow: "Sold",
      h1: "Recent Sales",
      lede: `${stats.soldCount} recent sales, most of them in ${esc(listNames(top))}.`,
      trail,
    })}

    <section class="section">
      <div class="shell">
        <nav class="tabs" aria-label="Listings or sales">
          <a href="/listings">Current Listings (${current.length})</a>
          <a href="/recent-sales" aria-current="page">Recent Sales (${stats.soldCount})</a>
        </nav>
        ${soldGrid(sold)}
        ${ctx.historicNote ? `<p class="footnote">${esc(ctx.historicNote)}</p>` : ""}
        <div class="after">
          <a class="btn btn--primary" href="/contact#appraisal" data-atr-form-popup="${esc(form.slug)}">What’s my home worth?</a>
        </div>
      </div>
    </section>`;
    add("recent-sales.html", "/recent-sales", title, page({ title, description, path: "/recent-sales", schema: [crumbs(trail)] }, "/recent-sales", body));
  }

  /* ---------------- testimonials ---------------- */
  {
    const title = "Client Testimonials | Casey Green, Ray White";
    const description = "What sellers and buyers say about working with Casey Green, Ray White Auckland Central — Ponsonby, Herne Bay and Grey Lynn.";
    const trail = [{ name: "Testimonials", path: "/testimonials" }];
    const body = `${pagehead({
      eyebrow: "Testimonials",
      h1: "What Casey’s clients say",
      lede: "In their own words — sellers and buyers Casey has worked with.",
      trail,
    })}

    <section class="section">
      <div class="shell">
        <ul class="tlist">
          ${testimonials.map((t) => `<li><blockquote class="tcard reveal"><p>${esc(t.quote)}</p>${cite(t)}</blockquote></li>`).join("\n          ")}
        </ul>
        <p class="footnote">${esc(ctx.testimonialSource)}</p>
      </div>
    </section>
${appraisalBlock({ heading: "Ready to talk about your home?" })}`;
    add("testimonials.html", "/testimonials", title, page({ title, description, path: "/testimonials", schema: [crumbs(trail)] }, "/testimonials", body));
  }

  /* ---------------- contact ---------------- */
  {
    const title = "Free Property Appraisal | Contact Casey Green, Ray White";
    const description = `Book a free, no-obligation appraisal with Casey Green, Ray White Auckland Central. Call ${agent.phone} or send your details online.`;
    const trail = [{ name: "Contact", path: "/contact" }];
    const body = `${pagehead({
      eyebrow: "Get in touch",
      h1: "Book a free property appraisal",
      lede: `Tell ${esc(agent.firstName)} a little about your home and she’ll come back to you — or call ${esc(agent.phone)} any time.`,
      trail,
    })}
${appraisalBlock({
  heading: "Request your appraisal",
  lede: `No obligation and no pressure — an honest view of what your home is worth and how ${agent.firstName} would sell it.`,
  stone: false,
})}

    <section class="section section--stone">
      <div class="shell split">
        <div class="split__head">
          <h2 class="h2">Find the office</h2>
          <figure class="split__photo">${img(images.contact, images.contact.alt, { sizes: "(max-width: 900px) 460px, 380px" })}</figure>
        </div>
        <div class="prose">
          <p>${esc(office.brand)} is on ${esc(office.address)}. ${esc(agent.firstName)} spends most of her time out in Herne Bay, Ponsonby, Grey Lynn and the neighbouring suburbs, so call ahead and she’ll meet you wherever suits.</p>
          <p><a class="link" href="${esc(office.mapsUrl)}" target="_blank" rel="noopener">Open in Google Maps</a></p>
        </div>
      </div>
    </section>`;
    add("contact.html", "/contact", title, page({ title, description, path: "/contact", schema: [agentSchema, crumbs(trail)] }, "/contact", body));
  }

  /* ---------------- areas hub ---------------- */
  {
    const title = "Suburbs Casey Green Sells | Ponsonby & City Fringe Real Estate";
    const description = `Casey Green sells homes across ${listNames(areas.map((a) => a.name))}. Local guides and recent sales.`;
    const trail = [{ name: "Areas", path: "/areas" }];
    const body = `${pagehead({
      eyebrow: "Areas",
      h1: "Greater Ponsonby &amp; the city fringe",
      lede: "The suburbs Casey lives in, knows and sells — from the harbour edge at Herne Bay to the beach at Point Chevalier.",
      trail,
    })}

    <section class="section">
      <div class="shell">
        ${areasList(true)}
      </div>
    </section>

    <div class="band">
      ${img(images.areas, images.areas.alt, { sizes: "100vw" })}
    </div>
${appraisalBlock()}`;
    add("areas.html", "/areas", title, page({ title, description, path: "/areas", schema: [crumbs(trail)] }, "/areas", body));
  }

  /* ---------------- one page per suburb ---------------- */
  for (const a of areas) {
    const key = suburbKey(a.name);
    const here = (l) => suburbKey(l.suburb) === key;
    const inCurrent = current.filter(here);
    const inSold = sold.filter(here);
    const nearKeys = new Set(a.neighbours.map(suburbKey));
    const nearSold = sold.filter((s) => nearKeys.has(suburbKey(s.suburb))).slice(0, 6);

    let results = "";
    if (inCurrent.length) {
      results += `<h3 class="eyebrow" style="margin-top:0">For sale in ${esc(a.name)}</h3>${currentGrid(inCurrent)}`;
    }
    if (inSold.length) {
      results += `<h3 class="eyebrow" style="margin-top:${inCurrent.length ? "3rem" : "0"}">Sold in ${esc(a.name)}</h3>${soldGrid(inSold.slice(0, 9))}`;
    }
    if (inSold.length < 3 && nearSold.length) {
      results += `<h3 class="eyebrow" style="margin-top:${results ? "3rem" : "0"}">Recent sales nearby — ${esc(listNames(a.neighbours))}</h3>${soldGrid(
        nearSold.slice(0, 3)
      )}`;
    }

    const others = areas.filter((o) => o.slug !== a.slug);
    const trail = [
      { name: "Areas", path: "/areas" },
      { name: a.name, path: `/areas/${a.slug}` },
    ];
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: a.faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    };

    const body = `${pagehead({
      eyebrow: `${a.name} · Auckland`,
      h1: `${esc(a.name)} Real Estate Agent`,
      lede: esc(a.lede),
      trail,
    })}

    <section class="section">
      <div class="shell split">
        <div class="split__head">
          <h2 class="h2">Living in ${esc(a.name)}</h2>
          <p>${esc(a.tagline)}</p>
          ${ctx.areaImage(a.slug) ? `<figure class="split__photo">${img(ctx.areaImage(a.slug), ctx.areaImage(a.slug).alt, { sizes: "(max-width: 900px) 460px, 380px" })}</figure>` : ""}
        </div>
        <div class="prose">
          ${a.about.map((p) => `<p>${esc(p)}</p>`).join("\n          ")}
          <ul class="ticks">${a.highlights.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>
        </div>
      </div>
    </section>

    <section class="section section--stone">
      <div class="shell">
        <div class="section__head">
          <p class="eyebrow">Casey in ${esc(a.name)}</p>
          <h2 class="h2">Listings and recent sales</h2>
        </div>
        ${results || emptyListings}
        <div class="after">
          <a class="btn btn--ghost" href="/recent-sales">All recent sales</a>
          <a class="btn btn--ghost" href="/listings">All listings</a>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="shell split">
        <div class="split__head">
          <h2 class="h2">Selling in ${esc(a.name)}</h2>
        </div>
        <div class="prose">
          <p>${esc(a.selling)}</p>
          <div class="links">
            <a class="btn btn--primary" href="#appraisal">Get a free ${esc(a.name)} appraisal</a>
            <a class="link" href="/about">About Casey</a>
          </div>
        </div>
      </div>
    </section>

    <section class="section section--tight">
      <div class="shell split">
        <div class="split__head">
          <h2 class="h2">${esc(a.name)} FAQs</h2>
        </div>
        <div class="faq">
          ${a.faqs.map((f, i) => `<details${i === 0 ? " open" : ""}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("\n          ")}
        </div>
      </div>
    </section>

    <section class="section section--tight">
      <div class="shell split">
        <div class="split__head">
          <h2 class="h2">Nearby areas</h2>
        </div>
        <ul class="chips">${others.map((o) => `<li><a href="/areas/${o.slug}">${esc(o.name)}</a></li>`).join("")}</ul>
      </div>
    </section>
${appraisalBlock({
  heading: `What’s your ${a.name} home worth?`,
  lede: `${agent.firstName} will give you an honest, no-obligation appraisal of your ${a.name} home, based on the local sales that genuinely compare.`,
})}`;

    add(
      `areas/${a.slug}.html`,
      `/areas/${a.slug}`,
      a.title,
      page({ title: a.title, description: a.description, path: `/areas/${a.slug}`, schema: [agentSchema, crumbs(trail), faqSchema] }, "/areas", body)
    );
  }

  /* ---------------- 404 ---------------- */
  {
    const title = "Page not found | Casey Green";
    const body = `${pagehead({
      eyebrow: "404",
      h1: "That page isn’t here",
      lede: `It may have moved. Try the <a class="link" href="/">home page</a>, <a class="link" href="/listings">current listings</a> or <a class="link" href="/contact">get in touch</a>.`,
    })}`;
    add("404.html", null, title, page({ title, description: "Page not found.", path: null }, "", body));
  }

  return pages;
}
