// Démo « ton stream version Empira » : chat simulé, alertes et objectif animés.
// Les trois boutons sont de vraies actions : « J'aime » (cœurs animés),
// « Partager » (partage ou copie du lien du site) et « Suivre » (ouvre le TikTok de l'agence).
import { $, esc, onVisible, reducedMotion } from "./utils.js";
import { toast } from "./ui.js";

const USERS = [
  ["nova_tv", "#f6d892"],
  ["kaelys", "#e0b05a"],
  ["rafou_93", "#f6f3ee"],
  ["pixelmaya", "#c99a4a"],
  ["theo.plays", "#e8d2a6"],
  ["ines_live", "#d4a24c"],
  ["mathgaming", "#bfb6a8"],
  ["sora", "#f0c674"],
  ["lucas_rx", "#e6dccb"],
  ["zoe.mp4", "#b88a3e"],
];
const LINES = [
  "le son est incroyable ce soir",
  "c'est quoi ton micro ??",
  "GG !!!",
  "ta voix est trop claire",
  "première fois ici, salut tout le monde 👋",
  "la transition de scène 🔥",
  "on entend grave mieux qu'avant",
  "t'as changé de micro ?",
  "zéro bruit de clavier, propre",
  "hype hype hype",
  "trop bien les nouvelles alertes",
  "l'overlay est magnifique",
  "on est là ✨",
  "le chat est chaud ce soir",
  "clip ça direct",
];
// Sur TikTok, « suivre » et « s'abonner » sont la même chose : une seule alerte d'abonnement.
const ALERTS = {
  like: { icon: "♥", label: "J'aime", msg: (u) => `${u} a aimé le live`, goal: 0 },
  share: { icon: "↗", label: "Partage", msg: (u) => `${u} a partagé le live`, goal: 0 },
  follow: { icon: "+", label: "Nouvel abonné", msg: (u) => `${u} suit maintenant Empira`, goal: 1 },
};
const MINE = {
  like: "Tu as aimé le live",
  share: "Tu as partagé Empira Studio",
  follow: "Tu suis Empira Agency sur TikTok",
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function liveDemo(root) {
  if (!root) return;
  const chat = $("[data-chat]", root);
  const alert = $("[data-stream-alert]", root);
  const frame = $(".stream-frame", root);
  const goalBar = $("[data-goal-bar]", root);
  const goalText = $("[data-goal-text]", root);
  const likesEl = $("[data-likes]", root);
  const hearts = $("[data-hearts]", root);
  let likes = 8412;
  let goal = 31;
  const GOAL = 50;
  let timer = 0;
  let alertTimer = 0;

  const push = (html, cls = "") => {
    const li = document.createElement("li");
    if (cls) li.className = cls;
    li.innerHTML = html;
    chat.append(li);
    while (chat.children.length > 16) chat.firstElementChild.remove();
  };
  const message = () => {
    const [u, c] = pick(USERS);
    push(`<b class="u">${esc(u)}</b> ${esc(pick(LINES))}`);
    chat.lastElementChild.querySelector(".u").style.color = c;
  };
  const updateGoal = () => {
    goalBar.style.transform = `scaleX(${Math.min(1, goal / GOAL)})`;
    goalText.textContent = `${Math.min(goal, GOAL)} / ${GOAL}`;
  };
  const addLikes = (n) => {
    likes += n;
    likesEl.textContent = likes.toLocaleString("fr-FR");
  };
  const burst = (count = 6) => {
    if (reducedMotion()) return;
    for (let i = 0; i < count; i++) {
      const h = document.createElement("span");
      h.className = "heart";
      h.textContent = "♥";
      h.style.setProperty("--dx", `${Math.round((Math.random() - 0.5) * 90)}px`);
      h.style.setProperty("--s", (0.8 + Math.random() * 0.8).toFixed(2));
      h.style.setProperty("--d", `${Math.round(i * 90 + Math.random() * 60)}ms`);
      h.addEventListener("animationend", () => h.remove(), { once: true });
      hearts.append(h);
    }
  };

  // mine = true quand c'est le visiteur qui a cliqué.
  const trigger = (type, mine = false) => {
    const a = ALERTS[type];
    const text = mine ? MINE[type] : a.msg(pick(USERS)[0]);
    alert.innerHTML = `<span class="ov-alert-icon">${a.icon}</span><span><small>${a.label}</small>${esc(text)}</span>`;
    alert.classList.remove("show");
    void alert.offsetWidth;
    alert.classList.add("show");
    frame.classList.add("flash");
    clearTimeout(alertTimer);
    alertTimer = setTimeout(() => {
      alert.classList.remove("show");
      frame.classList.remove("flash");
    }, 2800);
    push(`<strong>${a.icon} ${esc(text)}</strong>`, "sys");
    if (a.goal) {
      goal = goal >= GOAL ? a.goal : goal + a.goal;
      updateGoal();
    }
    if (type === "like") {
      addLikes(mine ? 1 : 12);
      burst(mine ? 8 : 4);
    }
  };

  async function share() {
    const url = document.body.dataset.site || location.origin;
    const data = { title: "Empira Studio", text: "Matériel de streaming et agence TikTok LIVE : Empira Studio", url };
    try {
      if (navigator.share) {
        await navigator.share(data);
        trigger("share", true);
        return;
      }
    } catch (err) {
      if (err?.name === "AbortError") return; // partage annulé par le visiteur
    }
    try {
      await navigator.clipboard.writeText(url);
      toast("Lien du site copié : colle-le où tu veux");
    } catch {
      toast(url);
    }
    trigger("share", true);
  }

  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-like]")) trigger("like", true);
    if (e.target.closest("[data-share]")) share();
    if (e.target.closest("[data-follow]")) trigger("follow", true); // le lien s'ouvre dans un nouvel onglet
  });

  for (let i = 0; i < 7; i++) message();
  updateGoal();
  if (reducedMotion()) return;

  const tick = () => {
    message();
    const r = Math.random();
    if (r < 0.1) trigger("like");
    else if (r < 0.14) trigger("follow");
    else if (r < 0.16) trigger("share");
    timer = setTimeout(tick, 900 + Math.random() * 1500);
  };
  onVisible(root, (visible) => {
    clearTimeout(timer);
    if (visible) timer = setTimeout(tick, 600);
  });
}

// Petite version pour l'écran du hero : alertes en boucle et compteur de spectateurs.
export function heroOverlay(stage) {
  if (!stage) return;
  const alert = $("[data-hero-alert]", stage);
  const viewers = $("[data-hero-viewers]", stage);
  let n = 1248;
  const types = Object.values(ALERTS);
  let i = 0;
  const show = () => {
    const a = types[i++ % types.length];
    const [u] = pick(USERS);
    alert.innerHTML = `<span class="ov-alert-icon">${a.icon}</span><span><small>${a.label}</small>${esc(a.msg(u))}</span>`;
    alert.classList.add("show");
    setTimeout(() => alert.classList.remove("show"), 2600);
  };
  if (reducedMotion()) return;
  setTimeout(show, 1800);
  setInterval(show, 5200);
  setInterval(() => {
    n += Math.round((Math.random() - 0.35) * 14);
    viewers.textContent = n.toLocaleString("fr-FR");
  }, 1600);
}
