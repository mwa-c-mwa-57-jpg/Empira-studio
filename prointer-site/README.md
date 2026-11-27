# Site PRO-INTER

Site de l'agence d'emploi PRO-INTER (intérim, CDD, CDI au Luxembourg), dans l'univers de la vidéo « Le viseur » : fond nuit, cyan, cible.

- **Accueil** : la vidéo du viseur dans un téléphone, les contrats et les métiers (chaque métier ouvre le formulaire déjà rempli), la méthode (on écoute, on trouve, on vous suit), les engagements pour les entreprises, un encart frontaliers, la carte et les coordonnées des 3 agences.
- **Déposer mon CV** (`/candidature`) : inscription en 3 étapes avec dépôt du CV et, si on veut, d'une lettre de motivation (PDF, DOC ou DOCX, 5 Mo maximum chacun), barre de progression, messages d'erreur sous chaque champ, accord RGPD.
- **Entreprises** (`/entreprises`) : demande de recrutement (mêmes champs que le formulaire actuel de prointer.lu).
- **Espace agence** (`/admin`, protégé par mot de passe) : les candidatures et les demandes, un filtre par agence, le téléchargement des CV, l'export CSV (Excel) et la suppression.
- Mentions légales, protection des données, page 404 et page de remerciement.

Aperçus : [`docs/apercu/`](docs/apercu/).

![Accueil](docs/apercu/accueil.jpg)

## Lancer le site

Il faut Node.js 20 ou plus. Le site n'a aucune dépendance : pas de `npm install`.

```bash
cd prointer-site
ADMIN_PASSWORD="un-mot-de-passe-solide" npm start      # http://localhost:8080
npm test                                               # 12 tests du serveur
```

| Variable | Rôle | Par défaut |
|---|---|---|
| `PORT` | port du serveur | `8080` |
| `ADMIN_USER` / `ADMIN_PASSWORD` | identifiants de l'espace agence (sans mot de passe, l'espace est désactivé) | `agence` / aucun |
| `DATA_DIR` | dossier des candidatures et des CV | `prointer-site/data` |
| `RETENTION_DAYS` | durée de conservation, puis suppression automatique | `730` (2 ans) |
| `NOTIFY_WEBHOOK_URL` | adresse appelée à chaque envoi (Make, Zapier, n8n…), pour recevoir un e-mail ou une alerte | aucune |
| `TRUST_PROXY` | `1` si le site est derrière un proxy (Nginx, Render…), pour lire la vraie adresse IP | `0` |
| `RATE_MAX` | envois autorisés par adresse IP et par tranche de 10 minutes | `6` |

## Où vont les candidatures

Chaque candidature crée un dossier `data/candidatures/<date>-<code>/` avec `candidature.json`, `cv.pdf` (ou `.doc`, `.docx`) et la lettre éventuelle. Les demandes des entreprises sont ajoutées à `data/entreprises.jsonl`. Le dossier `data/` n'est jamais envoyé sur GitHub (`.gitignore`). Pensez à le sauvegarder.

Contrôles faits par le serveur :
- le fichier est vraiment un PDF, un DOC ou un DOCX (signature du fichier, pas seulement l'extension) et pèse 5 Mo au plus ;
- e-mail, téléphone, champs obligatoires et accord RGPD sont vérifiés ;
- un champ caché piège les robots, et le nombre d'envois par adresse IP est limité ;
- l'espace agence affiche le texte des candidats sans jamais l'exécuter, refuse les suppressions venues d'un autre site, et compare le mot de passe en temps constant ;
- politique de sécurité stricte (aucun script ni style externe), aucun cookie, police et vidéo hébergées sur le site ;
- la vidéo répond aux requêtes partielles, nécessaires à la lecture sur iPhone.

## Mettre en ligne

N'importe quel hébergement qui fait tourner Node.js : un VPS (OVH, Scaleway, Hostinger…) ou une plateforme comme Render, Railway ou Fly.io.
1. **HTTPS obligatoire** : le site reçoit des CV.
2. **Disque persistant** pour `DATA_DIR` : sur Render, Railway ou Fly.io, ajoutez un volume, sinon les CV disparaissent à chaque redéploiement.
3. Définissez `ADMIN_PASSWORD` (et `TRUST_PROXY=1` derrière un proxy).
4. Pour être prévenu à chaque candidature : créez un scénario Make ou Zapier « webhook → e-mail » et collez son adresse dans `NOTIFY_WEBHOOK_URL`. Seuls le nom, le métier et l'agence sont envoyés, jamais le CV.

## À compléter avant la mise en ligne

Les passages surlignés en jaune dans les pages :
- **Mentions légales** : raison sociale, siège, RCS, TVA, autorisation d'établissement, directeur de la publication, hébergeur.
- **Protection des données** : adresse e-mail dédiée aux données personnelles, hébergeur.

À faire valider par PRO-INTER :
- « Gratuit et sans engagement », la liste des métiers par secteur et le texte frontaliers (« souvent mieux payé qu'en France »).
- Les codes postaux de Dudelange et de Mondorf-les-Bains, et les horaires d'ouverture (absents du site actuel).
- Les liens Facebook et LinkedIn à ajouter dans le pied de page.
- Le site actuel affiche à la fois « plus de 15 ans » et « plus de 20 ans » : ici, « plus de 20 ans » partout.

Suite possible : une page « Offres d'emploi » alimentée depuis l'espace agence (les offres du site actuel datent de 2022).

## Fichiers

| Fichier | Rôle |
|---|---|
| `server.mjs` | serveur : pages, formulaires, CV, espace agence, purge RGPD |
| `public/*.html` | pages du site |
| `public/assets/css/style.css` | styles (couleurs PRO-INTER, Montserrat, motif cible) |
| `public/assets/js/main.js` | menu mobile, apparitions, son de la vidéo, carte, envoi des formulaires |
| `public/assets/video/viseur.mp4` | la vidéo « Le viseur » allégée pour le web (540×960, 2 Mo) |
| `test/server.test.mjs` | tests (`npm test`) |
