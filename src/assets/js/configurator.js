// Configurateur de setup : 3 questions → un pack + des compléments adaptés.
// Raccourcis clavier : touches A, B, C, D pour répondre.
import { getProduct, fullName } from "./catalog.js";
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
    q: "Quel budget pour ton son ?",
    opts: [
      { v: "s", label: "Moins de 150 €", hint: "L'essentiel, bien choisi" },
      { v: "m", label: "150 à 250 €", hint: "Micro + régie son" },
      { v: "l", label: "Plus de 250 €", hint: "Le rendu broadcast" },
    ],
  },
];

const WHY = {
  "pack-starter": "En USB, le PD200XS se branche directement sur ton ordinateur : pas besoin d'interface pour démarrer.",
  "pack-maono-streaming": "La G1 NEO ajoute la réduction de bruit, les effets de voix et les pads sonores : idéal pour animer tes lives.",
  "pack-podcast-rode": "Le RØDE PodMic est un micro de studio radio : avec la G1 NEO, ta voix passe au niveau broadcast.",
};
const NOTE = {
  console: "Bon à savoir : pour diffuser une console, il faut aussi une carte d'acquisition vidéo. On t'aide à la choisir pendant l'appel gratuit.",
};

export function recommend({ content, level, budget }) {
  let pack = "pack-starter";
  if (budget === "m") pack = level === "pro" || content === "talk" ? "pack-podcast-rode" : "pack-maono-streaming";
  if (budget === "l") pack = level === "debutant" && content !== "talk" ? "pack-maono-streaming" : "pack-podcast-rode";
  const extras = level === "debutant" ? ["setup-remote"] : [];
  return { pack: getProduct(pack), extras: extras.map(getProduct) };
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
      <div class="quiz-result-media"><img src="${esc(pack.image)}" alt=""></div>
      <div class="qv-info">
        <span class="badge">Notre recommandation</span>
        <h3 class="h-md">${esc(pack.name)}${extras.length ? ` <span class="muted">+ ${extras.length}</span>` : ""}</h3>
        <p class="muted">${esc(pack.short)}</p>
        <ul>
          ${pack.includes.map((id) => `<li>${esc(fullName(getProduct(id)))} — ${esc(getProduct(id).kind)}</li>`).join("")}
          ${extras.map((e) => `<li><strong>${esc(e.name)}</strong> — ${esc(e.kind)}</li>`).join("")}
        </ul>
        <p class="muted"><em>${esc(WHY[pack.id])}</em>${NOTE[answers.content] ? `<br><em>${esc(NOTE[answers.content])}</em>` : ""}</p>
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
