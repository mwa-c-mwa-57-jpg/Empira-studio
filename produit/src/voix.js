// Annonceur vocal : voix Windows (homme ou femme) lue par le serveur local, voix du navigateur en repli.
// Règles : ne jamais lire les commentaires, jamais la même phrase en boucle, pas de « merci »,
// mots interdits filtrés dans les pseudos.

import { PAR_CODE } from './game.js';
import { placeForms, capitalize, verb } from '../../public/src/france/names.js';
import { pseudoPropre } from './theme.js';

const formes = (code) => placeForms(PAR_CODE.get(code)?.name ?? code);

export class Annonceur {
  constructor(partie, { parler, maintenant = () => performance.now(), random = Math.random, surParole = () => {} } = {}) {
    this.partie = partie;
    this.parler = parler;
    this.maintenant = maintenant;
    this.random = random;
    this.surParole = surParole;
    this.file = [];
    this.occupeJusqua = 0;
    this.dejaDit = new Map();
    this.dernierDepassement = -Infinity;
    this.actif = true;
  }

  choisir(liste) {
    return liste[Math.floor(this.random() * liste.length)];
  }

  /** Met une phrase dans la file. priorite : 4 = rappel de temps, 3 = indispensable, 2 = important, 1 = remplissage. */
  dire(texte, priorite = 1, cle = texte) {
    if (!this.actif || !texte) return;
    const t = this.maintenant();
    if (t - (this.dejaDit.get(cle) ?? -Infinity) < 12000) return;
    this.dejaDit.set(cle, t);
    this.file.push({ texte: texte.replace(/\s+/g, ' ').trim(), priorite, a: t });
    this.file.sort((a, b) => b.priorite - a.priorite || a.a - b.a);
    while (this.file.length > 3) this.file.pop();
  }

  tick() {
    const t = this.maintenant();
    this.file = this.file.filter((q) => q.priorite >= 2 || t - q.a < 6000);
    if (t < this.occupeJusqua || !this.file.length) return;
    const p = this.file.shift();
    // jamais deux fois la même phrase de suite (ex. un leader qui change deux fois en quelques secondes)
    if (p.texte === this.derniereDite) return;
    this.derniereDite = p.texte;
    const duree = 600 + p.texte.length * 62;
    this.occupeJusqua = t + duree;
    this.surParole(duree);
    this.parler(p.texte);
  }

