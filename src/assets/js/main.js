// Point d'entrée : interactions communes, puis le module propre à la page.
import { initUI } from "./ui.js";
import { initCart } from "./cart.js";
import { initQuickView } from "./products-ui.js";

initUI();
initCart();
initQuickView();

const PAGES = {
  index: () => import("./pages/home.js"),
  boutique: () => import("./pages/shop.js"),
  produit: () => import("./pages/product.js"),
  agency: () => import("./pages/agency.js"),
  contact: () => import("./pages/contact.js"),
  succes: () => import("./pages/success.js"),
  404: () => import("./pages/notfound.js"),
  admin: () => import("./pages/admin.js"),
};

// La page courante est déclarée sur <body data-page> (ou sur un élément [data-page] si le site est intégré ailleurs).
const page = document.body.dataset.page || document.querySelector("[data-page]")?.dataset.page;
const load = PAGES[page];
if (load) {
  load()
    .then((m) => m.init())
    .catch((err) => console.error(err));
}
