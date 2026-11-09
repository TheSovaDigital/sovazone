/**
 * Deliver per-article metadata in the initial HTML response for social crawlers.
 * Scoped only to legacy RU/EN blog routes; leaves Valuation AI unchanged.
 */
import ruIndex from './content/blog/index.json';
import enIndex from './en/content/blog/index.json';

const catalogs = {
  ru: new Map(ruIndex.map(post => [post.slug, post])),
  en: new Map(enIndex.map(post => [post.slug, post])),
};
const escapeHtml = input => String(input ?? '').replace(/[&<>"']/g, char =>
  ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char])
);
function replaceMeta(html, tag, value) {
  const pattern = new RegExp('(<meta\\s+(?:name|property)="' + tag + '"\\s+content=")[^"]*(")', 'i');
  return html.replace(pattern, (_match, before, after) => before + escapeHtml(value) + after);
}
function replaceLink(html, rel, value) {
  const pattern = new RegExp('(<link\\s+rel="' + rel + '"\\s+href=")[^"]*(")', 'i');
  return html.replace(pattern, (_match, before, after) => before + escapeHtml(value) + after);
}
export const config = {runtime: 'nodejs', matcher: ['/post', '/post/', '/post.html', '/en/post', '/en/post/', '/en/post.html']};

export default async function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/$/, '').replace(/\.html$/, '');
  const locale = pathname === '/en/post' ? 'en' : pathname === '/post' ? 'ru' : null;
  if (!locale || request.method !== 'GET') return;
  const slug = url.searchParams.get('slug');
  if (!slug || !/^[A-Za-z0-9_-]+$/.test(slug)) return;
  const post = catalogs[locale].get(slug);
  if (!post) return;

  const templateUrl = new URL(locale === 'en' ? '/en/post.html' : '/post.html', url);
  const templateResponse = await fetch(templateUrl, {headers: {'Accept': 'text/html'}});
  if (!templateResponse.ok) return;
  let html = await templateResponse.text();
  if (!/<!doctype html/i.test(html)) return;

  const canonical = 'https://sovazone.com/' + (locale === 'en' ? 'en/' : '') + 'post?slug=' + encodeURIComponent(slug);
  const title = String(post.title).trim() + ' | SovaZone';
  const description = String(post.description || '').trim();
  const image = typeof post.cover === 'string' && /^\/[^/]/.test(post.cover)
    ? 'https://sovazone.com' + post.cover
    : 'https://sovazone.com/og-image.png';

  html = html.replace(/<title>[\s\S]*?<\/title>/i, '<title>' + escapeHtml(title) + '</title>');
  html = replaceMeta(html, 'description', description);
  html = replaceLink(html, 'canonical', canonical);
  for (const name of ['og:title', 'twitter:title']) html = replaceMeta(html, name, title);
  for (const name of ['og:description', 'twitter:description']) html = replaceMeta(html, name, description);
  html = replaceMeta(html, 'og:url', canonical);
  for (const name of ['og:image', 'og:image:secure_url', 'twitter:image']) html = replaceMeta(html, name, image);
  // Individual blog cover dimensions vary, so remove misleading template dimensions.
  html = html.replace(/\s*<meta property="og:image:(?:width|height)"[^>]*>/gi, '');

  const schema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description,
    datePublished: post.date,
    image,
    url: canonical,
    inLanguage: locale,
    author: {'@type':'Organization', name:'SovaZone'},
    publisher: {'@type':'Organization', name:'SovaZone', url:'https://sovazone.com/'}
  }).replace(/</g, '\\u003c');
  html = html.replace('</head>', '<script type="application/ld+json">' + schema + '</script>\n</head>');

  const headers = new Headers(templateResponse.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.delete('content-length');
  headers.set('cache-control', 'public, max-age=0, s-maxage=3600');
  return new Response(html, {status:200, headers});
}