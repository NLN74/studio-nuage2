import {updateMapBox} from './map-links.js';
export function normalizeMapPoint(value){
 const {lat,lng}=value||{};
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>85||Math.abs(lng)>180)throw Error('Position du repère invalide.');
 return {lat:Math.round(lat*1e7)/1e7,lng:Math.round(lng*1e7)/1e7};
}
export function manualMapLocation(settings,value){
 const point=normalizeMapPoint(value);
 return {...settings.mapLocation,street:settings.street,postcode:settings.postcode,city:settings.city,label:settings.mapLocation?.label||[settings.street,settings.postcode,settings.city].filter(Boolean).join(' '),...point,manual:true};
}
export function moveMapPosition(doc,value){
 const point=manualMapLocation(doc.global.settings,value);
 const update=html=>{
  const t=document.createElement('template');t.innerHTML=html;
  for(const box of t.content.querySelectorAll('.studio-map')){
   updateMapBox(box,point);
  }
  return t.innerHTML;
 };
 doc.global.footer=update(doc.global.footer);
 for(const page of doc.pages)if(page.html.includes('studio-map'))page.html=update(page.html);
 doc.global.settings.mapLocation=point;
 return point;
}
