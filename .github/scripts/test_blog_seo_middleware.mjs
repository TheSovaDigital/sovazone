import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// Test the production middleware in isolation, mocking only Vercel's static asset fetch.
// No network, credentials or dependency installation required.
const root = process.cwd();
const ru = JSON.parse(fs.readFileSync(path.join(root, 'content/blog/index.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'en/content/blog/index.json'), 'utf8'));
let src = fs.readFileSync(path.join(root, 'middleware.js'), 'utf8');
src = src.replace(/^import ruIndex from .+;\s*$/m, 'const ruIndex = globalThis.__ruIndex;')
  .replace(/^import enIndex from .+;\s*$/m, 'const enIndex = globalThis.__enIndex;')
  .replace('export const config = ', 'const config = ')
  .replace('export default async function middleware(', 'async function middleware(');
src += '\nglobalThis.__result = {middleware, config};';
const staticFetch = async url => {
  const pathname = new URL(String(url)).pathname;
  assert.ok(pathname === '/post.html' || pathname === '/en/post.html', 'only blog templates requested');
  const body = fs.readFileSync(path.join(root, pathname.slice(1)), 'utf8');
  return new Response(body, {status: 200, headers: {'Content-Type': 'text/html'}});
};
const context = vm.createContext({
  __ruIndex: ru, __enIndex: en,
  URL, Headers, Response, fetch: staticFetch,
  encodeURIComponent
});
vm.runInContext(src, context, {timeout: 3000});
const {middleware, config} = context.__result;
assert.ok(config.matcher.includes('/post'), 'Russian route matched');
assert.ok(config.matcher.includes('/en/post'), 'English route matched');

async function check(locale, post) {
  const prefix = locale === 'en' ? '/en/post' : '/post';
  const url = 'https://sovazone.com' + prefix + '?slug=' + encodeURIComponent(post.slug);
  const response = await middleware(new Request(url));
  assert.equal(response.status, 200);
  const html = await response.text();
  const title = post.title.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  assert.ok(html.includes('<title>' + title + ' | SovaZone</title>'), 'article-specific title');
  assert.ok(html.includes('content="https://sovazone.com' + prefix + '?slug=' + post.slug + '"'), 'canonical or og URL');
  assert.ok(html.includes('content="https://sovazone.com' + post.cover + '"'), 'article-specific cover');
  assert.ok(html.includes('"@type":"BlogPosting"'), 'server-rendered BlogPosting schema');
  assert.ok(!html.includes('<title>Post — SovaZone</title>'), 'not generic English title');
  assert.ok(!html.includes('<title>Статья — SovaZone</title>'), 'not generic Russian title');
}
await check('ru', ru[0]);
await check('ru', ru.at(-1));
await check('en', en[0]);
await check('en', en.at(-1));
assert.equal(await middleware(new Request('https://sovazone.com/post?slug=nonexistent')), undefined);
assert.equal(await middleware(new Request('https://sovazone.com/post?slug=instagram-username-price-2026', {method:'HEAD'})), undefined);
console.log('PASS 4 article SEO responses and unknown-route safety');
