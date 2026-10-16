// Configurateur de setup : 3 questions → un pack + des compléments adaptés.
// Raccourcis clavier : touches A, B, C, D pour répondre.
import { getProduct } from "./catalog.js";
import { $, $$, esc, price, icons, onVisible } from "./utils.js";

const STEPS = [
  {
    key: "content",
    q: "Tu streames quoi ?",
    opts: [
      { v: "pc", label: "Jeux PC", hint: "FPS, MOBA, simulation…" },
      { v: "console", label: "Jeux console", hint: "PS5, Xbox, Switch" },
      { v: "talk", label: "Talk & podcast", hint: "Just Chatting, débats, interviews" },
      { v: "creative", label: "Créatif", hint: "Musique, dessin, cuisine…" },
    ],
  },
  {
    key: "level",
    q: "Où en es-tu aujourd'hui ?",
    opts: [
      { v: "debutant", label: "Je me lance", hint: "Premiers lives, ou presque" },
      { v: "intermediaire", label: "Je streame déjà", hint: "Je veux passer un cap" },
      { v: "pro", label: "Je vise le rendu pro", hint: "Image et son irréprochables" },
    ],
  },
  {
    key: "budget",
    q: "Quel budget pour ton setup ?",
    opts: [
      { v: "s", label: "Moins de 500 €", hint: "L'essentiel, bien choisi" },
      { v: "m", label: "500 à 1 500 €", hint: "Le bon équilibre" },
      { v: "l", label: "Plus de 1 500 €", hint: "Sans compromis" },
    ],
  },
];

const EXTRA_BY_CONTENT = { pc: "deck-15", console: "capture-4k", talk: "vox-pro", creative: "lumen-key" };
const WHY = {
  pc: "Avec un contrôleur, tu changes de scène sans lâcher ta souris.",
  console: "Une carte d'acquisition est indispensable pour diffuser ta console.",
  talk: "En talk, ta voix est le produit : un micro broadcast fait toute la différence.",
  creative: "Une seconde source de lumière sculpte ton plan de travail.",
};

export function recommend({ content, level, budget }) {
  let pack = "pack-starter";
  if (budget === "m" && level !== "debutant") pack = "pack-createur";
  if (budget === "l") pack = level === "debutant" ? "pack-createur" : "pack-studio";
  const p = getProduct(pack);
  const extras = [];
  const extra = EXTRA_BY_CONTENT[content];
  if (extra && !p.includes.includes(extra) && !(content === "talk" && budget === "s")) extras.push(extra);
  if (pack === "pack-starter") extras.push("setup-remote");
  return { pack: p, extras: extras.map(getProduct) };
}

export function configurator(root) {
  if (!root) return;
  const card = $("[data-quiz-card]", root);
  const bars = $$("[data-quiz-steps] span", root);
  const answers = {};
  let step = 0;

  const renderStep = () => {
    bars.forEach((b, i) => b.classList.toggle("done", i < step));
    if (step >= STEPS.length) return renderResult();
    const s = STEPS[step];
    card.innerHTML = `<div class="quiz-q">
      <p class="mono muted">Question ${step + 1} / ${STEPS.length}</p>
      <h3 class="h-md">${esc(s.q)}</h3>
      <div class="quiz-opts">${s.opts
        .map(
          (o, i) => `<button class="quiz-opt" type="button" data-v="${esc(o.v)}">
            <span class="mono">${"ABCD"[i]}</span><strong>${esc(o.label)}</strong><span>${esc(o.hint)}</span></button>`,
        )
        .join("")}</div>
      ${step > 0 ? '<button class="quiz-back" type="button" data-back>← Question précédente</button>' : ""}
    </div>`;
  };

  const renderResult = () => {
    const { pack, extras } = recommend(answers);
    const all = [pack, ...extras];
    const total = all.reduce((s, p) => s + p.price, 0);
    const params = new URLSearchParams({ pack: pack.id, profil: `${answers.content}-${answers.level}-${answers.budget}` });
    card.innerHTML = `<div class="quiz-result">
      <div class="quiz-result-media"><img src="${esc(getProduct(pack.includes[0]).image)}" alt=""></div>
      <div class="qv-info">
        <span class="badge">Notre recommandation</span>
        <h3 class="h-md">${esc(pack.name)}${extras.length ? ` <span class="muted">+ ${extras.length}</span>` : ""}</h3>
        <p class="muted">${esc(pack.short)}</p>
        <ul>
          ${pack.includes.map((id) => `<li>${esc(getProduct(id).name)} — ${esc(getProduct(id).kind)}</li>`).join("")}
          ${extras.map((e) => `<li><strong>${esc(e.name)}</strong> — ${esc(e.kind)}</li>`).join("")}
        </ul>
        ${answers.content in WHY && extras.some((e) => e.id === EXTRA_BY_CONTENT[answers.content]) ? `<p class="muted"><em>${esc(WHY[answers.content])}</em></p>` : ""}
        <p class="price">${price(total)}</p>
        <div class="actions">
          <button class="btn btn-primary" type="button" data-add-all="${esc(all.map((p) => p.id).join(","))}">${icons.bag} Tout ajouter au panier</button>
          <a class="btn btn-ghost" href="agency.html?${params}#rdv">En parler à un expert</a>
        </div>
        <button class="quiz-back" type="button" data-restart>↺ Recommencer</button>
      </div>
    </div>`;
  };

  const choose = (v) => {
    answers[STEPS[step].key] = v;
    step += 1;
    renderStep();
  };

  card.addEventListener("click", (e) => {
    const opt = e.target.closest(".quiz-opt");
    if (opt) return choose(opt.dataset.v);
    if (e.target.closest("[data-back]")) {
      step = Math.max(0, step - 1);
      return renderStep();
    }
    if (e.target.closest("[data-restart]")) {
      step = 0;
      return renderStep();
    }
    const all = e.target.closest("[data-add-all]");
    if (all) {
      import("./cart.js").then(({ addToCart, openCart }) => {
        all.dataset.addAll.split(",").forEach((id) => addToCart(id, 1, { silent: true }));
        openCart();
      });
    }
  });

  let inView = false;
  onVisible(root, (v) => (inView = v), { threshold: 0.4 });
  document.addEventListener("keydown", (e) => {
    if (!inView || step >= STEPS.length || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.matches?.("input, textarea, select") || document.querySelector("dialog[open]")) return;
    const i = "abcd".indexOf(e.key.toLowerCase());
    const opt = STEPS[step].opts[i];
    if (opt) choose(opt.v);
  });

  renderStep();
}
