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
 for(const key of ['bookingUrl','scheduleUrl','pricesUrl']){const u=d.global.settings[key];if(u&&(!/^https:\/\//i.test(u)||u.length>2000))throw Error('Les liens Eversports doivent commencer par https://.');}
 if(!/^[\w.-]*$/.test(d.global.settings.instagram))throw Error('Identifiant Instagram invalide.');
 if(d.global.settings.scheduleWidgetId&&!/^[\w-]+$/.test(d.global.settings.scheduleWidgetId))throw Error('Identifiant de widget invalide.');
 const point=d.global.settings.mapLocation;if(point&&(!Number.isFinite(point.lat)||!Number.isFinite(point.lng)||Math.abs(point.lat)>85||Math.abs(point.lng)>180||typeof point.label!=='string'||point.label.length>400))throw Error('Localisation de la carte invalide.');
 if(!/^[a-zA-Z0-9_.-]+\.css$/.test(d.global.stylesheet))throw Error('Style du site invalide.');
 return true;
}

export function renderSite(d,p,{editor=false,exported=false,nonce=''}={}){
 const base=exported?'./':'/admin/';
 const convert=s=>exported?s.replaceAll('/site/','./'):s;
 const settings=escapeHtml(JSON.stringify(d.global.settings));
 const scripts=`<script ${nonce?`nonce="${nonce}"`:""} src="/site/leaflet-1.9.4.js" defer></script><script ${nonce?`nonce="${nonce}"`:''} src="${exported?"./nuage-runtime.js":"/site/nuage-runtime.js"}" defer></script>`+(editor?`<script nonce="${nonce}" src="/admin/canvas-controls.js" defer></script><script nonce="${nonce}" src="/admin/bridge.js" defer></script>`:'');
 return convert(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(p.title)}</title><meta name="description" content="${escapeHtml(p.description)}">${d.global.settings.noindex?'<meta name="robots" content="noindex,nofollow">':''}<meta name="nuage-settings" content="${settings}"><link rel="icon" href="/site/logo-nuage-transparent.png"><link rel="stylesheet" href="/site/${d.global.stylesheet}"><link rel="stylesheet" href="/site/leaflet-1.9.4.css"><style id="cms-styles">${themeCSS(d,p)}</style>${scripts}</head><body data-editor="${editor}" data-page-id="${p.id}"><div class="site theme-immersive"><a class="skip-link" href="#main">Aller au contenu</a>${d.global.header}<main id="main">${p.html}</main>${d.global.footer}</div></body></html>`);
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
