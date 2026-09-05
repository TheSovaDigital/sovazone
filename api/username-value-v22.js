import baseHandler from './username-value-v24.js';

// Stable public transport endpoint. Keep the URL that was already proven to work
// across browsers while the valuation logic lives in username-value-v24.js (v3.1).
export default async function handler(req,res){
  const origin=String(req.headers?.origin||'');
  const allowed=new Set(['https://sovazone.com','https://www.sovazone.com']);

  if(allowed.has(origin)){
    res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Vary','Origin');
  }
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.setHeader('Cache-Control','no-store, max-age=0');

  if(req.method==='OPTIONS') return res.status(204).end();
  return baseHandler(req,res);
}
