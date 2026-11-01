const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const demoCoaches=[
 {name:'Coach 01',image:'/site/coach-pilates.webp',words:['Précision','Énergie','Audace'],discipline:'Pilates Sculpt',pageId:'coach-01'},
 {name:'Coach 02',image:'/site/coach-barre.webp',words:['Rythme','Présence','Intensité'],discipline:'Barre',pageId:'coach-02'},
 {name:'Coach 03',image:'/site/coach-renforcement.webp',words:['Force','Fluidité','Élan'],discipline:'Calisthenics',pageId:'coach-03'},
 {name:'Coach 04',image:'/site/coach-yoga.webp',words:['Mobilité','Équilibre','Intuition'],discipline:'Yoga',pageId:'coach-04'}
];
export function coachCard(coach={...demoCoaches[0],name:'Prénom Nom'}){
 const href='/site/'+coach.pageId+'.html';
 return `<article class="coach-card" data-coach-page="${esc(coach.pageId)}"><a class="coach-card-link" href="${esc(href)}"><div class="coach-portrait"><img src="${esc(coach.image)}" alt="${esc(coach.name)} — ${esc(coach.discipline||'Coaching')}" loading="lazy" width="800" height="1000"></div><div class="coach-caption"><h3 data-coach-name>${esc(coach.name)}</h3><ul class="coach-words" aria-label="En trois mots">${coach.words.map(word=>`<li data-coach-word>${esc(word)}</li>`).join('')}</ul><span class="coach-more">En savoir plus <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true" focusable="false"><path d="M5 15 15 5M5 5h10v10"></path></svg></span></div></a></article>`;
}
export function coachesSection(coaches=demoCoaches){return `<section class="coaches-section wrap" data-label="Les coachs"><div class="coaches-heading"><p class="eyebrow">Les coachs</p><h2>Des personnalités.<br>Une même impulsion.</h2></div><div class="coach-grid">${coaches.map(coachCard).join('')}</div></section>`}
export function coachPage(coach){return {id:coach.pageId,path:'/site/'+coach.pageId+'.html',coachProfile:true,name:coach.name,title:coach.name+' — Nuage Studio',description:'Rencontrez '+coach.name+', au studio Nuage à Sevrier.',css:'',mobileCss:{},html:`<section class="coach-profile wrap"><a class="coach-back text-link" href="/site/">Toute l’équipe</a><div class="coach-profile-grid"><div class="coach-profile-portrait"><img data-coach-profile-image src="${esc(coach.image)}" alt="${esc(coach.name)}" width="800" height="1000"></div><div class="coach-profile-copy"><p class="eyebrow">Nuage Studio · Les coachs</p><h1 data-coach-profile-name>${esc(coach.name)}</h1><ul class="coach-words" data-coach-profile-words aria-label="En trois mots">${coach.words.map(word=>`<li>${esc(word)}</li>`).join('')}</ul><div class="coach-profile-bio"><h2>Son approche</h2><p>Une présentation de cet enseignant sera ajoutée prochainement.</p></div><div class="coach-profile-courses"><h2>Ses cours</h2><p>${esc(coach.discipline||'Les cours seront précisés prochainement.')}</p></div><a class="button" href="/site/planning.html#reservation">Réserver une séance</a></div></div></section>`}}
function fragment(html){const t=document.createElement('template');t.innerHTML=html;return t}
// Keep the photo, name and three words consistent while preserving the biography and its layout.
export function syncCoachData(doc,sourcePageId){
 const source=doc.pages.find(p=>p.id===sourcePageId);if(!source)return;
 if(source.coachProfile){
  const profile=fragment(source.html),name=profile.content.querySelector('[data-coach-profile-name]')?.textContent,image=profile.content.querySelector('[data-coach-profile-image]'),words=Array.from(profile.content.querySelectorAll('[data-coach-profile-words] li')).map(n=>n.textContent);
  if(!name||!image)return;
  if(source.description===`Rencontrez ${source.name}, au studio Nuage à Sevrier.`)source.description=`Rencontrez ${name}, au studio Nuage à Sevrier.`;source.name=name;source.title=name+' — Nuage Studio';
  for(const page of doc.pages.filter(p=>!p.coachProfile)){
   const t=fragment(page.html);let changed=false;
   for(const card of t.content.querySelectorAll('.coach-card[data-coach-page]'))if(card.dataset.coachPage===source.id){card.querySelector('[data-coach-name]').textContent=name;const photo=card.querySelector('img');photo.setAttribute('src',image.getAttribute('src'));photo.alt=image.alt;photo.removeAttribute('srcset');card.querySelectorAll('[data-coach-word]').forEach((n,i)=>n.textContent=words[i]||'');changed=true}
   if(changed)page.html=t.innerHTML;
  }
 }else{
  const t=fragment(source.html);
  for(const card of t.content.querySelectorAll('.coach-card[data-coach-page]')){
   const target=doc.pages.find(p=>p.id===card.dataset.coachPage&&p.coachProfile);if(!target)continue;
   const profile=fragment(target.html),name=card.querySelector('[data-coach-name]')?.textContent,image=card.querySelector('img');if(!name||!image)continue;
   const heading=profile.content.querySelector('[data-coach-profile-name]'),photo=profile.content.querySelector('[data-coach-profile-image]');if(heading)heading.textContent=name;if(photo){photo.setAttribute('src',image.getAttribute('src'));photo.alt='Portrait de '+name;photo.removeAttribute('srcset')}
   const words=Array.from(card.querySelectorAll('[data-coach-word]')).map(n=>n.textContent);profile.content.querySelectorAll('[data-coach-profile-words] li').forEach((n,i)=>n.textContent=words[i]||'');target.html=profile.innerHTML;if(target.description===`Rencontrez ${target.name}, au studio Nuage à Sevrier.`)target.description=`Rencontrez ${name}, au studio Nuage à Sevrier.`;target.name=name;target.title=name+' — Nuage Studio';
  }
 }
}
