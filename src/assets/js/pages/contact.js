import { getProduct } from "../catalog.js";
import { $ } from "../utils.js";

export function init() {
  const params = new URLSearchParams(location.search);
  const form = $("form[name='contact']");
  if (!form) return;
  const subject = params.get("sujet");
  const select = form.querySelector("select[name='sujet']");
  if (subject && [...select.options].some((o) => o.value === subject)) select.value = subject;
  const product = getProduct(params.get("produit"));
  if (product) {
    form.querySelector("textarea[name='message']").value = `Bonjour, j'ai une question sur le ${product.name} (${product.kind}) : `;
  }
}
