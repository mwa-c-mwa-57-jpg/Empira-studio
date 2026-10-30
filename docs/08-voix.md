# 08 — La voix du Général (annonceur vocal)

Le jeu commente la partie à voix haute, en français, sur les moments forts :

| Moment | Exemple de phrase |
|---|---|
| Nouvelle partie | « Nouvelle partie ! Écris le numéro de ton département dans le tchat pour entrer en guerre ! » |
| Départements qui entrent en guerre (regroupés) | « Le 17, Charente-Maritime, le 63, Puy-de-Dôme entrent en guerre ! » |
| Gros cadeau (100 pièces et plus) | « Énorme ! Nana envoie Cygne pour le 17, Charente-Maritime ! » |
| Galaxie, vol, bouclier, conquête éclair | « Catastrophe ! Le 63, Puy-de-Dôme retombe à zéro soldat ! » |
| Prise d'une capitale | « Le 17, Charente-Maritime envahit la capitale du 33 ! » |
| Duel, révolution, mission, prime | « Révolution ! Tout le monde contre le 17, Charente-Maritime ! Gains doublés pour les autres ! » |
| Changement de leader | « Le 21, Côte-d'Or prend la tête ! » |
| Fin de partie proche | « Plus qu'une minute ! », « Plus que 10 secondes ! » |
| Pop-ups du Général | « Partage le live ! Chaque partage rapporte 8 soldats à ton département ! » |
| Victoire | « Victoire ! Le 17, Charente-Maritime remporte la partie avec 12 départements ! Bravo à Nana, roi du pays ! » |

Garde-fous :
- au plus 3 phrases en attente ; les moins importantes sont abandonnées, et les phrases de remplissage périmées sont supprimées ;
- la même phrase n'est jamais répétée dans les 12 secondes ;
- les pseudos sont nettoyés (lettres et chiffres uniquement, 20 caractères au maximum) ;
- **les commentaires des spectateurs ne sont jamais lus**, pour éviter qu'une insulte soit prononcée en direct.

## Où sort le son ?
| Page | Sortie par défaut | Remarque |
|---|---|---|
| Source OBS `http://localhost:3000/?obs` | **haut-parleurs du PC, via le serveur local** (voix Windows) | OBS capte le son par « Audio du bureau ». La synthèse vocale est mal prise en charge par la source navigateur d'OBS, d'où ce choix. |
| Page de test `http://localhost:3000/` | navigateur, après un clic sur « 🔊 Activer la voix » | Chrome et Edge interdisent de parler sans clic préalable. Edge propose des voix naturelles (Denise, Henri). |

⚠️ Si la page OBS et la page de test (avec la voix activée) sont ouvertes en même temps, on entendra deux voix :
n'activez la voix que dans l'une des deux.

Réglages dans `config/france.json`, bloc `voice` :
- `enabled` : `false` pour couper complètement la voix ;
- `output` : `auto`, `server`, `browser` ou `off` ; l'URL peut le surcharger avec `?voice=server|browser|off` ;
- `rate`, `pitch`, `volume`, `voiceName` : vitesse, hauteur, volume et nom d'une voix précise (voix du navigateur) ;
- `readNames` : lire ou non les pseudos ;
- `minGiftCoins` : prix minimal d'un cadeau pour qu'il soit annoncé.

Pour lancer le serveur sans voix : `node server/server.js --no-voice`.

## Voix Windows
Le serveur utilise les voix installées avec Windows (System.Speech). Il choisit la première voix française
(généralement « Microsoft Hortense »). S'il n'en trouve aucune, il prend la voix par défaut, ce qui donnera un accent
anglais : installez alors la langue française avec sa voix dans Paramètres → Heure et langue → Voix.

## Limites (honnêtement)
- ❌ **Non testé sur Windows** : la voix Windows (PowerShell + System.Speech) n'a pas pu être lancée dans
  l'environnement de développement (Linux). Les accents, la latence et le choix de la voix restent à vérifier sur le PC.
- ✅ Testé : le texte des phrases (tests unitaires), l'activation de la voix dans la page de test, et l'envoi des
  phrases par la page OBS au serveur local (test navigateur). Je n'ai pas pu entendre le résultat.
- Les voix Windows classiques sont assez robotiques. Pour une voix plus naturelle : voix Edge du navigateur,
  ou plus tard un service de synthèse vocale en ligne (payant, nécessite une clé API ; non intégré).
