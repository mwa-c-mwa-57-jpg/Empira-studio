// Live event simulator: produces events in exactly the same normalised format as the TikTok
// adapter, so the whole pipeline (validation → rules → game) is exercised without TikTok.

const NAMES = ['Lynx', 'Nova', 'Kenzo', 'Mila', 'Sacha', 'Inès', 'Yanis', 'Lola', 'Noah', 'Jade', 'Rayan', 'Lina',
  'Axel', 'Zoé', 'Malo', 'Nina', 'Eliott', 'Léa', 'Adam', 'Chloé', 'Tom', 'Sofia', 'Hugo', 'Maya'];

const GIFTS = {
  small: { id: 'g-small', name: 'Petit cadeau', diamonds: 1 },
  medium: { id: 'g-medium', name: 'Cadeau moyen', diamonds: 30 },
  big: { id: 'g-big', name: 'Gros cadeau', diamonds: 500 },
};

let counter = 0;

export class Simulator {
  constructor(sink, { random = Math.random, poolSize = 80 } = {}) {
    this.sink = sink;
    this.random = random;
    this.viewers = Array.from({ length: poolSize }, (_, i) => ({
      id: `sim-${i}`,
      name: `${NAMES[i % NAMES.length]}${i >= NAMES.length ? i : ''}`,
      leaning: random() < 0.5 ? 'A' : 'B',
    }));
    this.crowd = { running: false, rate: 6, bias: 0.5, giftRate: 0.03, timer: null };
  }

  randomViewer() {
    return this.viewers[Math.floor(this.random() * this.viewers.length)];
  }

  static gifts() {
    return GIFTS;
  }

  make(type, user, extra = {}) {
    return { id: `sim-${Date.now()}-${++counter}`, type, source: 'sim', ts: Date.now(), user: { id: user.id, name: user.name }, ...extra };
  }

  comment(user, text) {
    return this.sink(this.make('comment', user, { comment: text }));
  }

  like(user, count = 1) {
    return this.sink(this.make('like', user, { likeCount: count }));
  }

  gift(user, giftKey, count = 1) {
    const g = typeof giftKey === 'string' ? GIFTS[giftKey] : giftKey;
    return this.sink(this.make('gift', user, { gift: { ...g, count } }));
  }

  follow(user) {
    return this.sink(this.make('follow', user));
  }

  share(user) {
    return this.sink(this.make('share', user));
  }

  /** Sends the very same event twice: the pipeline must only apply it once. */
  duplicate(user) {
    const ev = this.make('gift', user, { gift: { ...GIFTS.small, count: 1 } });
    this.sink(ev);
    this.sink({ ...ev });
  }

  /** One random event from a viewer of the simulated crowd. */
  crowdEvent() {
    const v = this.randomViewer();
    const { bias, giftRate } = this.crowd;
    // bias 0 = everybody likes AZUR, 1 = everybody likes SOLAIRE
    const team = this.random() < bias ? 'A' : 'B';
    v.leaning = this.random() < 0.85 ? team : v.leaning;
    const k = this.random();
    if (k < giftRate) {
      const g = this.random();
      return this.gift(v, g < 0.75 ? 'small' : g < 0.95 ? 'medium' : 'big', this.random() < 0.2 ? 1 + Math.floor(this.random() * 5) : 1);
    }
    if (k < 0.35) return this.comment(v, v.leaning === 'A' ? '1' : '2');
    if (k < 0.45) return this.comment(v, ['gg', 'allez !!', 'trop bien', 'on gagne', 'lol'][Math.floor(this.random() * 5)]);
    if (k < 0.995) return this.like(v, 1 + Math.floor(this.random() * 15));
    return this.random() < 0.5 ? this.follow(v) : this.share(v);
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

  /** Stress test: a large burst of mixed events in one go. */
  storm(n = 1000) {
    for (let i = 0; i < n; i++) this.crowdEvent();
  }
}
