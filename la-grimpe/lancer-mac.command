#!/bin/bash
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node.js n'est pas installé : https://nodejs.org/fr"; read -r; exit 1; }
[ -d node_modules ] || { echo "Installation des dépendances, patiente…"; npm install --no-audit --no-fund; }
node server.js
