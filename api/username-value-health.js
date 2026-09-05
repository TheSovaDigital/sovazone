export default function handler(req,res){
  const origin=String(req.headers?.origin||'');
  if(origin==='https://sovazone.com'||origin==='https://www.sovazone.com'){
    res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Vary','Origin');
  }
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.setHeader('Cache-Control','no-store');
  if(req.method==='OPTIONS') return res.status(204).end();
  return res.status(200).json({ok:true,method:req.method,node:process.version});
}
