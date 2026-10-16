# Guide de mise en ligne — Empira Studio & Empira Agency

Ce guide explique comment mettre le site en ligne sur **empirastudio.com**, l'héberger, encaisser des paiements et rester en règle. Il est écrit pour quelqu'un qui n'est pas développeur.

---

## 1. Ce qui a été construit

| Élément | Détail |
|---|---|
| **Pages** | Accueil, Boutique (filtres, recherche, tri), Fiche produit, Agency, Contact, Commande confirmée, Message reçu, 404, Mentions légales, CGV, Confidentialité |
| **Vente** | Uniquement tes 9 articles (Maono, RØDE, TONOR, SLDXIAN), avec leurs photos détourées. Le câble XLR existe en 1, 2 et 3 m. 3 « sélections » (setups composés de tes articles, au prix des articles, sans remise inventée). Panier, livraison offerte dès 149 €, paiement **Stripe** (CB, Apple Pay, Google Pay), versé sur ton compte Qonto |
| **Accompagnement** | Page Agency : 6 services, 3 formules, méthode en 5 étapes, formulaire d'appel découverte |
| **Interactif** | Fond animé WebGL qui suit la souris, écran « live » en 3D avec alertes, démo de stream avec chat simulé et boutons d'alertes, configurateur en 3 questions, défilement horizontal, curseur personnalisé, boutons magnétiques, apparitions au scroll |
| **Vidéo** | 2 vidéos en boucle (≈ 400 Ko chacune), en pause hors écran pour économiser la batterie |
| **Accessibilité** | Navigation au clavier, lecteurs d'écran, respect du réglage « réduire les animations » du téléphone/ordinateur |
| **Référencement** | Titres et descriptions par page, sitemap.xml, robots.txt, données structurées Google (Organisation, Produits), image de partage réseaux sociaux |

**Charte graphique** : noir profond et or, d'après le logo Empira Studio (emblème « A » recréé en vectoriel, typographie Montserrat espacée, signature « Développer • Accompagner • Influencer »).

### Les prix à confirmer

Les prix ci-dessous viennent des captures envoyées (prix publics constatés chez Amazon, Thomann, maono.com) ou sont **estimés** quand aucun prix n'était visible. **Ce sont des prix de départ : remplace-les par tes prix de vente** dans `src/assets/js/catalog.js`.

| Produit | Prix sur le site | Origine |
|---|---|---|
| Maono PD200XS (blanc) + bras articulé | 79,90 € | estimé, **à vérifier** (le kit avec bras peut coûter plus cher) |
| RØDE PodMic | 74,00 € | Amazon |
| Micro TONOR TD510 | 59,90 € | estimé |
| Maono PD100 | 33,00 € | Thomann |
| Maono G1 NEO | 99,90 € | estimé |
| Pack Streaming Maono (PD200XS + G1 NEO) | 166,99 € | maono.com, **contenu exact à confirmer** |
| Bras TONOR profil bas | 29,99 € | Amazon (prix barré) |
| Pied RØDE DS1 | 30,00 € | Amazon (prix barré) |
| Câble XLR SLDXIAN 1 m / 2 m / 3 m | 9,69 € / 12,99 € / 13,99 € | Amazon |

> ⚠️ Si tu achètes ces produits au prix public (Amazon, Thomann) pour les revendre au même prix, **tu ne gagnes rien**. Pour dégager une marge, ouvre un compte revendeur auprès des marques ou de leurs distributeurs en France.

### Les visuels produits
Les photos sont celles que tu as envoyées, recadrées et **détourées** (fond transparent) pour ressortir sur le fond noir. Le micro blanc a été détouré avec l'aide de Canva. Elles viennent de sites marchands et restent la propriété des marques : assure-toi d'avoir le droit de les utiliser (les marques et distributeurs fournissent en général leurs photos officielles aux revendeurs, en meilleure résolution). Pour en changer, remplace les fichiers `.webp` de `src/assets/img/products/`.

