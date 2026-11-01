const endpoint='https://data.geopf.fr/geocodage/search';
export function normalizeAddress(value){
 const address=Object.fromEntries(['street','postcode','city'].map(k=>[k,typeof value?.[k]==='string'?value[k].trim().replace(/\s+/g,' '):'']));
 if(address.street.length<3||address.street.length>180||!/^\d{5}$/.test(address.postcode)||address.city.length<2||address.city.length>100||Object.values(address).some(v=>/[<>\x00-\x1f]/.test(v)))throw Error('Renseignez la rue, le code postal à 5 chiffres et la ville.');
 return address;
}
export function geocodeCandidates(data,address){
 const seen=new Set();
 return (Array.isArray(data?.features)?data.features:[]).flatMap(f=>{
  const p=f.properties||{},coords=f.geometry?.coordinates;if(f.geometry?.type!=='Point'||!Array.isArray(coords))return [];
  const[lng,lat]=coords,key=lat+','+lng;
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>85||Math.abs(lng)>180||p.postcode!==address.postcode||!['housenumber','street','locality'].includes(p.type)||typeof p.label!=='string'||p.label.length>400||!Number.isFinite(p.score)||p.score<.4||seen.has(key))return [];
  seen.add(key);return [{lat,lng,label:p.label,score:p.score,type:p.type}];
 }).sort((a,b)=>b.score-a.score).slice(0,5);
}
export function createGeocoder({fetchImpl=fetch}={}){
 const cache=new Map(),pending=new Map();
 return async value=>{
  const address=normalizeAddress(value),key=JSON.stringify(address),cached=cache.get(key);
  if(cached&&Date.now()-cached.date<86400000)return structuredClone(cached.value);
  if(pending.has(key))return structuredClone(await pending.get(key));
  const task=(async()=>{
   const url=new URL(endpoint);url.searchParams.set('q',`${address.street} ${address.postcode} ${address.city}`);url.searchParams.set('postcode',address.postcode);url.searchParams.set('index','address');url.searchParams.set('limit','5');
   try{
    const r=await fetchImpl(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(8000)});
    if(!r.ok)throw Error('service');
    const results=geocodeCandidates(await r.json(),address);
    cache.set(key,{date:Date.now(),value:results});if(cache.size>100)cache.delete(cache.keys().next().value);
    return results;
   }catch{throw Error('La recherche d’adresse est indisponible. Vérifiez la connexion puis réessayez.');}
  })();pending.set(key,task);
  try{return structuredClone(await task)}finally{pending.delete(key)}
 };
}
