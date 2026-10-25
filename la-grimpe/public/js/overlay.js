// Overlay de La Grimpe : dessine la tour, la mascotte et toute l'interface du live.
(function () {
  'use strict';

  // ---------- Réglages d'affichage ----------
  const PARAMS = new URLSearchParams(location.search);
  const CIEL = PARAMS.get('ciel') !== '0'; // ?ciel=0 : ciel transparent (la caméra passe derrière)
  const MUET = PARAMS.get('muet') === '1'; // ?muet=1 : aucun son dans l'overlay
  const W = 1080, H = 1920, CX = 540, ANCRE_Y = 1060, PX_M = 6;
  const MUR_G = 300, MUR_D = 780;

  const $ = id => document.getElementById(id);
  const scene = $('scene');
  const cv = $('monde');
  const ctx = cv.getContext('2d');
  const ctxFx = $('effets').getContext('2d'); // calque au-dessus des alertes : coffre et pièces

  function ajuster() {
    const s = Math.min(innerWidth / W, innerHeight / H);
    scene.style.transform = `translate(${(innerWidth - W * s) / 2}px, ${(innerHeight - H * s) / 2}px) scale(${s})`;
  }
  addEventListener('resize', ajuster);
  ajuster();
  if (!CIEL) document.body.style.background = 'transparent';

  // ---------- Utilitaires ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = n => Math.round(n).toLocaleString('fr-FR');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const hash = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
  const COULEURS = ['#e76f51', '#2a9d8f', '#e9a03b', '#8338ec', '#3a86ff', '#ff006e', '#fb5607', '#06a77d'];
  function couleurDe(s) { let h = 0; for (const c of String(s || '?')) h = (h * 31 + c.charCodeAt(0)) | 0; return COULEURS[Math.abs(h) % COULEURS.length]; }
  const lettreDe = u => ((u && (u.nom || u.pseudo)) || '?').trim().charAt(0).toUpperCase() || '?';

  const images = new Map();
  function image(url) {
    if (!url) return null;
    let i = images.get(url);
    if (!i) {
      i = new Image();
      i.referrerPolicy = 'no-referrer';
      i.src = url;
      images.set(url, i);
    }
    return i;
  }
  const prete = i => i && i.complete && i.naturalWidth > 0;

  function avatarHTML(u, extra = '') {
    return `<div class="avatar" style="background-color:${couleurDe(u.pseudo || u.id)}" data-src="${esc(u.avatar || '')}"><span class="lettre">${esc(lettreDe(u))}</span>${extra}</div>`;
  }
  // Remplace la lettre par la vraie photo de profil quand elle est chargée.
  function hydrater(racine) {
    racine.querySelectorAll('.avatar[data-src]').forEach(el => {
      const src = el.getAttribute('data-src');
      el.removeAttribute('data-src');
      if (!src) return;
      const i = image(src);
      const ok = () => { el.style.backgroundImage = `url("${src.replace(/"/g, '%22')}")`; const l = el.querySelector('.lettre'); if (l) l.remove(); };
      if (prete(i)) ok(); else i.addEventListener('load', ok, { once: true });
    });
  }

  // ---------- Sons ----------
  let reglages = { volume: 0.8, sonsAutomatiques: true };
  function son(nom) { if (!MUET) Sons.jouer(nom); }
  function sonAuto(nom) { if (reglages.sonsAutomatiques) son(nom); }
  // Une seule voix à la fois (sauf message important), sinon les bulles qui s'enchaînent se superposent.
  let voixFin = 0;
  function voix(texte, prio) {
    if (MUET || !reglages.sonsAutomatiques) return;
    const t = performance.now();
    if (t < voixFin && prio < 4) return;
    voixFin = t + Sons.charabia(texte) * 1000;
  }
  const boutonSon = $('activer-son');
  function verifierSon() {
    if (MUET) return;
    Sons.init();
    boutonSon.classList.toggle('cache', Sons.actif());
  }
  boutonSon.addEventListener('click', () => Sons.debloquer().then(verifierSon));
  addEventListener('pointerdown', () => Sons.debloquer().then(verifierSon));
  setInterval(verifierSon, 2000);
  setTimeout(verifierSon, 600);

  // ---------- État reçu du serveur ----------
  let CFG = null;
  let ETAT = null;
  let N = 17, ESP = 300;
  let TICK = { alt: 0, sol: 0, porte: 300, energie: 60, statut: 'repos', protection: 0, boost: false, tapRate: 0 };
  let altAff = 0, camAlt = 0, phase = 0, decalageY = 0;
  const ouvertures = {}; // numéro de refuge -> instant d'ouverture de la grille

  // ---------- WebSocket ----------
  function connecter() {
    const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
    ws.onopen = () => { ws.send(JSON.stringify({ t: 'hello', role: 'overlay' })); $('hors-ligne').classList.add('cache'); };
    ws.onmessage = e => { try { recevoir(JSON.parse(e.data)); } catch (err) { console.error(err); } };
    ws.onclose = () => { $('hors-ligne').classList.remove('cache'); setTimeout(connecter, 2000); };
  }

  function recevoir(m) {
    if (m.t === 'init') {
      CFG = m.config;
      N = CFG.objectifs.length;
      ESP = CFG.metresEntreRefuges;
      Sons.setFichiersPerso(CFG.fichiersPerso);
      CFG.objectifs.forEach(o => image(o.image));
      TICK = m.tick;
      altAff = camAlt = TICK.alt;
      construirePastilles();
      appliquerEtat(m.etat);
      demarrerBandeau();
    } else if (m.t === 'tick') {
      TICK = m.d;
    } else if (m.t === 'etat') {
      appliquerEtat(m.d);
    } else if (m.t === 'evt') {
      evenement(m.type, m.d);
    }
  }

  // ---------- Interface : refuge, pastilles, cordée, altimètre ----------
  function construirePastilles() {
    $('pastilles').innerHTML = CFG.objectifs.map((o, i) => `<div class="pastille" data-i="${i}">${i + 1}</div>`).join('');
  }

  function appliquerEtat(e) {
    const ancien = ETAT;
    ETAT = e;
    reglages = e.reglages || reglages;
    Sons.setVolume(reglages.volume);
    const idx = e.objIndex;

    if (idx >= N) {
      $('refuge-titre').textContent = e.sommetAtteint ? '🏔️ SOMMET ATTEINT' : '🏔️ CAP SUR LE SOMMET';
      $('refuge-nom').textContent = e.sommetAtteint ? 'Au-delà : on bat le record !' : 'Tous les refuges sont ouverts !';
      $('refuge-img').src = CFG.objectifs[N - 1].image;
      $('cagnotte-rempli').style.width = '100%';
      $('cagnotte-texte').textContent = 'Record : ' + nf(e.record) + ' m';
      $('refuge-sous').textContent = 'Chaque cadeau le propulse encore plus haut 🚀';
    } else {
      const o = CFG.objectifs[idx];
      $('refuge-titre').textContent = `REFUGE ${idx + 1}/${N}`;
      $('refuge-nom').textContent = o.nom;
      if ($('refuge-img').getAttribute('src') !== o.image) $('refuge-img').src = o.image;
      $('cagnotte-rempli').style.width = clamp(e.cagnotte / o.pieces * 100, 0, 100) + '%';
      $('cagnotte-texte').textContent = `${nf(e.cagnotte)} / ${nf(o.pieces)} 🪙`;
      $('refuge-sous').textContent = `Envoyez un ${o.nom}, ou ${nf(o.pieces)} pièces en cadeaux`;
    }
    document.querySelectorAll('.pastille').forEach((p, i) => {
      p.classList.toggle('ok', i < idx);
      p.classList.toggle('encours', i === idx);
    });
    rendreCordee(e.classement || []);
    rendreTapeurs(e.tapeurs || []);
    $('alt-record-texte').innerHTML = `🚩 Record<br><b>${nf(e.record)} m</b>`;
    if (!ancien || ancien.objIndex !== idx || ancien.record !== e.record) rendreReperes();
    if (!ancien || JSON.stringify(ancien.miniJeu) !== JSON.stringify(e.miniJeu)) rendreMiniJeu(e.miniJeu);
    if (e.ecranFin && $('fin').classList.contains('cache')) afficherFin(e.ecranFin);
    if (!e.ecranFin && ancien && ancien.ecranFin) $('fin').classList.add('cache');
  }

  const noeudsCordee = new Map();
  const HAUTEUR_LIGNE = 74;
  function rendreCordee(liste) {
    const cont = $('cordee-liste');
    $('cordee-vide').classList.toggle('cache', liste.length > 0);
    cont.style.height = liste.length * HAUTEUR_LIGNE + 'px';
    const vus = new Set();
    liste.forEach((u, i) => {
      let n = noeudsCordee.get(u.id);
      if (!n) {
        n = document.createElement('div');
        n.className = 'grimpeur';
        n.style.top = liste.length * HAUTEUR_LIGNE + 'px';
        n._rang = 99;
        cont.appendChild(n);
        noeudsCordee.set(u.id, n);
      }
      const cle = [i, u.pseudo, u.avatar, u.pieces].join('|');
      if (n._cle !== cle) {
        n.innerHTML = `<div class="rang">${i + 1}</div>${avatarHTML(u, i === 0 ? '<span class="couronne">👑</span>' : '')}<div class="qui"><div class="pseudo">@${esc(u.pseudo)}</div><div class="pts">🪙 ${nf(u.pieces)}</div></div>`;
        hydrater(n);
        n._cle = cle;
      }
      if (i < n._rang && n._rang !== 99) { n.classList.remove('monte'); void n.offsetWidth; n.classList.add('monte'); }
      n._rang = i;
      n.classList.toggle('chef', i === 0);
      requestAnimationFrame(() => { n.style.top = i * HAUTEUR_LIGNE + 'px'; });
      vus.add(u.id);
    });
    for (const [id, n] of noeudsCordee) if (!vus.has(id)) { n.remove(); noeudsCordee.delete(id); }
  }

  let cleTapeurs = '';
  function rendreTapeurs(liste) {
    $('tapeurs').classList.toggle('cache', liste.length === 0);
    const cle = liste.map(u => u.id + ':' + u.taps).join(',');
    if (cle === cleTapeurs) return;
    cleTapeurs = cle;
    const med = ['🥇', '🥈', '🥉'];
    $('tapeurs-liste').innerHTML = liste.map((u, i) => `<div class="tapeur"><span>${med[i]}</span>${avatarHTML(u)}<span class="pseudo">@${esc(u.pseudo)}</span><span class="nb">${nf(u.taps)}</span></div>`).join('');
    hydrater($('tapeurs-liste'));
  }

  function altMax() { return Math.max(N * ESP, (ETAT && ETAT.record) || 0, TICK.alt) * 1.04; }
  function rendreReperes() {
    const max = altMax();
    let h = '';
    for (let k = 1; k <= N; k++) {
      const cls = k <= ETAT.objIndex ? 'ok' : k === ETAT.objIndex + 1 ? 'porte' : '';
      h += `<div class="repere ${cls}" style="bottom:${(k * ESP / max) * 100}%"></div>`;
    }
    $('alt-reperes').innerHTML = h;
    $('alt-record').style.bottom = (ETAT.record / max) * 100 + '%';
  }

  // ---------- Mini-jeux ----------
  let MJ = null;
  const MJ_TEXTES = {
    vote: ['🎲 VOTE DU DESTIN', 'Écrivez <b>AIDE</b> ou <b>PIÈGE</b> dans le chat !'],
    course: ['⚡ COURSE AUX TAPS', ''],
    mot: ['🔤 LE MOT MAGIQUE', 'Le 1er qui l\'écrit dans le chat gagne !'],
    tempete: ['🌪️ TEMPÊTE !', 'Tapez fort pour qu\'il ne s\'envole pas !']
  };
  function rendreMiniJeu(mj) {
    const el = $('minijeu');
    if (!mj) { el.classList.add('cache'); MJ = null; return; }
    const nouveau = !MJ || MJ.debut !== mj.debut;
    MJ = Object.assign({}, mj, { finLocale: Date.now() + (mj.fin - mj.maintenant), dureeTotale: mj.fin - mj.debut });
    const [titre, consigne] = MJ_TEXTES[mj.type];
    if (nouveau) {
      el.classList.remove('cache');
      let corps = '';
      if (mj.type === 'vote') corps = `<div class="mj-votes"><div class="mj-vote aide"><div class="rempli" id="mj-aide-r"></div><b>🪜 AIDE</b><span id="mj-aide">0</span></div><div class="mj-vote piege"><div class="rempli" id="mj-piege-r"></div><b>🍌 PIÈGE</b><span id="mj-piege">0</span></div></div>`;
      if (mj.type === 'course') corps = `<div class="mj-barre"><div id="mj-course-r"></div><span id="mj-course">0 / ${nf(mj.cible)}</span></div>`;
      if (mj.type === 'mot') corps = `<div class="mj-mot">${esc(mj.mot)}</div>`;
      const cons = mj.type === 'course' ? `Tapez <b>${nf(mj.cible)}</b> fois en 60 secondes !` : consigne;
      el.innerHTML = `<div class="mj-titre">${titre}</div><div class="mj-consigne">${cons}</div>${corps}<div class="mj-timer"><div id="mj-timer"></div></div>`;
    }
    if (mj.type === 'vote') {
      const tot = Math.max(1, mj.votes.aide + mj.votes.piege);
      $('mj-aide').textContent = mj.votes.aide; $('mj-piege').textContent = mj.votes.piege;
      $('mj-aide-r').style.height = mj.votes.aide / tot * 100 + '%';
      $('mj-piege-r').style.height = mj.votes.piege / tot * 100 + '%';
    }
    if (mj.type === 'course') {
      $('mj-course-r').style.width = clamp(mj.progres / mj.cible * 100, 0, 100) + '%';
      $('mj-course').textContent = `${nf(mj.progres)} / ${nf(mj.cible)}`;
    }
  }

  // ---------- Bulle de parole ----------
  let bulle = null;
  function dire(texte, opts = {}) {
    if (!texte) return;
    const t = performance.now();
    const prio = opts.prio || 1;
    if (bulle && t < bulle.fin && bulle.prio > prio) return;
    const duree = opts.duree || clamp(texte.length * 0.065 + 2, 2.6, 7);
    bulle = { texte, debut: t, fin: t + duree * 1000, prio, crie: !!opts.crie, vitesse: opts.crie ? 22 : 30 };
    const el = $('bulle');
    el.classList.remove('cache', 'entree', 'crie');
    void el.offsetWidth;
    el.classList.add('entree');
    if (bulle.crie) el.classList.add('crie');
    $('bulle-avatar').innerHTML = opts.user ? avatarHTML(opts.user) : '';
    hydrater($('bulle-avatar'));
    $('bulle-texte').textContent = '';
    if (!opts.silence) voix(texte, prio);
  }

  // ---------- Pancarte ----------
  let pancarteFin = 0;
  function montrerPancarte(d) {
    const o = d.objectif;
    const el = $('pancarte');
    el.innerHTML = `<img src="${esc(o.image)}" alt=""><div class="p-titre">Il me faut :<br>${esc(o.nom)} !</div><div class="p-sous">ou ${nf(o.pieces)} 🪙 en cadeaux<br>(cagnotte : ${nf(d.cagnotte || 0)} / ${nf(o.pieces)})</div>`;
    el.classList.remove('cache');
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    pancarteFin = performance.now() + 9500;
  }

  // ---------- Alertes cadeaux ----------
  const fileAlertes = [];
  let alerteActive = null;
  function ajouterAlerte(d) {
    // Les gros cadeaux passent devant les petits qui attendent encore leur alerte.
    const i = d.valeur >= reglesSons().applaudirDes ? fileAlertes.findIndex(x => x.valeur < d.valeur) : -1;
    if (i >= 0) fileAlertes.splice(i, 0, d); else fileAlertes.push(d);
    if (fileAlertes.length > 15) fileAlertes.splice(0, fileAlertes.length - 15);
    suivanteAlerte();
  }
  function suivanteAlerte() {
    if (alerteActive || !fileAlertes.length) return;
    const d = fileAlertes.shift();
    const el = document.createElement('div');
    el.className = 'alerte t' + d.tier;
    const img = d.image || (d.objectifIndex >= 0 ? CFG.objectifs[d.objectifIndex].image : '');
    el.innerHTML = `${avatarHTML(d.user)}<div class="a-texte"><div class="a-pseudo">@${esc(d.user.pseudo)}</div><div class="a-quoi">envoie ${esc(d.cadeau)}${d.repeat > 1 ? ' ×' + d.repeat : ''}</div><div class="a-montee">⬆️ +${nf(d.montee)} m · 🪙 ${nf(d.valeur)}</div></div>${img ? `<img class="a-cadeau" src="${esc(img)}" referrerpolicy="no-referrer" alt="">` : ''}`;
    hydrater(el);
    $('alertes').appendChild(el);
    alerteActive = el;
    let duree = [0, 3000, 4000, 5200][d.tier];
    if (fileAlertes.length > 3) duree = 1800;
    setTimeout(() => {
      el.classList.add('sortie');
      setTimeout(() => { el.remove(); alerteActive = null; suivanteAlerte(); }, 450);
    }, duree);
  }

  // ---------- Bannière centrale ----------
  const fileBannieres = [];
  let banniereActive = false;
  function banniere(titre, sous, opts = {}) {
    fileBannieres.push({ titre, sous, opts });
    if (fileBannieres.length > 6) fileBannieres.shift();
    suivanteBanniere();
  }
  function suivanteBanniere() {
    if (banniereActive || !fileBannieres.length) return;
    const { titre, sous, opts } = fileBannieres.shift();
    const el = $('banniere');
    el.className = opts.classe || '';
    el.innerHTML = `${opts.img ? `<img src="${esc(opts.img)}" referrerpolicy="no-referrer" alt="">` : ''}<div class="b-titre">${titre}</div>${sous ? `<div class="b-sous">${sous}</div>` : ''}`;
    banniereActive = true;
    setTimeout(() => { el.className = 'cache'; banniereActive = false; setTimeout(suivanteBanniere, 250); }, opts.duree || 3600);
  }

  // ---------- Fil d'actualité, oiseaux, combo ----------
  function fil(texte) {
    const el = document.createElement('div');
    el.className = 'fil-item';
    el.textContent = texte;
    const f = $('fil');
    f.appendChild(el);
    while (f.children.length > 4) f.firstChild.remove();
    setTimeout(() => { el.classList.add('sortie'); setTimeout(() => el.remove(), 600); }, 7000);
  }

  function oiseau(u, autres) {
    const c = $('oiseaux');
    if (c.children.length >= 4) return;
    const el = document.createElement('div');
    el.className = 'oiseau';
    el.style.top = (330 + Math.random() * 560) + 'px';
    el.style.animationDuration = (6 + Math.random() * 3) + 's';
    el.innerHTML = `<span class="etiquette">@${esc(u.pseudo)} arrive${autres > 0 ? ' (+' + autres + ')' : ''} 👋</span><span class="ailes">🐦</span>`;
    c.appendChild(el);
    el.addEventListener('animationend', e => { if (e.animationName === 'vole') el.remove(); });
  }

  let comboTimer = null, comboCle = '';
  function combo(d) {
    const el = $('combo');
    const cle = d.user.id + '|' + d.cadeau;
    if (cle !== comboCle || el.classList.contains('cache')) {
      comboCle = cle;
      el.innerHTML = `🔥 @${esc(d.user.pseudo)} ${d.image ? `<img src="${esc(d.image)}" referrerpolicy="no-referrer" alt="">` : esc(d.cadeau)} <span class="x" id="combo-x"></span>`;
    }
    $('combo-x').textContent = '×' + d.repeat;
    el.classList.remove('cache', 'boum'); void el.offsetWidth; el.classList.add('boum');
    clearTimeout(comboTimer);
    comboTimer = setTimeout(() => el.classList.add('cache'), 2500);
    rafalePetits(0);
  }

  function bisou() {
    const el = document.createElement('div');
    el.className = 'bisou';
    el.textContent = '💋';
    const cote = Math.random() < 0.5 ? -1 : 1;
    el.style.left = (CX + cote * (170 + Math.random() * 90) - 60) + 'px';
    el.style.top = (640 + Math.random() * 200) + 'px';
    el.style.transform = `rotate(${Math.random() * 40 - 20}deg)`;
    $('bisous').appendChild(el);
    while ($('bisous').children.length > 3) $('bisous').firstChild.remove();
    setTimeout(() => el.remove(), 12000);
    son('bisou');
  }

  // ---------- Bandeau ----------
  let bandeauTimer = null, bandeauI = 0;
  function demarrerBandeau() {
    clearInterval(bandeauTimer);
    const changer = () => {
      const el = $('bandeau-texte');
      let phrases = CFG.phrasesBandeau.slice();
      if (TICK.statut === 'bloque' && ETAT && ETAT.objIndex < N) {
        const o = CFG.objectifs[ETAT.objIndex];
        phrases = [`🔒 Refuge bloqué : un ${o.nom} pour passer !`, phrases[bandeauI % phrases.length]];
      }
      bandeauI++;
      el.style.opacity = 0;
      setTimeout(() => { el.textContent = phrases[bandeauI % phrases.length]; el.style.opacity = 1; }, 500);
    };
    changer();
    bandeauTimer = setInterval(changer, (CFG.secondesEntrePhrasesBandeau || 35) * 1000);
  }

  // ---------- Écran de fin ----------
  function afficherFin(r) {
    const el = $('fin');
    const ordre = [r.podium[1], r.podium[0], r.podium[2]];
    const classes = ['p2', 'p1', 'p3'];
    const num = [2, 1, 3];
    const podium = ordre.map((u, i) => u ? `<div class="marche ${classes[i]}">${avatarHTML(u, num[i] === 1 ? '<span class="couronne" style="font-size:60px;top:-62px">👑</span>' : '')}<div class="nom">@${esc(u.pseudo)}</div><div class="pts">🪙 ${nf(u.pieces)}</div><div class="bloc">${num[i]}</div></div>` : '').join('');
    el.innerHTML = `<div class="fin-titre">FIN DE LA GRIMPE</div>
      <div class="fin-alt">${nf(r.altitude)} m</div>
      <div class="fin-record">${r.recordBattu ? '🎉 NOUVEAU RECORD !' : '🚩 Record : ' + nf(r.record) + ' m'}</div>
      <div class="fin-stats">
        <div class="fin-stat"><b>${r.refuges}/${r.total}</b><span>refuges</span></div>
        <div class="fin-stat"><b>${nf(r.likes)}</b><span>taps</span></div>
        <div class="fin-stat"><b>${r.chutes}</b><span>chutes 😅</span></div>
      </div>
      <div class="podium">${podium}</div>
      <div class="fin-merci">Merci à tous ❤️ On bat le record au prochain live !</div>`;
    hydrater(el);
    el.classList.remove('cache');
    son('fanfare');
    confettis(140);
  }

  // ---------- Particules et effets ----------
  const particules = [];
  function confettis(n) {
    const cols = ['#ffc94a', '#ff6b9d', '#4ade80', '#60a5fa', '#c084fc', '#ffffff', '#ff7a59'];
    for (let i = 0; i < n; i++) {
      particules.push({ type: 'confetti', x: Math.random() * W, y: -20 - Math.random() * 400, vx: (Math.random() - 0.5) * 160, vy: 250 + Math.random() * 350, r: 7 + Math.random() * 8, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10, c: cols[i % cols.length], vie: 5 });
    }
  }
  function emoji(e, x, y, n, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (opts.vitesse || 300) * (0.4 + Math.random() * 0.8);
      particules.push({ type: 'emoji', e, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (opts.monte || 200), g: opts.gravite != null ? opts.gravite : 300, taille: opts.taille || 46, vie: opts.vie || 2.2, vie0: opts.vie || 2.2 });
    }
  }
  function pluie(e, n, duree) {
    for (let i = 0; i < n; i++) {
      particules.push({ type: 'emoji', e, x: Math.random() * W, y: -60 - Math.random() * duree * 300, vx: (Math.random() - 0.5) * 60, vy: 180 + Math.random() * 160, g: 0, taille: 34 + Math.random() * 24, vie: duree + 4, vie0: duree + 4, tourne: true });
    }
  }
  let secousse = 0, flash = 0;
  function secouer(a) { secousse = Math.max(secousse, a); }

  const fissures = [];
  function fissure(x, y) {
    const lignes = [];
    const nb = 6 + Math.floor(Math.random() * 4);
    for (let i = 0; i < nb; i++) {
      const a = (i / nb) * Math.PI * 2 + Math.random() * 0.5;
      let px = x, py = y;
      const pts = [[px, py]];
      const l = 50 + Math.random() * 110;
      for (let k = 0; k < 4; k++) {
        px += Math.cos(a + (Math.random() - 0.5) * 0.7) * l / 4;
        py += Math.sin(a + (Math.random() - 0.5) * 0.7) * l / 4;
        pts.push([px, py]);
      }
      lignes.push(pts);
    }
    fissures.push({ x, y, lignes, t: performance.now() });
    if (fissures.length > 8) fissures.shift();
  }

  // Compagnons : le cadeau reçu agit à l'écran autour de la mascotte.
  const compagnons = [];
  const DUREES_STYLE = { tete: 25, porte: 4.5, girafe: 4.5, corde: 4.5, vol: 5, bulle: 4.5, arbre: 4.5, charge: 3.5, final: 7, calin: 4.5, mange: 1.8, encourage: 2.2, saut: 1.6, pluie: 2.2, foule: 2.2, bouclier: 2.2 };
  function ajouterCompagnon(style, img) {
    const t = performance.now();
    if (style === 'tete') { for (let i = compagnons.length - 1; i >= 0; i--) if (compagnons[i].style === 'tete') compagnons.splice(i, 1); }
    compagnons.push({ style, img: image(img), debut: t, fin: t + (DUREES_STYLE[style] || 2.2) * 1000 });
    if (compagnons.length > 8) compagnons.shift();
  }

  // ---------- Scènes (déclenchées par le serveur) ----------
  let forcage = null; // pose imposée temporairement à la mascotte
  let zoomAnim = null; // { debut, monte, tient, descend, max }
  let toc = 0;
  function forcer(mode, expression, secondes) { forcage = { mode, expression, fin: performance.now() + secondes * 1000 }; }
  function zoomer(max, tient) { zoomAnim = { debut: performance.now(), monte: 450, tient: tient * 1000, descend: 500, max }; }
  function valeurZoom(t) {
    if (!zoomAnim) return 1;
    const z = zoomAnim, e = t - z.debut;
    const ease = k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    if (e < z.monte) return lerp(1, z.max, ease(e / z.monte));
    if (e < z.monte + z.tient) return z.max;
    if (e < z.monte + z.tient + z.descend) return lerp(z.max, 1, ease((e - z.monte - z.tient) / z.descend));
    zoomAnim = null;
    return 1;
  }

  function sceneRecue(d) {
    switch (d.type) {
      case 'toctoc':
        forcer('toctoc', 'supplie', 4.6);
        zoomer(1.9, 3.6);
        setTimeout(() => son('toctoc'), 500);
        [550, 770, 990].forEach(ms => setTimeout(() => { toc = 1; secouer(7); fissure(CX + 120 + Math.random() * 120, 720 + Math.random() * 160); }, ms));
        setTimeout(() => dire(d.texte, { prio: 3, duree: 4 }), 1150);
        break;
      case 'bord':
        dire(d.texte, { prio: 5, crie: true, duree: 6 });
        sonAuto('alarme');
        break;
      case 'ouf': dire(d.texte, { prio: 4 }); break;
      case 'chute':
        dire(d.texte, { prio: 5, crie: true, duree: 2.6 });
        sonAuto('chute');
        break;
      case 'atterrit':
        dire(d.texte, { prio: 3 });
        sonAuto('boing');
        secouer(12);
        emoji('💨', CX, ANCRE_Y + 130, 8, { vitesse: 200, monte: 50, taille: 40, vie: 1.2, gravite: 0 });
        break;
      case 'frayeur':
        forcer('accroche', 'peur', 1.3);
        dire(d.texte, { prio: 2, crie: true, duree: 2.2 });
        sonAuto('whoosh');
        secouer(5);
        break;
      case 'pancarte':
        forcer('supplie', 'supplie', 9.5);
        montrerPancarte(d);
        dire(d.texte, { prio: 3, duree: 5 });
        break;
      case 'appel':
        forcer(null, 'supplie', 3);
        dire(d.texte, { prio: 2, user: d.user, duree: 4.5 });
        break;
      case 'boude':
        forcer('boude', 'boude', 40);
        dire(d.texte, { prio: 2, duree: 4.5 });
        break;
      case 'victoire':
        celebrer(d.texte);
        break;
      case 'parole':
        dire(d.texte, { prio: 4, duree: clamp(d.texte.length * 0.07 + 2, 3, 9) });
        break;
      default:
        if (d.texte) dire(d.texte, { prio: 2 });
    }
  }

  function celebrer(texte) {
    forcer('joie', 'joie', 4.2);
    zoomer(2.5, 2.6);
    setTimeout(bisou, 1300);
    if (texte) setTimeout(() => dire(texte, { prio: 4, duree: 3.5 }), 500);
  }

  // ---------- Sons des cadeaux (sans spam) ----------
  function reglesSons() {
    return Object.assign({ applaudirDes: 100, merciVocalDes: 1000, finRafaleSecondes: 3, rafaleMinimum: 2 }, CFG.sonsCadeaux || {});
  }
  let dernierApplaudissement = 0;
  function applaudir() {
    const t = performance.now();
    if (t - dernierApplaudissement < 3000) return;
    dernierApplaudissement = t;
    sonAuto('applaudissements');
  }
  let rafale = { nb: 0, timer: null };
  function rafalePetits(nb) {
    rafale.nb += nb;
    clearTimeout(rafale.timer);
    rafale.timer = setTimeout(() => {
      if (rafale.nb >= reglesSons().rafaleMinimum) applaudir();
      rafale.nb = 0;
    }, reglesSons().finRafaleSecondes * 1000);
  }

  // Le coffre de la cagnotte : il s'ouvre et les pièces s'écroulent sur l'écran.
  let coffre = null;
  function ouvrirCoffre(force) {
    coffre = { debut: performance.now(), force };
    son('coffre');
    const pleine = $('cagnotte-rempli');
    pleine.style.width = '100%';
    for (let i = 0; i < 70 * force; i++) {
      setTimeout(() => {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
        const v = 500 + Math.random() * 700;
        pieces.push({ type: 'piece', x: CX + (Math.random() - 0.5) * 60, y: COFFRE_Y - 30, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 1400, r: 16 + Math.random() * 10, rot: Math.random() * 6, vr: 8 + Math.random() * 10, vie: 4 });
      }, 650 + Math.random() * 900 * force);
    }
  }
  const COFFRE_Y = 380;
  const pieces = [];
  function dessinerCoffre(t, dt) {
    const ctx = ctxFx;
    ctx.clearRect(0, 0, W, H);
    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i];
      p.vie -= dt;
      if (p.vie <= 0 || p.y > H + 60) { pieces.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.rot += p.vr * dt;
      const larg = Math.abs(Math.cos(p.rot)) * p.r + 2;
      ctx.save(); ctx.translate(p.x, p.y);
      ctx.fillStyle = Math.cos(p.rot) > 0 ? '#ffd34d' : '#e0a100';
      ctx.beginPath(); ctx.ellipse(0, 0, larg, p.r, 0, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#a06a00'; ctx.stroke();
      if (larg > p.r * 0.6) { ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.ellipse(-larg * 0.3, -p.r * 0.3, larg * 0.25, p.r * 0.2, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    if (!coffre) return;
    const e = (t - coffre.debut) / 1000;
    if (e > 3.6) { coffre = null; return; }
    const entree = Math.min(1, e / 0.35);
    const sortie = e > 3 ? 1 - (e - 3) / 0.6 : 1;
    const ouverture = Math.min(1, Math.max(0, (e - 0.5) / 0.25));
    const s = 1.1 * (0.4 + 0.6 * (1 - Math.pow(1 - entree, 3)));
    const tremble = e > 0.3 && e < 0.55 ? Math.sin(e * 90) * 6 : 0;
    ctx.save();
    ctx.globalAlpha = Math.max(0, sortie);
    ctx.translate(CX + tremble, COFFRE_Y);
    ctx.scale(s, s);
    // Halo
    const g = ctx.createRadialGradient(0, -30, 10, 0, -30, 200);
    g.addColorStop(0, `rgba(255,214,90,${0.7 * ouverture})`);
    g.addColorStop(1, 'rgba(255,214,90,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, -30, 200, 0, Math.PI * 2); ctx.fill();
    // Caisse
    ctx.lineWidth = 6; ctx.strokeStyle = '#3d2410';
    ctx.fillStyle = '#8a5a2b';
    ctx.beginPath(); ctx.roundRect(-110, -40, 220, 120, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffc94a';
    ctx.fillRect(-110, -6, 220, 16); ctx.fillRect(-86, -40, 16, 120); ctx.fillRect(70, -40, 16, 120);
    ctx.strokeRect(-110, -6, 220, 16);
    // Serrure
    ctx.fillStyle = '#ffe28a'; ctx.beginPath(); ctx.roundRect(-18, -14, 36, 34, 6); ctx.fill(); ctx.stroke();
    // Couvercle qui bascule vers l'arrière
    ctx.save();
    ctx.translate(0, -40);
    ctx.scale(1, 1 - ouverture * 1.6);
    ctx.fillStyle = '#9c6a35';
    ctx.beginPath(); ctx.moveTo(-110, 0); ctx.lineTo(-110, -40); ctx.quadraticCurveTo(0, -95, 110, -40); ctx.lineTo(110, 0); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffc94a'; ctx.fillRect(-86, -62, 16, 62); ctx.fillRect(70, -62, 16, 62);
    ctx.restore();
    // Tas de pièces qui dépasse quand c'est ouvert
    if (ouverture > 0) {
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = i % 2 ? '#ffd34d' : '#f5b400';
        ctx.beginPath(); ctx.ellipse(-80 + i * 20, -44 - Math.sin(i * 1.3) * 10 * ouverture, 16, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = '#a06a00'; ctx.stroke();
      }
    }
    ctx.restore();
  }

  function evenement(type, d) {
    switch (type) {
      case 'cadeau': {
        ajouterAlerte(d);
        const img = d.image || (d.objectifIndex >= 0 ? CFG.objectifs[d.objectifIndex].image : '');
        ajouterCompagnon(d.style, img);
        if (d.style === 'pluie') pluie('🌸', 40, 2.5);
        if (d.style === 'foule') emoji('❤️', CX, ANCRE_Y - 100, 18, { taille: 52 });
        if (d.style === 'charge' || d.style === 'final') { secouer(26); flash = 0.7; }
        if (d.style === 'final') { confettis(160); pluie('🌹', 30, 3); }
        if (d.tier === 3) { confettis(90); secouer(14); }
        if (d.tier === 2) emoji('✨', CX, ANCRE_Y - 60, 14, { taille: 40 });
        const R = reglesSons();
        if (d.valeur >= R.merciVocalDes) {
          // Gros cadeau : Gégé remercie à voix haute (charabia), l'applaudissement suit à la fin de l'alerte
          forcer('joie', 'joie', 4);
          dire(`MERCI MERCI BEAUCOUP @${d.user.pseudo} !!! 😭❤️`, { prio: 5, crie: true, duree: 4.5 });
          setTimeout(applaudir, 4600);
        } else if (d.valeur >= R.applaudirDes) {
          dire(d.replique, { prio: 3, duree: 3.4 });
          setTimeout(applaudir, 3400);
        } else {
          // Petits cadeaux (roses, TikTok…) : aucun son un par un, un seul applaudissement à la fin de la rafale
          dire(d.replique, { prio: 2, duree: 2.6, silence: true });
          rafalePetits(d.repeat);
        }
        if (!$('combo').classList.contains('cache') && comboCle === d.user.id + '|' + d.cadeau) $('combo').classList.add('cache');
        break;
      }
      case 'combo': combo(d); break;
      case 'refuge': {
        ouvertures[d.index + 1] = performance.now();
        const qui = d.user ? 'Merci @' + esc(d.user.pseudo) + ' !' : '';
        if (d.mega && d.rang === 1) {
          banniere(`MÉGA SAUT ×${d.total} !`, `${qui} ${d.total} refuges d'un coup 🚀`, { img: d.objectif.image, duree: 4200 });
        } else if (!d.mega) {
          banniere(d.dernier ? 'DERNIER REFUGE !' : `REFUGE ${d.index + 1} DÉBLOQUÉ !`, d.dernier ? `${qui} Direction le sommet 🏔️` : qui, { img: d.objectif.image });
        }
        if (d.rang === 1) {
          confettis(d.mega ? 120 : 60);
          ouvrirCoffre(d.mega ? 2 : 1);
        }
        if (d.rang === d.total) celebrer(d.texte);
        break;
      }
      case 'scene': sceneRecue(d); break;
      case 'son':
        son(d.son);
        if (d.user) fil(`💬 @${d.user.pseudo} lance ${d.son === 'prout' ? 'un prout 💨' : 'le son « ' + d.son + ' »'}`);
        break;
      case 'arrivee': oiseau(d.user, d.autres); break;
      case 'abonne':
        fil(`⭐ @${d.user.pseudo} s'abonne ! Merci !`);
        sonAuto('ding');
        emoji('⭐', 160, 1300, 8, { taille: 36, vie: 1.6 });
        break;
      case 'partage':
        fil(`🔁 @${d.user.pseudo} partage le live !`);
        sonAuto('pop');
        break;
      case 'palierLikes':
        fil(`🎉 ${nf(d.total)} TAPS ! Merci à tous !`);
        emoji('❤️', CX, ANCRE_Y, 26, { taille: 54, vitesse: 500 });
        sonAuto('coeurs');
        dire(`${nf(d.total)} taps !!! Vous êtes des fous ❤️`, { prio: 2, duree: 3 });
        break;
      case 'nouveauChef':
        banniere(`✂️ @${esc(d.user.pseudo)} COUPE LA CORDE !`, `Nouveau premier de cordée 👑${d.ancien ? ' devant @' + esc(d.ancien.pseudo) : ''}`, { classe: 'rouge', duree: 3600 });
        if (d.user.pieces >= reglesSons().applaudirDes) sonAuto('ciseaux');
        break;
      case 'record':
        banniere('NOUVEAU RECORD !', `${nf(d.altitude)} m — on n'est jamais allés aussi haut !`, { classe: 'vert', duree: 4200 });
        sonAuto('fanfare');
        confettis(120);
        dire(d.texte, { prio: 3 });
        break;
      case 'sommet':
        banniere('🏔️ SOMMET ATTEINT !!!', 'On l\'a fait ensemble ❤️', { duree: 6000 });
        son('fanfare');
        setTimeout(() => son('applaudissements'), 700);
        confettis(260);
        celebrer(d.texte);
        break;
      case 'miniJeu':
        rendreMiniJeu(d);
        sonAuto(d.type === 'tempete' ? 'tonnerre' : 'tambour');
        if (d.type === 'vote') dire('VOTE DU DESTIN ! Vous m\'aidez… ou vous me piégez ?! 😰', { prio: 3 });
        if (d.type === 'course') dire(`Course aux taps ! ${nf(d.cible)} taps en 60 secondes, GO !!`, { prio: 3, crie: true });
        if (d.type === 'mot') dire('Le premier qui écrit le mot gagne !', { prio: 3 });
        if (d.type === 'tempete') { dire('Oh non… UNE TEMPÊTE !! Tapez pour me tenir !', { prio: 3, crie: true }); setTimeout(() => sonAuto('vent'), 1500); }
        break;
      case 'miniJeuMaj': rendreMiniJeu(d); break;
      case 'miniJeuFin': finMiniJeu(d); break;
      case 'reset':
        $('bisous').innerHTML = '';
        fissures.length = 0;
        compagnons.length = 0;
        altAff = camAlt = 0;
        for (const k in ouvertures) delete ouvertures[k];
        $('fin').classList.add('cache');
        break;
      case 'finLive': afficherFin(d); break;
      case 'masquerFin': $('fin').classList.add('cache'); break;
      default: break;
    }
  }

  function finMiniJeu(d) {
    rendreMiniJeu(null);
    if (!d || d.annule) return;
    if (d.type === 'vote') {
      if (d.resultat === 'aide') { banniere('L\'ÉQUIPE AIDE GAGNE !', `${d.votes.aide} contre ${d.votes.piege} — une échelle géante 🪜`, { classe: 'vert' }); sonAuto('victoire'); ajouterCompagnon('saut', ''); dire('MERCI ! Je vous adore !!', { prio: 3 }); }
      else if (d.resultat === 'piege') {
        const p = { banane: ['🍌 PEAU DE BANANE !', 'Il glisse de 25 m…', '🍌'], vent: ['💨 RAFALE DE VENT !', 'Son énergie s\'envole…', '💨'], pigeon: ['🐦 ATTAQUE DE PIGEON !', 'Il recule de 15 m…', '🐦'] }[d.piege];
        banniere(p[0], `${d.votes.piege} contre ${d.votes.aide} — vous êtes cruels 😭`, { classe: 'rouge' });
        emoji(p[2], CX, ANCRE_Y - 80, 10, { taille: 70, vitesse: 400 });
        sonAuto(d.piege === 'vent' ? 'vent' : 'echec');
        secouer(10);
        forcer('accroche', 'peur', 1.6);
        dire('POURQUOIIII ?! 😭', { prio: 4, crie: true });
      } else banniere('PERSONNE N\'A VOTÉ…', 'Le destin hésite 🤷', { duree: 2600 });
    }
    if (d.type === 'course') {
      if (d.resultat === 'gagne') { banniere('COURSE GAGNÉE !', `${nf(d.progres)} taps — boost de 80 m 🚀`, { classe: 'vert' }); sonAuto('fanfare'); confettis(90); }
      else { banniere('RATÉ…', `${nf(d.progres)} / ${nf(d.cible)} taps`, { classe: 'rouge' }); sonAuto('echec'); dire('Oh non… on y était presque !', { prio: 3 }); }
    }
    if (d.type === 'mot') {
      if (d.gagnant) { banniere(`@${esc(d.gagnant.pseudo)} GAGNE !`, `Le mot était « ${esc(d.mot)} » ✨`, { classe: 'vert' }); sonAuto('ding'); dire(`Bravo @${d.gagnant.pseudo} !!`, { prio: 3, user: d.gagnant }); }
      else banniere('PERSONNE…', `Le mot était « ${esc(d.mot)} »`, { duree: 2800 });
    }
    if (d.type === 'tempete') {
      if (d.resultat === 'gagne') { banniere('IL A TENU BON !', 'La tempête est passée 💪', { classe: 'vert' }); sonAuto('victoire'); }
      else { banniere('EMPORTÉ PAR LA TEMPÊTE…', 'On remonte ?', { classe: 'rouge' }); sonAuto('echec'); }
    }
  }

  // ---------- Décor ----------
  const etoiles = Array.from({ length: 170 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 2.2 + 0.4, tw: Math.random() * 6 }));
  const nuages = Array.from({ length: 16 }, (_, i) => ({ alt: 1100 + i * 150 + Math.random() * 100, x: Math.random() * W, w: 160 + Math.random() * 200, v: 8 + Math.random() * 18 }));
  const immeubles = [];
  for (let x = -20; x < W + 40;) { const w = 70 + Math.random() * 110; immeubles.push({ x, w, h: 160 + Math.random() * 420, f: Math.random() }); x += w + 6; }

  const CIEL_STOPS = [
    [0, '#0b1026', '#3a2440'], [700, '#121a3d', '#3b2c5a'], [1500, '#24365f', '#6c7fae'],
    [2600, '#1a1d2b', '#3d4258'], [3500, '#04152a', '#0d3b3f'], [4400, '#020309', '#0b0b22']
  ];
  const MUR_STOPS = [[0, [92, 58, 46]], [900, [78, 72, 84]], [1700, [110, 128, 150]], [2700, [58, 61, 76]], [3600, [40, 62, 78]], [4500, [46, 40, 82]]];
  function hex(c) { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function melange(a, b, k) { return a.map((v, i) => Math.round(lerp(v, b[i], k))); }
  function interStops(stops, alt, idx) {
    let i = 0;
    while (i < stops.length - 1 && alt > stops[i + 1][0]) i++;
    const a = stops[i], b = stops[Math.min(i + 1, stops.length - 1)];
    const k = b[0] === a[0] ? 0 : clamp((alt - a[0]) / (b[0] - a[0]), 0, 1);
    const ca = typeof a[idx] === 'string' ? hex(a[idx]) : a[idx];
    const cb = typeof b[idx] === 'string' ? hex(b[idx]) : b[idx];
    return melange(ca, cb, k);
  }
  const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const fenetre = (v, a, b, c, d) => v <= a || v >= d ? 0 : v < b ? (v - a) / (b - a) : v <= c ? 1 : (d - v) / (d - c);
  const sy = alt => ANCRE_Y + decalageY - (alt - camAlt) * PX_M;

  let eclair = 0, dernierTonnerre = 0;
  function dessinerCiel(t, dt) {
    if (!CIEL) { ctx.clearRect(0, 0, W, H); return; }
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, rgb(interStops(CIEL_STOPS, camAlt, 1)));
    g.addColorStop(1, rgb(interStops(CIEL_STOPS, camAlt, 2)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Étoiles
    const aEt = clamp(0.25 + camAlt / 3000, 0, 1);
    for (const e of etoiles) {
      const y = (e.y + camAlt * PX_M * 0.04) % H;
      ctx.globalAlpha = aEt * (0.5 + 0.5 * Math.sin(t / 600 + e.tw));
      ctx.fillStyle = '#fff';
      ctx.fillRect(e.x, y, e.r, e.r);
    }
    ctx.globalAlpha = 1;

    // Aurores
    const wA = fenetre(camAlt, 3200, 3700, 4400, 4900);
    if (wA > 0) {
      for (let b = 0; b < 3; b++) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 30) {
          const y = 250 + b * 140 + Math.sin(x / 180 + t / 1400 + b) * 60 + Math.sin(x / 70 + t / 900) * 14;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.lineTo(W, 0); ctx.lineTo(0, 0); ctx.closePath();
        const ga = ctx.createLinearGradient(0, 0, 0, 600);
        ga.addColorStop(0, `rgba(80,255,170,0)`);
        ga.addColorStop(0.7, b === 1 ? `rgba(190,90,255,${0.22 * wA})` : `rgba(80,255,170,${0.22 * wA})`);
        ga.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = ga;
        ctx.fill();
      }
    }
    // Espace : planète
    const wE = fenetre(camAlt, 4200, 4800, 1e9, 2e9);
    if (wE > 0) {
      const py = 380 + (camAlt - 4800) * PX_M * 0.05;
      ctx.globalAlpha = wE;
      const gp = ctx.createRadialGradient(830, py - 40, 20, 860, py, 150);
      gp.addColorStop(0, '#ffb47a'); gp.addColorStop(1, '#7a2f6b');
      ctx.fillStyle = gp;
      ctx.beginPath(); ctx.arc(860, py, 130, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,220,170,.6)'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.ellipse(860, py, 230, 46, -0.35, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Ville
    const baseVille = ANCRE_Y + decalageY + 220 + camAlt * PX_M * 0.35;
    if (baseVille - 600 < H) {
      for (const b of immeubles) {
        const top = baseVille - b.h;
        ctx.fillStyle = '#0a0812';
        ctx.fillRect(b.x, top, b.w, b.h + 400);
        for (let wy = top + 18; wy < baseVille - 10; wy += 30) {
          for (let wx = b.x + 10; wx < b.x + b.w - 14; wx += 22) {
            if (hash(wx, wy) < 0.35 + b.f * 0.2) {
              ctx.fillStyle = hash(wy, wx) < 0.8 ? 'rgba(255,214,140,.75)' : 'rgba(140,200,255,.7)';
              ctx.fillRect(wx, wy, 10, 14);
            }
          }
        }
      }
    }
    // Nuages
    const wN = fenetre(camAlt, 900, 1400, 3100, 3600);
    if (wN > 0) {
      for (const n of nuages) {
        const y = ANCRE_Y + decalageY - (n.alt - camAlt) * PX_M * 0.6;
        if (y < -200 || y > H + 200) continue;
        const x = ((n.x + t / 1000 * n.v) % (W + 600)) - 300;
        ctx.globalAlpha = 0.5 * wN;
        ctx.fillStyle = '#e8eefc';
        for (let k = 0; k < 5; k++) {
          ctx.beginPath();
          ctx.ellipse(x + k * n.w / 5, y + Math.sin(k * 1.7) * 18, n.w / 3.2, n.w / 6, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
    // Orage
    const wO = fenetre(camAlt, 2500, 2900, 3400, 3700);
    const tempete = MJ && MJ.type === 'tempete';
    const pluieForce = Math.max(wO, tempete ? 1 : 0);
    if (pluieForce > 0) {
      ctx.strokeStyle = 'rgba(180,200,255,.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 90 * pluieForce; i++) {
        const x = Math.random() * W, y = Math.random() * H;
        ctx.moveTo(x, y); ctx.lineTo(x - (tempete ? 40 : 10), y + 40);
      }
      ctx.stroke();
      if (Math.random() < dt * 0.25 * pluieForce) {
        eclair = 0.8;
        if (t - dernierTonnerre > 25000) { dernierTonnerre = t; sonAuto('tonnerre'); }
      }
    }
  }

  function dessinerMur(t) {
    const c = interStops(MUR_STOPS, camAlt, 1);
    const g = ctx.createLinearGradient(MUR_G, 0, MUR_D, 0);
    g.addColorStop(0, rgb(melange(c, [0, 0, 0], 0.55)));
    g.addColorStop(0.18, rgb(c));
    g.addColorStop(0.82, rgb(c));
    g.addColorStop(1, rgb(melange(c, [0, 0, 0], 0.55)));
    ctx.fillStyle = g;
    ctx.fillRect(MUR_G, 0, MUR_D - MUR_G, H);

    const hb = 80; // hauteur d'une rangée de pierres en pixels
    const camPx = camAlt * PX_M;
    const r0 = Math.floor((camPx - (H - ANCRE_Y - decalageY)) / hb) - 1;
    const r1 = Math.floor((camPx + ANCRE_Y + decalageY) / hb) + 1;
    ctx.lineWidth = 3;
    for (let r = r0; r <= r1; r++) {
      if (r < -3) continue;
      const y = ANCRE_Y + decalageY - (r * hb - camPx);
      const dec = (r & 1) * 70;
      for (let k = -1; k < 5; k++) {
        const x = MUR_G + dec + k * 140;
        const v = hash(r, k);
        ctx.fillStyle = v < 0.5 ? `rgba(0,0,0,${0.12 * v})` : `rgba(255,255,255,${0.06 * (v - 0.5)})`;
        const xa = Math.max(MUR_G, x), xb = Math.min(MUR_D, x + 140);
        if (xb > xa) ctx.fillRect(xa, y - hb, xb - xa, hb);
        ctx.strokeStyle = 'rgba(0,0,0,.28)';
        if (x > MUR_G && x < MUR_D) { ctx.beginPath(); ctx.moveTo(x, y - hb); ctx.lineTo(x, y); ctx.stroke(); }
      }
      ctx.beginPath(); ctx.moveTo(MUR_G, y); ctx.lineTo(MUR_D, y); ctx.stroke();
      // Prises d'escalade
      const PAL = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c77dff', '#ff9f43'];
      for (let p = 0; p < 2; p++) {
        const hx = MUR_G + 40 + hash(r, p + 7) * (MUR_D - MUR_G - 80);
        const hy = y - hb * hash(p + 3, r);
        const s = 11 + hash(r + 5, p) * 9;
        ctx.fillStyle = PAL[Math.floor(hash(r, p + 11) * PAL.length)];
        ctx.beginPath(); ctx.ellipse(hx, hy, s * 1.3, s, hash(p, r) * 3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        ctx.beginPath(); ctx.arc(hx - s * 0.4, hy - s * 0.35, s * 0.3, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Bandes LED le long du mur : leur éclat suit l'énergie (les taps).
    const e = TICK.energie / 100;
    let led = '255,233,196';
    if (TICK.protection > 0) led = '255,201,74';
    else if (TICK.statut === 'accroche') led = Math.sin(t / 90) > 0 ? '255,60,80' : '255,233,196';
    ctx.save();
    ctx.shadowColor = `rgba(${led},1)`;
    ctx.shadowBlur = 20 + e * 30;
    ctx.strokeStyle = `rgba(${led},${0.25 + e * 0.75})`;
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(MUR_G + 3, 0); ctx.lineTo(MUR_G + 3, H); ctx.moveTo(MUR_D - 3, 0); ctx.lineTo(MUR_D - 3, H); ctx.stroke();
    ctx.restore();

    // Sol de départ
    const ys = sy(0) + 125;
    if (ys < H + 50) {
      ctx.fillStyle = '#2b2530';
      ctx.fillRect(0, ys, W, H - ys + 600);
      ctx.fillStyle = '#ffc94a';
      for (let x = 20; x < W; x += 120) ctx.fillRect(x, ys + 60, 60, 10);
      ctx.font = '800 40px "Baloo 2", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText('DÉPART 🏁', 170, ys - 20);
    }
  }

  function dessinerRefuges(t) {
    const idx = ETAT ? ETAT.objIndex : 0;
    for (let k = 1; k <= N; k++) {
      const y = sy(k * ESP);
      if (y < -500 || y > H + 400) continue;
      const o = CFG.objectifs[k - 1];
      const im = image(o.image);
      const ok = k <= idx;
      // Plateforme (sous les pieds quand il est arrivé à ce refuge)
      const yp = y + 125;
      ctx.fillStyle = '#7a4a24';
      ctx.fillRect(MUR_G - 70, yp, MUR_D - MUR_G + 140, 26);
      ctx.fillStyle = '#a8693a';
      ctx.fillRect(MUR_G - 70, yp, MUR_D - MUR_G + 140, 8);
      ctx.strokeStyle = '#3d2410'; ctx.lineWidth = 4;
      ctx.strokeRect(MUR_G - 70, yp, MUR_D - MUR_G + 140, 26);
      // Drapeau
      const fx = MUR_D + 50;
      ctx.fillStyle = '#ddd'; ctx.fillRect(fx, yp - 150, 6, 150);
      ctx.fillStyle = ok ? '#ffc94a' : '#777';
      ctx.beginPath(); ctx.moveTo(fx + 6, yp - 150); ctx.lineTo(fx + 86 + Math.sin(t / 200) * 6, yp - 128); ctx.lineTo(fx + 6, yp - 104); ctx.fill();
      ctx.font = '800 28px "Baloo 2", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = ok ? '#3b2500' : '#fff';
      ctx.fillText(k === N ? '🏔️' : String(k), fx + 34, yp - 118);
      // Déco : le cadeau validé reste posé sur son refuge
      if (ok && prete(im)) ctx.drawImage(im, MUR_G - 60, yp - 118, 120, 120);
      if (k === N) {
        ctx.font = '800 70px "Baloo 2", sans-serif';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#ffc94a'; ctx.shadowBlur = 30;
        ctx.fillText('SOMMET', CX, yp - 330);
        ctx.shadowBlur = 0;
      }
      // Grille fermée au-dessus du refuge suivant
      const ouv = ouvertures[k];
      const yg = y - 175;
      if (!ok || (ouv && t - ouv < 1500)) {
        const p = ok ? clamp((t - ouv) / 1300, 0, 1) : 0;
        const ecart = p * 320;
        ctx.globalAlpha = 1 - p * 0.8;
        ctx.fillStyle = '#555c6b';
        ctx.fillRect(MUR_G - 20 - ecart, yg - 14, (MUR_D - MUR_G) / 2 + 20, 28);
        ctx.fillRect(CX + ecart, yg - 14, (MUR_D - MUR_G) / 2 + 20, 28);
        ctx.strokeStyle = '#2b2f38'; ctx.lineWidth = 9;
        ctx.beginPath();
        for (let x = MUR_G + 10; x < MUR_D; x += 44) {
          const xx = x < CX ? x - ecart : x + ecart;
          ctx.moveTo(xx, yg - 70); ctx.lineTo(xx, yg + 40);
        }
        ctx.stroke();
        // Médaillon du cadeau attendu + cadenas
        if (!ok) {
          const cible = k === idx + 1;
          const r = cible ? 74 + Math.sin(t / 250) * 4 : 60;
          ctx.save();
          if (cible) { ctx.shadowColor = '#ffc94a'; ctx.shadowBlur = 40; }
          ctx.fillStyle = '#1e1820';
          ctx.beginPath(); ctx.arc(CX, yg - 20, r, 0, Math.PI * 2); ctx.fill();
          ctx.lineWidth = 6; ctx.strokeStyle = cible ? '#ffc94a' : '#999'; ctx.stroke();
          ctx.restore();
          if (prete(im)) ctx.drawImage(im, CX - r * 0.78, yg - 20 - r * 0.78, r * 1.56, r * 1.56);
          ctx.font = '44px serif';
          ctx.fillText('🔒', CX + r * 0.8, yg + r * 0.55);
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  // Corde + cordée (les 3 premiers donateurs accrochés au-dessus de la mascotte)
  function dessinerCorde(mx, my, s) {
    ctx.strokeStyle = '#ff9f1c';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(mx, my + 40 * s);
    ctx.bezierCurveTo(mx + 60, my - 200, mx + 40, my - 500, mx + 30, -40);
    ctx.stroke();
    const liste = (ETAT && ETAT.classement) || [];
    const ecarts = [300, 470, 630];
    liste.slice(0, 3).forEach((u, i) => {
      const y = my - ecarts[i] * Math.min(1.2, s);
      if (y < 60) return;
      const x = mx + 52 - i * 4;
      const r = i === 0 ? 46 : 36;
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.closePath();
      ctx.fillStyle = couleurDe(u.pseudo); ctx.fill();
      ctx.clip();
      const im = image(u.avatar);
      if (prete(im)) ctx.drawImage(im, x - r, y - r, r * 2, r * 2);
      else { ctx.fillStyle = '#fff'; ctx.font = `800 ${r}px "Baloo 2", sans-serif`; ctx.textAlign = 'center'; ctx.fillText(lettreDe(u), x, y + r * 0.35); }
      ctx.restore();
      ctx.lineWidth = 5; ctx.strokeStyle = i === 0 ? '#ffc94a' : '#fff';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      // Casque
      ctx.fillStyle = i === 0 ? '#ffc94a' : '#e63946';
      ctx.beginPath(); ctx.arc(x, y - r * 0.55, r * 0.75, Math.PI, 0); ctx.fill();
      if (i === 0) { ctx.font = '40px serif'; ctx.textAlign = 'center'; ctx.fillText('👑', x, y - r - 20); }
      ctx.font = '800 22px "Baloo 2", sans-serif'; ctx.textAlign = 'left';
      ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 5;
      ctx.strokeText('@' + u.pseudo, x + r + 8, y + 8); ctx.fillText('@' + u.pseudo, x + r + 8, y + 8);
    });
  }

  function dessinerCompagnons(t, mx, my, s, devant) {
    for (let i = compagnons.length - 1; i >= 0; i--) {
      const c = compagnons[i];
      if (t > c.fin) { compagnons.splice(i, 1); continue; }
      const k = (t - c.debut) / (c.fin - c.debut);
      const im = c.img;
      const ok = prete(im);
      const dessinImg = (x, y, taille, rot = 0, alpha = 1) => {
        if (!ok) return;
        ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(rot);
        ctx.drawImage(im, -taille / 2, -taille / 2, taille, taille);
        ctx.restore();
      };
      const entree = clamp(k * 6, 0, 1);
      const sortie = clamp((1 - k) * 6, 0, 1);
      switch (c.style) {
        case 'tete': if (devant) dessinImg(mx + Math.sin(t / 300) * 6, my - 165 * s, 96 * s, Math.sin(t / 400) * 0.15); break;
        case 'porte': case 'girafe': if (!devant) dessinImg(mx, my + 120 * s, 260 * s * entree, Math.sin(t / 150) * 0.08, sortie); break;
        case 'corde':
          if (!devant) {
            const y = my - 360 * s;
            ctx.strokeStyle = '#c98a3a'; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.moveTo(mx, my - 130 * s); ctx.lineTo(mx + 10, y); ctx.stroke();
            dessinImg(mx + 10, y - 40, 170 * s * entree, Math.sin(t / 120) * 0.1, sortie);
          }
          break;
        case 'vol': if (devant) dessinImg(mx, my - 230 * s, 280 * s * entree * (1 + Math.sin(t / 90) * 0.05), 0, sortie); break;
        case 'bulle':
          if (devant) {
            ctx.save(); ctx.globalAlpha = 0.85 * sortie;
            ctx.strokeStyle = '#9ef0ff'; ctx.lineWidth = 6; ctx.fillStyle = 'rgba(158,240,255,.18)';
            ctx.beginPath(); ctx.arc(mx, my - 20 * s, 190 * s * entree, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.restore();
            dessinImg(mx + 120 * s, my + 120 * s, 120 * s, 0, sortie);
          }
          break;
        case 'arbre': if (!devant) dessinImg(mx, my + 160 * s - 120 * entree, 360 * s * entree, 0, sortie); break;
        case 'charge': case 'final': {
          if (devant) {
            const x = k < 0.25 ? lerp(-300, mx - 40, k / 0.25) : mx - 40;
            dessinImg(x, my + 100 * s, (c.style === 'final' ? 380 : 320) * s, k < 0.25 ? -0.2 : Math.sin(t / 120) * 0.05, sortie);
          }
          break;
        }
        case 'calin': if (devant) dessinImg(mx - 120 * s, my + 10 * s, 170 * s * entree, Math.sin(t / 200) * 0.1, sortie); break;
        case 'mange': if (devant) dessinImg(lerp(mx + 260, mx, k), lerp(my - 260, my - 60 * s, k), lerp(150, 30, k) * s, k * 6, 1 - k * 0.6); break;
        default: if (devant) dessinImg(mx + 140 * s, my - 200 * s - k * 140, 120 * s * entree, 0, sortie);
      }
    }
  }

  function dessinerParticules(dt) {
    for (let i = particules.length - 1; i >= 0; i--) {
      const p = particules[i];
      p.vie -= dt;
      if (p.vie <= 0 || p.y > H + 120) { particules.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.type === 'confetti') {
        p.rot += p.vr * dt; p.vx += Math.sin(p.y / 60) * 6;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
        ctx.restore();
      } else {
        p.vy += (p.g || 0) * dt;
        ctx.save();
        ctx.globalAlpha = clamp(p.vie / Math.min(1, p.vie0), 0, 1);
        ctx.font = `${p.taille}px serif`;
        ctx.textAlign = 'center';
        if (p.tourne) { ctx.translate(p.x, p.y); ctx.rotate(p.y / 120); ctx.fillText(p.e, 0, 0); }
        else ctx.fillText(p.e, p.x, p.y);
        ctx.restore();
      }
    }
    if (particules.length > 700) particules.splice(0, particules.length - 700);
  }

  function dessinerVitre(t) {
    for (let i = fissures.length - 1; i >= 0; i--) {
      const f = fissures[i];
      const age = (t - f.t) / 1000;
      if (age > 14) { fissures.splice(i, 1); continue; }
      const a = clamp(1 - (age - 10) / 4, 0, 1);
      const buee = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 150);
      buee.addColorStop(0, `rgba(255,255,255,${0.22 * a})`);
      buee.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = buee;
      ctx.beginPath(); ctx.arc(f.x, f.y, 150, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${0.85 * a})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (const l of f.lignes) { ctx.moveTo(l[0][0], l[0][1]); for (const [x, y] of l) ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }

  // ---------- Boucle principale ----------
  let tPrec = performance.now();
  let altPrec = 0;
  function frame(t) {
    const dt = Math.min(0.1, (t - tPrec) / 1000);
    tPrec = t;
    if (CFG) dessiner(t, dt);
    requestAnimationFrame(frame);
  }

  function dessiner(t, dt) {
    // Lissage entre deux ticks serveur (10 par seconde)
    altAff = Math.abs(TICK.alt - altAff) > 200 ? TICK.alt : lerp(altAff, TICK.alt, clamp(dt * 9, 0, 1));
    const monte = altAff - altPrec;
    altPrec = altAff;
    if (monte > 0) phase += monte * 1.1;
    const chute = TICK.statut === 'chute';
    camAlt = lerp(camAlt, altAff, clamp(dt * (chute ? 1.6 : 5), 0, 1));
    const cibleDec = TICK.statut === 'accroche' ? 240 : 0;
    decalageY = lerp(decalageY, cibleDec, clamp(dt * 3, 0, 1));

    const zoom = valeurZoom(t);
    secousse = Math.max(0, secousse - dt * 40);
    toc = Math.max(0, toc - dt * 5);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    dessinerCiel(t, dt);

    const sx = (Math.random() - 0.5) * secousse, syy = (Math.random() - 0.5) * secousse;
    const mx = CX + (TICK.statut === 'grimpe' ? Math.sin(phase * 0.5) * 8 : 0);
    const my = ANCRE_Y + decalageY + (camAlt - altAff) * PX_M;
    ctx.setTransform(zoom, 0, 0, zoom, mx - mx * zoom + sx, my - my * zoom + syy);

    dessinerMur(t);
    dessinerRefuges(t);
    dessinerCorde(mx, my, 1);

    // Pose de la mascotte
    let mode, expression = 'normal';
    const st = TICK.statut;
    if (forcage && t > forcage.fin) forcage = null;
    if (forcage && forcage.mode === 'boude' && (st === 'grimpe' || st === 'chute' || st === 'accroche')) forcage = null;
    mode = st === 'grimpe' ? 'grimpe' : st === 'accroche' ? 'accroche' : st === 'chute' ? 'chute' : st === 'bloque' ? 'bloque' : 'repos';
    if (st === 'accroche' || st === 'chute') expression = 'peur';
    else if (TICK.energie < 25) expression = 'fatigue';
    else if (TICK.protection > 0 || TICK.boost) expression = 'joie';
    if (forcage && st !== 'chute') {
      if (forcage.mode) mode = forcage.mode;
      if (forcage.expression) expression = forcage.expression;
    }
    const tempete = MJ && MJ.type === 'tempete';
    const parle = bulle && t < bulle.fin && (t - bulle.debut) / bulle.vitesse < bulle.texte.length;
    const echelle = 1.15;

    dessinerCompagnons(t, mx, my, echelle, false);
    // Bouclier doré
    if (TICK.protection > 0) {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(t / 200) * 0.1;
      const gb = ctx.createRadialGradient(mx, my - 20, 60, mx, my - 20, 230);
      gb.addColorStop(0, 'rgba(255,201,74,0)'); gb.addColorStop(0.8, 'rgba(255,201,74,.5)'); gb.addColorStop(1, 'rgba(255,201,74,0)');
      ctx.fillStyle = gb;
      ctx.beginPath(); ctx.arc(mx, my - 20, 230, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // Traînées de vitesse pendant un boost
    if (TICK.boost) {
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 4;
      ctx.beginPath();
      for (let i = 0; i < 14; i++) {
        const x = mx + (Math.random() - 0.5) * 420, y = my + Math.random() * 500 - 100;
        ctx.moveTo(x, y); ctx.lineTo(x, y + 80 + Math.random() * 120);
      }
      ctx.stroke();
    }
    window.dessinerMascotte(ctx, mx, my, echelle, {
      mode, expression, phase, temps: t / 1000, toc,
      parle, crie: bulle && bulle.crie && parle,
      tremble: st === 'accroche' ? 5 : TICK.energie < 15 ? 3 : tempete ? 4 : 0,
      rotation: chute ? Math.sin(t / 120) * 0.35 : tempete ? Math.sin(t / 300) * 0.12 : 0,
      regard: mode === 'bloque' ? { x: 0, y: -1 } : st === 'accroche' ? { x: 0, y: 1 } : { x: Math.sin(t / 2000) * 0.5, y: 0 }
    });
    dessinerCompagnons(t, mx, my, echelle, true);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    dessinerParticules(dt);
    dessinerVitre(t);
    if (eclair > 0 || flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.max(eclair, flash)})`;
      ctx.fillRect(0, 0, W, H);
      eclair = Math.max(0, eclair - dt * 3);
      flash = Math.max(0, flash - dt * 2);
    }

    dessinerCoffre(t, dt);
    majInterface(t, mx, my, zoom);
  }

  function majInterface(t, mx, my, zoom) {
    // Énergie
    const e = TICK.energie;
    const r = $('energie-rempli');
    r.style.width = e + '%';
    r.style.background = e > 60 ? 'linear-gradient(90deg,#16a34a,#4ade80)' : e > 30 ? 'linear-gradient(90deg,#ca8a04,#facc15)' : 'linear-gradient(90deg,#b91c1c,#ff4d5e)';
    const st = TICK.statut;
    const txt = st === 'accroche' ? '🆘 IL LÂCHE ! TAPEZ !!' : st === 'chute' ? '😱 AAAAAH !' : TICK.protection > 0 ? '🛡️ PROTÉGÉ !' : e < 30 ? '⚡ TAPEZ VITE !! ⚡' : st === 'bloque' ? '🔒 BLOQUÉ : IL FAUT LE CADEAU !' : '⚡ TAPEZ L\'ÉCRAN POUR GRIMPER';
    if ($('energie-texte').textContent !== txt) $('energie-texte').textContent = txt;
    $('energie').classList.toggle('faible', (e < 30 && TICK.protection <= 0) || st === 'accroche');
    const pr = $('protection');
    pr.classList.toggle('cache', !(TICK.protection > 0));
    if (TICK.protection > 0) pr.textContent = `🛡️ ${TICK.protection} s`;
    $('voile-alerte').classList.toggle('danger', st === 'accroche');
    $('refuge').classList.toggle('pulse', st === 'bloque');

    // Altimètre
    $('alt-valeur').textContent = nf(altAff) + ' m';
    const max = altMax();
    $('alt-rempli').style.height = `calc(${clamp(altAff / max * 100, 0, 100)}% - 6px)`;
    $('alt-moi').style.bottom = clamp(altAff / max * 100, 0, 100) + '%';

    // Bulle au-dessus de la tête
    const be = $('bulle');
    if (bulle && t < bulle.fin) {
      const n = Math.min(bulle.texte.length, Math.floor((t - bulle.debut) / bulle.vitesse));
      const vis = bulle.texte.slice(0, n);
      const span = $('bulle-texte');
      if (span.textContent !== vis) span.textContent = vis;
      const hx = mx, hy = my - 190 * zoom * 1.15 - 30;
      const x = clamp(hx, 320, W - 320);
      const y = clamp(hy, 330, H - 400);
      be.style.left = x + 'px';
      be.style.top = y + 'px';
      be.style.setProperty('--queue', clamp(50 + (hx - x) / 5, 15, 85) + '%');
    } else if (!be.classList.contains('cache')) {
      be.classList.add('cache');
    }
    // Pancarte à côté de la mascotte
    const pa = $('pancarte');
    if (t < pancarteFin) {
      pa.style.left = clamp(mx + 250, 220, W - 200) + 'px';
      pa.style.top = clamp(my - 40, 450, H - 500) + 'px';
    } else if (!pa.classList.contains('cache')) pa.classList.add('cache');

    // Minuteur du mini-jeu
    if (MJ) {
      const reste = clamp((MJ.finLocale - Date.now()) / MJ.dureeTotale, 0, 1);
      const el = $('mj-timer');
      if (el) el.style.width = reste * 100 + '%';
    }
  }

  connecter();
  requestAnimationFrame(frame);
})();
