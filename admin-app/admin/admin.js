import {themeCSS,mapCSS} from './shared.js';
import {createAddressController,addressKey} from './address-controller.js';
import {applyAddress} from './address-content.js';
import {moveMapPosition} from './map-position.js';
import {createMapEditor} from './map-editor.js';
import {appearancePanel,styleFromControl} from './appearance.js';
import {patchDocument,documentStyles} from './editing.js';
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let doc,token,pageId,selection=null,outline=[],device='mobile',view='editor',tab='content',dirty=false,undoStack=[],redoStack=[],media=[],mediaTarget=null,pendingCommand=false,liveAt=null,loadingFrame=false;
const frame=$('#preview');
let mapEditor=null,mapMoving=false;
const mapStyle=document.createElement('style');mapStyle.textContent=mapCSS;document.head.append(mapStyle);
const addressEditor=createAddressController({
 lookup:async address=>(await(await api('geocode',address)).json()).candidates,
 onStatus:()=>{renderAddressStatus();if(doc)status()},
 onResult:(address,point)=>{remember();applyAddress(doc,address,point);syncPreview();refreshAddressPreview()}
});
async function ensureAddress(){if(!await addressEditor.flush())throw Error(addressEditor.getState().message)}
function updateAddressInput(){
 const address=Object.fromEntries(['street','postcode','city'].map(k=>[k,$(`[data-field="setting-${k}"]`).value]));
 if(addressKey(address)===addressKey(doc.global.settings))addressEditor.cancel();else addressEditor.update(address);
}
function refreshAddressPreview(){
 const preview=$('#address-map-preview');if(!preview)return;mapEditor?.destroy();mapEditor=null;
 const t=document.createElement('template');t.innerHTML=doc.global.footer;const box=t.content.querySelector('.studio-map');
 if(box){for(const node of box.querySelectorAll('[data-runtime-map]'))node.remove();preview.replaceChildren(box);mapEditor=createMapEditor({box,canMove:()=>!addressEditor.isPending(),onDragState:active=>{mapMoving=active;status()},onMove:point=>{if(addressEditor.isPending())return false;remember();moveMapPosition(doc,point);syncPreview();renderAddressStatus();return true},onError:message=>toast(message,true)});mapEditor.setBusy(addressEditor.isPending())}
}
function renderAddressStatus(){
 const el=$('#address-status');if(!el)return;const state=addressEditor.getState();
 mapEditor?.setBusy(addressEditor.isPending());
 el.textContent=doc.global.settings.mapLocation?.manual&&!addressEditor.isPending()?'Position du repère ajustée.':state.message||(doc.global.settings.mapLocation?'Adresse trouvée : '+doc.global.settings.mapLocation.label:'Emplacement provisoire');el.dataset.state=state.kind;
 const choices=$('#address-choices');choices.replaceChildren();
 for(const [i,candidate]of(state.candidates||[]).entries()){const button=document.createElement('button');button.type='button';button.className='address-choice';button.dataset.addressChoice=i;button.textContent=candidate.label;choices.append(button)}
 $('#address-retry').hidden=state.kind!=='error';
 const reset=$('#address-reset');if(reset)reset.disabled=mapMoving||addressEditor.isPending()||!doc.global.settings.mapLocation?.manual;
}

let canvasTransaction=null,inlineTransaction=null,inlineRequest=0;const inlineWaiters=new Map();
let liveGroup=null,mutationSequence=0,latestMutation=0;const pendingEdits=new Map(),previewWaiters=[];
function settlePreview(seq){pendingEdits.delete(seq);pendingCommand=pendingEdits.size>0;$('#apply').disabled=pendingCommand||!!canvasTransaction||mapMoving;$('#save').disabled=pendingCommand||!!canvasTransaction||mapMoving;if(!pendingCommand)while(previewWaiters.length)previewWaiters.shift()()}
function waitForPreview(){if(!pendingEdits.size)return Promise.resolve();return new Promise((resolve,reject)=>{let done=false;const timer=setTimeout(()=>{if(!done){done=true;reject(Error('L’aperçu ne répond pas. Réessayez dans un instant.'))}},5000);previewWaiters.push(()=>{if(!done){done=true;clearTimeout(timer);resolve()}})})}
function trackPreview(live=false){const seq=++mutationSequence;latestMutation=seq;pendingEdits.set(seq,live);pendingCommand=true;$('#apply').disabled=true;$('#save').disabled=true;return seq}
function endLiveEdit(){liveGroup=null}
function rememberLive(key){if(liveGroup!==key){remember();liveGroup=key}}
function liveEdit(edit,key){if(!selection)return;if(Array.from(pendingEdits.values()).includes(false)){const id=selection.id;waitForPreview().then(()=>{if(selection?.id===id)liveEdit(edit,key)}).catch(e=>toast(e.message,true));return}rememberLive(pageId+'|'+selection.id+'|'+device+'|'+key);patchDocument(doc,pageId,selection,edit);const seq=trackPreview(true);message(edit.type,{...edit,id:selection.id,live:true,seq})}
function liveStyles(styles,key){
 if(!selection||!styles)return;
 for(const[k,v]of Object.entries(styles))if(/[{}<>;]/.test(v)||v&&!CSS.supports(k,v))return;
 const current=device==='mobile'?((selection.global?doc.global.mobileCss:page().mobileCss)?.[selection.id]||{}):documentStyles(doc,pageId,selection);
 const normal=document.createElement('span').style;
 const canonical=(k,v)=>{normal.cssText='';normal.setProperty(k,v||'');return normal.getPropertyValue(k)};
 styles=Object.fromEntries(Object.entries(styles).filter(([k,v])=>v===''?!!current[k]:canonical(k,v)!==canonical(k,current[k]??selection.styles[k])));
 if(!Object.keys(styles).length)return;
 if(device==='mobile'){rememberLive(pageId+'|'+selection.id+'|mobile|'+key);const target=selection.global?(doc.global.mobileCss??={}):page().mobileCss;target[selection.id]={...target[selection.id],...styles};for(const[k,v]of Object.entries(target[selection.id]))if(v==='')delete target[selection.id][k];stylePreview(true)}else liveEdit({type:'style',styles},key);
}

