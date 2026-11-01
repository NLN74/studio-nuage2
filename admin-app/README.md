# Nuage — Administration

Éditeur du site Nuage Studio : textes dans l’aperçu, photos, sections, mise en page, adresse et carte, sauvegardes et export statique.

## Ouvrir sur un ordinateur

Node.js 22 ou plus récent est nécessaire. Aucune dépendance supplémentaire.

```sh
npm run password
npm start
```

Le réglage du mot de passe masque la saisie et conserve seulement une empreinte scrypt salée dans `.local-access.json`, ignoré par Git. La connexion se fait sur `http://127.0.0.1:4380/admin/`. Les lanceurs Windows et macOS ouvrent cette même adresse après la configuration initiale.

Les contenus de démonstration sont initialisés depuis `seed/site.json` uniquement si les fichiers de travail manquent. Les démarrages suivants conservent les données existantes.

## Préparer un hébergement

GitHub héberge les sources. [GitHub Pages sert des fichiers statiques et ne fournit pas le serveur de cette application](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages). Pour une administration utilisable en ligne, déployer ce dossier sur un hébergement Node.js avec stockage persistant et HTTPS.

Configuration de l’hébergement :

- `NUAGE_ADMIN_PASSWORD_HASH` : empreinte scrypt provenant de la configuration privée ; à placer dans le gestionnaire de secrets de l’hébergeur.
- `PUBLIC_ORIGIN` : origine HTTPS exacte, par exemple `https://admin.example.com`, sans chemin.
- `HOST=0.0.0.0` et `PORT=4380` pour un conteneur derrière un proxy HTTPS. Le proxy doit conserver le domaine dans l’en-tête Host.
- Volumes persistants : `data/` et `site/uploads/`. Les sessions expirent après huit heures et sont invalidées au redémarrage.

Le serveur refuse un démarrage distant sans origine HTTPS ou sans mot de passe configuré. Les API, l’aperçu modifiable et les fichiers du panneau nécessitent une session. Les écritures nécessitent aussi le jeton propre à cette session et une origine autorisée. La connexion limite les tentatives ; les cookies sont HttpOnly, SameSite=Lax, et Secure en HTTPS.

Le mot de passe, son empreinte réelle, les cookies, les sauvegardes, les brouillons et les images importées ne sont pas versionnés. Une empreinte peut être remplacée en relançant `npm run password`, puis en redémarrant le serveur ; sur un hébergement, remplacer le secret et redémarrer.

### Conteneur

```sh
docker build -t nuage-admin .
docker run --env-file .env -p 4380:4380 -v nuage-data:/app/data -v nuage-images:/app/site/uploads nuage-admin
```

Le secret GitHub Actions `NUAGE_ADMIN_PASSWORD_HASH` est préparé pour un futur déploiement. L’hébergeur doit recevoir cette valeur dans son propre gestionnaire de secrets. Le fichier `.env` reste privé. Le déploiement du serveur et la configuration du domaine sont distincts du site vitrine sur Pages.

## Modifier le site

Voir `LISEZ-MOI.md` pour l’utilisation du panneau. Enregistrer conserve les changements dans le site servi par cette application. Le bouton Exporter le site produit un ZIP public sans administration ; il ne pousse rien vers GitHub.

Dans Infos du studio, modifier l’adresse déplace automatiquement la carte. Le repère peut ensuite être glissé à la souris. Replacer d’après l’adresse relance sa localisation automatique, y compris après avoir enregistré une position manuelle ; Enregistrer conserve le résultat.

## Vérifier

```sh
npm test
```

Les tests créent des copies temporaires et ne changent pas les contenus de travail. Ils couvrent l’accès, les sessions, les écritures, les fichiers importés, la restauration, l’export, les positions de carte et les interactions de l’éditeur. Les gestes et la connexion sont également vérifiés dans le navigateur.
