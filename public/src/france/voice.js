// Voice announcer ("Le Général"): turns game events into short French phrases and speaks them.
// The phrase logic is pure and testable; the output backend is injected (browser speech or local server).

const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];

/** Makes a viewer name pronounceable: letters, digits and spaces only, short. */
export function spokenName(name) {
  const s = String(name || '').normalize('NFC').replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();
  return s.slice(0, 20);
}

/** "le 17, Charente-Maritime" — Corsica is read by name so "2A" is not spelled out. */
export function spokenDep(code, name) {
  if (code === '2A' || code === '2B') return `la ${name}`;
  return name ? `le ${code}, ${name}` : `le ${code}`;
}

export class Announcer {
  constructor(config, game, { speak, now = () => performance.now(), random = Math.random } = {}) {
    this.cfg = { minGiftCoins: 100, maxQueue: 3, readNames: true, ...(config.voice || {}) };
    this.config = config;
    this.game = game;
    this.speak = speak;
    this.now = now;
    this.random = random;
    this.queue = [];
    this.busyUntil = 0;
    this.lastSaid = new Map();
    this.pendingJoins = [];
    this.joinTimer = null;
    this.lastLeader = null;
    this.lastLeaderAt = -Infinity;
    this.countdownSaid = new Set();
    this.enabled = true;
  }

  name(p) {
    return this.cfg.readNames && p ? spokenName(p.name) : '';
  }

  dep(code) {
    return spokenDep(code, this.game.teams.get(code)?.name ?? '');
  }

  /** Queues a phrase. Priority 3 = must say, 2 = important, 1 = filler. */
  say(text, priority = 1, key = text) {
    if (!this.enabled || !text) return;
    const t = this.now();
    if (t - (this.lastSaid.get(key) ?? -Infinity) < 12000) return; // never repeat the same thing in a row
    this.lastSaid.set(key, t);
    this.queue.push({ text, priority, at: t });
    this.queue.sort((a, b) => b.priority - a.priority || a.at - b.at);
    while (this.queue.length > this.cfg.maxQueue) this.queue.pop(); // drop the least important
  }

  /** Called every frame: starts the next phrase when the previous one should be finished. */
  tick() {
    const t = this.now();
    // stale filler is pointless: the moment has passed
    this.queue = this.queue.filter((q) => q.priority >= 2 || t - q.at < 6000);
    if (this.pendingJoins.length && t - this.joinTimer > 2500) this.#flushJoins();
    if (t < this.busyUntil || !this.queue.length) return;
    const next = this.queue.shift();
    // rough duration estimate (about 14 characters per second) so phrases do not overlap
    this.busyUntil = t + 900 + next.text.length * 70;
    this.speak(next.text);
  }

