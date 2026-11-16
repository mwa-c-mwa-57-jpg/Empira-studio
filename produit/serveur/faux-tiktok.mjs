// Faux live TikTok pour les tests automatisés (mode EMPIRA_TEST=1, jamais dans la version vendue).
// Imite l'interface de tiktok-live-connector : TikTokLiveConnection, WebcastEvent, ControlEvent.

import { EventEmitter } from 'node:events';

export const WebcastEvent = { CHAT: 'chat', LIKE: 'like', GIFT: 'gift', FOLLOW: 'follow', SHARE: 'share', SOCIAL: 'social', STREAM_END: 'streamEnd' };
export const ControlEvent = { DISCONNECTED: 'disconnected', ERROR: 'error' };
const instances = new Set();

export class TikTokLiveConnection extends EventEmitter {
  constructor(pseudo) {
    super();
    this.pseudo = pseudo;
  }

  async connect() {
    if (this.pseudo === 'hors_ligne') {
      const e = new Error('The requested user is not live');
      e.name = 'UserOfflineError';
      throw e;
    }
    instances.add(this);
    return { roomId: '7000000000000000000' };
  }

  disconnect() {
    instances.delete(this);
  }
}

/** Envoie un événement (au format de la bibliothèque) à toutes les connexions ouvertes. */
export function emettre(sorte, donnees) {
  for (const c of instances) c.emit(sorte, donnees);
  return instances.size;
}

/** Coupe toutes les connexions, comme une perte de réseau. */
export function couper() {
  for (const c of [...instances]) {
    instances.delete(c);
    c.emit(ControlEvent.DISCONNECTED);
  }
}
