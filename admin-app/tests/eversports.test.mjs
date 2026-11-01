import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {validateDocument,renderSite} from '../server-core.mjs';
import {widgetIdFrom} from '../admin/eversports.js';
const source=await readFile(new URL('../admin/runtime.js',import.meta.url),'utf8');
function preview(settings,{catalogue=false,editor=false,siteBase='/site/'}={}){
 const a=(href,key)=>({href,dataset:key?{eversportsLink:key}:{},getAttribute(name){return this[name]},removeAttribute(name){delete this[name]}});
 const booking=a('/site/planning.html#reservation','booking'),price=a('/site/planning.html#reservation','prices'),navigation=a('/site/planning.html'),profile=a('https://example.com/studio','profile'),app=a('https://example.com/app','app');
 const reservation={replaced:false,children:[],replaceChildren(){this.replaced=true;this.children=[]},append(e){this.children.push(e)}};
 const scripts=[],slot={dataset:{},attributes:{},children:[],setAttribute(k,v){this.attributes[k]=v},replaceChildren(...children){this.children=children}};
 const document={body:{dataset:{editor:String(editor),siteBase}},head:{append(e){scripts.push(e)}},createElement(){return{dataset:{}}},querySelector(selector){if(selector==='meta[name="nuage-settings"]')return{content:JSON.stringify(settings)};if(selector==='.eversports-section')return reservation;if(selector==='[data-eversports-prices-slot]')return catalogue?slot:null;return null},querySelectorAll(selector){if(selector==='a[href]')return[booking,price,navigation,profile,app];if(selector==='[data-eversports-link]')return[booking,price,profile,app];if(selector==='.pricing-grid a.button')return[price];return[]}};
 vm.runInNewContext(source,{document,window:{},URL});return{booking,price,navigation,profile,app,reservation,scripts,slot};
}
test('Les réservations, tarifs, profil et application sont reliés sans activer le planning',()=>{
 const s={bookingUrl:'https://example.com/widget',pricesUrl:'https://example.com/prix',profileUrl:'https://example.com/profil',appUrl:'https://example.com/application',scheduleUrl:'https://example.com/planning',scheduleWidgetId:'widget-exemple',scheduleEnabled:false};
 const result=preview(s);
 assert.equal(result.booking.href,s.bookingUrl);assert.equal(result.price.href,s.pricesUrl);assert.equal(result.profile.href,s.profileUrl);assert.equal(result.app.href,s.appUrl);assert.equal(result.navigation.href,'/site/planning.html');assert.equal(result.reservation.replaced,false);assert.equal(result.scripts.length,0);
 for(const link of [result.booking,result.price,result.profile,result.app]){assert.equal(link.target,'_blank');assert.equal(link.rel,'noopener noreferrer')}
});
test('Le planning reste activable explicitement et compatible avec les anciens réglages',()=>{
 for(const scheduleEnabled of [true,undefined]){const result=preview({scheduleEnabled,scheduleUrl:'https://example.com/planning'});assert.equal(result.reservation.replaced,true);assert.equal(result.reservation.children[0].href,'https://example.com/planning')}
});
test('Une URL active ou contenant des identifiants ne remplace jamais une destination publique',()=>{
 for(const url of ['javascript:alert(1)','http://example.com','https://user:password@example.com']){const result=preview({bookingUrl:url,pricesUrl:url,profileUrl:url,appUrl:url,scheduleEnabled:false});assert.equal(result.booking.href,'/site/planning.html#reservation');assert.equal(result.price.href,'/site/planning.html#reservation');assert.equal(result.profile.href,'https://example.com/studio');assert.equal(result.app.href,'https://example.com/app')}
});
test('Les nouveaux réglages sont validés et le planning est en attente dans la version de départ',async()=>{
 const doc=JSON.parse(await readFile(new URL('../seed/site.json',import.meta.url),'utf8'));assert.equal(validateDocument(doc),true);assert.equal(doc.global.settings.scheduleEnabled,false);
 const bad=structuredClone(doc);bad.global.settings.appUrl='javascript:alert(1)';assert.throws(()=>validateDocument(bad));bad.global.settings.appUrl='';bad.global.settings.scheduleEnabled='false';assert.throws(()=>validateDocument(bad));
});
test('Une seule case met toutes les destinations en attente, sans charger Eversports',()=>{
 const result=preview({inProgress:true,bookingUrl:'https://example.com/widget',pricesUrl:'https://example.com/prix',profileUrl:'https://example.com/profil',appUrl:'https://example.com/app',scheduleEnabled:true,scheduleWidgetId:'planning-id',pricesWidgetId:'tarifs-id'},{catalogue:true});
 for(const link of [result.booking,result.price,result.profile,result.app]){assert.equal(link.href,'/site/planning.html#reservation');assert.equal(link.target,undefined)}assert.equal(result.scripts.length,0);assert.equal(result.reservation.replaced,false);
 const exported=preview({inProgress:true},{siteBase:'./'});assert.equal(exported.booking.href,'./planning.html#reservation');
});
test('Décocher le mode d’attente rétablit le planning et le catalogue avec un seul chargeur',async()=>{
 const result=preview({inProgress:false,scheduleEnabled:false,scheduleWidgetId:'planning-id',pricesWidgetId:'tarifs-id',pricesUrl:'https://example.com/prix'},{catalogue:true});
 assert.equal(result.reservation.replaced,true);assert.equal(result.slot.children[0].dataset.eversportsWidgetId,'tarifs-id');assert.equal(result.scripts.length,1);assert.equal(result.scripts[0].src,'https://widget-static.eversports.io/loader.js');assert.equal(result.price.href,'#formules-eversports');assert.equal(result.price.target,undefined);
 result.scripts[0].onload();await Promise.resolve();assert.equal(result.slot.dataset.widgetStatus,'ready');
});
test('Une panne du chargeur conserve un message utile et les liens de secours',async()=>{
 const result=preview({inProgress:false,pricesWidgetId:'tarifs-id',pricesUrl:'https://example.com/prix'},{catalogue:true});result.scripts[0].onerror();await Promise.resolve();await Promise.resolve();assert.equal(result.slot.dataset.widgetStatus,'error');assert.match(result.slot.children[0].textContent,/ouvrir sur Eversports/);assert.equal(result.profile.href,'https://example.com/studio');
});
test('Le panneau ne charge pas de formulaire de paiement dans le contenu éditable',()=>{
 const result=preview({inProgress:false,pricesWidgetId:'tarifs-id'},{catalogue:true,editor:true});assert.equal(result.scripts.length,0);assert.equal(result.slot.children.length,0);
});
test('Le code collé est réduit à son identifiant ; le HTML actif ne devient jamais du contenu',()=>{
 const id='2a6287d7-6040-4a83-8cdd-59a7c0b75b3e';assert.equal(widgetIdFrom(`<div data-eversports-widget-id="${id}"></div><script src="https://example.com/unwanted.js"></script>`),id);assert.equal(widgetIdFrom(id),id);assert.equal(widgetIdFrom(''),'');assert.throws(()=>widgetIdFrom('<script>alert(1)</script>'));
});
test('Le rendu et l’export gardent un mode d’attente cohérent dès le premier affichage',async()=>{
 const doc=JSON.parse(await readFile(new URL('../seed/site.json',import.meta.url),'utf8')),page=doc.pages.find(p=>p.id==='tarifs');assert.match(renderSite(doc,page),/data-in-progress="true"/);assert.match(renderSite(doc,page,{exported:true}),/data-site-base="\.\/"/);assert.ok(page.html.includes('data-eversports-live-only'));const active=structuredClone(doc);active.global.settings.inProgress=false;assert.match(renderSite(active,page),/data-in-progress="false"/);
});