function beginCanvasChange(){
 const tx=canvasTransaction;if(tx.changed)return;
 undoStack.push(tx.before);if(undoStack.length>60)undoStack.shift();redoStack=[];dirty=true;tx.changed=true;status();
}
function handleCanvasMessage(m){
 if(m.type==='canvas-start'){
  if(canvasTransaction||selection?.id!==m.id)return true;
  endLiveEdit();canvasTransaction={token:m.token,id:m.id,kind:m.kind,global:selection.global,pageId,device,before:JSON.stringify(doc),wasDirty:dirty,undoBefore:undoStack.slice(),redoBefore:redoStack.slice(),changed:false};
  $('#apply').disabled=true;$('#save').disabled=true;status();return true;
 }
 const tx=canvasTransaction;
 if(!m.type.startsWith('canvas-'))return false;
 if(!tx||tx.token!==m.token)return true;
 if(m.type==='canvas-style'){
  const styles=m.styles;if(!styles||Object.entries(styles).some(([k,v])=>!/^[a-z-]+$/.test(k)||typeof v!=='string'||/[{}<>;]/.test(v)||!CSS.supports(k,v)))return true;
  beginCanvasChange();
  if(tx.device==='mobile'){const target=tx.global?(doc.global.mobileCss??={}):doc.pages.find(p=>p.id===tx.pageId).mobileCss;target[tx.id]={...target[tx.id],...styles}}
  else patchDocument(doc,tx.pageId,{id:tx.id,global:tx.global},{type:'style',styles});
  return true;
 }
 if(m.type==='canvas-order'){
  beginCanvasChange();doc.global.header=m.parts.header;doc.global.footer=m.parts.footer;doc.pages.find(p=>p.id===tx.pageId).html=m.parts.html;outline=m.outline;renderOutline();return true;
 }
 if(m.type==='canvas-end'){
  if((m.cancel||!m.changed)&&tx.changed){const revision=doc.revision;doc=JSON.parse(tx.before);doc.revision=revision;undoStack=tx.undoBefore;redoStack=tx.redoBefore;dirty=tx.wasDirty}
  canvasTransaction=null;endLiveEdit();$('#apply').disabled=pendingEdits.size>0;$('#save').disabled=pendingEdits.size>0;status();
  message('render',{document:doc,pageId,css:themeCSS(doc,page()),selectId:tx.id});
  if(m.cancel)toast('Geste annulé.');return true;
 }
 return true;
}

