# 05 — Bilan de validation et plan d'évolution

## Environnement de développement réellement utilisé
Le développement et les tests ont été faits dans un **conteneur Linux dans le cloud** (Node 22.22, Chromium avec
Playwright), et non sur le PC Windows d'Empira. Le code est multiplateforme et les lanceurs `.bat` sont fournis,
mais **le lancement sous Windows n'a pas été testé** : c'est à faire en premier.

## Ce qui a été testé (et comment)
| Vérification | Méthode | Résultat |
|---|---|---|
| Normalisation, nettoyage, rejet des événements invalides ou anciens | `npm test` (events) | ✅ |
| Équipes, délai entre commentaires, charges de likes, paliers de cadeaux, doublons, limite de débit, classement | `npm test` (rules) | ✅ |
| Cartes connexes et équitables (30 graines), report des commandes, captures, météore, plafond d'unités, victoire par capitale et au temps, enchaînement des manches | `npm test` (game) | ✅ |
| Matchs complets avec une foule simulée : ils se terminent toujours, et le camp préféré du public gagne au moins 6 fois sur 8 | `npm test` (game) | ✅ |
| Conversion des événements TikTok (séries de cadeaux comprises) à partir d'objets factices | `npm test` (adapter) | ✅ |
| Serveur : fichiers, configuration, relais SSE, traversée de chemin, JSON invalide, taille maximale, actions inconnues | `npm test` (server) | ✅ |
| Page réelle dans Chromium : panneau de test, partie complète, doublon, tempête de 1 000 événements, victoire, nouvelle manche, mode OBS, relais régie → serveur → page OBS, aucune erreur JS | `npm run test:e2e` | ✅ |
| Fluidité | mesure dans Chromium sans GPU | ✅ 60 images/s avec environ 200 unités |

Captures : `docs/screenshots/` (compte à rebours, bataille, météore, victoire, mode OBS).

## Ce qui n'a PAS été testé ou reste à faire
- ❌ **Connexion à un vrai live TikTok** : l'adaptateur est écrit d'après la documentation de la bibliothèque
  (v2.5.0), mais n'a jamais été exécuté contre TikTok. La bibliothèque n'est pas installée dans le projet.
- ❌ Lancement sous **Windows** et intégration dans **OBS** réel (seule l'URL `?obs` a été testée dans Chromium).
- ❌ Diffusion réelle sur TikTok LIVE ou LIVE Studio ; lisibilité vérifiée sur un vrai téléphone.
- ❌ **Analyse de la vidéo de référence** (non reçue), voir `01-analyse-video.md`.
- ❌ Validation juridique : conditions d'utilisation de TikTok vis-à-vis des bibliothèques non officielles,
  nom « Empira Conquest », politique de confidentialité (les pseudos des spectateurs sont affichés et gardés en mémoire).
- Non développé : sons, sauvegarde des statistiques, espace créateur, comptes, administration multi-créateurs,
  plus de deux factions, alliances, saisons, éditeur visuel des règles (on modifie le JSON).
- Équilibrage : réglé sur des simulations, à ajuster en conditions réelles (rythme visé : 2 à 4 minutes par partie).

## Plan d'évolution et critères de fin de phase
| Phase | Contenu | Terminée quand… |
|---|---|---|
| 2 (prototype) — **atteinte** | carte, 2 factions, unités, combats, victoire, simulateur | une partie complète se joue sans TikTok ; les tests passent |
| 3 — TikTok | tester l'adaptateur sur un live de test autorisé, mesurer la latence et les pertes, vérifier les CGU ; évaluer les alternatives (TikFinity, API officielle si elle existe) | 3 lives de test de 30 min sans plantage ; événements reçus = événements visibles dans l'application TikTok (échantillon) |
| 4 — Streaming | OBS sous Windows, format 9:16, sons, réglages de performance sur PC modeste | 1 vrai live diffusé ; 60 images/s sur le PC du créateur |
| 5 — Personnalisation | interface de configuration (couleurs, noms, mots-clés, cadeaux), thèmes, statistiques sauvegardées | un créateur configure seul son jeu en moins de 10 min |
| 6 — Commercialisation | architecture 2 (serveur autoritaire, comptes), sécurité, tests de charge, installateur, CGU et confidentialité | test de charge de 5 000 événements/min pendant 1 h ; audit de sécurité ; documents juridiques validés |

Prochaines étapes conseillées, par ordre de priorité :
1. Lancer `start.bat` sur le PC Windows et ajouter la source à OBS.
2. Envoyer la vidéo de référence pour ajuster la direction artistique et les mécaniques.
3. Faire un live de test privé avec `start-tiktok.bat`, puis noter ce qui fonctionne ou non.
4. Ajouter les sons et les effets de cadeaux spectaculaires, puis faire des sessions de test avec de vrais spectateurs.

## Modèle économique : premières pistes (hypothèses, non validées)
- **Coûts actuels du prototype** : 0 € d'infrastructure (exécution locale). Coût variable possible :
  abonnement au service de signature Euler Stream si le volume l'exige (❓ tarif à vérifier).
- **Scénario A — usage interne** pour les créateurs de l'agence : coût = développement et support ; bénéfice
  indirect (engagement des lives). C'est le scénario le plus réaliste à court terme.
- **Scénario B — abonnement externe** : nécessite la phase 6 (comptes, hébergement, support, conformité).
  Coûts mensuels à estimer : hébergement d'un serveur temps réel, base de données, supervision, support.
- **Scénario C — jeux et habillages sur mesure** pour des marques ou des créateurs : vente au projet, sans infrastructure lourde.

Aucune de ces pistes ne doit reposer sur une promesse de revenus issus des cadeaux TikTok. Une étude de marché
(tarifs de TikFinity et des jeux itch.io, disposition à payer des créateurs) est nécessaire avant de chiffrer
des scénarios de revenus.
