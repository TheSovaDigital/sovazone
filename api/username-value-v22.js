import baseHandler from './username-value-v24.js';

function validCallback(value){
  return /^[A-Za-z_$][A-Za-z0-9_$.]{0,100}$/.test(String(value||''));
}

async function runBase(req){
  let statusCode=200;
  let payload;
  let ended=false;
  const headers={};
  const shadow={
    setHeader(name,value){ headers[name]=value; },
    status(code){ statusCode=code; return shadow; },
    json(value){ payload=value; ended=true; return shadow; },
    end(){ ended=true; return shadow; }
  };
  await baseHandler(req,shadow);
  return {statusCode,payload,ended,headers};
}

export default async function handler(req,res){
  const origin=String(req.headers?.origin||'');
  const allowed=new Set(['https://sovazone.com','https://www.sovazone.com']);
  if(allowed.has(origin)){
    res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Vary','Origin');
  }
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');

  if(req.method==='OPTIONS') return res.status(204).end();

  // Fallback transport for browsers/network stacks that fail cross-origin fetch.
  if(req.method==='GET'){
    const q=req.query||{};
    const callback=String(q.callback||'');
    if(!validCallback(callback)){
      res.setHeader('Content-Type','application/javascript; charset=utf-8');
      return res.status(400).end('/* invalid callback */');
    }
    const proxyReq=Object.create(req);
    proxyReq.method='POST';
    proxyReq.body={
      username:String(q.username||''),
      platform:String(q.platform||'instagram'),
      lang:String(q.lang||'ru'),
      website:''
    };
    proxyReq.headers={...(req.headers||{}),origin:''};
    let result;
    try{ result=await runBase(proxyReq); }
    catch(e){ result={statusCode:500,payload:{error:'Could not complete the estimate.'}}; }
    const out=result.payload && typeof result.payload==='object'
      ? {...result.payload,__httpStatus:result.statusCode}
      : {error:'Empty valuation response',__httpStatus:result.statusCode||500};
    res.setHeader('Content-Type','application/javascript; charset=utf-8');
    return res.status(200).end(`${callback}(${JSON.stringify(out)});`);
  }

  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});

  if(typeof req.body==='string'){
    try{ req.body=JSON.parse(req.body); }
    catch(e){ return res.status(400).json({error:'Invalid request body'}); }
  }

  return baseHandler(req,res);
}
