// Textes affichés à l'écran (français / anglais).
const STRINGS = {
  fr: {
    kind_join: 'a rejoint',
    kind_follow: 'follow',
    kind_share: 'partage',
    kind_comment: 'commentaire',
    kind_like: 'likes',
    kind_gift: 'cadeau {coins} coins',
    toast: '{name} {kind} — ajouté à la file d’impression.',
    toastUpgrade: '{name} {kind} — impression améliorée !',
    status: '🖨️ Impression : {name} · {kind} · {n} en attente',
    statusNoQueue: '🖨️ Impression : {name} · {kind}',
    coin: '{n} COIN',
    coins: '{n} COINS',
    legendTitle: '🎁 Plus de coins = plus grand',
    offline: 'Serveur Print Booth injoignable… (lancez LANCER-WINDOWS.bat)',
    cardThanks: 'MERCI POUR LE CADEAU !',
    cardRoyal: 'MERCI {coins} COINS',
    cardLegendTitle: 'LÉGENDE',
    cardLegendCoins: '{coins} COINS · MERCI !',
  },
  en: {
    kind_join: 'join',
    kind_follow: 'follow',
    kind_share: 'share',
    kind_comment: 'comment',
    kind_like: 'likes',
    kind_gift: 'gift {coins} coins',
    toast: '{name} {kind} — added to the draw queue.',
    toastUpgrade: '{name} {kind} — print upgraded!',
    status: '🖨️ Drawing {name} · {kind} · {n} waiting',
    statusNoQueue: '🖨️ Drawing {name} · {kind}',
    coin: '{n} COIN',
    coins: '{n} COINS',
    legendTitle: '🎁 More coins = bigger print',
    offline: 'Print Booth server unreachable…',
    cardThanks: 'THANK YOU FOR THE GIFT!',
    cardRoyal: 'THANK YOU · {coins} COINS',
    cardLegendTitle: 'LEGEND',
    cardLegendCoins: '{coins} COINS · THANK YOU!',
  },
};

let lang = 'fr';

export function setLanguage(next) {
  lang = STRINGS[next] ? next : 'fr';
}

export function t(key, vars = {}) {
  const template = STRINGS[lang][key] ?? STRINGS.fr[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '').toString());
}

export function kindLabel(kind, coins) {
  return t(`kind_${kind}`, { coins });
}
