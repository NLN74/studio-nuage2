const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const demoCoaches=[
 {name:'Camille',image:'/site/coach-camille-ia.jpg',words:['Précision','Énergie','Audace']},
 {name:'Inès',image:'/site/coach-ines-ia.jpg',words:['Rythme','Présence','Intensité']},
 {name:'Gabriel',image:'/site/coach-gabriel-ia.jpg',words:['Force','Fluidité','Élan']}
];
export function coachCard(coach={name:'Prénom Nom',image:demoCoaches[0].image,words:['Énergie','Précision','Élan']}){
 return `<article class="coach-card"><div class="coach-portrait"><img src="${esc(coach.image)}" alt="Portrait de ${esc(coach.name)}" loading="lazy" width="800" height="1000"></div><div class="coach-caption"><h3 data-coach-name>${esc(coach.name)}</h3><ul class="coach-words" aria-label="En trois mots">${coach.words.map(word=>`<li data-coach-word>${esc(word)}</li>`).join('')}</ul></div></article>`;
}
export function coachesSection(){return `<section class="coaches-section wrap" data-label="Les coachs"><div class="coaches-heading"><p class="eyebrow">Les coachs</p><h2>Des personnalités.<br>Une même impulsion.</h2></div><div class="coach-grid">${demoCoaches.map(coachCard).join('')}</div><p class="coaches-note">Équipe de démonstration · portraits générés par IA</p></section>`}