---

## 2. Le nom de domaine

J'ai vérifié l'état des domaines le 16/10/2026 :

| Domaine | État |
|---|---|
| **empirastudio.com** | Réservé chez **GoDaddy** (janvier 2026, jusqu'en 2029). Affiche actuellement la page de parking GoDaddy. |
| **empira-studio.com** | Réservé chez GoDaddy le même jour, et **redirige déjà vers empirastudio.com**. |
| empirastudio.fr / empira-studio.fr | **Libres** |

Le fait que les deux `.com` aient été réservés en même temps et que l'un redirige vers l'autre laisse penser que c'est toi (ou ton associé) qui les possède. **Vérifie dans ton compte GoDaddy.**

- **Si ce sont les tiens** : le site est déjà configuré pour `empirastudio.com` (et `empira-studio.com` + `www` redirigent vers lui).
- **Sinon** : réserve `empirastudio.fr` (≈ 7-12 €/an chez OVHcloud, Gandi ou Cloudflare), puis change l'adresse dans `site.config.json` et dans `netlify.toml`.

Conseil : réserve aussi `empirastudio.fr` pour protéger la marque en France et le rediriger vers le `.com`.

---

## 3. Où héberger le site ? Toutes les options

Le site est **statique** (pas de base de données ni de serveur à maintenir) avec une petite fonction pour le paiement. C'est le type de site le plus rapide, le moins cher et le plus sûr.

| Solution | Coût | Points forts | Limites |
|---|---|---|---|
| **⭐ Netlify** (recommandé) | Gratuit pour démarrer | HTTPS automatique, **formulaires intégrés** (contact, agence, newsletter), fonction de paiement incluse, mise à jour automatique à chaque modification sur GitHub | Au-delà d'un gros trafic, passer à une offre payante (voir netlify.com/pricing) |
| **Cloudflare Pages** | Gratuit | Bande passante illimitée, très rapide, protection anti-attaques incluse. Le code du paiement est déjà prêt (`functions/api/checkout.js`) | Pas de formulaires intégrés : il faut brancher un service comme Formspree |
| **Vercel** | ≈ 20 $/mois | Très performant | L'offre gratuite est réservée aux projets **non commerciaux** : pour une boutique, offre payante obligatoire |
| **Hébergement classique** (OVHcloud, o2switch, Hostinger) | 3-8 €/mois | Familier, e-mail souvent inclus | Ne fait tourner ni la fonction de paiement Stripe ni les formulaires |
| **Shopify** (autre approche) | ≈ 30-40 €/mois + commissions | Clé en main : stocks, commandes, factures, étiquettes d'envoi | Il faudrait recréer ce design dans un thème Shopify ; moins de liberté |

**Recommandation** : **Netlify** maintenant. Si un jour le catalogue dépasse une cinquantaine de références avec des stocks à gérer, on pourra brancher Shopify en arrière-plan en gardant ce design.

---

## 4. Mise en ligne sur Netlify, pas à pas

### 4.1 Publier le site (≈ 10 min)
1. Crée un compte sur **netlify.com** avec ton compte GitHub.
2. **Add new site → Import an existing project → GitHub**, puis choisis le dépôt `Empira-studio`.
3. Branche : `main` (après fusion de la branche `claude/site-empira-studio`) ou directement `claude/site-empira-studio` pour tester.
4. Netlify lit tout seul les réglages dans `netlify.toml` (commande `npm run build`, dossier `dist`). Clique sur **Deploy**.
5. En une minute, le site est en ligne sur une adresse provisoire `quelquechose.netlify.app`.

### 4.2 Activer les formulaires
1. **Site configuration → Forms → Enable form detection**, puis relance un déploiement.
2. Dans **Forms → Form notifications**, ajoute ton e-mail pour recevoir chaque message (contact, appel découverte, newsletter).
3. Les messages arrivent aussi dans le tableau de bord Netlify. Le filtre anti-spam est inclus, et chaque formulaire a un piège à robots invisible.

### 4.3 Brancher le domaine empirastudio.com (GoDaddy)
1. Dans Netlify : **Domain management → Add a domain** → `empirastudio.com`. Ajoute aussi `empira-studio.com` comme alias.
2. Dans GoDaddy → **Mes domaines → empirastudio.com → DNS** :
   - enregistrement **A**, nom `@`, valeur **75.2.60.5** (supprime l'ancien enregistrement A « Parked ») ;
   - enregistrement **CNAME**, nom `www`, valeur `tonsite.netlify.app` (l'adresse donnée par Netlify).
3. Pour **empira-studio.com** : **supprime la redirection GoDaddy** actuelle et mets les mêmes enregistrements DNS. Le fichier `netlify.toml` redirige déjà proprement vers `empirastudio.com`.
4. **Ne touche pas aux enregistrements MX** si tu as déjà une adresse e-mail sur ce domaine.
5. Netlify active le **HTTPS gratuit** (cadenas) automatiquement, en quelques minutes à quelques heures.

> Les valeurs exactes à saisir sont affichées par Netlify dans **Domain management** ; fie-toi à elles si elles diffèrent.

### 4.4 L'adresse e-mail contact@empirastudio.com
Le site affiche `contact@empirastudio.com` (modifiable dans `site.config.json`). Pour qu'elle fonctionne, il faut un service e-mail sur le domaine : GoDaddy (Microsoft 365), Google Workspace, Zoho Mail (offre gratuite) ou OVHcloud. Pense à configurer SPF, DKIM et DMARC (le service choisi te donne les valeurs), sinon tes e-mails finiront en spam.

---

## 5. Encaisser les paiements avec Stripe (versés sur ton compte Qonto)

Le paiement passe directement par **Stripe** : le client clique sur **Payer par carte**, paie sur la page sécurisée Stripe (CB, Visa, Mastercard, Apple Pay, Google Pay), et revient sur la page de confirmation du site. Stripe verse ensuite automatiquement l'argent sur ton **compte Qonto**.

Tant que la clé Stripe n'est pas ajoutée, le panier propose au client d'**envoyer sa commande par e-mail** : tu peux mettre le site en ligne avant d'avoir fini l'ouverture du compte Stripe.

### 5.1 Ouvrir et activer le compte Stripe (≈ 20 min)
1. Crée un compte sur **stripe.com/fr** avec l'adresse e-mail de l'entreprise.
2. **Active les paiements** : forme juridique, SIRET, adresse, pièce d'identité du dirigeant, et le site `https://empirastudio.com` avec une courte description (« vente de matériel de streaming »).
3. **Compte bancaire pour les virements** : renseigne ton **IBAN Qonto** (à copier depuis l'application Qonto, rubrique du compte). C'est là que Stripe versera tes ventes.
4. Active la **double authentification** du compte Stripe.

### 5.2 Brancher Stripe sur le site
1. Dans Stripe, **Développeurs → Clés API**, en **mode test** : copie la **clé secrète** (`sk_test_…`).
2. Dans Netlify : **Site configuration → Environment variables → Add a variable**, nom `STRIPE_SECRET_KEY`, valeur la clé copiée.
3. **Deploys → Trigger deploy** pour relancer le site. Le bouton **Payer par carte** mène désormais à la page Stripe.
4. Fais une commande test avec la carte `4242 4242 4242 4242`, une date future et n'importe quel code. La commande apparaît dans Stripe (mode test).
5. Quand tout est bon : repasse Stripe en **mode production**, copie la clé `sk_live_…`, remplace la valeur de `STRIPE_SECRET_KEY` dans Netlify et relance le déploiement.

> ⚠️ La clé secrète ne doit **jamais** être écrite dans le code ni envoyée par message (même à moi). Elle vit uniquement dans Netlify. Si elle a fuité, régénère-la dans Stripe.

### 5.3 Réglages conseillés dans Stripe
- **Paramètres → Moyens de paiement** : garde **Cartes**, **Apple Pay** et **Google Pay** activés. Désactive PayPal et le paiement en plusieurs fois s'ils apparaissent.
- **Paramètres → Image de marque** : ton logo Empira, l'icône et la couleur or `#e0b05a`, pour une page de paiement à tes couleurs.
- **Paramètres → E-mails clients** : active les **reçus de paiement** envoyés automatiquement.
- **Paramètres → Informations publiques** : nom affiché sur les relevés bancaires (`EMPIRA STUDIO`), e-mail et téléphone du service client, liens vers tes CGV (`/cgv.html`) et ta politique de confidentialité.
- Installe l'**application Stripe** sur ton téléphone et active les notifications : tu es prévenu à chaque vente.

### 5.4 Ce qui se passe à chaque commande
1. Le client paie sur la page Stripe : il y saisit son adresse de livraison et son téléphone, et voit le détail du panier et des frais de port.
2. Il revient sur la page de confirmation du site, son panier est vidé, et Stripe lui envoie son reçu.
3. Tu reçois la notification : tous les détails (produits, adresse, téléphone) sont dans **Stripe → Paiements**.
4. Tu expédies le colis sous 24 h ouvrées, comme annoncé sur le site.
5. Stripe vire automatiquement l'argent sur ton compte Qonto, en général sous quelques jours ouvrés. Le premier virement prend souvent plus longtemps, le temps que Stripe vérifie le compte.

**Remboursement** (retour sous 30 jours) : dans Stripe, ouvre le paiement puis clique sur **Rembourser**. Le client est recrédité sur sa carte.

**Frais** : pas d'abonnement, une commission par vente. Pour une carte européenne standard, c'est de l'ordre de 1,5 % + 0,25 € (par exemple ≈ 1,36 € sur une commande de 74 €). Vérifie la grille à jour sur stripe.com/fr/pricing.

**Comptabilité** : dans Qonto, chaque virement Stripe regroupe plusieurs ventes. Le détail de chaque vente et des frais se trouve dans Stripe (**Soldes → Virements**, export CSV pour ton comptable).

---

## 6. La sécurité : ce qui est déjà en place

| Protection | Ce que ça empêche |
|---|---|
| **HTTPS obligatoire + HSTS** | Interception des données entre le visiteur et le site |
| **Politique de sécurité du contenu (CSP) stricte** | Injection de code malveillant (XSS) : seul le code du site peut s'exécuter, aucun script externe |
| **Anti-intégration (X-Frame-Options, frame-ancestors)** | Qu'un site pirate affiche le tien dans une fenêtre piégée |
| **Prix recalculés côté serveur** | Qu'un petit malin modifie le prix dans son navigateur avant de payer |
| **Paiement hébergé par Stripe (PCI-DSS niveau 1)** | Aucune donnée de carte ne passe par ton site : rien à voler |
| **Clé Stripe en variable d'environnement** | Fuite de la clé via le code source |
| **Contrôle d'origine, limites de taille et de quantité sur l'API** | Abus de la fonction de paiement depuis un autre site |
| **Piège à robots + filtre anti-spam sur les formulaires** | Spam |
| **Aucune base de données ni espace d'administration en ligne** | Il n'y a rien à pirater : pas de mot de passe admin, pas de WordPress à mettre à jour |
| **Polices et vidéos hébergées sur le site** | Fuite des données des visiteurs vers Google ou d'autres tiers (RGPD) |

**Ce qu'il te reste à faire** (le plus important) :
1. Active la **double authentification** sur GitHub, Netlify, Qonto, Stripe, GoDaddy, TikTok et ta boîte e-mail. C'est là que se trouvent les vraies clés du site.
2. Utilise un **gestionnaire de mots de passe** (Bitwarden, 1Password…).
3. Après la mise en ligne, teste le site sur **securityheaders.com** : la note attendue est **A+**.

---

## 7. Obligations légales (France)

Avant d'encaisser le premier euro :

- [ ] **Statut juridique** et **SIRET** (micro-entreprise, SASU, SARL…).
- [ ] Compléter les champs `[À COMPLÉTER]` dans **mentions-legales.html**, **cgv.html** et **confidentialite.html** (`src/pages/`).
- [ ] **Médiateur de la consommation** : l'adhésion est obligatoire pour vendre aux particuliers. Indique son nom dans les CGV.
- [ ] Faire **relire les CGV** par un professionnel (modèle fourni, pas un avis juridique).
- [ ] Vérifier que les promesses affichées sont tenables : expédition sous 24 h, livraison 48-72 h, retours 30 jours, rappel sous 24 h. Modifie les textes sinon.
- [ ] **Avis clients** : n'affiche que de vrais avis vérifiables (la loi sanctionne les faux avis). La section « témoignages » a volontairement été laissée de côté : on l'ajoutera avec tes premiers vrais retours.
- [ ] Vérifier les **caractéristiques** de chaque fiche produit avec la documentation officielle (elles ont été recoupées sur plusieurs revendeurs, mais seule la fiche du fabricant fait foi) et confirmer le **contenu du pack Maono** (bras et casque inclus ou non).

---

## 8. Modifier le site toi-même

| Je veux… | Fichier à modifier |
|---|---|
| Changer un prix, ajouter ou retirer un produit | `src/assets/js/catalog.js` (le prix payé est relu ici, impossible de tricher). Pour une variante (coloris, longueur), duplique le produit avec un nouvel `id` et le même `group` |
| Changer les frais et le seuil de livraison offerte | `SHIPPING` dans `src/assets/js/catalog.js` |
| Changer l'e-mail, le téléphone, les réseaux sociaux, le domaine | `site.config.json` (`tiktok` = lien de ton compte TikTok, `tiktokHandle` = ton pseudo sans @) |
| Modifier un texte | `src/pages/*.html` |
| Remplacer une image produit | `src/assets/img/products/` (photos détourées PNG/WebP de 800 × 800 px idéalement, puis mettre à jour le chemin dans `catalog.js`) |
| Remplacer une vidéo | `src/assets/video/` : garde les mêmes noms (`stream-loop.mp4`, `brand-reel.mp4`), format MP4 H.264, sans son, moins de 5 Mo, plus une image `-poster.jpg` |
| Modifier les couleurs (or, noir) | Variables en haut de `src/assets/css/styles.css` |

Pour voir le résultat sur ton ordinateur (Node.js 20 ou plus requis) :

```bash
npm run dev
# puis ouvre http://localhost:8080
```

Une fois en ligne, chaque modification envoyée sur GitHub est publiée automatiquement par Netlify en une minute.

---

## 9. Budget récapitulatif

| Poste | Coût estimé |
|---|---|
| Nom de domaine `.com` (déjà payé jusqu'en 2029 si c'est le tien) | ≈ 15-25 €/an au renouvellement |
| Hébergement Netlify | 0 € pour démarrer |
| Paiements Stripe | Commission par vente (≈ 1,5 % + 0,25 € par carte européenne), sans abonnement |
| Adresse e-mail pro | 0 à 7 €/mois selon le service |
| Médiateur de la consommation | Abonnement annuel, selon l'organisme |

---

## 10. Pistes pour la suite

- Remplacer les illustrations par de **vraies photos** de ton matériel et filmer une **vraie vidéo** de ton studio pour le haut de page.
- Ajouter les **avis clients** vérifiés (Trustpilot, Avis Vérifiés, Google).
- **Mesure d'audience** respectueuse de la vie privée et sans bandeau cookies (Plausible, Matomo configuré en mode exempté).
- **Prise de rendez-vous en ligne** pour l'appel découverte (Cal.com, Calendly).
- **Webhooks Stripe** pour recevoir chaque commande par e-mail formaté et gérer les stocks.
- Version **anglaise** du site.
