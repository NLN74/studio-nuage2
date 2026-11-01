# Nuage — administration

- Node.js 22+, sans dépendances. npm test utilise des copies temporaires ; ne pas toucher aux contenus de travail pour les essais.
- Ne jamais versionner .local-access.json, .env, données de session, brouillons, historiques, exports ou images importées.
- Conserver la connexion côté serveur, les sessions, la limitation des tentatives, les contrôles Host/Origin et les jetons propres à chaque session. Un hébergement distant exige HTTPS et un secret configuré.
- Préserver le style du site à l’ouverture. Les fonctions d’édition restent réservées au panneau et absentes du site exporté.
- Interface cliente concise et explicite en français ; un bouton principal Enregistrer.
- Le repère peut être ajusté puis replacé selon l’adresse, même après enregistrement et réouverture. Les coordonnées et le lien d’itinéraire doivent rester synchronisés.

- Les groupes de cartes (coachs, tarifs, questions, cours et galeries) proposent un ajout, un déplacement et une suppression du bon élément, même quand un texte intérieur est sélectionné. Garder les réglages mobiles lors de la copie et une seule annulation par action. Les fiches coach contiennent une photo, un nom et trois mots distincts. L’onglet Infos affiche les dimensions et les données de l’image sans changer le style.

- Quatre coachs à l’ouverture, une page de présentation par carte, modifiable dans le panneau. Conserver la synchronisation du nom, du portrait et des trois mots, sans écraser la biographie. Aucun libellé de provenance technique visible. Le plan ouvre Google Maps par défaut et propose Apple Plans ; garder la position manuelle, une carte visible sans scripts et des icônes SVG sans emoji. La section des accessoires possède un fond gris distinct.

- Identité : conserver le logo NUAGE complet, sans monogramme N. Favicon, icônes mobiles, manifeste et Open Graph sont publics. Les métadonnées utilisent des URLs absolues selon l’hôte ; garder les exports portables. Les nouvelles photos des coachs utilisent le WebP, sans perdre les imports ni les sauvegardes. Après le premier redémarrage, le serveur recharge le modèle de rendu modifié sans couper le tunnel.
