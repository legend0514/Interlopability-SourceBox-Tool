import http from 'node:http';
import tls from 'node:tls';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {VERSION,HEX,label,mapId,frames,send} from './protocol.mjs';

export function publicIPv4(ip){
 if(typeof ip!=='string'||!/^\d+\.\d+\.\d+\.\d+$/.test(ip))return false;
 const a=ip.split('.').map(Number);if(a.some(x=>x>255)||a.join('.')!==ip)return false;
 const [x,y]=a;
 return !(x===0||x===10||x===127||x>=224||x===100&&y>=64&&y<=127||x===169&&y===254||x===172&&y>=16&&y<=31||x===192&&(y===168||y===0||y===2)||x===198&&(y===18||y===19||y===51)||x===203&&y===0);
}
// Render's documented X-Forwarded-For chain ends in its trusted edge/proxy hops.
// Walk backwards, ignoring only local hops and Cloudflare's published IPv4 ranges.
const cloudflare=['173.245.48.0/20','103.21.244.0/22','103.22.200.0/22','103.31.4.0/22','141.101.64.0/18','108.162.192.0/18','190.93.240.0/20','188.114.96.0/20','197.234.240.0/22','198.41.128.0/17','162.158.0.0/15','104.16.0.0/13','104.24.0.0/14','172.64.0.0/13','131.0.72.0/22'];
const ipv4Number=ip=>ip.split('.').reduce((n,v)=>(n*256+Number(v))>>>0,0);
export function renderClientIP(header){
 if(typeof header!=='string'||header.length>1024)return '';
 for(const raw of header.split(',').reverse()){
  const ip=raw.trim();if(!publicIPv4(ip))continue;
  if(cloudflare.some(cidr=>{const [base,bits]=cidr.split('/');const mask=(0xffffffff<<(32-Number(bits)))>>>0;return (ipv4Number(ip)&mask)===(ipv4Number(base)&mask);}))continue;
  return ip;
 }
 return '';
}
export function directoryURL(value){
 const url=new URL(value);
 if(url.username||url.password||url.search||url.hash||!(url.protocol==='https:'||url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)))throw Error('Use an HTTPS directory address.');
 return url.href.replace(/\/$/,'');
}
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export function validListing(s){return s&&s.protocol===VERSION&&label(s.name)&&mapId(s.map)&&Number.isInteger(s.players)&&Number.isInteger(s.maxPlayers)&&s.maxPlayers>=2&&s.maxPlayers<=32&&s.players>=0&&s.players<=s.maxPlayers&&HEX.test(s.invite?.token??'')&&HEX.test(s.invite?.fingerprint??'')&&Number.isInteger(s.invite?.port)&&s.invite.port>=1024&&s.invite.port<=65535;}
export async function probeServer(host,port,fingerprint,registrationKey){
 return new Promise((resolve,reject)=>{
  const nonce=randomBytes(16).toString('hex');let done=false;
  const socket=tls.connect({host,port,rejectUnauthorized:false,minVersion:'TLSv1.2'});
  const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);socket.destroy();error?reject(error):resolve(value);};
  const timer=setTimeout(()=>finish(Error('Server is unreachable. Forward the TCP hosting port and allow it through your firewall.')),5000);
  socket.on('error',()=>finish(Error('Server is unreachable. Check port forwarding.')));
  socket.on('close',()=>{if(!done)finish(Error('Server did not answer the directory check.'));});
  socket.on('secureConnect',()=>{
   const actual=socket.getPeerCertificate().fingerprint256?.replaceAll(':','').toLowerCase();
   if(!equal(actual,fingerprint))return finish(Error('Server certificate did not match.'));
   send(socket,{type:'public_status',nonce,registrationKey});
  });
  frames(socket,msg=>{if(msg.type!=='public_status'||msg.nonce!==nonce||!validListing(msg.listing))return finish(Error('Invalid server listing.'));finish(null,msg.listing);},()=>finish(Error('Invalid directory response.')));
 });
}

