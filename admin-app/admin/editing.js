export function colorParts(value){
 let v=String(value||'').trim().toLowerCase();
 if(v==='transparent')return {hex:'#000000',alpha:0};
 if(v==='black')v='#000000';if(v==='white')v='#ffffff';
 let m=v.match(/^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i);
 if(m){let h=m[1];if(h.length<5)h=h.split('').map(c=>c+c).join('');return {hex:'#'+h.slice(0,6),alpha:h.length===8?Math.round(parseInt(h.slice(6),16)/255*100):100}}
 m=v.match(/^rgba?\((.+)\)$/);if(!m)return null;
 const parts=m[1].replace(/\s*\/\s*/,',').trim().split(/[\s,]+/).filter(Boolean);if(parts.length<3||parts.length>4)return null;
 const rgb=parts.slice(0,3).map(x=>x.endsWith('%')?parseFloat(x)*2.55:Number(x));if(rgb.some(x=>!Number.isFinite(x)))return null;
 let alpha=parts[3]===undefined?100:parts[3].endsWith('%')?parseFloat(parts[3]):Number(parts[3])*100;if(!Number.isFinite(alpha))return null;
 return {hex:'#'+rgb.map(x=>Math.round(Math.max(0,Math.min(255,x))).toString(16).padStart(2,'0')).join(''),alpha:Math.round(Math.max(0,Math.min(100,alpha)))};
}
export function rgba(hex,alpha=100){const c=colorParts(hex);if(!c)return null;const h=c.hex.slice(1);return `rgba(${parseInt(h.slice(0,2),16)}, ${parseInt(h.slice(2,4),16)}, ${parseInt(h.slice(4,6),16)}, ${Math.max(0,Math.min(100,Number(alpha)))/100})`}
export function mutateElement(element,edit){
 if(edit.type==='text'){
  if(edit.mode==='direct'){const nodes=Array.from(element.childNodes).filter(n=>n.nodeType===3);if(nodes.length){nodes[0].textContent=edit.value;for(const n of nodes.slice(1))n.remove()}else element.prepend(element.ownerDocument.createTextNode(edit.value))}
  else element.replaceChildren(...String(edit.value).split('\n').flatMap((line,i)=>i?[element.ownerDocument.createElement('br'),element.ownerDocument.createTextNode(line)]:[element.ownerDocument.createTextNode(line)]));
 }
 if(edit.type==='html')element.innerHTML=edit.html;
 if(edit.type==='style'){for(const[k,v]of Object.entries(edit.styles)){if(v==='')element.style.removeProperty(k);else element.style.setProperty(k,v)}if(!element.style.length)element.removeAttribute('style')}
 if(edit.type==='attribute')for(const[k,v]of Object.entries(edit.attrs)){if(v===null)element.removeAttribute(k);else element.setAttribute(k,v)}
 if(edit.type==='image'){element.setAttribute('src',edit.url);element.removeAttribute('srcset');element.removeAttribute('sizes');if(edit.alt!==undefined)element.setAttribute('alt',edit.alt)}
}
export function patchDocument(doc,pageId,selection,edit){
 const page=doc.pages.find(p=>p.id===pageId);const parts=selection.global?[[doc.global,'header'],[doc.global,'footer']]:[[page,'html']];
 for(const[obj,key]of parts){const template=document.createElement('template');template.innerHTML=obj[key];const el=template.content.querySelector(`[data-nid="${CSS.escape(selection.id)}"]`);if(el){mutateElement(el,edit);obj[key]=template.innerHTML;return}}
 throw Error('Sélectionnez à nouveau cet élément dans la page.');
}
export function documentStyles(doc,pageId,selection){
 const page=doc.pages.find(p=>p.id===pageId),parts=selection.global?[doc.global.header,doc.global.footer]:[page.html];
 for(const html of parts){const t=document.createElement('template');t.innerHTML=html;const el=t.content.querySelector(`[data-nid="${CSS.escape(selection.id)}"]`);if(el)return Object.fromEntries(Array.from(el.style).map(k=>[k,el.style.getPropertyValue(k)]))}return {};
}
