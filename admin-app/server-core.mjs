import {themeCSS} from './admin/shared.js';
export {themeCSS} from './admin/shared.js';
export const escapeHtml=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function validateDocument(d){
 if(!d||d.version!==1||!Array.isArray(d.pages)||!d.pages.length||d.pages.length>60||!d.global?.settings||!d.global?.theme)throw Error('Document de site invalide.');
 if(!d.pages.some(p=>p.path==='/site/'))throw Error('Une page d’accueil est nécessaire.');
 const ids=new Set(),paths=new Set();
 for(const p of d.pages){if(!/^[a-z0-9-]+$/.test(p.id)||!/^\/site\/(?:[a-z0-9-]+\.html)?$/.test(p.path)||ids.has(p.id)||paths.has(p.path))throw Error('Identifiants ou adresses de pages invalides ou en double.');ids.add(p.id);paths.add(p.path);if(typeof p.html!=='string'||typeof p.title!=='string'||typeof p.name!=='string')throw Error('Contenu de page invalide.');}
 for(const html of [d.global.header,d.global.footer,...d.pages.map(p=>p.html)]){
  if(typeof html!=='string'||html.length>2e6||/<\s*(script|iframe|object|embed|base|meta|link|form)\b|\son[a-z]+\s*=|(?:javascript|vbscript)\s*:|srcdoc\s*=/i.test(html))throw Error('Ce contenu contient du code actif non autorisé. Utilisez les réglages dédiés pour Eversports.');
 }
 for(const css of [d.global.css,...d.pages.map(p=>p.css)])if(typeof css!=='string'||/<\/style|@import|expression\s*\(/i.test(css)||css.length>100000)throw Error('Feuille de style invalide.');
 for(const key of ['bookingUrl','scheduleUrl','pricesUrl','profileUrl','appUrl']){const u=d.global.settings[key];if(u&&(!/^https:\/\//i.test(u)||u.length>2000))throw Error('Les liens Eversports doivent commencer par https://.');}
 if(d.global.settings.scheduleEnabled!==undefined&&typeof d.global.settings.scheduleEnabled!=='boolean')throw Error('Le réglage du planning doit être activé ou désactivé.');
 if(!/^[\w.-]*$/.test(d.global.settings.instagram))throw Error('Identifiant Instagram invalide.');
 if(d.global.settings.scheduleWidgetId&&!/^[\w-]+$/.test(d.global.settings.scheduleWidgetId))throw Error('Identifiant de widget invalide.');
 const point=d.global.settings.mapLocation;if(point&&(!Number.isFinite(point.lat)||!Number.isFinite(point.lng)||Math.abs(point.lat)>85||Math.abs(point.lng)>180||typeof point.label!=='string'||point.label.length>400))throw Error('Localisation de la carte invalide.');
 if(!/^[a-zA-Z0-9_.-]+\.css$/.test(d.global.stylesheet))throw Error('Style du site invalide.');
 return true;
}

export function siteMetadata(d,p,{origin='',exported=false}={}){
 const asset=exported?'./':'/site/';
 const fallback='https://nln74.github.io/studio-nuage2/';
 let base;try{base=new URL(origin||d.global.settings.publicSiteUrl||fallback);if(!/^https?:$/.test(base.protocol)||base.username||base.password)throw Error();base.search='';base.hash='';if(!base.pathname.endsWith('/'))base.pathname+='/' }catch{base=new URL(fallback)}
 const pageUrl=origin&&!exported?new URL(p.path,base).href:new URL(p.path==='/site/'?'./':p.path.slice(6),base).href;
 const imageUrl=origin&&!exported?new URL('/site/social-preview.jpg',base).href:new URL('social-preview.jpg',base).href;
 const description=p.description||'Pilates, barre et sculpt à Sevrier, près du lac d’Annecy.';
 const meta=(name,value,property=false)=>`<meta ${property?'property':'name'}="${name}" content="${escapeHtml(value)}">`;
 return `<link rel="icon" href="${asset}favicon.svg" type="image/svg+xml"><link rel="icon" href="${asset}favicon-32.png" type="image/png" sizes="32x32"><link rel="icon" href="${asset}favicon-96.png" type="image/png" sizes="96x96"><link rel="shortcut icon" href="${asset}favicon.ico"><link rel="apple-touch-icon" href="${asset}apple-touch-icon.png" sizes="180x180"><link rel="mask-icon" href="${asset}safari-pinned-tab.svg" color="#111111"><link rel="manifest" href="${asset}site.webmanifest"><link rel="canonical" href="${escapeHtml(pageUrl)}">`+
 meta('theme-color','#111111')+meta('application-name','Nuage Studio')+meta('apple-mobile-web-app-title','Nuage')+meta('apple-mobile-web-app-capable','yes')+meta('apple-mobile-web-app-statusbar-style','black')+meta('msapplication-TileColor','#111111')+meta('msapplication-config',asset+'browserconfig.xml')+
 meta('og:type','website',true)+meta('og:locale','fr_FR',true)+meta('og:site_name','Nuage Studio',true)+meta('og:title',p.title,true)+meta('og:description',description,true)+meta('og:url',pageUrl,true)+meta('og:image',imageUrl,true)+(imageUrl.startsWith('https:')?meta('og:image:secure_url',imageUrl,true):'')+meta('og:image:type','image/jpeg',true)+meta('og:image:width','1200',true)+meta('og:image:height','630',true)+meta('og:image:alt','Nuage Studio — La culture du corps. Pilates, barre et sculpt à Sevrier.',true)+
 meta('twitter:card','summary_large_image')+meta('twitter:title',p.title)+meta('twitter:description',description)+meta('twitter:image',imageUrl)+meta('twitter:image:alt','Nuage Studio — Pilates, barre et sculpt à Sevrier.');
}
export function renderSite(d,p,{editor=false,exported=false,nonce='',origin=''}={}){
 const base=exported?'./':'/admin/';
 const convert=s=>exported?s.replaceAll('/site/','./'):s;
 const settings=escapeHtml(JSON.stringify(d.global.settings));
 const scripts=`<script ${nonce?`nonce="${nonce}"`:""} src="/site/leaflet-1.9.4.js" defer></script><script ${nonce?`nonce="${nonce}"`:''} src="${exported?"./nuage-runtime.js":"/site/nuage-runtime.js"}" defer></script>`+(editor?`<script nonce="${nonce}" src="/admin/canvas-controls.js" defer></script><script nonce="${nonce}" src="/admin/bridge.js" defer></script>`:'');
 return convert(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(p.title)}</title><meta name="description" content="${escapeHtml(p.description)}">${d.global.settings.noindex?'<meta name="robots" content="noindex,nofollow">':''}<meta name="nuage-settings" content="${settings}">${siteMetadata(d,p,{origin,exported})}<link rel="stylesheet" href="/site/${d.global.stylesheet}"><link rel="stylesheet" href="/site/leaflet-1.9.4.css"><style id="cms-styles">${themeCSS(d,p)}</style>${scripts}</head><body data-editor="${editor}" data-page-id="${p.id}"><div class="site theme-immersive"><a class="skip-link" href="#main">Aller au contenu</a>${d.global.header}<main id="main">${p.html}</main>${d.global.footer}</div></body></html>`);
}
const table=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
function crc32(b){let c=0xffffffff;for(const x of b)c=table[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0}
export function zipFiles(files){
 const chunks=[],central=[];let offset=0;
 for(const f of files){const name=Buffer.from(f.name),data=Buffer.from(f.data);const crc=crc32(data);const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);h.writeUInt32LE(crc,14);h.writeUInt32LE(data.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(name.length,26);chunks.push(h,name,data);
 const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt32LE(crc,16);c.writeUInt32LE(data.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(offset,42);central.push(c,name);offset+=h.length+name.length+data.length;
 }
 const size=central.reduce((n,b)=>n+b.length,0),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(size,12);end.writeUInt32LE(offset,16);return Buffer.concat([...chunks,...central,end]);
}