function finishInlinePreview(){
 if(!inlineTransaction)return Promise.resolve();
 return new Promise((resolve,reject)=>{const request=++inlineRequest;const timer=setTimeout(()=>{inlineWaiters.delete(request);reject(Error('Terminez la saisie dans l’aperçu puis réessayez.'))},5000);inlineWaiters.set(request,()=>{clearTimeout(timer);resolve()});message('finish-inline',{request})});
}
function handleInlineMessage(m){
 if(m.type==='inline-finished'){inlineWaiters.get(m.request)?.();inlineWaiters.delete(m.request);return true}
 if(m.type==='save-request'){apply();return true}
 if(m.type==='inline-start'){
  endLiveEdit();inlineTransaction={token:m.token,id:m.id,global:m.global,pageId,before:JSON.stringify(doc),wasDirty:dirty,undoBefore:undoStack.slice(),redoBefore:redoStack.slice(),changed:false};return true;
 }
 if(!m.type.startsWith('inline-'))return false;
 const tx=inlineTransaction;if(!tx||m.token!==tx.token)return true;
 if(m.type==='inline-change'){
  if(!tx.changed){undoStack.push(tx.before);if(undoStack.length>60)undoStack.shift();redoStack=[];tx.changed=true}
  patchDocument(doc,tx.pageId,tx,{type:'html',html:m.html});dirty=true;
  if(selection?.id===tx.id){selection.html=m.html;selection.text=m.text;const input=$('#text-value');if(input&&document.activeElement!==input)input.value=m.text}
  status();return true;
 }
 if(m.type==='inline-end'){
  if(m.cancel){const rev=doc.revision;doc=JSON.parse(tx.before);doc.revision=rev;undoStack=tx.undoBefore;redoStack=tx.redoBefore;dirty=tx.wasDirty}
  inlineTransaction=null;endLiveEdit();if(m.cancel&&selection?.id===tx.id){const t=document.createElement('template');t.innerHTML=tx.global?doc.global.header+doc.global.footer:doc.pages.find(p=>p.id===tx.pageId).html;const node=t.content.querySelector('[data-nid="'+CSS.escape(tx.id)+'"]');if(node){selection.text=selection.textMode==='direct'?Array.from(node.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim():node.textContent;const input=$('#text-value');if(input)input.value=selection.text}}status();return true;
 }
 return true;
}

const page=()=>doc.pages.find(p=>p.id===pageId);
const toast=(text,error=false)=>{const e=$('#toast');e.textContent=text;e.classList.toggle('error',error);e.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>e.classList.remove('show'),4500)};
async function api(url,body){const r=await fetch('/api/'+url,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json','X-Nuage-Token':token},body:body===undefined?undefined:JSON.stringify(body)});if(r.status===401){location.assign('/login');throw Error('Connectez-vous pour continuer.')}if(!r.ok){let m;try{m=await r.json()}catch{}throw Error(m?.error||'La demande n’a pas abouti.')}return r}
const status=()=>{if(dirty||addressEditor.isPending())$('#apply').innerHTML='Enregistrer <span>✓</span>'; $('#dirty').textContent=dirty||addressEditor.isPending()?'Modifications non enregistrées':'Enregistré';$('#dirty').classList.toggle('dirty',dirty);$('#apply').disabled=pendingEdits.size>0||!!canvasTransaction||mapMoving;$('#save').disabled=pendingEdits.size>0||!!canvasTransaction||mapMoving;$('#undo').disabled=!undoStack.length||!!canvasTransaction||mapMoving;$('#redo').disabled=!redoStack.length||!!canvasTransaction||mapMoving};
function remember(){undoStack.push(JSON.stringify(doc));if(undoStack.length>60)undoStack.shift();redoStack=[];dirty=true;status()}
function message(command,data={}){frame.contentWindow.postMessage({source:'nuage-admin',command,...data},location.origin)}
function command(type,data={}){if(!selection&&type!=='add')return;endLiveEdit();remember();const seq=trackPreview();message(type,{id:selection?.id,...data,seq})}
function syncPreview(selectId=null){message('render',{document:doc,pageId,css:themeCSS(doc,page()),selectId});selection=null;emptyInspector();renderPages();renderOutline()}
function stylePreview(live=false){const seq=trackPreview(true);message('css',{css:themeCSS(doc,page()),live,preserveInspector:live,refreshSelection:view!=='theme',seq})}
function resize(){const width=device==='mobile'?390:1200;const stage=$('#stage');if(!stage.clientWidth)return;const scale=Math.min(1,stage.clientWidth/width);const w=width*scale;$('.iframe-box').style.width=w+'px';frame.style.width=width+'px';frame.style.height=(stage.clientHeight/scale)+'px';frame.style.transform=`scale(${scale})`;$('#preview-dimensions').textContent=device==='mobile'?'Vue téléphone':'Vue grand écran';message('editor-scale',{scale})}
new ResizeObserver(resize).observe($('#stage'));
function renderPages(){$('#pages').innerHTML=doc.pages.map(p=>`<button data-page="${p.id}" class="${p.id===pageId?'active':''}">${esc(p.name)}</button>`).join('');$('#current-page').textContent=page().name;$('#page-select').innerHTML=doc.pages.map(p=>`<option value="${p.id}" ${p.id===pageId?'selected':''}>${esc(p.name)}</option>`).join('')+'<option value="__new">+ Créer une nouvelle page</option>';$('#preview-page-name').textContent=page().name}
function renderOutline(){$('#outline').innerHTML=outline.map((o,i)=>`<div class="outline-item ${selection?.id===o.id?'active':''} ${o.hidden?'muted':''}"><button data-select="${o.id}" title="${esc(o.name)}"><span>${o.global?'◇':'▧'}</span><span>${esc(o.name)}</span></button>${!o.global?`<button class="move" data-move="${o.id}" data-direction="up" aria-label="Monter ${esc(o.name)}">↑</button><button class="move" data-move="${o.id}" data-direction="down" aria-label="Descendre ${esc(o.name)}">↓</button>`:''}</div>`).join('')}
function navigate(id){if(inlineTransaction){finishInlinePreview().then(()=>navigate(id)).catch(e=>toast(e.message,true));return}if(pendingEdits.size){waitForPreview().then(()=>navigate(id)).catch(e=>toast(e.message,true));return}endLiveEdit();pageId=id;selection=null;outline=[];renderPages();renderOutline();emptyInspector();loadingFrame=true;frame.onload=()=>{loadingFrame=false;message('render',{document:doc,pageId,css:themeCSS(doc,page())});message('mode',{editing:$('#edit-mode').checked});resize()};frame.src='/preview/?page='+id}
function emptyInspector(){$('#inspector').innerHTML='<div class="inspector-empty"><h2>Sélectionnez un élément</h2><p>Cliquez dans l’aperçu.</p></div>'}

const field=(label,key,value,type='text',extra='')=>`<label>${label}<input data-field="${key}" type="${type}" value="${esc(value)}" ${extra}></label>`;
function renderInspector(){
 if(!selection)return emptyInspector();const s=selection;
 let body='';
 if(tab==='content'){
  if(s.isText)body+=`<div class="field-group"><h3>Ce qui est écrit</h3><label>Votre texte<textarea id="text-value" rows="5">${esc(s.text)}</textarea></label></div>`;
  if(s.isImage)body+=`<div class="field-group"><h3>Image</h3><img class="image-thumb" src="${esc(s.src)}" alt="Aperçu de l’image sélectionnée"><button id="replace-image" class="button-secondary full-button">Changer cette photo</button>${field('Décrire la photo en quelques mots','alt',s.alt)}<details class="simple-details"><summary>Utiliser le lien d’une image</summary>${field('Lien de l’image','src',s.src)}</details></div>`;
  if(!s.isImage&&s.images?.length)body+=`<div class="field-group"><h3>${s.images.length>1?'Les photos de ce bloc':'La photo de ce bloc'}</h3>${s.images.map(img=>`<button class="related-image" data-select-image="${img.id}"><img src="${esc(img.src)}" alt="${esc(img.alt)}"><span>Modifier cette photo →</span></button>`).join('')}</div>`;
  if(s.tag==='a'||s.href)body+=`<div class="field-group"><h3>Lien</h3>${field('Page ou lien à ouvrir','href',s.href)}<label>Ou choisir une page<select id="link-page"><option value="">Choisir une page…</option>${doc.pages.map(p=>`<option value="${p.path}">${esc(p.name)}</option>`).join('')}</select></label></div>`;
  body+=`<details class="simple-details"><summary>Déplacer, copier ou supprimer cet élément</summary><div class="field-group"><h3>Organiser cet élément</h3><div class="tiny-actions"><button data-command="parent">Modifier le bloc autour ↑</button><button data-command="duplicate">Dupliquer</button><button data-command="hide">${s.hidden?'Afficher':'Masquer'}</button><button data-command="move" data-direction="up">Monter ↑</button><button data-command="move" data-direction="down">Descendre ↓</button></div><button id="insert-after" class="button-secondary full-button">+ Ajouter un bloc après</button></div>${!(s.global&&['header','footer'].includes(s.tag))?'<button id="delete-element" class="button-danger full-button">Supprimer cet élément</button>':''}</details>`;
 }
 if(tab==='style')body+=appearancePanel(s,device,device==='mobile'?((s.global?doc.global.mobileCss:page().mobileCss)?.[s.id]||{}):{});
 if(tab==='advanced')body+=`<div class="field-group"><h3>Repères</h3>${field('Classes CSS','className',s.className)}<button id="class-apply" class="button-secondary full-button">Appliquer les classes</button></div>${!s.isImage?`<div class="field-group"><h3>HTML intérieur</h3><textarea id="html-value" class="source-code" rows="12">${esc(s.html)}</textarea><button id="html-apply" class="button-secondary full-button">Remplacer le HTML</button></div>`:''}`;
 $('#inspector').innerHTML=`<div class="inspector-head">${s.global?'<span class="tiny" title="Commun aux pages">Partagé</span>':''}<h2>${s.isImage?'Photo':s.isText?'Texte':'Bloc'}</h2><small>${esc(s.name)}</small></div><div class="tabs"><button data-tab="content" class="${tab==='content'?'active':''}">Contenu</button><button data-tab="style" class="${tab==='style'?'active':''}">Taille et couleurs</button><button data-tab="advanced" class="${tab==='advanced'?'active':''}">Options</button></div><div class="inspector-body">${body}</div>`;
}
window.addEventListener('message',e=>{
 if(e.origin!==location.origin||e.source!==frame.contentWindow||e.data?.source!=='nuage-preview')return;const m=e.data;if(loadingFrame)return;if(handleInlineMessage(m)||handleCanvasMessage(m))return;
 if(m.type==='selected'){
  if(m.seq&&m.seq<latestMutation)return;if(view==='theme'&&m.preserveInspector)return;
  const same=selection?.id===m.selection.id;
  if(!same){endLiveEdit();tab='content'}selection=m.selection;
  if(view==='theme'&&!m.preserveInspector){view='editor';$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view==='editor'))}
  if(!(m.preserveInspector&&same))renderInspector();renderOutline();
 }
 if(m.type==='deselected'){endLiveEdit();selection=null;emptyInspector()}
 if(m.type==='ack'){settlePreview(m.seq)}
 if(m.type==='ready'||m.type==='changed'){
  if(m.type==='ready'||!m.live&&(!m.seq||m.seq>=latestMutation)){doc.global.header=m.parts.header;doc.global.footer=m.parts.footer;page().html=m.parts.html}
  if(!m.seq||m.seq>=latestMutation){outline=m.outline;renderOutline()}
  if(m.type==='changed'){dirty=true;settlePreview(m.seq);status()}
 }
 if(m.type==='navigate'){const p=doc.pages.find(p=>p.path===m.path.split('#')[0]);if(p)navigate(p.id);else toast('Ce lien ouvre une destination externe au site local.')}
 if(m.type==='error'){settlePreview(m.seq);toast(m.message,true)}
});
function setView(v){const previous=view;endLiveEdit();view=v;$$('.view').forEach(e=>e.hidden=e.id!==(v==='theme'?'editor':v)+'-view');$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===v));if(v==='media')loadMedia();if(v==='theme')renderTheme();if(v==='settings')renderSettings();if(v==='history')renderHistory();if(v==='editor'&&previous==='theme')emptyInspector();if(v==='editor'||v==='theme')resize()}
async function save(){try{await finishInlinePreview();await ensureAddress();if(view==='settings')await settingApply(false);if(canvasTransaction||mapMoving)throw Error('Terminez le geste avant d’enregistrer.');endLiveEdit();await waitForPreview();$('#save').disabled=true;const r=await(await api('save',{document:doc})).json();doc=r.document;dirty=false;status();toast('Brouillon enregistré.');return true}catch(e){toast(e.message,true);return false}finally{$('#save').disabled=false}}
async function apply(){try{if(mapMoving)throw Error('Terminez le déplacement du repère avant d’enregistrer.');await finishInlinePreview();await ensureAddress();if(view==='settings')await settingApply(false);if(dirty&&!await save())return;const r=await(await api('apply',{revision:doc.revision})).json();liveAt=r.liveAt;$('#apply').innerHTML='Enregistré <span>✓</span>';toast('Modifications enregistrées.')}catch(e){toast(e.message,true)}}
function undo(redo=false){if(mapMoving)return;addressEditor.cancel();if(inlineTransaction){finishInlinePreview().then(()=>undo(redo)).catch(e=>toast(e.message,true));return}if(canvasTransaction)return;if(pendingEdits.size){waitForPreview().then(()=>undo(redo)).catch(e=>toast(e.message,true));return}endLiveEdit();const from=redo?redoStack:undoStack,to=redo?undoStack:redoStack;if(!from.length)return;to.push(JSON.stringify(doc));const rev=doc.revision,keepSelection=selection?.id;doc=JSON.parse(from.pop());doc.revision=rev;if(!doc.pages.some(p=>p.id===pageId))pageId=doc.pages[0].id;dirty=true;syncPreview(keepSelection);if(view==='theme')renderTheme();if(view==='settings')renderSettings();status()}
function modal(html){$('#modal-body').innerHTML=html;$('#modal').showModal()}
const closeModal=()=>$('#modal').close();
const templates=[
 {id:'heading',name:'Titre libre',note:'À ajouter dans un bloc',mini:'T',html:'<h2>Votre nouveau titre.</h2>'},
 {id:'paragraph',name:'Paragraphe',note:'À ajouter dans un bloc',mini:'¶',html:'<p>Votre nouveau paragraphe.</p>'},
 {id:'button',name:'Bouton / lien',note:'Destination modifiable',mini:'↗',html:'<a class="button" href="/site/contact.html">Votre bouton</a>'},
 {id:'text',name:'Texte éditorial',note:'Titre, texte et lien',mini:'Aa',html:'<section class="cms-section" data-label="Texte éditorial"><p class="eyebrow">Nouveau chapitre</p><h2>Votre titre ici.</h2><p>Écrivez votre texte. Chaque élément de cette section est modifiable.</p><a href="/site/contact.html" class="text-link">En savoir plus</a></section>'},
 {id:'hero',name:'Grande image',note:'Image, titre et bouton',mini:'▰',html:'<section class="cms-section cms-hero" data-label="Grande image"><img src="/site/hero-noir-1200.webp" alt="Mouvement"><div><p class="eyebrow">Nuage Studio</p><h2>Une nouvelle impulsion.</h2><p>Votre texte de présentation.</p><a href="/site/planning.html#reservation" class="button light">Réserver une séance</a></div></section>'},
 {id:'split',name:'Image & texte',note:'Deux colonnes',mini:'▧ Aa',html:'<section class="cms-section cms-columns" data-label="Image & texte"><img src="/site/mezzanine-presences-1200.webp" alt="Le studio"><div><p class="eyebrow">Le studio</p><h2>Un lieu de mouvement.</h2><p>Votre texte de présentation.</p><a class="text-link" href="/site/le-studio.html">Découvrir le studio</a></div></section>'},
 {id:'gallery',name:'Galerie',note:'Deux images côte à côte',mini:'▧ ▧',html:'<section class="cms-section cms-columns" data-label="Galerie"><figure><img src="/site/accessory-ball-1200.webp" alt="Ballon de Pilates"><figcaption>Votre légende.</figcaption></figure><figure><img src="/site/accessory-wood-1200.webp" alt="Accessoires"><figcaption>Votre légende.</figcaption></figure></section>'},
 {id:'cta',name:'Invitation',note:'Titre et appel à l’action',mini:'→',html:'<section class="cms-section cta-panel" data-label="Invitation"><div class="wrap"><p class="eyebrow">À vous de jouer</p><h2>Entrez dans le mouvement.</h2><p>Votre texte d’invitation.</p><a href="/site/planning.html#reservation" class="button">Réserver ma séance</a></div></section>'},
 {id:'faq',name:'Questions fréquentes',note:'Questions qui se déplient',mini:'+',html:'<section class="cms-section" data-label="Questions fréquentes"><h2>Vos questions.</h2><details><summary>Votre première question<span>+</span></summary><p>Votre réponse.</p></details><details><summary>Votre deuxième question<span>+</span></summary><p>Votre réponse.</p></details></section>'},
 {id:'cards',name:'Trois colonnes',note:'Cartes libres et modulables',mini:'▤ ▤ ▤',html:'<section class="cms-section" data-label="Trois colonnes"><h2>Une même exigence.</h2><div class="cms-columns" style="grid-template-columns:repeat(3,1fr)"><article><h3>Premier titre.</h3><p>Votre texte.</p></article><article><h3>Deuxième titre.</h3><p>Votre texte.</p></article><article><h3>Troisième titre.</h3><p>Votre texte.</p></article></div></section>'},
 {id:'image',name:'Image libre',note:'Une photographie pleine largeur',mini:'▧',html:'<section class="cms-section" data-label="Image libre"><img src="/site/movement-light-1200.webp" alt="Le mouvement"></section>'},
 {id:'spacer',name:'Espace libre',note:'Hauteur réglable',mini:'↕',html:'<section class="cms-spacer" data-label="Espace libre" style="height:80px"></section>'}
];
function addSection(){setView('editor');modal('<p class="eyebrow">Construire votre page</p><h2>Ajouter un bloc</h2><details class="simple-details" style="margin-bottom:20px"><summary>Choisir un autre emplacement (facultatif)</summary><label>Emplacement<select id="insert-position"><option value="after">Après la section sélectionnée / en bas de page</option><option value="before">Avant la section sélectionnée</option><option value="inside">À l’intérieur de l’élément sélectionné</option></select></label></details><div class="templates">'+templates.filter(t=>!['heading','paragraph','button','spacer'].includes(t.id)).map(t=>`<button class="template" data-template="${t.id}"><span class="mini">${t.mini}</span><strong>${t.name}</strong><small>${t.note}</small></button>`).join('')+'</div><details class="simple-details"><summary>Ajouter un petit élément (titre, texte ou bouton)</summary><div class="templates">'+templates.filter(t=>['heading','paragraph','button','spacer'].includes(t.id)).map(t=>`<button class="template" data-template="${t.id}"><strong>${t.name}</strong><small>${t.note}</small></button>`).join('')+'</div></details>')}
function pageSettings(isNew=false){const p=page();modal(`<p class="eyebrow">${isNew?'Nouvelle page':'Votre page'}</p><h2>${isNew?'Nouvelle page':esc(p.name)}</h2><div class="modal-fields">${field('Nom de la page','pageName',isNew?'':p.name)}<details class="simple-details"><summary>Autres options (facultatif)</summary>${field('Adresse de la page','pageSlug',isNew?'nouvelle-page':p.path==='/site/'?'':p.path.slice(6,-5))}${field('Titre pour Google','pageTitle',isNew?'Nouvelle page | Nuage Studio':p.title)}<label>Courte description pour Google<textarea data-field="pageDescription" rows="3">${esc(isNew?'':p.description)}</textarea></label>${!isNew?'<details class="simple-details"><summary>Code de mise en page</summary><textarea id="page-css" class="source-code">'+esc(p.css)+'</textarea></details>':''}</details></div><div class="modal-actions">${!isNew&&p.path!=='/site/'?'<button id="delete-page" class="button-danger">Supprimer cette page</button>':''}<button id="page-save" data-new="${isNew}" class="button-primary">${isNew?'Créer ma page':'Valider ce nom'}</button></div>`)}

