#!/bin/bash
# Lanceur Mac : double-clic (ou clic droit > Ouvrir la premiere fois).
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "  Node.js n'est pas installé sur ce Mac."
  echo "  1. Installe la version LTS depuis https://nodejs.org/fr/download"
  echo "  2. Double-clique à nouveau sur LANCER-MAC.command"
  open "https://nodejs.org/fr/download"
  read -n 1 -s -r -p "Appuie sur une touche pour fermer..."
  exit 1
fi

if [ ! -f node_modules/.installed-v1 ]; then
  echo ""
  echo "  Première installation : téléchargement des composants (1 à 2 minutes)..."
  if ! npm install --omit=dev --no-audit --no-fund; then
    echo "  L'installation a échoué. Vérifie ta connexion internet puis relance."
    read -n 1 -s -r -p "Appuie sur une touche pour fermer..."
    exit 1
  fi
  touch node_modules/.installed-v1
fi

node server/index.js --open
