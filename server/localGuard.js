/** Local API guard.
 * The API runs compilers and writes into game/Documents folders, so it must only
 * answer the SvenStudio UI on this PC:
 *  - Host must be a loopback name (blocks DNS-rebinding pages that resolve to 127.0.0.1).
 *  - Origin, when the browser sends one, must be the local UI (blocks cross-site requests).
 * BuildTogether guests use the separate WebSocket port and are not affected.
 */
const LOOPBACK=new Set(['127.0.0.1','localhost','[::1]','::1']);

export function allowedPorts(apiPort){
 const extra=String(process.env.SVEN_UI_PORTS||'').split(',').map(Number).filter(Number.isInteger);
 return new Set([apiPort,5173,4173,...extra].map(String));
}
function splitHost(value){
 if(typeof value!=='string'||!value)return null;
 const match=value.match(/^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/);
 return match?{host:match[1].toLowerCase(),port:match[2]||''}:null;
}
export function isLocalHost(hostHeader,ports){
 const parsed=splitHost(hostHeader);
 return Boolean(parsed&&LOOPBACK.has(parsed.host)&&ports.has(parsed.port));
}
export function isLocalOrigin(origin,ports){
 if(origin===undefined)return true; // same-origin GET/HEAD, curl, server-side tools
 try{const url=new URL(origin);return (url.protocol==='http:'||url.protocol==='https:')&&LOOPBACK.has(url.hostname.toLowerCase())&&ports.has(url.port||(url.protocol==='https:'?'443':'80'))}
 catch{return false}
}
export function localApiGuard(apiPort){
 const ports=allowedPorts(apiPort);
 return (req,res,next)=>{
  if(!isLocalHost(req.headers.host,ports))return res.status(421).json({error:'SvenStudio API only answers on 127.0.0.1/localhost.'});
  if(!isLocalOrigin(req.headers.origin,ports))return res.status(403).json({error:'Untrusted origin.'});
  return next();
 };
}
