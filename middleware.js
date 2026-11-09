/**
 * Serve article-specific SEO metadata on the initial HTML response.
 * URLs remain /post?slug=... and /en/post?slug=...; the valuation engine is untouched.
 * This file is limited to blog routes and uses the existing blog indexes as metadata.
 */
import ruIndex from './content/blog/index.json';
import enIndex from './en/content/blog/index.json';

const byLocale = {
  ru: new Map(ruIndex.map(post => [post.slug, post])),
  en: new Map(enIndex.map(post => [post.slug, post])),
};

const escapeAttribute = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[ch]));

function replaceMeta(html, selector, value) {
  const safe = escapeAttribute(value);
  const regex = new RegExp('(<meta\\s+(?:name|property)="' + selector.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&') + '"\\s+content=")[^"]*(")', 'i');
  return html.replace(regex, (_all, start, end) => start + safe + end);
}

function replaceLink(html, rel, value) {
  const safe = escapeAttribute(value);
  const regex = new RegExp('(<link\\s+rel="' + rel + '"\\s+href=")[^"]*(")', 'i');
  return html.replace(regex, (_all, start, end) => start + safe + end);
}

export const config = {
  matcher: ['/post', '/post/', '/en/post', '/en/post/'],
};

export default async function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\\/g, '/').replace(/\\/$/, '');
  const locale = path === '/en/post' ? 'en' : path === '/post' ? 'ru' : null;
  if (!locale || request.method !== 'GET') return;

  const slug = url.searchParams.get('slug');
  if (!slug || !/^[a-zA-Z0-9_-]+$/.test(slug)) return;
  const meta = byLocale[locale].get(slug);
  if (!meta) return;

  // Read the unmodified static template. Only the two blog routes run middleware.
  const template = new URL(locale === 'en' ? '/en/post.html' : '/post.html', url);
  const source = await fetch(template, {headers: {'Accept': 'text/html'}});
  if (!source.ok) return;
  let html = await source.text();
  if (!html.toLowerCase().includes('<!doctype html')) return;

  const canonical = 'https://sovazone.com/' + (locale === 'en' ? 'en/' : '') + 'post?slug=' + encodeURIComponent(slug);
  const title = String(meta.title || '').trim() + ' | SovaZone';
  const desc = String(meta.description || '').trim();
  const cover = typeof meta.cover === 'string' && /^\\/[^/]/.test(meta.cover)
    ? 'https://sovazone.com' + meta.cover : 'https://sovazone.com/og-image.png';

  html = html.replace(/<title>[\\s\\S]*?<\\/title>/i, '<title>' + escapeAttribute(title) + '</title>');
  html = replaceMeta(html, 'description', desc);
  html = replaceLink(html, 'canonical', canonical);
  for (const tag of ['og:title','twitter:title']) html = replaceMeta(html, tag, title);
  for (const tag of ['og:description','twitter:description']) html = replaceMeta(html, tag, desc);
  html = replaceMeta(html, 'og:url', canonical);
  for (const tag of ['og:image','og:image:secure_url','twitter:image']) html = replaceMeta(html, tag, cover);
  // The source images are not uniformly 1200x630; avoid inaccurate dimensions.
  html = html.replace(/\\s*<meta property="og:image:(?:width|height)"[^>]*>/gi, '');
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: meta.title,
    description: desc,
    datePublished: meta.date,
    image: cover,
    url: canonical,
    inLanguage: locale,
    author: {'@type':'Organization', name:'SovaZone'},
    publisher: {'@type':'Organization', name:'SovaZone', url:'https://sovazone.com/'}
  }).replace(/</g, '\\u003c');
  html = html.replace('</head>', '<script type="application/ld+json">' + jsonLd + '</script>\\n</head>');

  const headers = new Headers(source.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.delete('Content-Length');
  headers.set('Cache-Control', 'public, max-age=0, s-maxage=3600');
  return new Response(html, {status: 200, headers});
}
