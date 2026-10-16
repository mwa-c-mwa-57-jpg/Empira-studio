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
};

const load = PAGES[document.body.dataset.page];
if (load) {
  load()
    .then((m) => m.init())
    .catch((err) => console.error(err));
}
