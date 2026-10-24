import {WebSocketServer} from './vendor/ws/wrapper.mjs';
import {randomBytes,createHash} from 'node:crypto';

// A bounded rendezvous for opaque TLS streams. No destination addresses are accepted.
export function attachRelay(server,{validListing,publicURL,clientIP}) {
 const wss=new WebSocketServer({noServer:true,maxPayload:65536,perMessageDeflate:false});
 const hosts=new Map(),pending=new Map(),rates=new Map();
 const json=(ws,value)=>{if(ws.readyState===1)ws.send(JSON.stringify(value));};
 const stop=ws=>ws.terminate();
 const heartbeat=setInterval(()=>{
  for(const ws of wss.clients){if(!ws.alive){stop(ws);continue;}ws.alive=false;ws.ping();}
  for(const [ip,r]of rates)if(r.until<Date.now())rates.delete(ip);
 },20000);heartbeat.unref();
 server.on('upgrade',(req,socket,head)=>{
  const path=req.url,ip=clientIP(req);
  if(!['/v1/relay/host','/v1/relay/join','/v1/relay/attach'].includes(path)||wss.clients.size>=256){socket.destroy();return;}
  if(rates.size>=10000&&!rates.has(ip)){socket.destroy();return;}
  const rate=rates.get(ip)??{until:Date.now()+60000,n:0};rates.set(ip,rate);
  if(++rate.n>120){socket.destroy();return;}
  wss.handleUpgrade(req,socket,head,ws=>{
   ws.alive=true;ws.on('pong',()=>ws.alive=true);ws.on('error',()=>{});
   const timeout=setTimeout(()=>stop(ws),10000);ws.once('close',()=>clearTimeout(timeout));
   ws.once('message',(raw,binary)=>{
    clearTimeout(timeout);let msg;try{if(binary||raw.length>4096)throw Error();msg=JSON.parse(raw);}catch{return stop(ws);}
    if(path==='/v1/relay/host'){
     if(!validListing(msg.listing)||!/^[a-f0-9]{64}$/.test(msg.owner??'')||hosts.size>=100||[...hosts.values()].filter(h=>h.ip===ip).length>=4)return stop(ws);
     const id=createHash('sha256').update(msg.owner).digest('hex');
     if(hosts.has(id))return stop(ws);
     const endpoint=publicURL||`http://127.0.0.1:${server.address().port}`;
     const listing=s=>({name:s.name,map:s.map,players:s.players,maxPlayers:s.maxPlayers,protocol:s.protocol,invite:{host:new URL(endpoint).hostname,port:s.invite.port,fingerprint:s.invite.fingerprint,token:s.invite.token,relayUrl:endpoint,relayId:id}});
     const h={ws,ip,listing:listing(msg.listing),channels:new Set()};hosts.set(id,h);
     json(ws,{type:'registered',invite:h.listing.invite});
     let updates=0,at=Date.now();
     ws.on('message',(raw,binary)=>{try{
      if(Date.now()-at>1000){updates=0;at=Date.now();}
      if(binary||raw.length>4096||++updates>4)throw Error();const m=JSON.parse(raw);
      if(m.type!=='listing'||!validListing(m.listing)||m.listing.invite.fingerprint!==h.listing.invite.fingerprint||m.listing.invite.token!==h.listing.invite.token)throw Error();h.listing=listing(m.listing);
     }catch{stop(ws);}});
     ws.once('close',()=>{hosts.delete(id);for(const c of h.channels)c.close();});
    }else if(path==='/v1/relay/join'){
     const h=hosts.get(msg.id);if(!h||h.channels.size>=h.listing.maxPlayers+4||pending.size>=128)return stop(ws);
     const ticket=randomBytes(32).toString('hex');let other;
     const c={close(){clearTimeout(expiry);pending.delete(ticket);h.channels.delete(c);stop(ws);if(other)stop(other);}};
     const expiry=setTimeout(()=>c.close(),10000);h.channels.add(c);
     pending.set(ticket,{h,ws,c,attach(peer){other=peer;clearTimeout(expiry);pending.delete(ticket);}});
     ws.once('close',()=>c.close());
     // Data is not accepted until the host has attached.
     const early=()=>c.close();ws.on('message',early);c.early=early;
     json(h.ws,{type:'connect',ticket});
    }else{
     const p=pending.get(msg.ticket);if(!p)return stop(ws);
     p.attach(ws);p.ws.off('message',p.c.early);ws.once('close',()=>p.c.close());
     const forward=(from,to)=>{
      let bytes=0,messages=0,at=Date.now();from.on('message',(data,binary)=>{
       if(Date.now()-at>1000){bytes=0;messages=0;at=Date.now();}bytes+=data.length;messages++;
       if(!binary||messages>512||bytes>2*1024*1024||to.readyState!==1||to.bufferedAmount>262144)return p.c.close();
       to.send(data,{binary:true},error=>{if(error)p.c.close();});
      });
     };forward(ws,p.ws);forward(p.ws,ws);
     json(ws,{type:'ready'});json(p.ws,{type:'ready'});
    }
   });
  });
 });
 server.on('close',()=>{clearInterval(heartbeat);for(const ws of wss.clients)stop(ws);wss.close();});
 return {list:()=>[...hosts.values()].map(h=>h.listing),close(){clearInterval(heartbeat);for(const ws of wss.clients)stop(ws);}};
}
