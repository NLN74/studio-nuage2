import test from 'node:test';
import assert from 'node:assert/strict';
import {hashPassword,verifyPassword,validHash,createAuth,hostingConfig} from '../auth.mjs';
import {mkdtemp,cp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const password='Phrase pour tester la connexion',hash=await hashPassword(password);
test('Empreinte salée ; aucune comparaison ou conservation du mot de passe en clair',async()=>{
 assert.ok(validHash(hash));assert.ok(!hash.includes(password));assert.equal(await verifyPassword(password,hash),true);assert.equal(await verifyPassword('incorrect',hash),false);assert.equal(await verifyPassword({},hash),false);assert.equal(await verifyPassword(password,'bad'),false);assert.notEqual(await hashPassword(password),hash);
});
test('Session privée, jeton distinct, expiration et déconnexion',async()=>{
 let clock=1000;const auth=createAuth({passwordHash:hash,secure:true,now:()=>clock,maxAge:1000});
 const first=await auth.login(password);assert.match(first.cookie,/HttpOnly/);assert.match(first.cookie,/Secure/);assert.match(first.cookie,/SameSite=Lax/);const req={headers:{cookie:first.cookie.split(';')[0]}};assert.equal(auth.session(req).csrf,first.session.csrf);
 const second=await auth.login(password);assert.notEqual(first.session.csrf,second.session.csrf);auth.logout(req);assert.equal(auth.session(req),null);clock=2001;assert.equal(auth.session({headers:{cookie:second.cookie.split(';')[0]}}),null);
});
test('Tentatives de connexion limitées',async()=>{
 let clock=0;const auth=createAuth({passwordHash:hash,now:()=>clock,maxAttempts:2,attemptWindow:1000});
 assert.equal((await auth.login('incorrect','ip')).status,401);assert.equal((await auth.login('incorrect','ip')).status,401);assert.equal((await auth.login(password,'ip')).status,429);clock=1001;assert.equal((await auth.login(password,'ip')).ok,true);
});
test('Hébergement distant : HTTPS et domaine explicites obligatoires',()=>{
 assert.equal(hostingConfig({}).host,'127.0.0.1');assert.throws(()=>hostingConfig({HOST:'0.0.0.0'}));assert.throws(()=>hostingConfig({HOST:'0.0.0.0',PUBLIC_ORIGIN:'http://example.org'}));const c=hostingConfig({HOST:'0.0.0.0',PUBLIC_ORIGIN:'https://admin.example.org'});assert.equal(c.secure,true);assert.ok(c.hosts.has('admin.example.org'));assert.throws(()=>hostingConfig({PUBLIC_ORIGIN:'https://example.org/path'}));
});
test('HTTP : données privées derrière la connexion, API protégée, sortie et redémarrage',async()=>{
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=await mkdtemp(path.join(tmpdir(),'nuage-auth-'));
 await cp(root,dir,{recursive:true,filter:s=>!s.includes('/data')&&!s.includes('/exports')&&!s.includes('/tests')&&!s.endsWith('/.local-access.json')});
 let child;const base='http://127.0.0.1:4382';
 const start=async()=>{child=spawn(process.execPath,['server.mjs'],{cwd:dir,env:{...process.env,PORT:'4382',HOST:'127.0.0.1',PUBLIC_ORIGIN:'',NUAGE_ADMIN_PASSWORD_HASH:hash},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',c=>reject(Error('Serveur arrêté '+c)))});};
 const stop=async()=>{if(child?.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r))}};
 const login=(pw=password,extra={})=>fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json',...extra},body:JSON.stringify({password:pw})});
 try{
  await start();for(const route of ['/api/state','/api/media','/api/revisions','/preview/index','/admin/admin.js'])assert.equal((await fetch(base+route)).status,401,route);
  assert.equal((await fetch(base+'/admin/',{redirect:'manual'})).status,303);assert.equal((await fetch(base+'/site/')).status,200);assert.equal((await fetch(base+'/.local-access.json')).status,404);assert.equal((await fetch(base+'/login')).status,200);
  assert.equal((await login('incorrect')).status,401);assert.equal((await login(password,{origin:'https://elsewhere.test'})).status,403);
  const result=await login();assert.equal(result.status,200);const cookie=result.headers.get('set-cookie').split(';')[0],headers={cookie};const state=await(await fetch(base+'/api/state',{headers})).json();assert.ok(state.token);
  assert.equal((await fetch(base+'/api/save',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({document:state.document})})).status,403);
  assert.equal((await fetch(base+'/api/logout',{method:'POST',headers:{cookie,'x-nuage-token':state.token}})).status,200);assert.equal((await fetch(base+'/api/state',{headers})).status,401);
  const next=await login(),secondCookie=next.headers.get('set-cookie').split(';')[0];await stop();await start();assert.equal((await fetch(base+'/api/state',{headers:{cookie:secondCookie}})).status,401);
 }finally{await stop();await rm(dir,{recursive:true,force:true})}
});
