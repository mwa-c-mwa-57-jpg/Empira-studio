// Section « parcours » : les étapes défilent horizontalement pendant que
// l'on scrolle verticalement (desktop uniquement, désactivé si mouvement réduit).
import { $, clamp } from "./utils.js";

export function journey(section) {
  if (!section) return;
  const track = $("[data-journey-track]", section);
  const bar = $("[data-journey-bar]", section);
  const mq = window.matchMedia("(min-width: 761px) and (prefers-reduced-motion: no-preference)");
  let ticking = false;

  const update = () => {
    ticking = false;
    if (!mq.matches) {
      track.style.transform = "";
      return;
    }
    const rect = section.getBoundingClientRect();
    const total = section.offsetHeight - window.innerHeight;
    const progress = clamp(-rect.top / total, 0, 1);
    const distance = track.scrollWidth - window.innerWidth;
    track.style.transform = `translate3d(${-progress * distance}px, 0, 0)`;
    if (bar) bar.style.transform = `scaleX(${progress})`;
  };
  const request = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };
  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request);
  mq.addEventListener("change", request);
  update();
}
