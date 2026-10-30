// Live event simulator for the "Conquête de France" mode (same normalised format as the TikTok adapter).

const FIRST = ['Lina', 'Yanis', 'Nana', 'Kenzo', 'Inès', 'Rayan', 'Jade', 'Thomas', 'Léa', 'Malik', 'Zoé', 'Hugo', 'Sarah', 'Noah',
  'Chloé', 'Adam', 'Manon', 'Ilyes', 'Emma', 'Lucas', 'Camille', 'Sofiane', 'Louna', 'Enzo', 'Maëlys', 'Bilal', 'Clara', 'Nathan'];
const POPULAR = ['17', '63', '21', '08', '59', '13', '75', '69', '33', '974', '31', '06', '67', '44', '2A', '29', '93', '76', '34', '971'];

let counter = 0;

export class FranceSimulator {
  constructor(sink, gifts, { random = Math.random, poolSize = 150 } = {}) {
    this.sink = sink;
    this.gifts = gifts;
    this.random = random;
    this.viewers = Array.from({ length: poolSize }, (_, i) => ({
      id: `sim-${i}`,
      name: `${FIRST[i % FIRST.length]}${i >= FIRST.length ? Math.floor(random() * 90 + 10) : ''}`,
      dep: POPULAR[Math.min(POPULAR.length - 1, Math.floor(Math.pow(random(), 1.6) * POPULAR.length))],
      joined: false,
    }));
    this.crowd = { running: false, rate: 8, giftRate: 0.02, timer: null };
  }

  make(type, user, extra = {}) {
    return { id: `sim-${Date.now()}-${++counter}`, type, source: 'sim', ts: Date.now(), user: { id: user.id, name: user.name }, ...extra };
  }

  comment(user, text) {
    return this.sink(this.make('comment', user, { comment: text }));
  }

  like(user, n) {
    return this.sink(this.make('like', user, { likeCount: n }));
  }

  share(user) {
    return this.sink(this.make('share', user));
  }

  follow(user) {
    return this.sink(this.make('follow', user));
  }

  gift(user, def, count = 1) {
    return this.sink(this.make('gift', user, { gift: { id: def.id, name: def.names[0], diamonds: def.diamonds, count } }));
  }

  duplicate(user) {
    const ev = this.make('gift', user, { gift: { id: 'rose', name: 'Rose', diamonds: 1, count: 1 } });
    this.sink(ev);
    this.sink({ ...ev });
  }

  crowdEvent() {
    const v = this.viewers[Math.floor(this.random() * this.viewers.length)];
    const k = this.random();
    if (!v.joined || k < 0.08) {
      v.joined = true;
      return this.comment(v, this.random() < 0.8 ? v.dep : `allez le ${v.dep} !!`);
    }
    if (k < this.crowd.giftRate) {
      // cheap gifts are much more frequent than expensive ones
      const sorted = [...this.gifts].sort((a, b) => a.diamonds - b.diamonds);
      const idx = Math.min(sorted.length - 1, Math.floor(Math.pow(this.random(), 3.2) * sorted.length));
      const def = sorted[idx];
      return this.gift(v, def, def.diamonds <= 5 && this.random() < 0.4 ? 1 + Math.floor(this.random() * 9) : 1);
    }
    if (k < 0.25) return this.comment(v, ['gg', 'on lâche rien', 'trop fort', 'allez', 'go go go', 'mdr'][Math.floor(this.random() * 6)]);
    if (k < 0.975) return this.like(v, 1 + Math.floor(this.random() * 15));
    return this.random() < 0.7 ? this.share(v) : this.follow(v);
  }

  startCrowd() {
    if (this.crowd.running) return;
    this.crowd.running = true;
    let last = performance.now();
    let debt = 0;
    this.crowd.timer = setInterval(() => {
      const now = performance.now();
      debt += ((now - last) / 1000) * this.crowd.rate;
      last = now;
      while (debt >= 1) {
        debt -= 1;
        this.crowdEvent();
      }
    }, 50);
  }

  stopCrowd() {
    this.crowd.running = false;
    clearInterval(this.crowd.timer);
  }

  storm(n = 1000) {
    for (let i = 0; i < n; i++) this.crowdEvent();
  }
}
