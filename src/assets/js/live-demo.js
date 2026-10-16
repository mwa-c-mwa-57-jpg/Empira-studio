// Démo « ton stream version Empira » : chat simulé, alertes et objectif animés.
import { $, esc, onVisible, reducedMotion } from "./utils.js";

const USERS = [
  ["nova_tv", "#8b6cff"],
  ["kaelys", "#ff4fa3"],
  ["rafou_93", "#3ee08f"],
  ["pixelmaya", "#ffc35c"],
  ["theo.plays", "#5ac8fa"],
  ["ines_live", "#ff8a3d"],
  ["mathgaming", "#c08bff"],
  ["sora", "#3df5ff"],
  ["lucas_rx", "#ff6b6b"],
  ["zoe.mp4", "#b4f461"],
];
const LINES = [
  "le son est incroyable ce soir",
  "c'est quoi ton micro ??",
  "GG !!!",
  "la lumière est trop propre",
  "première fois ici, salut tout le monde 👋",
  "la transition de scène 🔥",
  "on voit grave mieux qu'avant",
  "t'as changé de caméra ?",
  "le flou derrière c'est cinéma",
  "hype hype hype",
  "trop bien les nouvelles alertes",
  "l'overlay est magnifique",
  "on est là 💜",
  "le chat est chaud ce soir",
  "clip ça direct",
];
const ALERTS = {
  follow: { icon: "♥", label: "Nouveau follower", msg: (u) => `${u} te suit !`, goal: 1 },
  sub: { icon: "★", label: "Nouvel abonné", msg: (u) => `${u} s'abonne · 3 mois`, goal: 5 },
  raid: { icon: "⚡", label: "Raid entrant", msg: (u) => `${u} débarque avec 87 viewers`, goal: 10 },
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function liveDemo(root) {
  if (!root) return;
  const chat = $("[data-chat]", root);
  const alert = $("[data-stream-alert]", root);
  const frame = $(".stream-frame", root);
  const goalBar = $("[data-goal-bar]", root);
  const goalText = $("[data-goal-text]", root);
  const viewers = $("[data-stream-viewers]", root);
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
    const li = `<b class="u">${esc(u)}</b> ${esc(pick(LINES))}`;
    push(li);
    chat.lastElementChild.querySelector(".u").style.color = c;
  };
  const updateGoal = () => {
    goalBar.style.transform = `scaleX(${Math.min(1, goal / GOAL)})`;
    goalText.textContent = `${Math.min(goal, GOAL)} / ${GOAL}`;
  };

  const trigger = (type) => {
    const a = ALERTS[type];
    const [u] = pick(USERS);
    alert.innerHTML = `<span class="ov-alert-icon">${a.icon}</span><span><small>${a.label}</small>${esc(a.msg(u))}</span>`;
    alert.classList.remove("show");
    void alert.offsetWidth;
    alert.classList.add("show");
    frame.classList.add("flash");
    clearTimeout(alertTimer);
    alertTimer = setTimeout(() => {
      alert.classList.remove("show");
      frame.classList.remove("flash");
    }, 2800);
    push(`<strong>${a.icon} ${esc(a.msg(u))}</strong>`, "sys");
    goal = goal >= GOAL ? a.goal : goal + a.goal;
    updateGoal();
    if (viewers && type === "raid") viewers.textContent = (Number(viewers.textContent.replace(/\D/g, "")) + 87).toLocaleString("fr-FR");
  };

  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-alert]");
    if (b) trigger(b.dataset.alert);
  });

  for (let i = 0; i < 7; i++) message();
  updateGoal();
  if (reducedMotion()) return;

  const tick = () => {
    message();
    if (Math.random() < 0.12) trigger(pick(["follow", "follow", "sub"]));
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
