export const addressKey=a=>JSON.stringify(['street','postcode','city'].map(k=>String(a?.[k]||'').trim()));
const complete=a=>a.street.length>=3&&/^\d{5}$/.test(a.postcode)&&a.city.length>=2;
export function createAddressController({lookup,onStatus=()=>{},onResult,delay=800}){
 let draft=null,version=0,resolved=0,timer=null,active=null,state={kind:'idle',message:''};
 const report=(kind,message,candidates=[])=>{state={kind,message,candidates};onStatus(state)};
 const clear=()=>{clearTimeout(timer);timer=null};
 function accept(candidate,v=version){if(v!==version||!draft)return;onResult({...draft},candidate);resolved=v;report('ready','Adresse trouvée : '+candidate.label)}
 async function run(){
  clear();if(!draft||resolved===version)return true;
  const v=version,address={...draft};
  if(!complete(address)){report('incomplete','Complétez la rue, le code postal et la ville.');return false}
  if(active?.version===v)return active.promise;
  report('searching','Recherche de l’adresse…');
  const promise=(async()=>{
   try{
    const candidates=await Promise.resolve().then(()=>lookup(address));
    if(v!==version)return false;
    if(!candidates.length){report('error','Adresse introuvable. Vérifiez le numéro, la rue et la ville.');return false}
    const first=candidates[0],needsNumber=/^\s*\d/.test(address.street);
    if(first.score>=.75&&(!needsNumber||first.type==='housenumber')&&(!candidates[1]||first.score-candidates[1].score>=.07)){accept(first,v);return true}
    report('choice','Choisissez l’adresse du studio :',candidates);return false;
   }catch(e){if(v===version)report('error',e.message||'La recherche n’a pas abouti. Réessayez.');return false}
   finally{if(active?.version===v)active=null}
  })();active={version:v,promise};return promise;
 }
 return {
  update(value){clear();version++;draft=Object.fromEntries(['street','postcode','city'].map(k=>[k,String(value[k]||'').trim()]));report('waiting','Mise à jour de la carte…');timer=setTimeout(run,delay)},
  async flush(){if(!draft||resolved===version)return true;const v=version,result=await run();if(v!==version)return this.flush();return result},
  choose(index){const candidate=state.candidates[index];if(candidate)accept(candidate)},
  retry(){return run()},
  cancel(){clear();version++;draft=null;resolved=0;active=null;report('idle','')},
  getDraft:()=>draft?{...draft}:null,getState:()=>({...state}),isPending:()=>!!draft&&resolved!==version
 };
}
