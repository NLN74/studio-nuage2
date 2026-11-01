import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {colorParts,rgba} from '../admin/editing.js';
import {themeCSS} from '../admin/shared.js';
test('Couleurs RGBA : transparence, hex alpha, RGB et valeurs saisies',()=>{
 assert.deepEqual(colorParts('rgba(165, 79, 49, 0.35)'),{hex:'#a54f31',alpha:35});
 assert.deepEqual(colorParts('transparent'),{hex:'#000000',alpha:0});
 assert.deepEqual(colorParts('#1238'),{hex:'#112233',alpha:53});
 assert.deepEqual(colorParts('#ffffff80'),{hex:'#ffffff',alpha:50});
 assert.deepEqual(colorParts('rgb(100% 0% 0% / 25%)'),{hex:'#ff0000',alpha:25});
 assert.equal(rgba('#a54f31',35),'rgba(165, 79, 49, 0.35)');
 assert.equal(rgba('#ffffff',0),'rgba(255, 255, 255, 0)');
 assert.equal(colorParts('rgba(165,'),null);
});
test('Les options supplémentaires ne changent pas le style de base sans action',async()=>{
 const d=JSON.parse(await readFile(new URL('../data/initial.json',import.meta.url),'utf8').catch(()=>readFile(new URL('../seed/site.json',import.meta.url),'utf8')));
 const css=themeCSS(d,d.pages[0]);
 assert.ok(!d.global.theme.customTextSize);
 assert.ok(!css.includes('.site p:not(.eyebrow)'));
 assert.ok(!css.includes('[data-nid='));
 assert.ok(!css.includes('box-shadow:'));
 assert.ok(!css.includes('opacity:'));
});
test('Les styles mobiles gardent le RGBA, l’opacité, les arrondis et une image de fond locale',async()=>{
 const d=JSON.parse(await readFile(new URL('../data/initial.json',import.meta.url),'utf8').catch(()=>readFile(new URL('../seed/site.json',import.meta.url),'utf8')));
 d.pages[0].mobileCss={'n-example':{'background-color':'rgba(165, 79, 49, 0.35)',opacity:'0.8','border-radius':'24px','background-image':'url("/site/uploads/photo.webp")'}};
 const css=themeCSS(d,d.pages[0]);
 for(const value of ['background-color:rgba(165, 79, 49, 0.35)!important','opacity:0.8!important','border-radius:24px!important','background-image:url("/site/uploads/photo.webp")!important'])assert.ok(css.includes(value),value);
 d.pages[0].mobileCss['n-example']['background-image']='url("javascript:alert(1)")';
 assert.ok(!themeCSS(d,d.pages[0]).includes('javascript:'));
 d.pages[0].mobileCss['n-example']['background-color']='red;}body{display:none';
 assert.ok(!themeCSS(d,d.pages[0]).includes('body{display:none'));
});
