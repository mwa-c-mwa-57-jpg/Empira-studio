// Test / control panel for the "Conquête de France" mode (game page and control.html).

import { FranceSimulator } from './simulator.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function createFrancePanel(container, { sink, admin, getStats, gifts, voice }) {
  container.innerHTML = `
  <h2>Panneau de test <small>(touche D pour masquer)</small></h2>
  <section>
    <div class="row">
      <label>Spectateur <input data-id="name" maxlength="24"></label>
      <label>Département <input data-id="dep" maxlength="3" size="4" value="17"></label>
    </div>
    <div class="row">
      <button data-act="join" class="a">Écrit son département</button>
      <button data-act="chat">Commente</button>
    </div>
    <div class="row">
      <input data-id="comment" placeholder="Commentaire libre (ex. : allez le 63 !)" maxlength="200">
      <button data-act="comment">Envoyer</button>
    </div>
    <div class="row">
      <button data-act="like20">♥ +20</button>
      <button data-act="like200">♥ +200</button>
      <button data-act="share">Partage</button>
      <button data-act="follow">Abonnement</button>
    </div>
    <h3>Cadeaux</h3>
    <div class="row gifts">${gifts.map((g, i) => `<button data-gift="${i}" title="${esc(g.label)}">${esc(g.icon)} ${esc(g.names[0])} <small>${g.diamonds}🪙</small></button>`).join('')}</div>
    <div class="row">
      <button data-act="combo">Combo ×10 Rose</button>
      <button data-act="dup">Doublon (test)</button>
    </div>
  </section>
  <section>
    <h3>Foule simulée</h3>
    <label><input type="checkbox" data-id="crowd"> Activer</label>
    <label>Événements / s <input type="range" data-id="rate" min="1" max="80" value="8"> <span data-id="rateV">8</span></label>
    <label>Taux de cadeaux <input type="range" data-id="giftRate" min="0" max="15" value="2"> <span data-id="giftV">2%</span></label>
    <button data-act="storm">Tempête : 1000 événements</button>
  </section>
  <section>
    <h3>Voix du Général</h3>
    <div class="row"><button data-act="voice">🔊 Activer la voix</button><small data-id="voiceInfo"></small></div>
  </section>
  <section>
    <h3>Partie</h3>
    <div class="row">
      <button data-act="restart">Nouvelle partie</button>
      <button data-act="event">Événement maintenant</button>
      <button data-act="end">Terminer la partie</button>
    </div>
    <div class="row">
      <button data-act="pause">Pause</button>
      <button data-act="speed">Vitesse ×1</button>
    </div>
  </section>
  <section><h3>Diagnostic</h3><pre data-id="stats"></pre></section>`;

  const $ = (id) => container.querySelector(`[data-id="${id}"]`);
  const sim = new FranceSimulator(sink, gifts);
  $('name').value = 'Testeur';
  const me = () => {
    const name = $('name').value.trim() || 'Testeur';
    return { id: `manual-${name.toLowerCase()}`, name };
  };
  let speed = 1;
  let paused = false;
  const actions = {
    join: () => sim.comment(me(), $('dep').value.trim() || '17'),
    chat: () => sim.comment(me(), 'allez !'),
    comment: () => {
      const t = $('comment').value;
      if (t.trim()) sim.comment(me(), t);
      $('comment').value = '';
    },
    like20: () => sim.like(me(), 20),
    like200: () => sim.like(me(), 200),
    share: () => sim.share(me()),
    follow: () => sim.follow(me()),
    combo: () => sim.gift(me(), gifts.find((g) => g.id === 'rose') || gifts[0], 10),
    dup: () => sim.duplicate(me()),
    storm: () => sim.storm(1000),
    voice: (btn) => {
      if (!voice) return;
      btn.textContent = voice.toggle() ? '🔇 Couper la voix' : '🔊 Activer la voix';
    },
    restart: () => admin({ action: 'restart' }),
    event: () => admin({ action: 'event' }),
    end: () => admin({ action: 'end' }),
    pause: (btn) => {
      paused = !paused;
      btn.textContent = paused ? 'Reprendre' : 'Pause';
      admin({ action: 'pause', value: paused });
    },
    speed: (btn) => {
      speed = speed >= 4 ? 1 : speed * 2;
      btn.textContent = `Vitesse ×${speed}`;
      admin({ action: 'speed', value: speed });
    },
  };
  container.addEventListener('click', (e) => {
    const giftBtn = e.target.closest('button[data-gift]');
    if (giftBtn) return sim.gift(me(), gifts[Number(giftBtn.dataset.gift)]);
    const btn = e.target.closest('button[data-act]');
    if (btn) actions[btn.dataset.act]?.(btn);
  });
  $('comment').addEventListener('keydown', (e) => e.key === 'Enter' && actions.comment());
  $('crowd').addEventListener('change', (e) => (e.target.checked ? sim.startCrowd() : sim.stopCrowd()));
  $('rate').addEventListener('input', (e) => {
    sim.crowd.rate = Number(e.target.value);
    $('rateV').textContent = e.target.value;
  });
  $('giftRate').addEventListener('input', (e) => {
    sim.crowd.giftRate = Number(e.target.value) / 100;
    $('giftV').textContent = `${e.target.value}%`;
  });
  if (voice) {
    $('voiceInfo').textContent = voice.output === 'server' ? ' sortie : haut-parleurs du PC (serveur)' : ' sortie : navigateur';
    container.querySelector('[data-act="voice"]').textContent = voice.isOn() ? '🔇 Couper la voix' : '🔊 Activer la voix';
  } else {
    container.querySelector('[data-act="voice"]').disabled = true;
    $('voiceInfo').textContent = ' voix désactivée (config ou ?voice=off)';
  }
  if (getStats) setInterval(() => ($('stats').textContent = getStats()), 500);
  return sim;
}
