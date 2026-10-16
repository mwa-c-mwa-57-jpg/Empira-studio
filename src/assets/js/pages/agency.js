import { getSelection } from "../catalog.js";
import { $, $$, clamp } from "../utils.js";

function timeline(list) {
  if (!list) return;
  const bar = $(".timeline-progress", list);
  const items = $$("li", list);
  const update = () => {
    const r = list.getBoundingClientRect();
    const mid = window.innerHeight * 0.6;
    const p = clamp((mid - r.top) / r.height, 0, 1);
    bar.style.transform = `scaleY(${p})`;
    items.forEach((li) => {
      const lr = li.getBoundingClientRect();
      li.classList.toggle("is-in", lr.top < mid);
    });
  };
  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        update();
      });
    },
    { passive: true },
  );
  update();
}

function videoToggle() {
  const btn = $("[data-video-toggle]");
  const video = $(".agency-hero video");
  if (!btn || !video) return;
  const label = $("[data-video-label]", btn);
  const sync = () => {
    const playing = !video.paused;
    btn.setAttribute("aria-pressed", String(!playing));
    label.textContent = playing ? "Pause vidéo" : "Lire la vidéo";
    $(".i-pause", btn).toggleAttribute("hidden", !playing);
    $(".i-play", btn).toggleAttribute("hidden", playing);
  };
  btn.addEventListener("click", () => {
    if (video.paused) {
      delete video.dataset.paused;
      video.play().catch(() => {});
    } else {
      video.dataset.paused = "1";
      video.pause();
    }
  });
  video.addEventListener("play", sync);
  video.addEventListener("pause", sync);
  sync();
}

// Pré-remplit le formulaire quand on arrive depuis le configurateur.
function prefill() {
  const params = new URLSearchParams(location.search);
  const form = $("form[name='agency']");
  if (!form) return;
  const sel = getSelection(params.get("selection"));
  const profil = (params.get("profil") || "").replace(/[^a-z-]/g, "");
  if (sel) {
    form.querySelector('input[name="demande"][value="materiel"]').checked = true;
    const msg = form.querySelector("textarea[name='message']");
    msg.value = `Le configurateur m'a recommandé la sélection « ${sel.name} »${profil ? ` (profil : ${profil})` : ""}. J'aimerais en parler avec vous.`;
  }
}

export function init() {
  timeline($("[data-timeline]"));
  videoToggle();
  prefill();
}
