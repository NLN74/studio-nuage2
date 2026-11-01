import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {renderSite,siteMetadata} from '../server-core.mjs';
const doc=JSON.parse(await readFile(new URL('../seed/site.json',import.meta.url),'utf8'));
test('Icônes complètes, images sociales absolues et métadonnées propres à chaque page',()=>{
 const page=doc.pages.find(p=>p.id==='coach-02'),html=renderSite(doc,page,{origin:'https://studio.example'});
 for(const value of ['favicon.svg','favicon-32.png','favicon-96.png','apple-touch-icon.png','site.webmanifest','safari-pinned-tab.svg','summary_large_image'])assert.ok(html.includes(value));
 assert.ok(html.includes('content="https://studio.example/site/social-preview.jpg"'));assert.ok(html.includes('content="https://studio.example/site/coach-02.html"'));assert.ok(html.includes('content="1200"'));assert.ok(html.includes('content="630"'));assert.ok(!html.includes('rel="icon" href="/site/logo-nuage-transparent.png"'));
});
test('Les exports gardent des ressources locales et une URL de partage configurable',()=>{
 const d=structuredClone(doc);d.global.settings.publicSiteUrl='https://studio.example/nuage/';const html=renderSite(d,d.pages[0],{exported:true});assert.ok(html.includes('href="./apple-touch-icon.png"'));assert.ok(html.includes('content="https://studio.example/nuage/social-preview.jpg"'));assert.ok(!html.includes('/site/'));
});
test('Les titres de partage sont échappés ; aucune URL active ni identifiant de connexion',()=>{
 const d=structuredClone(doc);d.global.settings.publicSiteUrl='javascript:alert(1)';const p={...d.pages[0],title:'"<Titre>',description:'<script>contenu</script>'};const html=siteMetadata(d,p);assert.ok(html.includes('&lt;Titre&gt;'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('javascript:'));
});
test('Les icônes mobiles et les visuels sociaux ont les dimensions annoncées',async()=>{
 const sizes={'apple-touch-icon.png':[180,180],'android-chrome-192x192.png':[192,192],'android-chrome-512x512.png':[512,512],'maskable-icon-512x512.png':[512,512],'social-preview.png':[1200,630]};
 for(const [name,dimensions]of Object.entries(sizes)){const b=await readFile(new URL('../site/'+name,import.meta.url));assert.deepEqual([b.readUInt32BE(16),b.readUInt32BE(20)],dimensions,name)}
 const ico=await readFile(new URL('../site/favicon.ico',import.meta.url));assert.equal(ico.readUInt16LE(2),1);assert.ok(ico.readUInt16LE(4)>=3);
 const manifest=JSON.parse(await readFile(new URL('../site/site.webmanifest',import.meta.url),'utf8'));assert.equal(manifest.start_url,'./');assert.ok(manifest.icons.some(i=>i.purpose==='maskable'));assert.ok(manifest.icons.some(i=>i.sizes==='192x192'));assert.ok(manifest.icons.some(i=>i.sizes==='512x512'));
});
