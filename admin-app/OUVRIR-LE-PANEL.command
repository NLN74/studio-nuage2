#!/bin/zsh
cd "${0:A:h}" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if /usr/bin/curl --silent --fail http://127.0.0.1:4380/login >/dev/null 2>&1; then
  /usr/bin/open http://127.0.0.1:4380/admin/
  exit 0
fi
if ! command -v node >/dev/null 2>&1; then
  print 'Pour ouvrir le panel, Node.js doit être installé sur ce Mac. Contactez la personne qui s’occupe du site.'
  read '?Appuyez sur Entrée pour fermer.'
  exit 1
fi
print 'Le panel Nuage va s’ouvrir dans votre navigateur.'
print 'Gardez cette fenêtre ouverte pendant que vous modifiez le site.'
(sleep 1; /usr/bin/open http://127.0.0.1:4380/admin/) &
node server.mjs