async function loadMedia(target=null){mediaTarget=target;try{media=await(await api('media')).json();renderMedia(target)}catch(e){toast(e.message,true)}}
function mediaHTML(target){return `<div class="view-heading"><div><h1>${target?'Choisir une photo':'Photos'}</h1></div><button class="button-primary" id="upload-button">+ Importer des images</button></div><div class="media-toolbar"><input id="media-search" aria-label="Rechercher une image" placeholder="Rechercher une image…"><select id="media-filter" aria-label="Filtrer les images"><option value="all">Toutes les images</option><option value="uploads">Mes imports</option></select></div><div id="media-grid" class="media-grid"></div>`}
function renderMedia(target){if(target)modal(mediaHTML(target));else $('#media-view').innerHTML=mediaHTML(false);filterMedia()}
function mediaLabel(m){const key=m.name.replace(/-\d{3,4}\.(?:webp|png|jpg)$/,'').replace(/\.[^.]+$/,'');return ({'hero-noir':'Photo d’accueil — noir et blanc','mezzanine-presences':'Le studio — la mezzanine','movement-light':'Le mouvement — les pieds','movement-collective':'Les cours — mouvement collectif','accessory-ball':'Accessoires — le ballon','accessory-wood':'Accessoires — bâton et blocs','logo-nuage-transparent':'Logo Nuage — fond transparent','architecture-noir':'Architecture — noir et blanc','hero-immersive':'Autre photo d’accueil','mezzanine-duo':'Mezzanine — deux silhouettes','mezzanine-sculpt':'Mezzanine — autre ambiance','movement-noir':'Pratique — noir et blanc','studio-detail':'Détails du studio','studio-mats':'Les tapis du studio'})[key]||key.replace(/-[a-f0-9]{10}$/,'').replaceAll('-',' ')}
function filterMedia(){const q=($('#media-search')?.value||'').toLowerCase(),uploads=$('#media-filter')?.value==='uploads';const list=media.filter(m=>(!uploads||m.url.includes('/uploads/'))&&(!/-[0-9]{3,4}\.webp$/.test(m.name)||/-1200\.webp$/.test(m.name)||m.url.includes('/uploads/'))&&m.name!=='logo-original.jpg'&&(m.name+' '+mediaLabel(m)).toLowerCase().includes(q));$('#media-grid').innerHTML=list.map(m=>`<button class="media-card" data-media="${esc(m.url)}" title="Choisir : ${esc(mediaLabel(m))}"><img loading="lazy" src="${esc(m.url)}" alt="${esc(mediaLabel(m))}" ${m.name.includes('logo')?'style="background:#222;object-fit:contain;padding:12px"':''}><span>${esc(mediaLabel(m))}</span><small>${m.url.includes('/uploads/')?'Votre photo':'Photo du site'}</small></button>`).join('')||'<p class="field-help">Aucune image. Importez une photographie pour commencer.</p>'}

