import {normalizeMapPoint} from './map-position.js';
// This map belongs to the admin; exported/public maps keep the static runtime.
export function createMapEditor({box,onMove,onDragState=()=>{},onError=()=>{},canMove=()=>true}){
 const L=window.L,lat=Number(box.dataset.mapLat),lng=Number(box.dataset.mapLng);
 normalizeMapPoint({lat,lng});
 const surface=document.createElement('div');surface.className='studio-map-canvas';surface.dataset.runtimeMap='true';surface.setAttribute('role','region');surface.setAttribute('aria-label','Carte du studio : déplacer le repère');box.prepend(surface);
 const map=L.map(surface,{zoomControl:false,scrollWheelZoom:false,dragging:true,doubleClickZoom:true,boxZoom:false,keyboard:true,touchZoom:true,attributionControl:false,maxZoom:19,maxBounds:[[-85,-180],[85,180]]}).setView([lat,lng],17);
 L.control.zoom({position:'topright',zoomInTitle:'Agrandir la carte',zoomOutTitle:'Réduire la carte'}).addTo(map);
 L.control.attribution({prefix:false,position:'bottomright'}).addTo(map);
 L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'}).addTo(map);
 const marker=L.marker([lat,lng],{draggable:true,autoPan:true,keyboard:true,title:'Déplacer le repère',icon:L.divIcon({className:'studio-map-pin cms-map-handle',html:'<span></span>',iconSize:[36,36],iconAnchor:[18,18]})}).addTo(map);
 marker.getElement().setAttribute('aria-label','Déplacer le repère du studio');
 let drag=null,busy=false,cancelling=false,destroyed=false;
 const link=box.querySelector('a');
 function commit(before){
  try{
   const point=normalizeMapPoint(map.wrapLatLng(marker.getLatLng()));
   if(Math.abs(before.lat-point.lat)<1e-7&&Math.abs(before.lng-point.lng)<1e-7)return;
   if(!canMove()||onMove(point)===false){marker.setLatLng(before);return}
   marker.setLatLng(point);box.dataset.mapLat=String(point.lat);box.dataset.mapLng=String(point.lng);
   if(link)link.href=`https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}#map=17/${point.lat}/${point.lng}`;
  }catch(e){marker.setLatLng(before);onError(e.message)}
 }
 function cancel(){
  if(!drag)return;const before=drag;drag=null;cancelling=true;marker.dragging.disable();marker.setLatLng(before);if(!busy&&!destroyed)marker.dragging.enable();cancelling=false;onDragState(false);
 }
 marker.on('dragstart',()=>{drag=marker.getLatLng();onDragState(true)});
 marker.on('dragend',()=>{const before=drag;drag=null;if(cancelling||!before)return;onDragState(false);commit(before)});
 const onKey=e=>{if(e.key==='Escape'&&drag){e.preventDefault();e.stopPropagation();cancel()}};
 const onMarkerKey=e=>{
  const shift={ArrowLeft:[-3,0],ArrowRight:[3,0],ArrowUp:[0,-3],ArrowDown:[0,3]}[e.key];
  if(!shift||busy||!canMove())return;e.preventDefault();e.stopPropagation();const before=marker.getLatLng(),p=map.project(before);marker.setLatLng(map.unproject(p.add(shift)));commit(before);
 };
 marker.getElement().addEventListener('keydown',onMarkerKey);
 document.addEventListener('keydown',onKey,true);window.addEventListener('blur',cancel);
 const resize=new ResizeObserver(()=>{if(!destroyed)map.invalidateSize({pan:false})});resize.observe(surface);
 return {
  isDragging:()=>!!drag,
  setBusy(value){busy=!!value;box.dataset.mapBusy=String(busy);box.setAttribute('aria-busy',String(busy));if(busy){cancel();marker.dragging.disable()}else marker.dragging.enable()},
  destroy(){destroyed=true;cancel();resize.disconnect();document.removeEventListener('keydown',onKey,true);window.removeEventListener('blur',cancel);marker.getElement()?.removeEventListener('keydown',onMarkerKey);map.remove();surface.remove()}
 };
}
