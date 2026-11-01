(()=>{
 let selected=null,editing=true,counter=0,inlineSession=null;
 const newId=()=>'n-'+Date.now().toString(36)+'-'+(++counter);
 const byId=id=>document.querySelector(`[data-nid="${CSS.escape(id)}"]`);
 const send=(type,data={})=>parent.postMessage({source:'nuage-preview',type,...data},location.origin);
 // L’ouverture des réponses sert à l’édition ; elle ne change pas l’état du site enregistré.
 const detailsViews=new Map();
 function openDetails(details,open){
  if(!details?.dataset.nid)return;
  const state=detailsViews.get(details.dataset.nid)||{initial:details.open};
  state.open=open;detailsViews.set(details.dataset.nid,state);details.open=open;
 }
 function restoreDetailsViews(){
  for(const details of document.querySelectorAll('details[data-nid]')){
   const state=detailsViews.get(details.dataset.nid);
   if(state){state.initial=details.open;details.open=state.open}
  }
 }
 function contentCopy(element){
  const clone=element.cloneNode(true);
  for(const node of clone.querySelectorAll('[data-runtime-map]'))node.remove();
  for(const details of [clone,...clone.querySelectorAll('details[data-nid]')]){
   const state=detailsViews.get(details.dataset.nid);
   if(details.matches('details')&&state)details.open=state.initial;
  }
  return clone;
 }
 const assign=()=>{for(const e of document.querySelectorAll('.site-header,.site-header *,#main *, .site-footer,.site-footer *'))if(!e.closest('[data-runtime-map]')&&!e.dataset.nid)e.dataset.nid=newId()};
 const names={'image-link':'Cadre de la photo','logo-crop':'Cadre du logo','home-hero':'Grande photo d’accueil','manifesto':'Texte d’introduction','home-practices':'Liste des cours','offerings':'Photos du studio','local-section':'Le studio à Sevrier','accessories':'Accessoires','home-planning-link':'Lien vers le planning','faq-section':'Questions fréquentes','cta-panel':'Invitation à réserver','page-intro':'Titre de la page','wide-image':'Grande photo du studio','story':'Présentation','values':'Nos valeurs','course-feature':'Présentation des cours','course-types':'Les cinq cours','eversports-section':'Planning et réservations','pricing-section':'Les formules et tarifs','contact-grid':'Contact Instagram','legal-copy':'Informations légales','breadcrumb':'Repère de navigation'};
 const title=e=>e.dataset.label||Object.entries(names).find(([key])=>e.classList.contains(key))?.[1]||(e.tagName==='IMG'?(e.alt||'Photo'):'')||(/^(H[1-6]|P|A|BUTTON)$/.test(e.tagName)?(e.innerText||e.textContent).trim().replace(/\s+/g,' ').slice(0,48):'')||e.querySelector('h1,h2,h3')?.textContent?.trim().slice(0,48)||e.getAttribute('aria-label')||e.className?.toString().split(' ')[0]||e.tagName.toLowerCase();
 function outline(){return [{id:document.querySelector('.site-header').dataset.nid,name:'En-tête partagé',global:true},...Array.from(document.querySelector('#main').children).map(e=>({id:e.dataset.nid,name:title(e),tag:e.tagName.toLowerCase(),hidden:e.dataset.cmsHidden==='true'})),{id:document.querySelector('.site-footer').dataset.nid,name:'Pied de page partagé',global:true}]}
 function parts(){return {header:contentCopy(document.querySelector('.site-header')).outerHTML,footer:contentCopy(document.querySelector('.site-footer')).outerHTML,html:contentCopy(document.querySelector('#main')).innerHTML}}
 const canvas=window.NuageCanvas.create({select:e=>select(e),label:e=>title(e),onStart:info=>send('canvas-start',info),onStyle:(styles,token)=>send('canvas-style',{styles,token}),onOrder:token=>send('canvas-order',{token,parts:parts(),outline:outline()}),onEnd:info=>send('canvas-end',info)});

 const textSelector='h1,h2,h3,h4,h5,h6,p,a,button,summary,figcaption,address,li,span,label';
 const inlineStyle=document.createElement('style');inlineStyle.textContent='[data-cms-inline]{outline:1px dashed #a65339!important;outline-offset:5px;cursor:text!important;caret-color:currentColor;min-width:1ch}cms-inline-text{display:inline;font:inherit;color:inherit;letter-spacing:inherit;text-transform:inherit}';document.head.append(inlineStyle);
 function inlineHTML(session){
  const clone=session.owner.cloneNode(true);
  for(const host of clone.querySelectorAll('cms-inline-text'))host.replaceWith(...host.childNodes);
  return clone.innerHTML;
 }
 function inlineChange(){
  const session=inlineSession;if(!session)return;
  const html=inlineHTML(session);if(html===session.last)return;session.last=html;
  send('inline-change',{token:session.token,html,text:session.direct?session.host.innerText:session.owner.innerText});
 }
 function finishInline(cancel=false){
  const session=inlineSession;if(!session)return;
  inlineChange();const html=cancel?session.original:inlineHTML(session);
  inlineSession=null;session.owner.innerHTML=html;
  for(const [name,value]of Object.entries(session.attrs)){if(value===null)session.host.removeAttribute(name);else session.host.setAttribute(name,value)}
  canvas.suspend(false);assign();
  send('inline-end',{token:session.token,cancel});select(session.owner,{preserveInspector:true});
 }
 function startInline(owner,event){
  if(inlineSession?.owner===owner)return;
  if(owner.matches('summary'))openDetails(owner.parentElement,true);
  finishInline();select(owner);
  const direct=owner.matches('.price,summary,figcaption'),original=owner.innerHTML;
  let host=owner;
  if(direct){
   const nodes=Array.from(owner.childNodes).filter(n=>n.nodeType===3);
   host=document.createElement('cms-inline-text');
   if(nodes.length){nodes[0].before(host);for(const n of nodes)host.append(n)}else owner.prepend(host);
  }
  const attrs=Object.fromEntries(['contenteditable','role','aria-label','spellcheck','data-cms-inline'].map(k=>[k,host.getAttribute(k)]));
  const session=inlineSession={owner,host,direct,original,last:original,attrs,token:'text-'+Date.now().toString(36)};
  host.setAttribute('contenteditable','plaintext-only');host.setAttribute('role','textbox');host.setAttribute('aria-label','Modifier le texte');host.setAttribute('spellcheck','true');host.setAttribute('data-cms-inline','true');
  canvas.suspend(true);send('inline-start',{token:session.token,id:owner.dataset.nid,global:!!owner.closest('.site-header,.site-footer')});
  host.focus({preventScroll:true});
  const nativeSelection=window.getSelection();
  if(!nativeSelection?.anchorNode||!host.contains(nativeSelection.anchorNode)){
   const range=document.caretRangeFromPoint?.(event.clientX,event.clientY)||document.createRange();
   if(!host.contains(range.startContainer)){range.selectNodeContents(host);range.collapse(false)}
   nativeSelection.removeAllRanges();nativeSelection.addRange(range);
  }
 }
 function insertPlain(text){
  if(document.execCommand('insertText',false,text))return;
  const selection=window.getSelection();if(!selection?.rangeCount)return;
  const range=selection.getRangeAt(0);range.deleteContents();const frag=document.createDocumentFragment();
  const lines=text.split('\n');let last;lines.forEach((line,i)=>{if(i)frag.append(document.createElement('br'));last=document.createTextNode(line);frag.append(last)});range.insertNode(frag);range.setStartAfter(last);range.collapse(true);selection.removeAllRanges();selection.addRange(range);inlineChange();
 }
 document.addEventListener('dblclick',event=>{
  if(!editing||event.target.closest('#cms-selection')||event.target.closest('.studio-map'))return;
  let owner=event.target.closest('.price,summary,figcaption')||event.target.closest(textSelector);
  if(!owner?.dataset.nid||!owner.closest('.site')||owner.matches('.logo-crop,.image-link')||owner.querySelector('img,section,article')||owner.matches('li')&&owner.querySelector('p,a,button'))return;
  event.preventDefault();event.stopImmediatePropagation();startInline(owner,event);
 },true);
 document.addEventListener('pointerdown',event=>{if(inlineSession&&!inlineSession.host.contains(event.target))finishInline()},true);
 document.addEventListener('focusout',event=>{if(inlineSession?.host===event.target)finishInline()},true);
 window.addEventListener('blur',()=>finishInline());
 document.addEventListener('input',event=>{if(inlineSession?.host.contains(event.target))inlineChange()},true);
 document.addEventListener('compositionend',()=>inlineChange(),true);
 document.addEventListener('paste',event=>{if(!inlineSession?.host.contains(event.target))return;event.preventDefault();insertPlain((event.clipboardData?.getData('text/plain')||'').replace(/\r\n?/g,'\n'));inlineChange()},true);
 document.addEventListener('drop',event=>{if(inlineSession?.host.contains(event.target))event.preventDefault()},true);
 document.addEventListener('keydown',event=>{
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='s'){event.preventDefault();finishInline();send('save-request');return}
  if(!inlineSession)return;
  if(event.isComposing)return;
  if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();finishInline(true)}
  else if(event.key==='Enter'){
   event.preventDefault();if(inlineSession.direct||event.metaKey||event.ctrlKey)finishInline();else{document.execCommand('insertLineBreak');inlineChange()}
  }
  else if((event.metaKey||event.ctrlKey)&&['b','i','u'].includes(event.key.toLowerCase()))event.preventDefault();
 },true);
 function snapshot(options={}){send('changed',{parts:options.live?null:parts(),outline:outline(),seq:options.seq,live:!!options.live});if(selected&&document.contains(selected))select(selected,{preserveInspector:!!options.live,seq:options.seq})}
 function select(e,options={}){
  if(!e)return;
  let details=e.closest('details');if(e.matches('summary'))details=details?.parentElement?.closest('details');
  for(;details;details=details.parentElement?.closest('details'))openDetails(details,true);
  selected=e;const s=getComputedStyle(e),r=e.getBoundingClientRect();
  send('selected',{preserveInspector:!!options.preserveInspector,seq:options.seq,selection:{id:e.dataset.nid,tag:e.tagName.toLowerCase(),name:title(e),textMode:e.matches('.price,summary,figcaption')?'direct':'whole',text:e.matches('.price,summary,figcaption')?Array.from(e.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim():(e.innerText||e.textContent),html:contentCopy(e).innerHTML,src:e.getAttribute('src')||'',alt:e.getAttribute('alt')||'',href:e.getAttribute('href')||'',className:e.getAttribute('class')||'',hidden:e.dataset.cmsHidden==='true',isText:/^(H[1-6]|P|A|BUTTON|LI|SUMMARY|FIGCAPTION|SPAN|ADDRESS|LABEL)$/.test(e.tagName)&&!e.matches('.logo-crop,.image-link'),isImage:e.tagName==='IMG',images:Array.from(e.querySelectorAll('img').length?e.querySelectorAll('img'):(e.closest('section')?.querySelectorAll('img')||[])).slice(0,6).map(img=>({id:img.dataset.nid,src:img.getAttribute('src'),alt:img.alt})),global:!!e.closest('.site-header,.site-footer'),styles:Object.fromEntries(['font-size', 'font-family', 'font-weight', 'font-style', 'text-transform', 'line-height', 'letter-spacing', 'text-align', 'color', 'background-color', 'background-image', 'background-size', 'background-position', 'background-repeat', 'opacity', 'width', 'height', 'max-width', 'min-height', 'max-height', 'min-width', 'box-sizing', 'translate', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right', 'border-radius', 'border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius', 'border-style', 'border-top-width', 'border-color', 'border-top-color', 'box-shadow', 'gap', 'object-fit', 'object-position', 'display', 'grid-template-columns', 'flex-direction', 'justify-content', 'align-items', 'flex-wrap', 'position', 'top', 'bottom', 'left', 'right', 'z-index', 'overflow', 'filter'].map(k=>[k,s.getPropertyValue(k)])),inline:Object.fromEntries(Array.from(e.style).map(k=>[k,e.style.getPropertyValue(k)])),rect:{x:r.x,y:r.y,w:r.width,h:r.height},parent:e.parentElement?.dataset.nid||null}});
  canvas.update(e);
 }
 function refreshBox(options={}){if(selected&&document.contains(selected))select(selected,options)}
 const sanitize=html=>{const t=document.createElement('template');t.innerHTML=html;for(const e of t.content.querySelectorAll('*')){if(/^(SCRIPT|IFRAME|OBJECT|EMBED|BASE|META|LINK|FORM)$/.test(e.tagName)){e.remove();continue}for(const a of Array.from(e.attributes))if(/^on/i.test(a.name)||a.name==='srcdoc'||/^(?:javascript|vbscript):/i.test(a.value.trim()))e.removeAttribute(a.name)}return t.content};
 const resetIds=e=>{e.removeAttribute('data-nid');for(const c of e.querySelectorAll('[data-nid]'))c.removeAttribute('data-nid')};
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==parent||event.data?.source!=='nuage-admin')return;
  const m=event.data;if(m.command==='finish-inline'){finishInline();send('inline-finished',{request:m.request});return}if(inlineSession&&!['editor-scale','css'].includes(m.command))finishInline();let e=m.id?byId(m.id):selected;
  try{
   if(m.command==='select'){select(e);e?.scrollIntoView({behavior:'smooth',block:'center'});return}
   if(m.command==='mode'){editing=m.editing;if(!editing)canvas.clear();else if(selected)canvas.update(selected);return}
   if(m.command==='editor-scale'){canvas.setScale(m.scale);return}
   if(m.command==='render'){
    const d=m.document,p=d.pages.find(x=>x.id===m.pageId);document.querySelector('.site-header').outerHTML=d.global.header;document.querySelector('.site-footer').outerHTML=d.global.footer;document.querySelector('#main').innerHTML=p.html;document.querySelector('#cms-styles').textContent=m.css;document.querySelector('meta[name="nuage-settings"]').content=JSON.stringify(d.global.settings);assign();restoreDetailsViews();selected=null;canvas.clear();window.nuageInit?.();send('ready',{parts:parts(),outline:outline()});if(m.selectId)select(byId(m.selectId));return;
   }
   if(m.command==='css'){document.querySelector('#cms-styles').textContent=m.css;if(m.refreshSelection!==false)refreshBox({preserveInspector:!!m.preserveInspector,seq:m.seq});send('ack',{seq:m.seq});return}
   if(m.command==='add'){
    const frag=sanitize(m.html);for(const c of frag.children)resetIds(c);const anchor=e?.closest('#main > *');if(m.position==='inside'&&e&&!e.matches('img,input,br'))e.append(frag);else if(anchor&&m.position==='before')anchor.before(frag);else if(anchor)anchor.after(frag);else document.querySelector('#main').append(frag);assign();snapshot(m);return;
   }
   if(!e){send('error',{message:'Sélectionnez à nouveau cet élément dans la page.',seq:m.seq});return}
   if(m.command==='text'){if(m.mode==='direct'){const texts=Array.from(e.childNodes).filter(n=>n.nodeType===3);if(texts.length){texts[0].textContent=m.value;for(const n of texts.slice(1))n.remove()}else e.prepend(document.createTextNode(m.value))}else e.replaceChildren(...String(m.value).split('\n').flatMap((line,i)=>i?[document.createElement('br'),document.createTextNode(line)]:[document.createTextNode(line)]))}
   if(m.command==='style')for(const [k,v] of Object.entries(m.styles)){if(v==='')e.style.removeProperty(k);else e.style.setProperty(k,v)}
   if(m.command==='attribute')for(const [k,v] of Object.entries(m.attrs)){if(v===null)e.removeAttribute(k);else if(!/^on/i.test(k)&&k!=='srcdoc'&&!/^(javascript|vbscript):/i.test(v))e.setAttribute(k,v)}
   if(m.command==='image'){e.setAttribute('src',m.url);e.removeAttribute('srcset');e.removeAttribute('sizes');if(m.alt!==undefined)e.alt=m.alt}
   if(m.command==='html'){e.replaceChildren(sanitize(m.html));assign()}
   if(['duplicate','move'].includes(m.command)&&e.matches('.site-header,.site-footer'))throw Error('Modifiez les éléments à l’intérieur de ce composant partagé.');
   if(m.command==='duplicate'){const copy=contentCopy(e);resetIds(copy);e.after(copy);assign();selected=copy}
   if(m.command==='move'){if(m.direction==='up'&&e.previousElementSibling)e.previousElementSibling.before(e);if(m.direction==='down'&&e.nextElementSibling)e.nextElementSibling.after(e)}
   if(m.command==='delete'){if(e.matches('.site-header,.site-footer'))throw Error('Les composants partagés se modifient mais ne se suppriment pas.');e.remove();selected=null;canvas.clear();send('deselected')}
   if(m.command==='hide')e.dataset.cmsHidden=e.dataset.cmsHidden==='true'?'false':'true';
   if(m.command==='parent'){select(e.parentElement.closest('[data-nid]'));return}
   if(m.command==='scroll')e.scrollIntoView({behavior:'smooth',block:'center'});
   snapshot(m);
  }catch(err){send('error',{message:err.message,seq:m.seq})}
 });
 document.addEventListener('click',event=>{
  if(inlineSession?.host.contains(event.target)){if(event.target.closest('a,button,summary'))event.preventDefault();event.stopImmediatePropagation();return}if(event.target.closest('#cms-selection'))return;if(canvas.consumeClick()){event.preventDefault();event.stopImmediatePropagation();return}
  if(!editing){const a=event.target.closest('a[href]');if(a?.getAttribute('href')?.startsWith('/site/')){event.preventDefault();send('navigate',{path:a.getAttribute('href')})}return}
  event.preventDefault();event.stopImmediatePropagation();
  const summary=event.target.closest('summary');
  if(summary?.parentElement?.matches('details')&&summary.dataset.nid){
   if(event.detail<2)openDetails(summary.parentElement,!summary.parentElement.open);
   select(summary);return;
  }
  let e=event.target.closest('.studio-map')||event.target.closest('.practice-name,img,h1,h2,h3,h4,p,a,button,summary,figcaption,address,li,section,article,header,footer,div');if(e?.matches('.practice-index a')&&e.querySelector('.practice-name'))e=e.querySelector('.practice-name');if(e?.dataset.nid)select(e);
 },true);

 assign();send('ready',{parts:parts(),outline:outline()});
})();
