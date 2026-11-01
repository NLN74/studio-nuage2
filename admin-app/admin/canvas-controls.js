(function(){
 const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
 function resizeBox(start,dx,dy,edge,keepRatio=false){
  let w=start.width,h=start.height;
  if(edge.includes('e'))w+=dx;if(edge.includes('w'))w-=dx;
  if(edge.includes('s'))h+=dy;if(edge.includes('n'))h-=dy;
  if(keepRatio&&edge.length===2){
   const sx=w/start.width,sy=h/start.height;
   let scale=Math.abs(sx-1)>=Math.abs(sy-1)?sx:sy;
   scale=clamp(scale,Math.max(24/start.width,24/start.height),Math.min(4000/start.width,4000/start.height));w=start.width*scale;h=start.height*scale;
  }else{w=clamp(w,24,4000);h=clamp(h,24,4000)}
  return {width:w,height:h,x:edge.includes('w')?start.width-w:0,y:edge.includes('n')?start.height-h:0};
 }
 function translateValue(raw,size){
  if(!raw||raw==='none')return {x:0,y:0};const p=String(raw).trim().split(/\s+/);
  const value=(v,dimension)=>v?.endsWith('%')?parseFloat(v)*dimension/100:parseFloat(v)||0;
  return {x:value(p[0],size.width),y:value(p[1],size.height)};
 }
 function dropIndex(rects,y){const i=rects.findIndex(r=>y<r.top+r.height/2);return i<0?rects.length:i}
 const px=n=>Math.round(n*100)/100+'px';
 function create(options){
  const doc=options.document||document,win=doc.defaultView;
  let selected=null,scale=1,gesture=null,raf=0,suppressClick=false,suspended=false;
  const layer=doc.createElement('div');layer.id='cms-selection';layer.dataset.editorUi='true';
  layer.innerHTML='<div class="cms-selection-box"></div><div class="cms-canvas-toolbar"><button type="button" data-canvas-action="move" title="Glissez pour déplacer cet élément librement">✥ Déplacer</button><button type="button" data-canvas-action="order" title="Glissez pour changer l’ordre de cette section dans la page">↕ Ordre</button><button type="button" data-canvas-action="parent" title="Sélectionner le bloc qui contient cet élément">Bloc ↑</button></div><div class="cms-canvas-measure"></div><div class="cms-drop-line"><span>Déposer ici</span></div><div class="cms-drag-ghost"></div>';
  const box=layer.querySelector('.cms-selection-box'),toolbar=layer.querySelector('.cms-canvas-toolbar'),measure=layer.querySelector('.cms-canvas-measure'),line=layer.querySelector('.cms-drop-line'),ghost=layer.querySelector('.cms-drag-ghost');
  const edges={nw:'coin supérieur gauche',n:'bord supérieur',ne:'coin supérieur droit',e:'bord droit',se:'coin inférieur droit',s:'bord inférieur',sw:'coin inférieur gauche',w:'bord gauche'};
  for(const[edge,label]of Object.entries(edges)){const b=doc.createElement('button');b.type='button';b.className='cms-resize-handle';b.dataset.canvasResize=edge;b.setAttribute('aria-label','Redimensionner depuis le '+label);b.title='Tirez pour redimensionner';layer.append(b)}
  const style=doc.createElement('style');style.id='cms-canvas-css';style.textContent=`
#cms-selection{position:fixed;inset:0;z-index:2147483600;pointer-events:none;--cms-ui:1;font-family:Arial,sans-serif!important}#cms-selection *{box-sizing:border-box}#cms-selection[hidden]{display:none!important}#cms-selection .cms-selection-box{position:fixed;outline:2px solid #a65339;outline-offset:-1px;pointer-events:none}#cms-selection .cms-canvas-toolbar{position:fixed;display:flex;align-items:center;gap:1px;background:#fffaf2;border:1px solid #a65339;box-shadow:0 2px 8px #0002;border-radius:calc(4px * var(--cms-ui));padding:calc(2px * var(--cms-ui));pointer-events:auto;white-space:nowrap}#cms-selection button{font-family:Arial,sans-serif!important;font-size:calc(11px * var(--cms-ui))!important;line-height:1!important;background:#fffaf2;color:#763f2b;border:0;min-height:calc(26px * var(--cms-ui));padding:calc(6px * var(--cms-ui)) calc(7px * var(--cms-ui));border-radius:2px;touch-action:none;cursor:grab}#cms-selection button:hover{background:#f1e0d5}#cms-selection button:disabled{opacity:.35;cursor:default}#cms-selection button:focus-visible{outline:2px solid #415c2d;outline-offset:2px}#cms-selection .cms-resize-handle{position:fixed;min-height:0;width:calc(11px * var(--cms-ui));height:calc(11px * var(--cms-ui));border:calc(1.5px * var(--cms-ui)) solid #a65339;padding:0;background:#fffaf2;border-radius:2px;pointer-events:auto;transform:translate(-50%,-50%);box-shadow:0 1px 2px #0002}#cms-selection [data-canvas-resize=n],#cms-selection [data-canvas-resize=s]{cursor:ns-resize}#cms-selection [data-canvas-resize=e],#cms-selection [data-canvas-resize=w]{cursor:ew-resize}#cms-selection [data-canvas-resize=nw],#cms-selection [data-canvas-resize=se]{cursor:nwse-resize}#cms-selection [data-canvas-resize=ne],#cms-selection [data-canvas-resize=sw]{cursor:nesw-resize}#cms-selection .cms-canvas-measure{position:fixed;display:none;font:calc(10px * var(--cms-ui))/1.4 Arial,sans-serif!important;background:#a65339;color:white;border-radius:3px;padding:calc(4px * var(--cms-ui)) calc(7px * var(--cms-ui));white-space:nowrap}#cms-selection .cms-drop-line{position:fixed;display:none;height:3px;background:#a65339;border-radius:2px}#cms-selection .cms-drop-line span{position:absolute;left:12px;bottom:5px;padding:4px 7px;border-radius:3px;background:#a65339;color:white;font:calc(10px * var(--cms-ui))/1.2 Arial,sans-serif}#cms-selection .cms-drag-ghost{position:fixed;display:none;padding:calc(11px * var(--cms-ui));background:#fffaf2;color:#763f2b;border:2px solid #a65339;border-radius:5px;box-shadow:0 4px 18px #0003;font:calc(11px * var(--cms-ui))/1.5 Arial,sans-serif;max-width:calc(230px * var(--cms-ui))}body.cms-pointer-edit,body.cms-pointer-edit *{user-select:none!important}body.cms-pointer-edit{cursor:grabbing!important}
`;
  doc.head.append(style);doc.body.append(layer);layer.hidden=true;
  function section(e){return e?.closest('#main > *')||null}
  function parent(e){return e?.parentElement?.closest('[data-nid]')||null}
  function draw(){
   if(suspended||!selected||!doc.contains(selected)){layer.hidden=true;return}layer.hidden=false;
   const r=selected.getBoundingClientRect(),u=1/scale;
   Object.assign(box.style,{left:px(r.left),top:px(r.top),width:px(r.width),height:px(r.height)});
   const points={nw:[r.left,r.top],n:[r.left+r.width/2,r.top],ne:[r.right,r.top],e:[r.right,r.top+r.height/2],se:[r.right,r.bottom],s:[r.left+r.width/2,r.bottom],sw:[r.left,r.bottom],w:[r.left,r.top+r.height/2]};
   for(const b of layer.querySelectorAll('[data-canvas-resize]')){const[x,y]=points[b.dataset.canvasResize];b.style.left=px(x);b.style.top=px(y);b.hidden=!!gesture&&gesture.kind==='order'}
   toolbar.querySelector('[data-canvas-action="order"]').disabled=!section(selected);
   toolbar.querySelector('[data-canvas-action="parent"]').disabled=!parent(selected);
   const tw=toolbar.getBoundingClientRect().width;
   toolbar.style.left=px(clamp(r.left,7*u,Math.max(7*u,win.innerWidth-tw-7*u)));
   toolbar.style.top=px(clamp(r.top>=38*u?r.top-36*u:7*u,7*u,Math.max(7*u,win.innerHeight-40*u)));
   if(gesture){measure.style.display='block';measure.textContent=Math.round(r.width)+' × '+Math.round(r.height)+' px';measure.style.left=px(clamp(r.left,8,win.innerWidth-150*u));measure.style.top=px(clamp(r.bottom+9*u,8,win.innerHeight-30*u))}else measure.style.display='none';
  }
  function update(e){selected=e;draw()}
  function setScale(value){scale=clamp(Number(value)||1,.1,2);layer.style.setProperty('--cms-ui',1/scale);draw()}
  function applyStyles(styles){const signature=JSON.stringify(styles);if(gesture.signature===signature){draw();return}gesture.signature=signature;gesture.lastStyles=styles;for(const[k,v]of Object.entries(styles))gesture.element.style.setProperty(k,v,'important');options.onStyle?.(styles,gesture.token);draw()}
  function orderTarget(){
   const g=gesture,others=Array.from(g.parent.children).filter(e=>e!==g.element),rects=others.map(e=>e.getBoundingClientRect());g.before=others[dropIndex(rects,g.point.y)]||null;
   const rect=g.before?.getBoundingClientRect()||rects.at(-1)||g.element.getBoundingClientRect(),p=g.parent.getBoundingClientRect();
   const y=g.before?rect.top:rect.bottom;line.style.display='block';line.style.left=px(Math.max(8,p.left+8));line.style.width=px(Math.max(30,Math.min(win.innerWidth-16,p.width-16)));line.style.top=px(clamp(y,5,win.innerHeight-5));
   ghost.style.display='block';ghost.textContent=options.label?.(g.element)||'Déplacer cette section';ghost.style.left=px(clamp(g.point.x+15,8,win.innerWidth-235/scale));ghost.style.top=px(clamp(g.point.y+15,8,win.innerHeight-65/scale));
  }
  function step(){
   raf=0;const g=gesture;if(!g)return;
   if(g.changed){const edge=55/scale;let scroll=0;if(g.point.y<edge)scroll=-clamp((edge-g.point.y)/4,2,20);if(g.point.y>win.innerHeight-edge)scroll=clamp((g.point.y-win.innerHeight+edge)/4,2,20);if(scroll)win.scrollBy(0,scroll)}
   if(g.kind==='order'){if(g.changed)orderTarget();draw()}
   else if(g.changed){
    const dx=g.point.x-g.start.x,dy=g.point.y-g.start.y+win.scrollY-g.scrollY;
    if(g.kind==='move')applyStyles({'translate':px(g.translation.x+dx)+' '+px(g.translation.y+dy)});
    else{
     const corner=g.edge.length===2,keep=corner&&(g.image?!g.shift:g.shift),r=resizeBox(g.size,dx/g.factor.x,dy/g.factor.y,g.edge,keep);
     const styles={width:px(r.width),height:px(r.height),'max-width':'none','max-height':'none','min-width':'0px','min-height':'0px','box-sizing':'border-box'};
     if(g.display==='inline')styles.display='inline-block';
     if(r.x||r.y)styles.translate=px(g.translation.x+r.x*g.factor.x)+' '+px(g.translation.y+r.y*g.factor.y);
     applyStyles(styles);
    }
   }
   if(gesture&&g.changed)raf=win.requestAnimationFrame(step);
  }
  function start(event,kind,edge){
   if(event.button!==0||gesture||!selected)return;
   let element=selected;
   if(kind==='order'){element=section(element);if(!element)return}
   if((kind==='resize'||kind==='move')&&element.matches('.logo-crop img'))element=element.closest('.logo-crop');else if((kind==='resize'||kind==='move')&&element.matches('.image-link > img'))element=element.closest('.image-link');
   if(element!==selected)options.select?.(element);
   selected=element;
   const r=element.getBoundingClientRect(),s=win.getComputedStyle(element);const dimension=axis=>{let n=parseFloat(s[axis]);if(!Number.isFinite(n)||s.display==='inline')return axis==='width'?(element.offsetWidth||r.width):(element.offsetHeight||r.height);if(s.boxSizing!=='border-box')for(const side of axis==='width'?['Left','Right']:['Top','Bottom'])n+=(parseFloat(s['padding'+side])||0)+(parseFloat(s['border'+side+'Width'])||0);return n};const size={width:dimension('width'),height:dimension('height')};
   if(!size.width||!size.height)return;
   event.preventDefault();event.stopPropagation();
   const token='gesture-'+Date.now().toString(36),target=event.target;
   gesture={token,kind,edge,element,parent:element.parentElement,capture:target,pointerId:event.pointerId,start:{x:event.clientX,y:event.clientY},point:{x:event.clientX,y:event.clientY},scrollY:win.scrollY,size,factor:{x:r.width/size.width||1,y:r.height/size.height||1},translation:translateValue(s.translate,size),image:element.tagName==='IMG'||element.classList.contains('logo-crop')||element.classList.contains('image-link'),shift:event.shiftKey,display:s.display,original:element.getAttribute('style'),changed:false};
   try{target.setPointerCapture(event.pointerId)}catch{}
   doc.body.classList.add('cms-pointer-edit');options.onStart?.({token,kind,id:element.dataset.nid});draw();
  }
  function move(event){
   const g=gesture;if(!g||event.pointerId!==g.pointerId)return;
   event.preventDefault();g.point={x:event.clientX,y:event.clientY};g.shift=event.shiftKey;
   if(!g.changed&&Math.hypot(g.point.x-g.start.x,g.point.y-g.start.y)>3)g.changed=true;
   if(!raf)raf=win.requestAnimationFrame(step);
  }
  function finish(cancel=false){
   const g=gesture;if(!g)return;
   if(raf){win.cancelAnimationFrame(raf);raf=0}if(!cancel&&g.changed)step();
   if(raf){win.cancelAnimationFrame(raf);raf=0}
   let changed=g.changed;if(changed&&g.kind!=='order'&&g.lastStyles){const t=translateValue(g.lastStyles.translate||px(g.translation.x)+' '+px(g.translation.y),g.size);if(g.kind==='move')changed=Math.abs(t.x-g.translation.x)>.1||Math.abs(t.y-g.translation.y)>.1;else changed=Math.abs(parseFloat(g.lastStyles.width)-g.size.width)>.1||Math.abs(parseFloat(g.lastStyles.height)-g.size.height)>.1||Math.abs(t.x-g.translation.x)>.1||Math.abs(t.y-g.translation.y)>.1;}
   if(g.kind==='order'&&!cancel&&changed){const before=g.before||null;changed=before!==g.element.nextElementSibling&&!(before===null&&g.element.nextElementSibling===null);if(changed){g.parent.insertBefore(g.element,before);options.onOrder?.(g.token)}}
   if(cancel||!changed){if(g.original===null)g.element.removeAttribute('style');else g.element.setAttribute('style',g.original)}
   gesture=null;
   try{g.capture.releasePointerCapture(g.pointerId)}catch{}
   doc.body.classList.remove('cms-pointer-edit');line.style.display='none';ghost.style.display='none';suppressClick=true;win.setTimeout(()=>suppressClick=false,100);
   options.onEnd?.({token:g.token,changed,cancel});draw();
  }
  layer.addEventListener('pointerdown',event=>{const b=event.target.closest('button');if(b?.disabled)return;if(b?.dataset.canvasResize)start(event,'resize',b.dataset.canvasResize);else if(b?.dataset.canvasAction==='move')start(event,'move');else if(b?.dataset.canvasAction==='order')start(event,'order')});
  layer.addEventListener('click',event=>{if(event.target.closest('[data-canvas-action="parent"]')){const e=parent(selected);if(e)options.select?.(e)}});
  doc.addEventListener('pointermove',move,{capture:true,passive:false});doc.addEventListener('pointerup',event=>{if(gesture&&event.pointerId===gesture.pointerId)finish(false)},true);doc.addEventListener('pointercancel',()=>finish(true),true);layer.addEventListener('lostpointercapture',event=>{if(gesture&&event.pointerId===gesture.pointerId)finish(true)},true);
  doc.addEventListener('keydown',event=>{if(gesture&&event.key==='Escape'){event.preventDefault();event.stopPropagation();finish(true)}},true);
  win.addEventListener('blur',()=>{if(gesture)finish(true)});
  win.addEventListener('scroll',()=>{if(gesture?.kind==='order'&&gesture.changed)orderTarget();draw()},{passive:true});win.addEventListener('resize',draw);
  return {update,setScale,suspend(value){suspended=!!value;draw()},clear(){if(gesture)finish(true);selected=null;layer.hidden=true},isActive:()=>!!gesture,consumeClick:()=>suppressClick};
 }
 const api={create,geometry:{resizeBox,translateValue,dropIndex}};
 if(typeof window!=='undefined')window.NuageCanvas=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
