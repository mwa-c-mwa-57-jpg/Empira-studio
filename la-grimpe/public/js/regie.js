// Régie de La Grimpe (à ouvrir sur la tablette ou le téléphone).
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = n => Math.round(n).toLocaleString('fr-FR');

  const SONS = [
    ['prout', '💨', 'Prout'], ['klaxon', '📯', 'Klaxon'], ['applaudissements', '👏', 'Applaudir'], ['tambour', '🥁', 'Roulement'],
    ['badumtss', '🎭', 'Ba-dum-tss'], ['echec', '😢', 'Wah wah'], ['caisse', '💰', 'Ka-ching'], ['ding', '🔔', 'Ding'],
    ['fanfare', '🎺', 'Fanfare'], ['laser', '⚡', 'Laser'], ['toctoc', '🚪', 'Toc toc'], ['chute', '😱', 'Chute'],
    ['boing', '🦘', 'Boing'], ['bisou', '💋', 'Bisou'], ['tonnerre', '⛈️', 'Tonnerre'], ['vent', '🌬️', 'Vent'],
    ['alarme', '🚨', 'Alarme'], ['coeurs', '💕', 'Cœurs'], ['ciseaux', '✂️', 'Ciseaux'], ['whoosh', '🌀', 'Whoosh'], ['coffre', '🪙', 'Coffre'], ['boss', '👾', 'Boss'], ['ko', '💥', 'K.O.']
  ];
  const PHRASES = [
    'Merci à tous !! ❤️', 'Bienvenue aux nouveaux ! 👋', 'On lâche rien !!', 'Tapez tapez tapez !!!',
    'Qui veut m\'aider ? 🥺', 'Abonnez-vous pour me porter chance !', 'On bat le record ce soir ?!', 'J\'ai le vertige… 😵'
  ];

  let ws = null, CFG = null, ETAT = null, TICK = null;
  let derniereAlertePresence = 0;

  function envoyer(cmd, donnees = {}) {
    if (!ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify(Object.assign({ t: 'cmd', cmd }, donnees)));
  }

  function connecter() {
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
    ws.onopen = () => { ws.send(JSON.stringify({ t: 'hello', role: 'regie' })); $('deconnecte').classList.add('cache'); };
    ws.onclose = () => { $('deconnecte').classList.remove('cache'); setTimeout(connecter, 2000); };
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.t === 'init') { CFG = m.config; TICK = m.tick; construire(); appliquer(m.etat); }
      if (m.t === 'etat') appliquer(m.d);
      if (m.t === 'tick') { TICK = m.d; majTick(); }
      if (m.t === 'evt') evenement(m.type, m.d);
    };
  }

  // ---------- Construction ----------
  let construit = false;
  function construire() {
    document.querySelectorAll('#nom-mascotte, .nom-m').forEach(el => { el.textContent = CFG.mascotte; });
    document.title = 'Régie — ' + CFG.mascotte;
    $('sim-cadeau').innerHTML = CFG.objectifs.map((o, i) => `<option value="${i}">${i + 1}. ${esc(o.nom)} — ${nf(o.pieces)} 🪙</option>`).join('');
    $('sim-saboteur').innerHTML = (CFG.saboteurs || []).map((s, i) => `<option value="${i}">${s.emoji} ${esc(s.nom)} — ${nf(s.pieces)} 🪙 → ${esc(s.nomBoss)}</option>`).join('');
    $('carte-simulation').classList.toggle('cache', false);
    $('sim-bloquee').classList.toggle('cache', CFG.mode === 'demo');
    $('sim-zone').classList.toggle('cache', CFG.mode !== 'demo');
    if (construit) return;
    construit = true;
    $('sons').innerHTML = SONS.map(([id, emo, nom], i) => `<button class="btn-son" data-son="${id}">${i < 10 ? `<span class="touche">${(i + 1) % 10}</span>` : ''}<span class="emo">${emo}</span>${nom}</button>`).join('');
    $('phrases').innerHTML = PHRASES.map(p => `<button type="button">${esc(p)}</button>`).join('');
  }

  // ---------- Affichage de l'état ----------
  function appliquer(e) {
    ETAT = e;
    const c = e.connexion || {};
    const pc = $('connexion');
    const libelles = { demo: '🧪 Mode démo', connecte: '🟢 Live connecté', connexion: '⏳ Connexion…', 'hors-ligne': '⏳ En attente du live', deconnecte: '🟠 Reconnexion…', termine: '⏹️ Live terminé', erreur: '🔴 Erreur', arret: '…' };
    pc.textContent = libelles[c.statut] || c.statut;
    pc.title = c.detail || '';
    pc.className = 'pastille-etat ' + (c.statut === 'connecte' ? 'ok' : c.statut === 'demo' ? 'demo' : c.statut === 'erreur' ? 'erreur' : 'attente');
    $('i-spect').textContent = e.spectateurs != null ? '👀 ' + nf(e.spectateurs) : '';

    $('r-auto').checked = e.autopilote;
    $('r-sons').checked = e.reglages.sonsAutomatiques;
    $('r-regie').checked = e.reglages.aussiSurLaRegie;
    if (document.activeElement !== $('r-contre-boss')) $('r-contre-boss').value = e.reglages.cadeauxContreBoss || 'double';
    if (document.activeElement !== $('r-volume')) $('r-volume').value = e.reglages.volume;
    Sons.setVolume(e.reglages.volume);
    $('sim-bots').checked = e.bots;

    const N = CFG.objectifs.length;
    if (e.objIndex < N) {
      const o = CFG.objectifs[e.objIndex];
      $('i-refuge').textContent = `🏔️ Refuge ${e.objIndex + 1}/${N}`;
      $('obj-courant').innerHTML = `<img src="${esc(o.image)}" alt=""><div style="flex:1"><b>${e.objIndex + 1}. ${esc(o.nom)}</b><div>Cagnotte : ${nf(e.cagnotte)} / ${nf(o.pieces)} 🪙${e.cagnotte < 0 ? ' 😈 pillée' : ''}</div><div class="barre"><div style="width:${Math.min(100, e.cagnotte / o.pieces * 100)}%"></div></div></div>`;
    } else {
      $('i-refuge').textContent = '🏔️ Tous les refuges';
      $('obj-courant').innerHTML = '<b>🎉 Tous les refuges sont débloqués !</b>';
    }
    $('btn-obj-plus').disabled = e.objIndex >= N;
    $('btn-obj-moins').disabled = e.objIndex <= 0;
    $('stats').innerHTML = `<div>❤️ Taps : <b>${nf(e.likesTotal)}</b></div><div>🪙 Pièces : <b>${nf(e.piecesTotal)}</b></div><div>😅 Chutes : <b>${e.chutes}</b></div><div>🚩 Record : <b>${nf(e.record)} m</b></div>`;
    $('classement').innerHTML = e.classement.length ? e.classement.map(u => `<li>@${esc(u.pseudo)} <span>🪙 ${nf(u.pieces)}</span></li>`).join('') : '<li style="list-style:none;margin-left:-26px;color:var(--doux)">Aucun cadeau pour l\'instant</li>';
    const MJN = { vote: '🎲 Vote du destin', course: '⚡ Course aux taps', mot: '🔤 Mot magique', tempete: '🌪️ Tempête' };
    $('mj-etat').textContent = e.boss ? `combat : ${e.boss.emoji} ${e.boss.nom} (${nf(e.boss.pv)} PV)` : e.miniJeu ? 'en cours : ' + MJN[e.miniJeu.type] : 'aucun en cours';
    presence(e.presence);
  }

  function majTick() {
    $('i-alt').textContent = '📏 ' + nf(TICK.alt) + ' m';
    const st = { grimpe: 'grimpe', repos: 'au repos', bloque: '🔒 bloqué', accroche: '🆘 accroché', chute: '😱 tombe' }[TICK.statut] || TICK.statut;
    $('i-energie').textContent = `⚡ ${TICK.energie} · ${st} · ${TICK.tapRate} taps/s`;
  }

  function presence(p) {
    const el = $('alerte-presence');
    if (p === 'ok') { el.classList.add('cache'); return; }
    el.classList.remove('cache');
    $('ap-texte').textContent = p === 'pause'
      ? "L'autopilote est en pause (mini-jeux et appels arrêtés) car personne n'a touché la régie depuis longtemps. Appuie pour reprendre."
      : "Ça fait un moment que tu n'as rien touché. Appuie pour confirmer que tu animes toujours le live.";
    const t = Date.now();
    if (t - derniereAlertePresence > 30000) {
      derniereAlertePresence = t;
      Sons.jouer('alarme');
      if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
    }
  }

  function evenement(type, d) {
    if (type === 'son' && ETAT && ETAT.reglages.aussiSurLaRegie) Sons.jouer(d.son);
    if (type === 'presence') presence(d.presence);
  }

  // ---------- Actions ----------
  document.addEventListener('pointerdown', () => Sons.debloquer(), { once: true });

  function jouerSon(id) {
    envoyer('son', { son: id });
    const b = document.querySelector(`.btn-son[data-son="${id}"]`);
    if (b) { b.classList.add('joue'); setTimeout(() => b.classList.remove('joue'), 300); }
  }
  $('sons').addEventListener('click', e => { const b = e.target.closest('[data-son]'); if (b) jouerSon(b.dataset.son); });
  document.addEventListener('keydown', e => {
    if (e.target.matches('input, select, textarea')) return;
    const k = '1234567890'.indexOf(e.key);
    if (k >= 0 && SONS[k]) jouerSon(SONS[k][0]);
  });

  $('form-parler').addEventListener('submit', e => {
    e.preventDefault();
    const t = $('texte-parler').value.trim();
    if (!t) return;
    envoyer('parler', { texte: t });
    $('texte-parler').value = '';
  });
  $('phrases').addEventListener('click', e => { const b = e.target.closest('button'); if (b) envoyer('parler', { texte: b.textContent }); });

  document.querySelectorAll('[data-scene]').forEach(b => b.addEventListener('click', () => envoyer('scene', { type: b.dataset.scene })));
  document.querySelectorAll('[data-mj]').forEach(b => b.addEventListener('click', () => envoyer('miniJeu', { type: b.dataset.mj })));
  $('btn-stop-mj').addEventListener('click', () => envoyer('stopMiniJeu'));
  $('btn-boss').addEventListener('click', () => envoyer('boss'));

  $('r-auto').addEventListener('change', e => envoyer('autopilote', { valeur: e.target.checked }));
  $('r-sons').addEventListener('change', e => envoyer('reglage', { cle: 'sonsAutomatiques', valeur: e.target.checked }));
  $('r-regie').addEventListener('change', e => envoyer('reglage', { cle: 'aussiSurLaRegie', valeur: e.target.checked }));
  $('r-contre-boss').addEventListener('change', e => envoyer('reglage', { cle: 'cadeauxContreBoss', valeur: e.target.value }));
  $('r-volume').addEventListener('change', e => envoyer('reglage', { cle: 'volume', valeur: Number(e.target.value) }));

  $('btn-obj-plus').addEventListener('click', () => { if (confirm('Valider le refuge en cours sans cadeau ?')) envoyer('objectif', { delta: 1 }); });
  $('btn-obj-moins').addEventListener('click', () => { if (confirm('Revenir au refuge précédent ?')) envoyer('objectif', { delta: -1 }); });
  $('btn-fin').addEventListener('click', () => envoyer('finLive'));
  $('btn-masquer-fin').addEventListener('click', () => envoyer('masquerFin'));
  $('btn-reset').addEventListener('click', () => { if (confirm('Démarrer un nouveau live ? Refuges, classement et taps repartent à zéro (le record est gardé).')) envoyer('nouveauLive'); });
  $('btn-present').addEventListener('click', () => envoyer('present'));
  $('btn-present-2').addEventListener('click', () => { envoyer('present'); $('alerte-presence').classList.add('cache'); });

  // Simulation (le serveur l'ignore en mode live)
  const pseudoSim = () => $('sim-pseudo').value.trim();
  $('sim-bots').addEventListener('change', e => envoyer('bots', { valeur: e.target.checked }));
  $('sim-saboter').addEventListener('click', () => envoyer('simuler', { type: 'sabotage', index: Number($('sim-saboteur').value), pseudo: pseudoSim() }));
  $('sim-envoyer').addEventListener('click', () => envoyer('simuler', { type: 'cadeau', index: Number($('sim-cadeau').value), repeat: Number($('sim-repeat').value), pseudo: pseudoSim() }));
  document.querySelectorAll('[data-taps]').forEach(b => b.addEventListener('click', () => envoyer('simuler', { type: 'taps', nombre: Number(b.dataset.taps), pseudo: pseudoSim() })));
  document.querySelectorAll('[data-sim]').forEach(b => b.addEventListener('click', () => envoyer('simuler', { type: b.dataset.sim, pseudo: pseudoSim() })));
  $('sim-chat').addEventListener('submit', e => {
    e.preventDefault();
    const t = $('sim-texte').value.trim();
    if (t) envoyer('simuler', { type: 'chat', texte: t, pseudo: pseudoSim() });
    $('sim-texte').value = '';
  });
  let pluieTimer = null;
  const pluieStop = () => { clearInterval(pluieTimer); pluieTimer = null; };
  $('sim-pluie').addEventListener('pointerdown', () => {
    pluieStop();
    pluieTimer = setInterval(() => envoyer('simuler', { type: 'taps', nombre: 8, pseudo: pseudoSim() }), 150);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => $('sim-pluie').addEventListener(ev, pluieStop));

  connecter();
})();