async function upload(files){let count=0;for(const file of files){try{if(file.size>15*1024*1024)throw Error(file.name+' dépasse 15 Mo.');const data=await new Promise((resolve,reject)=>{const reader=new FileReader;reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});const item=await(await api('upload',{name:file.name,data})).json();media.unshift(item);count++}catch(e){toast(e.message,true)}}filterMedia();if(count)toast(count+' photo(s) importée(s).')}
function renderTheme(){selection=null;const t=doc.global.theme;$('#inspector').innerHTML=`<div class="view-heading"><div><h1>Couleurs et écritures</h1></div></div><div class="settings-layout"><div class="settings-card"><h2>Palette</h2>${[['Fond clair','paper'],['Texte principal','ink'],['Accent beige','accent']].map(([l,k])=>`<label class="color-row">${l}<input type="color" data-theme="${k}" value="${t[k]}"></label>`).join('')}</div><div class="settings-card"><h2>Écritures et largeur de page</h2>${[['Style des titres','headingFont'],['Style des paragraphes','bodyFont']].map(([l,k])=>`<label>${l}<select data-theme="${k}">${['Cormorant Garamond Variable','Manrope Variable','Georgia','Arial','Helvetica'].map(f=>`<option value="${f}" ${f===t[k]?'selected':''}>${({'Cormorant Garamond Variable':'Élégante (actuelle)','Manrope Variable':'Simple et moderne','Georgia':'Classique','Arial':'Simple','Helvetica':'Sobre'})[f]||f}</option>`).join('')}</select></label>`).join('')}<div class="grid2"><label>Taille du texte<input type="number" min="10" max="26" data-theme="baseSize" value="${t.baseSize}"></label><label>Largeur de la page<input type="number" min="700" max="1920" data-theme="contentWidth" value="${t.contentWidth}"></label></div></div><div class="settings-card wide"><details class="simple-details"><summary>Options avancées de mise en page</summary><textarea id="global-css" class="source-code" rows="10">${esc(doc.global.css)}</textarea></details></div></div>`}
function renderSettings(){const s=doc.global.settings,a=addressEditor.getDraft()||s;$('#settings-view').innerHTML=`<div class="view-heading"><div><h1>Informations du studio</h1></div></div><div class="settings-layout"><div class="settings-card"><h2>Le studio</h2>${field('Nom du studio','setting-name',s.name)}${field('Instagram (sans @)','setting-instagram',s.instagram)}<h2 class="address-heading">Adresse du studio</h2>${field('Numéro et rue','setting-street',a.street,'text','data-address="street" autocomplete="street-address" maxlength="180"')}<div class="grid2">${field('Code postal','setting-postcode',a.postcode,'text','data-address="postcode" autocomplete="postal-code" inputmode="numeric" maxlength="5"')}${field('Ville','setting-city',a.city,'text','data-address="city" autocomplete="address-level2" maxlength="100"')}</div><details class="simple-details"><summary>Visibilité sur Google</summary><label><input id="setting-noindex" type="checkbox" ${s.noindex?'checked':''}> Garder le site hors des moteurs de recherche</label></details></div><div class="settings-card address-preview"><h2>La carte</h2><p class="map-drag-help">Glissez le repère pour ajuster sa position.</p><div id="address-map-preview"></div><p id="address-status" role="status" aria-live="polite"></p><div id="address-choices"></div><button id="address-reset" class="button-secondary">Replacer d’après l’adresse</button><button id="address-retry" class="button-secondary" hidden>Réessayer</button></div><div class="settings-card wide"><h2>Réservations Eversports</h2><p>À renseigner avec les liens du studio.</p>${field('Lien de réservation','setting-bookingUrl',s.bookingUrl,'url')}${field('Lien du planning','setting-scheduleUrl',s.scheduleUrl,'url')}${field('Lien des tarifs','setting-pricesUrl',s.pricesUrl,'url')}${field('Code du planning fourni par Eversports','setting-scheduleWidgetId',s.scheduleWidgetId)}</div></div>`;refreshAddressPreview();renderAddressStatus()}

