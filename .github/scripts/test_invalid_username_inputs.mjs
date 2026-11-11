import assert from 'node:assert/strict';
import instagramTikTok from '../../api/username-value.js';
import telegram from '../../api/telegram-username-value.js';
// Reject invalid characters before calculating a price.
async function request(handler,username,platform='instagram',lang='ru') {
  let status=200, payload;
  const req={method:'POST',headers:{origin:'https://sovazone.com'},body:{username,platform,lang,website:''},socket:{remoteAddress:'127.0.0.1'}};
  const res={setHeader(){},status(n){status=n;return this},json(v){payload=v;return this},end(){return this}};
  await handler(req,res);
  return {status,payload};
}
for(const [username,handler,platform] of [
  ['.',instagramTikTok,'instagram'],
  ['...',instagramTikTok,'instagram'],
  ['___',instagramTikTok,'instagram'],
  ['._._',instagramTikTok,'instagram'],
  ['...',instagramTikTok,'tiktok'],
  ['___',instagramTikTok,'tiktok'],
  ['._._',instagramTikTok,'tiktok'],
  ['____',telegram,'telegram'],
  ['_',telegram,'telegram'],
]) {
  const {status,payload}=await request(handler,username,platform);
  assert.equal(status,400,`${platform}/${username} must be rejected, not valued`);
  assert.equal(typeof payload?.error,'string');
  assert.ok(!('priceMin' in payload),`${platform}/${username} returned a valuation`);
}
const valid=await request(instagramTikTok,'aa','instagram');
assert.equal(valid.status,200,'valid usernames must still be valued');
assert.ok(valid.payload?.priceMin>0,'valid usernames retain price calculation');
console.log('PASS separator-only username validation for Instagram, TikTok, Telegram and valid @aa');
