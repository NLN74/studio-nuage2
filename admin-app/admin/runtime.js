(()=>{
 const maps=new Map();
 const isEditor=document.body.dataset.editor==='true';
 const settings=()=>{try{return JSON.parse(document.querySelector('meta[name="nuage-settings"]').content)}catch{return {}}};
 function init(){
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
  for(const a of document.querySelectorAll('a[href]')){const href=a.getAttribute('href');if(/(?:\.\/|\/site\/)planning\.html#reservation$/.test(href)&&s.bookingUrl)a.href=s.bookingUrl;}
  const reservation=document.querySelector('.eversports-section');
  if(reservation&&(s.scheduleWidgetId||s.scheduleUrl)){
   reservation.replaceChildren();
   if(s.scheduleWidgetId){const widget=document.createElement('div');widget.dataset.eversportsWidgetId=s.scheduleWidgetId;reservation.append(widget);const script=document.createElement('script');script.src='https://widget-static.eversports.io/loader.js';script.type='module';script.async=true;script.onerror=()=>{const p=document.createElement('p');p.textContent='Le planning ne s’affiche pas. Utilisez le lien ci-dessous ou contactez le studio sur Instagram.';reservation.prepend(p)};document.head.append(script)}
   const a=document.createElement('a');a.className='button';a.textContent=s.scheduleUrl?'Ouvrir le planning Eversports':'Écrire sur Instagram';a.href=s.scheduleUrl||'https://ig.me/m/'+s.instagram;reservation.append(a);
  }
  if(s.pricesUrl)for(const a of document.querySelectorAll('.pricing-grid a.button'))a.href=s.pricesUrl;
 }
 window.nuageInit=init;init();
})();