  surEvenements(evs) {
    const c = (l) => this.choisir(l);
    for (const e of evs) {
      const nom = e.joueur ? pseudoPropre(e.joueur.nom) : '';
      switch (e.type) {
        case 'debutPartie':
          this.dire(c(['Que la guerre commence ! Écris le numéro de ton département dans le tchat !', 'Nouvelle partie ! Écris le numéro de ton département pour entrer en guerre !']), 3);
          break;
        case 'arrivee': {
          if (!e.annoncer) break;
          const f = formes(e.equipe);
          this.dire(c([`${nom} rejoint ${f.the} !`, `Nouveau soldat pour ${f.the} : ${nom} !`, `${nom} entre en guerre pour ${f.the} !`, `${capitalize(f.the)} ${verb(f, 'accueille', 'accueillent')} ${nom} !`]), 2, `arrivee:${e.joueur.id}`);
          break;
        }
        case 'cadeau': {
          if (e.pieces < 100 || e.attaque) break;
          const f = formes(e.equipe);
          this.dire(c([`${nom} envoie ${e.nom} : renforts pour ${f.the} !`, `${e.nom} pour ${f.the}, de la part de ${nom} !`, `Énorme ! ${nom} envoie ${e.nom} !`]), 2, `cadeau:${e.joueur.id}:${e.nom}`);
          break;
        }
        case 'attaque': {
          const de = e.de;
          const vers = e.vers[0];
          const lignes = {
            chasseur: [`Le ${de} bombarde le ${vers} !`, `Frappe aérienne du ${de} sur le ${vers} !`, `Avion de chasse du ${de} sur le ${vers} !`],
            missiles: [`Le ${de} tire ses missiles sur le ${vers} !`, `Pluie de missiles sur le ${vers} !`],
            helicos: [`Les hélicoptères du ${de} encerclent le ${vers} !`, `Le ${de} envoie quatre hélicoptères sur le ${vers} !`],
            tsunami: [`Tsunami ! Une vague géante déferle sur le ${vers} !`],
            nucleaire: [`Alerte nucléaire ! Le ${de} frappe les trois premiers !`, `Bombes nucléaires ! Le ${de} vise le podium !`],
            tomate: [`Le ${de} lance une tomate sur le ${vers} !`],
            porteavions: [`Un porte-avions du ${de} arrive au large ! Le ${vers} va prendre cher !`, `Porte-avions en approche ! Le ${de} lance ses avions sur le ${vers} !`],
          }[e.sorte];
          if (!lignes) break;
          this.dire(`${e.riposte ? 'Riposte ! ' : ''}${c(lignes)}`, ['nucleaire', 'tsunami', 'porteavions'].includes(e.sorte) ? 3 : 2, `attaque:${e.sorte}:${de}`);
          break;
        }
        case 'ambiance': {
          if (e.sorte === 'ravitaillement') this.dire(c([`Ravitaillement surprise pour ${formes(e.equipe).the} !`, `Un avion cargo largue des renforts sur ${formes(e.equipe).the} !`]), 1, `ambiance:${e.equipe}`);
          else if (e.sorte === 'bombardement') this.dire(c([`Bombardement surprise sur le leader : ${formes(e.equipe).the} !`, `Attention ${formes(e.equipe).the}, un bombardier arrive !`]), 2, `bombardement:${e.equipe}`);
          break;
        }
        case 'tank':
          this.dire(`Un tank prend position sur ${formes(e.equipe).the} !`, 2, `tank:${e.equipe}`);
          break;
        case 'bouclier':
          this.dire(`Bouclier activé sur ${formes(e.equipe).the} !`, 2, `bouclier:${e.equipe}`);
          break;
        case 'occupation':
          this.dire(`Invasion ! Le ${e.occupant} occupe le ${e.equipe} !`, 3);
          break;
        case 'liberation': {
          const f = formes(e.equipe);
          this.dire(`${capitalize(f.the)} ${verb(f, 'est libéré', 'sont libérés')} !`, 2);
          break;
        }
        case 'vagueAnnonce':
          this.dire(`Attention ! Vague ${e.vague.nom.toLowerCase()} dans ${e.dans} secondes !`, 3);
          break;
        case 'vagueDebut':
          this.dire(e.vague.id === 'assaut' ? 'Assaut final ! Tout le monde au combat ! Likes et commentaires fois cinq !' : `${capitalize(e.vague.nom.toLowerCase())} ! ${e.vague.texte.replace('×', 'fois ')} !`, 3);
          break;
        case 'evenementDebut': {
          const ev = e.evenement;
          const t = {
            revolution: `Révolution ! Tout le monde contre le ${ev.cible} !`,
            duel: `Duel ! Le ${ev.a} contre le ${ev.b} !`,
            prime: `La tête du ${ev.cible} est mise à prix !`,
            mission: `Ordre du Général pour ${placeForms(ev.region || '').the} : ${ev.sorte === 'messages' ? `envoyez ${ev.objectif} messages` : `recrutez ${ev.objectif} soldats`} !`,
          }[ev.type];
          this.dire(t, 3);
          break;
        }
        case 'evenementFin': {
          const r = e.resultat;
          if (e.evenement.type === 'duel' && r.gagnant) this.dire(`Duel gagné par le ${r.gagnant} !`, 2);
          else if (e.evenement.type === 'mission' && r.reussie) this.dire(`Le Général est fier ${placeForms(e.evenement.region).of} ! Mission réussie !`, 2);
          else if (e.evenement.type === 'prime' && r.gagnant) this.dire(`Le ${r.gagnant} touche la prime !`, 2);
          break;
        }
        case 'depassement': {
          const t = this.maintenant();
          if (t - this.dernierDepassement < 15000) break;
          this.dernierDepassement = t;
          const f = formes(e.equipe);
          this.dire(c([`${capitalize(f.the)} ${verb(f, 'passe', 'passent')} en tête !`, `Changement de leader : ${f.the} !`]), 1);
          break;
        }
        case 'rappel':
          this.dire(e.minutes === 1 ? 'Plus qu’une minute !' : e.minutes === 5 ? 'Plus que cinq minutes !' : 'Plus que dix minutes !', 4);
          break;
        case 'podium': {
          const g = e.podium.top[0];
          const roi = e.podium.roi;
          this.file = [];
          if (!g) break;
          const f = placeForms(g.nom);
          this.dire(`Victoire ${f.of} ! Bravo à tous les soldats !${roi ? ` ${pseudoPropre(roi.nom)} est le roi du pays !` : ''}`, 4);
          break;
        }
        default:
          break;
      }
    }
  }
}

/** Voix lue par le serveur local (voix Windows) ; repli sur la voix du navigateur si le serveur ne répond pas. */
export function sortieVoix({ nomVoix = '', genre = 'femme' } = {}) {
  let serveurOk = true;
  const navigateur = (texte) => {
    if (typeof speechSynthesis === 'undefined') return;
    const u = new SpeechSynthesisUtterance(texte);
    u.lang = 'fr-FR';
    const voix = speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith('fr'));
    const homme = /paul|henri|thomas|claude|remy|rémy|male|homme/i;
    u.voice = voix.find((v) => (genre === 'homme' ? homme.test(v.name) : !homme.test(v.name))) || voix[0] || null;
    speechSynthesis.speak(u);
  };
  return (texte) => {
    if (!serveurOk) return navigateur(texte);
    fetch(`/parler?t=${encodeURIComponent(texte)}&voix=${encodeURIComponent(nomVoix)}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
      })
      .catch(() => {
        serveurOk = false;
        navigateur(texte);
      });
  };
}
