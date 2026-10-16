# Guide de mise en ligne — Empira Studio & Empira Agency

Ce guide explique comment mettre le site en ligne sur **empirastudio.com**, l'héberger, encaisser des paiements et rester en règle. Il est écrit pour quelqu'un qui n'est pas développeur.

---

## 1. Ce qui a été construit

| Élément | Détail |
|---|---|
| **Pages** | Accueil, Boutique (filtres, recherche, tri), Fiche produit, Agency, Contact, Commande confirmée, Message reçu, 404, Mentions légales, CGV, Confidentialité |
| **Vente** | Uniquement tes 9 articles (Maono, RØDE, TONOR, SLDXIAN), avec leurs photos détourées. Le câble XLR existe en 1, 2 et 3 m. 3 « sélections » (setups composés de tes articles, au prix des articles, sans remise inventée). Panier, livraison offerte dès 149 €, paiement par carte via un **lien de paiement Qonto** (formulaire de commande) ou **Stripe** (paiement immédiat) |
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
| **Cloudflare Pages** | Gratuit | Bande passante illimitée, très rapide, protection anti-attaques incluse. Le code du paiement est déjà prêt (`functions/api/checkout.js`) | Pas de formulaires intégrés (contact, commande) : il faut brancher un service comme Formspree |
| **Vercel** | ≈ 20 $/mois | Très performant | L'offre gratuite est réservée aux projets **non commerciaux** : pour une boutique, offre payante obligatoire |
| **Hébergement classique** (OVHcloud, o2switch, Hostinger) | 3-8 €/mois | Familier, e-mail souvent inclus | Ne fait tourner ni la fonction de paiement ni les formulaires (contact, commande) |
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
2. Dans **Forms → Form notifications**, ajoute ton e-mail pour recevoir chaque message (contact, appel découverte, newsletter) et surtout chaque **commande** (formulaire « commande », voir la partie 5).
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

## 5. Encaisser les paiements par carte avec Qonto

Qonto ne fournit pas de « caisse » à brancher directement sur un site. Mais il y a deux façons d'encaisser par carte avec l'argent qui arrive **sur ton compte Qonto**, et le site gère les deux :

| | **A. Liens de paiement Qonto** (actif dès la mise en ligne) | **B. Stripe, versé sur ton compte Qonto** |
|---|---|---|
| Ce que fait le client | Clique sur **Commander**, remplit ses coordonnées et son adresse, puis reçoit un lien de paiement par e-mail | Clique sur **Payer par carte** et paie tout de suite |
| Moyens de paiement | Carte bancaire (CB, Visa, Mastercard), Apple Pay | Carte bancaire, Apple Pay, Google Pay |
| Ce que tu fais | Tu crées le lien dans l'application Qonto (≈ 2 min par commande) | Rien : la commande est payée, tu n'as plus qu'à expédier |
| Frais | Création des liens gratuite. Exemple annoncé : 1,4 % + 0,25 € par paiement avec une carte CB de particulier | De l'ordre de 1,5 % + 0,25 € par carte européenne |
| Arrivée de l'argent | Sur ton compte Qonto, environ 4 jours ouvrés après un paiement par carte | Virement automatique de Stripe vers ton IBAN Qonto |
| Activation | Dans l'application Qonto | Une clé à ajouter dans Netlify |

**Recommandation** : lance le site avec **A**, sans aucune clé. Quand les commandes deviennent régulières, ajoute **B** : dès que la clé Stripe est présente dans Netlify, le bouton du panier passe tout seul de **Commander** à **Payer par carte**. Ces frais évoluent : vérifie-les dans ton application Qonto et sur stripe.com/fr/pricing.

### 5.1 Option A : les liens de paiement Qonto (pas à pas)

**Activation, une seule fois :**
1. Dans l'application Qonto (web ou mobile), ouvre la rubrique **Liens de paiement**, puis clique sur **Activer**. Vérifie au passage que ton offre Qonto inclut cette fonctionnalité.
2. Qonto te fait connecter un compte **Mollie**, son partenaire de paiement : informations de l'entreprise et site web (`https://empirastudio.com`). La validation peut prendre quelques jours, car Mollie vérifie parfois l'activité à la main.
3. Dans les réglages des liens, active **carte bancaire** et **Apple Pay**. Tu peux laisser PayPal désactivé.
4. Dans Netlify, vérifie que tu reçois bien les notifications du formulaire **commande** (partie 4.2).

