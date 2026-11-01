import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAddress,geocodeCandidates,createGeocoder} from '../geocoding.mjs';
import {createAddressController} from '../admin/address-controller.js';
const address={street:"2000 Route d’Albertville",postcode:'74320',city:'Sevrier'};
const point={lat:45.864409,lng:6.139989,label:"2000 Route d’Albertville 74320 Sevrier",score:.96,type:'housenumber'};
const feature=(changes={})=>({geometry:{type:'Point',coordinates:[point.lng,point.lat]},properties:{postcode:'74320',label:point.label,score:.96,type:'housenumber',...changes}});
test('Adresse complète validée ; saisie partielle et texte actif refusés',()=>{
 assert.deepEqual(normalizeAddress({...address,street:' 2000   Route d’Albertville '}),address);
 for(const bad of [{...address,postcode:'74'},{...address,city:''},{...address,street:'<script>x</script>'}])assert.throws(()=>normalizeAddress(bad));
});
test('Résultats géographiques contrôlés, triés et dédoublonnés',()=>{
 const out=geocodeCandidates({features:[feature(),feature(),feature({postcode:'75001'}),feature({score:.1}),{...feature(),geometry:{type:'Point',coordinates:[Infinity,45]}}]},address);
 assert.equal(out.length,1);assert.equal(out[0].lat,point.lat);assert.equal(out[0].lng,point.lng);
});
test('Service officiel fixe, cache et demandes simultanées regroupées',async()=>{
 let calls=0;const geocode=createGeocoder({fetchImpl:async url=>{calls++;assert.equal(url.origin,'https://data.geopf.fr');assert.equal(url.pathname,'/geocodage/search');assert.equal(url.searchParams.get('postcode'),'74320');return {ok:true,json:async()=>({features:[feature()]})}}});
 const [a,b]=await Promise.all([geocode({...address,url:'https://example.com'}),geocode(address)]);assert.deepEqual(a,b);await geocode(address);assert.equal(calls,1);
});
test('Service indisponible : message utile et nouvelle tentative possible',async()=>{
 let fails=true;const geocode=createGeocoder({fetchImpl:async()=>{if(fails)throw Error('network');return {ok:true,json:async()=>({features:[feature()]})}}});
 await assert.rejects(geocode(address),/connexion/);fails=false;assert.equal((await geocode(address)).length,1);
});
test('Enregistrer immédiatement attend la dernière adresse sans attendre le délai de saisie',async()=>{
 const accepted=[];let calls=0;const c=createAddressController({lookup:async a=>{calls++;return [point]},onResult:(a,p)=>accepted.push({a,p}),delay:60000});
 c.update(address);assert.equal(await c.flush(),true);assert.equal(calls,1);assert.deepEqual(accepted[0].a,address);assert.equal(c.isPending(),false);c.cancel();
});
test('Une ancienne réponse ne remplace jamais une adresse saisie plus récemment',async()=>{
 const pending=[],accepted=[];const c=createAddressController({lookup:a=>new Promise(resolve=>pending.push({a,resolve})),onResult:a=>accepted.push(a),delay:60000});
 c.update(address);const first=c.flush();await Promise.resolve();await Promise.resolve();
 const next={...address,street:'100 Route d’Albertville'};c.update(next);const second=c.flush();await Promise.resolve();await Promise.resolve();
 pending[1].resolve([{...point,label:'100 Route d’Albertville'}]);await second;pending[0].resolve([point]);await first;
 assert.deepEqual(accepted,[next]);c.cancel();
});
test('Adresse ambiguë : choix explicite ; adresse incomplète : aucune recherche',async()=>{
 let calls=0,accepted=0;const c=createAddressController({lookup:async()=>{calls++;return [point,{...point,lat:45.865,score:.94,label:'Autre adresse'}]},onResult:()=>accepted++,delay:60000});
 c.update({...address,postcode:'74'});assert.equal(await c.flush(),false);assert.equal(calls,0);
 c.update(address);assert.equal(await c.flush(),false);assert.equal(c.getState().kind,'choice');assert.equal(accepted,0);c.choose(0);assert.equal(accepted,1);assert.equal(await c.flush(),true);c.cancel();
});
test('Annuler ignore aussi une recherche encore en cours',async()=>{
 let resolve;let accepted=0;const c=createAddressController({lookup:()=>new Promise(r=>resolve=r),onResult:()=>accepted++,delay:60000});
 c.update(address);const result=c.flush();await Promise.resolve();await Promise.resolve();c.cancel();resolve([point]);await result;assert.equal(accepted,0);assert.equal(c.isPending(),false);
});

test('Position manuelle : coordonnées contrôlées et précision conservée',async()=>{
 const {normalizeMapPoint}=await import('../admin/map-position.js');
 assert.deepEqual(normalizeMapPoint({lat:45.864409123,lng:6.139989876}),{lat:45.8644091,lng:6.1399899});
 for(const bad of [{lat:NaN,lng:6},{lat:45,lng:Infinity},{lat:90,lng:6},{lat:45,lng:181},{lat:'45',lng:6}])assert.throws(()=>normalizeMapPoint(bad));
});
test('Ajuster le repère conserve l’adresse et ne modifie pas les réglages d’origine',async()=>{
 const {manualMapLocation}=await import('../admin/map-position.js');
 const settings={...address,mapLocation:{...address,...point}},original=structuredClone(settings);
 const result=manualMapLocation(settings,{lat:45.8645,lng:6.1401});
 assert.equal(result.street,address.street);assert.equal(result.city,address.city);assert.equal(result.label,point.label);assert.equal(result.manual,true);assert.equal(result.lat,45.8645);assert.equal(result.lng,6.1401);assert.deepEqual(settings,original);
});
test('Un repère peut être précisé depuis la localisation provisoire',async()=>{
 const {manualMapLocation}=await import('../admin/map-position.js');
 const result=manualMapLocation(address,{lat:45.8645,lng:6.1401});assert.equal(result.manual,true);assert.equal(result.postcode,'74320');assert.ok(result.label.includes(address.street));
});


test('Replacer après réouverture force une recherche de la même adresse',async()=>{
 const saved={...address,mapLocation:{...point,lat:45.865,lng:6.141,manual:true}};let accepted,calls=0;
 const c=createAddressController({lookup:async()=>{calls++;return [point]},onResult:(a,p)=>accepted={a,p},delay:60000});
 c.update(saved);assert.equal(await c.flush(),true);assert.equal(accepted.p.lat,point.lat);assert.equal(accepted.a.street,address.street);
 c.update(saved);assert.equal(await c.flush(),true);assert.equal(calls,2);c.cancel();
});
