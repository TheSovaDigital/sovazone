import baseHandler from './username-value-v24.js';

// Transport-only wrapper for browsers that are flaky on cross-origin JSON preflight.
// The valuation engine itself remains in username-value-v24.js (v3.1).
export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.setHeader('Cache-Control','no-store');

  if(req.method==='OPTIONS') return res.status(204).end();

  if(typeof req.body==='string'){
    try{ req.body=JSON.parse(req.body); }
    catch(e){ return res.status(400).json({error:'Invalid request body'}); }
  }

  return baseHandler(req,res);
}
