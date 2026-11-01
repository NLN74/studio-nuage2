import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {validateDocument} from '../server-core.mjs';
const source=await readFile(new URL('../admin/runtime.js',import.meta.url),'utf8');
function preview(settings){
 const a=(href,key)=>({href,dataset:key?{eversportsLink:key}:{},getAttribute(name){return this[name]}});
 const booking=a('/site/planning.html#reservation','booking'),price=a('/site/planning.html#reservation','prices'),navigation=a('/site/planning.html'),profile=a('https://example.com/studio','profile'),app=a('https://example.com/app','app');
 const reservation={replaced:false,children:[],replaceChildren(){this.replaced=true;this.children=[]},append(e){this.children.push(e)}};
 const scripts=[];
 const document={body:{dataset:{editor:'false'}},head:{append(e){scripts.push(e)}},createElement(){return{dataset:{}}},querySelector(selector){if(selector==='meta[name="nuage-settings"]')return{content:JSON.stringify(settings)};if(selector==='.eversports-section')return reservation;return null},querySelectorAll(selector){if(selector==='a[href]')return[booking,price,navigation,profile,app];if(selector==='[data-eversports-link]')return[booking,price,profile,app];if(selector==='.pricing-grid a.button')return[price];return[]}};
 vm.runInNewContext(source,{document,window:{},URL});return{booking,price,navigation,profile,app,reservation,scripts};
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
