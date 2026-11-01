# Nuage — administration

- Node.js 22+, sans dépendances. npm test utilise des copies temporaires ; ne pas toucher aux contenus de travail pour les essais.
- Ne jamais versionner .local-access.json, .env, données de session, brouillons, historiques, exports ou images importées.
- Conserver la connexion côté serveur, les sessions, la limitation des tentatives, les contrôles Host/Origin et les jetons propres à chaque session. Un hébergement distant exige HTTPS et un secret configuré.
- Préserver le style du site à l’ouverture. Les fonctions d’édition restent réservées au panneau et absentes du site exporté.
- Interface cliente concise et explicite en français ; un bouton principal Enregistrer.
- Le repère peut être ajusté puis replacé selon l’adresse, même après enregistrement et réouverture. Les coordonnées et le lien d’itinéraire doivent rester synchronisés.

- Les groupes de cartes (coachs, tarifs, questions, cours et galeries) proposent un ajout, un déplacement et une suppression du bon élément, même quand un texte intérieur est sélectionné. Garder les réglages mobiles lors de la copie et une seule annulation par action. Les fiches coach contiennent une photo, un nom et trois mots distincts. L’onglet Infos affiche les dimensions et les données de l’image sans changer le style.
