// Espace agence : confirmation avant chaque suppression
document.querySelectorAll("form[data-confirm]").forEach(f => f.addEventListener("submit", e => { if (!confirm(f.dataset.confirm)) e.preventDefault(); }));
