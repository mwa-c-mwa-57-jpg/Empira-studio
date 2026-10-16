import { LISTED, CATEGORIES } from "../catalog.js";
import { $, $$, esc } from "../utils.js";
import { cardHTML, stagger } from "../products-ui.js";

const SORTS = {
  pertinence: (a, b) => LISTED.indexOf(a) - LISTED.indexOf(b),
  "prix-asc": (a, b) => a.price - b.price,
  "prix-desc": (a, b) => b.price - a.price,
  nom: (a, b) => a.name.localeCompare(b.name, "fr"),
};

// « rode » doit trouver « RØDE » : on retire accents et lettres spéciales.
const normalize = (s) =>
  s
    .toLowerCase()
    .replace(/ø/g, "o")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export function init() {
  const params = new URLSearchParams(location.search);
  const state = {
    cat: CATEGORIES.some((c) => c.id === params.get("cat")) ? params.get("cat") : "tout",
    q: (params.get("q") || "").slice(0, 60),
    sort: SORTS[params.get("tri")] ? params.get("tri") : "pertinence",
  };

  const chips = $("[data-cats]");
  const grid = $("[data-grid]");
  const count = $("[data-count-label]");
  const search = $("[data-search]");
  const sort = $("[data-sort]");

  const counts = Object.fromEntries(CATEGORIES.map((c) => [c.id, LISTED.filter((p) => p.category === c.id).length]));
  chips.innerHTML = [{ id: "tout", label: "Tout" }, ...CATEGORIES.filter((c) => counts[c.id] > 0)]
    .map(
      (c) =>
        `<button class="chip" type="button" data-cat="${esc(c.id)}" aria-pressed="false">${esc(c.label)} <small>${
          c.id === "tout" ? LISTED.length : counts[c.id]
        }</small></button>`,
    )
    .join("");
  search.value = state.q;
  sort.value = state.sort;

  if (params.get("paiement") === "annule") $("[data-cancel-banner]").hidden = false;

  const render = () => {
    $$("[data-cat]", chips).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cat === state.cat)));
    const q = normalize(state.q.trim());
    const list = LISTED.filter((p) => state.cat === "tout" || p.category === state.cat)
      .filter((p) => !q || normalize(`${p.brand || ""} ${p.name} ${p.kind} ${p.short} ${p.category}`).includes(q))
      .sort(SORTS[state.sort]);
    grid.innerHTML = list.map((p, i) => cardHTML(p, i)).join("");
    stagger(grid);
    $("[data-empty]").hidden = list.length > 0;
    count.textContent = `${list.length} produit${list.length > 1 ? "s" : ""}`;

    const url = new URL(location.href);
    url.searchParams.delete("paiement");
    state.cat === "tout" ? url.searchParams.delete("cat") : url.searchParams.set("cat", state.cat);
    state.q ? url.searchParams.set("q", state.q) : url.searchParams.delete("q");
    state.sort === "pertinence" ? url.searchParams.delete("tri") : url.searchParams.set("tri", state.sort);
    history.replaceState(null, "", url);
  };

  chips.addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat]");
    if (!b) return;
    state.cat = b.dataset.cat;
    b.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    render();
  });
  let t;
  search.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      state.q = search.value.slice(0, 60);
      render();
    }, 160);
  });
  sort.addEventListener("change", () => {
    state.sort = sort.value;
    render();
  });
  $("[data-reset]").addEventListener("click", () => {
    state.cat = "tout";
    state.q = "";
    search.value = "";
    render();
  });
  render();
}
