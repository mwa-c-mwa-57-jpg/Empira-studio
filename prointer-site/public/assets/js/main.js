// PRO-INTER : menu, apparitions, vidéo, carte des agences, formulaires (envoi avec barre de progression)
document.documentElement.classList.add("js");
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];

// en-tête : ombre au défilement, menu mobile
const header = $("[data-header]");
const onScroll = () => header && header.classList.toggle("is-scrolled", window.scrollY > 8);
window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
const toggle = $("[data-nav-toggle]"), nav = $("[data-nav]");
if (toggle && nav) {
  const close = () => { toggle.setAttribute("aria-expanded", "false"); nav.classList.remove("is-open"); };
  toggle.addEventListener("click", () => { const open = toggle.getAttribute("aria-expanded") !== "true"; toggle.setAttribute("aria-expanded", String(open)); nav.classList.toggle("is-open", open); });
  $$("a", nav).forEach(a => a.addEventListener("click", close));
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
}

// apparitions au défilement
const reveals = $$(".reveal");
if ("IntersectionObserver" in window && !reduce) {
  const io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px", threshold: .12 });
  reveals.forEach(el => io.observe(el));
} else reveals.forEach(el => el.classList.add("is-in"));

// vidéo : son à la demande, pas de lecture automatique si l'utilisateur limite les animations
const video = $(".phone video"), sound = $("[data-sound]");
if (video && reduce) { video.removeAttribute("autoplay"); video.pause(); video.controls = true; if (sound) sound.hidden = true; }
if (video && sound) sound.addEventListener("click", () => {
  video.muted = !video.muted;
  if (!video.muted) { video.currentTime = 0; video.play().catch(() => {}); }
  sound.setAttribute("aria-pressed", String(!video.muted));
  $("use", sound).setAttribute("href", `/assets/img/icons.svg#${video.muted ? "sound-off" : "sound-on"}`);
  $("span", sound).textContent = video.muted ? "Activer le son" : "Couper le son";
});

// carte : l'agence survolée s'allume sur la carte (et inversement)
const light = (k, on) => $$(`[data-agency="${k}"]`).forEach(el => el.classList.toggle("is-active", on));
$$("[data-agency]").forEach(el => {
  const k = el.dataset.agency;
  ["mouseenter", "focusin"].forEach(ev => el.addEventListener(ev, () => light(k, true)));
  ["mouseleave", "focusout"].forEach(ev => el.addEventListener(ev, () => light(k, false)));
});

/* ---------------- formulaires ---------------- */
const MAX = 5 * 1024 * 1024, EXT = /\.(pdf|docx?)$/i;
const fmtSize = n => n > 1048576 ? `${(n / 1048576).toFixed(1).replace(".", ",")} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`;
const fileError = f => !f ? "" : !EXT.test(f.name) ? "Format accepté : PDF, DOC ou DOCX." : f.size > MAX ? `Fichier trop lourd (${fmtSize(f.size)}) : 5 Mo maximum.` : "";

// pré-remplissage depuis un lien « métier » de l'accueil
const params = new URLSearchParams(location.search);
["metier", "secteur"].forEach(k => { const el = document.getElementById(k), v = params.get(k); if (el && v) el.value = v.slice(0, 120); });

const box = name => document.querySelector(`[data-form] [data-field="${name}"]`);
function setError(name, msg) {
  const b = box(name); if (!b) return;
  b.classList.toggle("has-error", !!msg);
  const e = $(".error", b); if (e) e.textContent = msg || "";
  $$("input, select, textarea", b).forEach(i => msg ? i.setAttribute("aria-invalid", "true") : i.removeAttribute("aria-invalid"));
}
const focusField = (form, name) => { const el = name && form.elements[name]; if (el) (el instanceof RadioNodeList ? el[0] : el).focus(); };

// zones de dépôt de fichier
$$("[data-drop]").forEach(drop => {
  const input = $("input", drop), text = $("[data-drop-text]", drop), initial = text.innerHTML;
  input.addEventListener("change", () => {
    const f = input.files[0];
    drop.classList.toggle("has-file", !!f);
    if (f) { const s = document.createElement("span"); s.className = "file-name"; s.textContent = `${f.name} · ${fmtSize(f.size)}`; text.replaceChildren(s); }
    else text.innerHTML = initial;
    setError(input.name, fileError(f));
  });
  ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, () => drop.classList.add("is-over")));
  ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove("is-over")));
});

function check(form) {
  const errors = {};
  $$("input, select, textarea", form).forEach(el => {
    if (!el.name || el.closest(".hp") || errors[el.name]) return;
    if (el.type === "file") { const m = el.required && !el.files.length ? "Ajoutez votre CV (PDF, DOC ou DOCX)." : fileError(el.files[0]); if (m) errors[el.name] = m; return; }
    if (el.validity.valid) return;
    errors[el.name] = el.type === "checkbox" ? "Votre accord est nécessaire pour envoyer le formulaire."
      : el.validity.typeMismatch && el.type === "email" ? "Adresse e-mail invalide (exemple : vous@exemple.com)."
      : "Ce champ est obligatoire.";
  });
  return errors;
}

$$("[data-form]").forEach(form => {
  form.noValidate = true;                                     // sans JavaScript, le navigateur valide lui-même
  const btn = $("button[type=submit]", form), bar = $("[data-progress]", form), status = $("[data-status]", form);
  const success = form.parentElement.querySelector("[data-success]");
  const label = text => { btn.firstChild.textContent = text + " "; };
  form.addEventListener("input", e => { const n = e.target.name; if (n && e.target.type !== "file" && box(n)?.classList.contains("has-error")) setError(n, ""); });
  form.addEventListener("submit", e => {
    e.preventDefault(); status.textContent = "";
    $$("[data-field]", form).forEach(b => setError(b.dataset.field, ""));
    const errors = check(form), names = Object.keys(errors);
    if (names.length) { names.forEach(k => setError(k, errors[k])); focusField(form, names[0]); return; }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", form.action);
    xhr.setRequestHeader("Accept", "application/json");
    xhr.upload.addEventListener("progress", ev => { if (ev.lengthComputable) bar.style.width = `${Math.round(ev.loaded / ev.total * 100)}%`; });
    const done = () => { form.classList.remove("is-sending"); label(btn.dataset.label); bar.style.width = "0"; };
    xhr.addEventListener("load", () => {
      done();
      let res = {}; try { res = JSON.parse(xhr.responseText); } catch { /* réponse non JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && res.ok) {
        const name = (form.elements.prenom || form.elements.contact)?.value || "";
        $("[data-success-name]", success).textContent = name.trim();
        form.hidden = true; success.classList.add("is-visible"); success.focus({ preventScroll: true });
        success.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      } else if (res.errors) {
        Object.entries(res.errors).forEach(([k, m]) => setError(k, m));
        status.textContent = res.message || "Merci de corriger les champs signalés.";
        focusField(form, Object.keys(res.errors)[0]);
      } else status.textContent = res.message || "Un problème est survenu. Réessayez dans un instant ou appelez votre agence.";
    });
    xhr.addEventListener("error", () => { done(); status.textContent = "Connexion interrompue. Vérifiez votre réseau puis réessayez."; });
    form.classList.add("is-sending"); label(btn.dataset.sending);
    xhr.send(new FormData(form));
  });
});