  #flushJoins() {
    const joins = this.pendingJoins;
    this.pendingJoins = [];
    if (joins.length === 1) this.say(`${cap(this.dep(joins[0]))} entre en guerre !`, 2);
    else if (joins.length <= 3) this.say(`${cap(joins.map((c) => this.dep(c)).join(', '))} entrent en guerre !`, 2);
    else this.say(`${joins.length} nouveaux départements entrent en guerre !`, 2);
  }

  handleEvents(events) {
    const g = this.game;
    const r = this.random;
    for (const e of events) {
      switch (e.type) {
        case 'roundStart':
          this.countdownSaid.clear();
          this.lastLeader = null;
          this.say('Nouvelle partie ! Écris le numéro de ton département dans le tchat pour entrer en guerre !', 3);
          break;
        case 'join':
          this.pendingJoins.push(e.team);
          if (this.pendingJoins.length === 1) this.joinTimer = this.now();
          break;
        case 'gift': {
          if (e.diamonds < this.cfg.minGiftCoins) break;
          const who = this.name(e.user);
          const gift = spokenName(e.name);
          this.say(pick([
            `Énorme ! ${who} envoie ${gift} pour ${this.dep(e.team)} !`,
            `Merci ${who} pour ${gift} ! ${cap(this.dep(e.team))} reçoit des renforts !`,
            `${gift} de la part de ${who} ! ${cap(this.dep(e.team))} se renforce !`,
          ], r).replace(/^ /, ''), 2, `gift:${e.user?.id}:${gift}`);
          break;
        }
        case 'hit':
          if (e.effect === 'reset') this.say(`Catastrophe ! ${cap(this.dep(e.team))} retombe à zéro soldat !`, 3);
          else if (e.effect === 'steal') this.say(`${cap(this.dep(e.from))} vole ${Math.round(e.amount)} soldats au ${e.team} !`, 2);
          break;
        case 'banner':
          if (/bouclier/i.test(e.text) && e.team) this.say(`Bouclier activé sur ${this.dep(e.team)} !`, 2, `shield:${e.team}`);
          else if (/déferle/i.test(e.text) && e.team) this.say(`Incroyable ! ${cap(this.dep(e.team))} déferle sur la France !`, 3);
          else if (/objectif de likes/i.test(e.text)) this.say('Objectif de likes atteint ! Vingt soldats pour tous les départements !', 2);
          break;
        case 'capture':
          if (e.capital) this.say(`${cap(this.dep(e.team))} envahit la capitale du ${e.code} !`, 3);
          break;
        case 'eventStart': {
          const ev = e.event;
          const c = this.config.events;
          if (ev.type === 'duel') this.say(`Duel ! ${cap(this.dep(ev.a))} contre ${this.dep(ev.b)}. Celui qui recrute le plus vole ${c.duel.stealPercent} pour cent à l'autre !`, 3);
          else if (ev.type === 'revolution') this.say(`Révolution ! Tout le monde contre ${this.dep(ev.target)} ! Gains doublés pour les autres !`, 3);
          else if (ev.type === 'mission') this.say(`Mission ! La région ${ev.region} doit recruter ${ev.target} soldats !`, 3);
          else if (ev.type === 'bounty') this.say(`Tête mise à prix ! ${c.bounty.reward} soldats pour le département qui dépassera ${this.dep(ev.target)} !`, 3);
          break;
        }
        case 'eventEnd':
          if (e.text) this.say(e.text.replace(/\b(\d{2,3}|2A|2B) /g, 'le $1 ').replace(/le le /g, 'le '), 2);
          break;
        case 'popup': {
          const eco = this.config.economy;
          const lines = {
            share: `Partage le live ! Chaque partage rapporte ${eco.shareSoldiers} soldats à ton département !`,
            join: 'Écris le numéro de ton département dans le tchat pour entrer en guerre !',
            follow: `Abonne-toi ! Chaque abonnement rapporte ${eco.followSoldiers} soldats à ton département !`,
            gift: `Chaque pièce offerte, c'est ${eco.soldiersPerDiamond} soldats pour ton département !`,
          };
          this.say(lines[e.kind], 1);
          break;
        }
        case 'victory': {
          const w = e.winner;
          const king = g.finalKing;
          let text = w ? `Victoire ! ${cap(spokenDep(w.code, w.name))} remporte la partie avec ${w.territories} départements !` : 'Fin de la partie !';
          if (king && this.cfg.readNames) text += ` Bravo à ${spokenName(king.name)}, roi du pays !`;
          this.queue = [];
          this.say(text, 3);
          break;
        }
        default:
          break;
      }
    }
    this.#watchState();
  }

  #watchState() {
    const g = this.game;
    if (g.phase !== 'battle') return;
    const leader = g.ranking()[0];
    const t = this.now();
    if (leader && leader.soldiers >= 50 && leader.code !== this.lastLeader) {
      if (this.lastLeader && t - this.lastLeaderAt > 20000) this.say(`${cap(this.dep(leader.code))} prend la tête !`, 1);
      this.lastLeader = leader.code;
      this.lastLeaderAt = t;
    }
    for (const s of [60, 30, 10]) {
      if (g.timeLeft <= s && g.timeLeft > s - 2 && !this.countdownSaid.has(s)) {
        this.countdownSaid.add(s);
        this.say(s === 60 ? 'Plus qu\'une minute !' : `Plus que ${s} secondes !`, 3);
      }
    }
  }
}

function cap(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

// ---------------------------------------------------------------------------- output backends

/** Browser speech synthesis (needs one click on the page in Chrome/Edge). */
export function browserSpeech({ rate = 1.05, pitch = 1, volume = 1, voiceName = '' } = {}) {
  if (typeof speechSynthesis === 'undefined') return null;
  let voice = null;
  const choose = () => {
    const voices = speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith('fr'));
    const prefs = [voiceName, 'Denise', 'Henri', 'Vivienne', 'Hortense', 'Paul', 'Julie', 'Thomas', 'Amélie', 'Google'].filter(Boolean);
    voice = prefs.map((p) => voices.find((v) => v.name.includes(p))).find(Boolean) || voices[0] || null;
  };
  choose();
  speechSynthesis.onvoiceschanged = choose;
  return (text) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    if (voice) u.voice = voice;
    u.rate = rate;
    u.pitch = pitch;
    u.volume = volume;
    speechSynthesis.speak(u);
  };
}

/** Voice played by the local server (Windows voices) — the right choice for OBS. */
export function serverSpeech() {
  return (text) => {
    fetch('/api/say', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) }).catch(() => {});
  };
}
