// Voice announcer ("Le Général"): turns game events into short French phrases and speaks them.
// The phrase logic is pure and testable; the output backend is injected (browser speech or local server).

import { DEPARTEMENTS } from './departements.js';
import { placeForms, capitalize } from './names.js';

const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];
const DEPARTEMENTS_BY_CODE = new Map(DEPARTEMENTS.map((d) => [d.code, d]));

/** Makes a viewer name pronounceable: letters, digits and spaces only, short. */
export function spokenName(name) {
  const s = String(name || '').normalize('NFC').replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();
  return s.slice(0, 20);
}

/** Pronoun used to refer back to a place: "la", "le" or "les". */
function pronoun(forms) {
  return forms.the.startsWith('la ') ? 'la' : forms.the.startsWith('les ') ? 'les' : 'le';
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
    this.joinTimer = 0;
    this.lastLeader = null;
    this.lastLeaderAt = -Infinity;
    this.lastThanksAt = -Infinity;
    this.countdownSaid = new Set();
    this.missionLastStretch = null;
    this.enabled = true;
  }

  name(p) {
    return this.cfg.readNames && p ? spokenName(p.name) : '';
  }

  /** Forms of a département name: { the, of, to }. */
  dep(code) {
    const d = DEPARTEMENTS_BY_CODE.get(code);
    return placeForms(d ? d.name : code);
  }

  /** Queues a phrase. Priority 3 = must say, 2 = important, 1 = filler. */
  say(text, priority = 1, key = text) {
    if (!this.enabled || !text) return;
    const t = this.now();
    if (t - (this.lastSaid.get(key) ?? -Infinity) < 12000) return; // never repeat the same thing in a row
    this.lastSaid.set(key, t);
    this.queue.push({ text: text.replace(/\s+/g, ' ').trim(), priority, at: t });
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
    if (joins.length === 1) {
      const { team, user } = joins[0];
      const f = this.dep(team);
      const who = this.name(user);
      this.say(who
        ? pick([
            `Les troupes ${f.of} débarquent, menées par ${who} !`,
            `Nouveau front : ${f.the} rejoint la bataille avec ${who} !`,
            `${capitalize(f.the)} entre en guerre ! Merci ${who} !`,
          ], this.random)
        : `${capitalize(f.the)} entre en guerre !`, 2);
    } else if (joins.length <= 3) {
      this.say(`Nouveaux fronts : ${joins.map((j) => this.dep(j.team).the).join(', ')} entrent en guerre !`, 2);
    } else {
      this.say(`${joins.length} nouveaux départements entrent en guerre ! Écris le numéro du tien !`, 2);
    }
  }

  #thanks(text) {
    // thanks for small actions are welcome, but not every second
    const t = this.now();
    if (t - this.lastThanksAt < 6000) return;
    this.lastThanksAt = t;
    this.say(text, 1);
  }

  handleEvents(events) {
    const g = this.game;
    const r = this.random;
    const eco = this.config.economy;
    for (const e of events) {
      switch (e.type) {
        case 'roundStart':
          this.countdownSaid.clear();
          this.lastLeader = null;
          this.say('Nouvelle partie ! Écris le numéro de ton département dans le tchat pour entrer en guerre !', 3);
          break;
        case 'join':
          this.pendingJoins.push({ team: e.team, user: e.user });
          if (this.pendingJoins.length === 1) this.joinTimer = this.now();
          break;
        case 'bubble': {
          const who = this.name(e.user);
          if (!who || !e.team) break;
          const f = this.dep(e.team);
          if (e.kind === 'share') {
            this.#thanks(pick([
              `Merci ${who} pour le partage ! ${capitalize(f.the)} gagne ${eco.shareSoldiers} soldats !`,
              `Encore un partage ! Merci ${who}, qui fait mieux ?`,
              `${who} recrute du monde en partageant, bravo !`,
            ], r));
          } else if (e.kind === 'follow') {
            this.#thanks(`${who} rejoint la famille ! ${eco.followSoldiers} soldats pour ${f.the} !`);
          }
          break;
        }
        case 'gift': {
          if (e.diamonds < this.cfg.minGiftCoins) break;
          const who = this.name(e.user);
          const gift = spokenName(e.name);
          const f = this.dep(e.team);
          this.say(pick([
            `Énorme ! ${who} envoie ${gift} pour ${f.the} !`,
            `Merci ${who} pour ${gift} ! ${capitalize(f.the)} reçoit des renforts !`,
            `${gift} de la part de ${who} ! ${capitalize(f.the)} se renforce !`,
          ], r), 2, `gift:${e.user?.id}:${gift}`);
          break;
        }
        case 'hit':
          if (e.effect === 'reset') this.say(`Catastrophe ! ${capitalize(this.dep(e.team).the)} retombe à zéro soldat !`, 3);
          else if (e.effect === 'steal') this.say(`${capitalize(this.dep(e.from).the)} vole ${Math.round(e.amount)} soldats ${this.dep(e.team).to} !`, 2);
          break;
        case 'banner':
          if (/bouclier/i.test(e.text) && /Bouclier sur/.test(e.text) && e.team) this.say(`Bouclier activé sur ${this.dep(e.team).the} !`, 2, `shield:${e.team}`);
          else if (/déferle/i.test(e.text) && e.team) this.say(`Incroyable ! ${capitalize(this.dep(e.team).the)} déferle sur la France !`, 3);
          else if (/objectif de likes/i.test(e.text)) this.say(`Objectif de likes atteint ! ${eco.likeGoalReward} soldats pour tous les départements !`, 2);
          break;
        case 'capture': {
          if (!e.capital) {
            if (e.team === e.code) this.say(`Libération ! ${capitalize(this.dep(e.code).the)} reprend sa capitale !`, 2);
            break;
          }
          const victim = this.dep(e.code);
          const attacker = this.dep(e.team);
          const team = g.teams.get(e.code);
          const cost = team ? g.conquestCost(team, e.code) : 0;
          this.say(`${capitalize(victim.the)} est sous le drapeau ${attacker.of} ! Soldats ${victim.of}, ne vous laissez pas faire${cost ? ` : ${cost} soldats et vous êtes libres` : ''} !`, 3);
          break;
        }
        case 'milestone':
          this.say(`${capitalize(this.dep(e.team).the)} atteint ${e.value} soldats !`, 2);
          break;
        case 'asleep':
          if (g.ranking().slice(0, 5).some((t) => t.code === e.team)) this.say(`Les soldats ${this.dep(e.team).of} fondent ! Likez et commentez pour les réveiller !`, 1);
          break;
        case 'awake': {
          const who = this.name(e.user);
          this.say(`${capitalize(this.dep(e.team).the)} se réveille, ses soldats arrêtent de fondre !${who ? ` Merci ${who} !` : ''}`, 2);
          break;
        }
        case 'eventStart': {
          const ev = e.event;
          const c = this.config.events;
          if (ev.type === 'duel') this.say(`Duel ! ${capitalize(this.dep(ev.a).the)} contre ${this.dep(ev.b).the} : celui qui recrute le plus vole ${c.duel.stealPercent} pour cent à l'autre !`, 3);
          else if (ev.type === 'revolution') this.say(`Révolution ! Tout le monde contre ${this.dep(ev.target).the} ! Gains doublés pour les autres !`, 3);
          else if (ev.type === 'mission') {
            this.missionLastStretch = null;
            this.say(`Ordre du Général pour ${placeForms(ev.region).the} : recrutez ${ev.target} soldats ! ${c.mission.rewardPerDepartment} soldats par département qui participe !`, 3);
          } else if (ev.type === 'bounty') {
            const f = this.dep(ev.target);
            this.say(`La tête ${f.of} est mise à prix ! ${c.bounty.reward} soldats pour celui qui ${pronoun(f)} dépassera !`, 3);
          }
          break;
        }
        case 'eventEnd': {
          const ev = e.event;
          const res = e.result || {};
          const reward = this.config.events.mission.rewardPerDepartment;
          if (ev.type === 'duel') this.say(res.winner ? `Duel gagné par ${this.dep(res.winner).the}, qui vole ${res.stolen} soldats ${this.dep(res.loser).to} !` : 'Duel nul ! Personne ne vole personne.', 2);
          else if (ev.type === 'mission') this.say(res.success ? `Le Général est fier ${placeForms(ev.region).of} ! Chaque département qui a participé gagne ${reward} soldats !` : `Mission échouée pour ${placeForms(ev.region).the}… Le Général est déçu.`, 2);
          else if (ev.type === 'revolution') this.say('Fin de la révolution. Le calme revient… pour l\'instant.', 2);
          else if (ev.type === 'bounty' && res.winner) this.say(`${capitalize(this.dep(res.winner).the)} dépasse ${this.dep(ev.target).the} et touche la prime !`, 2);
          break;
        }
        case 'popup': {
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
          let text = w ? `Victoire ${placeForms(w.name).of}, qui remporte la partie avec ${w.territories} départements !` : 'Fin de la partie !';
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
      if (this.lastLeader && t - this.lastLeaderAt > 20000) this.say(`${capitalize(this.dep(leader.code).the)} prend la tête !`, 1);
      this.lastLeader = leader.code;
      this.lastLeaderAt = t;
    }
    const ev = g.event;
    if (ev?.type === 'mission' && this.missionLastStretch !== ev && ev.progress >= ev.target * 0.75 && ev.progress < ev.target) {
      this.missionLastStretch = ev;
      this.say(`Dernière ligne droite pour ${placeForms(ev.region).the} ! Encore ${Math.ceil(ev.target - ev.progress)} soldats !`, 2);
    }
    for (const s of [60, 30, 10]) {
      if (g.timeLeft <= s && g.timeLeft > s - 2 && !this.countdownSaid.has(s)) {
        this.countdownSaid.add(s);
        this.say(s === 60 ? 'Plus qu\'une minute !' : `Plus que ${s} secondes !`, 3);
      }
    }
  }
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
