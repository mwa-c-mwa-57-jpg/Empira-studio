/* Neon Tulp — content data: menu, events, opening hours, crowd curve. */
(function () {
  var IMG = "assets/img/";

  // Flavour axes per category (keys into i18n "ax.*"); scores are 0–5.
  var AXES = {
    koffie: ["acid", "body", "sweet", "fruit", "bitter", "finish"],
    wiet: ["citrus", "earth", "sweet", "spice", "pine", "floral"],
    hasj: ["citrus", "earth", "sweet", "spice", "pine", "floral"],
    bakkerij: ["sweet", "butter", "spice", "fruit", "crunch", "warm"]
  };

  var MENU = {
    koffie: [
      { id: "espresso", name: "Espresso", origin: { nl: "Ethiopië · Guji", en: "Ethiopia · Guji", fr: "Éthiopie · Guji" }, type: "coffee", price: 3.2, strength: 4,
        profile: [4, 3, 3, 4, 2, 3], img: "espresso.webp",
        desc: { nl: "Bloemig, bergamot, korte afdronk.", en: "Floral, bergamot, short finish.", fr: "Floral, bergamote, finale courte." } },
      { id: "flatwhite", name: "Flat white", origin: { nl: "Brazilië · Cerrado", en: "Brazil · Cerrado", fr: "Brésil · Cerrado" }, type: "coffee", price: 4.4, strength: 3,
        profile: [2, 4, 4, 2, 2, 4], img: "latte-rosetta.webp",
        desc: { nl: "Hazelnoot en melkchocolade, romig.", en: "Hazelnut and milk chocolate, creamy.", fr: "Noisette et chocolat au lait, onctueux." } },
      { id: "v60", name: "V60 filter", origin: { nl: "Kenia · Nyeri", en: "Kenya · Nyeri", fr: "Kenya · Nyeri" }, type: "coffee", price: 4.8, strength: 2,
        profile: [5, 2, 3, 5, 1, 3], img: "pour-over.webp",
        desc: { nl: "Zwarte bes en rabarber, sappig en licht.", en: "Blackcurrant and rhubarb, juicy and light.", fr: "Cassis et rhubarbe, juteux et léger." } },
      { id: "coldbrew", name: "Cold brew", origin: { nl: "Colombia · Huila", en: "Colombia · Huila", fr: "Colombie · Huila" }, type: "coffee", price: 4.6, strength: 3,
        profile: [2, 3, 4, 3, 2, 4], img: "dripper.webp",
        desc: { nl: "Achttien uur getrokken. Karamel, rood fruit.", en: "Steeped for eighteen hours. Caramel, red fruit.", fr: "Infusé dix-huit heures. Caramel, fruits rouges." } },
      { id: "verkeerd", name: "Koffie verkeerd", origin: { nl: "Huisblend", en: "House blend", fr: "Assemblage maison" }, type: "coffee", price: 4.2, strength: 2,
        profile: [2, 4, 4, 2, 1, 3], img: "latte-heart.webp",
        desc: { nl: "De Nederlandse latte: veel melk, weinig haast.", en: "The Dutch latte: lots of milk, no hurry.", fr: "Le latte néerlandais : beaucoup de lait, aucune hâte." } }
    ],
    wiet: [
      { id: "amnesia", name: "Amnesia Haze", origin: "type.sativa", type: "sativa", price: 12, thc: 20, cbd: 0.5,
        profile: [4, 2, 2, 3, 2, 1], img: "leaf-glow.webp",
        desc: { nl: "Citrus en kruiden, helder en opgewekt.", en: "Citrus and spice, bright and uplifting.", fr: "Agrumes et épices, lumineuse et tonique." } },
      { id: "northern", name: "Northern Lights", origin: "type.indica", type: "indica", price: 10, thc: 16, cbd: 0.3,
        profile: [1, 4, 3, 2, 3, 1], img: "leaf-close.webp",
        desc: { nl: "Aards en zoet, zwaar en rustig.", en: "Earthy and sweet, heavy and calm.", fr: "Terreuse et sucrée, lourde et apaisante." } },
      { id: "widow", name: "White Widow", origin: "type.hybrid", type: "hybrid", price: 11, thc: 18, cbd: 0.4,
        profile: [2, 3, 2, 3, 3, 2], img: "leaf-plant.webp",
        desc: { nl: "Klassieker uit de jaren '90, mooi in balans.", en: "A '90s classic, nicely balanced.", fr: "Un classique des années 90, bien équilibré." } },
      { id: "lemon", name: "Super Lemon Haze", origin: "type.sativa", type: "sativa", price: 13, thc: 21, cbd: 0.3,
        profile: [5, 1, 3, 2, 2, 2], img: "leaf-single.webp",
        desc: { nl: "Citroenschil en zoetzuur.", en: "Lemon zest, sweet and sour.", fr: "Zeste de citron, aigre-doux." } },
      { id: "cbd", name: "CBD Critical", origin: "type.indica", type: "indica", price: 9, thc: 6, cbd: 9,
        profile: [1, 3, 3, 1, 3, 3], img: "leaf-close.webp",
        desc: { nl: "Mild. Voor beginners en rustige avonden.", en: "Mild. For first-timers and quiet evenings.", fr: "Douce. Pour débuter ou les soirées calmes." } }
    ],
    hasj: [
      { id: "ketama", name: "Marokkaanse Ketama", origin: "type.hash", type: "hash", price: 10, thc: 18, cbd: 2,
        profile: [1, 4, 3, 4, 1, 1], img: "smoke-green.webp",
        desc: { nl: "Zacht en kruidig, traditioneel geperst.", en: "Soft and spicy, traditionally pressed.", fr: "Souple et épicé, pressé à l'ancienne." } },
      { id: "temple", name: "Nepalese Temple Ball", origin: "type.hash", type: "hash", price: 18, thc: 22, cbd: 1,
        profile: [1, 5, 2, 3, 3, 1], img: "smoke-purple.webp",
        desc: { nl: "Handgerold, diep en harsig.", en: "Hand-rolled, deep and resinous.", fr: "Roulé à la main, profond et résineux." } },
      { id: "ice", name: "Ice-o-lator", origin: "type.hash", type: "hash", price: 22, thc: 30, cbd: 1,
        profile: [2, 3, 4, 2, 2, 2], img: "smoke-blue.webp",
        desc: { nl: "Sterk. Alleen voor ervaren gebruikers.", en: "Strong. Experienced users only.", fr: "Puissant. Réservé aux initiés." } }
    ],
    bakkerij: [
      { id: "stroopwafel", name: "Stroopwafel", origin: { nl: "Vers van het ijzer", en: "Fresh off the iron", fr: "Tout juste sortie du gaufrier" }, type: "bakery", price: 2.5,
        profile: [5, 4, 2, 0, 3, 4], img: "stroopwafel.webp",
        desc: { nl: "Warm, met stroop van de bakker om de hoek.", en: "Warm, with syrup from the baker round the corner.", fr: "Tiède, au sirop du boulanger d'à côté." } },
      { id: "appeltaart", name: "Appeltaart", origin: { nl: "Met slagroom", en: "With whipped cream", fr: "Avec chantilly" }, type: "bakery", price: 4.8,
        profile: [4, 3, 4, 4, 2, 4], img: "appeltaart.webp",
        desc: { nl: "Hoog, met kaneel en een flinke toef slagroom.", en: "Tall, with cinnamon and a big swirl of cream.", fr: "Haute, à la cannelle, avec une belle chantilly." } },
      { id: "spacecake", name: "Space cake", origin: "kaart.counter", type: "bakery", price: null,
        profile: [4, 3, 1, 1, 1, 3], img: "neon-palm.webp", counter: true,
        desc: { nl: "Alleen met uitleg aan de toonbank. Werkt na 1–2 uur, neem er nooit twee.", en: "Only with a briefing at the counter. Takes 1–2 hours, never have two.", fr: "Uniquement avec explications au comptoir. Agit après 1–2 h, jamais deux." } }
    ]
  };

  // Weekday index 0 = Monday. Times in minutes from midnight; close may exceed 1440 (after midnight).
  var HOURS = [
    { open: 480, close: 1500 }, // ma 08:00–01:00
    { open: 480, close: 1500 },
    { open: 480, close: 1500 },
    { open: 480, close: 1500 },
    { open: 480, close: 1560 }, // vr 08:00–02:00
    { open: 480, close: 1560 }, // za
    { open: 600, close: 1440 }  // zo 10:00–00:00
  ];

  // Average guests per hour, 08:00 … 00:00 (indicative concept figures, 42 seats).
  var CROWD = {
    hours: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
    koffie: [12, 22, 28, 24, 20, 16, 10, 9, 11, 9, 6, 4, 3, 2, 1, 1, 0],
    lounge: [0, 1, 2, 3, 5, 6, 6, 7, 10, 14, 16, 20, 26, 31, 34, 28, 18]
  };

  // Recurring events: weekday (0 = Monday), start time, image.
  var EVENTS = [
    { id: "vinyl", dow: 6, time: "16:00", price: "free", img: "vinyl.webp" },
    { id: "latte", dow: 2, time: "19:00", price: "free", img: "latte-heart.webp" },
    { id: "jazz", dow: 4, time: "21:00", price: "free", img: "neon-portrait.webp" },
    { id: "class", dow: 5, time: "10:00", price: "€ 25", img: "pour-over.webp" }
  ];

  window.NT_DATA = { IMG: IMG, AXES: AXES, MENU: MENU, HOURS: HOURS, CROWD: CROWD, EVENTS: EVENTS };
})();
