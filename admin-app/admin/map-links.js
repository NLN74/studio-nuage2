export function mapLinks(point){
 const lat=Number(point.lat),lng=Number(point.lng);
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>85||Math.abs(lng)>180)throw Error('Position du studio invalide.');
 const destination=`${lat},${lng}`;
 return {google:'https://www.google.com/maps/dir/?'+new URLSearchParams({api:'1',destination}),apple:'https://maps.apple.com/directions?'+new URLSearchParams({destination})};
}
export function staticTiles(point,zoom=15){
 mapLinks(point);const n=2**zoom,lat=Number(point.lat)*Math.PI/180,x=(Number(point.lng)+180)/360*n,y=(1-Math.asinh(Math.tan(lat))/Math.PI)/2*n,baseX=Math.floor(x)-1,baseY=Math.floor(y)-1;
 const tiles=[];
 for(let row=0;row<3;row++)for(let col=0;col<3;col++){const tx=((baseX+col)%n+n)%n,ty=Math.max(0,Math.min(n-1,baseY+row));tiles.push({url:`https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`,left:col*256,top:row*256})}
 return {tiles,x:(x-baseX)*256,y:(y-baseY)*256};
}
export const arrowIcon='<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true" focusable="false"><path d="M5 15 15 5M5 5h10v10"></path></svg>';
export function staticMapMarkup(point){
 const grid=staticTiles(point);
 return `<div class="studio-map-static"><a class="map-preview-hit" data-map-provider="google" href="${mapLinks(point).google.replaceAll('&','&amp;')}" target="_blank" rel="noopener noreferrer" aria-label="Ouvrir ce plan dans Google Maps"></a><div class="map-tile-grid" aria-hidden="true" style="transform:translate(-${grid.x}px,-${grid.y}px)">${grid.tiles.map(tile=>`<img src="${tile.url}" alt="" width="256" height="256" loading="lazy" style="left:${tile.left}px;top:${tile.top}px">`).join('')}</div><span class="map-static-pin"></span><a class="map-static-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" tabindex="-1">© OpenStreetMap</a></div>`;
}
export function mapBoxMarkup(point){
 const links=mapLinks(point);
 return `${staticMapMarkup(point)}<div class="map-directions"><a data-map-provider="google" class="map-primary" href="${links.google.replaceAll('&','&amp;')}" target="_blank" rel="noopener noreferrer" aria-label="Ouvrir l’itinéraire dans Google Maps"><span>Google Maps</span>${arrowIcon}</a><details class="map-apps"><summary aria-label="Choisir une application de cartes" title="Autre application"><svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true" focusable="false"><path d="m5 7 5 5 5-5"></path></svg></summary><div class="map-apps-menu"><a data-map-provider="google" href="${links.google.replaceAll('&','&amp;')}" target="_blank" rel="noopener noreferrer">Google Maps</a><a data-map-provider="apple" href="${links.apple.replaceAll('&','&amp;')}" target="_blank" rel="noopener noreferrer">Apple Plans</a></div></details></div>`;
}
export function updateMapBox(box,point){
 const links=mapLinks(point);box.dataset.mapLat=String(point.lat);box.dataset.mapLng=String(point.lng);if(point.label)box.dataset.mapLabel=point.label;
 for(const link of box.querySelectorAll('[data-map-provider]'))link.href=links[link.dataset.mapProvider];
 const legacy=box.querySelector(':scope > a');if(legacy)legacy.href=links.google;
 const fallback=box.querySelector('.studio-map-static');
 if(fallback){const t=box.ownerDocument.createElement('template');t.innerHTML=staticMapMarkup(point);fallback.replaceWith(t.content.firstElementChild)}
}