**À chaque commande :**
1. Tu reçois l'e-mail Netlify « commande » : nom, e-mail, adresse de livraison, articles et total TTC (livraison comprise).
2. Tu vérifies le stock.
3. Le plus pratique : dans Qonto, crée la **facture** du client (module Facturation) et ajoute-lui un **lien de paiement**. Le client reçoit sa facture et le bouton pour payer, et ta facture obligatoire est faite. Tu peux aussi créer un lien seul (rubrique **Liens de paiement → Créer**) en reprenant les articles du panier, à usage unique.
4. Le client paie par carte ou Apple Pay sur la page sécurisée Qonto (`pay.qonto.com`).
5. Qonto t'indique le paiement : tu expédies le colis.

Le site annonce au client un lien **sous 24 h ouvrées** : active les notifications Netlify et Qonto sur ton téléphone pour tenir ce délai.

**Pour tester :** passe une commande sur ton propre site, puis crée-toi un lien de 1 € et paie-le avec ta carte pour voir exactement le parcours de tes clients.

### 5.2 Option B : Stripe, versé sur ton compte Qonto
1. Crée un compte sur **stripe.com/fr** et active-le (SIRET, pièce d'identité).
2. **Paramètres → Comptes bancaires** : indique ton **IBAN Qonto**. Stripe y verse automatiquement tes ventes.
3. **Développeurs → Clés API** : copie la clé secrète de test (`sk_test_…`) dans Netlify, **Site configuration → Environment variables**, sous le nom `STRIPE_SECRET_KEY`.
4. Redéploie et teste avec la carte `4242 4242 4242 4242` (date future, n'importe quel code).
5. Remplace ensuite par la clé live (`sk_live_…`).
6. **Paramètres → Moyens de paiement** : active Apple Pay et Google Pay. **Paramètres → Image de marque** : ton logo Empira et la couleur or `#e0b05a`. **E-mails clients** : active les reçus.

Stripe demande lui-même l'adresse de livraison et le téléphone, et les prix sont toujours recalculés par le serveur du site.

> ⚠️ La clé secrète Stripe ne doit **jamais** être écrite dans le code ni envoyée par message. Elle vit uniquement dans les variables d'environnement de Netlify.

### 5.3 Pourquoi pas une connexion automatique entre Qonto et le site ?
L'API de Qonto sait créer des liens de paiement par programme, mais elle est pensée pour les logiciels partenaires, pas pour une boutique :
- connexion OAuth dont les jetons expirent toutes les heures et doivent être renouvelés et stockés en permanence ;
- pas de retour automatique du client vers le site après le paiement ;
- pas de saisie de l'adresse de livraison.

Pour un paiement 100 % automatique, Stripe (option B) fait la même chose plus simplement, avec l'argent versé sur ton compte Qonto.

### Où voir les commandes ?
- **Option A** : dans les e-mails et le tableau de bord Netlify (**Forms → commande**), puis le suivi des paiements dans Qonto.
- **Option B** : dans le tableau de bord Stripe, avec le nom du client, son adresse de livraison et les produits achetés.

---

## 6. La sécurité : ce qui est déjà en place

| Protection | Ce que ça empêche |
|---|---|
| **HTTPS obligatoire + HSTS** | Interception des données entre le visiteur et le site |
| **Politique de sécurité du contenu (CSP) stricte** | Injection de code malveillant (XSS) : seul le code du site peut s'exécuter, aucun script externe |
| **Anti-intégration (X-Frame-Options, frame-ancestors)** | Qu'un site pirate affiche le tien dans une fenêtre piégée |
| **Prix recalculés côté serveur** | Qu'un petit malin modifie le prix dans son navigateur avant de payer |
| **Paiement sur la page sécurisée de Qonto (Mollie) ou de Stripe (PCI-DSS niveau 1)** | Aucune donnée de carte ne passe par ton site : rien à voler |
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
| Paiements | Commission par vente (liens Qonto ou Stripe), sans abonnement supplémentaire |
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
