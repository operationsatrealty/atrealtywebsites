# Blog Guide – Sam & Brett Website

## Blog Overview

The site includes a **fully-built blog section** with 3 seed posts, optimized for your target suburbs: Wattle Downs, Hill Park, Manurewa, Totara Park, and The Gardens.

**Live blog location**: `yourdomain.co.nz/blog/`

### Blog Structure

```
content/blog/                              # Source markdown files
├── wattle-downs-market-update-september-2026.md
├── first-home-buyer-guide-south-auckland.md
└── when-to-sell-your-south-auckland-home.md

dist/blog/                                 # Generated output (served by Vercel)
├── index.html                             # Blog homepage (lists all posts)
├── wattle-downs-market-update-september-2026/
│   └── index.html                         # Individual post page
├── first-home-buyer-guide-south-auckland/
│   └── index.html
└── when-to-sell-your-south-auckland-home/
    └── index.html
```

## Built-in Seed Posts

### 1. Wattle Downs Market Update (September 2026)
**URL**: `/blog/wattle-downs-market-update-september-2026/`  
**Focus**: Market trends, median prices, buyer/seller tips for Wattle Downs  
**Type**: Monthly market update

### 2. First Home Buyer Guide: South Auckland Edition
**URL**: `/blog/first-home-buyer-guide-south-auckland/`  
**Focus**: Buying process, suburb comparison, financing, tips  
**Type**: Educational guide

### 3. When to Sell Your South Auckland Home
**URL**: `/blog/when-to-sell-your-south-auckland-home/`  
**Focus**: Seller timing, market conditions, preparation tips  
**Type**: Selling guide

## Writing New Posts

### Create a New Post

1. **Create a markdown file** in `content/blog/`:

```markdown
---
title: "Your Post Title Here"
date: "2026-09-29"
suburb: "Wattle Downs"
excerpt: "Short summary shown in blog listings."
---

# Your Post Title Here

Your content here. Use standard markdown:

- Bullet points
- **Bold text**
- *Italics*
- Links: [text](url)

## Subheading

More content...
```

2. **File naming**: Use kebab-case (lowercase, hyphens), matching the URL slug:
   - Filename: `tips-for-selling-in-hill-park.md`
   - URL: `/blog/tips-for-selling-in-hill-park/`

3. **Rebuild** your site:

```bash
npm run build
# Blog posts are auto-generated as part of the build
```

4. **Commit** and push:

```bash
git add content/blog/*.md
git commit -m "Add new blog post: tips for selling in hill park"
git push
```

## Blog Post Frontmatter

Every post needs frontmatter (the `---` section at the top):

| Field | Required | Example | Notes |
|-------|----------|---------|-------|
| `title` | ✅ | "Market Update: Manurewa" | The page title & heading |
| `date` | ✅ | "2026-09-29" | ISO format (YYYY-MM-DD); used for sorting (newest first) |
| `suburb` | ✅ | "Wattle Downs" | Displayed in blog listings; optimize for your target areas |
| `excerpt` | ✅ | "Trends in the Manurewa market..." | Summary shown in listings; ~100 characters ideal |

## SEO Optimization

Each blog post automatically includes:
- ✅ Unique title (SEO-friendly)
- ✅ Meta description (from excerpt)
- ✅ Canonical URL (`yourdomain.co.nz/blog/slug/`)
- ✅ Schema.org structured data
- ✅ Suburb metadata (for local search)
- ✅ Open Graph tags (social media preview)

**Write for SEO:**
- **Titles**: "First Home Buyer Guide: South Auckland" (include suburb + intent)
- **Excerpts**: "Learn how to buy your first home in Wattle Downs, Hill Park, Manurewa..."
- **Headings**: Use H2 for sections (H1 is reserved for the post title)
- **Keywords**: Naturally mention target suburbs in content
- **Links**: Link related posts using markdown: `[Other post](../other-post-slug/)`

## Blog Navigation

The blog is integrated into the main site:

**Main navigation** (header):
- Home → `/`
- About → `/#about`
- For Sale → `/#listings`
- Sold → `/#sales`
- **Blog** → `/blog/` ← Direct to blog homepage
- Contact → `/#contact`

**Blog pages link back to**:
- Main site (home link in header)
- Related posts (3 suggested at bottom of each post)
- Contact form (CTA at bottom: "Get in Touch")

## Styling

Blog posts use the same Ray White brand design as the main site:
- **Colors**: Yellow (#FFE512), dark grey (#595959)
- **Fonts**: Lato (body) + Playfair Display (headings)
- **Layout**: Responsive (mobile, tablet, desktop)

Posts are automatically styled — no CSS needed for individual posts.

## Limitations & Notes

- **Markdown subset**: The build supports basic markdown (headings, bold, italics, lists, links). Complex HTML is not supported.
- **No images in posts** (yet): Current version doesn't embed images in blog content. Workaround: Reference images via URL in a caption.
- **No categories/tags**: Posts are sorted by date. Filter by suburb in the frontmatter instead.

## Content Strategy Tips

**Write for your target audiences:**

1. **First-time buyers** → Guides, checklists, "What to expect"
2. **Sellers considering moving** → Market updates, timing advice, preparation tips
3. **Investors** → ROI analysis, suburb comparisons, growth trends
4. **Current residents** → Neighborhood spotlights, local news tie-ins

**Post frequency**:
- **Weekly or bi-weekly** ideal for SEO and audience engagement
- Each post helps your domain rank for suburb + intent keywords
- More posts = more entry points to your site

**Promote your blog**:
- Link to new posts from your main site CTA
- Share on social media (Facebook, Instagram, LinkedIn)
- Include blog link in email signatures

## Automating Blog Posts

For **automated, AI-generated blog posts**, see the `AUTOMATION.md` file (in Linda Galbraith site example). This lets you:
- Generate posts on a schedule (weekly/fortnightly)
- Use Claude to write suburb-specific content
- Auto-publish to your site

This is advanced — keep it simple for now, just write manually.

## Questions?

- **How do I preview my blog post before publishing?** → Run `npm run build`, then open `dist/blog/your-post-slug/index.html` locally
- **Can I change the blog layout/design?** → Edit `src/styles.css` (search for `.blog-`) or modify blog HTML generation in `build.mjs`
- **How do I delete an old post?** → Remove the `.md` file from `content/blog/` and rebuild
- **Can I add comments/reactions?** → Not built-in. Workaround: link to your contact form or social media

---

**Blog built:** 2026-09-29  
**Posts included:** 3 (Wattle Downs market, first-home buyer guide, when to sell)  
**Ready to extend**: Add more `.md` files and rebuild
