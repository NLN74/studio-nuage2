import test from 'node:test';
import assert from 'node:assert/strict';
import {demoCoaches,coachCard,coachPage,coachesSection} from '../admin/coaches.js';
import {mapLinks,staticTiles,mapBoxMarkup} from '../admin/map-links.js';
import {readFile} from 'node:fs/promises';
import {renderSite} from '../server-core.mjs';
test('Quatre cartes distinctes ouvrent leur propre page',()=>{
 assert.equal(demoCoaches.length,4);assert.equal(new Set(demoCoaches.map(c=>c.pageId)).size,4);
 for(const coach of demoCoaches){const page=coachPage(coach);assert.ok(coachCard(coach).includes('href="'+page.path+'"'));assert.ok(page.html.includes('data-coach-profile-image'));assert.ok(page.html.includes('Son approche'));assert.ok(page.html.includes('Ses cours'))}
 assert.equal((coachesSection().match(/class="coach-card"/g)||[]).length,4);assert.ok(!/généré|intelligence artificielle|portrait IA/i.test(coachesSection()));
});
test('Les textes des coachs restent du contenu sans code actif',()=>{
 const coach={...demoCoaches[0],name:'<img onerror="test">',words:['<script>','Élan','Rythme']};assert.ok(!coachCard(coach).includes('<script>'));assert.ok(coachCard(coach).includes('&lt;script&gt;'));assert.ok(coachPage(coach).html.includes('&lt;img'));
});
test('Google Maps par défaut et Apple Plans utilisent le point précis',()=>{
 const point={lat:45.8518427,lng:6.1461747},links=mapLinks(point),google=new URL(links.google),apple=new URL(links.apple);
 assert.equal(google.origin,'https://www.google.com');assert.equal(google.searchParams.get('api'),'1');assert.equal(google.searchParams.get('destination'),'45.8518427,6.1461747');assert.equal(apple.origin,'https://maps.apple.com');assert.equal(apple.searchParams.get('destination'),google.searchParams.get('destination'));
 assert.throws(()=>mapLinks({lat:Infinity,lng:6}));assert.throws(()=>mapLinks({lat:45,lng:181}));
 const markup=mapBoxMarkup(point);assert.ok(markup.includes('<details'));assert.ok(markup.includes('Google Maps'));assert.ok(markup.includes('Apple Plans'));assert.ok(markup.includes('<svg'));assert.ok(!markup.includes('↗'));assert.ok(markup.includes('© OpenStreetMap'));
});
test('Le plan reste disponible sans script et les tuiles restent valides',()=>{
 for(const point of [{lat:45.85,lng:6.14},{lat:85,lng:180},{lat:-85,lng:-180}]){const grid=staticTiles(point);assert.equal(grid.tiles.length,9);for(const tile of grid.tiles){const [z,x,y]=new URL(tile.url).pathname.slice(1,-4).split('/').map(Number);assert.ok(x>=0&&x<2**z);assert.ok(y>=0&&y<2**z)}}
});
test('Les visiteurs reçoivent un script public, sans fichiers d’édition',async()=>{
 const doc=JSON.parse(await readFile(new URL('../seed/site.json',import.meta.url),'utf8'));const html=renderSite(doc,doc.pages[0]);assert.ok(html.includes('src="/site/nuage-runtime.js"'));assert.ok(!html.includes('src="/admin/runtime.js"'));assert.ok(!html.includes('bridge.js'));
});
