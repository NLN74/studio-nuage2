import {randomBytes,scrypt,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const derive=promisify(scrypt),options={N:65536,r:8,p:2,maxmem:128*1024*1024};
export async function hashPassword(password){
 if(typeof password!=='string'||password.length<10||password.length>1024)throw Error('Choisissez un mot de passe de 10 caractères minimum.');
 const salt=randomBytes(16).toString('hex'),key=await derive(password,salt,64,options);
 return `scrypt-v1:${salt}:${key.toString('hex')}`;
}
export const validHash=value=>typeof value==='string'&&/^scrypt-v1:[a-f0-9]{32}:[a-f0-9]{128}$/.test(value);
export async function verifyPassword(password,hash){
 if(typeof password!=='string'||password.length>1024||!validHash(hash))return false;
 const [,salt,expected]=hash.split(':'),key=await derive(password,salt,64,options);
 return timingSafeEqual(key,Buffer.from(expected,'hex'));
}
export async function readPasswordHash(root){
 let hash=process.env.NUAGE_ADMIN_PASSWORD_HASH;
 if(!hash){try{hash=JSON.parse(await readFile(path.join(root,'.local-access.json'),'utf8')).passwordHash}catch{}}
 if(!validHash(hash))throw Error('Accès non configuré. Lancez « npm run password » ou définissez NUAGE_ADMIN_PASSWORD_HASH.');
 return hash;
}
export function hostingConfig(env=process.env){
 const host=env.HOST||'127.0.0.1',port=Number(env.PORT||4380),loopback=['127.0.0.1','localhost','::1'].includes(host);
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Port invalide.');
 let origin;
 if(env.PUBLIC_ORIGIN){const u=new URL(env.PUBLIC_ORIGIN);if(u.username||u.password||u.pathname!=='/'||u.search||u.hash||!['http:','https:'].includes(u.protocol))throw Error('PUBLIC_ORIGIN doit être une origine complète sans chemin.');origin=u.origin;}
 if(!loopback&&(!origin||!origin.startsWith('https://')))throw Error('Un hébergement distant exige PUBLIC_ORIGIN en https://.');
 const origins=new Set(origin?[origin]:[`http://127.0.0.1:${port}`,`http://localhost:${port}`]);
 return {host,port,origins,hosts:new Set([...origins].map(o=>new URL(o).host)),secure:!!origin?.startsWith('https://'),origin:origin||`http://127.0.0.1:${port}`};
}
export function createAuth({passwordHash,secure=false,now=Date.now,maxAge=8*3600000,maxAttempts=5,attemptWindow=15*60000,cookieName=secure?'__Host-nuage_session':'nuage_session'}){
 if(!validHash(passwordHash))throw Error('Empreinte de mot de passe invalide.');
 const sessions=new Map(),attempts=new Map();let active=0;
 const key=value=>createHash('sha256').update(value).digest('hex');
 const cookieId=req=>{const raw=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';return /^[a-f0-9]{64}$/.test(raw)?key(raw):''};
 const cookie=(id,age)=>`${cookieName}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure?'; Secure':''}`;
 function prune(){for(const[k,s]of sessions)if(s.expires<=now())sessions.delete(k);for(const[k,a]of attempts)if(a.until<=now())attempts.delete(k)}
 return {
  session(req){const id=cookieId(req),s=sessions.get(id);if(!s||s.expires<=now()){sessions.delete(id);return null}return s},
  async login(password,ip='local'){
   prune();const a=attempts.get(ip);
   if((a?.count||0)>=maxAttempts||active>=2)return {ok:false,status:429,error:'Trop de tentatives. Réessayez plus tard.'};
   if(attempts.size>10000)attempts.delete(attempts.keys().next().value);
   attempts.set(ip,{count:(a?.count||0)+1,until:a?.until||now()+attemptWindow});active++;
   let ok=false;try{ok=await verifyPassword(password,passwordHash)}finally{active--}
   if(!ok)return {ok:false,status:401,error:'Mot de passe incorrect.'};
   attempts.delete(ip);const id=randomBytes(32).toString('hex'),session={csrf:randomBytes(32).toString('hex'),expires:now()+maxAge};
   sessions.set(key(id),session);if(sessions.size>100)sessions.delete(sessions.keys().next().value);
   return {ok:true,session,cookie:cookie(id,Math.floor(maxAge/1000))};
  },
  logout(req){sessions.delete(cookieId(req));return cookie('',0)}
 };
}
