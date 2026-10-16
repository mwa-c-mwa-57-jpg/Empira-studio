# Empira Studio · Empira Agency

Site officiel **[empirastudio.com](https://empirastudio.com)** : boutique de matériel de streaming (Empira Studio) et accompagnement des créateurs (Empira Agency).

➡️ **Mise en ligne, nom de domaine, paiement, sécurité et obligations légales : [docs/GUIDE.md](docs/GUIDE.md)**

## Lancer le site en local

```bash
npm run dev          # http://localhost:8080 (aucune dépendance à installer)
npm run build        # génère le site final dans dist/
```

Pour tester le paiement Stripe en mode test : `STRIPE_SECRET_KEY=sk_test_… npm run dev`. Sans clé, le panier propose d'envoyer la commande par e-mail. Les formulaires envoyés en local s'affichent dans le terminal.

## Organisation

```
site.config.json        Domaine, e-mail, réseaux sociaux (injectés dans toutes les pages)
src/pages/              Les pages (accueil, boutique, produit, agency, contact, légal…)
src/partials/           En-tête, pied de page, panier, éléments communs
src/assets/js/catalog.js   Catalogue produits : prix, descriptions, packs, livraison
src/assets/css/         Design (couleurs, typographies, animations)
src/assets/js/          Interactions : panier, WebGL, démo live, configurateur…
src/assets/img|video|fonts
src/public/             _headers (sécurité HTTP), robots.txt, manifeste
server/checkout.js      Paiement Stripe (prix vérifiés côté serveur)
server/payments/        Stripe et contrôle du panier
netlify/functions/      Branchement de la fonction de paiement sur Netlify
functions/api/          Branchement équivalent pour Cloudflare Pages
scripts/                Génération du site et serveur local
```

Aucune dépendance npm, aucun framework : HTML, CSS et JavaScript modernes, générés en fichiers statiques.
