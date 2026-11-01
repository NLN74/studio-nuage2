(()=>{
 const maps=new Map();
 const isEditor=document.body.dataset.editor==='true';
 const settings=()=>{try{return JSON.parse(document.querySelector('meta[name="nuage-settings"]').content)}catch{return {}}};
 let widgetLoader;
 function loadWidgets(){
  if(!widgetLoader)widgetLoader=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://widget-static.eversports.io/loader.js';script.type='module';script.async=true;script.onload=resolve;script.onerror=reject;document.head.append(script)});
  return widgetLoader;
 }
 function init(){
  document.body.dataset.inProgress=String(settings().inProgress===true);
  const toggle=document.querySelector('.menu-toggle'),nav=document.querySelector('#primary-nav');
  if(toggle&&nav)toggle.onclick=()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));nav.classList.toggle('is-open',open);toggle.textContent=open?'Fermer':'Menu'};
  for(const [box,item]of maps)if(!document.contains(box)){item.intersection?.disconnect();item.resize?.disconnect();item.map?.remove();maps.delete(box)}
  for(const box of document.querySelectorAll('.studio-map[data-map-lat][data-map-lng]')){
   if(!window.L)continue;
   const lat=Number(box.dataset.mapLat),lng=Number(box.dataset.mapLng),signature=lat+'|'+lng+'|'+(box.dataset.mapLabel||'');
   const previous=maps.get(box);if(previous?.signature===signature)continue;if(previous){previous.intersection?.disconnect();previous.resize?.disconnect();previous.map?.remove();box.querySelector('[data-runtime-map]')?.remove();maps.delete(box);}
   if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>85||Math.abs(lng)>180)continue;
   const surface=document.createElement('div');surface.className='studio-map-canvas';surface.dataset.runtimeMap='true';surface.setAttribute('role','region');surface.setAttribute('aria-label',box.dataset.mapLabel||'Plan du studio — emplacement provisoire');box.prepend(surface);
   if(!isEditor){const openPlan=()=>{const href=box.querySelector('[data-map-provider="google"]')?.href;if(href)window.open(href,'_blank','noopener,noreferrer')};surface.style.cursor='pointer';surface.tabIndex=0;surface.setAttribute('role','link');surface.setAttribute('aria-label','Ouvrir ce plan dans Google Maps');surface.addEventListener('click',event=>{if(!event.target.closest('a,button'))openPlan()});surface.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openPlan()}})}
   const item={map:null,intersection:null,resize:null,signature};maps.set(box,item);
   const mount=()=>{
    item.intersection?.disconnect();if(!document.contains(box)||item.map)return;
    const map=item.map=L.map(surface,{zoomControl:false,scrollWheelZoom:false,dragging:false,doubleClickZoom:false,boxZoom:false,keyboard:false,touchZoom:false,attributionControl:false}).setView([lat,lng],15);
    L.control.attribution({prefix:false,position:'bottomright'}).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'}).addTo(map);
    L.marker([lat,lng],{interactive:false,keyboard:false,icon:L.divIcon({className:'studio-map-pin',html:'<span></span>',iconSize:[24,24],iconAnchor:[12,12]})}).addTo(map);
    item.resize=new ResizeObserver(()=>map.invalidateSize({pan:false}));item.resize.observe(surface);
   };
   if('IntersectionObserver'in window){item.intersection=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))mount()},{rootMargin:'150px'});item.intersection.observe(box)}else mount();
  }
  if(isEditor)return;
  const s=settings();
  const safeLink=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:''}catch{return ''}};
  const external=(a,url)=>{a.href=url;a.target='_blank';a.rel='noopener noreferrer'};
  if(s.inProgress===true){
   const pending=(document.body.dataset.siteBase||'/site/')+'planning.html#reservation';
   for(const a of document.querySelectorAll('a[href]')){const href=a.getAttribute('href');let provider=false;try{const host=new URL(href,'https://nuage.invalid').hostname;provider=/(^|\.)eversports\.(fr|com|io)$/.test(host)}catch{}
    if(a.dataset.eversportsLink||provider){a.href=pending;a.removeAttribute('target');a.removeAttribute('rel')}
   }
   return;
  }
  const booking=safeLink(s.bookingUrl),prices=safeLink(s.pricesUrl)||booking,schedule=safeLink(s.scheduleUrl);
  for(const a of document.querySelectorAll('a[href]')){const href=a.getAttribute('href');if(/(?:\.\/|\/site\/)planning\.html#reservation$/.test(href)&&booking)external(a,booking);}
  const destinations={booking,prices,profile:safeLink(s.profileUrl),app:safeLink(s.appUrl)};
  for(const a of document.querySelectorAll('[data-eversports-link]')){const url=destinations[a.dataset.eversportsLink];if(url)external(a,url)}
  const reservation=document.querySelector('.eversports-section');
  let scheduleWidget;
  if(reservation&&(s.inProgress===false||s.scheduleEnabled!==false)&&(s.scheduleWidgetId||schedule)){
   reservation.replaceChildren();
   if(s.scheduleWidgetId){scheduleWidget=document.createElement('div');scheduleWidget.dataset.eversportsWidgetId=s.scheduleWidgetId;reservation.append(scheduleWidget);loadWidgets().catch(()=>{const p=document.createElement('p');p.textContent='Le planning ne s’affiche pas. Utilisez le lien ci-dessous ou contactez le studio sur Instagram.';reservation.prepend(p)})}
   const a=document.createElement('a');a.className='button';a.textContent=schedule?'Ouvrir le planning Eversports':'Écrire sur Instagram';a.href=schedule||'https://ig.me/m/'+s.instagram;reservation.append(a);
  }
  const pricesSlot=document.querySelector('[data-eversports-prices-slot]');
  const embeddedPrices=pricesSlot&&/^[\w-]{1,100}$/.test(s.pricesWidgetId||'');
  if(embeddedPrices&&!pricesSlot.dataset.widgetMounted){
   pricesSlot.dataset.widgetMounted=s.pricesWidgetId;pricesSlot.dataset.widgetStatus='loading';pricesSlot.setAttribute('aria-busy','true');
   const widget=document.createElement('div');widget.dataset.eversportsWidgetId=s.pricesWidgetId;pricesSlot.replaceChildren(widget);
   loadWidgets().then(()=>{pricesSlot.dataset.widgetStatus='ready';pricesSlot.setAttribute('aria-busy','false')}).catch(()=>{pricesSlot.dataset.widgetStatus='error';pricesSlot.setAttribute('aria-busy','false');const message=document.createElement('p');message.textContent='Les formules ne s’affichent pas pour le moment. Vous pouvez les ouvrir sur Eversports ci-dessous.';pricesSlot.replaceChildren(message)});
  }
  for(const a of document.querySelectorAll('.pricing-grid a.button')){
   if(embeddedPrices){a.href='#formules-eversports';a.removeAttribute('target');a.removeAttribute('rel')}
   else if(prices)external(a,prices);
  }
 }
 window.nuageInit=init;init();
})();
