# SovaZone SEO and content audit — 2026-11-09

## Coverage
- 130 public static HTML documents in RU and EN.
- 26 blog Markdown sources (16 RU and 10 EN).
- Checked titles, descriptions, canonical, hreflang, H1, JSON-LD, OG images, internal links, image resources, XML sitemaps, JavaScript syntax and content artifacts.
- 394 desktop/mobile browser assertions and 50 Valuation AI deterministic tests.

## Release
- 156 sitemap entries: RU general 23, RU articles 9, RU blog 17, RU usernames 32, EN 75.
- Added reciprocal hreflang in 52 paired HTML documents.
- Optimized 13 overlong descriptions, localized RU FAQ title, shortened EN homepage title.
- Removed incorrect generic alternate-language links from the dynamic English blog post template.
- Added reproducible sitemap generation and static SEO CI validation.
- Kept core valuation algorithms, product prices and site visual design unchanged.

## Validation
- Static SEO and Markdown scan: zero actionable issues after excluding service verification tokens and dynamic blog post templates.
- Browser QA: 394 passing assertions at 390px and 1366px, RU and EN.
- Valuation regression: 32 Instagram/TikTok plus 18 Telegram checks passed.
- Live existing routes /about, /tools/username-value, /en/blog returned HTTP 200.

## Remaining SEO limitations
1. Blog post URLs with query parameters load article-specific title, canonical and social metadata via client-side JavaScript. Social preview crawlers that do not run JS can still show generic post previews. Server-side or prerendered article metadata is a separate technical improvement.
2. The blog Cases category currently has no publications; this is content inventory, not a broken filter.
3. Automated textual scans cannot guarantee complete human editorial proofreading and do not establish indexed status in Search Console.
4. Publishing a sitemap does not guarantee indexing. Submit or refresh https://sovazone.com/sitemap.xml in Google Search Console.

## Maintenance
After adding HTML pages or blog sources, run: python3 scripts/prepare-seo-release.py. Review sitemap diffs and run: python3 scripts/site-seo-audit.py (requires beautifulsoup4). Site SEO validation is configured for relevant main branch changes.
