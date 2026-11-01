import {updateMapBox} from './map-links.js';
// Patch detached content only; keep layout, inline styles and editor IDs intact.
export function applyAddress(doc,address,point){
 const old=doc.global.settings,replacements=['street','postcode','city'].filter(k=>old[k]&&old[k]!==address[k]).map(k=>[old[k],address[k]]).sort((a,b)=>b[0].length-a[0].length);
 const replace=html=>{
  const t=document.createElement('template');t.innerHTML=html;
  const walk=document.createTreeWalker(t.content,NodeFilter.SHOW_TEXT);let n;
  while(n=walk.nextNode())for(const[a,b]of replacements)n.nodeValue=n.nodeValue.replaceAll(a,b);
  for(const block of t.content.querySelectorAll('address'))block.replaceChildren(document.createTextNode(address.street),document.createElement('br'),document.createTextNode(address.postcode+' '+address.city));
  for(const box of t.content.querySelectorAll('.studio-map')){
   updateMapBox(box,point);
  }
  for(const caption of t.content.querySelectorAll('.map-caption'))if(caption.textContent.startsWith('Emplacement provisoire'))caption.remove();
  for(const label of t.content.querySelectorAll('.sample-label'))if(label.textContent.trim()==='Adresse d’illustration')label.remove();
  return t.innerHTML;
 };
 doc.global.header=replace(doc.global.header);doc.global.footer=replace(doc.global.footer);
 for(const p of doc.pages){p.html=replace(p.html);for(const[a,b]of replacements){p.title=p.title.replaceAll(a,b);p.description=p.description.replaceAll(a,b)}}
 doc.global.settings={...old,...address,mapLocation:{...address,lat:point.lat,lng:point.lng,label:point.label}};
}
