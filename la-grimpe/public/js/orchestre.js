// Chef d'orchestre des sons de l'overlay.
// Règles :
//  - un seul effet sonore à la fois (jamais deux sons qui se superposent) ;
//  - chaque son a une raison, et chaque raison une priorité ;
//  - un son nettement plus important coupe le son en cours (fondu court) ;
//  - sinon il attend son tour dans une file courte, ou il est abandonné s'il n'a plus d'intérêt ;
//  - la voix de la mascotte passe par-dessus les effets, qui baissent pendant qu'elle parle ;
//  - une seule voix à la fois.
// Le module ne dépend pas du navigateur : il est testé dans Node (test/orchestre.test.js).
(function (racine) {
  'use strict';

  // prio : importance (0 à 100). attente : combien de temps (ms) le son peut patienter dans la file (0 = abandonné si occupé).
  // coupe : écart de priorité minimum pour couper le son en cours.
  const RAISONS = {
    fin:        { prio: 98, attente: 8000 },  // écran de fin
    sommet:     { prio: 96, attente: 8000 },  // sommet atteint
    regie:      { prio: 92, attente: 0, coupeTout: true }, // l'animateur appuie sur la soundboard : immédiat
    coffre:     { prio: 88, attente: 6000 },  // cagnotte pleine, refuge débloqué
    record:     { prio: 86, attente: 6000 },
    danger:     { prio: 82, attente: 2500 },  // il va lâcher / il tombe
    merciGros:  { prio: 76, attente: 7000 },  // applaudissement d'un cadeau de 1 000 pièces ou plus
    merci:      { prio: 70, attente: 6000 },  // applaudissement d'un cadeau de 100 pièces ou plus
    miniJeu:    { prio: 66, attente: 7000 },  // début et résultat des mini-jeux
    appel:      { prio: 60, attente: 2500 },  // toc toc sur la vitre
    chef:       { prio: 56, attente: 3000 },  // nouveau premier de cordée
    rafale:     { prio: 50, attente: 5000 },  // applaudissement de fin de rafale de petits cadeaux
    scene:      { prio: 44, attente: 1200 },  // atterrissage, frayeur
    palier:     { prio: 40, attente: 3000 },  // palier de taps
    bisou:      { prio: 34, attente: 2500 },
    social:     { prio: 24, attente: 1500 },  // abonnement, partage
    chat:       { prio: 16, attente: 2500, fileMax: 1 }, // !prout et compagnie
    ambiance:   { prio: 4, attente: 0 }       // tonnerre, vent
  };
  const ECART_POUR_COUPER = 30;
  const FILE_MAX = 5;
  const ATTENUATION_VOIX = 0.35;

  function creerOrchestre(o) {
    const maintenant = o.maintenant;
    const planifier = o.planifier;
    const annuler = o.annuler;
    const journal = o.journal || function () {};
    let courant = null; // { nom, raison, prio, fin, arreter, timer }
    let file = [];      // { nom, raison, prio, expire, arrivee }
    let voix = null;    // { texte, prio, fin, arreter, timer }

    function regle(raison) { return RAISONS[raison] || RAISONS.scene; }

    function lancer(nom, raison) {
      const r = regle(raison);
      const res = o.jouerEffet(nom) || { duree: 0 };
      const duree = Math.max(0.15, res.duree || 0);
      const t = maintenant();
      courant = { nom, raison, prio: r.prio, debut: t, fin: t + duree * 1000, arreter: res.arreter };
      journal({ type: 'effet', statut: 'joue', nom, raison, debut: t, fin: courant.fin });
      courant.timer = planifier(fini, duree * 1000 + 60);
    }

    function fini() {
      courant = null;
      suivant();
    }

    function suivant() {
      const t = maintenant();
      file = file.filter(x => {
        if (x.expire < t) { journal({ type: 'effet', statut: 'expire', nom: x.nom, raison: x.raison, debut: t }); return false; }
        return true;
      });
      if (courant || !file.length) return;
      const x = file.shift();
      lancer(x.nom, x.raison);
    }

    function couperCourant(motif) {
      if (!courant) return;
      annuler(courant.timer);
      if (courant.arreter) courant.arreter();
      journal({ type: 'effet', statut: 'coupe', nom: courant.nom, raison: courant.raison, debut: maintenant(), par: motif });
      // L'effet coupé s'arrête vraiment maintenant (fondu de 60 ms au plus).
      courant = null;
    }

    function effet(nom, raison) {
      const r = regle(raison);
      const t = maintenant();
      // Doublon : le même son pour la même raison est déjà en cours ou en attente
      // (l'animateur, lui, peut relancer un son en rappuyant : on le coupe et on le rejoue).
      if (!r.coupeTout && (courant && courant.nom === nom && courant.raison === raison) || file.some(x => x.nom === nom && x.raison === raison)) {
        journal({ type: 'effet', statut: 'doublon', nom, raison, debut: t });
        return false;
      }
      if (!courant) { lancer(nom, raison); return true; }
      if (r.coupeTout || r.prio - courant.prio >= ECART_POUR_COUPER) {
        couperCourant(nom);
        lancer(nom, raison);
        return true;
      }
      if (!r.attente) { journal({ type: 'effet', statut: 'ignore', nom, raison, debut: t }); return false; }
      const memes = file.filter(x => x.raison === raison).length;
      if (r.fileMax && memes >= r.fileMax) { journal({ type: 'effet', statut: 'ignore', nom, raison, debut: t }); return false; }
      file.push({ nom, raison, prio: r.prio, expire: t + r.attente, arrivee: t });
      file.sort((a, b) => b.prio - a.prio || a.arrivee - b.arrivee);
      while (file.length > FILE_MAX) {
        const x = file.pop();
        journal({ type: 'effet', statut: 'ignore', nom: x.nom, raison: x.raison, debut: t });
      }
      return true;
    }

    // La voix de la mascotte : une seule à la fois ; une voix plus importante remplace la précédente.
    function parler(texte, prio) {
      const t = maintenant();
      if (voix && t < voix.fin) {
        if (prio <= voix.prio) { journal({ type: 'voix', statut: 'ignore', texte, debut: t }); return false; }
        annuler(voix.timer);
        if (voix.arreter) voix.arreter();
        journal({ type: 'voix', statut: 'coupe', texte: voix.texte, debut: t });
      }
      if (voix) annuler(voix.timer); // voix précédente déjà terminée : sa minuterie ne doit pas effacer la nouvelle
      const res = o.jouerVoix(texte) || { duree: 0 };
      const duree = Math.max(0.2, res.duree || 0);
      const v = { texte, prio, fin: t + duree * 1000, arreter: res.arreter };
      voix = v;
      journal({ type: 'voix', statut: 'joue', texte, debut: t, fin: v.fin });
      if (o.attenuer) o.attenuer(ATTENUATION_VOIX);
      v.timer = planifier(() => { if (voix === v) { voix = null; if (o.attenuer) o.attenuer(1); } }, duree * 1000 + 60);
      return true;
    }

    function vider() {
      file = [];
      couperCourant('vider');
    }

    // Ce son est-il en train de jouer ou en attente ?
    function contient(nom) { return (courant && courant.nom === nom) || file.some(x => x.nom === nom); }

    return { effet, parler, vider, contient, etat: () => ({ courant, file: file.slice(), voix }) };
  }

  const api = { creerOrchestre, RAISONS, ECART_POUR_COUPER };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.Orchestre = api;
})(typeof window !== 'undefined' ? window : this);