// Run behind an HTTPS reverse proxy. Only trust forwarding headers from that proxy.
export function createDirectory({ttlMs=90000,now=Date.now,probe=probeServer,allowLoopback=false,trustProxy=false,renderProxy=false}={}){
 const listings=new Map(),rates=new Map();let checking=0;
 const prune=()=>{for(const [id,s] of listings)if(s.expires<=now())listings.delete(id);for(const [ip,r]of rates)if(r.until<=now())rates.delete(ip);};
 const server=http.createServer(async(req,res)=>{
  const reply=(code,data)=>{if(!res.headersSent){res.writeHead(code,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));}};
  try{
   prune();const ip=renderProxy?renderClientIP(req.headers['x-forwarded-for']):(trustProxy?String(req.headers['x-real-ip']??''):req.socket.remoteAddress??'').replace(/^::ffff:/,'');
   if(req.method==='GET'&&req.url==='/health')return reply(200,{ok:true});
   if(rates.size>=10000&&!rates.has(ip))return reply(503,{error:'Directory is busy.'});
   const rate=rates.get(ip)??{until:now()+60000,count:0};rates.set(ip,rate);
   if(++rate.count>90)return reply(429,{error:'Please wait before refreshing again.'});
   if(req.method==='GET'&&req.url==='/v1/servers')return reply(200,{version:1,servers:[...listings.values()].map(s=>s.listing).slice(0,100)});
   if(req.url!=='/v1/servers'||!['POST','DELETE'].includes(req.method))return reply(404,{error:'Not found.'});
   if(!publicIPv4(ip)&&!(allowLoopback&&ip==='127.0.0.1'))return reply(400,{error:'A public IPv4 connection is required.'});
   let bytes=0,chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>2048){reply(413,{error:'Request is too large.'});req.destroy();return;}chunks.push(chunk);}
   const data=JSON.parse(Buffer.concat(chunks));
   if(!Number.isInteger(data.port)||data.port<1024||data.port>65535||!HEX.test(data.fingerprint??'')||!HEX.test(data.registrationKey??''))return reply(400,{error:'Invalid registration.'});
   const id=createHash('sha256').update(ip+':'+data.port).digest('hex');
   const owner=createHash('sha256').update(data.registrationKey).digest('hex');
   if(req.method==='DELETE'){
    if(listings.has(id)&&!equal(listings.get(id).owner,owner))return reply(403,{error:'Listing owner mismatch.'});
    listings.delete(id);return reply(200,{removed:true});
   }
   if(checking>=16)return reply(503,{error:'Directory is busy.'});
   if(listings.size>=100&&!listings.has(id))return reply(503,{error:'Directory is full.'});
   if([...listings.values()].filter(s=>s.ip===ip).length>=4&&!listings.has(id))return reply(429,{error:'Too many servers on this address.'});
   checking++;let listing;try{listing=await probe(ip,data.port,data.fingerprint,data.registrationKey);}finally{checking--;}
   if(!validListing(listing)||listing.invite.fingerprint!==data.fingerprint||listing.invite.port!==data.port)throw Error('Server returned invalid listing details.');
   listing={name:listing.name,map:listing.map,players:listing.players,maxPlayers:listing.maxPlayers,protocol:VERSION,invite:{host:ip,port:data.port,fingerprint:data.fingerprint,token:listing.invite.token}};
   listings.set(id,{listing,owner,ip,expires:now()+ttlMs});reply(200,{id,host:ip,expiresIn:ttlMs});
  }catch(error){reply(error instanceof SyntaxError?400:502,{error:error instanceof SyntaxError?'Invalid JSON.':error.message});}
 });
 server.requestTimeout=10000;server.headersTimeout=10000;server.maxConnections=128;
 return server;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT||8787),host=process.env.BIND||(process.env.RENDER==='true'?'0.0.0.0':'127.0.0.1');
 const server=createDirectory({trustProxy:process.env.TRUST_PROXY==='1',renderProxy:process.env.RENDER==='true'});
 server.listen(port,host,()=>console.log('SourceBox directory listening on '+host+':'+port));
 for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>server.close());
}