async function renderHistory(){try{const revisions=await(await api('revisions')).json();$('#history-view').innerHTML=`<div class="view-heading"><div><h1>Versions sauvegardées</h1></div></div><div class="notice">Restaurez une version, puis enregistrez.</div><div class="settings-card">${revisions.length?revisions.map(r=>`<div class="history-row"><div><strong>Version ${r.revision}</strong><span>${new Date(r.date).toLocaleString('fr-FR')} · ${r.pages} pages</span></div><button class="button-secondary" data-restore="${r.revision}">Revenir à cette version</button></div>`).join(''):'<p>Votre première sauvegarde apparaîtra ici après un enregistrement.</p>'}</div>`}catch(e){toast(e.message,true)}}
function confirmAction(title,text,onConfirm){modal(`<h2>${esc(title)}</h2><p>${esc(text)}</p><div class="modal-actions"><button id="confirm-cancel" class="button-secondary">Annuler</button><button id="confirm-yes" class="button-primary">Confirmer</button></div>`);$('#confirm-cancel').onclick=closeModal;$('#confirm-yes').onclick=()=>{closeModal();onConfirm()}}
const download=(blob,name)=>{const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000)};
async function settingApply(notify=true){
 await ensureAddress();
 const s=doc.global.settings,old={...s},next={...s};for(const k of Object.keys(s).filter(k=>!['street','postcode','city'].includes(k))){const e=$(`[data-field="setting-${k}"]`);if(e)next[k]=e.value.trim()}next.instagram=next.instagram.replace(/^@/,'');next.noindex=$('#setting-noindex').checked;
 if(!/^[\w.-]*$/.test(next.instagram))throw Error('L’identifiant Instagram contient des caractères invalides.');
 for(const k of ['bookingUrl','scheduleUrl','pricesUrl'])if(next[k]&&!/^https:\/\//i.test(next[k]))throw Error('Les liens Eversports doivent commencer par https://.');
 if(JSON.stringify(next)===JSON.stringify(s))return;
 remember();
 const replacements=[['https://ig.me/m/'+old.instagram,'https://ig.me/m/'+next.instagram],['https://www.instagram.com/'+old.instagram+'/','https://www.instagram.com/'+next.instagram+'/'],...['name','street','postcode','city','instagram'].filter(k=>old[k]&&old[k]!==next[k]).map(k=>[old[k],next[k]])];
 const replaceHTML=html=>{const t=document.createElement('template');t.innerHTML=html;const walk=document.createTreeWalker(t.content,NodeFilter.SHOW_TEXT);let node;while(node=walk.nextNode())for(const [a,b]of replacements)node.nodeValue=node.nodeValue.replaceAll(a,b);for(const e of t.content.querySelectorAll('[href]'))for(const [a,b]of replacements)if(e.getAttribute('href').includes(a))e.setAttribute('href',e.getAttribute('href').replaceAll(a,b));return t.innerHTML};
 doc.global.header=replaceHTML(doc.global.header);doc.global.footer=replaceHTML(doc.global.footer);for(const p of doc.pages){p.html=replaceHTML(p.html);for(const [a,b]of replacements){p.title=p.title.replaceAll(a,b);p.description=p.description.replaceAll(a,b)}}doc.global.settings=next;syncPreview();if(notify)toast('Réglages appliqués au brouillon. Pensez à enregistrer.')
}
// Event delegation keeps the inspector usable after selection changes.
document.addEventListener('click',async e=>{
 const b=e.target.closest('button,a');if(!b)return;
 try{
  await finishInlinePreview();
  if(b.dataset.addressChoice!==undefined){addressEditor.choose(Number(b.dataset.addressChoice));return}
  if(b.id==='address-reset'){if(mapMoving||addressEditor.isPending()||!doc.global.settings.mapLocation?.manual)return;addressEditor.update(doc.global.settings);await ensureAddress();toast('Position automatique rétablie.');return}
  if(b.id==='address-retry'){await addressEditor.retry();return}
  if(b.id==='logout'){const leave=async()=>{await api('logout',{});dirty=false;location.assign('/login')};if(dirty||addressEditor.isPending())confirmAction('Quitter l’administration ?','Les modifications non enregistrées seront perdues.',leave);else await leave();return}
  if(b.dataset.view)return setView(b.dataset.view);
  if(b.dataset.page)return navigate(b.dataset.page);
  if(b.dataset.selectImage){message('select',{id:b.dataset.selectImage});return}
  if(b.dataset.select){message('select',{id:b.dataset.select});return}
  if(b.dataset.move){remember();message('move',{id:b.dataset.move,direction:b.dataset.direction});return}
  if(b.dataset.device){endLiveEdit();device=b.dataset.device;$$('[data-device]').forEach(x=>x.classList.toggle('active',x===b));resize();if(view==='theme')renderTheme();else renderInspector();return}
  if(b.dataset.tab){endLiveEdit();tab=b.dataset.tab;renderInspector();return}
  if(b.dataset.command){if(b.dataset.command==='parent')message('parent',{id:selection.id});else command(b.dataset.command,{direction:b.dataset.direction});return}
  if(b.dataset.template){command('add',{html:templates.find(t=>t.id===b.dataset.template).html,position:$('#insert-position')?.value||'after'});closeModal();return}
  if(b.dataset.media){if(mediaTarget){if(mediaTarget.kind==='background'){endLiveEdit();liveStyles({'background-image':'url("'+b.dataset.media+'")','background-size':'cover','background-position':'center','background-repeat':'no-repeat'},'background-image');endLiveEdit()}else command('image',{url:b.dataset.media});closeModal();mediaTarget=null}else{modal(`<h2>Votre image.</h2><img src="${esc(b.dataset.media)}" style="width:100%;max-height:440px;object-fit:contain;background:#eee"><p class="small-note">${esc(b.dataset.media)}</p><p>Pour l’utiliser : sélectionnez une image sur le site, puis choisissez « Changer cette photo ».</p>`)}return}
  if(b.dataset.clearStyle){endLiveEdit();liveStyles({[b.dataset.clearStyle]:'none'},'clear-'+b.dataset.clearStyle);endLiveEdit();await waitForPreview();renderInspector();return}
  if(b.dataset.restore){const rev=Number(b.dataset.restore);confirmAction('Restaurer cette version ?','Le brouillon actuel sera remplacé. Vos versions déjà enregistrées resteront disponibles.',async()=>{try{const r=await(await api('restore',{revision:rev})).json();addressEditor.cancel();doc=r.document;dirty=false;undoStack=[];redoStack=[];if(!doc.pages.some(p=>p.id===pageId))pageId=doc.pages[0].id;syncPreview();status();renderHistory();toast('Version restaurée.')}catch(e){toast(e.message,true)}});return}
  if(b.hasAttribute('data-go-editor'))return setView('editor');
  switch(b.id){
   case 'save':case 'keep-draft':await save();break;
   case 'apply':await apply();break;
   case 'undo':undo();break;case 'redo':undo(true);break;
   case 'add-section':case 'add-bottom':case 'empty-add':case 'insert-after':addSection();break;
   case 'background-image':await loadMedia({id:selection.id,kind:'background'});break;
   case 'replace-image':await loadMedia(selection.id);break;
   case 'reset-style':if(device==='mobile'){remember();delete (selection.global?(doc.global.mobileCss??={}):page().mobileCss)[selection.id];stylePreview();renderInspector()}else command('attribute',{attrs:{style:null}});break;
   case 'class-apply':command('attribute',{attrs:{class:$('[data-field="className"]').value}});break;
   case 'html-apply':command('html',{html:$('#html-value').value});break;
   case 'delete-element':confirmAction('Supprimer cet élément ?','Vous pourrez annuler cette modification avec la flèche en haut de l’éditeur.',()=>command('delete'));break;
   case 'page-settings':pageSettings();break;case 'add-page':pageSettings(true);break;
   case 'duplicate-page':{remember();const p=structuredClone(page()),id='page-'+Date.now().toString(36);p.id=id;p.path='/site/'+id+'.html';p.name+=' — copie';doc.pages.push(p);navigate(id);toast('Page dupliquée. Modifiez son nom et son adresse dans les réglages.');break}
   case 'page-save':{
    const isNew=b.dataset.new==='true',name=$('[data-field="pageName"]').value.trim(),slug=$('[data-field="pageSlug"]').value.trim();if(!name)throw Error('Donnez un nom à la page.');if(slug&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw Error('Utilisez des lettres minuscules, chiffres et tirets pour l’adresse.');const path=slug?'/site/'+slug+'.html':'/site/';if(doc.pages.some(p=>p.path===path&&(isNew||p.id!==pageId)))throw Error('Cette adresse est déjà utilisée.');if(!isNew&&page().path==='/site/'&&path!=='/site/')throw Error('Gardez l’adresse de la page d’accueil vide.');
    remember();const p=isNew?{id:'page-'+Date.now().toString(36),html:templates.find(t=>t.id==='text').html,css:'',mobileCss:{}}:page();const oldPath=p.path;p.name=name;p.path=path;p.title=$('[data-field="pageTitle"]').value;p.description=$('[data-field="pageDescription"]').value;if(!isNew)p.css=$('#page-css').value;
    if(isNew)doc.pages.push(p);else if(oldPath!==path){for(const x of doc.pages)x.html=x.html.replaceAll('href="'+oldPath,'href="'+path);doc.global.header=doc.global.header.replaceAll('href="'+oldPath,'href="'+path);doc.global.footer=doc.global.footer.replaceAll('href="'+oldPath,'href="'+path)}closeModal();navigate(p.id);toast(isNew?'Page créée.':'Réglages de page appliqués.');break;
   }
   case 'delete-page':{const id=pageId;confirmAction('Supprimer cette page ?','Pensez à retirer les liens qui pointent vers elle dans le menu et les autres pages.',()=>{remember();doc.pages=doc.pages.filter(p=>p.id!==id);navigate(doc.pages[0].id)});break}
   case 'help-button':case 'help-steps':modal('<h2>Aide</h2><div class="help-steps"><article><b>1</b><div><h3>Choisir une page</h3><p>Utilisez le menu en haut.</p></div></article><article><b>2</b><div><h3>Modifier</h3><p>Double-cliquez sur un texte pour l’écrire directement. Cliquez ailleurs pour terminer. Cliquez sur une photo pour la changer.</p><p>Les carrés règlent la taille. ✥ déplace l’élément. ↕ change l’ordre de sa section.</p></div></article><article><b>3</b><div><h3>Enregistrer</h3><p>Le bouton en haut conserve vos modifications.</p></div></article></div><p>Les flèches annulent ou rétablissent une action. Échap annule un geste en cours.</p>');break;
   case 'organize-page':$('#editor-view').classList.toggle('show-structure');resize();break;
   case 'expand-preview':$('#editor-view').classList.toggle('wide-preview');b.textContent=$('#editor-view').classList.contains('wide-preview')?'Revenir à l’édition ↙':'Agrandir ↗';resize();break;
   case 'upload-button':$('#image-upload').click();break;
   case 'settings-save':await settingApply();break;
   case 'export-data':await ensureAddress();download(new Blob([JSON.stringify(doc,null,2)],{type:'application/json'}),'nuage-projet.json');break;
   case 'export-site':{await ensureAddress();toast('Préparation de l’export statique…');const r=await api('export',{document:doc});download(await r.blob(),'nuage-site-local.zip');toast('Export prêt.');break}
  }
 }catch(err){toast(err.message,true)}
});
function liveThemeInput(el){
 const k=el.dataset.theme;if(!k&&el.id!=='global-css')return;
 const value=el.type==='number'?Number(el.value):el.value;
 if(el.type==='number'&&(!el.value||!Number.isFinite(value)))return;
 if(k==='baseSize'&&(value<10||value>26)||k==='contentWidth'&&(value<700||value>1920))return;
 if(!k&&(/<\/style|@import|expression\s*\(/i.test(value)))return;
 if(k&&doc.global.theme[k]===value&&(k!=='baseSize'||doc.global.theme.customTextSize))return;if(!k&&doc.global.css===value)return;
 rememberLive('theme|'+(k||'css'));
 if(k){doc.global.theme[k]=value;if(k==='baseSize')doc.global.theme.customTextSize=true}else doc.global.css=value;
 stylePreview(true);
}
function liveField(el){
 if(!selection)return;
 if(el.id==='text-value'){liveEdit({type:'text',value:el.value,mode:selection.textMode},'text');return}
 const key=el.dataset.field;
 if(key==='alt'){liveEdit({type:'attribute',attrs:{alt:el.value}},'alt');return}
 if(key==='href'){const href=el.value.trim();if(/^(https?:\/\/|\/site\/|#|mailto:|tel:)/.test(href))liveEdit({type:'attribute',attrs:{href}},'href');return}
 if(key==='src'){const src=el.value.trim();if(/^\/site\//.test(src)||/^https:\/\//.test(src)&&(()=>{try{return !!new URL(src).hostname}catch{return false}})())liveEdit({type:'image',url:src},'image-url')}
}
document.addEventListener('input',e=>{
 const el=e.target;
 try{
  if(el.dataset.address){updateAddressInput();return}
  if(el.dataset.field?.startsWith('setting-')||el.id==='setting-noindex'){dirty=true;status();return}
  if(el.id==='media-search')filterMedia();
  if(el.matches('[data-field="pageName"]')&&$('#page-save')?.dataset.new==='true'){const slug=$('[data-field="pageSlug"]');if(!slug.dataset.touched){slug.value=el.value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');$('[data-field="pageTitle"]').value=el.value+' | '+doc.global.settings.name}}
  if(el.matches('[data-field="pageSlug"]'))el.dataset.touched='true';
  if(el.dataset.live){const styles=styleFromControl(el,$('#inspector'));if(styles)liveStyles(styles,el.dataset.property)}
  else if(el.dataset.theme||el.id==='global-css')liveThemeInput(el);
  else liveField(el);
 }catch(err){toast(err.message,true)}
});
document.addEventListener('change',async e=>{
 const el=e.target;
 if(el.id==='page-select'){if(el.value==='__new'){pageSettings(true);$('#page-select').value=pageId}else navigate(el.value)}
 if(el.id==='link-page'&&el.value){const input=$('[data-field="href"]');input.value=el.value;liveField(input);endLiveEdit()}
 if(el.dataset.live){try{const styles=styleFromControl(el,$('#inspector'));if(styles)liveStyles(styles,el.dataset.property)}catch(err){toast(err.message,true)}endLiveEdit()}
 if(el.dataset.theme){liveThemeInput(el);endLiveEdit()}
 if(el.id==='media-filter')filterMedia();
 if(el.id==='edit-mode')message('mode',{editing:el.checked});
 if(el.id==='image-upload'){await upload(Array.from(el.files));el.value=''}
 if(el.id==='import-data'){try{const imported=JSON.parse(await el.files[0].text());if(imported.version!==1||!imported.pages?.length)throw Error('Fichier de projet invalide.');confirmAction('Importer ce projet ?','Le brouillon courant sera remplacé. Les images doivent déjà être présentes dans la médiathèque.',()=>{addressEditor.cancel();remember();imported.revision=doc.revision;doc=imported;pageId=doc.pages[0].id;navigate(pageId);status();toast('Projet importé dans le brouillon.')})}catch(err){toast(err.message,true)}el.value=''}
});
document.addEventListener('focusout',e=>{if(e.target.matches('[data-live],#text-value,[data-field="alt"],[data-field="href"],[data-field="src"],[data-theme],#global-css'))endLiveEdit()});
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='s'){e.preventDefault();apply()}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'&&!e.target.matches('input,textarea')){e.preventDefault();undo(e.shiftKey)}});
window.addEventListener('beforeunload',e=>{if(dirty||addressEditor.isPending()){e.preventDefault();e.returnValue=''}});
$$('[data-device]').forEach(b=>b.classList.toggle('active',b.dataset.device===device));
try{const state=await(await api('state')).json();doc=state.document;token=state.token;liveAt=state.liveAt;pageId=doc.pages[0].id;navigate(pageId);status()}catch(e){toast('Impossible d’ouvrir le projet : '+e.message,true)}
