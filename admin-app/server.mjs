import http from 'node:http';
import {readPasswordHash,hostingConfig,createAuth} from './auth.mjs';
import {createGeocoder} from './geocoding.mjs';
const geocode=createGeocoder();
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile,rename,mkdir,readdir,stat,copyFile} from 'node:fs/promises';
import {randomBytes,createHash} from 'node:crypto';
import {validateDocument,zipFiles} from './server-core.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
let rendererVersion='',renderer;
async function renderDocument(doc,page,options={}){const version=String((await stat(path.join(root,'server-core.mjs'))).mtimeMs);if(version!==rendererVersion){renderer=(await import('./server-core.mjs?v='+version)).renderSite;rendererVersion=version}return renderer(doc,page,options)}
const hosting=hostingConfig(),{port}=hosting;
const auth=createAuth({passwordHash:await readPasswordHash(root),secure:hosting.secure,cookieName:hosting.secure?'__Host-nuage_session':'nuage_session_'+port});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.avif':'image/avif','.woff2':'font/woff2','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.xml':'application/xml','.ico':'image/x-icon','.webmanifest':'application/manifest+json; charset=utf-8'};
await mkdir(path.join(root,'data/revisions'),{recursive:true});await mkdir(path.join(root,'site/uploads'),{recursive:true});
for(const name of ['initial.json','draft.json','live.json']){try{await readFile(path.join(root,'data',name))}catch(e){if(e.code!=='ENOENT')throw e;const seed=await readFile(path.join(root,'seed/site.json'));await writeFile(path.join(root,'data',name),seed,{flag:'wx'})}}
let draft=JSON.parse(await readFile(path.join(root,'data/draft.json'),'utf8'));
let live=JSON.parse(await readFile(path.join(root,'data/live.json'),'utf8'));
let lock=Promise.resolve();
const readJSON=async(req,limit=24*1024*1024)=>{let size=0,bufs=[];for await(const b of req){size+=b.length;if(size>limit)throw Object.assign(Error('Fichier trop volumineux (15 Mo maximum par image).'),{status:413});bufs.push(b)}return JSON.parse(Buffer.concat(bufs).toString('utf8')||'{}')};
async function atomic(name,value){let f=path.join(root,'data',name);await writeFile(f+'.tmp',JSON.stringify(value,null,2));await rename(f+'.tmp',f)}
async function save(doc){validateDocument(doc);doc.revision=draft.revision+1;doc.savedAt=new Date().toISOString();await atomic('draft.json',doc);await atomic('revisions/'+String(doc.revision).padStart(7,'0')+'.json',doc);draft=doc;return draft}
async function filesUnder(dir,prefix=''){const a=[];for(const e of await readdir(dir,{withFileTypes:true})){if(e.name.startsWith('.'))continue;const name=prefix+e.name;if(e.isDirectory())a.push(...await filesUnder(path.join(dir,e.name),name+'/'));else a.push({name,data:await readFile(path.join(dir,e.name))})}return a}
const send=(res,status,data,type='application/json; charset=utf-8',extra={})=>{res.writeHead(status,{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff',...extra});res.end(type.includes('json')?JSON.stringify(data):data)};
const error=(res,e)=>send(res,e.status||400,{error:e.message||'Une erreur est survenue.'});
const server=http.createServer(async(req,res)=>{
 const host=req.headers.host;
 if(!hosting.hosts.has(host))return send(res,403,{error:'Accès local uniquement.'});
 const url=new URL(req.url,hosting.origin); const nonce=randomBytes(18).toString('base64');
 res.setHeader('Content-Security-Policy',`default-src 'self'; script-src 'nonce-${nonce}' https://widget-static.eversports.io; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; frame-src 'self' https://*.eversports.io https://*.eversports.fr; connect-src 'self' https://*.eversports.io https://*.eversports.fr; object-src 'none'; base-uri 'none'; frame-ancestors 'self'`);
 res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','SAMEORIGIN');if(hosting.secure)res.setHeader('Strict-Transport-Security','max-age=15552000');
 const session=auth.session(req);
 const adminPath=url.pathname==='/'||url.pathname==='/admin'||url.pathname.startsWith('/admin/');
 const loginAsset=['/admin/login.js','/admin/login.css'].includes(url.pathname);
 const apiPath=url.pathname.startsWith('/api/');
 if(!session&&((adminPath&&!loginAsset)||url.pathname.startsWith('/preview/')||(apiPath&&url.pathname!=='/api/login'))){
  if(req.method==='GET'&&['/','/admin','/admin/'].includes(url.pathname)){res.writeHead(303,{location:'/login','cache-control':'no-store'});return res.end()}
  return send(res,401,{error:'Connectez-vous pour ouvrir l’administration.'});
 }
 try{
  if(url.pathname==='/favicon.ico'&&req.method==='GET')return send(res,200,await readFile(path.join(root,'site/favicon.ico')),'image/x-icon');
  if(url.pathname==='/login'&&req.method==='GET'){let html=await readFile(path.join(root,'admin/login.html'),'utf8');return send(res,200,html.replaceAll('__NONCE__',nonce),'text/html; charset=utf-8')}
  if(url.pathname.startsWith('/api/')){
   if((req.headers.origin&&!hosting.origins.has(req.headers.origin))||req.headers['sec-fetch-site']==='cross-site')return send(res,403,{error:'Origine refusée.'});
   if(req.method==='POST'&&url.pathname==='/api/login'){const body=await readJSON(req,8192);const result=await auth.login(body.password,req.socket.remoteAddress);if(!result.ok)return send(res,result.status,{error:result.error},undefined,result.status===429?{'retry-after':'900'}:{});return send(res,200,{ok:true},undefined,{'set-cookie':result.cookie})}
   if(req.method!=='GET'&&req.headers['x-nuage-token']!==session?.csrf)return send(res,403,{error:'Rechargez le panel pour reprendre votre session.'});
   if(req.method==='POST'&&url.pathname==='/api/logout')return send(res,200,{ok:true},undefined,{'set-cookie':auth.logout(req)});
   if(req.method==='POST'&&url.pathname==='/api/geocode'){const value=await readJSON(req);return send(res,200,{candidates:await geocode(value)});}
   if(req.method==='GET'&&url.pathname==='/api/state')return send(res,200,{document:draft,liveAt:live.savedAt,token:session.csrf});
   if(req.method==='GET'&&url.pathname==='/api/revisions'){
    const names=(await readdir(path.join(root,'data/revisions'))).filter(n=>/^\d+\.json$/.test(n)).sort().reverse();
    const items=[];for(const n of names.slice(0,100)){const d=JSON.parse(await readFile(path.join(root,'data/revisions',n),'utf8'));items.push({revision:d.revision,date:d.savedAt,pages:d.pages.length})}return send(res,200,items);
   }
   if(req.method==='GET'&&url.pathname==='/api/media'){
    const files=await filesUnder(path.join(root,'site'));return send(res,200,files.filter(f=>/\.(png|jpe?g|webp|gif|avif|svg)$/i.test(f.name)).map(f=>({name:path.basename(f.name),url:'/site/'+f.name,size:f.data.length})));
   }
   if(req.method==='POST'&&url.pathname==='/api/save'){
    const body=await readJSON(req);
    const job=lock.then(async()=>{if(body.document.revision!==draft.revision)throw Error('Une autre fenêtre a enregistré des changements. Exportez votre travail puis rechargez le panel.');return await save(body.document)});lock=job.catch(()=>{});
    return send(res,200,{document:await job});
   }
   if(req.method==='POST'&&url.pathname==='/api/apply'){
    const body=await readJSON(req);const job=lock.then(async()=>{if(body.revision!==draft.revision)throw Error('Enregistrez les dernières modifications avant de les appliquer.');live=structuredClone(draft);await atomic('live.json',live);return live.savedAt});lock=job.catch(()=>{});return send(res,200,{liveAt:await job});
   }
   if(req.method==='POST'&&url.pathname==='/api/restore'){
    const body=await readJSON(req);if(!Number.isInteger(body.revision)||body.revision<1)throw Error('Sauvegarde invalide.');
    const job=lock.then(async()=>save(JSON.parse(await readFile(path.join(root,'data/revisions',String(body.revision).padStart(7,'0')+'.json'),'utf8'))));lock=job.catch(()=>{});return send(res,200,{document:await job});
   }
   if(req.method==='POST'&&url.pathname==='/api/upload'){
    const body=await readJSON(req),m=String(body.data||'').match(/^data:image\/(png|jpeg|webp|gif|avif);base64,([A-Za-z0-9+/=]+)$/);if(!m)throw Error('Formats acceptés : PNG, JPG, WebP, GIF et AVIF.');const b=Buffer.from(m[2],'base64');if(b.length>15*1024*1024)throw Error('L’image dépasse 15 Mo.');
    const valid=m[1]==='png'?b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):m[1]==='jpeg'?b[0]===255&&b[1]===216:m[1]==='webp'?b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP':m[1]==='gif'?b.toString('ascii',0,3)==='GIF':b.toString('ascii',4,8)==='ftyp'&&/avif|avis/.test(b.toString('ascii',8,32));if(!valid)throw Error('Le contenu ne correspond pas au format de l’image.');
    const name=String(body.name||'image').replace(/\.[^.]*$/,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9-]/g,'-').slice(0,55)||'image';const file=name+'-'+createHash('sha256').update(b).digest('hex').slice(0,10)+'.'+(m[1]==='jpeg'?'jpg':m[1]);await writeFile(path.join(root,'site/uploads',file),b);return send(res,200,{url:'/site/uploads/'+file,name:file,size:b.length});
   }
   if(req.method==='POST'&&url.pathname==='/api/export'){
    const body=await readJSON(req),doc=body.document||draft;validateDocument(doc);const files=(await filesUnder(path.join(root,'site'))).filter(f=>!f.name.endsWith('.html')&&!/^index-.*\.js$/.test(f.name)&&!['README.md','sitemap.xml','robots.txt'].includes(f.name));
    for(const f of files)if(f.name.endsWith('.css'))f.data=Buffer.from(f.data.toString().replaceAll('/studio-nuage2/','./').replaceAll('/site/','./'));
    files.push({name:'nuage-runtime.js',data:await readFile(path.join(root,'admin/runtime.js'))});
    for(const p of doc.pages)files.push({name:p.path==='/site/'?'index.html':p.path.slice(6),data:Buffer.from(await renderDocument(doc,p,{exported:true}))});
    files.push({name:'robots.txt',data:Buffer.from(doc.global.settings.noindex?'User-agent: *\nDisallow: /\n':'User-agent: *\nAllow: /\n')});
    files.push({name:'LISEZ-MOI.txt',data:Buffer.from('Export statique de Nuage Studio. Aucun panel, brouillon ou historique inclus. Aucun envoi vers GitHub effectué.\n')});
    return send(res,200,zipFiles(files),'application/zip',{'content-disposition':'attachment; filename="nuage-site-local.zip"'});
   }
   return send(res,404,{error:'Action inconnue.'});
  }
  if(!['GET','HEAD'].includes(req.method))return send(res,405,{error:'Méthode refusée.'});
  if(url.pathname==='/'||url.pathname==='/admin'||url.pathname==='/admin/'){
   let html=await readFile(path.join(root,'admin/index.html'),'utf8');html=html.replaceAll('__NONCE__',nonce);return send(res,200,html,'text/html; charset=utf-8');
  }
  if(url.pathname.startsWith('/preview/')){
   const p=url.pathname==='/preview/'?draft.pages[0]:draft.pages.find(p=>p.id===url.pathname.slice(9));if(!p)return send(res,404,'Page introuvable','text/plain');return send(res,200,await renderDocument(draft,p,{editor:true,nonce,origin:hosting.origin}),'text/html; charset=utf-8');
  }
  const page=live.pages.find(p=>p.path===(url.pathname==='/site/index.html'?'/site/':url.pathname));
  if(page)return send(res,200,await renderDocument(live,page,{nonce,origin:hosting.origin}),'text/html; charset=utf-8');
  if(url.pathname.startsWith('/site/')&&/\.html$/i.test(url.pathname))return send(res,404,'Cette page n’existe plus.','text/plain');
  if(url.pathname.startsWith('/admin/')||url.pathname.startsWith('/site/')){
   const base=path.join(root,url.pathname.startsWith('/admin/')?'admin':'site');const rel=decodeURIComponent(url.pathname).slice(7-(url.pathname.startsWith('/site/')?1:0));const f=path.resolve(base,rel);if(!f.startsWith(base+path.sep))return send(res,403,{error:'Chemin refusé.'});
   try{return send(res,200,await readFile(f),mime[path.extname(f)]||'application/octet-stream')}catch{return send(res,404,'Fichier introuvable','text/plain')}
  }
  return send(res,404,'Page introuvable','text/plain');
 }catch(e){error(res,e)}
});
server.listen(port,hosting.host,()=>console.log(`Nuage Atelier — ${hosting.origin}/admin/\nSite — ${hosting.origin}/site/`));
